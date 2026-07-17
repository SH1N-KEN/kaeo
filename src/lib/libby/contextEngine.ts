/**
 * Libby v2 — Workspace Context Engine
 *
 * Builds a complete, strongly-typed WorkspaceContext by gathering all
 * relevant workspace information from Supabase.
 *
 * This module is the single source of truth for workspace data.
 * It does NOT generate prompts. It only fetches and structures data.
 *
 * All Supabase queries are clearly named and isolated.
 */

import { supabase } from '../supabase';
import { summarizeVendors } from '../reportEngine';
import { getCleanTransactions } from '../transactionFilters';
import { calculateMonthEndReadiness } from '../readinessEngine';
import { formatINR } from '../formatters';
import type {
  WorkspaceContext,
  WorkspaceSettings,
  FinancialSummary,
  RiskEvent,
  VendorIntelligence,
  VendorSummaryItem,
  StaffSpendSummary,
  InvoiceSummary,
  BillingInfo,
  ReportSummary,
} from './types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Safely resolves a field from a transaction, including raw_row_json fallbacks. */
function resolveStaffField(tx: any, field: string): any {
  return tx[field] !== undefined && tx[field] !== null
    ? tx[field]
    : tx.raw_row_json?.[field] ?? tx.raw_row_json?.metadata?.[field];
}

/** Returns the canonical amount for a transaction, preferring base currency. */
function getTxAmount(t: any): number {
  return t.amount_in_base_currency !== null && t.amount_in_base_currency !== undefined
    ? Number(t.amount_in_base_currency)
    : Number(t.amount);
}

// ─── Section Fetchers ─────────────────────────────────────────────────────────

async function fetchWorkspaceSettings(
  clientId: string,
  _orgId: string
): Promise<WorkspaceSettings> {
  const { data: { user } } = await supabase.auth.getUser();

  let accountMode: 'business_owner' | 'accountant' | null = null;
  let onboardingCompleted = true;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_mode, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      accountMode = profile.account_mode || null;
      onboardingCompleted = !!profile.onboarding_completed;
    }
  }

  const { data: clientData } = await supabase
    .from('clients')
    .select('name, industry, base_currency, metadata')
    .eq('id', clientId)
    .single();

  const meta = clientData?.metadata || {};

  return {
    clientId,
    clientName: clientData?.name || 'Active Client',
    industry: clientData?.industry || meta?.industry || '',
    baseCurrency: 'INR',
    accountMode,
    onboardingCompleted,
    monthlySpendRange: meta?.monthly_spend_range || '',
    teamSize: meta?.team_size || '',
    accountingTools: meta?.accounting_tools || [],
    painPoints: meta?.pain_points || [],
    notes: meta?.notes || '',
  };
}

async function fetchTransactionsAndKPIs(
  clientId: string
): Promise<{ transactions: any[]; financial: FinancialSummary }> {
  const { data: rawTxs } = await supabase
    .from('transactions')
    .select('*')
    .eq('client_id', clientId)
    .order('transaction_date', { ascending: false });

  const transactions = getCleanTransactions(rawTxs || []);

  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(getTxAmount(t) || 0), 0);

  const refunds = transactions
    .filter(t => t.type === 'refund')
    .reduce((sum, t) => sum + Math.abs(getTxAmount(t) || 0), 0);

  const expenses = transactions
    .filter(t => ['expense', 'vendor_payment', 'subscription'].includes(t.type))
    .reduce((sum, t) => sum + Math.abs(getTxAmount(t) || 0), 0);

  const netCash = income + refunds - expenses;

  const financial: FinancialSummary = {
    income,
    expenses,
    refunds,
    netCash,
    transactionCount: transactions.length,
    periodStart: transactions.length > 0 ? transactions[transactions.length - 1].transaction_date : null,
    periodEnd: transactions.length > 0 ? transactions[0].transaction_date : null,
    baseCurrency: 'INR',
  };

  return { transactions, financial };
}

async function fetchRisks(clientId: string): Promise<RiskEvent[]> {
  const { data: risksData } = await supabase
    .from('risk_events')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'open');

  return (risksData || []).map(r => ({
    id: r.id,
    title: r.title,
    severity: r.severity as 'high' | 'medium' | 'low',
    risk_type: r.risk_type || '',
    amount_at_risk: Number(r.amount_at_risk) || 0,
    status: r.status,
  }));
}

