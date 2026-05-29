import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { KaeoLandingHeader } from '../components/landing/KaeoLandingHeader';
import { KaeoHero } from '../components/landing/KaeoHero';
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

const UploadVisualInteractive = () => {
  const [hoveredFile, setHoveredFile] = useState<number | null>(null);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div 
        style={{ 
          border: '2px dashed rgba(19, 140, 126, 0.2)', 
          borderRadius: '10px', 
          padding: '24px 16px', 
          textAlign: 'center', 
          background: 'rgba(19, 140, 126, 0.02)', 
          cursor: 'pointer', 
          transition: 'all 0.2s ease' 
        }} 
        className="hover:border-teal-400/40 hover:bg-teal-950/10"
      >
        <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>📁</span>
        <span style={{ fontSize: '13px', color: '#138C7E', fontWeight: 600 }}>Click or drag statement file here</span>
        <span style={{ fontSize: '11px', color: 'rgba(232, 240, 238, 0.35)', display: 'block', marginTop: '4px' }}>Supports CSV or XLSX statement sheets</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
        {[
          { name: 'hdfc_bank_statement_apr.xlsx', size: '48 KB', type: 'Excel Sheet' },
          { name: 'razorpay_settlement_report.csv', size: '112 KB', type: 'CSV Statement' }
        ].map((f, i) => (
          <div 
            key={i} 
            onMouseEnter={() => setHoveredFile(i)}
            onMouseLeave={() => setHoveredFile(null)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '10px 14px', 
              background: hoveredFile === i ? 'rgba(19, 140, 126, 0.04)' : 'rgba(255,255,255,0.01)', 
              borderRadius: '8px', 
              border: hoveredFile === i ? '1px solid rgba(19, 140, 126, 0.25)' : '1px solid rgba(255,255,255,0.05)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>📄</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '12px', color: '#E8F0EE', fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>{f.name}</span>
                <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.4)' }}>{f.size} · {f.type}</span>
              </div>
            </div>
            <span style={{ fontSize: '11px', color: '#138C7E', fontWeight: 700 }}>✓ Uploaded</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MapVisualInteractive = () => {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
      <div style={{ fontSize: '11px', color: 'rgba(232, 240, 238, 0.4)', fontWeight: 600, letterSpacing: '0.05em' }}>AUTOMATIC FIELD IDENTIFICATION</div>
      {[
        { target: 'Transaction Date', source: 'Value Date (Col A)', confidence: '98%' },
        { target: 'Description / Narration', source: 'Narration Details (Col B)', confidence: '99%' },
        { target: 'Debit Amount (Outflow)', source: 'Withdrawal Amt (Col D)', confidence: '95%' },
        { target: 'Credit Amount (Inflow)', source: 'Deposit Amt (Col E)', confidence: '95%' }
      ].map((row, i) => (
        <div 
          key={i} 
          onMouseEnter={() => setHoveredRow(i)}
          onMouseLeave={() => setHoveredRow(null)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '10px 14px', 
            background: hoveredRow === i ? 'rgba(19, 140, 126, 0.04)' : 'rgba(255,255,255,0.01)', 
            borderRadius: '8px', 
            border: hoveredRow === i ? '1px solid rgba(19, 140, 126, 0.25)' : '1px solid rgba(255,255,255,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '12px', color: '#E8F0EE', fontWeight: 600 }}>{row.target}</span>
            <span style={{ fontSize: '11px', color: '#138C7E', fontFamily: 'ui-monospace, monospace' }}>➔ Mapped to column: <span style={{ color: '#E8F0EE' }}>"{row.source}"</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(232, 240, 238, 0.45)' }}>Conf: {row.confidence}</span>
            <span style={{ fontSize: '9px', color: '#138C7E', background: 'rgba(19,140,126,0.08)', border: '1px solid rgba(19,140,126,0.18)', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>VERIFIED</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const ReviewVisualInteractive = () => {
  const [activeRisk, setActiveRisk] = useState<number | null>(0);
  
  const items = [
    { date: '28 Apr', desc: 'Bombay Rent Ltd', cat: 'Rent & Utilities', amount: '−₹1,80,000', label: 'Duplicate payment suspect', why: 'Paid twice within 24 hours to the same landlord account.' },
    { date: '26 Apr', desc: 'Mumbai Supplies Pvt Ltd', cat: 'Capital Expense', amount: '−₹1,24,000', label: 'High-value outflow', why: 'This payment is 3.2× higher than their historical monthly average.' },
    { date: '25 Apr', desc: 'UPI/9820123456/Rent/Paytm', cat: 'Uncategorized', amount: '−₹18,500', label: 'Uncategorized UPI transfer', why: 'Payee detected as Rent/Paytm but needs review confirmation.' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', color: 'rgba(232, 240, 238, 0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Ledger Risks Inbox</span>
        <span style={{ fontSize: '10.5px', color: '#E05450', fontWeight: 600 }}>● Action required</span>
      </div>
      {items.map((item, i) => {
        const isSelected = activeRisk === i;
        return (
          <div 
            key={i} 
            onClick={() => setActiveRisk(i)}
            style={{ 
              padding: '12px', 
              background: isSelected ? 'rgba(224,84,80,0.04)' : 'rgba(255,255,255,0.01)', 
              borderRadius: '8px', 
              border: isSelected ? '1px solid rgba(224,84,80,0.3)' : '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
              <div>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#E8F0EE' }}>{item.desc}</span>
                <span style={{ fontSize: '10px', color: 'rgba(232,240,238,0.4)', marginLeft: '8px' }}>{item.date}</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#E05450', fontFamily: 'ui-monospace, monospace' }}>{item.amount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '10.5px', color: '#E05450', fontWeight: 500 }}>⚠ {item.label}</span>
              <span style={{ fontSize: '9px', background: 'rgba(19,140,126,0.08)', color: '#138C7E', border: '1px solid rgba(19,140,126,0.15)', padding: '1px 5px', borderRadius: '4px' }}>{item.cat}</span>
            </div>
            {isSelected && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'rgba(232,240,238,0.6)', lineHeight: 1.4 }}>
                <strong>Reason:</strong> {item.why}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const UnderstandVendorsVisual = () => {
  const [activeVendor, setActiveVendor] = useState<number | null>(0);
  const vendors = [
    { name: 'Mumbai Supplies Pvt Ltd', total: '₹3,40,000', count: '3 bills', share: '62%', type: 'Supplier' },
    { name: 'Bombay Rent Ltd', total: '₹1,80,000', count: '1 bill', share: '32%', type: 'Utilities' },
    { name: 'Slack Technologies', total: '₹30,000', count: '1 bill', share: '6%', type: 'SaaS / Software' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', color: 'rgba(232, 240, 238, 0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Active Merchant Accounts</span>
        <span style={{ fontSize: '10.5px', color: '#138C7E', fontWeight: 600 }}>3 vendors tracked</span>
      </div>
      {vendors.map((v, i) => {
        const isActive = activeVendor === i;
        return (
          <div 
            key={i} 
            onClick={() => setActiveVendor(i)}
            style={{ 
              padding: '12px', 
              background: isActive ? 'rgba(19, 140, 126, 0.04)' : 'rgba(255,255,255,0.01)', 
              borderRadius: '8px', 
              border: isActive ? '1px solid rgba(19, 140, 126, 0.25)' : '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#E8F0EE' }}>{v.name}</span>
                <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: 'rgba(232,240,238,0.5)', padding: '1px 5px', borderRadius: '4px', marginLeft: '8px' }}>{v.type}</span>
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#138C7E', fontFamily: 'ui-monospace, monospace' }}>{v.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: 'rgba(232,240,238,0.45)' }}>
              <span>{v.count} · Recurring monthly</span>
              <span style={{ color: '#138C7E' }}>{v.share} of period spend</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const GenerateReportsVisual = () => {
  const [downloaded, setDownloaded] = useState(false);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ background: 'rgba(19, 140, 126, 0.03)', border: '1px solid rgba(19, 140, 126, 0.15)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#E8F0EE' }}>Finance Review Pack · April 2026</span>
          <span style={{ fontSize: '10px', color: '#22B573', fontWeight: 700 }}>✓ Reconciled</span>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(232,240,238,0.45)' }}>Contains verified ledger CSV and OCR invoice attachments.</div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '9px', color: 'rgba(232,240,238,0.4)', display: 'block' }}>TOTAL REVIEWS</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#138C7E', fontFamily: 'ui-monospace, monospace' }}>142 items</span>
          </div>
          <div>
            <span style={{ fontSize: '9px', color: 'rgba(232,240,238,0.4)', display: 'block' }}>RISKS CLEARED</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#22B573', fontFamily: 'ui-monospace, monospace' }}>6 resolved</span>
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
          padding: '12px', 
          background: downloaded ? 'rgba(34, 181, 115, 0.15)' : '#138C7E', 
          color: downloaded ? '#22B573' : '#050F0D', 
          border: downloaded ? '1px solid rgba(34, 181, 115, 0.3)' : 'none', 
          borderRadius: '8px', 
          fontWeight: 700, 
          fontSize: '12px', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
      >
        <span>{downloaded ? '✓ Downloaded accountant pack' : '📥 Download Accountant Export (ZIP)'}</span>
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   1. INTERACTIVE PRODUCT WORKFLOW TABS
═══════════════════════════════════════════════ */
const InteractiveWorkflowSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  const steps = [
    {
      num: "01",
      label: "Upload files",
      title: "Upload CSV/XLSX statements and vendor invoices",
      description: "Upload CSV/XLSX bank statements and vendor invoices.",
      visual: <UploadVisualInteractive />
    },
    {
      num: "02",
      label: "Map transactions",
      title: "Auto-detect columns, references, and counterparties",
      description: "Kaeo detects dates, narrations, debits, credits, balances, vendors, and categories.",
      visual: <MapVisualInteractive />
    },
    {
      num: "03",
      label: "Review risks",
      title: "Identify transactional anomalies and mismatches",
      description: "Find high-value payments, duplicate suspects, balance mismatches, and uncategorized spend.",
      visual: <ReviewVisualInteractive />
    },
    {
      num: "04",
      label: "Understand vendors",
      title: "Get complete vendor spend context",
      description: "See vendor spend, recurring payments, and review context.",
      visual: <UnderstandVendorsVisual />
    },
    {
      num: "05",
      label: "Generate reports",
      title: "Export structured accountant-ready packs",
      description: "Prepare accountant-ready review summaries.",
      visual: <GenerateReportsVisual />
    }
  ];

  useEffect(() => {
    // Only apply IntersectionObserver on screens that support sticky (desktop)
    const isDesktop = window.innerWidth >= 768;
    if (!isDesktop) return;

    const observerOptions = {
      root: null,
      rootMargin: '-35% 0px -35% 0px',
      threshold: 0.2
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = stepRefs.current.indexOf(entry.target as HTMLDivElement);
          if (index !== -1) {
            setActiveStep(index);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    stepRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const handleStepClick = (idx: number) => {
    setActiveStep(idx);
    const element = stepRefs.current[idx];
    if (element) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'center'
      });
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '40px', alignItems: 'start' }} className="workflow-grid">
      {/* Left side tabs */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '24px',
          paddingBottom: '100px'
        }} 
        className="md:col-span-5 col-span-12"
      >
        {steps.map((step, idx) => {
          const isActive = idx === activeStep;
          return (
            <div
              key={idx}
              ref={(el) => { stepRefs.current[idx] = el; }}
              onClick={() => handleStepClick(idx)}
              style={{
                padding: '24px',
                background: isActive ? 'rgba(19, 140, 126, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                border: '1px solid',
                borderColor: isActive ? 'rgba(19, 140, 126, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                backdropFilter: isActive ? 'blur(12px)' : 'none',
                WebkitBackdropFilter: isActive ? 'blur(12px)' : 'none',
                boxShadow: isActive ? '0 12px 30px rgba(0,0,0,0.2), inset 0 1px 0 0 rgba(255,255,255,0.05)' : 'none',
              }}
              className={`workflow-step-card ${isActive ? 'active' : 'inactive'}`}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
                <span style={{
                  fontStyle: 'italic',
                  color: isActive ? '#138C7E' : 'rgba(232, 240, 238, 0.2)',
                  fontSize: '24px',
                  lineHeight: '1',
                  letterSpacing: '-0.04em',
                  fontWeight: 700,
                  transition: 'color 0.3s',
                }}>{step.num}</span>
                <span style={{
                  color: isActive ? '#138C7E' : 'rgba(232, 240, 238, 0.3)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '9.5px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  transition: 'color 0.3s',
                }}>{step.label}</span>
              </div>
              <h3 style={{ 
                fontSize: '17px', 
                fontWeight: 700, 
                color: isActive ? '#E8F0EE' : 'rgba(232,240,238,0.5)', 
                letterSpacing: '-0.01em', 
                margin: '0 0 6px 0', 
                transition: 'color 0.3s' 
              }}>{step.title}</h3>
              <p style={{ 
                fontSize: '13px', 
                color: isActive ? 'rgba(232,240,238,0.6)' : 'rgba(232,240,238,0.3)', 
                lineHeight: 1.5, 
                margin: 0, 
                transition: 'color 0.3s' 
              }}>{step.description}</p>
            </div>
          );
        })}
      </div>
      
      {/* Right side mock display */}
      <div 
        style={{
          background: '#0D1714',
          border: '1px solid rgba(19,140,126,0.14)',
          borderRadius: '16px',
          padding: '24px',
          position: 'sticky',
          top: '112px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          maxHeight: 'calc(100vh - 160px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          maxWidth: '680px',
          margin: '0 auto',
          transition: 'all 0.3s ease',
        }} 
        className="md:col-span-7 col-span-12 workflow-mock-panel no-scrollbar"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px' }}>💻</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(232, 240, 238, 0.45)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}>KAEO WORKSPACE · ACTIVE VIEW</span>
          </div>
          <span style={{ 
            fontSize: '9px', 
            fontFamily: 'ui-monospace, monospace', 
            letterSpacing: '0.08em', 
            padding: '2px 6px', 
            background: 'rgba(19,140,126,0.1)', 
            color: '#138C7E', 
            borderRadius: '4px', 
            fontWeight: 700, 
            textTransform: 'uppercase',
            transition: 'all 0.3s ease'
          }}>
            {steps[activeStep].label}
          </span>
        </div>
        <div key={activeStep} className="workflow-mock-content animate-kaeo-scale">
          {steps[activeStep].visual}
        </div>
      </div>
    </div>
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const toggleMode = (newMode: 'before' | 'after') => {
    setMode(newMode);
    lastManualChange.current = Date.now();
  };

  useEffect(() => {
    if (typeof window === 'undefined' || reducedMotion) return;

    const handleScroll = () => {
      // Ignore scroll-driven changes for 1.5s after a manual click
      if (Date.now() - lastManualChange.current < 1500) {
        return;
      }

      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Trigger transition when the center of the section crosses the viewport center
      const sectionCenter = rect.top + rect.height / 2;
      const viewportCenter = viewportHeight / 2;
      
      if (sectionCenter < viewportCenter) {
        setMode('after');
      } else {
        setMode('before');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [reducedMotion]);

  return (
    <section 
      ref={sectionRef}
      style={{ 
        padding: '100px 24px', 
        background: '#070F0D', 
        borderTop: '1px solid rgba(19,140,126,0.08)',
        overflow: 'hidden'
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Two-column container */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          
          {/* Left Column: Copy + Toggle */}
          <div className="w-full lg:w-[45%] flex flex-col items-center lg:items-start text-center lg:text-left shrink-0">
            <div style={{ color: '#138C7E', fontFamily: 'ui-monospace, monospace', fontSize: '11px', letterSpacing: '0.08em', marginBottom: '16px', textTransform: 'uppercase', fontWeight: 500 }}>
              002B — THE DIFFERENCE
            </div>
            <h2 style={{ fontWeight: 700, fontSize: 'clamp(28px, 3.5vw, 44px)', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 16px', color: '#E8F0EE' }}>
              Before Kaeo vs. <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400, color: '#138C7E', textTransform: 'none' }}>Review-ready.</span>
            </h2>
            <p style={{ fontSize: '15px', color: 'rgba(232,240,238,0.45)', lineHeight: 1.6, margin: '0 0 32px' }}>
              Stop wasting hours untangling raw narrations, matching receipts, and searching for invoice files. Toggle below or scroll down to see how Kaeo transforms raw statement data into a clean, audited ledger.
            </p>

            {/* Sliding Toggle Control */}
            <div className="relative inline-flex bg-[#0D1714] border border-[#138C7E]/15 p-1 rounded-full select-none w-[280px]">
              {/* Sliding background pill */}
              <div
                className="absolute top-1 bottom-1 left-1 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: 'calc(50% - 4px)',
                  transform: mode === 'after' ? 'translateX(100%)' : 'translateX(0%)',
                  background: mode === 'before' ? '#E05450' : '#138C7E',
                }}
              />
              <button
                onClick={() => toggleMode('before')}
                className={`relative z-10 flex-1 py-2 text-center rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer ${
                  mode === 'before' ? 'text-[#050F0D] font-extrabold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Before Kaeo
              </button>
              <button
                onClick={() => toggleMode('after')}
                className={`relative z-10 flex-1 py-2 text-center rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer ${
                  mode === 'after' ? 'text-[#050F0D] font-extrabold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Review-ready
              </button>
            </div>
          </div>

          {/* Right Column: Morphing Cards Container */}
          <div className="w-full lg:flex-1 relative min-h-[410px]">
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
                background: '#0D1714',
                border: '1.5px solid rgba(224, 84, 80, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
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
                background: '#0D1714',
                border: '1.5px solid rgba(19, 140, 126, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '11px', color: '#138C7E', fontWeight: 700, letterSpacing: '0.05em' }}>⚡ CLEAN, RECONCILED KAEO LEDGER ROWS</div>
                {[
                  { date: '28 Apr 2026', vendor: 'Bombay Rent Ltd', cat: 'Rent & Utilities', amt: '−₹1,80,000', badge: 'Duplicate payment suspect', bColor: '#E05450' },
                  { date: '26 Apr 2026', vendor: 'Mumbai Supplies Pvt Ltd', cat: 'Capital Expense', amt: '−₹1,24,000', badge: 'High-Value Outflow (3.2x avg)', bColor: '#E05450' },
                  { date: '25 Apr 2026', vendor: 'UPI Payee / Rent', cat: 'Rent & Utilities', amt: '−₹18,500', badge: 'Review queue: confirm invoice link', bColor: '#D4922A' },
                ].map((row, i) => (
                  <div key={i} style={{ padding: '12px', background: 'rgba(19, 140, 126, 0.02)', borderRadius: '8px', border: '1px solid rgba(19, 140, 126, 0.12)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(232,240,238,0.4)', marginBottom: '4px' }}>
                      <span className="truncate mr-2"><strong style={{ color: '#E8F0EE' }}>{row.vendor}</strong> · {row.date}</span>
                      <span style={{ color: '#E8F0EE', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }} className="shrink-0">{row.amt}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '10px', background: 'rgba(19,140,126,0.08)', color: '#138C7E', border: '1px solid rgba(19,140,126,0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{row.cat}</span>
                      <span style={{ fontSize: '10.5px', color: row.bColor, fontWeight: 600 }} className="whitespace-nowrap">⚠ {row.badge}</span>
                    </div>
                  </div>
                ))}
                <div style={{ background: 'rgba(19,140,126,0.06)', border: '1px solid rgba(19,140,126,0.20)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#138C7E' }}>
                  <strong>Benefits:</strong> Categorized transactions, clean review queue, automated risk snapshot, and accountant-ready reports.
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
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const cards = [
    {
      title: "High-value payments",
      description: "Single large debits that deviate significantly from your vendor payment patterns. Worth a second look before month close.",
      example: "₹1,24,000 → Mumbai Supplies · 3.2× above avg",
      whyMatters: "Large atypical payments can indicate billing inflation or errors that affect run rate.",
      whatKaeoShows: "Compares current transaction amount against the historical vendor payment baseline.",
      userReviews: "Match with purchase order approval and check invoice breakdown."
    },
    {
      title: "Duplicate suspects",
      description: "Same vendor, same amount, close date — often from double-clicking payment portals or failed gateway retries.",
      example: "₹75,000 × 2 → Slack Technologies · 12 Apr",
      whyMatters: "Failed gateway retries or multiple invoicing cycles can silently drain cash reserves.",
      whatKaeoShows: "Highlights identical amounts and counterparties within 7 days, referencing transaction dates.",
      userReviews: "Check bank logs for a credit/refund or confirm double payment with vendor."
    },
    {
      title: "Balance mismatch",
      description: "Closing balance from your statement doesn't match the running total from parsed transactions — missing rows or import errors.",
      example: "₹8,400 gap → closing balance vs. transaction sum",
      whyMatters: "Unreconciled statements invalidate audit trials and hide missing records.",
      whatKaeoShows: "Runs running total sum checks against printed statement bank balances.",
      userReviews: "Locate missing statement pages or correct corrupt CSV rows."
    },
    {
      title: "Invoice mismatch",
      description: "Invoice amount doesn't match the bank debit for the same vendor — partial payments, rounding errors, or billing discrepancies.",
      example: "Invoice ₹48,200 vs. debit ₹50,610 · tax discrepancy",
      whyMatters: "Discrepancies often hide wrong TDS deductions or extra billing items.",
      whatKaeoShows: "Compares OCR-scanned invoice totals directly with statement debits.",
      userReviews: "Verify TDS tax withholding amounts or contact vendor billing team."
    },
    {
      title: "Uncategorized spend",
      description: "Transactions with cryptic UPI narrations or generic NEFT descriptions that don't map to a known vendor or category.",
      example: "11 rows → UPI/Unknown/various · needs mapping",
      whyMatters: "Cryptic rows block month close and prevent clean corporate tax deductions.",
      whatKaeoShows: "Extracts UPI VPA details and phone numbers from raw statement strings to predict target vendors.",
      userReviews: "Assign correct business category and upload related invoice or receipt."
    },
    {
      title: "Vendor concentration",
      description: "One vendor consuming a disproportionate share of your monthly outflow — a supply chain or negotiation flag.",
      example: "62% of Apr outflow → 3 vendor accounts",
      whyMatters: "Heavy reliance on single suppliers limits pricing negotiation power.",
      whatKaeoShows: "Pie charts and percentage aggregates of monthly spend per merchant.",
      userReviews: "Check master agreements and seek quotes from alternative suppliers."
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
      {cards.map((card, idx) => {
        const isExpanded = expandedCard === idx;
        return (
          <div
            key={idx}
            onClick={() => setExpandedCard(isExpanded ? null : idx)}
            style={{
              background: '#0D1714',
              border: `1.5px solid ${isExpanded ? 'rgba(19,140,126,0.35)' : 'rgba(19,140,126,0.10)'}`,
              borderRadius: '14px',
              padding: '24px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="catch-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#E8F0EE', margin: 0, letterSpacing: '-0.01em' }}>{card.title}</h4>
              <span style={{ fontSize: '11px', color: '#138C7E', fontWeight: 'bold' }}>{isExpanded ? '▲ Collapse' : '▼ Expand'}</span>
            </div>
            <p style={{ fontSize: '13.5px', color: 'rgba(232,240,238,0.50)', lineHeight: 1.55, margin: 0 }}>{card.description}</p>
            <div style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '11px',
              color: '#138C7E',
              background: 'rgba(19,140,126,0.07)',
              border: '1px solid rgba(19,140,126,0.14)',
              borderRadius: '6px',
              padding: '6px 10px',
              marginTop: '2px',
            }}>
              {card.example}
            </div>

            {/* Expanded section */}
            {isExpanded && (
              <div style={{
                marginTop: '8px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px',
                color: 'rgba(232,240,238,0.65)',
                lineHeight: 1.5,
              }} className="animate-in fade-in duration-200">
                <div>
                  <strong style={{ color: '#138C7E' }}>Why it matters:</strong> {card.whyMatters}
                </div>
                <div>
                  <strong style={{ color: '#138C7E' }}>What Kaeo shows:</strong> {card.whatKaeoShows}
                </div>
                <div>
                  <strong style={{ color: '#138C7E' }}>What the user reviews next:</strong> {card.userReviews}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   4. DYNAMIC REPORT PREVIEW MOCK
═══════════════════════════════════════════════ */
const InteractiveReportMock: React.FC = () => {
  const [reportTab, setReportTab] = useState<'summary' | 'risks' | 'vendors'>('summary');

  return (
    <div style={{
      background: '#080E0C',
      border: '1px solid rgba(19, 140, 126, 0.14)',
      borderRadius: '16px',
      overflow: 'hidden',
      fontFamily: 'inherit',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px',
        background: 'rgba(19,140,126,0.06)',
        borderBottom: '1px solid rgba(19, 140, 126, 0.10)',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'rgba(232,240,238,0.40)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em', marginBottom: '2px' }}>KAEO · FINANCE REVIEW PACK</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#E8F0EE', letterSpacing: '-0.02em', fontStyle: 'italic' }}>April 2026 Report Preview</div>
        </div>
        
        {/* Toggle switch between report subsections */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(19,140,126,0.15)', padding: '3px', borderRadius: '8px', gap: '3px' }}>
          {(['summary', 'risks', 'vendors'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setReportTab(tab)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: reportTab === tab ? '#138C7E' : 'transparent',
                color: reportTab === tab ? '#050F0D' : 'rgba(232,240,238,0.5)',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.15s ease',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Content based on tab */}
      {reportTab === 'summary' && (
        <div>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
            {[
              { label: 'Money In', value: '+₹12,80,400', color: '#22B573' },
              { label: 'Money Out', value: '−₹8,42,200', color: '#E05450' },
              { label: 'Net Movement', value: '+₹4,38,200', color: '#22B573' },
            ].map((stat, i) => (
              <div key={i} style={{ padding: '16px 18px', background: '#080E0C' }}>
                <div style={{ fontSize: '10px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '6px' }}>{stat.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: stat.color, letterSpacing: '-0.02em', fontFamily: 'ui-monospace, monospace' }}>{stat.value}</div>
              </div>
            ))}
          </div>
          
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '10px' }}>Summary Ledger View</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Date', 'Description', 'Category', 'Amount', 'Status'].map((h) => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(232,240,238,0.30)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { date: '28 Apr', desc: 'Razorpay Settlement', cat: 'Inflow / Revenue', amount: '+₹4,80,000', status: 'Verified', sColor: '#22B573', aColor: '#22B573' },
                  { date: '26 Apr', desc: 'Mumbai Supplies Pvt Ltd', cat: 'Vendor Payment', amount: '−₹1,24,000', status: 'Needs review', sColor: '#D4922A', aColor: '#E05450' },
                  { date: '25 Apr', desc: 'UPI/Unknown Narration', cat: 'Uncategorized', amount: '−₹18,500', status: 'Flagged', sColor: '#E05450', aColor: '#E05450' },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '9px 8px', color: 'rgba(232,240,238,0.40)', fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>{row.date}</td>
                    <td style={{ padding: '9px 8px', color: '#E8F0EE', fontWeight: 500 }}>{row.desc}</td>
                    <td style={{ padding: '9px 8px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(19,140,126,0.08)', color: '#138C7E', border: '1px solid rgba(19,140,126,0.14)', fontWeight: 600 }}>{row.cat}</span>
                    </td>
                    <td style={{ padding: '9px 8px', color: row.aColor, fontWeight: 700, fontFamily: 'ui-monospace, monospace', fontSize: '11px', textAlign: 'right' }}>{row.amount}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', background: `${row.sColor}18`, color: row.sColor, border: `1px solid ${row.sColor}28`, fontWeight: 700, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(19,140,126,0.06)', borderRadius: '8px', border: '1px solid rgba(19,140,126,0.12)', fontSize: '12px', color: 'rgba(232,240,238,0.55)' }}>
              <span style={{ color: '#138C7E', fontWeight: 600 }}>Open Risks: 3 items pending</span> | <span style={{ color: '#D4922A', fontWeight: 600 }}>Uncategorized Rows: 11 items</span> | <span style={{ color: '#138C7E', fontWeight: 600 }}>Review Notes: Ready for CA</span>
            </div>
          </div>
        </div>
      )}

      {reportTab === 'risks' && (
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '10px' }}>Active Risk Flags & Audit Notes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { type: 'Duplicate suspect', desc: 'Bombay Rent Ltd', details: 'Matching amount ₹1,80,000 paid twice in 24 hours. Second transaction has duplicate reference.', action: 'Confirm gateway retry error.', color: '#E05450' },
              { type: 'High-value outflow', desc: 'Mumbai Supplies Pvt Ltd', details: 'Single payment of ₹1,24,000. Deviates 3.2× from vendor average of ₹38,750.', action: 'Confirm invoice matches payout.', color: '#D4922A' },
              { type: 'Balance Mismatch', desc: 'HDFC Statement Ledger', details: 'Running ledger totals mismatch HDFC closing balance sheet by ₹8,400.', action: 'Locate missing statement pages.', color: '#D4922A' }
            ].map((risk, i) => (
              <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: `1px solid ${risk.color}25` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: risk.color }}>{risk.type}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#E8F0EE' }}>{risk.desc}</span>
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(232,240,238,0.6)', margin: '0 0 6px 0', lineHeight: 1.4 }}>{risk.details}</p>
                <div style={{ fontSize: '11px', color: risk.color, fontWeight: 600 }}>{risk.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reportTab === 'vendors' && (
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(232,240,238,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: '10px' }}>Vendor Spend concentration Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {[
              { vendor: 'Mumbai Supplies', spend: '₹3,40,000', share: '62%', status: 'Flagged anomalies' },
              { vendor: 'Bombay Rent Ltd', spend: '₹1,80,000', share: '32%', status: 'Regular / Monthly' },
              { vendor: 'Slack Technologies', spend: '₹30,000', share: '6%', status: 'Subscription' }
            ].map((v, i) => (
              <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#E8F0EE' }}>{v.vendor}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#138C7E', fontFamily: 'ui-monospace, monospace' }}>{v.spend}</span>
                  <span style={{ fontSize: '11px', color: 'rgba(232,240,238,0.4)' }}>{v.share} of outflow</span>
                </div>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: v.status.includes('anomaly') ? '#E05450' : '#138C7E', marginTop: '4px' }}>{v.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   LIBBY CHAT MOCK
═══════════════════════════════════════════════ */
const LibbyChatMock = () => (
  <div style={{
    background: '#080E0C',
    border: '1px solid rgba(19, 140, 126, 0.14)',
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
      <span style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em', color: 'rgba(232, 240, 238, 0.35)', textTransform: 'uppercase' as const, fontWeight: 600 }}>Your Kaeo data · Apr 2026</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: 'rgba(19,140,126,0.15)', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: '13px', color: '#E8F0EE', maxWidth: '80%', lineHeight: 1.5 }}>
          Which vendor is taking most of my spend this month?
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(19,140,126,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#138C7E', display: 'inline-block', boxShadow: '0 0 6px rgba(19,140,126,0.45)' }} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px 12px 12px 12px', padding: '12px 14px', fontSize: '13px', color: 'rgba(232,240,238,0.65)', lineHeight: 1.6, flex: 1 }}>
          Based on your uploaded statements: <strong style={{ color: '#E8F0EE' }}>Mumbai Supplies Pvt Ltd</strong> accounts for <span style={{ color: '#D4922A', fontWeight: 700 }}>₹1,24,000</span> — your largest single vendor outflow this period. This is <span style={{ color: '#D4922A' }}>3.2× above</span> your April average.
          <br /><br />
          <span style={{ color: '#138C7E' }}>2 other payments to this vendor in March</span> suggest a recurring relationship worth reviewing.
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: 'rgba(19,140,126,0.15)', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: '13px', color: '#E8F0EE', maxWidth: '80%', lineHeight: 1.5 }}>
          Is my report ready to send to my CA?
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(19,140,126,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#138C7E', display: 'inline-block', boxShadow: '0 0 6px rgba(19,140,126,0.45)' }} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px 12px 12px 12px', padding: '12px 14px', fontSize: '13px', color: 'rgba(232,240,238,0.65)', lineHeight: 1.6, flex: 1 }}>
          Not yet — <span style={{ color: '#D4922A', fontWeight: 600 }}>11 rows are uncategorized</span> and <span style={{ color: '#E05450', fontWeight: 600 }}>1 duplicate payment needs your confirmation</span>. Once you resolve those, report readiness will reach 100%.
        </div>
      </div>
    </div>
    <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(19,140,126,0.06)', border: '1px solid rgba(19,140,126,0.14)', borderRadius: '8px', fontSize: '11px', color: 'rgba(232,240,238,0.40)', lineHeight: 1.5, fontStyle: 'italic' }}>
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
      borderTop: '1px solid rgba(19,140,126,0.08)',
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
            How Kaeo reviews your books
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(232,240,238,0.45)', maxWidth: '540px', marginBottom: '60px', lineHeight: 1.6 }}>
            No formatting, no pivot tables, no manual categorization. Kaeo handles the cleanup so you can focus on the review.
          </p>
          <InteractiveWorkflowSection />
        </div>
      </section>

      {/* ═══════ 002B — BEFORE AFTER TOGGLE COMPARISON ═══════ */}
      <BeforeAfterComparison />

      {/* ═══════ 003 — WHAT KAEO CATCHES ═══════ */}
      <section id="what-kaeo-catches" style={S.section('#0A1410')}>
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
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(19,140,126,0.12)', border: '1px solid rgba(19,140,126,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
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
                background: '#0D1714',
                border: '1px solid rgba(19,140,126,0.14)',
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
                  <span style={{ fontSize: '10px', color: '#138C7E', fontWeight: 700 }}>● processed</span>
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
              <div style={{ padding: '16px 18px', background: 'rgba(19,140,126,0.06)', border: '1px solid rgba(19,140,126,0.14)', borderRadius: '10px', fontSize: '13px', color: 'rgba(232,240,238,0.45)', lineHeight: 1.6, marginBottom: '24px' }}>
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
      <section style={S.section('#050F0D')}>
        <div style={S.inner}>
          <SectionLabel code="006" label="REPORTS" />
          <h2 style={{ ...S.h2, maxWidth: '600px' }}>
            Reports your accountant <span style={S.accent}>can actually use.</span>
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(232,240,238,0.45)', maxWidth: '520px', marginBottom: '52px', lineHeight: 1.6 }}>
            Not raw exports. Clean, structured finance review packs with period summary, open risks, uncategorized items, and vendor spend — ready to share.
          </p>
          <InteractiveReportMock />
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
                  background: plan.highlight ? 'rgba(19,140,126,0.08)' : '#0D1714',
                  border: plan.highlight ? '1px solid rgba(19,140,126,0.30)' : '1px solid rgba(19,140,126,0.10)',
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
                    background: '#138C7E', color: '#050F0D',
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
                    background: plan.highlight ? '#138C7E' : 'rgba(19,140,126,0.08)',
                    color: plan.highlight ? '#050F0D' : '#138C7E',
                    border: plan.highlight ? 'none' : '1px solid rgba(19,140,126,0.20)',
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
            background: 'radial-gradient(ellipse, rgba(19, 140, 126, 0.12) 0%, transparent 65%)',
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
                color: '#050F0D',
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
                border: '1px solid rgba(19,140,126,0.18)',
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
      <footer style={{ borderTop: '1px solid rgba(19,140,126,0.08)', padding: '40px 48px', background: '#050F0D' }}>
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
