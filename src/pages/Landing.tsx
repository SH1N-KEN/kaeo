import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { KaeoLandingHeader } from '../components/landing/KaeoLandingHeader';
import { KaeoHero } from '../components/landing/KaeoHero';
import { motion } from 'framer-motion';
import aeLogo from '../assets/kaeo-ae-logo.png';

/* ═══════════════════════════════════════════════
   SECTION LABEL COMPONENT
═══════════════════════════════════════════════ */
const SectionLabel = ({ code, label }: { code: string; label: string }) => (
  <div style={{ color: '#2FB8A6', fontFamily: 'ui-monospace, monospace', fontSize: '11px', letterSpacing: '0.08em', marginBottom: '16px', textTransform: 'uppercase' as const, fontWeight: 500 }}>
    {code} — {label}
  </div>
);

/* ═══════════════════════════════════════════════
   HOW IT WORKS — STEP CARD
═══════════════════════════════════════════════ */
const StepCard = ({
  num, label, title, description, visual,
}: {
  num: string; label: string; title: string; description: string; visual: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    style={{
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '16px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
      <span style={{
        fontStyle: 'italic',
        color: '#2FB8A6',
        fontSize: '40px',
        lineHeight: '0.85',
        letterSpacing: '-0.04em',
        fontWeight: 700,
      }}>{num}</span>
      <span style={{
        color: '#2FB8A6',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '10px',
        letterSpacing: '0.10em',
        textTransform: 'uppercase' as const,
        fontWeight: 600,
      }}>{label}</span>
    </div>
    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#E8F0EE', letterSpacing: '-0.02em', margin: 0 }}>{title}</h3>
    <p style={{ fontSize: '14px', color: 'rgba(232,240,238,0.50)', lineHeight: 1.6, margin: 0 }}>{description}</p>
    <div style={{
      background: '#0D1714',
      border: '1px solid rgba(47,184,166,0.12)',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '4px',
    }}>
      {visual}
    </div>
  </motion.div>
);

/* ── Step visuals ─────────────────────────────── */
const UploadVisual = () => (
  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
    {['hdfc_statement_apr26.xlsx', 'axis_q4_fy26.csv', 'vendor_invoices.pdf'].map((f, i) => (
      <div key={i} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '7px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontSize: '11px', color: 'rgba(232,240,238,0.65)', fontFamily: 'ui-monospace, monospace' }}>{f}</span>
        <span style={{ fontSize: '9px', color: '#2FB8A6', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>✓ ready</span>
      </div>
    ))}
  </div>
);

const MapVisual = () => (
  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '6px', fontSize: '11px' }}>
    {[
      { target: 'Transaction Date', source: 'Value Date', status: 'mapped' },
      { target: 'Description', source: 'Narration / Description', status: 'mapped' },
      { target: 'Debit', source: 'Withdrawal Amt (INR)', status: 'mapped' },
      { target: 'Credit', source: 'Deposit Amt (INR)', status: 'mapped' },
    ].map((row, i) => (
      <div key={i} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '7px',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.65)', fontWeight: 600 }}>{row.target}</span>
          <span style={{ fontSize: '9px', color: '#2FB8A6', fontFamily: 'ui-monospace, monospace' }}>← {row.source}</span>
        </div>
        <span style={{ fontSize: '8px', color: '#2FB8A6', background: 'rgba(47,184,166,0.10)', border: '1px solid rgba(47,184,166,0.20)', borderRadius: '4px', padding: '2px 6px', fontWeight: 700, textTransform: 'uppercase' }}>{row.status}</span>
      </div>
    ))}
  </div>
);

const ReviewVisual = () => (
  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '5px' }}>
    {[
      { title: 'Duplicate suspect', type: 'Duplicate payment', amount: '₹75,000', severity: 'critical', sColor: '#E05450' },
      { title: 'High-value outflow', type: 'High-value payment', amount: '₹1,24,000', severity: 'high', sColor: '#E05450' },
      { title: 'Unmapped UPI payee', type: 'Uncategorized', amount: '₹18,500', severity: 'medium', sColor: '#D4922A' },
    ].map((item, i) => (
      <div key={i} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 10px',
        background: 'rgba(224, 84, 80, 0.03)',
        borderRadius: '7px',
        border: `1px solid ${item.severity === 'medium' ? 'rgba(212,146,42,0.15)' : 'rgba(224,84,80,0.15)'}`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
          <span style={{ fontSize: '10px', color: '#E8F0EE', fontWeight: 600 }}>{item.title}</span>
          <span style={{ fontSize: '9px', color: 'rgba(232,240,238,0.40)' }}>{item.type}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: item.sColor, fontFamily: 'ui-monospace, monospace' }}>{item.amount}</div>
          <span style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', color: item.sColor }}>{item.severity}</span>
        </div>
      </div>
    ))}
  </div>
);

