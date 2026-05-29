import { supabase } from './supabase';
import { formatINR, formatCurrency, formatSignedCurrency } from './formatters';
import { summarizeVendors } from './reportEngine';
import { askKaeoAi } from './ai/aiClient';
import type { AIStructuredContext } from './ai/aiClient';
import { syncReviewSuggestions } from './aiReviewEngine';
import { calculateMonthEndReadiness } from './readinessEngine';
import { getCleanTransactions } from './transactionFilters';

export type AskKaeoCategory = 
  | 'finance_summary' 
  | 'vendor_analysis' 
  | 'risk_review' 
  | 'recurring_spend' 
  | 'cost_optimization' 
  | 'service_alternatives' 
  | 'business_advice' 
  | 'operational_next_steps' 
  | 'casual_check_in'
  | 'tax_or_legal_sensitive'
  | 'unknown_general'
  | 'unsupported_needs_ai_or_web'
  | 'ai_review';

interface AskKaeoResponse {
  intent: AskKaeoCategory;
  text: string;
  source_json: any;
}

const formatReportCurrency = (val: number, _currency: string = 'INR') => {
  return formatINR(val);
};

export type ResponseMode =
  | 'metric_answer'
  | 'priority_advice'
  | 'explanation'
  | 'report_summary'
  | 'vendor_review'
  | 'risk_review'
  | 'invoice_review'
  | 'casual_followup';

export function determineResponseMode(intent: AskKaeoCategory, query: string): ResponseMode {
  const q = query.toLowerCase();
  
  if (intent === 'casual_check_in') {
    return 'casual_followup';
  }
  
  if (
    q.includes('what should i do') || 
    q.includes('what do i fix') || 
    q.includes('where do i start') || 
    q.includes('what to do') || 
    q.includes('what now') ||
    q.includes('priority') ||
    q.includes('worry') ||
    q.includes('are we cooked') ||
    q.includes('is this ok') ||
    intent === 'operational_next_steps'
  ) {
    return 'priority_advice';
  }
  
  if (
    q.includes('how much') || 
    q.includes('how many') || 
    q.includes('what is the total') || 
    q.includes('total') || 
    q.includes('show me the numbers') ||
    q.includes('net cash') ||
    q.includes('revenue') ||
    q.includes('expense')
  ) {
    return 'metric_answer';
  }
  
  if (intent === 'finance_summary') {
    return 'report_summary';
  }
  
  if (intent === 'vendor_analysis' || intent === 'recurring_spend' || q.includes('vendor')) {
    return 'vendor_review';
  }
  
  if (intent === 'risk_review' || q.includes('risk') || q.includes('duplicate')) {
    return 'risk_review';
  }
  
  if (q.includes('invoice') || q.includes('bill')) {
    return 'invoice_review';
  }
  
  return 'explanation';
}

export async function categorizeQuestion(query: string): Promise<AskKaeoCategory> {
  const q = query.toLowerCase().trim();
  
  if (
    q.includes('review my transactions') ||
    q.includes('review transactions') ||
    q.includes('what should i review') ||
    q.includes('categorize the uncategorized') ||
    q.includes('categorize uncategorized') ||
    q.includes('prepare my month-end') ||
    q.includes('prepare month-end') ||
    q.includes('which risks can be resolved') ||
    q.includes('risks can be resolved') ||
    q.includes('safe to mark reviewed') ||
    q.includes('mark reviewed')
  ) {
    return 'ai_review';
  }
  
  // 0. Strict external live web needs
  if (
    q.includes('market price') || q.includes('exchange rate') || q.includes('latest news') || 
    q.includes('competitor') || q.includes('real time') || q.includes('real-time') || 
    q.includes('product feature updates') || q.includes('product rankings')
  ) {
    return 'unsupported_needs_ai_or_web';
  }

  // 0.5 Tax or Legal
  if (q.includes('tax') || q.includes('legal') || q.includes('law') || q.includes('evasion')) {
    return 'tax_or_legal_sensitive';
  }

  // 1. Casual check-in mappings
  if (
    q === 'yo' || q === 'yoo' || q === 'wsg' || q === 'bro' || q === 'hmm' || 
    q === 'idk' || q === 'help' || q === 'lol' || q === 'hey' || q === 'okay' || q === 'damn' ||
    q === 'bruh' || q === 'man' || q === 'fam' || q === 'gosh'
  ) {
    return 'casual_check_in';
  }

  // 2. Exact strategic overrides for business advice
  if (
    q.includes('worry') || q.includes('what worries you') || q.includes('what do you think') || 
    q.includes('is this bad') || q.includes('how bad are our numbers') || q.includes('are our numbers bad') || 
    q.includes('is this good or bad') || q.includes('is the business healthy') || 
    q.includes('give me a read') || q.includes('how bad is this') || q.includes('should i worry') || 
    q.includes('give me the truth') || q.includes('honest') || q.includes('how are we doing') || 
    q.includes('what’s the situation') || q.includes('how do things look') || q.includes('are we cooked') || 
    q.includes('are we okay') || q.includes('advice') || q.includes('should i') || q.includes('worth it') || 
    q.includes('negotiate')
  ) {
    return 'business_advice';
  }

  // 3. Operational next steps
  if (
    q.includes('what should i do') || q.includes('what’s the move') || q.includes('whats the move') || 
    q.includes('what should i review first') || q.includes('review first') || 
    q.includes('priority') || q.includes('next steps') || q.includes('what now')
  ) {
    return 'operational_next_steps';
  }
  
  if (q.includes('alternative') || q.includes('replace') || q.includes('better than') || q.includes('cheaper than')) {
    return 'service_alternatives';
  }
  
  if (q.includes('risk') || q.includes('duplicate') || q.includes('unusual') || q.includes('invoice') || q.includes('mismatch') ||
      q.includes('staff') || q.includes('petty') || q.includes('proof') || q.includes('receipt') ||
      q.includes('payment method') || q.includes('reimburs') || q.includes('missing proof') ||
      q.includes('staff expense') || q.includes('cash expense') || q.includes('mixed payment')) {
    return 'risk_review';
  }
  
  if (q.includes('recurring') || q.includes('subscription') || q.includes('saas') || q.includes('monthly spend')) {
    return 'recurring_spend';
  }
  
  if (q.includes('overspending') || q.includes('reduce') || q.includes('cost') || q.includes('cut')) {
    return 'cost_optimization';
  }
  
  if (q.includes('vendor') || q.includes('spend on') || q.includes('how much do we pay') || q.includes('top expense')) {
    return 'vendor_analysis';
  }
  
  if (q.includes('cash') || q.includes('revenue') || q.includes('income') || q.includes('profit') || q.includes('summary')) {
    return 'finance_summary';
  }
  
  return 'unknown_general';
}

const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

export const findMatchingVendor = (q: string, vendorList: any[]) => {
  const queryLower = q.toLowerCase();
  
  // Ignore matching generic words as vendors unless query is exactly that vendor
  const genericWords = ['plan', 'report', 'dashboard', 'vendor', 'billing', 'cfo', 'summary'];
  
  return vendorList.find(v => {
    const vName = v.normalized_name.toLowerCase();
    
    // If the vendor name itself is a generic word, only match if it is an exact word match or specific query context
    if (genericWords.includes(vName)) {
      // Look for exact word boundary match
      const regex = new RegExp(`\\b${vName}\\b`, 'i');
      // And make sure the query isn't just one of the general phrases like "my plan" or "the report"
      if (vName === 'plan' && (queryLower.includes('my plan') || queryLower.includes('billing plan'))) {
        return false;
      }
      return regex.test(queryLower);
    }
    
    // For non-generic names, check word boundary to prevent partial matches like "plan" in "planet"
    const regex = new RegExp(`\\b${vName}\\b`, 'i');
    return regex.test(queryLower);
  });
};

