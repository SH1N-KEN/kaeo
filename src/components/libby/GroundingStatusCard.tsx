import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  Database,
  Building2,
  Inbox,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SourceJson {
  mode?: string;
  intent?: string;
  grounding_status?: 'verified' | 'based_on_data' | 'general' | string;
  ai_confidence?: 'high' | 'medium' | 'low' | string;
  caveats?: string[];
  needs_external_research?: boolean;
  transactionCount?: number;
  uploads?: string[];
  risksCount?: number;
  vendorsCount?: number;
  hasIncompleteData?: boolean;
  [key: string]: any;
}

interface GroundingStatusCardProps {
  sourceJson?: SourceJson;
}

const GroundingStatusCard: React.FC<GroundingStatusCardProps> = ({ sourceJson }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!sourceJson) return null;

  const txCount = sourceJson.transactionCount ?? 0;
  const uploads = sourceJson.uploads ?? [];
  const mode = sourceJson.mode ?? 'deterministic';
  const groundingStatus = sourceJson.grounding_status ?? 'based_on_data';
  const intent = sourceJson.intent ?? '';

  // Determine Confidence and Reason dynamically
  let confidence: 'High' | 'Medium' | 'Low' = 'High';
  let reason = '';
  const missingUploads = uploads.length === 0;

  if (txCount === 0) {
    confidence = 'Low';
    reason = 'No ledger transactions are available in this client workspace.';
  } else if (missingUploads) {
    confidence = 'Low';
    reason = 'No bank statements have been uploaded to ground the ledger.';
  } else if (groundingStatus === 'general' || sourceJson.needs_external_research) {
    confidence = 'Medium';
    reason = 'Supported by ledger data, but incorporates general external marketplace context.';
  } else if (mode === 'deterministic') {
    confidence = 'High';
    reason = 'Directly computed from verified ledger database records.';
  } else {
    confidence = 'High';
    reason = 'AI-assisted analysis fully grounded in current ledger database records.';
  }

  // Define badges styling
  const confStyles = {
    High: {
      bg: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
      dot: 'bg-emerald-400',
      label: 'High Confidence',
    },
    Medium: {
      bg: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
      dot: 'bg-amber-400',
      label: 'Medium Confidence',
    },
    Low: {
      bg: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
      dot: 'bg-rose-400',
      label: 'Low Confidence',
    },
  };

  const style = confStyles[confidence];

  // Helper to compile active sources
  const activeSources: { label: string; icon: React.ReactNode }[] = [];

  if (txCount > 0) {
    activeSources.push({
      label: `${txCount} Transaction${txCount !== 1 ? 's' : ''}`,
      icon: <Database className="w-3 h-3 text-[var(--primary)]" />,
    });
  }

  // Add uploaded statement filenames
  if (uploads.length > 0) {
    // Show up to 2 statement names, or format nicely
    uploads.slice(0, 2).forEach(filename => {
      // Strip directory path or long extensions
      const cleanName = filename.replace(/^.*[\\/]/, '').split('.')[0];
      activeSources.push({
        label: cleanName,
        icon: <FileSpreadsheet className="w-3 h-3 text-teal-400" />,
      });
    });
    if (uploads.length > 2) {
      activeSources.push({
        label: `+ ${uploads.length - 2} more files`,
        icon: <FileSpreadsheet className="w-3 h-3 text-teal-400" />,
      });
    }
  }

  // Intent-specific source checks
  const isRiskIntent = intent.includes('risk') || sourceJson.risksCount !== undefined;
  if (isRiskIntent) {
    activeSources.push({
      label: 'Risk Inbox',
      icon: <Inbox className="w-3 h-3 text-[var(--primary)]" />,
    });
  }

  const isVendorIntent = intent.includes('vendor') || sourceJson.vendorsCount !== undefined;
  if (isVendorIntent) {
    activeSources.push({
      label: 'Vendor Summary',
      icon: <Building2 className="w-3 h-3 text-[var(--primary)]" />,
    });
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-border/10 w-full animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer"
        >
          <Sparkles className="w-2.5 h-2.5 text-[var(--primary)]" />
          <span>Grounded · {style.label}</span>
          {isOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
        </button>

        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${style.bg}`}>
          <span className={`w-1 h-1 rounded-full ${style.dot} animate-pulse`} />
          {confidence}
        </span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-2.5 rounded-xl border border-border/20 bg-muted/10 space-y-2 text-left">
              {/* Reason */}
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Reason:</span> {reason}
              </div>

              {/* Warnings / Incomplete alerts */}
              {confidence === 'Low' && (
                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/15 text-[9px] text-rose-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    {missingUploads
                      ? 'Confidence is reduced due to missing bank statement uploads.'
                      : 'Confidence is reduced due to missing or unpopulated transaction records.'}
                  </span>
                </div>
              )}

              {/* Based On tags */}
              {activeSources.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                    Based on:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeSources.map((src, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.7 rounded-md text-[9px] font-medium border bg-muted/30 border-border/40 text-foreground"
                      >
                        {src.icon}
                        <span>{src.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroundingStatusCard;