const ExplainVisual = () => (
  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ background: 'rgba(47,184,166,0.15)', borderRadius: '10px 10px 2px 10px', padding: '8px 12px', fontSize: '12px', color: '#E8F0EE', maxWidth: '80%' }}>
        Why is this ₹1,24,000 payment flagged?
      </div>
    </div>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(47,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2FB8A6', display: 'inline-block', boxShadow: '0 0 5px rgba(47,184,166,0.5)' }} />
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px 10px 10px 10px', padding: '8px 12px', fontSize: '11px', color: 'rgba(232,240,238,0.65)', lineHeight: 1.5, flex: 1 }}>
        This outflow to <strong style={{ color: '#E8F0EE' }}>Mumbai Supplies Pvt Ltd</strong> is <span style={{ color: '#D4922A' }}>3.2× above</span> your average vendor payment this quarter. Recommend reviewing invoice before clearing.
      </div>
    </div>
  </div>
);

const ExportVisual = () => (
  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
    {[
      { label: 'Finance Review Pack · Apr 2026', type: 'PDF', ready: true },
      { label: 'Transaction Ledger · Apr 2026', type: 'CSV', ready: true },
      { label: 'Risk Summary Report', type: 'PDF', ready: false },
    ].map((item, i) => (
      <div key={i} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '7px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#E8F0EE', fontWeight: 500 }}>{item.label}</div>
          <div style={{ fontSize: '9px', color: 'rgba(232,240,238,0.35)', fontFamily: 'ui-monospace, monospace', marginTop: '1px' }}>{item.type}</div>
        </div>
        <span style={{
          fontSize: '9px', fontWeight: 700, fontFamily: 'ui-monospace, monospace',
          padding: '3px 8px', borderRadius: '4px',
          background: item.ready ? 'rgba(47,184,166,0.12)' : 'rgba(255,255,255,0.05)',
          color: item.ready ? '#2FB8A6' : 'rgba(232,240,238,0.35)',
          border: `1px solid ${item.ready ? 'rgba(47,184,166,0.22)' : 'rgba(255,255,255,0.08)'}`,
        }}>{item.ready ? '↓ Export' : 'Pending'}</span>
      </div>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════
   CATCH CARD
═══════════════════════════════════════════════ */
const CatchCard = ({ title, description, example }: { title: string; description: string; example: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    style={{
      background: '#0D1714',
      border: '1px solid rgba(47,184,166,0.10)',
      borderRadius: '14px',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '10px',
      transition: 'border-color 0.2s ease',
    }}
    className="catch-card"
  >
    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#E8F0EE', margin: 0, letterSpacing: '-0.01em' }}>{title}</h4>
    <p style={{ fontSize: '13px', color: 'rgba(232,240,238,0.50)', lineHeight: 1.55, margin: 0 }}>{description}</p>
    <div style={{
      fontFamily: 'ui-monospace, monospace',
      fontSize: '11px',
      color: '#2FB8A6',
      background: 'rgba(47,184,166,0.07)',
      border: '1px solid rgba(47,184,166,0.14)',
      borderRadius: '6px',
      padding: '6px 10px',
      marginTop: '2px',
    }}>
      {example}
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════════
   REPORT MOCK
═══════════════════════════════════════════════ */
const ReportMock = () => (
  <div style={{
    background: '#080E0C',
    border: '1px solid rgba(47,184,166,0.14)',
    borderRadius: '16px',
    overflow: 'hidden',
    fontFamily: 'inherit',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  }}>
    {/* Header */}
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 20px',
      background: 'rgba(47,184,166,0.06)',
      borderBottom: '1px solid rgba(47,184,166,0.10)',
    }}>
      <div>
        <div style={{ fontSize: '11px', color: 'rgba(232,240,238,0.40)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em', marginBottom: '2px' }}>KAEO · FINANCE REVIEW PACK</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#E8F0EE', letterSpacing: '-0.02em', fontStyle: 'italic' }}>April 2026</div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <span style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'rgba(232,240,238,0.50)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>CSV</span>
        <span style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '6px', background: '#2FB8A6', color: '#050F0D', fontWeight: 700 }}>PDF Export</span>
      </div>
    </div>

    {/* Summary stats */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
      {[
        { label: 'Money In', value: '+₹12,80,400', color: '#22B573' },
        { label: 'Money Out', value: '−₹8,42,200', color: '#E05450' },
        { label: 'Open Risks', value: '3 items', color: '#D4922A' },
      ].map((stat, i) => (
        <div key={i} style={{ padding: '16px 18px', background: '#080E0C' }}>
          <div style={{ fontSize: '10px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, monospace', marginBottom: '6px' }}>{stat.label}</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: stat.color, letterSpacing: '-0.02em', fontFamily: 'ui-monospace, monospace' }}>{stat.value}</div>
        </div>
      ))}
    </div>

    {/* Transaction rows */}
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: '11px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, monospace', marginBottom: '10px' }}>Review-ready transactions</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px' }}>
        <thead>
          <tr>
            {['Date', 'Description', 'Category', 'Amount', 'Status'].map((h) => (
              <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(232,240,238,0.30)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, monospace', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { date: '28 Apr', desc: 'Razorpay Settlement', cat: 'Inflow / Revenue', amount: '+₹4,80,000', status: 'Verified', sColor: '#22B573', aColor: '#22B573' },
            { date: '26 Apr', desc: 'Mumbai Supplies Pvt Ltd', cat: 'Vendor Payment', amount: '−₹1,24,000', status: 'Needs review', sColor: '#D4922A', aColor: '#E05450' },
            { date: '25 Apr', desc: 'UPI/Unknown Narration', cat: 'Uncategorized', amount: '−₹18,500', status: 'Flagged', sColor: '#E05450', aColor: '#E05450' },
            { date: '22 Apr', desc: 'HDFC Bank Interest', cat: 'Bank Income', amount: '+₹2,840', status: 'Verified', sColor: '#22B573', aColor: '#22B573' },
          ].map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '9px 8px', color: 'rgba(232,240,238,0.40)', fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>{row.date}</td>
              <td style={{ padding: '9px 8px', color: '#E8F0EE', fontWeight: 500 }}>{row.desc}</td>
              <td style={{ padding: '9px 8px' }}>
                <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(47,184,166,0.08)', color: '#2FB8A6', border: '1px solid rgba(47,184,166,0.14)', fontWeight: 600 }}>{row.cat}</span>
              </td>
              <td style={{ padding: '9px 8px', color: row.aColor, fontWeight: 700, fontFamily: 'ui-monospace, monospace', fontSize: '11px', textAlign: 'right' as const }}>{row.amount}</td>
              <td style={{ padding: '9px 8px', textAlign: 'center' as const }}>
                <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', background: `${row.sColor}18`, color: row.sColor, border: `1px solid ${row.sColor}28`, fontWeight: 700, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }}>{row.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(47,184,166,0.06)', borderRadius: '8px', border: '1px solid rgba(47,184,166,0.12)', fontSize: '12px', color: 'rgba(232,240,238,0.55)' }}>
        <span style={{ color: '#2FB8A6', fontWeight: 600 }}>11 uncategorized rows</span> and <span style={{ color: '#D4922A', fontWeight: 600 }}>2 vendor payment notes</span> need your review before this report is accountant-ready.
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   LIBBY CHAT MOCK
═══════════════════════════════════════════════ */
const LibbyChatMock = () => (
  <div style={{
    background: '#080E0C',
    border: '1px solid rgba(47, 184, 166, 0.14)',
    borderRadius: '16px',
    padding: '20px',
    fontFamily: 'inherit',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2FB8A6', boxShadow: '0 0 8px #2FB8A6' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#E8F0EE' }}>Ask Libby</span>
      </div>
      <span style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em', color: 'rgba(232, 240, 238, 0.35)', textTransform: 'uppercase' as const, fontWeight: 600 }}>Your Kaeo data · Apr 2026</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: 'rgba(47,184,166,0.15)', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: '13px', color: '#E8F0EE', maxWidth: '80%', lineHeight: 1.5 }}>
          Which vendor is taking most of my spend this month?
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(47,184,166,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2FB8A6', display: 'inline-block', boxShadow: '0 0 6px rgba(47,184,166,0.45)' }} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px 12px 12px 12px', padding: '12px 14px', fontSize: '13px', color: 'rgba(232,240,238,0.65)', lineHeight: 1.6, flex: 1 }}>
          Based on your uploaded statements: <strong style={{ color: '#E8F0EE' }}>Mumbai Supplies Pvt Ltd</strong> accounts for <span style={{ color: '#D4922A', fontWeight: 700 }}>₹1,24,000</span> — your largest single vendor outflow this period. This is <span style={{ color: '#D4922A' }}>3.2× above</span> your April average.
          <br /><br />
          <span style={{ color: '#2FB8A6' }}>2 other payments to this vendor in March</span> suggest a recurring relationship worth reviewing.
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: 'rgba(47,184,166,0.15)', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: '13px', color: '#E8F0EE', maxWidth: '80%', lineHeight: 1.5 }}>
          Is my report ready to send to my CA?
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(47,184,166,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2FB8A6', display: 'inline-block', boxShadow: '0 0 6px rgba(47,184,166,0.45)' }} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px 12px 12px 12px', padding: '12px 14px', fontSize: '13px', color: 'rgba(232,240,238,0.65)', lineHeight: 1.6, flex: 1 }}>
          Not yet — <span style={{ color: '#D4922A', fontWeight: 600 }}>11 rows are uncategorized</span> and <span style={{ color: '#E05450', fontWeight: 600 }}>1 duplicate payment needs your confirmation</span>. Once you resolve those, report readiness will reach 100%.
        </div>
      </div>
    </div>
    <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(47,184,166,0.06)', border: '1px solid rgba(47,184,166,0.14)', borderRadius: '8px', fontSize: '11px', color: 'rgba(232,240,238,0.40)', lineHeight: 1.5, fontStyle: 'italic' }}>
      AI-assisted explanations are being built into the review workflow. Libby explains patterns from your data — it does not file returns or replace your CA.
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   MAIN LANDING PAGE
═══════════════════════════════════════════════ */

