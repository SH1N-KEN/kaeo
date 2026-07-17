/**
 * Libby v2 — Shared Types
 *
 * All shared types and interfaces for the Libby intelligence layer.
 * No business logic here — pure type definitions only.
 */

// ─── Intent Types ─────────────────────────────────────────────────────────────

/**
 * High-level intent categories detected from user messages.
 * Used by the intelligence layer to scope data retrieval.
 */
export type LibbyIntent =
  | 'dashboard'       // Cash flow, income, expenses, net cash questions
  | 'reports'         // Report summary, readiness, export questions
  | 'risk'            // Risk inbox, duplicates, unusual transactions
  | 'vendors'         // Vendor spend, top vendors, specific vendor queries
  | 'transactions'    // Categorization, review queue, transaction details
  | 'staff_spend'     // Staff expenses, petty cash, proof status
  | 'billing'         // Subscription plan, billing cycle, limits
  | 'workspace_summary' // Full workspace overview, month-end summary
  | 'general';        // Casual, unrecognized, or cross-cutting queries

/**
 * Response display mode — controls how Libby formats its answer.
 */
export type LibbyResponseMode =
  | 'metric_answer'   // Specific financial question with exact verified totals
  | 'priority_advice' // Action-first ranked guidance with minimal numbers
  | 'explanation'     // Short explanation of a concept or tradeoff
  | 'report_summary'  // High-level financial aggregate summary
  | 'vendor_review'   // Vendor spend analysis and alternatives
  | 'risk_review'     // Open compliance risks, duplicates, exposure
  | 'invoice_review'  // Invoice matching, overdue, mismatched counts
  | 'casual_followup'; // Short conversational 1-2 sentence reply

// ─── Workspace Context ────────────────────────────────────────────────────────

/** Financial KPI summary derived from transactions. */
export interface FinancialSummary {
  income: number;
  expenses: number;
  refunds: number;
  netCash: number;
  transactionCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  baseCurrency: string;
}

/** A single risk event from the Risk Inbox. */
export interface RiskEvent {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  risk_type: string;
  amount_at_risk: number;
  status: string;
}

/** A vendor with aggregated spend data. */
export interface VendorSummaryItem {
  normalized_name: string;
  display_name: string;
  category: string;
  totalSpend: number;
  monthlyAverage: number;
  isRecurring: boolean;
}

/** Aggregated vendor intelligence. */
export interface VendorIntelligence {
  topVendors: VendorSummaryItem[];
  recurringVendors: VendorSummaryItem[];
  recurringCommitment: number;
  totalVendorCount: number;
}

/** Staff spend analysis. */
export interface StaffSpendSummary {
  count: number;
  totalAmount: number;
  missingProofCount: number;
  unknownPaymentMethodCount: number;
  mixedPaymentMethodRiskCount: number;
  proofRiskCount: number;
  hasStaffExpenses: boolean;
  topStaffVendors: Array<{ name: string; spend: string }>;
}

/** Invoice tracking data. */
export interface InvoiceSummary {
  totalCount: number;
  unmatchedCount: number;
  overdueCount: number;
  mismatchCount: number;
  duplicateCount: number;
  topInvoicedVendors: Array<{ name: string; spend: number }>;
}

/** Billing and subscription information. */
export interface BillingInfo {
  exists: boolean;
  planName: string;
  billingCycle: string;
  subscriptionStatus: string;
}

/** Latest report metadata. */
export interface ReportSummary {
  exists: boolean;
  executiveSummary: string | null;
  createdAt: string | null;
}

/** Workspace settings and business profile. */
export interface WorkspaceSettings {
  clientId: string;
  clientName: string;
  industry: string;
  baseCurrency: string;
  accountMode: 'business_owner' | 'accountant' | null;
  onboardingCompleted: boolean;
  monthlySpendRange: string;
  teamSize: string;
  accountingTools: string[];
  painPoints: string[];
  notes: string;
}

/**
 * Full workspace context object built by contextEngine.
 * Contains everything Libby might need to answer any question.
 */
export interface WorkspaceContext {
  settings: WorkspaceSettings;
  financial: FinancialSummary;
  risks: RiskEvent[];
  vendors: VendorIntelligence;
  staffSpend: StaffSpendSummary;
  invoices: InvoiceSummary;
  latestReport: ReportSummary;
  billing: BillingInfo;
  relevantNotes: string[];
  /** Raw transactions for pass-through to sanitizer and deep queries */
  rawTransactions: any[];
  /** Raw vendor records for matching queries */
  rawVendors: any[];
  /** Approved number set for hallucination detection */
  approvedNumbers: Set<number>;
  /** Duplicate exposure in rupees from duplicate-type risks */
  duplicateExposure: number;
  /** Uploaded filenames in workspace */
  uploads?: string[];
}

// ─── Relevant Data Slice ──────────────────────────────────────────────────────

/**
 * Focused data slice returned by retrieveRelevantData().
 * Only contains what is needed for the detected intent.
 * Keeps AI context payloads lean.
 */
export interface RelevantData {
  intent: LibbyIntent;
  financial?: Pick<FinancialSummary, 'income' | 'expenses' | 'refunds' | 'netCash' | 'transactionCount' | 'periodStart' | 'periodEnd'>;
  risks?: Array<Pick<RiskEvent, 'title' | 'severity' | 'amount_at_risk' | 'risk_type'>>;
  vendors?: {
    topVendors: VendorSummaryItem[];
    recurringVendors: VendorSummaryItem[];
    recurringCommitment: number;
    totalVendorCount: number;
  };
  staffSpend?: StaffSpendSummary;
  invoices?: InvoiceSummary;
  billing?: BillingInfo;
  report?: ReportSummary;
  counts: {
    transactions: number;
    vendors: number;
    risks: number;
  };
}
