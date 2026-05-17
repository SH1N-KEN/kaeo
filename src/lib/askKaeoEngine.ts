import { supabase } from './supabase';
import { summarizeVendors } from './reportEngine';

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

  let responseText = '';
  let sourceJson: any = {};

  switch (intent) {
    case 'service_alternatives': {
      // Find the specific vendor they might be asking about
      const mentionedVendor = vendors.find(v => query.toLowerCase().includes(v.normalized_name.toLowerCase()));
      if (mentionedVendor) {
        responseText = `Based on your imported data, ${mentionedVendor.display_name || mentionedVendor.name} is currently a ${mentionedVendor.category || 'Vendor'} cost of ${formatReportCurrency(mentionedVendor.monthly_average || vendorSummary.topVendors.find(tv => tv.normalized_name === mentionedVendor.normalized_name)?.totalSpend || 0)}. I cannot verify live alternatives yet without the real AI/web layer, but this is a good candidate for review. In Phase 8, I’ll be able to compare alternatives like pricing, features, and fit. For now, I recommend checking whether all paid seats are active before switching tools.`;
        sourceJson = { vendor: mentionedVendor.name, spend: mentionedVendor.monthly_average };
      } else {
        responseText = `I can help compare alternatives once real AI/web research is enabled in Phase 8. From your imported data, I can first show how much you spend on this service and whether it appears recurring, but I couldn't identify a specific vendor in your question.`;
      }
      break;
    }
    
    case 'operational_next_steps': {
      const highSeverityRisks = risks.filter(r => r.severity === 'high');
      
      responseText = `Based on your financial data and Risk Inbox, I recommend prioritizing the following:\n`;
      if (highSeverityRisks.length > 0) {
        responseText += `\n1. Review ${highSeverityRisks.length} High-Severity Risk(s), such as: ${highSeverityRisks[0].title}.`;
      }
      const unknownTxs = transactions.filter(t => t.type === 'unknown');
      if (unknownTxs.length > 0) {
        responseText += `\n2. Classify ${unknownTxs.length} unknown transactions to ensure reporting accuracy.`;
      }
      if (vendorSummary.recurringCommitment > 0) {
        responseText += `\n3. Audit your ${formatReportCurrency(vendorSummary.recurringCommitment)}/mo recurring SaaS commitment.`;
      }
      if (vendorSummary.topVendors.length > 0) {
        responseText += `\n4. Review spend with your top vendor, ${vendorSummary.topVendors[0].normalized_name}.`;
      }
      if (!responseText.includes('1.')) {
        responseText = `Your current financial hygiene looks strong. There are no high-severity risks or major unclassified transactions. I recommend continuing to monitor your top vendors for unusual spikes.`;
      }
      sourceJson = { risks: highSeverityRisks.length, unknown: unknownTxs.length };
      break;
    }

    case 'finance_summary': {
      responseText = `Based on the latest imported data, your total cash inflow is ${formatReportCurrency(income + refunds)} (including refunds) against total expenses of ${formatReportCurrency(expenses)}. Your Net Cash Movement stands at ${formatReportCurrency(netCash)}.\n\nNext Action: Ensure all recent bank statements are imported to keep this view accurate.`;
      sourceJson = { income, refunds, expenses, netCash };
      break;
    }
    
    case 'vendor_analysis': {
      const mentionedVendor = vendors.find(v => query.toLowerCase().includes(v.normalized_name.toLowerCase()));
      if (mentionedVendor) {
        const spend = vendorSummary.topVendors.find(tv => tv.normalized_name === mentionedVendor.normalized_name)?.totalSpend || 0;
        responseText = `Your total spend with ${mentionedVendor.display_name || mentionedVendor.name} is ${formatReportCurrency(spend)}. It is categorized under ${mentionedVendor.category}.\n\nNext Action: Review if this spend aligns with your current operational needs.`;
        sourceJson = { vendor: mentionedVendor.name, spend };
      } else if (vendorSummary.topVendors.length > 0) {
        const top = vendorSummary.topVendors[0];
        responseText = `Your largest expense source is currently ${top.normalized_name} at ${formatReportCurrency(top.totalSpend)}.\n\nNext Action: Check the Spend Advisor to see the full breakdown of your top 5 vendors.`;
        sourceJson = { topVendor: top.normalized_name, spend: top.totalSpend };
      } else {
        responseText = `I couldn't identify any significant vendor spend in your imported data. Ensure you have imported and classified your expense transactions.`;
      }
      break;
    }
    
    case 'risk_review': {
      if (risks.length > 0) {
        const high = risks.filter(r => r.severity === 'high').length;
        responseText = `You currently have ${risks.length} open risk events in your inbox. ${high > 0 ? `Critically, ${high} of these are high-severity and require immediate attention.` : 'Most of these are routine reviews or recurring subscriptions.'}\n\nNext Action: Open the Risk Inbox to investigate and clear these items.`;
        sourceJson = { totalRisks: risks.length, highSeverity: high };
      } else {
        responseText = `Your Risk Inbox is currently clear. No duplicate payments or unusual spikes have been detected in the active data.\n\nNext Action: No immediate action required.`;
      }
      break;
    }
    
    case 'recurring_spend': {
      if (vendorSummary.recurringVendors.length > 0) {
        responseText = `You have an estimated recurring commitment of ${formatReportCurrency(vendorSummary.recurringCommitment)} per month across ${vendorSummary.recurringVendors.length} subscriptions/services.\n\nNext Action: Audit these subscriptions in the Spend Advisor to cancel unused seats or dormant services.`;
        sourceJson = { commitment: vendorSummary.recurringCommitment, count: vendorSummary.recurringVendors.length };
      } else {
        responseText = `I don't see any fixed recurring SaaS or subscription commitments in your current data.\n\nNext Action: Continue importing data to allow the engine to detect month-over-month patterns.`;
      }
      break;
    }
    
    case 'cost_optimization': {
      responseText = `While I cannot generate external cost-saving benchmarks until Phase 8, looking at your internal data, your largest optimization opportunity lies in reviewing your top vendors (${vendorSummary.topVendors[0]?.normalized_name || 'N/A'}) and your recurring SaaS commitments (${formatReportCurrency(vendorSummary.recurringCommitment)}/mo).\n\nNext Action: Perform a seat audit on your SaaS tools and consolidate overlapping vendors.`;
      sourceJson = { recurring: vendorSummary.recurringCommitment };
      break;
    }
    
    case 'business_advice': {
      responseText = `Based on your internal spend and risks, my advice is to maintain tight control over your operational cash flow. You have ${formatReportCurrency(netCash)} in net cash movement and ${risks.length} pending risks.\n\nOnce Phase 8 is enabled with real AI and market research, I can provide deeper strategic advice on capital efficiency.\n\nNext Action: Clear your Risk Inbox and review your CFO Report.`;
      sourceJson = { netCash, risks: risks.length };
      break;
    }
    
    case 'unsupported_needs_ai_or_web':
    default: {
      responseText = `This specific query requires external market research or deeper contextual reasoning. Phase 8 will connect real AI/web-backed reasoning to handle this. For now, I can analyze your internal spend, recurring commitments, and financial risks.\n\nNext Action: Try asking me about your top vendors, net cash, or open risks.`;
      break;
    }
  }

  return {
    intent,
    text: responseText,
    source_json: sourceJson
  };
}
