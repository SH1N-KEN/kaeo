

export interface InvoiceRecord {
  id: string;
  organization_id: string;
  client_id: string | null;
  uploaded_by: string | null;
  file_name: string;
  file_path: string | null;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  currency: string;
  gstin: string | null;
  status: string;
  confidence: number | null;
  extracted_data: any;
  created_at: string;
}

export interface TransactionRecord {
  id: string;
  organization_id: string;
  client_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: string; // 'income', 'expense', 'refund', 'subscription', 'vendor_payment', 'unknown'
  category: string;
  counterparty_name?: string;
  reference_number?: string;
  source?: string;
}

export interface MatchSuggestion {
  invoice_id: string;
  transaction_id: string | null;
  match_status: 'suggested' | 'matched' | 'mismatch' | 'paid' | 'unpaid' | 'ignored';
  confidence: number;
  reason: string;
}

/**
 * Normalizes strings for vendor similarity checks.
 */
function cleanString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates string similarity using Jaccard index of 2-gram letter tokens.
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = cleanString(str1);
  const s2 = cleanString(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  const getGrams = (s: string) => {
    const grams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      grams.add(s.substring(i, i + 2));
    }
    return grams;
  };

  const g1 = getGrams(s1);
  const g2 = getGrams(s2);
  const intersection = new Set([...g1].filter(x => g2.has(x)));
  const union = new Set([...g1, ...g2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Matches invoices to transaction payments and generates matching recommendations.
 */
export function matchInvoicesToTransactions(
  invoices: InvoiceRecord[],
  transactions: TransactionRecord[]
): { matches: MatchSuggestion[]; risks: any[] } {
  const matches: MatchSuggestion[] = [];
  const risks: any[] = [];
  const today = new Date();

  // Keep track of matched transaction IDs to avoid double-assignment
  const matchedTxIds = new Set<string>();

  // Sort invoices by date descending
  const sortedInvoices = [...invoices].sort((a, b) => {
    const da = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
    const db = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
    return db - da;
  });

  // Filter out non-expense transactions (negative amounts mean outflow / payment)
  const payments = transactions.filter(t => t.amount < 0);

  // 1. Process matches per invoice
  for (const invoice of sortedInvoices) {
    if (invoice.status === 'ignored') {
      matches.push({
        invoice_id: invoice.id,
        transaction_id: null,
        match_status: 'ignored',
        confidence: 1.0,
        reason: 'Invoice was manually ignored.'
      });
      continue;
    }

    const invAmount = invoice.total_amount || 0;
    const invDateStr = invoice.invoice_date;
    const invVendor = invoice.vendor_name;
    const invNum = invoice.invoice_number;

    let bestTx: TransactionRecord | null = null;
    let maxScore = 0;
    let matchReason = '';

    for (const tx of payments) {
      if (matchedTxIds.has(tx.id)) continue;

      let score = 0;
      const reasons: string[] = [];

      // A. Check amount (exact matches or close values)
      const txAmount = Math.abs(tx.amount);
      const amtDiff = Math.abs(txAmount - invAmount);
      const isExactAmt = amtDiff < 0.05;
      
      if (isExactAmt) {
        score += 0.5;
        reasons.push('Exact amount match');
      } else if (amtDiff / invAmount < 0.05) {
        score += 0.3;
        reasons.push('Amount matches within 5% variance');
      }

      // B. Check vendor name similarity
      const vendorSim = calculateSimilarity(invVendor, tx.description) || 
                        (tx.counterparty_name ? calculateSimilarity(invVendor, tx.counterparty_name) : 0);
      if (vendorSim > 0.6) {
        score += 0.4 * vendorSim;
        reasons.push(`High vendor name match (${Math.round(vendorSim * 100)}%)`);
      }

      // C. Date correlation (invoices occur before or on payment date)
      if (invDateStr && tx.transaction_date) {
        const iDate = new Date(invDateStr);
        const pDate = new Date(tx.transaction_date);
        const daysDiff = (pDate.getTime() - iDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff >= -2 && daysDiff <= 45) {
          score += 0.2;
          reasons.push(`Valid date window (${Math.round(daysDiff)} days between invoice & payment)`);
        } else if (daysDiff < -2) {
          score -= 0.3; // Penalty if payment is way before invoice date
        }
      }

      // D. Reference code/invoice number matches
      if (invNum && cleanString(tx.description).includes(cleanString(invNum))) {
        score += 0.4;
        reasons.push('Invoice number found in payment reference description');
      }

      if (score > maxScore) {
        maxScore = score;
        bestTx = tx;
        matchReason = reasons.join(', ');
      }
    }

    // Set match status thresholds
    if (bestTx && maxScore >= 0.6) {
      const txAmount = Math.abs(bestTx.amount);
      const isMismatch = Math.abs(txAmount - invAmount) > 0.05;

      matches.push({
        invoice_id: invoice.id,
        transaction_id: bestTx.id,
        match_status: isMismatch ? 'mismatch' : 'matched',
        confidence: Math.min(1.0, maxScore),
        reason: matchReason
      });

      matchedTxIds.add(bestTx.id);

      // Add Mismatch Risk if amounts vary
      if (isMismatch) {
        risks.push({
          organization_id: invoice.organization_id,
          client_id: invoice.client_id,
          title: `Invoice Payment Mismatch: ${invoice.vendor_name}`,
          severity: 'medium',
          risk_type: 'invoice_payment_mismatch',
          amount_at_risk: Math.abs(txAmount - invAmount),
          description: `Invoice ${invoice.invoice_number} lists ₹${invAmount} but matching payment was processed for ₹${txAmount}.`,
          evidence_json: {
            invoice_id: invoice.id,
            invoice_amount: invAmount,
            transaction_id: bestTx.id,
            payment_amount: txAmount,
            reason: 'Amount variance detected between scan and payment ledger.'
          },
          suggested_action: 'Verify with the vendor or internal finance if a partial payment, discount, or tax adjustments occurred.',
          status: 'open',
          related_transaction_ids: [bestTx.id]
        });
      }
    } else {
      // Unmatched invoice
      matches.push({
        invoice_id: invoice.id,
        transaction_id: null,
        match_status: 'unpaid',
        confidence: 0.0,
        reason: 'No matching transaction payment found in ledger.'
      });

      // Check if invoice is overdue
      if (invoice.due_date) {
        const dDate = new Date(invoice.due_date);
        if (dDate < today && invoice.status !== 'paid') {
          risks.push({
            organization_id: invoice.organization_id,
            client_id: invoice.client_id,
            title: `Unpaid Overdue Invoice: ${invoice.vendor_name}`,
            severity: 'high',
            risk_type: 'unpaid_invoice',
            amount_at_risk: invAmount,
            description: `Invoice ${invoice.invoice_number} was due on ${invoice.due_date} but no matching payment has been recorded.`,
            evidence_json: {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              due_date: invoice.due_date,
              amount: invAmount
            },
            suggested_action: 'Pay the vendor invoice or mark it manually as paid if processed offline.',
            status: 'open',
            related_transaction_ids: []
          });
        }
      }
    }

    // Extraction Quality / Metadata checking risks
    if (invoice.confidence && invoice.confidence < 0.6) {
      risks.push({
        organization_id: invoice.organization_id,
        client_id: invoice.client_id,
        title: `Low Confidence OCR: Invoice #${invoice.invoice_number || 'Unknown'}`,
        severity: 'low',
        risk_type: 'low_confidence_invoice_extraction',
        amount_at_risk: invAmount,
        description: `OCR extraction engine flagged low confidence (${Math.round(invoice.confidence * 100)}%) parsing this document.`,
        evidence_json: {
          invoice_id: invoice.id,
          confidence: invoice.confidence,
          warnings: invoice.extracted_data?.warnings || []
        },
        suggested_action: 'Open details modal to manually verify and confirm extracted fields.',
        status: 'open',
        related_transaction_ids: []
      });
    }

    if (invoice.vendor_name === 'Unknown Vendor' || !invoice.vendor_name) {
      risks.push({
        organization_id: invoice.organization_id,
        client_id: invoice.client_id,
        title: `Invoice without Vendor Name: #${invoice.invoice_number}`,
        severity: 'low',
        risk_type: 'invoice_without_vendor',
        amount_at_risk: invAmount,
        description: `Invoice has no identifiable vendor name or counterparty.`,
        evidence_json: {
          invoice_id: invoice.id,
          file_name: invoice.file_name
        },
        suggested_action: 'Edit the invoice properties to assign a vendor.',
        status: 'open',
        related_transaction_ids: []
      });
    }
  }

  // 2. Check duplicate invoices (same vendor, invoice number, and client)
  const invoiceGroups: Record<string, InvoiceRecord[]> = {};
  for (const inv of invoices) {
    const key = `${cleanString(inv.vendor_name)}_${cleanString(inv.invoice_number)}`;
    if (inv.invoice_number && inv.vendor_name) {
      if (!invoiceGroups[key]) invoiceGroups[key] = [];
      invoiceGroups[key].push(inv);
    }
  }

  for (const group of Object.values(invoiceGroups)) {
    if (group.length > 1) {
      risks.push({
        organization_id: group[0].organization_id,
        client_id: group[0].client_id,
        title: `Duplicate Invoice Uploaded: ${group[0].vendor_name}`,
        severity: 'high',
        risk_type: 'duplicate_invoice',
        amount_at_risk: group[0].total_amount || 0,
        description: `Multiple files uploaded representing invoice number ${group[0].invoice_number} from ${group[0].vendor_name}.`,
        evidence_json: {
          invoice_ids: group.map(g => g.id),
          file_names: group.map(g => g.file_name),
          invoice_number: group[0].invoice_number
        },
        suggested_action: 'Delete or archive duplicate invoices to prevent double-payment risk.',
        status: 'open',
        related_transaction_ids: []
      });
    }
  }

  // 3. Missing Invoice Risk: Unmatched large expenses
  for (const tx of payments) {
    if (matchedTxIds.has(tx.id)) continue;

    const txAmount = Math.abs(tx.amount);
    // Flag unmatched expenses above 15,000 INR as missing invoice risk
    if (txAmount >= 15000) {
      risks.push({
        organization_id: tx.organization_id,
        client_id: tx.client_id,
        title: `Missing Invoice: ${tx.description.split(' ')[0]}`,
        severity: 'medium',
        risk_type: 'missing_data', // matches missing invoice risk category
        amount_at_risk: txAmount,
        description: `Outflow of ${txAmount} recorded on ${tx.transaction_date} has no matching vendor invoice.`,
        evidence_json: {
          transaction_id: tx.id,
          amount: txAmount,
          description: tx.description,
          date: tx.transaction_date
        },
        suggested_action: 'Locate and upload the supporting invoice or bill for this payment to maintain compliant ledger documentation.',
        status: 'open',
        related_transaction_ids: [tx.id]
      });
    }
  }

  return { matches, risks };
}