export const Landing: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (location.state && (location.state as { scrollTo?: string }).scrollTo) {
      const targetId = (location.state as { scrollTo: string }).scrollTo;
      setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          const headerOffset = 72;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      }, 100);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const S = {
    // Page wrapper
    page: {
      background: '#050F0D',
      color: '#E8F0EE',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      minHeight: '100vh',
    } as React.CSSProperties,

    // Section container
    section: (bg?: string): React.CSSProperties => ({
      padding: '100px 48px',
      background: bg ?? '#050F0D',
      borderTop: '1px solid rgba(47,184,166,0.08)',
    }),

    // Inner max-width wrapper
    inner: {
      maxWidth: '1280px',
      margin: '0 auto',
      width: '100%',
    } as React.CSSProperties,

    // Section heading
    h2: {
      fontWeight: 700,
      fontSize: 'clamp(32px, 4vw, 54px)',
      letterSpacing: '-0.03em',
      lineHeight: 1.1,
      margin: '0 0 20px',
      color: '#E8F0EE',
    } as React.CSSProperties,

    // Italic teal accent span
    accent: {
      fontFamily: '"Instrument Serif", serif',
      fontStyle: 'italic',
      fontWeight: 400,
      color: '#2FB8A6',
      textTransform: 'none',
    } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      <KaeoLandingHeader />

      {/* ═══════ 001 — HERO ═══════ */}
      <div id="product">
        <KaeoHero />
      </div>

      {/* ═══════ 002 — HOW IT WORKS ═══════ */}
      <section id="how-it-works" style={S.section('#050F0D')}>
        <div style={S.inner}>
          <SectionLabel code="002" label="HOW IT WORKS" />
          <h2 style={S.h2}>
            From upload to <span style={S.accent}>review-ready</span> in minutes.
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(232,240,238,0.45)', maxWidth: '540px', marginBottom: '60px', lineHeight: 1.6 }}>
            No formatting, no pivot tables, no manual categorization. Kaeo handles the cleanup so you can focus on the review.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '32px',
          }}>
            <StepCard
              num="01" label="Upload"
              title="Drop your statements"
              description="Upload CSV or XLSX bank statements from HDFC, ICICI, Axis, or any Indian bank. Invoices and Razorpay exports too."
              visual={<UploadVisual />}
            />
            <StepCard
              num="02" label="Map"
              title="Kaeo detects everything"
              description="Dates, narrations, debits, credits, balances, UPI references, vendors, and categories — auto-detected with confidence scoring."
              visual={<MapVisual />}
            />
            <StepCard
              num="03" label="Review"
              title="Flag what needs attention"
              description="Uncategorized rows, high-value payments, duplicate suspects, and balance mismatches surface for your review."
              visual={<ReviewVisual />}
            />
            <StepCard
              num="04" label="Explain"
              title="Ask Libby for context"
              description="When a transaction looks odd, ask Libby for guided context — patterns, vendor history, and risk signals from your data."
              visual={<ExplainVisual />}
            />
            <StepCard
              num="05" label="Export"
              title="Send to your accountant"
              description="Generate accountant-ready finance review packs and clean transaction ledgers. Ready to share, no manual formatting required."
              visual={<ExportVisual />}
            />
          </div>
        </div>
      </section>

      {/* ═══════ 003 — WHAT KAEO CATCHES ═══════ */}
      <section id="what-kaeo-catches" style={S.section('#0A1410')}>
        <div style={S.inner}>
          <SectionLabel code="003" label="WHAT KAEO CATCHES" />
          <h2 style={S.h2}>
            The messy finance checks <span style={S.accent}>most teams miss.</span>
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(232,240,238,0.45)', maxWidth: '520px', marginBottom: '56px', lineHeight: 1.6 }}>
            Not theoretical risks. Actual patterns that surface when you properly parse Indian bank statements.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            <CatchCard
              title="Duplicate payments"
              description="Same vendor, same amount, close date — often from double-clicking payment portals or failed gateway retries."
              example="₹75,000 × 2 → Slack Technologies · 12 Apr"
            />
            <CatchCard
              title="High-value outflows"
              description="Single large debits that deviate significantly from your vendor payment patterns. Worth a second look before month close."
              example="₹1,24,000 → Mumbai Supplies · 3.2× above avg"
            />
            <CatchCard
              title="Uncategorized spend"
              description="Transactions with cryptic UPI narrations or generic NEFT descriptions that don't map to a known vendor or category."
              example="11 rows → UPI/Unknown/various · needs mapping"
            />
            <CatchCard
              title="Vendor concentration"
              description="One vendor consuming a disproportionate share of your monthly outflow — a supply chain or negotiation flag."
              example="62% of Apr outflow → 3 vendor accounts"
            />
            <CatchCard
              title="Invoice / payment mismatch"
              description="Invoice amount doesn't match the bank debit for the same vendor — partial payments, rounding errors, or billing discrepancies."
              example="Invoice ₹48,200 vs. debit ₹50,610 · tax discrepancy"
            />
            <CatchCard
              title="Balance movement mismatch"
              description="Closing balance from your statement doesn't match the running total from parsed transactions — missing rows or import errors."
              example="₹8,400 gap → closing balance vs. transaction sum"
            />
          </div>
        </div>
      </section>

      {/* ═══════ 004 — BUILT FOR INDIA ═══════ */}
      <section style={S.section('#050F0D')}>
        <div style={S.inner}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '80px', alignItems: 'center' }} className="india-grid">
            <div>
              <SectionLabel code="004" label="BUILT FOR INDIA" />
              <h2 style={S.h2}>
                Designed around Indian SME <span style={S.accent}>finance workflows.</span>
              </h2>
              <p style={{ fontSize: '16px', color: 'rgba(232,240,238,0.50)', lineHeight: 1.65, marginBottom: '36px', maxWidth: '460px' }}>
                Indian bank statements don't follow a clean standard. UPI narrations are cryptic. NEFT/RTGS rows mix metadata. Kaeo is built to handle all of it without you having to pre-clean anything.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
                {[
                  { label: 'Bank statement formats', detail: 'HDFC · ICICI · Axis · SBI · Kotak and more' },
                  { label: 'UPI narration parsing', detail: 'Maps cryptic UPI references to vendors and categories' },
                  { label: 'Vendor payment tracking', detail: 'Identify recurring vs. one-time outflows across months' },
                  { label: 'Accountant review workflow', detail: 'Export packs your CA can use immediately without cleanup' },
                  { label: 'GST/reporting preparation', detail: 'Clean categorized ledgers for future GST and audit workflows' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(47,184,166,0.12)', border: '1px solid rgba(47,184,166,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                      <span style={{ color: '#2FB8A6', fontSize: '10px', fontWeight: 700 }}>✓</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#E8F0EE', marginBottom: '2px' }}>{item.label}</div>
                      <div style={{ fontSize: '13px', color: 'rgba(232,240,238,0.45)' }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              {/* India-specific bank statement mock */}
              <div style={{
                background: '#0D1714',
                border: '1px solid rgba(47,184,166,0.14)',
                borderRadius: '16px',
                padding: '20px',
                fontFamily: 'ui-monospace, monospace',
                boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
              }}>
                <div style={{ fontSize: '10px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.08em', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                  HDFC BANK · A/C •••4827 · April 2026 Statement
                </div>
                {[
                  { date: '28/04', narr: 'UPI/RAZORPAY PAYMENTS/9820XXXXX', dr: '', cr: '4,80,000.00', bal: '12,84,200.00', type: 'inflow' },
                  { date: '26/04', narr: 'NEFT/MUMBAI SUPPLIES/IND234', dr: '1,24,000.00', cr: '', bal: '8,04,200.00', type: 'risk' },
                  { date: '25/04', narr: 'UPI/UNKNOWN/7839XXXXX/REF99213', dr: '18,500.00', cr: '', bal: '9,28,200.00', type: 'warn' },
                  { date: '22/04', narr: 'IMPS/HDFC BANK INTEREST', dr: '', cr: '2,840.00', bal: '9,46,700.00', type: 'inflow' },
                  { date: '20/04', narr: 'SI/AXIS BANK EMI/LOANXXX', dr: '45,000.00', cr: '', bal: '9,43,860.00', type: 'normal' },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr 80px 80px',
                    gap: '8px',
                    padding: '7px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: '10px',
                    alignItems: 'center',
                  }}>
                    <span style={{ color: 'rgba(232,240,238,0.35)' }}>{row.date}</span>
                    <span style={{
                      color: row.type === 'risk' ? '#E05450' : row.type === 'warn' ? '#D4922A' : 'rgba(232,240,238,0.65)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{row.narr}</span>
                    <span style={{ textAlign: 'right', color: row.dr ? '#E05450' : 'rgba(232,240,238,0.20)', fontWeight: row.dr ? 700 : 400 }}>{row.dr || '—'}</span>
                    <span style={{ textAlign: 'right', color: row.cr ? '#22B573' : 'rgba(232,240,238,0.20)', fontWeight: row.cr ? 700 : 400 }}>{row.cr || '—'}</span>
                  </div>
                ))}
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.35)' }}>↳ Kaeo parsed 142 rows · 11 uncategorized</span>
                  <span style={{ fontSize: '10px', color: '#2FB8A6', fontWeight: 700 }}>● processed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 005 — ASK LIBBY ═══════ */}
      <section style={S.section('#0A1410')}>
        <div style={S.inner}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: '80px', alignItems: 'center' }} className="libby-grid">
            <div>
              <SectionLabel code="005" label="ASK LIBBY" />
              <h2 style={S.h2}>
                Ask Libby when the numbers <span style={S.accent}>need explanation.</span>
              </h2>
              <p style={{ fontSize: '16px', color: 'rgba(232,240,238,0.50)', lineHeight: 1.65, marginBottom: '32px', maxWidth: '440px' }}>
                Libby helps explain risks, vendors, transaction patterns, and report readiness using your Kaeo data — giving you context when something looks off.
              </p>
              <div style={{ padding: '16px 18px', background: 'rgba(47,184,166,0.06)', border: '1px solid rgba(47,184,166,0.14)', borderRadius: '10px', fontSize: '13px', color: 'rgba(232,240,238,0.45)', lineHeight: 1.6, marginBottom: '24px' }}>
                <span style={{ color: '#2FB8A6', fontWeight: 600 }}>Note:</span> AI-assisted explanations are being built into the review workflow. Libby helps you understand your data — it does not file returns, automate payments, or replace your CA.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                {[
                  'Ask about your top vendor spends',
                  'Understand why a payment was flagged',
                  'Check report readiness before sharing with CA',
                  'Spot recurring payments and subscription patterns',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#2FB8A6', fontSize: '12px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, flexShrink: 0 }}>→</span>
                    <span style={{ fontSize: '14px', color: 'rgba(232,240,238,0.55)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <LibbyChatMock />
          </div>
        </div>
      </section>

      {/* ═══════ 006 — REPORTS ═══════ */}
      <section style={S.section('#050F0D')}>
        <div style={S.inner}>
          <SectionLabel code="006" label="REPORTS" />
          <h2 style={{ ...S.h2, maxWidth: '600px' }}>
            Reports your accountant <span style={S.accent}>can actually use.</span>
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(232,240,238,0.45)', maxWidth: '520px', marginBottom: '52px', lineHeight: 1.6 }}>
            Not raw exports. Clean, structured finance review packs with period summary, open risks, uncategorized items, and vendor spend — ready to share.
          </p>
          <ReportMock />
        </div>
      </section>

      {/* ═══════ 007 — PRICING ═══════ */}
      <section id="pricing" style={S.section('#0A1410')}>
        <div style={{ ...S.inner, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <SectionLabel code="007" label="PRICING" />
          <h2 style={{ ...S.h2, margin: '0 auto 20px', maxWidth: '600px' }}>
            Start simple, <span style={S.accent}>scale as you grow.</span>
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(232,240,238,0.45)', maxWidth: '480px', margin: '0 auto 52px', lineHeight: 1.6 }}>
            One seat, one SME. Pay for what you use as your transaction volume grows.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', maxWidth: '1000px', width: '100%', justifyContent: 'center', textAlign: 'left' }}>
            {[
              {
                name: 'Free',
                price: '₹0',
                period: '/mo',
                desc: 'Try Kaeo with a small statement file.',
                features: ['1 client profile', '2 files/month', '100 transactions'],
                cta: user ? 'View billing' : 'Start free',
                href: user ? '/billing' : '/signup',
                highlight: false,
              },
              {
                name: 'Starter',
                price: '₹999',
                period: '/mo',
                desc: 'For freelancers and solo finance operators.',
                features: ['3 client profiles', '10 files/month', '500 transactions'],
                cta: user ? 'Upgrade' : 'Start free trial',
                href: user ? '/billing' : '/signup',
                highlight: false,
              },
              {
                name: 'Growth',
                price: '₹2,999',
                period: '/mo',
                desc: 'For active SMEs with regular monthly review cycles.',
                features: ['10 client profiles', '30 files/month', '2,500 transactions', 'Priority support'],
                cta: user ? 'Upgrade' : 'Start free trial',
                href: user ? '/billing' : '/signup',
                highlight: true,
              },
              {
                name: 'Accountant',
                price: '₹7,999',
                period: '/mo',
                desc: 'For CA firms managing multiple client accounts.',
                features: ['Unlimited clients', '100 files/month', '10,000 transactions', 'Account manager'],
                cta: user ? 'Contact support' : 'Sign up',
                href: user ? '/billing' : '/signup',
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                style={{
                  background: plan.highlight ? 'rgba(47,184,166,0.08)' : '#0D1714',
                  border: plan.highlight ? '1px solid rgba(47,184,166,0.30)' : '1px solid rgba(47,184,166,0.10)',
                  borderRadius: '14px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column' as const,
                  gap: '16px',
                  position: 'relative' as const,
                  textAlign: 'left',
                }}
              >
                {plan.highlight && (
                  <div style={{
                    position: 'absolute' as const, top: '-11px', left: '50%', transform: 'translateX(-50%)',
                    background: '#2FB8A6', color: '#050F0D',
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                    padding: '4px 12px', borderRadius: '999px',
                  }}>Most popular</div>
                )}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: plan.highlight ? '#2FB8A6' : 'rgba(232,240,238,0.40)', marginBottom: '8px' }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '30px', fontWeight: 700, color: '#E8F0EE', letterSpacing: '-0.02em', fontFamily: 'ui-monospace, monospace' }}>{plan.price}</span>
                    <span style={{ fontSize: '13px', color: 'rgba(232,240,238,0.35)' }}>{plan.period}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(232,240,238,0.45)', lineHeight: 1.5, marginTop: '8px' }}>{plan.desc}</p>
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <ul style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', listStyle: 'none', margin: 0, padding: 0, flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(232,240,238,0.60)', fontWeight: 500 }}>
                      <span style={{ color: '#2FB8A6', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.href}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    background: plan.highlight ? '#2FB8A6' : 'rgba(47,184,166,0.08)',
                    color: plan.highlight ? '#050F0D' : '#2FB8A6',
                    border: plan.highlight ? 'none' : '1px solid rgba(47,184,166,0.20)',
                    transition: 'opacity 0.15s ease',
                  }}
                  className="hover:opacity-90"
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ 008 — FINAL CTA ═══════ */}
      <section style={{ ...S.section('#050F0D'), position: 'relative', overflow: 'hidden' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '600px', height: '300px',
            background: 'radial-gradient(ellipse, rgba(47, 184, 166, 0.12) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ ...S.inner, textAlign: 'center', position: 'relative' }}>
          <div style={{ color: '#2FB8A6', fontFamily: 'ui-monospace, monospace', fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 500, marginBottom: '24px' }}>
            008 — GET STARTED
          </div>
          <h2 style={{ ...S.h2, fontSize: 'clamp(36px, 5vw, 68px)', maxWidth: '640px', margin: '0 auto 20px' }}>
            Clean books start with <span style={S.accent}>clean review.</span>
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(232,240,238,0.45)', maxWidth: '460px', margin: '0 auto 40px', lineHeight: 1.6 }}>
            Upload your first bank statement and see your transactions mapped, categorized, and flagged in minutes.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Link
              to={user ? '/dashboard' : '/signup'}
              style={{
                background: '#2FB8A6',
                color: '#050F0D',
                padding: '16px 36px',
                borderRadius: '999px',
                fontSize: '16px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'opacity 0.15s ease',
              }}
              className="hover:opacity-90"
            >
              {user ? 'Go to Dashboard →' : 'Start reviewing →'}
            </Link>
            <a
              href="#how-it-works"
              onClick={(e) => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{
                color: 'rgba(232,240,238,0.55)',
                fontSize: '15px',
                fontWeight: 500,
                textDecoration: 'none',
                padding: '16px 28px',
                border: '1px solid rgba(47,184,166,0.18)',
                borderRadius: '999px',
                display: 'inline-block',
                transition: 'all 0.15s ease',
              }}
              className="hover:border-[#2FB8A6]/40 hover:text-[#E8F0EE]"
            >
              See how it works
            </a>
          </div>
          <p style={{ marginTop: '28px', fontSize: '13px', color: 'rgba(232,240,238,0.30)', lineHeight: 1.5 }}>
            No credit card required · Indian bank statement formats supported · Accountant-ready output
          </p>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer style={{ borderTop: '1px solid rgba(47,184,166,0.08)', padding: '40px 48px', background: '#050F0D' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <img src={aeLogo} alt="Kaeo" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(47,184,166,0.35))', flexShrink: 0 }} />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#E8F0EE', letterSpacing: '-0.02em' }}>Kaeo</span>
          </Link>
          <p style={{ fontSize: '13px', color: 'rgba(232,240,238,0.30)', margin: 0 }}>
            © 2026 Kaeo. Finance review workspace for Indian SMEs.
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            {user ? (
              <Link to="/dashboard" style={{ fontSize: '13px', color: 'rgba(232,240,238,0.45)', textDecoration: 'none', fontWeight: 500 }} className="hover:text-[#E8F0EE]">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" style={{ fontSize: '13px', color: 'rgba(232,240,238,0.45)', textDecoration: 'none', fontWeight: 500 }} className="hover:text-[#E8F0EE]">Sign in</Link>
                <Link to="/signup" style={{ fontSize: '13px', color: 'rgba(232,240,238,0.45)', textDecoration: 'none', fontWeight: 500 }} className="hover:text-[#E8F0EE]">Start free</Link>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 900px) {
          .india-grid, .libby-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
        }
        @media (max-width: 600px) {
          section { padding: 72px 24px !important; }
          footer { padding: 32px 24px !important; flex-direction: column !important; align-items: flex-start !important; }
        }
        .catch-card:hover {
          border-color: rgba(47, 184, 166, 0.24) !important;
        }
      `}</style>
    </div>
  );
};

export default Landing;
