import React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Building2,
  ArrowRightLeft,
  ShieldAlert,
  FileText,
  ArrowRight,
} from 'lucide-react';

interface FinanceInsightCardProps {
  content: string;
  intent?: string;
}

export function parseInsightSections(content: string) {
  if (!content) return null;

  const lines = content.split('\n');
  const sections: Record<string, string[]> = {
    summary: [],
    why: [],
    evidence: [],
    actions: [],
  };

  let currentKey = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(
      /^(?:###|\*\*|### \*\*)\s*(Summary|Why|Evidence|Impact|Suggested [aA]ctions|Key [nN]umbers|Risks? [fF]ound|Risks?|Recommended [nN]ext [aA]ctions|Recommended [aA]ctions|Next [aA]ctions)\s*(?::|\*\*|: \*\*|$)/i
    );

    if (headerMatch) {
      const headerTitle = headerMatch[1].toLowerCase();
      if (headerTitle.includes('summary')) {
        currentKey = 'summary';
      } else if (headerTitle.includes('why')) {
        currentKey = 'why';
      } else if (headerTitle.includes('evidence') || headerTitle.includes('impact') || headerTitle.includes('risk') || headerTitle.includes('number')) {
        currentKey = 'evidence';
      } else if (headerTitle.includes('action') || headerTitle.includes('suggested') || headerTitle.includes('next')) {
        currentKey = 'actions';
      } else {
        currentKey = '';
      }
    } else if (currentKey) {
      const cleanedLine = trimmed.replace(/^[-*+•→]\s+/, '').replace(/^###\s+/, '').trim();
      if (cleanedLine) {
        sections[currentKey].push(cleanedLine);
      }
    }
  }

  // If we couldn't parse the minimum sections, return null
  if (sections.summary.length === 0 && sections.why.length === 0 && sections.evidence.length === 0) {
    return null;
  }

  return sections;
}

const FinanceInsightCard: React.FC<FinanceInsightCardProps> = ({ content, intent = '' }) => {
  const sections = parseInsightSections(content);

  if (!sections) return null;

  const lowercaseIntent = intent.toLowerCase();
  const lowercaseContent = content.toLowerCase();

  // 1. Determine Card Type
  let cardType: 'Spend Trend' | 'Vendor Summary' | 'Cash Flow Summary' | 'Risk Summary' | 'Report Summary' = 'Cash Flow Summary';
  let cardIcon = <ArrowRightLeft className="w-4.5 h-4.5 text-[var(--primary)]" />;

  if (
    lowercaseIntent === 'spend_trend' ||
    lowercaseContent.includes('spend changed') ||
    lowercaseContent.includes('expenses changed')
  ) {
    cardType = 'Spend Trend';
    cardIcon = <TrendingUp className="w-4.5 h-4.5 text-[var(--primary)]" />;
  } else if (lowercaseIntent === 'vendor_analysis' || lowercaseIntent === 'recurring_spend' || lowercaseContent.includes('vendor')) {
    cardType = 'Vendor Summary';
    cardIcon = <Building2 className="w-4.5 h-4.5 text-[var(--primary)]" />;
  } else if (lowercaseIntent === 'risk_review' || lowercaseIntent === 'operational_next_steps' || lowercaseContent.includes('risk') || lowercaseContent.includes('flagged')) {
    cardType = 'Risk Summary';
    cardIcon = <ShieldAlert className="w-4.5 h-4.5 text-[var(--danger)]" />;
  } else if (lowercaseIntent === 'reports' || lowercaseIntent === 'readiness' || lowercaseContent.includes('report') || lowercaseContent.includes('readiness')) {
    cardType = 'Report Summary';
    cardIcon = <FileText className="w-4.5 h-4.5 text-[var(--primary)]" />;
  } else if (lowercaseIntent === 'finance_summary' || lowercaseContent.includes('net cash') || lowercaseContent.includes('revenue')) {
    cardType = 'Cash Flow Summary';
    cardIcon = <ArrowRightLeft className="w-4.5 h-4.5 text-[var(--primary)]" />;
  }

  // 2. Extract Key Metric
  // Search the evidence section for the first currency, percentage, or prominent integer figure
  let keyMetric = '';
  const currencyRegex = /(?:₹|Rs\.?|INR|\$)\s*[\d,]+(?:\.\d+)?/i;
  const percentRegex = /\d+(?:\.\d+)?\s*%/;
  const countRegex = /\b\d+\s+(?:transactions|risks|vendors|items|recommendations)\b/i;

  for (const item of sections.evidence) {
    const currencyMatch = item.match(currencyRegex);
    if (currencyMatch) {
      keyMetric = currencyMatch[0];
      break;
    }
    const percentMatch = item.match(percentRegex);
    if (percentMatch) {
      keyMetric = percentMatch[0];
      break;
    }
    const countMatch = item.match(countRegex);
    if (countMatch) {
      keyMetric = countMatch[0];
      break;
    }
  }

  // Filter out the item that became the key metric so it's not duplicated in bullet lists
  const filteredEvidence = keyMetric 
    ? sections.evidence.filter(item => !item.includes(keyMetric))
    : sections.evidence;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
      className="frosted-card border border-border/40 p-5 rounded-2xl w-full flex flex-col gap-4 text-left shadow-sm bg-muted/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/10 pb-2.5">
        <div className="flex items-center gap-2">
          {cardIcon}
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/90">
            {cardType}
          </span>
        </div>
        <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/15 shrink-0">
          Insight
        </span>
      </div>

      {/* Headline & Key Metric Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="space-y-1 flex-1">
          <h3 className="text-sm font-bold text-foreground leading-snug">
            {sections.summary.join(' ')}
          </h3>
        </div>
        {keyMetric && (
          <div className="text-2xl font-black tracking-tight text-[var(--primary)] shrink-0 border-l border-border/10 pl-4">
            {keyMetric}
          </div>
        )}
      </div>

      {/* Explanation */}
      {sections.why.length > 0 && (
        <div className="text-xs text-muted-foreground/90 leading-relaxed bg-muted/5 p-3 rounded-xl border border-border/10">
          {sections.why.join(' ')}
        </div>
      )}

      {/* Evidence Bullets */}
      {filteredEvidence.length > 0 && (
        <ul className="space-y-2">
          {filteredEvidence.map((item, i) => (
            <li key={i} className="text-xs text-foreground/90 font-medium leading-normal flex items-start gap-2">
              <span className="text-[var(--primary)] mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Internal Suggested Actions */}
      {sections.actions.length > 0 && (
        <div className="pt-2 border-t border-border/5 space-y-1.5">
          <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/80">
            Recommended Action
          </div>
          <div className="flex flex-col gap-1.5">
            {sections.actions.slice(0, 2).map((item, i) => (
              <div key={i} className="text-[11px] text-[var(--primary)] font-semibold flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 text-[var(--primary)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FinanceInsightCard;