export function getCoreFinancialAnswer(query: string, context: any): { intent: AskKaeoCategory; text: string; sourceJson: any } | null {
  const q = query.toLowerCase().trim().replace(/[?.]/g, '');

  // 1. Net Cash
  if (q === 'what is my net cash' || q === 'net cash' || q === 'my net cash' || q.includes('net cash movement')) {
    const text = `Your net cash movement is ${formatSignedCurrency(context.netCash)}. This is calculated as ${formatCurrency(context.income)} in revenue/inflows${context.refunds > 0 ? ` and ${formatCurrency(context.refunds)} in refunds` : ''}, minus ${formatCurrency(context.expenses)} in outflows and vendor expenses.`;
    return {
      intent: 'finance_summary',
      text,
      sourceJson: { income: context.income, expenses: context.expenses, refunds: context.refunds, netCash: context.netCash }
    };
  }

  // 2. Money Came In (Inflow)
  if (q === 'how much money came in' || q === 'money came in' || q === 'revenue' || q === 'income' || q.includes('how much money came in')) {
    const text = `Your imported statements show a total of ${formatCurrency(context.income)} came in${context.refunds > 0 ? ` (plus ${formatCurrency(context.refunds)} in refunds and recoveries)` : ''} during this period.`;
    return {
      intent: 'finance_summary',
      text,
      sourceJson: { income: context.income, refunds: context.refunds }
    };
  }

  // 3. Money Went Out (Outflow)
  if (q === 'how much money went out' || q === 'money went out' || q === 'expenses' || q.includes('how much money went out')) {
    const text = `Your imported statements show a total of ${formatCurrency(context.expenses)} went out in expenses, subscription fees, and vendor payments during this period.`;
    return {
      intent: 'finance_summary',
      text,
      sourceJson: { expenses: context.expenses }
    };
  }

  // 4. Top Expenses / Vendors spent most on
  if (
    q === 'what are my top expenses' || 
    q === 'what vendors did i spend most on' || 
    q.includes('top expenses') || 
    q.includes('vendors did i spend most on') ||
    q.includes('spend most on')
  ) {
    const topVendorsList = context.vendorSummary.topVendors.slice(0, 5);
    let text = '';
    if (topVendorsList.length > 0) {
      text = `Your top expenses by vendor are:\n` +
        topVendorsList.map((v: any, index: number) => `${index + 1}. ${v.normalized_name}: ${formatCurrency(v.totalSpend)} (${v.category || 'Vendor'})`).join('\n');
      
      // Also add category breakdown if available
      const categorySpends: Record<string, number> = {};
      context.transactions.forEach((t: any) => {
        if (['expense', 'vendor_payment', 'subscription'].includes(t.type)) {
          const cat = t.category || 'Uncategorized';
          const getTxAmount = (tx: any) => tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined ? Number(tx.amount_in_base_currency) : Number(tx.amount);
          categorySpends[cat] = (categorySpends[cat] || 0) + Math.abs(getTxAmount(t));
        }
      });
      const topCategories = Object.entries(categorySpends)
        .map(([name, spend]) => ({ name, spend }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 3);
      
      if (topCategories.length > 0) {
        text += `\n\nTop categories by spend:\n` +
          topCategories.map((c: any, index: number) => `${index + 1}. ${c.name}: ${formatCurrency(c.spend)}`).join('\n');
      }
    } else {
      text = `No vendor spend has been recorded in the current data period.`;
    }
    return {
      intent: 'vendor_analysis',
      text,
      sourceJson: { topVendors: topVendorsList }
    };
  }

  // 5. Risks / Needs review before exporting
  if (
    q === 'what risks need review' || 
    q === 'what needs review before exporting' || 
    q.includes('risks need review') || 
    q.includes('needs review before exporting') ||
    q.includes('what risks should i review')
  ) {
    const openRisks = context.risks;
    let text = '';
    if (openRisks.length > 0) {
      text = `You have ${openRisks.length} open risk${openRisks.length === 1 ? '' : 's'} that need review before exporting:\n\n` +
        openRisks.map((r: any) => {
          const amtStr = r.amount_at_risk ? ` (${formatCurrency(r.amount_at_risk)} at risk)` : '';
          return `• [${r.severity.toUpperCase()}] ${r.title}${amtStr}`;
        }).join('\n') + `\n\nI recommend resolving these in the Risk Inbox before exporting.`;
    } else {
      text = `No open risks were found. Your books are ready for export.`;
    }
    return {
      intent: 'risk_review',
      text,
      sourceJson: { risks: openRisks.length }
    };
  }

  // 6. Staff proof / missing proof
  if (
    q === 'which staff/petty expenses need proof' || 
    q === 'which transactions are missing proof' || 
    q.includes('staff/petty expenses need proof') ||
    q.includes('transactions are missing proof') ||
    q.includes('missing proof')
  ) {
    let text = '';
    if (context.staff_spend_summary.has_staff_expenses) {
      const missingCount = context.staffMissingProof.length;
      text = `There are ${missingCount} staff/petty expenses missing proof (receipts or invoices) out of ${context.staff_spend_summary.count} total staff transactions.\n\n` +
        (missingCount > 0 
          ? `Summary of missing proof items:\n` + context.staffMissingProof.slice(0, 5).map((tx: any) => {
              const getTxAmount = (t: any) => t.amount_in_base_currency !== null && t.amount_in_base_currency !== undefined ? Number(t.amount_in_base_currency) : Number(t.amount);
              return `• ${tx.description || 'Staff Spend'}: ${formatCurrency(Math.abs(getTxAmount(tx)))} on ${tx.transaction_date || 'unknown date'}`;
            }).join('\n')
          : `All staff expenses have supporting proof.`);
    } else {
      text = `No staff or petty expense transactions with missing proof were found in the current workspace.`;
    }
    return {
      intent: 'risk_review',
      text,
      sourceJson: { staffMissingProof: context.staffMissingProof.length }
    };
  }

  // 7. Unknown payment method
  if (
    q === 'which transactions have unknown payment method' || 
    q.includes('unknown payment method')
  ) {
    let text = '';
    if (context.staff_spend_summary.has_staff_expenses) {
      const unknownCount = context.staffUnknownMethod.length;
      text = `There are ${unknownCount} transactions with an unknown payment method.\n\n` +
        (unknownCount > 0 
          ? `Summary of unknown payment method items:\n` + context.staffUnknownMethod.slice(0, 5).map((tx: any) => {
              const getTxAmount = (t: any) => t.amount_in_base_currency !== null && t.amount_in_base_currency !== undefined ? Number(t.amount_in_base_currency) : Number(t.amount);
              return `• ${tx.description || 'Transaction'}: ${formatCurrency(Math.abs(getTxAmount(tx)))}`;
            }).join('\n')
          : `All transactions have a known payment method.`);
    } else {
      text = `No transactions with unknown payment methods were found in the current workspace.`;
    }
    return {
      intent: 'risk_review',
      text,
      sourceJson: { unknownPaymentMethods: context.staffUnknownMethod.length }
    };
  }

  // 8. Plan / Billing queries
  if (q === 'tell me about my plan' || q === 'what is my plan' || q.includes('about my plan') || q.includes('what is my plan')) {
    let text = '';
    if (context.billingDataExists) {
      text = `You are currently on the ${context.currentPlanName} plan (${context.billingCycle} billing, status: ${context.subscriptionStatus}). You can manage your plans and limits in the Billing settings.`;
    } else {
      text = `I couldn't find details about your product plan. Could you clarify if you mean your active billing plan or something else?`;
    }
    return {
      intent: 'unknown_general',
      text,
      sourceJson: { planName: context.currentPlanName, billingCycle: context.billingCycle }
    };
  }

  return null;
}

function sanitizeTextNumbers(text: string, context: {
  income: number;
  expenses: number;
  netCash: number;
  refunds: number;
  transactionCount: number;
  openRisksCount: number;
  duplicateExposure: number;
  uncategorizedCount: number;
  readinessScore: number;
  unreviewedCount: number;
  totalVendorsCount: number;
  totalInvoicesCount: number;
  approvedNumbers: Set<number>;
  vendorsList: any[];
  invoicesList: any[];
  vendorSummary: any;
}): { sanitizedText: string; repairedCount: number; hasUnrepairable: boolean } {
  let repairedCount = 0;

  // Pattern captures optional negative sign before/after optional currency symbols, supporting unicode minus −
  const numRegex = /([-−])?\s*([₹$]|Rs\.?|INR)?\s*([-−])?\s*(\d[\d,.]*)\b/gi;

  let lastIndex = 0;
  let resultText = "";

  let match;
  while ((match = numRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const negBefore = match[1];
    const currencyPrefix = match[2];
    const negAfter = match[3];
    const numberStr = match[4];

    resultText += text.slice(lastIndex, match.index);
    lastIndex = numRegex.lastIndex;

    const isNegative = !!(negBefore || negAfter);
    const cleanDigits = numberStr.replace(/[^\d]/g, '');
    let val = parseInt(cleanDigits, 10);

    if (isNaN(val)) {
      resultText += fullMatch;
      continue;
    }

    if (isNegative) {
      val = -val;
    }

    const isYear = Math.abs(val) >= 2020 && Math.abs(val) <= 2030;
    const isSmall = Math.abs(val) < 10;
    const isPercentage = text.substring(match.index + fullMatch.length).trim().startsWith('%');
    
    // Check if part of date (preceded or followed by hyphen and a digit, e.g. 2026-05-29)
    const prevChar = match.index > 0 ? text[match.index - 1] : '';
    const nextChar = match.index + fullMatch.length < text.length ? text[match.index + fullMatch.length] : '';
    const isDateHyphen = (prevChar === '-' && /\d/.test(text[match.index - 2] || '')) || 
                         (nextChar === '-' && /\d/.test(text[match.index + fullMatch.length + 1] || ''));
    
    if (isYear || isSmall || isPercentage || isDateHyphen) {
      resultText += fullMatch;
      continue;
    }

    const startWindow = Math.max(0, match.index - 50);
    const endWindow = Math.min(text.length, match.index + fullMatch.length + 50);
    const contextSnippet = text.slice(startWindow, endWindow).toLowerCase();

    let expectedVal: number | null = null;
    let keywordMatched = false;
    let replacementStr = "";

    if (contextSnippet.includes("net cash") || contextSnippet.includes("net flow") || contextSnippet.includes("net movement") || contextSnippet.includes("profit")) {
      keywordMatched = true;
      expectedVal = context.netCash;
      replacementStr = formatINR(context.netCash);
    } else if (contextSnippet.includes("revenue") || contextSnippet.includes("income") || contextSnippet.includes("sales") || contextSnippet.includes("inflow")) {
      keywordMatched = true;
      expectedVal = context.income;
      replacementStr = formatINR(context.income);
    } else if (contextSnippet.includes("expense") || contextSnippet.includes("spend") || contextSnippet.includes("outflow")) {
      keywordMatched = true;
      const matchedV = findMatchingVendor(contextSnippet, context.vendorsList);
      if (matchedV) {
        const spend = context.vendorSummary.topVendors.find((tv: any) => tv.normalized_name === matchedV.normalized_name)?.totalSpend || matchedV.total_spend || matchedV.spend || 0;
        expectedVal = spend;
        replacementStr = formatINR(spend);
      } else {
        expectedVal = context.expenses;
        replacementStr = formatINR(context.expenses);
      }
    } else if (contextSnippet.includes("refund") || contextSnippet.includes("recovery") || contextSnippet.includes("recoveries")) {
      keywordMatched = true;
      expectedVal = context.refunds;
      replacementStr = formatINR(context.refunds);
    } else if (contextSnippet.includes("transaction") || contextSnippet.includes("ledger") || contextSnippet.includes("row") || contextSnippet.includes("entry") || contextSnippet.includes("entries")) {
      keywordMatched = true;
      expectedVal = context.transactionCount;
      replacementStr = String(context.transactionCount);
    } else if (contextSnippet.includes("risk") || contextSnippet.includes("exposure") || contextSnippet.includes("threat")) {
      keywordMatched = true;
      if (currencyPrefix || Math.abs(val) > 500) {
        expectedVal = context.duplicateExposure;
        replacementStr = formatINR(context.duplicateExposure);
      } else {
        expectedVal = context.openRisksCount;
        replacementStr = String(context.openRisksCount);
      }
    } else if (contextSnippet.includes("uncategorized") || contextSnippet.includes("unclassified") || contextSnippet.includes("unmapped")) {
      keywordMatched = true;
      expectedVal = context.uncategorizedCount;
      replacementStr = String(context.uncategorizedCount);
    } else if (contextSnippet.includes("review") || contextSnippet.includes("pending") || contextSnippet.includes("validate")) {
      keywordMatched = true;
      expectedVal = context.unreviewedCount;
      replacementStr = String(context.unreviewedCount);
    } else if (contextSnippet.includes("readiness") || contextSnippet.includes("score")) {
      keywordMatched = true;
      expectedVal = context.readinessScore;
      replacementStr = String(context.readinessScore);
    }

    if (keywordMatched && expectedVal !== null) {
      const isCorrect = Math.abs(expectedVal - val) / Math.max(1, Math.abs(expectedVal)) < 0.02;
      if (isCorrect) {
        const isFin = currencyPrefix || 
                      expectedVal === context.netCash || 
                      expectedVal === context.income || 
                      expectedVal === context.expenses || 
                      expectedVal === context.refunds || 
                      expectedVal === context.duplicateExposure;
        if (isFin) {
          resultText += formatINR(expectedVal);
        } else {
          resultText += String(expectedVal);
        }
      } else {
        repairedCount++;
        resultText += (currencyPrefix && !replacementStr.startsWith('₹') && !replacementStr.startsWith('$') ? '₹' : '') + replacementStr;
        if (isDev) {
          console.debug(`[Libby Sanitizer] Repaired conflicting number '${fullMatch}' with expected metric value '${replacementStr}'`);
        }
      }
    } else {
      let isApproved = context.approvedNumbers.has(Math.abs(val));
      if (!isApproved) {
        for (const approvedVal of context.approvedNumbers) {
          if (Math.abs(approvedVal - Math.abs(val)) / Math.max(1, approvedVal) < 0.02) {
            isApproved = true;
            break;
          }
        }
      }

      if (isApproved) {
        const isFin = currencyPrefix || 
                      Math.abs(val) === Math.round(Math.abs(context.netCash)) || 
                      Math.abs(val) === Math.round(context.income) || 
                      Math.abs(val) === Math.round(context.expenses) || 
                      Math.abs(val) === Math.round(context.refunds) || 
                      Math.abs(val) === Math.round(context.duplicateExposure);
        if (isFin) {
          resultText += formatINR(val);
        } else {
          resultText += String(val);
        }
      } else {
        repairedCount++;
        const qualitativeStr = currencyPrefix ? "the recorded amount" : "multiple";
        resultText += qualitativeStr;
        if (isDev) {
          console.debug(`[Libby Sanitizer] Replaced unverified number '${fullMatch}' with qualitative '${qualitativeStr}'`);
        }
      }
    }
  }

  resultText += text.slice(lastIndex);
  return { sanitizedText: resultText, repairedCount, hasUnrepairable: false };
}

export async function askKaeo(query: string, clientId: string, _orgId: string): Promise<AskKaeoResponse> {
  let isSanitized = false;
  let sanitizedAnswer = '';
  let sanitizedReasoning = '';

  // 1. Get current user and profile onboarding status
  const { data: { user } } = await supabase.auth.getUser();
  let profile = null;
  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    profile = prof;
  }

  if (profile && !profile.onboarding_completed) {
    return {
      intent: 'unknown_general',
      text: "I can answer your questions much better after you complete the initial onboarding setup. Please set up your business profile or client list first.",
      source_json: { mode: 'onboarding_incomplete' }
    };
  }

  const intent = await categorizeQuestion(query);

  // Fetch contextual data
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('client_id', clientId)
    .order('transaction_date', { ascending: false });

  const { data: vendorsData } = await supabase
    .from('vendors')
    .select('*')
    .eq('client_id', clientId);

  const { data: risksData } = await supabase
    .from('risk_events')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'open');

  const { data: invoicesData } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId);
    
  const transactions = getCleanTransactions(txs || []);
  const vendors = vendorsData || [];
  const risks = risksData || [];
  const invoices = invoicesData || [];

  const duplicateExposure = risks.reduce((sum, r) => {
    if (r.risk_type && r.risk_type.includes('duplicate')) {
      return sum + (Number(r.amount_at_risk) || 0);
    }
    return sum;
  }, 0);

  const total_invoices_count = invoices.length;
  const unmatchedInvoices = invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'uploaded' || inv.status === 'extracted' || inv.status === 'needs_review');
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue' || (inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date()));
  const mismatchInvoices = invoices.filter(inv => inv.status === 'mismatch');

  const invGroups: Record<string, number> = {};
  invoices.forEach(inv => {
    if (inv.invoice_number && inv.vendor_name) {
      const k = `${inv.vendor_name.toLowerCase()}_${inv.invoice_number.toLowerCase()}`;
      invGroups[k] = (invGroups[k] || 0) + 1;
    }
  });
  const duplicate_invoices_count = Object.values(invGroups).filter(count => count > 1).length;

  const vendorInvoiceSums: Record<string, number> = {};
  invoices.forEach(inv => {
    const v = inv.vendor_name || 'Unknown Vendor';
    vendorInvoiceSums[v] = (vendorInvoiceSums[v] || 0) + (inv.total_amount || 0);
  });
  const top_invoiced_vendors = Object.entries(vendorInvoiceSums)
    .map(([name, spend]) => ({ name, spend }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  const invoice_summary = {
    total_invoices_count,
    unmatched_invoices_count: unmatchedInvoices.length,
    overdue_invoices_count: overdueInvoices.length,
    mismatch_invoices_count: mismatchInvoices.length,
    duplicate_invoices_count,
    top_invoiced_vendors
  };
  
  const getTxAmount = (t: any) => t.amount_in_base_currency !== null && t.amount_in_base_currency !== undefined ? Number(t.amount_in_base_currency) : Number(t.amount);
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Math.abs(getTxAmount(t) || 0), 0);
  const refunds = transactions.filter(t => t.type === 'refund').reduce((sum, t) => sum + Math.abs(getTxAmount(t) || 0), 0);
  const expenses = transactions.filter(t => ['expense', 'vendor_payment', 'subscription'].includes(t.type)).reduce((sum, t) => sum + Math.abs(getTxAmount(t) || 0), 0);
  const netCash = income + refunds - expenses;

  const vendorSummary = summarizeVendors(vendors, transactions);

  // FETCH ADDITIONAL SECURE SERVER CONTEXT FOR AI
  const { data: clientData } = await supabase
    .from('clients')
    .select('name, industry, base_currency, metadata')
    .eq('id', clientId)
    .single();
  const baseCurrency = 'INR';
  const activeClientName = clientData?.name || 'Active Client';

  const { data: latestReport } = await supabase
    .from('reports')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1);
  const latestReportSummary = latestReport && latestReport.length > 0
    ? (latestReport[0].summary_json?.executive_summary || JSON.stringify(latestReport[0].summary_json))
    : null;

  const { data: notesData } = await supabase
    .from('notes')
    .select('note')
    .eq('client_id', clientId);
  const relevantNotes = (notesData || []).map(n => n.note).filter(Boolean);

  const txCount = transactions.length;
  const transaction_count = txCount;
  const period_start = transactions.length > 0 ? transactions[transactions.length - 1].transaction_date : null;
  const period_end = transactions.length > 0 ? transactions[0].transaction_date : null;

  // Extract all existing vendor monthly averages, spends, transaction amounts, risk amounts, and invoice amounts to prevent false positives
  const approved_extra_numbers = [
    ...vendors.map(v => Math.round(Number(v.monthly_average || 0))),
    ...vendors.map(v => Math.round(Number(v.total_spend || v.spend || 0))),
    ...transactions.map(t => Math.round(Math.abs(Number(t.amount || 0)))),
    ...risks.map(r => Math.round(Number(r.amount_at_risk || 0))),
    ...invoices.map(i => Math.round(Number(i.total_amount || 0))),
    total_invoices_count,
    unmatchedInvoices.length,
    overdueInvoices.length,
    mismatchInvoices.length,
    duplicate_invoices_count
  ].filter(n => n > 0);

  const approvedNumbers = new Set<number>([
    Math.round(income),
    Math.round(refunds),
    Math.round(expenses),
    Math.round(netCash),
    Math.round(vendorSummary.recurringCommitment),
    vendorSummary.recurringVendors.length,
    risks.filter(r => r.severity === 'high').length,
    transactions.length,
    vendors.length,
    risks.length
  ]);
  vendorSummary.topVendors.forEach(v => approvedNumbers.add(Math.round(v.totalSpend)));
  approved_extra_numbers.forEach(n => approvedNumbers.add(Math.round(n)));
  const numbersInQuery = query.replace(/\b20\d{2}\b/g, '').match(/\d[\d,.]*/g) || [];
  numbersInQuery.forEach(numStr => {
    const cleanDigits = numStr.replace(/[^\d]/g, '');
    if (cleanDigits.length >= 3) {
      approvedNumbers.add(parseInt(cleanDigits, 10));
    }
  });

  // Extract matching vendor details
  const matchingVendor = findMatchingVendor(query, vendors);
  const matching_vendor = matchingVendor ? {
    name: matchingVendor.normalized_name,
    display_name: matchingVendor.display_name || matchingVendor.name,
    total_spend: vendorSummary.topVendors.find(tv => tv.normalized_name === matchingVendor.normalized_name)?.totalSpend || 0,
    monthly_average: matchingVendor.monthly_average || 0,
    category: matchingVendor.category || 'SaaS'
  } : null;

  const qStr = query.toLowerCase();
  const needsWebResearchKeywords = ['alternative', 'replace', 'cheaper', 'compare', 'instead', 'market', 'price', 'pricing', 'competitor'];
  const isWebEligibleIntent = ['service_alternatives', 'cost_optimization', 'business_advice', 'vendor_analysis'].includes(intent);
  const needs_web_research = isWebEligibleIntent || needsWebResearchKeywords.some(kw => qStr.includes(kw));

  // Assemble business profile grounding metadata
  const clientMetadata = clientData?.metadata || {};
  const business_profile = {
    account_mode: (profile?.account_mode || null) as 'business_owner' | 'accountant' | null,
    onboarding_completed: !!profile?.onboarding_completed,
    business_name: clientData?.name || '',
    industry: clientData?.industry || clientMetadata?.industry || '',
    monthly_spend_range: clientMetadata?.monthly_spend_range || '',
    team_size: clientMetadata?.team_size || '',
    accounting_tools: clientMetadata?.accounting_tools || [],
    pain_points: clientMetadata?.pain_points || [],
    notes: clientMetadata?.notes || ''
  };

  const responseMode = determineResponseMode(intent, query);

  // BUILD STAFF SPEND SUMMARY for context injection
  const resolveStaffField = (tx: any, field: string) =>
    tx[field] !== undefined && tx[field] !== null
      ? tx[field]
      : tx.raw_row_json?.[field] ?? tx.raw_row_json?.metadata?.[field];

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
  const staffMixedMethodRisks = risks.filter(r => r.risk_type === 'mixed_payment_method_spend');
  const staffProofRisks = risks.filter(r => r.risk_type === 'staff_expense_missing_proof');

  const staff_spend_summary = {
    count: staffTxs.length,
    total_amount: staffTotalAmount,
    formatted_total: formatReportCurrency(staffTotalAmount),
    missing_proof_count: staffMissingProof.length,
    unknown_payment_method_count: staffUnknownMethod.length,
    mixed_payment_method_risk_count: staffMixedMethodRisks.length,
    proof_risk_count: staffProofRisks.length,
    has_staff_expenses: staffTxs.length > 0,
    top_staff_vendors: (() => {
      const map: Record<string, number> = {};
      staffTxs.forEach(tx => {
        const key = tx.description?.split(' ')[0] || 'Misc';
        map[key] = (map[key] || 0) + Math.abs(getTxAmount(tx));
      });
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, spend]) => ({ name, spend: formatReportCurrency(spend) }));
    })()
  };

  // 1. Check for empty data
  if (transactions.length === 0 && invoices.length === 0) {
    return {
      intent: 'unknown_general',
      text: "Upload a statement first so I can answer from your Kaeo data.",
      source_json: {
        mode: 'deterministic',
        intent: 'unknown_general',
        grounding_status: 'general'
      }
    };
  }

  // 2. Fetch subscription billing details
  let billingDataExists = false;
  let currentPlanName = '';
  let billingCycle = '';
  let subscriptionStatus = '';
  if (_orgId) {
    try {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*, billing_plans(*)')
        .eq('organization_id', _orgId)
        .maybeSingle();
      if (sub) {
        billingDataExists = true;
        currentPlanName = sub.billing_plans?.name || sub.plan_id;
        billingCycle = sub.billing_cycle || 'monthly';
        subscriptionStatus = sub.status || 'active';
      }
    } catch (err) {
      console.warn('Error fetching subscription details for Libby:', err);
    }
  }

  // 3. Check for core financial query intercept
  const coreAnswer = getCoreFinancialAnswer(query, {
    income,
    refunds,
    expenses,
    netCash,
    transactions,
    vendors,
    risks,
    invoices,
    vendorSummary,
    staff_spend_summary,
    staffMissingProof,
    staffUnknownMethod,
    billingDataExists,
    currentPlanName,
    billingCycle,
    subscriptionStatus,
    baseCurrency
  });

  if (coreAnswer) {
    return {
      intent: coreAnswer.intent,
      text: coreAnswer.text,
      source_json: {
        mode: 'deterministic',
        intent: coreAnswer.intent,
        grounding_status: 'based_on_data',
        ...coreAnswer.sourceJson
      }
    };
  }

  // BUILD STRUCTURED CONTEXT FOR AI
  const structuredContext: AIStructuredContext = {
    question: query + " (All financial amounts are in INR.)",
    intent,
    response_mode: responseMode,
    invoice_summary,
    needs_web_research,
    active_client_name: activeClientName,
    business_profile,
    financial_summary: {
      income,
      refunds,
      expenses,
      netCash,
      net_cash_movement: netCash,
      transaction_count,
      period_start,
      period_end,
      base_currency: "INR",
      has_converted_transactions: false
    },
    top_vendors: vendorSummary.topVendors.slice(0, 5).map(v => ({
      name: v.normalized_name,
      spend: v.totalSpend,
      category: v.category
    })),
    recurring_spend: {
      commitment: vendorSummary.recurringCommitment,
      active_vendors: vendorSummary.recurringVendors.length
    },
    open_risks: risks.map(r => ({
      title: r.title,
      severity: r.severity,
      amount: r.amount_at_risk
    })),
    high_priority_risks: risks.filter(r => r.severity === 'high').length,
    latest_report_summary: latestReportSummary,
    relevant_notes: relevantNotes.slice(0, 10),
    caveats: [
      "AI explanations are for informational purposes only. Use validated reports for official decisions.",
      "Calculations are strictly grounded in deterministic database aggregates.",
      "All financial amounts are in INR."
    ],
    counts: {
      transactions: transactions.length,
      vendors: vendors.length,
      risks: risks.length
    },
    approved_extra_numbers,
    matching_vendor,
    staff_spend_summary
  };

  // TRY CALLING THE AI CLIENT
  let aiResult = null;
  let fallbackReason = '';
  let rawAiResponse: any = null;
  let checkContradictionResult: boolean | null = null;
  
  if (intent !== 'ai_review') {
    try {
      aiResult = await askKaeoAi(structuredContext);
      rawAiResponse = aiResult;
      if (aiResult) {
        const sanitizeMarkdown = (text: string) => {
          if (!text) return text;
          return text
            .replace(/\$/g, '₹')
            .replace(/--/g, ', ')
            .replace(/—/g, ', ')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/#{1,6}\s?/g, '')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/\|/g, '');
        };

        // 1. Sanitize Markdown and Currency
        aiResult.answer = sanitizeMarkdown(aiResult.answer);
        aiResult.reasoning_summary = sanitizeMarkdown(aiResult.reasoning_summary);
        if (aiResult.recommended_actions) {
          aiResult.recommended_actions = aiResult.recommended_actions.map(sanitizeMarkdown);
        }
        if (aiResult.caveats) {
          aiResult.caveats = aiResult.caveats.map(sanitizeMarkdown);
        }

        // 1.5. If user didn't ask for math, strip any equations or formulas in format "A + B - C = D" or "A - B = C"
        const q = query.toLowerCase();
        const userAskedMath = q.includes('calculated') || q.includes('math') || q.includes('formula') || q.includes('why is net') || q.includes('breakdown') || q.includes('explain');
        if (!userAskedMath) {
          const mathEquationRegex = /([₹$]|Rs\.?|INR)?\s*[\d,.]+\s*[\+\-\*\/]\s*([₹$]|Rs\.?|INR)?\s*[\d,.]+\s*([\+\-\*\/]\s*([₹$]|Rs\.?|INR)?\s*[\d,.]+)*\s*=\s*([₹$]|Rs\.?|INR)?\s*[\d,.]+/g;
          aiResult.answer = aiResult.answer.replace(mathEquationRegex, '');
          aiResult.reasoning_summary = aiResult.reasoning_summary.replace(mathEquationRegex, '');
        }

        // 2. Auto-inject math formula for net cash ONLY if user asked for it
        if (intent === 'finance_summary') {
          const q = query.toLowerCase();
          const userAskedMath = q.includes('calculated') || q.includes('math') || q.includes('formula') || q.includes('why is net') || q.includes('breakdown') || q.includes('explain');
          if (userAskedMath) {
            const hasMath = aiResult.reasoning_summary.includes('=') && 
                            (aiResult.reasoning_summary.toLowerCase().includes('net cash') || aiResult.reasoning_summary.toLowerCase().includes('math'));
            if (!hasMath) {
              aiResult.reasoning_summary += `\n\nHere’s the math:\n${formatReportCurrency(income, baseCurrency)} (Income) + ${formatReportCurrency(refunds, baseCurrency)} (Refunds) - ${formatReportCurrency(expenses, baseCurrency)} (Expenses) = ${formatReportCurrency(netCash, baseCurrency)} (Net Cash).`;
            }
          }
        }

        // 3. Run contradiction check
        const unreviewedCount = transactions.filter(t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review').length;
        const uncategorizedCount = transactions.filter(t => t.category === 'Uncategorized' || !t.category).length;
        const readinessResult = calculateMonthEndReadiness(transactions, risks);
        const readinessScore = readinessResult.score;

        isSanitized = false;
        sanitizedAnswer = aiResult.answer;
        sanitizedReasoning = aiResult.reasoning_summary;

        const sanitizeContext = {
          income,
          expenses,
          netCash,
          refunds,
          transactionCount: transactions.length,
          openRisksCount: risks.length,
          duplicateExposure,
          uncategorizedCount,
          readinessScore,
          unreviewedCount,
          totalVendorsCount: vendors.length,
          totalInvoicesCount: invoices.length,
          approvedNumbers,
          vendorsList: vendors,
          invoicesList: invoices,
          vendorSummary
        };

        const ansRep = sanitizeTextNumbers(aiResult.answer, sanitizeContext);
        const reasonRep = sanitizeTextNumbers(aiResult.reasoning_summary, sanitizeContext);

        if (ansRep.sanitizedText !== aiResult.answer || reasonRep.sanitizedText !== aiResult.reasoning_summary) {
          isSanitized = true;
          sanitizedAnswer = ansRep.sanitizedText;
          sanitizedReasoning = reasonRep.sanitizedText;
        }

        if (aiResult.recommended_actions) {
          aiResult.recommended_actions = aiResult.recommended_actions.map(act => {
            const rep = sanitizeTextNumbers(act, sanitizeContext);
            if (rep.sanitizedText !== act) {
              isSanitized = true;
            }
            return rep.sanitizedText;
          });
        }
        if (aiResult.caveats) {
          aiResult.caveats = aiResult.caveats.map(cav => {
            const rep = sanitizeTextNumbers(cav, sanitizeContext);
            if (rep.sanitizedText !== cav) {
              isSanitized = true;
            }
            return rep.sanitizedText;
          });
        }
        checkContradictionResult = isSanitized;
      } else {
        fallbackReason = 'AI server returned null or failed validation/repair checks';
      }
    } catch (err: any) {
      if (isDev) {
        console.debug('[Libby Engine] Real AI call failed, falling back to deterministic answer.', err);
      }
      fallbackReason = err.message || 'AI request threw error';
    }
  } else {
    fallbackReason = 'AI Review intent forces deterministic suggestions queue summary';
  }

  // IF AI GENUINELY FAILS OR WAS SHUNTED, PRINT AN OPERATOR DEBUG LOG
  if (!aiResult && isDev) {
    console.debug('[Libby Engine Fallback Triggered]', {
      intent,
      fallback_reason: fallbackReason,
      raw_ai_response: rawAiResponse,
      contradiction_result: checkContradictionResult
    });
  }

  // IF REAL AI SUCCEEDS, USE IT
  if (aiResult) {
    let formattedText = `${isSanitized ? sanitizedAnswer : aiResult.answer}`;
    
    const reasoning = isSanitized ? sanitizedReasoning : aiResult.reasoning_summary;
    if (reasoning && reasoning.trim()) {
      const mode = determineResponseMode(intent, query);
      if (mode === 'casual_followup' || mode === 'priority_advice') {
        formattedText += `\n\n${reasoning}`;
      } else {
        formattedText += `\n\nWhy:\n${reasoning}`;
      }
    }
    
    if (aiResult.recommended_actions && aiResult.recommended_actions.length > 0) {
      formattedText += `\n\nNext:\n${aiResult.recommended_actions.map(a => `• ${a}`).join('\n')}`;
    }
    
    if (aiResult.caveats && aiResult.caveats.length > 0) {
      formattedText += `\n\nWatch out:\n${aiResult.caveats.map(c => `• ${c}`).join('\n')}`;
    }

    const mode = isSanitized ? 'ai_assisted_sanitized' : (intent === 'finance_summary' ? 'ai_assisted_locked_numbers' : 'ai_assisted');
    
    let grounding_status: 'verified' | 'based_on_data' | 'general' = 'based_on_data';
    const isGeneralIntent = ['unknown_general', 'tax_or_legal_sensitive', 'unsupported_needs_ai_or_web', 'casual_check_in'].includes(intent);
    if (isGeneralIntent) {
      grounding_status = 'general';
    } else if (isSanitized) {
      grounding_status = 'based_on_data'; // Replaced contradictory numbers, so it is based on data but not verified/clean raw AI output
    } else {
      const isNumericIntent = ['finance_summary', 'risk_review', 'vendor_analysis', 'recurring_spend', 'ai_review'].includes(intent);
      if (isNumericIntent) {
        grounding_status = 'verified';
      }
    }

    return {
      intent,
      text: formattedText,
      source_json: {
        mode,
        intent,
        grounding_status,
        ai_confidence: aiResult.confidence,
        caveats: aiResult.caveats,
        needs_external_research: aiResult.needs_external_research,
        source_summary: aiResult.source_summary,
        ai_raw_response: aiResult
      }
    };
  }

  // OTHERWISE, FALLBACK TO THE POLISHED DETERMINISTIC PHASE 7 ANSWERS
  let responseText = '';
  let sourceJson: any = {};

  switch (intent) {
    case 'ai_review': {
      let currentSuggestions: any[] = [];
      try {
        currentSuggestions = await syncReviewSuggestions(_orgId, clientId);
      } catch (err) {
        console.warn('Error syncing suggestions in Libby:', err);
        const { data } = await supabase
          .from('ai_review_suggestions')
          .select('*')
          .eq('client_id', clientId)
          .eq('status', 'pending');
        currentSuggestions = data || [];
      }

      const safeSuggestions = currentSuggestions.filter(s => !s.requires_approval);
      const highPriority = currentSuggestions.filter(s => s.priority === 'high');

      responseText = `I have completed an AI audit of your financial data and prepared review recommendations for your approval:\n\n` +
      `Summary:\n` +
      `• Total suggestions: ${currentSuggestions.length} pending items\n` +
      `• Safe to auto-apply: ${safeSuggestions.length} suggestions (low risk)\n` +
      `• High priority: ${highPriority.length} items needing attention\n\n` +
      `Top Issues & Recommendations:\n` +
      (highPriority.length > 0 
        ? highPriority.slice(0, 3).map(h => `• [${h.priority.toUpperCase()}] ${h.reason}`).join('\n') + '\n\n'
        : `• All identified items are low-to-medium priority.\n\n`) +
      `Suggested Actions:\n` +
      `• Click "Open AI Review" to review the full queue.\n` +
      `• You can approve the ${safeSuggestions.length} safe items (categorization and low-value reviews) in bulk with one click.\n\n` +
      `What this means:\nApproving safe suggestions will automatically categorize transactions and clear clean rows, improving your month-end readiness.`;

      sourceJson = {
        mode: 'ai_review',
        intent: 'ai_review',
        totalSuggestionsCount: currentSuggestions.length,
        safeSuggestionsCount: safeSuggestions.length,
        highPriorityCount: highPriority.length,
        hasSafeSuggestions: safeSuggestions.length > 0,
        cta: 'open_ai_review'
      };
      break;
    }

    case 'finance_summary': {
      const netCashPositive = netCash >= 0;
      responseText = `Your net cash movement is ${netCashPositive ? 'positive' : 'negative'} at ${formatReportCurrency(netCash, baseCurrency)}. That means the client ${netCashPositive ? 'brought in more cash than it spent' : 'spent more cash than it brought in'} during this imported period.\n\n` +
      `Breakdown:\n• Income: ${formatReportCurrency(income, baseCurrency)}\n• Refunds / Recoveries: ${formatReportCurrency(refunds, baseCurrency)}\n• Expenses: ${formatReportCurrency(expenses, baseCurrency)}\n\n` +
      `Formula:\n${formatReportCurrency(income, baseCurrency)} + ${formatReportCurrency(refunds, baseCurrency)} - ${formatReportCurrency(expenses, baseCurrency)} = ${formatReportCurrency(netCash, baseCurrency)}\n\n` +
      `What this means:\nThe business is cash-${netCashPositive ? 'positive' : 'negative'} in this period, but the quality of that cash movement still depends on whether the open risks are resolved. Duplicate vendor payments and unclassified bank adjustments can distort the true picture.\n\n` +
      `Recommended next step:\nReview your Risk Inbox to ensure no false expenses are skewing the cash calculation.\n\n` +
      `Source:\nCalculated directly from ${txCount} transactions imported via your accounting data.`;
      
      sourceJson = { income, expenses, refunds, netCash, transactionCount: txCount };
      break;
    }
    
    case 'operational_next_steps': {
      const unreviewedCount = transactions.filter(t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review').length;
      const uncategorizedCount = transactions.filter(t => t.category === 'Uncategorized' || !t.category).length;

      responseText = `Start with your review queue:\n` +
      `1. Resolve ${risks.length} open risks.\n` +
      `2. Review ${unreviewedCount} pending transactions.\n` +
      `3. Categorize ${uncategorizedCount} uncategorized rows.\n` +
      `4. Generate the accountant pack after those are clean.\n\n` +
      `Your first click should be Risk Inbox. Clean books require fixing risks and pending reviews before compiling reports.`;
      
      sourceJson = { 
        risks: risks.length, 
        unreviewed: unreviewedCount, 
        uncategorized: uncategorizedCount,
        cta: 'risk_inbox'
      };
      break;
    }
    
    case 'risk_review': {
      const highSeverityRisks = risks.filter(r => r.severity === 'high');
      const unknownTxs = transactions.filter(t => t.type === 'unknown');
      const recurringCount = vendorSummary.recurringVendors.length;
      
      // Invoice stats
      const unmatchedCount = unmatchedInvoices.length;
      const overdueCount = overdueInvoices.length;
      const mismatchCount = mismatchInvoices.length;

      let invoiceText = '';
      if (total_invoices_count > 0) {
        invoiceText = `\n\nInvoice Scanning Status:\n` +
        `• Total invoices uploaded: ${total_invoices_count}\n` +
        `• Overdue unpaid invoices: ${overdueCount} items\n` +
        `• Mismatched payment/invoice amounts: ${mismatchCount} items\n` +
        `• Unmatched (missing payment): ${unmatchedCount} items`;
      } else {
        invoiceText = `\n\nInvoice Scanning Status:\n` +
        `• No vendor invoices uploaded yet. Upload your invoices in the Invoices tab to reconcile them against payments.`;
      }

      // Check for large payments lacking invoices
      const missingInvoicePayments = transactions.filter(t => {
        const val = getTxAmount(t);
        return val < 0 && Math.abs(val) >= 15000;
      });
      if (missingInvoicePayments.length > 0) {
        invoiceText += `\n• Large transactions missing supporting invoices: ${missingInvoicePayments.length} payments (> ${formatReportCurrency(15000, baseCurrency)})`;
      }

      responseText = `You have ${risks.length} open risk events and ${unknownTxs.length} unclassified transactions that need attention.${invoiceText}\n\n` +
      `Breakdown:\n` +
      `1. High-severity risks: ${highSeverityRisks.length > 0 ? highSeverityRisks.map(r => r.title).join(', ') : 'None'}\n` +
      `2. Possible duplicate vendor payments: ${risks.filter(r => r.title.toLowerCase().includes('duplicate')).length} detected\n` +
      `3. Unknown transactions: ${unknownTxs.length} items (${formatReportCurrency(unknownTxs.reduce((sum, t) => sum + Math.abs(getTxAmount(t) || 0), 0), baseCurrency)})\n` +
      `4. Recurring SaaS commitments: ${recurringCount} active vendors\n` +
      `5. High spend vendors: Your top vendor is ${vendorSummary.topVendors[0]?.normalized_name || 'N/A'}\n\n` +
      `What this means:\nLeaving high-severity risks, overdue invoices, and missing invoices unreviewed means your ledger compliance is low and duplicate payments can slide through.\n\n` +
      `Recommended next step:\nReview your Risk Inbox and go to the Invoices tab inside Files to upload vendor bills and resolve mismatches.\n\n` +
      `Source:\nBased on ${risks.length} active risks, ${total_invoices_count} uploaded invoices, and ${txCount} imported transactions.`;
      
      sourceJson = { risks: risks.length, highSeverity: highSeverityRisks.length, unknown: unknownTxs.length, totalInvoices: total_invoices_count, unmatchedInvoices: unmatchedCount, overdueInvoices: overdueCount, mismatchInvoices: mismatchCount };
      break;
    }

    case 'service_alternatives': {
      const mentionedVendor = findMatchingVendor(query, vendors);
      if (mentionedVendor) {
        const spend = mentionedVendor.monthly_average || vendorSummary.topVendors.find(tv => tv.normalized_name === mentionedVendor.normalized_name)?.totalSpend || 0;
        responseText = `You are currently spending ${formatReportCurrency(spend, baseCurrency)} on ${mentionedVendor.display_name || mentionedVendor.name}.\n\n` +
        `Breakdown:\n• Vendor: ${mentionedVendor.display_name || mentionedVendor.name}\n• Category: ${mentionedVendor.category || 'Vendor'}\n• Detected Spend: ${formatReportCurrency(spend, baseCurrency)}\n\n` +
        `What this means:\nThis service is a measurable component of your operational overhead. Replacing it could yield cost savings, but might also incur switching costs or productivity downtime for your team.\n\n` +
        `Recommended next step:\nBefore switching, audit your active user seats for ${mentionedVendor.name} to see if you can reduce the current tier. Live market/pricing research is not enabled yet. I can evaluate this service using your internal Kaeo data and give comparison criteria.\n\n` +
        `Source:\nBased on historical vendor extraction from your imported transactions.`;
        sourceJson = { vendor: mentionedVendor.name, spend };
      } else {
        responseText = `I cannot identify the specific service you want to replace based on your imported data.\n\n` +
        `Breakdown:\nNo vendor matching your query was found in the active data context.\n\n` +
        `What this means:\nI can only analyze spending patterns and alternatives for vendors you are actively paying according to the imported statements.\n\n` +
        `Recommended next step:\nEnsure you have imported recent transactions for this tool. Live market/pricing research is not enabled yet. I can evaluate this service using your internal Kaeo data and give comparison criteria.\n\n` +
        `Source:\nBased on ${vendors.length} active vendors.`;
      }
      break;
    }
    
    case 'vendor_analysis': {
      const mentionedVendor = findMatchingVendor(query, vendors);
      if (mentionedVendor) {
        const spend = vendorSummary.topVendors.find(tv => tv.normalized_name === mentionedVendor.normalized_name)?.totalSpend || 0;
        responseText = `Your recorded spend with ${mentionedVendor.display_name || mentionedVendor.name} is ${formatReportCurrency(spend, baseCurrency)}.\n\n` +
        `Breakdown:\n• Vendor Name: ${mentionedVendor.display_name || mentionedVendor.name}\n• Categorization: ${mentionedVendor.category || 'Uncategorized'}\n• Total Spend: ${formatReportCurrency(spend, baseCurrency)}\n\n` +
        `What this means:\nThis represents a direct operational expense. If this vendor is categorized as 'Generic Vendor Payments', it may obscure the true nature of the spend.\n\n` +
        `Recommended next step:\nReview if this spend is a one-time project cost or a recurring necessity. If it is recurring, consider negotiating an annual contract for a discount.\n\n` +
        `Source:\nBased on ${txCount} imported transactions.`;
        sourceJson = { vendor: mentionedVendor.name, spend };
      } else {
        const top = vendorSummary.topVendors[0];
        if (top) {
          responseText = `Your highest capital concentration is with ${top.normalized_name}, totaling ${formatReportCurrency(top.totalSpend, baseCurrency)}.\n\n` +
          `Breakdown:\n• Top Vendor: ${top.normalized_name}\n• Spend: ${formatReportCurrency(top.totalSpend, baseCurrency)}\n• Total Identified Vendors: ${vendors.length}\n\n` +
          `What this means:\nHeavy reliance on a single vendor can represent both operational leverage and strategic risk. If this is a core service (like payroll or cloud hosting), the spend is expected. If it's an agency or variable cost, it warrants close monitoring.\n\n` +
          `Recommended next step:\nOpen the Spend Advisor to review the top 5 vendor breakdown and ensure no unusual billing spikes occurred.\n\n` +
          `Source:\nBased on ${txCount} imported transactions.`;
          sourceJson = { topVendor: top.normalized_name, spend: top.totalSpend };
        } else {
          responseText = `You currently have ${vendors.length} vendors tracked in Kaeo.\n\n` +
          `Breakdown:\nNo significant spend concentration detected in the current data period.\n\n` +
          `What this means:\nYour spend is distributed without a single dominant vendor, or transactions have not been fully processed.\n\n` +
          `Recommended next step:\nEnsure all transactions are categorized to unlock accurate Spend Advisor metrics.\n\n` +
          `Source:\nBased on ${txCount} imported transactions.`;
          sourceJson = { totalVendors: vendors.length };
        }
      }
      break;
    }
    
    case 'recurring_spend':
    case 'cost_optimization': {
      responseText = `Your estimated recurring commitment is ${formatReportCurrency(vendorSummary.recurringCommitment, baseCurrency)} per month.\n\n` +
      `Breakdown:\n• Recurring Subscriptions: ${vendorSummary.recurringVendors.length} active\n• Total Monthly Commitment: ${formatReportCurrency(vendorSummary.recurringCommitment, baseCurrency)}\n• Top SaaS Vendor: ${vendorSummary.recurringVendors[0]?.normalized_name || 'None'}\n\n` +
      `What this means:\nThis is your "burn floor" — the fixed operational cost you must pay every month regardless of revenue. High recurring commitments reduce your capital flexibility.\n\n` +
      `Recommended next step:\nPerform a seat audit on your active SaaS tools. Cancel any dormant accounts or duplicate services performing the same function.\n\n` +
      `Source:\nBased on heuristic detection of recurring payments across ${txCount} imported transactions.`;
      sourceJson = { commitment: vendorSummary.recurringCommitment, count: vendorSummary.recurringVendors.length };
      break;
    }
    
    case 'business_advice': {
      const unreviewedCount = transactions.filter(t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review').length;
      const uncategorizedCount = transactions.filter(t => t.category === 'Uncategorized' || !t.category).length;

      responseText = `Your financial health shows ${netCash >= 0 ? 'positive' : 'negative'} net cash flow of ${formatReportCurrency(netCash, baseCurrency)} this period. However, we have data gaps that make this number unreliable for decision-making.\n\n` +
      `Ranked Action List:\n` +
      `1. Resolve ${risks.length} open risks to capture duplicate exposure.\n` +
      `2. Review ${unreviewedCount} transactions in the review queue.\n` +
      `3. Categorize ${uncategorizedCount} transactions that are currently unclassified.\n\n` +
      `Why it matters:\nCFOs need high-fidelity books. Until these items are reviewed, your reports have a margin of error.\n\n` +
      `First click: Go to the Risk Inbox to check the duplicate payments first.`;
      sourceJson = { netCash, risks: risks.length, unreviewed: unreviewedCount, uncategorized: uncategorizedCount };
      break;
    }
    
    case 'unknown_general':
    case 'tax_or_legal_sensitive':
    case 'unsupported_needs_ai_or_web':
    case 'casual_check_in':
    default: {
      const unreviewedCount = transactions.filter(t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review').length;
      responseText = `I'm here to help you navigate your books. Start by checking your Risk Inbox (${risks.length} open risks) and review queue (${unreviewedCount} transactions pending review). Let me know if you want to drill into cash movement, vendor spend, or reports.`;
      break;
    }
  }

  if (!aiResult && intent !== 'ai_review') {
    responseText = `I can still summarize your imported Kaeo data, but the AI model is unavailable right now.\n\n${responseText}`;
  }

  let grounding_status: 'verified' | 'based_on_data' | 'general' = 'based_on_data';
  const isGeneralIntent = ['unknown_general', 'tax_or_legal_sensitive', 'unsupported_needs_ai_or_web', 'casual_check_in'].includes(intent);
  if (isGeneralIntent) {
    grounding_status = 'general';
  }

  return {
    intent,
    text: responseText,
    source_json: {
      mode: "deterministic",
      intent,
      grounding_status,
      fallback_reason: fallbackReason,
      ...sourceJson
    }
  };
}
