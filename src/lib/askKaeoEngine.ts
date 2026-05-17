import { supabase } from './supabase';
import { summarizeVendors } from './reportEngine';
import { askKaeoAi } from './ai/aiClient';
import type { AIStructuredContext } from './ai/aiClient';

export type AskKaeoCategory = 
  | 'finance_summary' 
  | 'vendor_analysis' 
  | 'risk_review' 
  | 'recurring_spend' 
  | 'cost_optimization' 
  | 'service_alternatives' 
  | 'business_advice' 
  | 'operational_next_steps' 
  | 'unsupported_needs_ai_or_web';

interface AskKaeoResponse {
  intent: AskKaeoCategory;
  text: string;
  source_json: any;
}

const formatReportCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

export async function categorizeQuestion(query: string): Promise<AskKaeoCategory> {
  const q = query.toLowerCase();
  
  if (q.includes('alternative') || q.includes('replace') || q.includes('better than') || q.includes('cheaper than')) {
    return 'service_alternatives';
  }
  
  if (q.includes('what should i do') || q.includes('next steps') || q.includes('priority')) {
    return 'operational_next_steps';
  }
  
  if (q.includes('advice') || q.includes('should i') || q.includes('worth it') || q.includes('negotiate')) {
    return 'business_advice';
  }
  
  if (q.includes('risk') || q.includes('duplicate') || q.includes('unusual') || q.includes('worry')) {
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
  
  return 'unsupported_needs_ai_or_web';
}

const checkAIContradictions = (aiText: string, context: AIStructuredContext): boolean => {
  const approvedNumbers = new Set<number>([
    Math.round(context.financial_summary.income),
    Math.round(context.financial_summary.refunds),
    Math.round(context.financial_summary.expenses),
    Math.round(context.financial_summary.netCash),
    Math.round(context.recurring_spend.commitment),
    context.recurring_spend.active_vendors,
    context.high_priority_risks,
    context.counts.transactions,
    context.counts.vendors,
    context.counts.risks
  ]);
  
  context.top_vendors.forEach(v => approvedNumbers.add(Math.round(v.spend)));

  if (context.approved_extra_numbers) {
    context.approved_extra_numbers.forEach(n => approvedNumbers.add(Math.round(n)));
  }

  // Also approve any numbers mentioned in the user question
  const numbersInQuery = context.question.replace(/202[0-9]/g, '').match(/\d[\d,.]*/g) || [];
  numbersInQuery.forEach(numStr => {
    const cleanDigits = numStr.replace(/[^\d]/g, '');
    if (cleanDigits.length >= 3) {
      approvedNumbers.add(parseInt(cleanDigits, 10));
    }
  });
  
  const approvedStrings = new Set<string>();
  approvedNumbers.forEach(n => {
    if (n >= 0) {
      approvedStrings.add(String(n));
      approvedStrings.add(formatReportCurrency(n).replace(/[^\d]/g, ''));
    }
  });

  const numbersInText = aiText.replace(/202[0-9]/g, '').match(/\d[\d,.]*/g) || [];
  for (const numStr of numbersInText) {
    const cleanDigits = numStr.replace(/[^\d]/g, '');
    if (cleanDigits.length >= 3) {
      const val = parseInt(cleanDigits, 10);
      if (val > 100 && !approvedStrings.has(cleanDigits)) {
        console.warn(`[AI Contradiction Checker] AI output contained unapproved number: ${numStr} (digits: ${cleanDigits}). Falling back.`);
        return true;
      }
    }
  }

  return false;
};

export async function askKaeo(query: string, clientId: string, _orgId: string): Promise<AskKaeoResponse> {
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
    
  const transactions = txs || [];
  const vendors = vendorsData || [];
  const risks = risksData || [];
  
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const refunds = transactions.filter(t => t.type === 'refund').reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const expenses = transactions.filter(t => ['expense', 'vendor_payment', 'subscription'].includes(t.type)).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const netCash = income + refunds - expenses;

  const vendorSummary = summarizeVendors(vendors, transactions);

  // FETCH ADDITIONAL SECURE SERVER CONTEXT FOR AI
  const { data: clientData } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .single();
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

  // Extract all existing vendor monthly averages, spends, transaction amounts, and risk amounts to prevent false positives
  const approved_extra_numbers = [
    ...vendors.map(v => Math.round(Number(v.monthly_average || 0))),
    ...vendors.map(v => Math.round(Number(v.total_spend || v.spend || 0))),
    ...transactions.map(t => Math.round(Math.abs(Number(t.amount || 0)))),
    ...risks.map(r => Math.round(Number(r.amount_at_risk || 0)))
  ].filter(n => n > 0);

  // BUILD STRUCTURED CONTEXT FOR AI
  const structuredContext: AIStructuredContext = {
    question: query,
    intent,
    active_client_name: activeClientName,
    financial_summary: {
      income,
      refunds,
      expenses,
      netCash,
      net_cash_movement: netCash,
      transaction_count,
      period_start,
      period_end
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
      "Calculations are strictly grounded in deterministic database aggregates."
    ],
    counts: {
      transactions: transactions.length,
      vendors: vendors.length,
      risks: risks.length
    },
    approved_extra_numbers
  };

  // TRY CALLING THE AI CLIENT
  let aiResult = null;
  let fallbackReason = '';
  
  try {
    aiResult = await askKaeoAi(structuredContext);
    if (aiResult) {
      // Run contradiction check
      const hasContradiction = checkAIContradictions(aiResult.answer + " " + aiResult.reasoning_summary, structuredContext);
      if (hasContradiction) {
        aiResult = null;
        fallbackReason = 'AI response contained numeric contradictions with deterministic totals';
      }
    } else {
      fallbackReason = 'AI server returned null or failed validation';
    }
  } catch (err: any) {
    console.warn('[Ask Kaeo Engine] Real AI call failed, falling back to deterministic answer.', err);
    fallbackReason = err.message || 'AI request threw error';
  }

  // IF REAL AI SUCCEEDS, USE IT
  if (aiResult) {
    const formattedText = `${aiResult.answer}\n\nBreakdown / Reasoning:\n${aiResult.reasoning_summary}\n\nRecommended next steps:\n${aiResult.recommended_actions.map(a => `- ${a}`).join('\n')}\n\nCaveats:\n${aiResult.caveats.map(c => `- ${c}`).join('\n')}`;
    
    return {
      intent,
      text: formattedText,
      source_json: {
        mode: "ai_assisted",
        intent,
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
    case 'finance_summary': {
      const netCashPositive = netCash >= 0;
      responseText = `Your net cash movement is ${netCashPositive ? 'positive' : 'negative'} at ${formatReportCurrency(netCash)}. That means the client ${netCashPositive ? 'brought in more cash than it spent' : 'spent more cash than it brought in'} during this imported period.\n\n` +
      `Breakdown:\n- Income: ${formatReportCurrency(income)}\n- Refunds / Recoveries: ${formatReportCurrency(refunds)}\n- Expenses: ${formatReportCurrency(expenses)}\n\n` +
      `Formula:\n${formatReportCurrency(income)} + ${formatReportCurrency(refunds)} - ${formatReportCurrency(expenses)} = ${formatReportCurrency(netCash)}\n\n` +
      `What this means:\nThe business is cash-${netCashPositive ? 'positive' : 'negative'} in this period, but the quality of that cash movement still depends on whether the open risks are resolved. Duplicate vendor payments and unclassified bank adjustments can distort the true picture.\n\n` +
      `Recommended next step:\nReview the highest-value risks first before treating this as final CFO-grade cash movement.\n\n` +
      `Source:\nBased on ${txCount} imported transactions for this active client.`;
      
      sourceJson = { income, refunds, expenses, netCash };
      break;
    }
    
    case 'operational_next_steps':
    case 'risk_review': {
      const highSeverityRisks = risks.filter(r => r.severity === 'high');
      const unknownTxs = transactions.filter(t => t.type === 'unknown');
      const recurringCount = vendorSummary.recurringVendors.length;
      
      responseText = `You have ${risks.length} open risk events and ${unknownTxs.length} unclassified transactions that need attention.\n\n` +
      `Breakdown:\n` +
      `1. High-severity risks: ${highSeverityRisks.length > 0 ? highSeverityRisks.map(r => r.title).join(', ') : 'None'}\n` +
      `2. Possible duplicate vendor payments: ${risks.filter(r => r.title.toLowerCase().includes('duplicate')).length} detected\n` +
      `3. Unknown transactions: ${unknownTxs.length} items (${formatReportCurrency(unknownTxs.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0))})\n` +
      `4. Recurring SaaS commitments: ${recurringCount} active vendors\n` +
      `5. High spend vendors: Your top vendor is ${vendorSummary.topVendors[0]?.normalized_name || 'N/A'}\n\n` +
      `What this means:\nLeaving high-severity risks and unknown transactions unreviewed means your financial reports (like Net Cash and Vendor Analysis) may be inaccurate. Duplicate payments in particular represent direct capital leakage.\n\n` +
      `Recommended next step:\nInvestigate the high-severity duplicate risks in your Risk Inbox immediately. Then classify the unknown transactions to clean up your ledger.\n\n` +
      `Source:\nBased on ${risks.length} active risks and ${txCount} imported transactions.`;
      
      sourceJson = { risks: risks.length, highSeverity: highSeverityRisks.length, unknown: unknownTxs.length };
      break;
    }

    case 'service_alternatives': {
      const mentionedVendor = vendors.find(v => query.toLowerCase().includes(v.normalized_name.toLowerCase()));
      if (mentionedVendor) {
        const spend = mentionedVendor.monthly_average || vendorSummary.topVendors.find(tv => tv.normalized_name === mentionedVendor.normalized_name)?.totalSpend || 0;
        responseText = `You are currently spending ${formatReportCurrency(spend)} on ${mentionedVendor.display_name || mentionedVendor.name}.\n\n` +
        `Breakdown:\n- Vendor: ${mentionedVendor.display_name || mentionedVendor.name}\n- Category: ${mentionedVendor.category || 'Vendor'}\n- Detected Spend: ${formatReportCurrency(spend)}\n\n` +
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
      const mentionedVendor = vendors.find(v => query.toLowerCase().includes(v.normalized_name.toLowerCase()));
      if (mentionedVendor) {
        const spend = vendorSummary.topVendors.find(tv => tv.normalized_name === mentionedVendor.normalized_name)?.totalSpend || 0;
        responseText = `Your recorded spend with ${mentionedVendor.display_name || mentionedVendor.name} is ${formatReportCurrency(spend)}.\n\n` +
        `Breakdown:\n- Vendor Name: ${mentionedVendor.display_name || mentionedVendor.name}\n- Categorization: ${mentionedVendor.category || 'Uncategorized'}\n- Total Spend: ${formatReportCurrency(spend)}\n\n` +
        `What this means:\nThis represents a direct operational expense. If this vendor is categorized as 'Generic Vendor Payments', it may obscure the true nature of the spend.\n\n` +
        `Recommended next step:\nReview if this spend is a one-time project cost or a recurring necessity. If it is recurring, consider negotiating an annual contract for a discount.\n\n` +
        `Source:\nBased on ${txCount} imported transactions.`;
        sourceJson = { vendor: mentionedVendor.name, spend };
      } else {
        const top = vendorSummary.topVendors[0];
        if (top) {
          responseText = `Your highest capital concentration is with ${top.normalized_name}, totaling ${formatReportCurrency(top.totalSpend)}.\n\n` +
          `Breakdown:\n- Top Vendor: ${top.normalized_name}\n- Spend: ${formatReportCurrency(top.totalSpend)}\n- Total Identified Vendors: ${vendors.length}\n\n` +
          `What this means:\nHeavy reliance on a single vendor can represent both operational leverage and strategic risk. If this is a core service (like payroll or cloud hosting), the spend is expected. If it's an agency or variable cost, it warrants close monitoring.\n\n` +
          `Recommended next step:\nOpen the Spend Advisor to review the top 5 vendor breakdown and ensure no unusual billing spikes occurred.\n\n` +
          `Source:\nBased on ${txCount} imported transactions.`;
          sourceJson = { topVendor: top.normalized_name, spend: top.totalSpend };
        } else {
          responseText = `No vendor spend has been clearly identified in your data.\n\n` +
          `Breakdown:\n- Extracted Vendors: 0\n- Expense Transactions: ${transactions.filter(t => t.type === 'expense').length}\n\n` +
          `What this means:\nEither no payments have been made, or the uploaded bank statements lack clear merchant identifiers.\n\n` +
          `Recommended next step:\nEnsure your transactions are properly classified as expenses rather than unknown adjustments.\n\n` +
          `Source:\nBased on ${txCount} imported transactions.`;
        }
      }
      break;
    }
    
    case 'recurring_spend':
    case 'cost_optimization': {
      responseText = `Your estimated recurring commitment is ${formatReportCurrency(vendorSummary.recurringCommitment)} per month.\n\n` +
      `Breakdown:\n- Recurring Subscriptions: ${vendorSummary.recurringVendors.length} active\n- Total Monthly Commitment: ${formatReportCurrency(vendorSummary.recurringCommitment)}\n- Top SaaS Vendor: ${vendorSummary.recurringVendors[0]?.normalized_name || 'None'}\n\n` +
      `What this means:\nThis is your "burn floor" — the fixed operational cost you must pay every month regardless of revenue. High recurring commitments reduce your capital flexibility.\n\n` +
      `Recommended next step:\nPerform a seat audit on your active SaaS tools. Cancel any dormant accounts or duplicate services performing the same function.\n\n` +
      `Source:\nBased on heuristic detection of recurring payments across ${txCount} imported transactions.`;
      sourceJson = { commitment: vendorSummary.recurringCommitment, count: vendorSummary.recurringVendors.length };
      break;
    }
    
    case 'business_advice': {
      responseText = `Based on your internal financial profile, the primary directive is to resolve operational blind spots and secure your cash flow.\n\n` +
      `Breakdown:\n- Financial Health: ${netCash >= 0 ? 'Positive' : 'Negative'} cash flow (${formatReportCurrency(netCash)})\n- Open Risks: ${risks.length} pending items\n- Spending Concentration: Top vendor is ${vendorSummary.topVendors[0]?.normalized_name || 'N/A'}\n- Recurring Commitments: ${formatReportCurrency(vendorSummary.recurringCommitment)}/mo\n\n` +
      `What this means:\nYour business data has anomalies. CFOs rely on high-fidelity data. Until the risk inbox is cleared and unknown transactions are categorized, your executive reporting contains a margin of error.\n\n` +
      `Recommended next step:\nClear your Risk Inbox and categorize unknown transactions. Once Phase 8 introduces real AI, I will be able to cross-reference your spend with live market benchmarks for deeper operational advice.\n\n` +
      `Source:\nBased strictly on ${txCount} imported transactions and your local Kaeo risk profile.`;
      sourceJson = { netCash, risks: risks.length };
      break;
    }
    
    case 'unsupported_needs_ai_or_web':
    default: {
      responseText = `This specific query requires external market research, predictive modeling, or deeper contextual reasoning.\n\n` +
      `Breakdown:\n- Requested capability: External knowledge / AI reasoning\n- Current state: Phase 7 Deterministic Engine\n\n` +
      `What this means:\nI am currently operating in a secure, local-data-only mode. I can perfectly analyze your imported transactions, vendors, and risks, but I cannot yet invent market data or search the web.\n\n` +
      `Recommended next step:\nTry asking me about your internal data: "What is my net cash?", "Who is my top vendor?", or "What should I review first?". Live market/pricing research is not enabled yet. I can evaluate this service using your internal Kaeo data and give comparison criteria.\n\n` +
      `Source:\nKaeo Phase 7 Engine.`;
      break;
    }
  }

  return {
    intent,
    text: responseText,
    source_json: {
      mode: "deterministic",
      intent,
      fallback_reason: fallbackReason,
      ...sourceJson
    }
  };
}
