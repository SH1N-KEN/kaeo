/**
 * Libby v2 — Data Retriever
 *
 * Slices the full WorkspaceContext down to only the data relevant
 * for answering the detected intent.
 *
 * Pure function — no Supabase calls, no side effects.
 * Keeps AI context payloads lean and focused.
 */

import type { LibbyIntent, WorkspaceContext, RelevantData } from './types';

/**
 * Returns only the workspace data relevant to the detected intent.
 *
 * Instead of sending the entire WorkspaceContext to the AI on every call,
 * this function selects the minimal data slice needed.
 *
 * Examples:
 *   - A vendor question → only vendor totals, vendor trends
 *   - A risk question   → only open risks, duplicate exposure
 *   - A billing query   → only billing plan info
 *
 * @param intent  - Detected LibbyIntent from intentEngine
 * @param context - Full WorkspaceContext from contextEngine
 * @returns RelevantData focused on the intent
 */
export function retrieveRelevantData(
  intent: LibbyIntent,
  context: WorkspaceContext
): RelevantData {
  // Common counts always included for grounding
  const counts = {
    transactions: context.financial.transactionCount,
    vendors: context.vendors.totalVendorCount,
    risks: context.risks.length,
  };

  switch (intent) {

    case 'dashboard':
      // Financial KPI questions — only need the core numbers
      return {
        intent,
        financial: {
          income: context.financial.income,
          expenses: context.financial.expenses,
          refunds: context.financial.refunds,
          netCash: context.financial.netCash,
          transactionCount: context.financial.transactionCount,
          periodStart: context.financial.periodStart,
          periodEnd: context.financial.periodEnd,
        },
        counts,
      };

    case 'vendors':
      // Vendor questions — vendor intelligence + financial summary for context
      return {
        intent,
        vendors: {
          topVendors: context.vendors.topVendors,
          recurringVendors: context.vendors.recurringVendors,
          recurringCommitment: context.vendors.recurringCommitment,
          totalVendorCount: context.vendors.totalVendorCount,
        },
        financial: {
          income: context.financial.income,
          expenses: context.financial.expenses,
          refunds: context.financial.refunds,
          netCash: context.financial.netCash,
          transactionCount: context.financial.transactionCount,
          periodStart: context.financial.periodStart,
          periodEnd: context.financial.periodEnd,
        },
        counts,
      };

    case 'risk':
      // Risk questions — open risks + invoice data for full picture
      return {
        intent,
        risks: context.risks.map(r => ({
          title: r.title,
          severity: r.severity,
          amount_at_risk: r.amount_at_risk,
          risk_type: r.risk_type,
        })),
        invoices: context.invoices,
        financial: {
          income: context.financial.income,
          expenses: context.financial.expenses,
          refunds: context.financial.refunds,
          netCash: context.financial.netCash,
          transactionCount: context.financial.transactionCount,
          periodStart: context.financial.periodStart,
          periodEnd: context.financial.periodEnd,
        },
        counts,
      };

    case 'staff_spend':
      // Staff expense questions — staff summary + associated risks
      return {
        intent,
        staffSpend: context.staffSpend,
        risks: context.risks
          .filter(r =>
            r.risk_type === 'staff_expense_missing_proof' ||
            r.risk_type === 'mixed_payment_method_spend'
          )
          .map(r => ({
            title: r.title,
            severity: r.severity,
            amount_at_risk: r.amount_at_risk,
            risk_type: r.risk_type,
          })),
        counts,
      };

    case 'billing':
      // Billing questions — only billing info needed
      return {
        intent,
        billing: context.billing,
        counts,
      };

    case 'reports':
      // Report questions — report status + readiness context
      return {
        intent,
        report: context.latestReport,
        risks: context.risks.map(r => ({
          title: r.title,
          severity: r.severity,
          amount_at_risk: r.amount_at_risk,
          risk_type: r.risk_type,
        })),
        invoices: context.invoices,
        financial: {
          income: context.financial.income,
          expenses: context.financial.expenses,
          refunds: context.financial.refunds,
          netCash: context.financial.netCash,
          transactionCount: context.financial.transactionCount,
          periodStart: context.financial.periodStart,
          periodEnd: context.financial.periodEnd,
        },
        counts,
      };

    case 'transactions':
      // Transaction review questions — financial summary + risk counts
      return {
        intent,
        financial: {
          income: context.financial.income,
          expenses: context.financial.expenses,
          refunds: context.financial.refunds,
          netCash: context.financial.netCash,
          transactionCount: context.financial.transactionCount,
          periodStart: context.financial.periodStart,
          periodEnd: context.financial.periodEnd,
        },
        risks: context.risks.map(r => ({
          title: r.title,
          severity: r.severity,
          amount_at_risk: r.amount_at_risk,
          risk_type: r.risk_type,
        })),
        counts,
      };

    case 'workspace_summary':
      // Full summary — everything needed for a comprehensive overview
      return {
        intent,
        financial: {
          income: context.financial.income,
          expenses: context.financial.expenses,
          refunds: context.financial.refunds,
          netCash: context.financial.netCash,
          transactionCount: context.financial.transactionCount,
          periodStart: context.financial.periodStart,
          periodEnd: context.financial.periodEnd,
        },
        risks: context.risks.map(r => ({
          title: r.title,
          severity: r.severity,
          amount_at_risk: r.amount_at_risk,
          risk_type: r.risk_type,
        })),
        vendors: {
          topVendors: context.vendors.topVendors.slice(0, 5),
          recurringVendors: context.vendors.recurringVendors.slice(0, 5),
          recurringCommitment: context.vendors.recurringCommitment,
          totalVendorCount: context.vendors.totalVendorCount,
        },
        staffSpend: context.staffSpend,
        invoices: context.invoices,
        report: context.latestReport,
        billing: context.billing,
        counts,
      };

    case 'general':
    default:
      // General/casual — minimal context, just counts for grounding
      return {
        intent,
        risks: context.risks
          .filter(r => r.severity === 'high')
          .slice(0, 3)
          .map(r => ({
            title: r.title,
            severity: r.severity,
            amount_at_risk: r.amount_at_risk,
            risk_type: r.risk_type,
          })),
        counts,
      };
  }
}
