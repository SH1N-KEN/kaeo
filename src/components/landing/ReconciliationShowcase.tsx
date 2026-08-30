import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Sparkles, Check } from 'lucide-react';

interface TransactionItem {
  id: string;
  source: 'bank' | 'processor';
  narration: string;
  amount: string;
  date: string;
  matchId?: string;
  status: 'reconciled' | 'review' | 'unresolved';
}

export const ReconciliationShowcase: React.FC = () => {
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const [clickedMatchId, setClickedMatchId] = useState<string | null>(null);

  // Bank records
  const bankRecords: TransactionItem[] = [
    { id: 'b1', source: 'bank', narration: 'NEFT CR — RAZORPAY PAYMENTS', amount: '₹125,000', date: 'Feb 02', matchId: 'm1', status: 'reconciled' },
    { id: 'b2', source: 'bank', narration: 'NEFT CR — RAZORPAY PAYMENTS', amount: '₹67,500', date: 'Feb 08', matchId: 'm2', status: 'reconciled' },
    { id: 'b3', source: 'bank', narration: 'NEFT CR — RAZORPAY PAYMENTS', amount: '₹89,000', date: 'Feb 16', matchId: 'm3', status: 'reconciled' },
    { id: 'b4', source: 'bank', narration: 'NEFT CR — RAZORPAY PAYMENTS', amount: '₹97,912', date: 'Feb 22', matchId: 'm4', status: 'review' }
  ];

  // Processor records
  const processorRecords: TransactionItem[] = [
    { id: 'p1', source: 'processor', narration: 'RAZORPAY SETTLEMENT', amount: '₹125,000', date: 'Feb 02', matchId: 'm1', status: 'reconciled' },
    { id: 'p2', source: 'processor', narration: 'RAZORPAY SETTLEMENT', amount: '₹67,500', date: 'Feb 08', matchId: 'm2', status: 'reconciled' },
    { id: 'p3', source: 'processor', narration: 'RAZORPAY SETTLEMENT', amount: '₹89,000', date: 'Feb 16', matchId: 'm3', status: 'reconciled' },
    { id: 'p4', source: 'processor', narration: 'RAZORPAY SETTLEMENT', amount: '₹98,430', date: 'Feb 22', matchId: 'm4', status: 'review' }
  ];

  const handleRowInteraction = (matchId: string, isHover: boolean) => {
    if (isHover) {
      setHoveredMatchId(matchId);
    } else {
      setHoveredMatchId(null);
    }
  };

  const handleRowClick = (matchId: string) => {
    setClickedMatchId(prev => (prev === matchId ? null : matchId));
  };

  return (
    <section 
      id="reconciliation-control"
      className="py-24 px-6 md:px-12 border-y border-[var(--border-subtle)] bg-[#F8F6F2] dark:bg-[#0A0F0E] transition-colors duration-300 relative overflow-hidden"
    >
      {/* CSS Keyframes for pulse flow and styles */}
      <style>{`
        @keyframes pulseFlow {
          0% {
            stroke-dashoffset: 20;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      {/* Background glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-[var(--primary)]/5 to-transparent blur-[120px] pointer-events-none z-0" />

      <div className="max-w-[1280px] mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12 items-center">
          
          {/* LEFT: Copy content */}
          <div className="lg:col-span-5 flex flex-col items-start text-left">
            <span className="text-xs font-mono font-bold tracking-[0.08em] text-[var(--primary)] uppercase mb-4">
              RECONCILIATION CONTROL
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.1] mb-6">
              Two ledgers.<br />One verified truth.
            </h2>
            <p className="text-[15px] md:text-base text-[var(--text-secondary)] leading-relaxed mb-8 max-w-[480px]">
              Kaeo reconciles payment processor settlements against bank records, verifies every match, and surfaces the exceptions that actually need attention.
            </p>
            
            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-6">
              <Link
                to="/reconciliation"
                className="px-6 py-3.5 rounded-full bg-[#138C7E] hover:bg-[#1bb8a6] text-[#080A09] text-[13.5px] font-bold text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(19,140,126,0.3)]"
              >
                Explore Reconciliation
              </Link>
            </div>
            
            {/* Secondary text */}
            <span className="text-[12px] font-mono text-[var(--text-tertiary)] tracking-wide">
              Evidence-backed. AI-assisted. Human-verifiable.
            </span>
          </div>

          {/* RIGHT: Visual Showcase */}
          <div className="lg:col-span-7 w-full">
            
            {/* Macro Engine Outcome Stats */}
            <div className="mb-6 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-card)] flex items-center justify-between gap-4 font-mono text-xs text-[var(--text-secondary)] transition-all duration-300">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#138C7E] animate-pulse" />
                <span className="font-semibold uppercase tracking-wider text-[var(--text-tertiary)] text-[10px]">RECONCILIATION ENGINE</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 bg-[#138C7E]/10 text-[#138C7E] dark:text-[#20B486] dark:bg-[#20B486]/10 px-2 py-1 rounded text-[11px] font-bold">
                  ✓ 5 RECONCILED
                </span>
                <span className="flex items-center gap-1 bg-[var(--warning)]/10 text-[var(--warning)] px-2 py-1 rounded text-[11px] font-bold">
                  ◐ 1 REVIEW
                </span>
                <span className="flex items-center gap-1 bg-[var(--danger)]/10 text-[var(--danger)] px-2 py-1 rounded text-[11px] font-bold">
                  ! 2 UNRESOLVED
                </span>
              </div>
            </div>

            {/* Desktop Visual Convergence Flow */}
            <div className="hidden md:block relative p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
              
              {/* Header tags */}
              <div className="grid grid-cols-12 gap-4 border-b border-[var(--border-subtle)] pb-4 mb-6 text-[10px] font-mono font-bold tracking-wider text-[var(--text-tertiary)]">
                <div className="col-span-5 text-left">BANK LEDGER (SOURCE A)</div>
                <div className="col-span-2 text-center">VERIFICATION</div>
                <div className="col-span-5 text-right font-mono">PAYMENT PROCESSOR (SOURCE B)</div>
              </div>

              {/* Rows stream */}
              <div className="relative space-y-4">
                
                {/* Vertical Spine Track */}
                <div className="absolute top-0 bottom-0 left-[50%] -translate-x-[50%] w-[1px] bg-[var(--border-subtle)] pointer-events-none z-0" />

                {/* Rows mapping */}
                {bankRecords.map((bank, index) => {
                  const proc = processorRecords[index];
                  const matchId = bank.matchId!;
                  const isHovered = hoveredMatchId === matchId;
                  const isClicked = clickedMatchId === matchId;
                  const isRowActive = isHovered || isClicked;
                  const isException = bank.status === 'review';

                  return (
                    <div 
                      key={matchId}
                      className="relative z-10"
                    >
                      <div 
                        onMouseEnter={() => handleRowInteraction(matchId, true)}
                        onMouseLeave={() => handleRowInteraction(matchId, false)}
                        onClick={() => handleRowClick(matchId)}
                        className="grid grid-cols-12 gap-4 items-center p-2 rounded-xl transition-all duration-300 cursor-pointer"
                      >
                        {/* LEFT: Bank Ledger record card */}
                        <div className={`col-span-5 p-3 rounded-lg border transition-all duration-300 text-left bg-[var(--surface-elevated)] ${
                          isRowActive 
                            ? isException 
                              ? 'border-[var(--danger)]/50 shadow-[0_2px_8px_rgba(224,82,82,0.06)]' 
                              : 'border-[#138C7E]/50 shadow-[0_2px_8px_rgba(19,140,126,0.06)]'
                            : 'border-[var(--border-subtle)] hover:border-[var(--border)]'
                        }`}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-semibold text-[var(--text-primary)] font-sans">{bank.amount}</span>
                            <span className="text-[10px] font-mono text-[var(--text-secondary)] tracking-wide overflow-hidden text-ellipsis whitespace-nowrap w-full text-left">{bank.narration}</span>
                            <span className="text-[9px] font-mono text-[var(--text-tertiary)]">{bank.date}</span>
                          </div>
                        </div>

                        {/* CENTER: Status Node & SVG lines */}
                        <div className="col-span-2 h-full flex items-center justify-center relative min-h-[64px]">
                          {/* SVG Flow Lines */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                            {/* Left to center line */}
                            <path
                              d="M 0, 32 L 28, 32"
                              className={`transition-all duration-300 stroke-[1.5px] fill-none ${
                                isRowActive
                                  ? isException
                                    ? 'stroke-[var(--danger)]'
                                    : 'stroke-[#138C7E]'
                                  : 'stroke-[var(--border)]'
                              }`}
                              style={{
                                strokeDasharray: isRowActive ? '4 4' : 'none',
                                animation: isRowActive ? 'pulseFlow 1s linear infinite' : 'none'
                              }}
                            />
                            {/* Right to center line */}
                            <path
                              d="M 100%, 32 L calc(100% - 28px), 32"
                              className={`transition-all duration-300 stroke-[1.5px] fill-none ${
                                isRowActive
                                  ? isException
                                    ? 'stroke-[var(--danger)]'
                                    : 'stroke-[#138C7E]'
                                  : 'stroke-[var(--border)]'
                              }`}
                              style={{
                                strokeDasharray: isRowActive ? '4 4' : 'none',
                                animation: isRowActive ? 'pulseFlow 1s linear infinite' : 'none'
                              }}
                            />
                          </svg>

                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border z-10 transition-all duration-300 bg-[var(--surface)] ${
                            isRowActive
                              ? isException
                                ? 'border-[var(--danger)] text-[var(--danger)] scale-110 shadow-[0_0_12px_rgba(224,82,82,0.25)]'
                                : 'border-[#138C7E] text-[#138C7E] scale-110 shadow-[0_0_12px_rgba(19,140,126,0.25)]'
                              : 'border-[var(--border)] text-[var(--text-tertiary)]'
                          }`}>
                            {isException ? (
                              <span className="text-xs font-bold font-mono">◐</span>
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </div>

                          {/* Hover Evidence Tooltip */}
                          {isRowActive && (
                            <div 
                              className={`absolute bottom-full mb-3 z-50 p-4 rounded-xl border shadow-[var(--shadow-popover)] w-56 text-[11px] leading-relaxed text-left font-sans bg-[var(--surface-elevated)] animate-[kaeo-scale-in_0.15s_ease_forwards] ${
                                isException ? 'border-[var(--danger)]/30' : 'border-[var(--border)]'
                              }`}
                            >
                              {!isException ? (
                                <div className="space-y-1.5">
                                  <div className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#138C7E]" />
                                    <span>Match Confirmed</span>
                                  </div>
                                  <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                    <span className="text-[#138C7E]">✓</span> Amount aligned
                                  </div>
                                  <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                    <span className="text-[#138C7E]">✓</span> Settlement date aligned
                                  </div>
                                  <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                    <span className="text-[#138C7E]">✓</span> Reference aligned
                                  </div>
                                  <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                    <span className="text-[#138C7E]">✓</span> Verification passed
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="font-semibold text-[var(--danger)] mb-2 flex items-center gap-1.5">
                                    <span className="text-xs">◐</span>
                                    <span>Variance Detected</span>
                                  </div>
                                  <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                    <span className="text-[var(--danger)]">⚠</span> Amount variance (₹518)
                                  </div>
                                  <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                    <span className="text-[var(--danger)]">⚠</span> Requires review
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* RIGHT: Processor Settlement record card */}
                        <div className={`col-span-5 p-3 rounded-lg border transition-all duration-300 text-right bg-[var(--surface-elevated)] ${
                          isRowActive 
                            ? isException 
                              ? 'border-[var(--danger)]/50 shadow-[0_2px_8px_rgba(224,82,82,0.06)]' 
                              : 'border-[#138C7E]/50 shadow-[0_2px_8px_rgba(19,140,126,0.06)]'
                            : 'border-[var(--border-subtle)] hover:border-[var(--border)]'
                        }`}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-semibold text-[var(--text-primary)] font-sans">{proc.amount}</span>
                            <span className="text-[10px] font-mono text-[var(--text-secondary)] tracking-wide overflow-hidden text-ellipsis whitespace-nowrap w-full text-right font-sans">{proc.narration}</span>
                            <span className="text-[9px] font-mono text-[var(--text-tertiary)]">{proc.date}</span>
                          </div>
                        </div>

                      </div>

                      {/* Exception details (subordinate AI element) */}
                      {isException && (
                        <div className="mt-2.5 mx-2 p-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] transition-all duration-300 text-left">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-[var(--border-subtle)]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[var(--text-secondary)] font-mono">DISCREPANCY OVERVIEW</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-[var(--text-secondary)] font-mono">{bank.amount} (Bank)</span>
                              <span className="text-[var(--text-tertiary)]">vs</span>
                              <span className="text-[var(--text-secondary)] font-mono">{proc.amount} (Processor)</span>
                              <span className="text-[var(--danger)] font-mono font-bold bg-[var(--danger)]/10 px-1.5 py-0.5 rounded ml-1">Diff ₹518</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 p-1 rounded-lg bg-[#138C7E]/10 border border-[#138C7E]/20 text-[#138C7E] flex-shrink-0">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-extrabold text-[var(--text-primary)]">Kaeo AI</span>
                                <span className="text-[9.5px] font-bold font-mono tracking-wider bg-[var(--warning)]/10 text-[var(--warning)] px-2 py-0.5 rounded border border-[var(--warning)]/20 uppercase">PROBABLE PROCESSOR FEE</span>
                                <span className="text-[9.5px] font-mono text-[var(--text-tertiary)] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 rounded">94% confidence</span>
                                <span className="text-[9.5px] font-mono text-[var(--text-tertiary)] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 rounded">Evidence verified</span>
                              </div>
                              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                                Difference matches standard transaction processor fee structures for domestic credit cards. Human review required.
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-tertiary)] pt-1">
                                <span className="text-[#138C7E]">●</span> AI investigates. Controls verify.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Visual Convergence Flow (Stacked list) */}
            <div className="block md:hidden space-y-4">
              <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-tertiary)] text-left mb-2">
                VERIFIED TRANSACTIONS
              </div>
              
              {bankRecords.map((bank, index) => {
                const proc = processorRecords[index];
                const matchId = bank.matchId!;
                const isException = bank.status === 'review';
                const isClicked = clickedMatchId === matchId;

                return (
                  <div 
                    key={matchId}
                    onClick={() => handleRowClick(matchId)}
                    className={`p-4 rounded-xl border transition-all duration-300 text-left bg-[var(--surface)] shadow-[var(--shadow-card)] cursor-pointer ${
                      isClicked 
                        ? isException 
                          ? 'border-[var(--danger)]/50 bg-[var(--danger)]/[0.01]' 
                          : 'border-[#138C7E]/50 bg-[#138C7E]/[0.01]'
                        : 'border-[var(--border-subtle)]'
                    }`}
                  >
                    {/* Header tags */}
                    <div className="flex justify-between items-center gap-2 mb-3 pb-2 border-b border-[var(--border-subtle)]">
                      <span className="text-[9px] font-mono font-bold tracking-wider text-[var(--text-tertiary)]">
                        {bank.date} · {isException ? 'EXCEPTION' : 'RECONCILED'}
                      </span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[9px] font-bold ${
                        isException ? 'border-[var(--danger)] text-[var(--danger)] bg-[var(--danger)]/5' : 'border-[#138C7E] text-[#138C7E] bg-[#138C7E]/5'
                      }`}>
                        {isException ? '◐' : '✓'}
                      </div>
                    </div>

                    {/* Stacking side-by-side ledger entries */}
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[10px] font-mono text-[var(--text-tertiary)]">BANK RECORD</div>
                          <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">{bank.amount}</div>
                          <div className="text-[9.5px] font-mono text-[var(--text-secondary)] line-clamp-1 mt-0.5 text-left">{bank.narration}</div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <div className="text-[10px] font-mono text-[var(--text-tertiary)]">PROCESSOR</div>
                          <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">{proc.amount}</div>
                          <div className="text-[9.5px] font-mono text-[var(--text-secondary)] line-clamp-1 mt-0.5 text-right">{proc.narration}</div>
                        </div>
                      </div>

                      {/* Expandable/always-visible details */}
                      {isClicked && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] font-sans text-[11px] text-[var(--text-secondary)] space-y-2">
                          {!isException ? (
                            <>
                              <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold mb-1">
                                <span className="text-[#138C7E]">✓</span> Match Confirmed
                              </div>
                              <div>• Amount & settlement dates align</div>
                              <div>• Core business references passed control gates</div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5 text-[var(--danger)] font-semibold mb-1">
                                <span>◐</span> Discrepancy Found
                              </div>
                              <div className="mb-2">Variance: <span className="font-mono font-bold text-[var(--text-primary)]">₹518</span> difference detected.</div>
                              
                              {/* AI Box */}
                              <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-dashed border-[var(--border)] space-y-2 text-left">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-[var(--text-primary)]">Kaeo AI</span>
                                  <span className="text-[9px] font-bold font-mono bg-[var(--warning)]/10 text-[var(--warning)] px-1.5 py-0.5 rounded border border-[var(--warning)]/20 uppercase">PROBABLE PROCESSOR FEE</span>
                                  <span className="text-[9px] font-mono text-[var(--text-tertiary)] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded">94% confidence</span>
                                  <span className="text-[9px] font-mono text-[var(--text-tertiary)] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded">Evidence verified</span>
                                </div>
                                <p className="text-[10.5px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                                  Fee analysis matches normal domestic processor tariff. Human review required.
                                </p>
                                <div className="text-[9.5px] font-mono text-[var(--text-tertiary)] pt-1 flex items-center gap-1">
                                  <span className="text-[#138C7E]">●</span> AI investigates. Controls verify.
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {!isClicked && (
                        <div className="text-center pt-2 text-[9px] font-mono text-[var(--text-tertiary)] border-t border-[var(--border-subtle)]/50">
                          Tap card to view verification details
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};