async function fetchVendorIntelligence(
  clientId: string,
  transactions: any[]
): Promise<{ intelligence: VendorIntelligence; rawVendors: any[] }> {
  const { data: vendorsData } = await supabase
    .from('vendors')
    .select('*')
    .eq('client_id', clientId);

  const rawVendors = vendorsData || [];
  const summary = summarizeVendors(rawVendors, transactions);

  const mapVendor = (v: any): VendorSummaryItem => ({
    normalized_name: v.normalized_name,
    display_name: v.display_name || v.name || v.normalized_name,
    category: v.category || 'Vendor',
    totalSpend: v.totalSpend ?? 0,
    monthlyAverage: v.monthly_average || 0,
    isRecurring: !!(v.is_recurring || v.isRecurring),
  });

  const intelligence: VendorIntelligence = {
    topVendors: summary.topVendors.map(mapVendor),
    recurringVendors: summary.recurringVendors.map(mapVendor),
    recurringCommitment: summary.recurringCommitment,
    totalVendorCount: rawVendors.length,
  };

  return { intelligence, rawVendors };
}

async function fetchInvoices(clientId: string): Promise<InvoiceSummary> {
  const { data: invoicesData } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId);

  const invoices = invoicesData || [];

  const unmatchedInvoices = invoices.filter(
    inv => inv.status === 'unpaid' || inv.status === 'uploaded' ||
           inv.status === 'extracted' || inv.status === 'needs_review'
  );
  const overdueInvoices = invoices.filter(
    inv => inv.status === 'overdue' || (inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date())
  );
  const mismatchInvoices = invoices.filter(inv => inv.status === 'mismatch');

  const invGroups: Record<string, number> = {};
  invoices.forEach(inv => {
    if (inv.invoice_number && inv.vendor_name) {
      const k = `${inv.vendor_name.toLowerCase()}_${inv.invoice_number.toLowerCase()}`;
      invGroups[k] = (invGroups[k] || 0) + 1;
    }
  });
  const duplicateCount = Object.values(invGroups).filter(count => count > 1).length;

  const vendorInvoiceSums: Record<string, number> = {};
  invoices.forEach(inv => {
    const v = inv.vendor_name || 'Unknown Vendor';
    vendorInvoiceSums[v] = (vendorInvoiceSums[v] || 0) + (inv.total_amount || 0);
  });
  const topInvoicedVendors = Object.entries(vendorInvoiceSums)
    .map(([name, spend]) => ({ name, spend }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  return {
    totalCount: invoices.length,
    unmatchedCount: unmatchedInvoices.length,
    overdueCount: overdueInvoices.length,
    mismatchCount: mismatchInvoices.length,
    duplicateCount,
    topInvoicedVendors,
  };
}

function buildStaffSpendSummary(
  transactions: any[],
  risks: RiskEvent[]
): StaffSpendSummary {
  const staffTxs = transactions.filter(tx => {
    const isStaff = resolveStaffField(tx, 'is_staff_expense') === true ||
                    resolveStaffField(tx, 'is_staff_expense') === 'true';
    const cat = tx.category || '';
    return isStaff || cat === 'Staff / Petty Expenses';
  });

  const staffTotalAmount = staffTxs.reduce((sum, tx) => sum + Math.abs(getTxAmount(tx)), 0);

  const staffMissingProof = staffTxs.filter(tx => {
    const ps = resolveStaffField(tx, 'proof_status');
    return !ps || ps === 'missing' || ps === 'needs_review';
  });

  const staffUnknownMethod = staffTxs.filter(tx => {
    const pm = resolveStaffField(tx, 'payment_method') || 'unknown';
    return pm === 'unknown';
  });

  const mixedPaymentMethodRisks = risks.filter(r => r.risk_type === 'mixed_payment_method_spend');
  const proofRisks = risks.filter(r => r.risk_type === 'staff_expense_missing_proof');

  const topStaffVendorMap: Record<string, number> = {};
  staffTxs.forEach(tx => {
    const key = tx.description?.split(' ')[0] || 'Misc';
    topStaffVendorMap[key] = (topStaffVendorMap[key] || 0) + Math.abs(getTxAmount(tx));
  });
  const topStaffVendors = Object.entries(topStaffVendorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, spend]) => ({ name, spend: formatINR(spend) }));

  return {
    count: staffTxs.length,
    totalAmount: staffTotalAmount,
    missingProofCount: staffMissingProof.length,
    unknownPaymentMethodCount: staffUnknownMethod.length,
    mixedPaymentMethodRiskCount: mixedPaymentMethodRisks.length,
    proofRiskCount: proofRisks.length,
    hasStaffExpenses: staffTxs.length > 0,
    topStaffVendors,
  };
}

async function fetchLatestReport(clientId: string): Promise<ReportSummary> {
  const { data: latestReport } = await supabase
    .from('reports')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (latestReport && latestReport.length > 0) {
    return {
      exists: true,
      executiveSummary: latestReport[0].summary_json?.executive_summary ||
                        JSON.stringify(latestReport[0].summary_json),
      createdAt: latestReport[0].created_at || null,
    };
  }

  return { exists: false, executiveSummary: null, createdAt: null };
}

