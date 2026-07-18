/**
 * Libby v2 — Data Retriever
 *
 * Slices the full WorkspaceContext down to only the data relevant
 * for answering the detected intent.
 *
 * Pure function — no Supabase calls, no side effects.
 * Keeps AI context payloads lean and focused.
 */

import { normalizeVendorName, inferCategory } from '../vendorEngine';
import type { LibbyIntent, WorkspaceContext, RelevantData, AggregatedVendor } from './types';

// ─── Vendor Aggregation ───────────────────────────────────────────────────────

/**
 * Aggregates raw transactions by normalized vendor identity.
 *
 * Algorithm:
 *   1. Skip non-expense transaction types (income, refund, unknown).
 *   2. For each expense transaction:
 *      a. Normalize the description to get a canonical vendor key.
 *      b. If the transaction has a vendor_id, look up the DB vendor record for
 *         a higher-quality name and category.
 *      c. Group under the canonical key, summing amounts and tracking counts.
 *   3. Sort resulting vendors by totalSpend descending.
 *
 * Vendor names are normalized using the shared `normalizeVendorName` utility
 * to ensure consistent grouping (e.g. "Salary Batch June" and
 * "Salary Batch July" collapse to the same "Salary Batch" vendor).
 *
 * Does NOT modify rawTransactions or rawVendors.
 *
 * @param rawTransactions - Full array of transaction objects from the DB
 * @param rawVendors      - Full array of vendor objects from the DB
 * @returns Sorted array of AggregatedVendor, highest spend first
 */
export function aggregateVendorsByTransaction(
  rawTransactions: any[],
  rawVendors: any[]
): AggregatedVendor[] {
  // Keyed by normalized vendor name
  const vendorMap = new Map<string, AggregatedVendor>();

  for (const tx of rawTransactions) {
    // Only aggregate expense-type transactions
    if (!['expense', 'vendor_payment', 'subscription'].includes(tx.type)) {
      continue;
    }

    // Resolve transaction amount (prefer base currency)
    const amtRaw = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
      ? Number(tx.amount_in_base_currency)
      : Number(tx.amount);
    const amt = Math.abs(amtRaw || 0);
    if (amt === 0) continue;

    // ── Step 1: Determine canonical vendor identity ──────────────────────────
    const { normalized: normFromDesc, display: displayFromDesc } = normalizeVendorName(
      tx.description || ''
    );

    // ── Step 2: Try to resolve a better name from the vendors table ──────────
    let canonicalKey = normFromDesc;  // used as the Map key (lowercase)
    let displayName = displayFromDesc;
    let category = inferCategory(normFromDesc);
    let isRecurring = false;

    // Prefer vendor_id match first (most reliable), then normalized name match
    const dbVendor = rawVendors.find(v =>
      (tx.vendor_id && v.id === tx.vendor_id) ||
      v.normalized_name === normFromDesc ||
      (v.normalized_name && normFromDesc.startsWith(v.normalized_name))
    );

    if (dbVendor) {
      // Use the DB vendor's normalized_name as the canonical key for consistent
      // grouping — this avoids splitting "Salary Batch" into "salary batch june"
      // and "salary batch july" when the DB already has a single vendor record.
      canonicalKey = dbVendor.normalized_name || normFromDesc;
      displayName = dbVendor.name || dbVendor.display_name || displayFromDesc;
      category = dbVendor.category || category;
      isRecurring = !!(dbVendor.is_recurring || dbVendor.recurrence_pattern === 'monthly');
    }

    // Guard against empty key
    if (!canonicalKey || canonicalKey.length < 1) continue;

    // ── Step 3: Accumulate into the vendor map ───────────────────────────────
    const txDate = tx.transaction_date || null;

    if (!vendorMap.has(canonicalKey)) {
      vendorMap.set(canonicalKey, {
        normalized_name: canonicalKey,
        display_name: displayName,
        category,
        totalSpend: 0,
        transactionCount: 0,
        firstSeen: txDate,
        lastSeen: txDate,
        isRecurring,
      });
    }

    const entry = vendorMap.get(canonicalKey)!;
    entry.totalSpend += amt;
    entry.transactionCount += 1;
    entry.isRecurring = entry.isRecurring || isRecurring;

    // Track date range
    if (txDate) {
      if (!entry.firstSeen || txDate < entry.firstSeen) entry.firstSeen = txDate;
      if (!entry.lastSeen  || txDate > entry.lastSeen)  entry.lastSeen  = txDate;
    }
  }

  // ── Step 4: Sort by total spend descending ─────────────────────────────────
  return Array.from(vendorMap.values())
    .filter(v => v.totalSpend > 0)
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

// ─── Main Retriever ───────────────────────────────────────────────────────────

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

    case 'vendors': {
      // Vendor questions — always produce a fresh transaction-level aggregation
      // so that vendors with multiple transactions are correctly summed.
      const aggregatedVendors = aggregateVendorsByTransaction(
        context.rawTransactions,
        context.rawVendors
      );
      return {
        intent,
        vendors: {
          topVendors: context.vendors.topVendors,
          recurringVendors: context.vendors.recurringVendors,
          recurringCommitment: context.vendors.recurringCommitment,
          totalVendorCount: context.vendors.totalVendorCount,
        },
        aggregatedVendors,
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
    }

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

    case 'workspace_summary': {
      // Full summary — everything needed for a comprehensive overview.
      // Include aggregated vendors so the AI sees the correct rollups.
      const aggregatedVendors = aggregateVendorsByTransaction(
        context.rawTransactions,
        context.rawVendors
      );
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
        aggregatedVendors: aggregatedVendors.slice(0, 10),
        staffSpend: context.staffSpend,
        invoices: context.invoices,
        report: context.latestReport,
        billing: context.billing,
        counts,
      };
    }

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
