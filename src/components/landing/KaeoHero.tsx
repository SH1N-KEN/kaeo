import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { motion } from 'framer-motion';
import aeLogo from '../../assets/kaeo-ae-logo.png';

/* ── Tiny product mock cards ─────────────────────────────── */

interface CardProps {
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}

const UploadCard: React.FC<CardProps> = ({ isActive, onHover, onLeave }) => (
  <div
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    onClick={onHover}
    className="frosted-card"
    style={{
      border: isActive ? '1px solid rgba(19, 140, 126, 0.45)' : undefined,
      boxShadow: isActive ? '0 0 25px rgba(19, 140, 126, 0.15)' : undefined,
      borderRadius: '14px',
      padding: '24px 20px',
      fontFamily: 'inherit',
      cursor: 'pointer',
      transform: isActive ? 'translateY(-3px)' : 'translateY(0)',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    }}
  >
    <div style={{ color: isActive ? '#138C7E' : 'rgba(232,240,238,0.4)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '16px', fontWeight: 600, transition: 'color 0.2s' }}>
      Upload
    </div>
    <div
      style={{
        border: isActive ? '1.5px dashed rgba(19, 140, 126, 0.40)' : '1.5px dashed rgba(140, 150, 148, 0.20)',
        borderRadius: '10px',
        padding: '24px 14px',
        textAlign: 'center',
        marginBottom: '16px',
        background: isActive ? 'rgba(19, 140, 126, 0.04)' : 'rgba(140, 150, 148, 0.03)',
        transition: 'all 0.2s ease',
      }}
    >
      <div 
        style={{ 
          fontSize: '24px', 
          marginBottom: '6px',
          display: 'inline-block',
          transform: isActive ? 'translateY(-4px)' : 'translateY(0)',
          transition: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        ↑
      </div>
      <div style={{ fontSize: '12px', color: '#138C7E', fontWeight: 600 }}>Drop your statement</div>
      <div style={{ fontSize: '10px', color: 'rgba(232,240,238,0.35)', marginTop: '4px' }}>CSV · XLSX · PDF</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {['hdfc_apr_2026.xlsx', 'razorpay_q1.csv'].map((f, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 10px',
          border: '1px solid rgba(255,255,255,0.02)',
        }}>
          <span style={{ fontSize: '12px', color: '#E8F0EE', fontWeight: 500 }}>{f}</span>
          <span style={{ fontSize: '10px', color: '#138C7E', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>● parsed</span>
        </div>
      ))}
    </div>
  </div>
);

const TransactionCard: React.FC<CardProps> = ({ isActive, onHover, onLeave }) => (
  <div
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    onClick={onHover}
    className="frosted-card"
    style={{
      border: isActive ? '1px solid rgba(19, 140, 126, 0.45)' : undefined,
      boxShadow: isActive ? '0 0 25px rgba(19, 140, 126, 0.15)' : undefined,
      borderRadius: '14px',
      padding: '20px 18px',
      fontFamily: 'inherit',
      cursor: 'pointer',
      transform: isActive ? 'translateY(-3px)' : 'translateY(0)',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#E8F0EE', letterSpacing: '0.02em' }}>Transactions</span>
      <span style={{ fontSize: '10px', color: '#138C7E', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>Apr 2026 · 142 rows</span>
    </div>
    {[
      { date: '28 Apr', narr: 'UPI/Razorpay/Vendor', dr: '−₹84,200', tag: 'vendor', risk: false },
      { date: '26 Apr', narr: 'NEFT/Mumbai Supplies', dr: '−₹1,24,000', tag: 'high', risk: true },
      { date: '25 Apr', narr: 'UPI/Paytm/Unknown', dr: '−₹18,500', tag: 'uncat.', risk: true },
      { date: '22 Apr', narr: 'RTGS/Client Inflow', dr: '+₹4,80,000', tag: 'inflow', risk: false },
    ].map((row, i) => (
      <div key={i} style={{
        display: 'grid',
        gridTemplateColumns: '38px minmax(0, 1fr) 62px 50px',
        gap: '8px',
        padding: '9px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        alignItems: 'center',
        fontSize: '11px',
      }}>
        <span style={{ color: 'rgba(232,240,238,0.35)', fontFamily: 'ui-monospace, monospace', fontSize: '10px' }}>{row.date}</span>
        <span style={{ color: '#E8F0EE', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.narr}</span>
        <span style={{ color: row.dr.startsWith('+') ? '#22B573' : '#E05450', fontWeight: 600, textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: '10px' }}>{row.dr}</span>
        <span style={{
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          textAlign: 'center',
          background: row.risk ? 'rgba(224, 84, 80, 0.12)' : row.tag === 'inflow' ? 'rgba(34, 181, 115, 0.12)' : 'rgba(140, 150, 148, 0.08)',
          color: row.risk ? '#E05450' : row.tag === 'inflow' ? '#22B573' : 'rgba(232, 240, 238, 0.65)',
          border: `1px solid ${row.risk ? 'rgba(224,84,80,0.20)' : row.tag === 'inflow' ? 'rgba(34,181,115,0.20)' : 'rgba(140,150,148,0.12)'}`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          transition: 'transform 0.2s ease',
          transform: isActive && row.risk ? 'scale(1.08)' : 'scale(1)',
        }}>{row.tag}</span>
      </div>
    ))}
  </div>
);

const RiskCard: React.FC<CardProps> = ({ isActive, onHover, onLeave }) => (
  <div
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    onClick={onHover}
    className="frosted-card"
    style={{
      border: isActive ? '1px solid rgba(19, 140, 126, 0.45)' : undefined,
      boxShadow: isActive ? '0 0 25px rgba(19, 140, 126, 0.15)' : undefined,
      borderRadius: '14px',
      padding: '20px 18px',
      fontFamily: 'inherit',
      cursor: 'pointer',
      transform: isActive ? 'translateY(-3px)' : 'translateY(0)',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    }}
  >
    <div style={{ color: isActive ? '#138C7E' : 'rgba(232,240,238,0.4)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '16px', fontWeight: 600, transition: 'color 0.2s' }}>
      Risk Snapshot
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {[
        { label: 'Duplicate suspects', count: '2', color: '#E05450' },
        { label: 'High-value outflows', count: '4', color: '#D4922A' },
        { label: 'Uncategorized rows', count: '11', color: 'rgba(232,240,238,0.45)' },
        { label: 'Vendor concentration', count: '1 flagged', color: '#D4922A' },
      ].map((item, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <span style={{ fontSize: '12px', color: 'rgba(232,240,238,0.65)', fontWeight: 400 }}>{item.label}</span>
          <span style={{ fontSize: '12px', color: item.color, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{item.count}</span>
        </div>
      ))}
    </div>
    <div style={{ marginTop: '16px', padding: '10px 12px', background: 'rgba(140, 150, 148, 0.05)', borderRadius: '8px', border: '1px solid rgba(140, 150, 148, 0.10)' }}>
      <div style={{ fontSize: '11px', color: '#138C7E', fontWeight: 600, marginBottom: '4px' }}>Report readiness</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            width: '74%',
            height: '100%',
            background: '#138C7E',
            borderRadius: '2px',
            animation: isActive ? 'pulse 1.5s infinite' : 'none',
          }} />
        </div>
        <span style={{ fontSize: '11px', color: '#138C7E', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>74%</span>
      </div>
    </div>
  </div>
);

/* ── Hero ─────────────────────────────────────────────────── */

export const KaeoHero: React.FC = () => {
  const { user } = useAuth();
  const [activePanel, setActivePanel] = useState<string | null>(null);

  return (
    <section
      id="product"
      style={{
        background: 'transparent',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '140px 48px 96px', // increased top padding for spacing
      }}
    >
      {/* Subtle radial glows */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-180px',
          right: '-120px',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(19, 140, 126, 0.05) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '-200px',
          left: '-80px',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(19, 140, 126, 0.03) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', position: 'relative' }}>
        {/* Two column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '4.2fr 5.8fr', // larger product showcase (58% width)
            gap: '80px',
            alignItems: 'center',
          }}
          className="hero-grid"
        >
          {/* Left: Editorial headline */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}
          >
            {/* Eyebrow */}
            <div
              style={{
                color: '#138C7E',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '11px',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}
            >
              001 — AI-ASSISTED FINANCE REVIEW FOR INDIAN SMBs
            </div>

            {/* Headline */}
            <h1
              style={{
                fontWeight: 700,
                fontSize: 'clamp(44px, 5.5vw, 76px)',
                lineHeight: '1.05',
                letterSpacing: '-0.03em',
                margin: 0,
                color: '#E8F0EE',
              }}
            >
              Your statements,<br />
              your vendors,<br />
              your risks,<br />
              <span className="editorial-accent" style={{ color: '#138C7E' }}>reviewed.</span>
            </h1>

            {/* Subheadline */}
            <p
              style={{
                fontSize: '17px',
                lineHeight: '1.6',
                color: 'rgba(232, 240, 238, 0.55)',
                maxWidth: '480px',
                margin: 0,
                fontWeight: 400,
              }}
            >
              Upload bank statements and invoices. Kaeo maps transactions, flags risky payments, highlights vendor spend, and prepares clean finance reports for your accountant.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <Link
                to={user ? '/dashboard' : '/signup'}
                style={{
                  background: '#138C7E',
                  color: '#080A09',
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: '999px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-block',
                  textDecoration: 'none',
                  transition: 'background-color 0.2s ease, transform 0.2s ease',
                }}
                className="cta-btn cta-primary"
              >
                {user ? 'Go to Dashboard' : 'Start reviewing'}{' '}
                <span className="cta-arrow" style={{ display: 'inline-block', transition: 'transform 0.2s' }}>→</span>
              </Link>
              <a
                href="#how-it-works"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                style={{
                  color: 'rgba(232, 240, 238, 0.55)',
                  fontSize: '15px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  padding: '14px 24px',
                  border: '1px solid rgba(140, 150, 148, 0.18)',
                  borderRadius: '999px',
                  display: 'inline-block',
                  transition: 'all 0.15s ease',
                }}
                className="cta-btn cta-secondary"
              >
                View demo
              </a>
            </div>

            {/* Trust line */}
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(232, 240, 238, 0.35)',
                margin: 0,
                lineHeight: 1.5,
                maxWidth: '420px',
              }}
            >
              Built for founders, accountants, and SME finance teams who still live inside Excel, bank portals, and WhatsApp.
            </p>

            {/* Trust signals */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '-8px' }}>
              {[
                'HDFC · ICICI · Axis CSV support',
                'UPI narration parsing',
                'Accountant-ready reports',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#138C7E', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'rgba(232, 240, 238, 0.45)', fontWeight: 500 }}>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Product mock */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'relative', width: '100%', maxWidth: '880px', justifySelf: 'end' }}
          >
            {/* Product mock frame */}
            <div
              className="frosted-card"
              style={{
                borderRadius: '18px',
                padding: '24px',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Browser chrome */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={aeLogo} alt="Kaeo" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(19,140,126,0.4))', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#E8F0EE' }}>Kaeo Finance Review</span>
                </div>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'ui-monospace, monospace',
                    letterSpacing: '0.08em',
                    padding: '3px 8px',
                    background: 'rgba(19, 140, 126, 0.10)',
                    color: '#138C7E',
                    border: '1px solid rgba(19, 140, 126, 0.20)',
                    borderRadius: '4px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  ILLUSTRATIVE · APR 2026
                </span>
              </div>

              {/* 3 panels */}
              <div className="hero-mock-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', gap: '14px' }}>
                <UploadCard isActive={activePanel === 'upload'} onHover={() => setActivePanel('upload')} onLeave={() => setActivePanel(null)} />
                <TransactionCard isActive={activePanel === 'transactions'} onHover={() => setActivePanel('transactions')} onLeave={() => setActivePanel(null)} />
                <RiskCard isActive={activePanel === 'risks'} onHover={() => setActivePanel('risks')} onLeave={() => setActivePanel(null)} />
              </div>
            </div>

            {/* Interactive Floating label */}
            <div
              style={{
                position: 'absolute',
                bottom: '-28px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '12px',
                fontFamily: 'ui-monospace, monospace',
                color: activePanel ? '#138C7E' : 'rgba(232, 240, 238, 0.45)',
                letterSpacing: '0.06em',
                fontWeight: activePanel ? 600 : 400,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {activePanel === 'upload' && '📁 Upload CSV/XLSX statements and invoices'}
              {activePanel === 'transactions' && '⚡ Review mapped ledger rows, categories, and spend movement'}
              {activePanel === 'risks' && '⚠ Catch duplicate suspects, high-value outflows, and uncategorized spend'}
              {!activePanel && 'From messy statements → accountant-ready reports (hover panels to explore)'}
            </div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          style={{
            marginTop: '80px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'rgba(232, 240, 238, 0.35)',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ width: '28px', height: '1px', background: 'rgba(232, 240, 238, 0.25)', display: 'inline-block' }} />
          <span>Scroll to see the workflow</span>
        </motion.div>
      </div>

      {/* Responsive mobile styles */}
      <style>{`
        @media (max-width: 990px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
        }
        @media (max-width: 768px) {
          .hero-mock-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
        @media (max-width: 600px) {
          section#product {
            padding: 120px 24px 80px !important;
          }
        }
      `}</style>
    </section>
  );
};
