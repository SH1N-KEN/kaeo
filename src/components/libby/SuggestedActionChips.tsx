import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  FileText,
  ShieldAlert,
  CreditCard,
  Plus,
} from 'lucide-react';

interface SuggestedActionChipsProps {
  actions: string[];
}

export function extractSuggestedActions(content: string): string[] {
  if (!content) return [];
  const lines = content.split('\n');
  let inActionsSection = false;
  const actions: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for suggested actions section header
    const headerMatch = trimmed.match(
      /^(?:###|\*\*|### \*\*)\s*(Suggested [aA]ctions|Recommended [nN]ext [aA]ctions|Recommended [aA]ctions|Next [aA]ctions)\s*(?::|\*\*|: \*\*|$)/i
    );
    if (headerMatch) {
      inActionsSection = true;
      continue;
    }

    // Stop if we hit any other header
    const otherHeaderMatch = trimmed.match(
      /^(?:###|\*\*|### \*\*)\s*(Summary|Why|Evidence|Key [nN]umbers|Risks? [fF]ound|Risks?|Sources?|Source [tT]ransactions|Impact)\s*(?::|\*\*|: \*\*|$)/i
    );
    if (otherHeaderMatch) {
      inActionsSection = false;
      continue;
    }

    if (inActionsSection) {
      const cleaned = trimmed
        .replace(/^[-*+•→]\s+/, '')
        .replace(/^###\s+/, '')
        .trim();
      if (cleaned) {
        actions.push(cleaned);
      }
    }
  }

  return actions;
}

const SuggestedActionChips: React.FC<SuggestedActionChipsProps> = ({ actions }) => {
  const navigate = useNavigate();

  if (!actions || actions.length === 0) return null;

  // Deep-link routing logic based on keywords
  const handleActionClick = (actionText: string) => {
    const text = actionText.toLowerCase();

    // 1. Transactions page deep links
    if (text.includes('transaction') || text.includes('ledger')) {
      if (text.includes('missing proof') || text.includes('needs receipt') || text.includes('proof')) {
        navigate('/transactions?review_status=missing_proof');
      } else if (text.includes('needs review') || text.includes('pending')) {
        navigate('/transactions?review_status=needs_review');
      } else if (text.includes('uncategorized')) {
        navigate('/transactions?category=uncategorized');
      } else if (text.includes('ai review') || text.includes('ai-review') || text.includes('suggested')) {
        navigate('/transactions?review_status=ai_suggested');
      } else if (text.includes('staff') || text.includes('petty')) {
        navigate('/transactions?review_status=staff_petty');
      } else {
        navigate('/transactions');
      }
      return;
    }

    // 2. Vendors page deep links
    if (text.includes('vendor')) {
      navigate('/vendors');
      return;
    }

    // 3. Reports page deep links
    if (text.includes('report') || text.includes(' accountant pack')) {
      navigate('/reports');
      return;
    }

    // 4. Risk Inbox deep links
    if (text.includes('risk') || text.includes('flagged') || text.includes('anomaly')) {
      navigate('/risk-inbox');
      return;
    }

    // 5. Billing settings deep links
    if (text.includes('upgrade') || text.includes('plan') || text.includes('subscription') || text.includes('billing')) {
      navigate('/billing');
      return;
    }

    // 6. File imports deep links
    if (text.includes('import') || text.includes('upload') || text.includes('statement')) {
      navigate('/files');
      return;
    }

    // Fallback: Default to transactions search or dashboard
    navigate('/dashboard');
  };

  // Icon mapping helper
  const getActionIcon = (actionText: string) => {
    const text = actionText.toLowerCase();
    if (text.includes('transaction') || text.includes('ledger')) return <ArrowRightLeft className="w-3.5 h-3.5" />;
    if (text.includes('vendor')) return <Building2 className="w-3.5 h-3.5" />;
    if (text.includes('report') || text.includes(' accountant pack')) return <FileText className="w-3.5 h-3.5" />;
    if (text.includes('risk') || text.includes('flagged') || text.includes('anomaly') || text.includes('why was')) return <ShieldAlert className="w-3.5 h-3.5" />;
    if (text.includes('upgrade') || text.includes('plan') || text.includes('subscription')) return <CreditCard className="w-3.5 h-3.5" />;
    if (text.includes('import') || text.includes('upload')) return <Plus className="w-3.5 h-3.5" />;
    return <ArrowRight className="w-3.5 h-3.5" />;
  };

  // Container variants for staggered entrance
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.96 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, damping: 20, stiffness: 300 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-border/10 w-full animate-in fade-in duration-200"
    >
      {actions.map((action, idx) => (
        <motion.button
          key={idx}
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleActionClick(action)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-200 cursor-pointer border shadow-sm frosted-card hover:border-[var(--primary)]/35 text-[var(--foreground)]"
          style={{
            background: 'rgba(15,118,110,0.03)',
            borderColor: 'var(--border)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(15,118,110,0.09)';
            e.currentTarget.style.borderColor = 'rgba(15,118,110,0.30)';
            e.currentTarget.style.color = 'var(--primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(15,118,110,0.03)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--foreground)';
          }}
        >
          <span style={{ color: 'var(--primary)', opacity: 0.85 }}>
            {getActionIcon(action)}
          </span>
          {action}
        </motion.button>
      ))}
    </motion.div>
  );
};

export default SuggestedActionChips;
