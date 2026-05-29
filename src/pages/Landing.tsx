import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { KaeoLandingHeader } from '../components/landing/KaeoLandingHeader';
import { KaeoHero } from '../components/landing/KaeoHero';
import { SlidingSegmentControl } from '../components/landing/SlidingSegmentControl';
import aeLogo from '../assets/kaeo-ae-logo.png';

/* ═══════════════════════════════════════════════
   SECTION LABEL COMPONENT
═══════════════════════════════════════════════ */
const SectionLabel = ({ code, label }: { code: string; label: string }) => (
  <div style={{ color: '#138C7E', fontFamily: 'ui-monospace, monospace', fontSize: '11px', letterSpacing: '0.08em', marginBottom: '16px', textTransform: 'uppercase' as const, fontWeight: 500 }}>
    {code} — {label}
  </div>
);
/* ═══════════════════════════════════════════════
   WORKFLOW STEP INTERACTIVE VISUALIZERS
═══════════════════════════════════════════════ */
const UploadVisualInteractive = ({ isDesktop = true }: { isDesktop?: boolean }) => {
  const [hoveredFile, setHoveredFile] = useState<number | null>(null);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '20px' : '12px', height: '100%', justifyContent: 'center' }}>
      <div 
        style={{ 
          border: '2px dashed rgba(19, 140, 126, 0.25)', 
          borderRadius: '12px', 
          padding: isDesktop ? '40px 24px' : '20px 16px', 
          textAlign: 'center', 
          background: 'rgba(19, 140, 126, 0.02)', 
          cursor: 'pointer', 
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }} 
        className="hover:border-teal-400/40 hover:bg-teal-950/10"
      >
        <span style={{ fontSize: isDesktop ? '40px' : '28px', filter: 'drop-shadow(0 0 10px rgba(19,140,126,0.2))' }}>📁</span>
        <div>
          <span style={{ fontSize: isDesktop ? '15px' : '13px', color: '#138C7E', fontWeight: 700, display: 'block' }}>Drag & drop statement files here</span>
          <span style={{ fontSize: isDesktop ? '12px' : '11px', color: 'rgba(232, 240, 238, 0.35)', display: 'block', marginTop: '4px' }}>Supports CSV or XLSX statement sheets</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '10.5px', color: 'rgba(232, 240, 238, 0.4)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>FILES IN THIS WORKSPACE</div>
        {[
          { name: 'hdfc_bank_statement_apr.xlsx', size: '48 KB', type: 'Excel Sheet' },
          { name: 'razorpay_settlement_report.csv', size: '112 KB', type: 'CSV Statement' },
          ...(isDesktop ? [{ name: 'mumbai_supplies_invoice_102.pdf', size: '1.2 MB', type: 'GST Invoice PDF' }] : [])
        ].map((f, i) => (
          <div 
            key={i} 
            onMouseEnter={() => setHoveredFile(i)}
            onMouseLeave={() => setHoveredFile(null)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: isDesktop ? '14px 18px' : '10px 14px', 
              background: hoveredFile === i ? 'rgba(19, 140, 126, 0.05)' : 'rgba(255,255,255,0.01)', 
              borderRadius: '10px', 
              border: hoveredFile === i ? '1px solid rgba(19, 140, 126, 0.3)' : '1px solid rgba(255,255,255,0.05)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>{f.name.endsWith('.pdf') ? '📄' : '📊'}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '12px', color: '#E8F0EE', fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>{f.name}</span>
                <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.4)' }}>{f.size} · {f.type}</span>
              </div>
            </div>
            <span style={{ fontSize: '11px', color: '#138C7E', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#138C7E' }} /> ✓ Uploaded
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MapVisualInteractive = ({ isDesktop = true }: { isDesktop?: boolean }) => {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '16px' : '10px', height: '100%', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(19, 140, 126, 0.03)', border: '1px solid rgba(19, 140, 126, 0.15)', borderRadius: '10px', padding: isDesktop ? '16px 20px' : '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#E8F0EE' }}>Statement Columns Mapped</span>
            <span style={{ fontSize: '11px', color: 'rgba(232, 240, 238, 0.45)', display: 'block' }}>Kaeo mapped 4 base fields successfully</span>
          </div>
        </div>
        <span style={{ fontSize: '11px', background: 'rgba(34, 181, 115, 0.1)', color: '#22B573', border: '1px solid rgba(34, 181, 115, 0.2)', borderRadius: '4px', padding: '2px 8px', fontWeight: 700 }}>100% ACCURACY</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { target: 'Transaction Date', source: 'Value Date (Col A)', confidence: '99%', preview: '28-04-2026' },
          { target: 'Description / Narration', source: 'Narration Details (Col B)', confidence: '98%', preview: 'UPI/Razorpay/Vendor...' },
          { target: 'Debit Amount (Outflow)', source: 'Withdrawal Amt (Col D)', confidence: '96%', preview: '₹1,24,000.00' },
          { target: 'Credit Amount (Inflow)', source: 'Deposit Amt (Col E)', confidence: '96%', preview: '₹4,80,000.00' }
        ].map((row, i) => (
          <div 
            key={i} 
            onMouseEnter={() => setHoveredRow(i)}
            onMouseLeave={() => setHoveredRow(null)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: isDesktop ? '14px 18px' : '10px 14px', 
              background: hoveredRow === i ? 'rgba(19, 140, 126, 0.05)' : 'rgba(255,255,255,0.01)', 
              borderRadius: '10px', 
              border: hoveredRow === i ? '1px solid rgba(19, 140, 126, 0.3)' : '1px solid rgba(255,255,255,0.05)',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '13px', color: '#E8F0EE', fontWeight: 700 }}>{row.target}</span>
              <span style={{ fontSize: '11px', color: '#138C7E', fontFamily: 'ui-monospace, monospace' }}>
                ➔ Mapped: <span style={{ color: '#E8F0EE' }}>"{row.source}"</span>
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              {isDesktop && <span style={{ fontSize: '11px', color: 'rgba(232, 240, 238, 0.5)', fontFamily: 'ui-monospace, monospace' }}>Sample: {row.preview}</span>}
              <span style={{ fontSize: '9px', color: '#138C7E', background: 'rgba(19,140,126,0.08)', border: '1px solid rgba(19,140,126,0.18)', borderRadius: '4px', padding: '1px 6px', fontWeight: 700 }}>CONFIRMED</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReviewVisualInteractive = ({ isDesktop = true }: { isDesktop?: boolean }) => {
  const [activeRisk, setActiveRisk] = useState<number | null>(0);
  
  const items = [
    { date: '28 Apr', desc: 'Bombay Rent Ltd', cat: 'Rent & Utilities', amount: '−₹1,80,000', label: 'Duplicate payment suspect', why: 'Paid twice within 24 hours to the same landlord account.', advice: 'Verify landlord bank logs or confirm refund.' },
    { date: '26 Apr', desc: 'Mumbai Supplies Pvt Ltd', cat: 'Capital Expense', amount: '−₹1,24,000', label: 'High-value outflow', why: 'This payment is 3.2× higher than historical monthly average.', advice: 'Review attached GST invoice and PO approval.' },
    ...(isDesktop ? [{ date: '25 Apr', desc: 'UPI/9820123456/Rent/Paytm', cat: 'Uncategorized', amount: '−₹18,500', label: 'Uncategorized UPI transfer', why: 'Payee detected as Rent/Paytm but needs review.', advice: 'Assign to Landlord category.' }] : [])
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '14px' : '10px', height: '100%', justifyContent: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'rgba(232, 240, 238, 0.5)', textTransform: 'uppercase', fontWeight: 600 }}>Ledger Risks Inbox</span>
        <span style={{ fontSize: '11px', color: '#E05450', fontWeight: 700, background: 'rgba(224, 84, 80, 0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(224, 84, 80, 0.15)' }}>● Issues Pending</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, i) => {
          const isSelected = activeRisk === i;
          return (
            <div 
              key={i} 
              onClick={() => setActiveRisk(i)}
              style={{ 
                padding: '12px 14px', 
                background: isSelected ? 'rgba(224,84,80,0.04)' : 'rgba(255,255,255,0.01)', 
                borderRadius: '10px', 
                border: isSelected ? '1px solid rgba(224,84,80,0.35)' : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#E8F0EE' }}>{item.desc}</span>
                  <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.4)', marginLeft: '8px' }}>{item.date}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#E05450', fontFamily: 'ui-monospace, monospace' }}>{item.amount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '11.5px', color: '#E05450', fontWeight: 600 }}>⚠ {item.label}</span>
                <span style={{ fontSize: '10px', background: 'rgba(19,140,126,0.08)', color: '#138C7E', border: '1px solid rgba(19,140,126,0.15)', padding: '1px 6px', borderRadius: '4px' }}>{item.cat}</span>
              </div>
              {isSelected && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '11.5px', color: 'rgba(232,240,238,0.7)', lineHeight: 1.5 }}>
                  <div style={{ marginBottom: '4px' }}><strong>Reason:</strong> {item.why}</div>
                  <div style={{ color: '#138C7E' }}><strong>Action:</strong> {item.advice}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const UnderstandVendorsVisual = ({ isDesktop = true }: { isDesktop?: boolean }) => {
  const [activeVendor, setActiveVendor] = useState<number | null>(0);
  const vendors = [
    { name: 'Mumbai Supplies Pvt Ltd', total: '₹3,40,000', count: '3 bills', share: '62%', type: 'Supplier', progressWidth: '62%' },
    { name: 'Bombay Rent Ltd', total: '₹1,80,000', count: '1 bill', share: '32%', type: 'Utilities', progressWidth: '32%' },
    ...(isDesktop ? [{ name: 'Slack Technologies', total: '₹30,000', count: '1 bill', share: '6%', type: 'SaaS / Software', progressWidth: '6%' }] : [])
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '14px' : '10px', height: '100%', justifyContent: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'rgba(232, 240, 238, 0.5)', textTransform: 'uppercase', fontWeight: 600 }}>Active Merchant Accounts</span>
        <span style={{ fontSize: '11px', color: '#138C7E', fontWeight: 700 }}>3 vendors tracked</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {vendors.map((v, i) => {
          const isActive = activeVendor === i;
          return (
            <div 
              key={i} 
              onClick={() => setActiveVendor(i)}
              style={{ 
                padding: '12px 14px', 
                background: isActive ? 'rgba(19, 140, 126, 0.04)' : 'rgba(255,255,255,0.01)', 
                borderRadius: '10px', 
                border: isActive ? '1px solid rgba(19, 140, 126, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#E8F0EE' }}>{v.name}</span>
                  <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: 'rgba(232,240,238,0.5)', padding: '1px 5px', borderRadius: '4px', marginLeft: '8px' }}>{v.type}</span>
                </div>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#138C7E', fontFamily: 'ui-monospace, monospace' }}>{v.total}</span>
              </div>
              
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0' }}>
                <div style={{ width: v.progressWidth, height: '100%', background: '#138C7E', borderRadius: '2px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'rgba(232,240,238,0.45)' }}>
                <span>{v.count} · Outflow</span>
                <span style={{ color: '#138C7E', fontWeight: 600 }}>{v.share} of period spend</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GenerateReportsVisual = ({ isDesktop = true }: { isDesktop?: boolean }) => {
  const [downloaded, setDownloaded] = useState(false);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '16px' : '10px', height: '100%', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(19, 140, 126, 0.03)', border: '1px solid rgba(19, 140, 126, 0.15)', borderRadius: '12px', padding: isDesktop ? '20px 20px' : '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#E8F0EE', display: 'block' }}>Finance Review Pack · April 2026</span>
            <span style={{ fontSize: '11px', color: 'rgba(232,240,238,0.45)', display: 'block', marginTop: '2px' }}>Verified ledger CSV + Scanned invoice attachment ZIP</span>
          </div>
          <span style={{ fontSize: '10px', color: '#22B573', fontWeight: 700, background: 'rgba(34, 181, 115, 0.1)', border: '1px solid rgba(34, 181, 115, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>✓ READY</span>
        </div>
        
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.4)', display: 'block', textTransform: 'uppercase' }}>Transactions</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#138C7E', fontFamily: 'ui-monospace, monospace' }}>142 verified</span>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.4)', display: 'block', textTransform: 'uppercase' }}>Risks Cleared</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#22B573', fontFamily: 'ui-monospace, monospace' }}>3 resolved</span>
          </div>
        </div>
      </div>
      
      <button 
        onClick={() => {
          setDownloaded(true);
          setTimeout(() => setDownloaded(false), 3000);
        }}
        style={{ 
          width: '100%', 
          padding: '14px', 
          background: downloaded ? 'rgba(34, 181, 115, 0.15)' : '#138C7E', 
          color: downloaded ? '#22B573' : '#050F0D', 
          border: downloaded ? '1px solid rgba(34, 181, 115, 0.3)' : 'none', 
          borderRadius: '10px', 
          fontWeight: 700, 
          fontSize: '12.5px', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '8px',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 12px rgba(19, 140, 126, 0.15)'
        }}
      >
        <span>{downloaded ? '✓ Downloaded accountant pack' : '📥 Download Accountant Export (ZIP)'}</span>
      </button>
    </div>
  );
};

const InteractiveWorkflowSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const [prefersReduced, setPrefersReduced] = useState(false);

  const steps = [
    {
      num: "01",
      label: "Upload files",
      title: "Upload statement and invoice sheets",
      description: "Supports standard ICICI, HDFC, Axis CSV/XLSX file formats.",
      visual: (isDesk: boolean) => <UploadVisualInteractive isDesktop={isDesk} />
    },
    {
      num: "02",
      label: "Map transactions",
      title: "Automatic field identification",
      description: "Auto-detects columns, debit/credit values, and references.",
      visual: (isDesk: boolean) => <MapVisualInteractive isDesktop={isDesk} />
    },
    {
      num: "03",
      label: "Review risks",
      title: "Identify ledger risk anomalies",
      description: "Flags duplicate suspects, high outflows, and uncategorized spend.",
      visual: (isDesk: boolean) => <ReviewVisualInteractive isDesktop={isDesk} />
    },
    {
      num: "04",
      label: "Understand vendors",
      title: "Get complete vendor spend context",
      description: "Aggregates transactions by merchant and tracks recurring trends.",
      visual: (isDesk: boolean) => <UnderstandVendorsVisual isDesktop={isDesk} />
    },
    {
      num: "05",
      label: "Generate reports",
      title: "Export accountant-ready packs",
      description: "Download structured review summaries and attachments for your CA.",
      visual: (isDesk: boolean) => <GenerateReportsVisual isDesktop={isDesk} />
    }
  ];

  useEffect(() => {
    const checkMedia = () => {
      setIsDesktop(window.innerWidth >= 768);
      setPrefersReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    checkMedia();
    window.addEventListener('resize', checkMedia);
    return () => window.removeEventListener('resize', checkMedia);
  }, []);

  useEffect(() => {
    if (!isDesktop || prefersReduced) return;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const navHeight = 72;
      const stickyHeight = window.innerHeight - navHeight;
      const totalScrollRange = rect.height - stickyHeight;

      if (totalScrollRange <= 0) return;

      // Pin range is exactly rect.top from navHeight (72px) down to (navHeight - totalScrollRange)
      const currentScroll = navHeight - rect.top;
      const progress = Math.max(0, Math.min(1, currentScroll / totalScrollRange));
      
      const stepIndex = Math.min(4, Math.floor(progress * 5));
      setActiveStep(stepIndex);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDesktop, prefersReduced]);

  const handleStepClick = (idx: number) => {
    if (!isDesktop || prefersReduced) {
      setActiveStep(idx);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top;
    const navHeight = 72;
    const stickyHeight = window.innerHeight - navHeight;
    const totalScrollRange = rect.height - stickyHeight;

    const targetProgress = (idx + 0.5) / 5;
    const targetScrollY = scrollTop - navHeight + targetProgress * totalScrollRange;

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth'
    });
  };

  const useStickyScroll = isDesktop && !prefersReduced;

  if (!useStickyScroll) {
    // Mobile / stacked layout fallback
    return (
      <section id="how-it-works" style={{ background: 'transparent', padding: '72px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <div>
            <SectionLabel code="002" label="HOW IT WORKS" />
            <h2 style={{
              fontWeight: 700,
              fontSize: 'clamp(28px, 6vw, 36px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              margin: '0 0 16px',
              color: '#E8F0EE',
            }}>
              How Kaeo reviews your books
            </h2>
            <p style={{
              fontSize: '15px',
              color: 'rgba(232, 240, 238, 0.45)',
              lineHeight: 1.5,
              margin: 0,
            }}>
              No formatting, no pivot tables, no manual categorization. Kaeo handles the cleanup so you can focus on the review.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {steps.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    padding: '24px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: '20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
                    <span style={{
                      fontStyle: 'italic',
                      color: '#138C7E',
                      fontSize: '20px',
                      fontWeight: 700,
                    }}>{step.num}</span>
                    <span style={{
                      color: 'rgba(232, 240, 238, 0.4)',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}>{step.label}</span>
                  </div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#E8F0EE',
                    marginBottom: '8px',
                  }}>{step.title}</h3>
                  <p style={{
                    fontSize: '13.5px',
                    color: 'rgba(232, 240, 238, 0.65)',
                    lineHeight: 1.55,
                    margin: 0,
                  }}>{step.description}</p>
                </div>
                <div
                  style={{
                    background: '#121514',
                    border: '1px solid rgba(140, 150, 148, 0.12)',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                  }}
                >
                  {step.visual(false)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Desktop Pinned Scrollytelling (Approach A)
  return (
    <section 
      id="how-it-works"
      ref={containerRef}
      style={{
        position: 'relative',
        height: '500vh',
        background: 'transparent',
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: '72px',
          height: 'calc(100vh - 72px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: '40% 60%',
            gap: '64px',
            alignItems: 'center',
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 64px',
          }}
          className="workflow-grid"
        >
          {/* Left Column: Header + Active Step Card + Progress Rail */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '40px',
              width: '100%',
            }} 
          >
            <div>
              <SectionLabel code="002" label="HOW IT WORKS" />
              <h2 style={{
                fontWeight: 700,
                fontSize: 'clamp(28px, 3.5vw, 44px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                margin: '0 0 16px',
                color: '#E8F0EE',
              }}>
                How Kaeo reviews your books
              </h2>
              <p style={{
                fontSize: '15px',
                color: 'rgba(232, 240, 238, 0.45)',
                lineHeight: 1.5,
                margin: 0,
              }}>
                No formatting, no pivot tables, no manual categorization. Kaeo handles the cleanup so you can focus on the review.
              </p>
            </div>

            {/* Hero Active Step Display */}
            <div 
              key={activeStep}
              className="animate-kaeo-fade"
              style={{
                padding: '32px',
                background: 'rgba(19, 140, 126, 0.04)',
                border: '1px solid rgba(19, 140, 126, 0.15)',
                borderRadius: '24px',
                backdropFilter: 'blur(12px)',
                minHeight: '220px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '16px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.3), inset 0 1px 0 0 rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span style={{
                  fontStyle: 'italic',
                  color: '#138C7E',
                  fontSize: '32px',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  lineHeight: '1',
                }}>{steps[activeStep].num}</span>
                <span style={{
                  color: 'rgba(19, 140, 126, 0.85)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '11px',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}>{steps[activeStep].label}</span>
              </div>
              <h3 style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#E8F0EE',
                letterSpacing: '-0.02em',
                margin: 0,
              }}>{steps[activeStep].title}</h3>
              <p style={{
                fontSize: '15px',
                color: 'rgba(232, 240, 238, 0.65)',
                lineHeight: 1.6,
                margin: 0,
              }}>{steps[activeStep].description}</p>
            </div>

            {/* Vertical Progress Rail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '16px', borderLeft: '2px solid rgba(255,255,255,0.03)', marginTop: '8px' }}>
              <div 
                style={{
                  position: 'absolute',
                  left: '-2px',
                  top: `${(activeStep / 5) * 100}%`,
                  height: '20%',
                  width: '2px',
                  background: '#138C7E',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 0 8px #138C7E',
                }}
              />
              {steps.map((step, idx) => {
                const isActive = idx === activeStep;
                return (
                  <div
                    key={idx}
                    onClick={() => handleStepClick(idx)}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      opacity: isActive ? 1 : 0.35,
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <span style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: isActive ? '#138C7E' : '#E8F0EE',
                    }}>
                      {step.num}
                    </span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#E8F0EE',
                    }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Hero Preview (Desktop only) */}
          <div 
            style={{
              background: 'rgba(10, 18, 16, 0.78)',
              backdropFilter: 'blur(18px) saturate(135%)',
              WebkitBackdropFilter: 'blur(18px) saturate(135%)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
              height: 'calc(100vh - 180px)',
              width: '100%',
              maxWidth: '850px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
              overflowY: 'auto',
              overflowX: 'hidden',
            }} 
            className="workflow-mock-panel no-scrollbar"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px' }}>💻</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(232, 240, 238, 0.45)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}>KAEO WORKSPACE · ACTIVE VIEW</span>
              </div>
              <span style={{ 
                fontSize: '9px', 
                fontFamily: 'ui-monospace, monospace', 
                letterSpacing: '0.08em', 
                padding: '2px 6px', 
                background: 'rgba(140,150,148,0.08)', 
                color: 'rgba(232, 240, 238, 0.65)', 
                borderRadius: '4px', 
                fontWeight: 700, 
                textTransform: 'uppercase',
                transition: 'all 0.3s ease'
              }}>
                {steps[activeStep].label}
              </span>
            </div>
            <div key={activeStep} className="workflow-mock-content animate-kaeo-scale" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {steps[activeStep].visual(true)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════
   2. BEFORE AFTER COMPARISON TOGGLE
═══════════════════════════════════════════════ */
const BeforeAfterComparison: React.FC = () => {
  const [mode, setMode] = useState<'before' | 'after'>('after');
  const lastManualChange = useRef<number>(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const checkMedia = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkMedia();
    window.addEventListener('resize', checkMedia);
    return () => window.removeEventListener('resize', checkMedia);
  }, []);

  const useStickyScroll = isDesktop && !reducedMotion;

  const toggleMode = (newMode: 'before' | 'after') => {
    setMode(newMode);
    lastManualChange.current = Date.now();

    if (!useStickyScroll) return;

    const container = sectionRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top;
    const navHeight = 72;
    const stickyHeight = window.innerHeight - navHeight;
    const totalScrollRange = rect.height - stickyHeight;

    const targetProgress = newMode === 'before' ? 0.25 : 0.75;
    const targetScrollY = scrollTop - navHeight + targetProgress * totalScrollRange;

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    if (!useStickyScroll) return;

    const handleScroll = () => {
      // Ignore scroll-driven changes for 1.5s after a manual click
      if (Date.now() - lastManualChange.current < 1500) {
        return;
      }

      const container = sectionRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const navHeight = 72;
      const stickyHeight = window.innerHeight - navHeight;
      const totalScrollRange = rect.height - stickyHeight;

      if (totalScrollRange <= 0) return;

      const currentScroll = navHeight - rect.top;
      const progress = Math.max(0, Math.min(1, currentScroll / totalScrollRange));
      
      if (progress < 0.5) {
        setMode('before');
      } else {
        setMode('after');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [useStickyScroll]);

  if (!useStickyScroll) {
    return (
      <section 
        ref={sectionRef}
        style={{ 
          padding: '72px 24px', 
          background: 'transparent', 
          overflow: 'hidden'
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          <div className="flex flex-col items-center gap-12">
            
            {/* Copy + Toggle */}
            <div className="w-full flex flex-col items-center text-center">
              <div style={{ color: '#138C7E', fontFamily: 'ui-monospace, monospace', fontSize: '11px', letterSpacing: '0.08em', marginBottom: '16px', textTransform: 'uppercase', fontWeight: 500 }}>
                002B — THE DIFFERENCE
              </div>
              <h2 style={{ fontWeight: 700, fontSize: 'clamp(28px, 5vw, 36px)', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 16px', color: '#E8F0EE' }}>
                Before Kaeo vs. <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400, color: '#138C7E', textTransform: 'none' }}>Review-ready.</span>
              </h2>
              <p style={{ fontSize: '15px', color: 'rgba(232,240,238,0.45)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: '580px' }}>
                Stop wasting hours untangling raw narrations, matching receipts, and searching for invoice files. Toggle below to see how Kaeo transforms raw statement data into a clean, audited ledger.
              </p>

              <SlidingSegmentControl
                options={[
                  { value: 'before', label: 'Before Kaeo' },
                  { value: 'after', label: 'Review-ready' },
                ]}
                activeValue={mode}
                onChange={toggleMode}
                activeColor={mode === 'before' ? '#E05450' : '#138C7E'}
                className="w-[280px] mb-8"
              />
            </div>

            {/* Mobile Cards rendering */}
            <div className="w-full relative min-h-[410px]">
              {/* Before Card */}
              <div
                style={{
                  position: mode === 'before' ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  opacity: mode === 'before' ? 1 : 0,
                  transform: mode === 'before' ? 'translateY(0) scale(1)' : 'translateY(15px) scale(0.96)',
                  pointerEvents: mode === 'before' ? 'auto' : 'none',
                  transition: 'opacity 0.25s, transform 0.25s',
                  background: 'rgba(10, 18, 16, 0.78)',
                  backdropFilter: 'blur(18px) saturate(135%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(135%)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#E05450', fontWeight: 700, letterSpacing: '0.05em' }}>❌ CRYPTIC BANK STATEMENT ROWS & UNRECONCILED SHEETS</div>
                  {[
                    { date: '28/04/26', narr: 'UPI/9820123456/Rent/Paytm', amt: '1,80,000.00 Dr', cat: '[Uncategorized]', note: 'Who was paid? Is there a rent receipt?' },
                    { date: '26/04/26', narr: 'NEFT-MUM-SUP-23423-MUMBAI SUPPLIES PVT', amt: '1,24,000.00 Dr', cat: '[Uncategorized]', note: 'Is this invoice attached? Price looks higher than usual.' },
                    { date: '25/04/26', narr: 'UPI/7839XXXXX/REF99213/ANON', amt: '18,500.00 Dr', cat: '[Uncategorized]', note: 'Completely unidentified transaction payee.' },
                  ].map((row, i) => (
                    <div key={i} style={{ padding: '12px', background: 'rgba(224, 84, 80, 0.02)', borderRadius: '8px', border: '1px solid rgba(224, 84, 80, 0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(232,240,238,0.35)', marginBottom: '4px', fontFamily: 'ui-monospace, monospace' }}>
                        <span className="truncate mr-2">{row.date} · {row.narr}</span>
                        <span style={{ color: '#E05450', fontWeight: 600 }} className="shrink-0">{row.amt}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ color: '#E05450', fontWeight: 700 }}>{row.cat}</span>
                        <span style={{ color: 'rgba(232,240,238,0.4)', fontStyle: 'italic' }}>❓ {row.note}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ background: 'rgba(224,84,80,0.06)', border: '1px solid rgba(224,84,80,0.20)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#E05450' }}>
                    <strong>Issues:</strong> Messy statement rows, unclear UPI narrations, uncategorized payments, and missing invoice context.
                  </div>
                </div>
              </div>

              {/* Review-ready Card */}
              <div
                style={{
                  position: mode === 'after' ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  opacity: mode === 'after' ? 1 : 0,
                  transform: mode === 'after' ? 'translateY(0) scale(1)' : 'translateY(15px) scale(0.96)',
                  pointerEvents: mode === 'after' ? 'auto' : 'none',
                  transition: 'opacity 0.25s, transform 0.25s',
                  background: 'rgba(10, 18, 16, 0.78)',
                  backdropFilter: 'blur(18px) saturate(135%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(135%)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#138C7E', fontWeight: 700, letterSpacing: '0.05em' }}>⚡ CLEAN, RECONCILED KAEO LEDGER ROWS</div>
                  {[
                    { date: '28 Apr 2026', vendor: 'Bombay Rent Ltd', cat: 'Rent & Utilities', amt: '−₹1,80,000', badge: 'Duplicate payment suspect', bColor: '#E05450' },
                    { date: '26 Apr 2026', vendor: 'Mumbai Supplies Pvt Ltd', cat: 'Capital Expense', amt: '−₹1,24,000', badge: 'High-Value Outflow (3.2x avg)', bColor: '#E05450' },
                    { date: '25 Apr 2026', vendor: 'UPI Payee / Rent', cat: 'Rent & Utilities', amt: '−₹18,500', badge: 'Review queue: confirm invoice link', bColor: '#D4922A' },
                  ].map((row, i) => (
                    <div key={i} style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid rgba(140, 150, 148, 0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(232,240,238,0.4)', marginBottom: '4px' }}>
                        <span className="truncate mr-2"><strong style={{ color: '#E8F0EE' }}>{row.vendor}</strong> · {row.date}</span>
                        <span style={{ color: '#E8F0EE', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }} className="shrink-0">{row.amt}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ fontSize: '10px', background: 'rgba(140, 150, 148, 0.06)', color: 'rgba(232, 240, 238, 0.65)', border: '1px solid rgba(140, 150, 148, 0.10)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{row.cat}</span>
                        <span style={{ fontSize: '10.5px', color: row.bColor, fontWeight: 600 }} className="whitespace-nowrap">⚠ {row.badge}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ background: 'rgba(140, 150, 148, 0.05)', border: '1px solid rgba(140, 150, 148, 0.10)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'rgba(232, 240, 238, 0.60)' }}>
                    <strong>Benefits:</strong> Categorized transactions, clean review queue, automated risk snapshot, and accountant-ready reports.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    );
  }

  return (
    <section 
      ref={sectionRef}
      style={{ 
        position: 'relative',
        height: '200vh',
        background: 'transparent',
      }}
    >
      <div 
        style={{
          position: 'sticky',
          top: '72px',
          height: 'calc(100vh - 72px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '0 24px' }}>
          {/* Two-column container */}
          <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: '64px', alignItems: 'center' }}>
            
            {/* Left Column: Copy + Toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ color: '#138C7E', fontFamily: 'ui-monospace, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
                002B — THE DIFFERENCE
              </div>
              <h2 style={{ fontWeight: 700, fontSize: 'clamp(28px, 3.5vw, 44px)', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0, color: '#E8F0EE' }}>
                Before Kaeo vs. <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400, color: '#138C7E', textTransform: 'none' }}>Review-ready.</span>
              </h2>
              <p style={{ fontSize: '15px', color: 'rgba(232,240,238,0.45)', lineHeight: 1.6, margin: 0 }}>
                Stop wasting hours untangling raw narrations, matching receipts, and searching for invoice files. Toggle below or scroll down to see how Kaeo transforms raw statement data into a clean, audited ledger.
              </p>

              {/* Sliding Toggle Control */}
              <SlidingSegmentControl
                options={[
                  { value: 'before', label: 'Before Kaeo' },
                  { value: 'after', label: 'Review-ready' },
                ]}
                activeValue={mode}
                onChange={toggleMode}
                activeColor={mode === 'before' ? '#E05450' : '#138C7E'}
                className="w-[280px]"
              />
            </div>

            {/* Right Column: Morphing Cards Container */}
            <div style={{ position: 'relative', width: '100%', minHeight: '410px' }}>
              {/* Before Card */}
              <div
                style={{
                  position: mode === 'before' ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  opacity: mode === 'before' ? 1 : 0,
                  transform: mode === 'before' ? 'translateY(0) scale(1)' : 'translateY(15px) scale(0.96)',
                  pointerEvents: mode === 'before' ? 'auto' : 'none',
                  transition: reducedMotion 
                    ? 'opacity 0.15s' 
                    : 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  background: 'rgba(10, 18, 16, 0.78)',
                  backdropFilter: 'blur(18px) saturate(135%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(135%)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#E05450', fontWeight: 700, letterSpacing: '0.05em' }}>❌ CRYPTIC BANK STATEMENT ROWS & UNRECONCILED SHEETS</div>
                  {[
                    { date: '28/04/26', narr: 'UPI/9820123456/Rent/Paytm', amt: '1,80,000.00 Dr', cat: '[Uncategorized]', note: 'Who was paid? Is there a rent receipt?' },
                    { date: '26/04/26', narr: 'NEFT-MUM-SUP-23423-MUMBAI SUPPLIES PVT', amt: '1,24,000.00 Dr', cat: '[Uncategorized]', note: 'Is this invoice attached? Price looks higher than usual.' },
                    { date: '25/04/26', narr: 'UPI/7839XXXXX/REF99213/ANON', amt: '18,500.00 Dr', cat: '[Uncategorized]', note: 'Completely unidentified transaction payee.' },
                  ].map((row, i) => (
                    <div key={i} style={{ padding: '12px', background: 'rgba(224, 84, 80, 0.02)', borderRadius: '8px', border: '1px solid rgba(224, 84, 80, 0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(232,240,238,0.35)', marginBottom: '4px', fontFamily: 'ui-monospace, monospace' }}>
                        <span className="truncate mr-2">{row.date} · {row.narr}</span>
                        <span style={{ color: '#E05450', fontWeight: 600 }} className="shrink-0">{row.amt}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ color: '#E05450', fontWeight: 700 }}>{row.cat}</span>
                        <span style={{ color: 'rgba(232,240,238,0.4)', fontStyle: 'italic' }}>❓ {row.note}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ background: 'rgba(224,84,80,0.06)', border: '1px solid rgba(224,84,80,0.20)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#E05450' }}>
                    <strong>Issues:</strong> Messy statement rows, unclear UPI narrations, uncategorized payments, and missing invoice context.
                  </div>
                </div>
              </div>

              {/* Review-ready Card */}
              <div
                style={{
                  position: mode === 'after' ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  opacity: mode === 'after' ? 1 : 0,
                  transform: mode === 'after' ? 'translateY(0) scale(1)' : 'translateY(15px) scale(0.96)',
                  pointerEvents: mode === 'after' ? 'auto' : 'none',
                  transition: reducedMotion 
                    ? 'opacity 0.15s' 
                    : 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  background: 'rgba(10, 18, 16, 0.78)',
                  backdropFilter: 'blur(18px) saturate(135%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(135%)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#138C7E', fontWeight: 700, letterSpacing: '0.05em' }}>⚡ CLEAN, RECONCILED KAEO LEDGER ROWS</div>
                  {[
                    { date: '28 Apr 2026', vendor: 'Bombay Rent Ltd', cat: 'Rent & Utilities', amt: '−₹1,80,000', badge: 'Duplicate payment suspect', bColor: '#E05450' },
                    { date: '26 Apr 2026', vendor: 'Mumbai Supplies Pvt Ltd', cat: 'Capital Expense', amt: '−₹1,24,000', badge: 'High-Value Outflow (3.2x avg)', bColor: '#E05450' },
                    { date: '25 Apr 2026', vendor: 'UPI Payee / Rent', cat: 'Rent & Utilities', amt: '−₹18,500', badge: 'Review queue: confirm invoice link', bColor: '#D4922A' },
                  ].map((row, i) => (
                    <div key={i} style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid rgba(140, 150, 148, 0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(232,240,238,0.4)', marginBottom: '4px' }}>
                        <span className="truncate mr-2"><strong style={{ color: '#E8F0EE' }}>{row.vendor}</strong> · {row.date}</span>
                        <span style={{ color: '#E8F0EE', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }} className="shrink-0">{row.amt}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ fontSize: '10px', background: 'rgba(140, 150, 148, 0.06)', color: 'rgba(232, 240, 238, 0.65)', border: '1px solid rgba(140, 150, 148, 0.10)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{row.cat}</span>
                        <span style={{ fontSize: '10.5px', color: row.bColor, fontWeight: 600 }} className="whitespace-nowrap">⚠ {row.badge}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ background: 'rgba(140, 150, 148, 0.05)', border: '1px solid rgba(140, 150, 148, 0.10)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'rgba(232, 240, 238, 0.60)' }}>
                    <strong>Benefits:</strong> Categorized transactions, clean review queue, automated risk snapshot, and accountant-ready reports.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════
   3. INTERACTIVE RISK CARDS COMPONENT
═══════════════════════════════════════════════ */
const InteractiveRiskCards: React.FC = () => {
  const [activeCard, setActiveCard] = useState<number | null>(null); // mobile inline state
  const [selectedCard, setSelectedCard] = useState<number>(0); // desktop click state
  const [hoveredCard, setHoveredCard] = useState<number | null>(null); // desktop hover state
  const [isDesktop, setIsDesktop] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const checkMedia = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkMedia();
    window.addEventListener('resize', checkMedia);
    return () => window.removeEventListener('resize', checkMedia);
  }, []);

  const cards = [
    {
      title: "High-value payments",
      description: "Single large debits that deviate significantly from your vendor payment patterns. Worth a second look before month close.",
      example: "₹1,24,000 → Mumbai Supplies · 3.2× above avg",
      whyMatters: "Large outflows can hide accidental or unauthorized spend.",
      whatKaeoShows: "Amount, vendor, date, category, and review status.",
      nextReview: "Confirm purpose and supporting invoice.",
      accentColor: '#D3524A', // muted red
      mutedBg: 'rgba(211, 82, 74, 0.04)',
      borderTint: 'rgba(211, 82, 74, 0.20)'
    },
    {
      title: "Duplicate suspects",
      description: "Same vendor, same amount, close date — often from double-clicking payment portals or failed gateway retries.",
      example: "₹75,000 × 2 → Slack Technologies · 12 Apr",
      whyMatters: "Same amount/vendor close together may indicate double payment.",
      whatKaeoShows: "Matching transactions and timing.",
      nextReview: "Mark duplicate or clear if intentional.",
      accentColor: '#E2843A', // muted amber/orange
      mutedBg: 'rgba(226, 132, 58, 0.04)',
      borderTint: 'rgba(226, 132, 58, 0.20)'
    },
    {
      title: "Balance mismatch",
      description: "Closing balance from your statement doesn't match the running total from parsed transactions — missing rows or import errors.",
      example: "₹8,400 gap → closing balance vs. transaction sum",
      whyMatters: "Ledger movement may not match expected balance.",
      whatKaeoShows: "Period movement and mismatch amount.",
      nextReview: "Check missing rows or import issues.",
      accentColor: '#E6C02E', // muted amber/yellow
      mutedBg: 'rgba(230, 192, 46, 0.04)',
      borderTint: 'rgba(230, 192, 46, 0.20)'
    },
    {
      title: "Invoice mismatch",
      description: "Invoice amount doesn't match the bank debit for the same vendor — partial payments, rounding errors, or billing discrepancies.",
      example: "Invoice ₹48,200 vs. debit ₹50,610 · tax discrepancy",
      whyMatters: "Invoice and payment records may not line up.",
      whatKaeoShows: "Vendor, invoice, payment, and difference.",
      nextReview: "Confirm invoice/payment pairing.",
      accentColor: '#E06D53', // muted red-orange
      mutedBg: 'rgba(224, 109, 83, 0.04)',
      borderTint: 'rgba(224, 109, 83, 0.20)'
    },
    {
      title: "Uncategorized spend",
      description: "Transactions with cryptic UPI narrations or generic NEFT descriptions that don't map to a known vendor or category.",
      example: "11 rows → UPI/Unknown/various · needs mapping",
      whyMatters: "Reports are weaker when spend is unmapped.",
      whatKaeoShows: "Rows needing category review.",
      nextReview: "Assign category before export.",
      accentColor: '#5C7C8A', // muted slate/blue
      mutedBg: 'rgba(92, 124, 138, 0.04)',
      borderTint: 'rgba(92, 124, 138, 0.20)'
    },
    {
      title: "Vendor concentration",
      description: "One vendor consuming a disproportionate share of your monthly outflow — a supply chain or negotiation flag.",
      example: "62% of Apr outflow → 3 vendor accounts",
      whyMatters: "Too much spend with one vendor can create dependency or leakage.",
      whatKaeoShows: "Top vendor exposure and recurring spend.",
      nextReview: "Review necessity and alternatives.",
      accentColor: '#8A5FE2', // muted purple/indigo
      mutedBg: 'rgba(138, 95, 226, 0.04)',
      borderTint: 'rgba(138, 95, 226, 0.20)'
    }
  ];

  const activeIdx = isDesktop ? (hoveredCard !== null ? hoveredCard : selectedCard) : activeCard;
  const activeCardObj = activeIdx !== null ? cards[activeIdx] : null;

  if (!isDesktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {cards.map((card, idx) => {
          const isActive = activeCard === idx;
          const accent = card.accentColor;
          
          const bg = isActive ? 'rgba(255, 255, 255, 0.03)' : '#121514';
          const border = isActive ? 'rgba(140, 150, 148, 0.35)' : 'rgba(140, 150, 148, 0.10)';
          const dotColor = isActive ? accent : 'rgba(140, 150, 148, 0.20)';
          const previewTextColor = isActive ? 'rgba(232, 240, 238, 0.80)' : 'rgba(232, 240, 238, 0.50)';
          const titleColor = isActive ? '#E8F0EE' : 'rgba(232, 240, 238, 0.85)';
          const descColor = isActive ? 'rgba(232, 240, 238, 0.65)' : 'rgba(232, 240, 238, 0.45)';

          return (
            <div
              key={idx}
              tabIndex={0}
              onClick={() => setActiveCard(isActive ? null : idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveCard(isActive ? null : idx);
                }
              }}
              style={{
                background: bg,
                border: '1.5px solid',
                borderColor: border,
                borderRadius: '14px',
                padding: '20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: titleColor, margin: 0 }}>{card.title}</h4>
                <span style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: dotColor,
                  boxShadow: isActive ? `0 0 6px ${accent}` : 'none',
                  transition: 'all 0.2s ease',
                }} />
              </div>
              <p style={{ fontSize: '13px', color: descColor, lineHeight: 1.5, margin: 0 }}>{card.description}</p>
              
              <div style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '11px',
                color: previewTextColor,
                background: 'rgba(140, 150, 148, 0.04)',
                border: '1px solid rgba(140, 150, 148, 0.08)',
                borderRadius: '6px',
                padding: '6px 10px',
                transition: 'color 0.2s ease',
              }}>
                {card.example}
              </div>

              {isActive && (
                <div style={{
                  marginTop: '4px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '12.5px',
                  color: 'rgba(232,240,238,0.65)',
                  lineHeight: 1.5,
                }} className="animate-kaeo-fade">
                  <div>
                    <strong style={{ color: accent, display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Why it matters:</strong>
                    <span>{card.whyMatters}</span>
                  </div>
                  <div>
                    <strong style={{ color: accent, display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>What Kaeo shows:</strong>
                    <span>{card.whatKaeoShows}</span>
                  </div>
                  <div>
                    <strong style={{ color: accent, display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>What to review next:</strong>
                    <span style={{ color: '#E8F0EE', fontWeight: 500 }}>{card.nextReview}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '58% 42%', gap: '32px', alignItems: 'stretch' }}>
      {/* Left Column: Grid of cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {cards.map((card, idx) => {
          const isSelected = selectedCard === idx;
          const isHovered = hoveredCard === idx;
          const isActive = isSelected || isHovered;
          const accent = card.accentColor;

          const bg = isSelected 
            ? 'rgba(255, 255, 255, 0.03)' 
            : isHovered 
              ? 'rgba(255, 255, 255, 0.015)' 
              : 'rgba(10, 18, 16, 0.78)';

          const border = isSelected 
            ? 'rgba(140, 150, 148, 0.35)' 
            : isHovered 
              ? 'rgba(140, 150, 148, 0.22)' 
              : 'rgba(140, 150, 148, 0.10)';

          const dotColor = isSelected 
            ? accent 
            : isHovered 
              ? `${accent}b0` 
              : 'rgba(140, 150, 148, 0.20)';

          const titleColor = isActive ? '#E8F0EE' : 'rgba(232, 240, 238, 0.85)';
          const descColor = isActive ? 'rgba(232, 240, 238, 0.65)' : 'rgba(232, 240, 238, 0.45)';
          const previewTextColor = isActive ? 'rgba(232, 240, 238, 0.80)' : 'rgba(232, 240, 238, 0.50)';

          return (
            <div
              key={idx}
              tabIndex={0}
              onMouseEnter={() => setHoveredCard(idx)}
              onMouseLeave={() => setHoveredCard(null)}
              onFocus={() => setHoveredCard(idx)}
              onBlur={() => setHoveredCard(null)}
              onClick={() => setSelectedCard(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedCard(idx);
                }
              }}
              style={{
                background: bg,
                backdropFilter: 'blur(18px) saturate(135%)',
                WebkitBackdropFilter: 'blur(18px) saturate(135%)',
                border: '1px solid',
                borderColor: border,
                borderRadius: '14px',
                padding: '20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                outline: 'none',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isSelected 
                  ? `0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)` 
                  : isHovered 
                    ? `0 4px 12px rgba(0, 0, 0, 0.20)` 
                    : 'none',
                transition: reducedMotion 
                  ? 'border-color 0.15s, background-color 0.15s' 
                  : 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                minHeight: '140px',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: titleColor, margin: 0, letterSpacing: '-0.01em' }}>{card.title}</h4>
                <span style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: dotColor,
                  boxShadow: isSelected ? `0 0 6px ${accent}` : 'none',
                  transition: 'all 0.2s ease',
                }} />
              </div>
              <p style={{ fontSize: '12.5px', color: descColor, lineHeight: 1.5, margin: 0 }}>{card.description}</p>
              <div style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '10.5px',
                color: previewTextColor,
                background: 'rgba(140, 150, 148, 0.03)',
                border: '1px solid rgba(140, 150, 148, 0.06)',
                borderRadius: '6px',
                padding: '4px 8px',
                marginTop: '4px',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'color 0.2s ease',
              }}>
                {card.example}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right Column: Detail preview panel */}
      {activeCardObj && (
        <div style={{ 
          background: 'rgba(10, 18, 16, 0.78)', 
          backdropFilter: 'blur(18px) saturate(135%)',
          WebkitBackdropFilter: 'blur(18px) saturate(135%)',
          border: '1px solid rgba(255, 255, 255, 0.07)', 
          borderRadius: '16px', 
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
          height: '100%',
          justifyContent: 'center',
          position: 'relative',
          transition: reducedMotion ? 'border-color 0.2s' : 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div key={activeIdx} className="animate-kaeo-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <span style={{ 
                fontSize: '10px', 
                color: activeCardObj.accentColor, 
                background: `${activeCardObj.accentColor}12`, 
                border: `1px solid ${activeCardObj.accentColor}25`, 
                padding: '3px 8px', 
                borderRadius: '4px', 
                fontWeight: 700, 
                fontFamily: 'ui-monospace, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'inline-block',
                marginBottom: '10px'
              }}>
                Kaeo Risk Analysis
              </span>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#E8F0EE', margin: 0, letterSpacing: '-0.02em' }}>
                {activeCardObj.title}
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'rgba(232,240,238,0.70)', lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: activeCardObj.accentColor, display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Why it matters</strong>
                <span>{activeCardObj.whyMatters}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />
              <div>
                <strong style={{ color: activeCardObj.accentColor, display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>What Kaeo shows</strong>
                <span>{activeCardObj.whatKaeoShows}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />
              <div>
                <strong style={{ color: activeCardObj.accentColor, display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>What to review next</strong>
                <span style={{ color: '#E8F0EE', fontWeight: 500 }}>{activeCardObj.nextReview}</span>
              </div>
            </div>

            <div style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '11px',
              color: activeCardObj.accentColor,
              background: `${activeCardObj.accentColor}06`,
              border: `1px solid ${activeCardObj.accentColor}18`,
              borderRadius: '8px',
              padding: '10px 14px',
              marginTop: '6px',
            }}>
              <span style={{ color: 'rgba(232,240,238,0.35)', marginRight: '6px' }}>Example:</span>
              {activeCardObj.example}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   4. DYNAMIC REPORT PREVIEW MOCK
═══════════════════════════════════════════════ */
const InteractiveReportsSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const checkMedia = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setPrefersReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    checkMedia();
    window.addEventListener('resize', checkMedia);
    return () => window.removeEventListener('resize', checkMedia);
  }, []);

  useEffect(() => {
    if (!isDesktop || prefersReduced) return;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const navHeight = 72;
      const stickyHeight = window.innerHeight - navHeight;
      const totalScrollRange = rect.height - stickyHeight;

      if (totalScrollRange <= 0) return;

      const currentScroll = navHeight - rect.top;
      const progress = Math.max(0, Math.min(1, currentScroll / totalScrollRange));
      
      const stepIndex = Math.min(3, Math.floor(progress * 4));
      setActiveStep(stepIndex);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDesktop, prefersReduced]);

  const handleStepClick = (idx: number) => {
    if (!isDesktop || prefersReduced) {
      setActiveStep(idx);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top;
    const navHeight = 72;
    const stickyHeight = window.innerHeight - navHeight;
    const totalScrollRange = rect.height - stickyHeight;

    const targetProgress = (idx + 0.5) / 4;
    const targetScrollY = scrollTop - navHeight + targetProgress * totalScrollRange;

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth'
    });
  };

  const steps = [
    {
      label: "Summary",
      title: "Summary Ledger Review",
      description: "Get an instant, high-level summary of your month's cash flow. View total inflow, outflow, and net movement verified against statement balances."
    },
    {
      label: "Risks",
      title: "Automated Risk Audits",
      description: "Review flagged duplicate payments, balance discrepancies, and high-value transactions. Clear risks with confidence before export."
    },
    {
      label: "Vendors",
      title: "Vendor Spend Analytics",
      description: "Track where your money is concentrated. Spot top vendors, subscription patterns, and category distributions to prevent budget leakage."
    },
    {
      label: "Pack",
      title: "Export Accountant Pack",
      description: "Download a structured review pack containing your verified transaction ledger as a clean CSV, plus all matched invoices zipped and ready for Zoho/Tally."
    }
  ];

  const useStickyScroll = isDesktop && !prefersReduced;

  // Render dynamic contents for right-side preview card
  const renderPreviewContent = (stepIdx: number) => {
    switch (stepIdx) {
      case 0:
        return (
          <div key="summary" className="animate-kaeo-fade">
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'rgba(140, 150, 148, 0.08)' }}>
              {[
                { label: 'Money In', value: '+₹12,80,400', color: '#22B573' },
                { label: 'Money Out', value: '−₹8,42,200', color: '#E05450' },
                { label: 'Net Movement', value: '+₹4,38,200', color: '#22B573' },
              ].map((stat, i) => (
                <div key={i} style={{ padding: '16px 18px', background: '#121514' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '6px' }}>{stat.label}</div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: stat.color, letterSpacing: '-0.02em', fontFamily: 'ui-monospace, monospace' }}>{stat.value}</div>
                </div>
              ))}
            </div>
            
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '10.5px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '10px' }}>Summary Ledger View</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(140, 150, 148, 0.08)' }}>
                    {['Date', 'Description', 'Category', 'Amount', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(232,240,238,0.30)', fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { date: '28 Apr', desc: 'Razorpay Settlement', cat: 'Inflow / Revenue', amount: '+₹4,80,000', status: 'Verified', sColor: '#22B573', aColor: '#22B573' },
                    { date: '26 Apr', desc: 'Mumbai Supplies Pvt Ltd', cat: 'Vendor Payment', amount: '−₹1,24,000', status: 'Needs review', sColor: '#D4922A', aColor: '#E05450' },
                    { date: '25 Apr', desc: 'UPI/Unknown Narration', cat: 'Uncategorized', amount: '−₹18,500', status: 'Flagged', sColor: '#E05450', aColor: '#E05450' },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(140, 150, 148, 0.06)' }}>
                      <td style={{ padding: '8px 8px', color: 'rgba(232,240,238,0.40)', fontFamily: 'ui-monospace, monospace', fontSize: '10.5px' }}>{row.date}</td>
                      <td style={{ padding: '8px 8px', color: '#E8F0EE', fontWeight: 500 }}>{row.desc}</td>
                      <td style={{ padding: '8px 8px' }}>
                        <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(140, 150, 148, 0.06)', color: 'rgba(232, 240, 238, 0.65)', border: '1px solid rgba(140, 150, 148, 0.10)', fontWeight: 600 }}>{row.cat}</span>
                      </td>
                      <td style={{ padding: '8px 8px', color: row.aColor, fontWeight: 700, fontFamily: 'ui-monospace, monospace', fontSize: '10.5px', textAlign: 'right' }}>{row.amount}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: '8.5px', padding: '2px 7px', borderRadius: '4px', background: `${row.sColor}18`, color: row.sColor, border: `1px solid ${row.sColor}28`, fontWeight: 700, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(140, 150, 148, 0.04)', borderRadius: '8px', border: '1px solid rgba(140, 150, 148, 0.08)', fontSize: '11px', color: 'rgba(232,240,238,0.50)' }}>
                <span style={{ color: '#138C7E', fontWeight: 600 }}>Reconciliation status: 97.4% complete</span> · <span style={{ color: '#D4922A', fontWeight: 600 }}>3 anomalies flagged</span>
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div key="risks" className="animate-kaeo-fade" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '10.5px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '14px' }}>Active Risk Flags & Audit Notes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { type: 'Duplicate suspect', desc: 'Bombay Rent Ltd', details: 'Matching amount ₹1,80,000 paid twice in 24 hours. Second transaction has duplicate reference.', action: 'Confirm gateway retry error.', color: '#E05450' },
                { type: 'High-value outflow', desc: 'Mumbai Supplies Pvt Ltd', details: 'Single payment of ₹1,24,000. Deviates 3.2× from vendor average of ₹38,750.', action: 'Confirm invoice matches payout.', color: '#D4922A' },
                { type: 'Balance Mismatch', desc: 'HDFC Statement Ledger', details: 'Running ledger totals mismatch HDFC closing balance sheet by ₹8,400.', action: 'Locate missing statement pages.', color: '#D4922A' }
              ].map((risk, i) => (
                <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: `1px solid ${risk.color}25` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 800, color: risk.color, background: `${risk.color}15`, border: `1px solid ${risk.color}25`, padding: '2px 6px', borderRadius: '4px' }}>{risk.type}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#E8F0EE' }}>{risk.desc}</span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'rgba(232,240,238,0.55)', margin: '0 0 6px 0', lineHeight: 1.4 }}>{risk.details}</p>
                  <div style={{ fontSize: '10.5px', color: risk.color, fontWeight: 600 }}>Action: {risk.action}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div key="vendors" className="animate-kaeo-fade" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '10.5px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '14px' }}>Vendor Spend concentration Breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {[
                { vendor: 'Mumbai Supplies', spend: '₹3,40,000', share: '62%', status: 'Flagged anomalies', sColor: '#E05450' },
                { vendor: 'Bombay Rent Ltd', spend: '₹1,80,000', share: '32%', status: 'Regular / Monthly', sColor: 'rgba(232,240,238,0.40)' },
                { vendor: 'Slack Technologies', spend: '₹30,000', share: '6%', status: 'Subscription', sColor: '#138C7E' }
              ].map((v, i) => (
                <div key={i} style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px solid rgba(140, 150, 148, 0.08)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#E8F0EE' }}>{v.vendor}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#138C7E', fontFamily: 'ui-monospace, monospace' }}>{v.spend}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(232, 240, 238, 0.40)' }}>{v.share} of outflow</span>
                  </div>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: v.sColor, marginTop: '8px' }}>{v.status}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(19, 140, 126, 0.03)', border: '1px solid rgba(19, 140, 126, 0.12)', borderRadius: '8px', padding: '10px 14px', fontSize: '11.5px', color: 'rgba(232,240,238,0.60)' }}>
              <strong>Insight:</strong> 1 vendor consumes &gt;60% of outflows. This concentration was flagged for supply chain dependency audit.
            </div>
          </div>
        );
      case 3:
        return (
          <div key="pack" className="animate-kaeo-fade" style={{ padding: '24px 30px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(19, 140, 126, 0.03)', border: '1px solid rgba(19, 140, 126, 0.15)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#E8F0EE', display: 'block' }}>Finance Review Pack · April 2026</span>
                  <span style={{ fontSize: '11px', color: 'rgba(232,240,238,0.45)', display: 'block', marginTop: '2px' }}>Verified ledger CSV + Scanned invoice attachment ZIP</span>
                </div>
                <span style={{ fontSize: '10px', color: '#22B573', fontWeight: 700, background: 'rgba(34, 181, 115, 0.1)', border: '1px solid rgba(34, 181, 115, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>✓ READY</span>
              </div>
              
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.4)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Transactions</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#138C7E', fontFamily: 'ui-monospace, monospace' }}>142 verified</span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.4)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Risks Cleared</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#22B573', fontFamily: 'ui-monospace, monospace' }}>3 resolved</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => {
                setDownloaded(true);
                setTimeout(() => setDownloaded(false), 3000);
              }}
              style={{ 
                width: '100%', 
                padding: '16px', 
                background: downloaded ? 'rgba(34, 181, 115, 0.15)' : '#138C7E', 
                color: downloaded ? '#22B573' : '#050F0D', 
                border: downloaded ? '1px solid rgba(34, 181, 115, 0.3)' : 'none', 
                borderRadius: '10px', 
                fontWeight: 700, 
                fontSize: '13px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(19, 140, 126, 0.15)'
              }}
            >
              <span>{downloaded ? '✓ Downloaded accountant pack' : '📥 Download Accountant Export (ZIP)'}</span>
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const activeStepObj = steps[activeStep];

  if (!useStickyScroll) {
    // Mobile / fallback layout: static layout with tab control to switch preview
    return (
      <section style={{ padding: '72px 24px', background: 'transparent' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <SectionLabel code="006" label="REPORTS" />
            <h2 style={{
              fontWeight: 700,
              fontSize: 'clamp(28px, 6vw, 36px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              margin: '0 0 16px',
              color: '#E8F0EE',
            }}>
              Reports your accountant <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400, color: '#138C7E', textTransform: 'none' }}>can actually use.</span>
            </h2>
            <p style={{
              fontSize: '15px',
              color: 'rgba(232, 240, 238, 0.45)',
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}>
              Not raw exports. Clean, structured finance review packs with period summary, open risks, uncategorized items, and vendor spend — ready to share.
            </p>
            
            <SlidingSegmentControl
              options={[
                { value: '0', label: 'Summary' },
                { value: '1', label: 'Risks' },
                { value: '2', label: 'Vendors' },
                { value: '3', label: 'Pack' },
              ]}
              activeValue={String(activeStep)}
              onChange={(val) => setActiveStep(Number(val))}
              activeColor="#138C7E"
              className="w-full mb-8"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#E8F0EE', marginBottom: '8px' }}>
                {activeStepObj.title}
              </h3>
              <p style={{ fontSize: '13.5px', color: 'rgba(232, 240, 238, 0.65)', lineHeight: 1.55, margin: 0 }}>
                {activeStepObj.description}
              </p>
            </div>
            
            <div style={{
              background: '#121514',
              border: '1px solid rgba(140, 150, 148, 0.12)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
              minHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              {/* Card Header (stable) */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px',
                background: 'rgba(140, 150, 148, 0.05)',
                borderBottom: '1px solid rgba(140, 150, 148, 0.08)',
                flexWrap: 'wrap',
                gap: '8px',
              }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'rgba(232,240,238,0.40)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em', marginBottom: '2px' }}>KAEO · FINANCE REVIEW PACK</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#E8F0EE', letterSpacing: '-0.02em', fontStyle: 'italic' }}>April 2026 Report Preview</div>
                </div>
              </div>
              {renderPreviewContent(activeStep)}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Desktop Pinned Scrollytelling
  return (
    <section 
      ref={containerRef}
      style={{
        position: 'relative',
        height: '350vh',
        background: 'transparent',
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: '72px',
          height: 'calc(100vh - 72px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: '40% 60%',
            gap: '64px',
            alignItems: 'center',
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 64px',
          }}
          className="workflow-grid"
        >
          {/* Left Column: Segment toggles + Copy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div>
              <SectionLabel code="006" label="REPORTS" />
              <h2 style={{
                fontWeight: 700,
                fontSize: 'clamp(32px, 3.5vw, 44px)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                margin: 0,
                color: '#E8F0EE',
              }}>
                Reports your accountant <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400, color: '#138C7E', textTransform: 'none' }}>can actually use.</span>
              </h2>
            </div>

            <div style={{ minHeight: '120px' }}>
              <div key={activeStep} className="animate-kaeo-fade" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#E8F0EE', margin: 0 }}>
                  {activeStepObj.title}
                </h3>
                <p style={{ fontSize: '14.5px', color: 'rgba(232, 240, 238, 0.45)', lineHeight: 1.6, margin: 0 }}>
                  {activeStepObj.description}
                </p>
              </div>
            </div>

            <SlidingSegmentControl
              options={[
                { value: '0', label: 'Summary' },
                { value: '1', label: 'Risks' },
                { value: '2', label: 'Vendors' },
                { value: '3', label: 'Pack' },
              ]}
              activeValue={String(activeStep)}
              onChange={(val) => handleStepClick(Number(val))}
              activeColor="#138C7E"
              className="w-full max-w-[360px]"
            />
          </div>

          {/* Right Column: Preview window card */}
          <div style={{
            background: '#121514',
            border: '1px solid rgba(140, 150, 148, 0.12)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            width: '100%',
            minHeight: '440px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Card Header (stable) */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px',
              background: 'rgba(140, 150, 148, 0.05)',
              borderBottom: '1px solid rgba(140, 150, 148, 0.08)',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'rgba(232,240,238,0.40)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em', marginBottom: '2px' }}>KAEO · FINANCE REVIEW PACK</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#E8F0EE', letterSpacing: '-0.02em', fontStyle: 'italic' }}>April 2026 Report Preview</div>
              </div>
            </div>

            {/* Render active content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {renderPreviewContent(activeStep)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════
   LIBBY CHAT MOCK
═══════════════════════════════════════════════ */
const LibbyChatMock = () => (
  <div style={{
    background: '#121514',
    border: '1px solid rgba(140, 150, 148, 0.12)',
    borderRadius: '16px',
    padding: '20px',
    fontFamily: 'inherit',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#138C7E', boxShadow: '0 0 8px #138C7E' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#E8F0EE' }}>Ask Libby</span>
      </div>
      <span style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em', color: 'rgba(232, 240, 238, 0.30)', textTransform: 'uppercase' as const, fontWeight: 600 }}>Your Kaeo data · Apr 2026</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: 'rgba(19,140,126,0.10)', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: '13px', color: '#E8F0EE', maxWidth: '80%', lineHeight: 1.5 }}>
          Which vendor is taking most of my spend this month?
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(140,150,148,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#138C7E', display: 'inline-block', boxShadow: '0 0 6px rgba(19,140,126,0.45)' }} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(140, 150, 148, 0.08)', borderRadius: '2px 12px 12px 12px', padding: '12px 14px', fontSize: '13px', color: 'rgba(232,240,238,0.65)', lineHeight: 1.6, flex: 1 }}>
          Based on your uploaded statements: <strong style={{ color: '#E8F0EE' }}>Mumbai Supplies Pvt Ltd</strong> accounts for <span style={{ color: '#D4922A', fontWeight: 700 }}>₹1,24,000</span> — your largest single vendor outflow this period. This is <span style={{ color: '#D4922A' }}>3.2× above</span> your April average.
          <br /><br />
          <span style={{ color: '#138C7E' }}>2 other payments to this vendor in March</span> suggest a recurring relationship worth reviewing.
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: 'rgba(19,140,126,0.10)', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: '13px', color: '#E8F0EE', maxWidth: '80%', lineHeight: 1.5 }}>
          Is my report ready to send to my CA?
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(140,150,148,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#138C7E', display: 'inline-block', boxShadow: '0 0 6px rgba(19,140,126,0.45)' }} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(140, 150, 148, 0.08)', borderRadius: '2px 12px 12px 12px', padding: '12px 14px', fontSize: '13px', color: 'rgba(232,240,238,0.65)', lineHeight: 1.6, flex: 1 }}>
          Not yet — <span style={{ color: '#D4922A', fontWeight: 600 }}>11 rows are uncategorized</span> and <span style={{ color: '#E05450', fontWeight: 600 }}>1 duplicate payment needs your confirmation</span>. Once you resolve those, report readiness will reach 100%.
        </div>
      </div>
    </div>
    <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(140, 150, 148, 0.05)', border: '1px solid rgba(140, 150, 148, 0.10)', borderRadius: '8px', fontSize: '11px', color: 'rgba(232,240,238,0.40)', lineHeight: 1.5, fontStyle: 'italic' }}>
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
      background: '#070908', // solid continuous dark graphite base
      color: '#E8F0EE',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      minHeight: '100vh',
      position: 'relative',
      overflowX: 'clip',
    } as React.CSSProperties,

    // Section container
    section: (_bg?: string): React.CSSProperties => ({
      padding: '100px 48px',
      background: 'transparent',
      position: 'relative',
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
      color: '#138C7E',
      textTransform: 'none',
    } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      {/* Ambient background glows */}
      <div style={{ position: 'absolute', top: '0%', left: '50%', transform: 'translateX(-50%)', width: '100vw', height: '100vh', background: 'radial-gradient(circle at top, #141817 0%, transparent 80%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '15%', left: '10%', width: '70vw', height: '70vw', background: 'radial-gradient(circle, rgba(19, 140, 126, 0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '35%', right: '5%', width: '80vw', height: '80vw', background: 'radial-gradient(circle, rgba(140, 150, 148, 0.02) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '55%', left: '-10%', width: '80vw', height: '80vw', background: 'radial-gradient(circle, rgba(19, 140, 126, 0.03) 0%, transparent 75%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '75%', right: '-10%', width: '75vw', height: '75vw', background: 'radial-gradient(circle, rgba(140, 150, 148, 0.02) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '90%', left: '15%', width: '65vw', height: '65vw', background: 'radial-gradient(circle, rgba(19, 140, 126, 0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <KaeoLandingHeader />

      {/* ═══════ 001 — HERO ═══════ */}
      <div id="product">
        <KaeoHero />
      </div>

      {/* ═══════ 002 — HOW IT WORKS ═══════ */}
      <InteractiveWorkflowSection />

      {/* ═══════ 002B — BEFORE AFTER TOGGLE COMPARISON ═══════ */}
      <BeforeAfterComparison />

      {/* ═══════ 003 — WHAT KAEO CATCHES ═══════ */}
      <section id="what-kaeo-catches" style={S.section('#121514')}>
        <div style={S.inner}>
          <SectionLabel code="003" label="WHAT KAEO CATCHES" />
          <h2 style={S.h2}>
            What Kaeo flags
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(232,240,238,0.45)', maxWidth: '520px', marginBottom: '56px', lineHeight: 1.6 }}>
            Not theoretical risks. Actual patterns that surface when you properly parse Indian bank statements. Click to expand details.
          </p>
          <InteractiveRiskCards />
        </div>
      </section>

      {/* ═══════ 004 — BUILT FOR INDIA ═══════ */}
      <section style={S.section('#080A09')}>
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
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(140,150,148,0.08)', border: '1px solid rgba(140,150,148,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                      <span style={{ color: '#138C7E', fontSize: '10px', fontWeight: 700 }}>✓</span>
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
                background: 'rgba(10, 18, 16, 0.78)',
                backdropFilter: 'blur(18px) saturate(135%)',
                WebkitBackdropFilter: 'blur(18px) saturate(135%)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '16px',
                padding: '20px',
                fontFamily: 'ui-monospace, monospace',
                boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
              }}>
                <div style={{ fontSize: '10px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.08em', marginBottom: '12px', borderBottom: '1px solid rgba(140, 150, 148, 0.08)', paddingBottom: '10px' }}>
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
                    borderBottom: '1px solid rgba(140, 150, 148, 0.06)',
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
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(140, 150, 148, 0.08)' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.35)' }}>↳ Kaeo parsed 142 rows · 11 uncategorized</span>
                  <span style={{ fontSize: '10px', color: '#138C7E', fontWeight: 700 }}>● processed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 005 — ASK LIBBY ═══════ */}
      <section style={S.section('#121514')}>
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
              <div style={{ padding: '16px 18px', background: 'rgba(140,150,148,0.05)', border: '1px solid rgba(140,150,148,0.10)', borderRadius: '10px', fontSize: '13px', color: 'rgba(232,240,238,0.45)', lineHeight: 1.6, marginBottom: '24px' }}>
                <span style={{ color: '#138C7E', fontWeight: 600 }}>Note:</span> AI-assisted explanations are being built into the review workflow. Libby helps you understand your data — it does not file returns, automate payments, or replace your CA.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                {[
                  'Ask about your top vendor spends',
                  'Understand why a payment was flagged',
                  'Check report readiness before sharing with CA',
                  'Spot recurring payments and subscription patterns',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#138C7E', fontSize: '12px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, flexShrink: 0 }}>→</span>
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
      <InteractiveReportsSection />

      {/* ═══════ 007 — PRICING ═══════ */}
      <section id="pricing" style={S.section('#121514')}>
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
                className={`pricing-card ${plan.highlight ? 'highlighted' : ''}`}
                style={{
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
                    background: '#138C7E', color: '#080A09',
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                    padding: '4px 12px', borderRadius: '999px',
                  }}>Most popular</div>
                )}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: plan.highlight ? '#138C7E' : 'rgba(232,240,238,0.40)', marginBottom: '8px' }}>{plan.name}</div>
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
                      <span style={{ color: '#138C7E', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>✓</span>
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
                    background: plan.highlight ? '#138C7E' : 'rgba(140, 150, 148, 0.05)',
                    color: plan.highlight ? '#080A09' : '#138C7E',
                    border: plan.highlight ? 'none' : '1px solid rgba(140, 150, 148, 0.12)',
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
      <section style={{ ...S.section('#080A09'), position: 'relative', overflow: 'hidden' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '600px', height: '300px',
            background: 'radial-gradient(ellipse, rgba(19, 140, 126, 0.05) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ ...S.inner, textAlign: 'center', position: 'relative' }}>
          <div style={{ color: '#138C7E', fontFamily: 'ui-monospace, monospace', fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 500, marginBottom: '24px' }}>
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
                background: '#138C7E',
                color: '#080A09',
                padding: '16px 36px',
                borderRadius: '999px',
                fontSize: '16px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
                border: '1px solid transparent',
              }}
              className="cta-btn cta-primary"
            >
              {user ? 'Go to Dashboard' : 'Start reviewing'}{' '}
              <span className="cta-arrow" style={{ display: 'inline-block' }}>→</span>
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
                border: '1px solid rgba(140, 150, 148, 0.18)',
                borderRadius: '999px',
                display: 'inline-block',
              }}
              className="cta-btn cta-secondary"
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
      <footer style={{ padding: '40px 48px', background: 'transparent' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <img src={aeLogo} alt="Kaeo" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(19,140,126,0.35))', flexShrink: 0 }} />
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
          border-color: rgba(19, 140, 126, 0.24) !important;
        }
        .cta-btn {
          position: relative;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 20px rgba(19, 140, 126, 0.25);
          background: #3cd4c0 !important;
        }
        .cta-secondary:hover {
          transform: translateY(-2px);
          border-color: rgba(19, 140, 126, 0.45) !important;
          color: #E8F0EE !important;
          box-shadow: 0 0 15px rgba(19, 140, 126, 0.1);
        }
        .cta-btn:hover .cta-arrow {
          transform: translateX(4px);
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-delay: 0s !important;
            animation-duration: 0s !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0s !important;
            scroll-behavior: auto !important;
            transform: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Landing;