async function fetchBillingInfo(orgId: string): Promise<BillingInfo> {
  if (!orgId) {
    return { exists: false, planName: '', billingCycle: '', subscriptionStatus: '' };
  }

  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, billing_plans(*)')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (sub) {
      return {
        exists: true,
        planName: sub.billing_plans?.name || sub.plan_id || '',
        billingCycle: sub.billing_cycle || 'monthly',
        subscriptionStatus: sub.status || 'active',
      };
    }
  } catch (err) {
    console.warn('[Libby contextEngine] Error fetching billing info:', err);
  }

  return { exists: false, planName: '', billingCycle: '', subscriptionStatus: '' };
}

async function fetchRelevantNotes(clientId: string): Promise<string[]> {
  const { data: notesData } = await supabase
    .from('notes')
    .select('note')
    .eq('client_id', clientId);

  return (notesData || []).map(n => n.note).filter(Boolean);
}

function buildApprovedNumbers(
  financial: FinancialSummary,
  risks: RiskEvent[],
  rawVendors: any[],
  rawTransactions: any[],
  invoices: InvoiceSummary,
  vendors: VendorIntelligence,
  duplicateExposure: number
): Set<number> {
  const approved = new Set<number>([
    Math.round(financial.income),
    Math.round(financial.expenses),
    Math.round(financial.refunds),
    Math.round(financial.netCash),
    Math.round(vendors.recurringCommitment),
    vendors.recurringVendors.length,
    risks.filter(r => r.severity === 'high').length,
    financial.transactionCount,
    vendors.totalVendorCount,
    risks.length,
    Math.round(duplicateExposure),
    invoices.totalCount,
    invoices.unmatchedCount,
    invoices.overdueCount,
    invoices.mismatchCount,
    invoices.duplicateCount,
  ]);

  vendors.topVendors.forEach(v => approved.add(Math.round(v.totalSpend)));

  rawVendors.forEach(v => {
    approved.add(Math.round(Number(v.monthly_average || 0)));
    approved.add(Math.round(Number(v.total_spend || v.spend || 0)));
  });

  rawTransactions.forEach(t => {
    approved.add(Math.round(Math.abs(Number(t.amount || 0))));
  });

  risks.forEach(r => approved.add(Math.round(r.amount_at_risk)));

  return approved;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a complete WorkspaceContext for the given workspace.
 *
 * Gathers all relevant financial data in parallel where possible.
 * Returns strongly typed structured data — no prompt generation here.
 *
 * @param clientId - The active client ID
 * @param orgId    - The active organization ID
 * @returns WorkspaceContext
 */
export async function buildWorkspaceContext(
  clientId: string,
  orgId: string
): Promise<WorkspaceContext> {
  // Fetch workspace settings first (needed to check onboarding)
  const settings = await fetchWorkspaceSettings(clientId, orgId);

  // Fetch transactions + KPIs (transactions needed by other fetchers)
  const { transactions, financial } = await fetchTransactionsAndKPIs(clientId);

  // Parallel fetch: risks, vendor intelligence, invoices, reports, billing, notes
  const [
    risks,
    { intelligence: vendors, rawVendors },
    invoices,
    latestReport,
    billing,
    relevantNotes,
  ] = await Promise.all([
    fetchRisks(clientId),
    fetchVendorIntelligence(clientId, transactions),
    fetchInvoices(clientId),
    fetchLatestReport(clientId),
    fetchBillingInfo(orgId),
    fetchRelevantNotes(clientId),
  ]);

  // Build derived data (pure computation, no I/O)
  const staffSpend = buildStaffSpendSummary(transactions, risks);

  const duplicateExposure = risks
    .filter(r => r.risk_type?.includes('duplicate'))
    .reduce((sum, r) => sum + r.amount_at_risk, 0);

  const approvedNumbers = buildApprovedNumbers(
    financial,
    risks,
    rawVendors,
    transactions,
    invoices,
    vendors,
    duplicateExposure
  );

  return {
    settings,
    financial,
    risks,
    vendors,
    staffSpend,
    invoices,
    latestReport,
    billing,
    relevantNotes: relevantNotes.slice(0, 10),
    rawTransactions: transactions,
    rawVendors,
    approvedNumbers,
    duplicateExposure,
  };
}

/**
 * Checks if onboarding is complete for this workspace context.
 * Returns a user-facing message if blocked, null if allowed to proceed.
 */
export function checkOnboardingGate(context: WorkspaceContext): string | null {
  if (!context.settings.onboardingCompleted) {
    return "I can answer your questions much better after you complete the initial onboarding setup. Please set up your business profile or client list first.";
  }
  return null;
}

/**
 * Checks if there is any financial data in the workspace.
 * Returns a user-facing message if empty, null if data exists.
 */
export function checkEmptyWorkspace(context: WorkspaceContext): string | null {
  if (context.rawTransactions.length === 0 && context.invoices.totalCount === 0) {
    return "Upload a statement first so I can answer from your Kaeo data.";
  }
  return null;
}

// Re-export the readiness helper for use in the orchestrator
export { calculateMonthEndReadiness };
