import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { KaeoLandingHeader } from '../components/landing/KaeoLandingHeader';
import { KaeoHero } from '../components/landing/KaeoHero';
import { AnimatedGroup } from '../components/ui/AnimatedGroup';
import { 
  UploadCloud, 
  Sparkles, 
  AlertTriangle, 
  MessageSquare, 
  FileCheck, 
  CheckCircle,
  TrendingDown,
  Users,
  ShieldAlert,
  ArrowRight,
  FileText
} from 'lucide-react';
import aeLogo from '../assets/kaeo-ae-logo.png';

export const Landing: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Check if redirect state contains a scroll request
    if (location.state && (location.state as any).scrollTo) {
      const targetId = (location.state as any).scrollTo;
      setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          const headerOffset = 80;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 100);
      // Clear state after scrolling
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleScrollToSection = (e: React.MouseEvent, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      {/* Navigation Header */}
      <KaeoLandingHeader />

      {/* Hero Section */}
      <div id="product">
        <KaeoHero />
      </div>

      {/* Problem Section */}
      <section className="py-24 border-t border-border/40 relative overflow-hidden bg-card/10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-risk/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-risk bg-risk/10 px-3 py-1.5 rounded-full border border-risk/20">The SME Spend Chaos</span>
            <h2 className="text-3xl md:text-5xl font-black mt-6 mb-4 tracking-tight leading-tight">
              Where does your cash leak every month?
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Indian SMEs lose lakhs every year due to silent billing errors, duplicate transactions, and untracked subscription creep.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl border border-risk/15 bg-card/40 backdrop-blur-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-risk/10 text-risk flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Duplicate Charges</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Payment gateways or software tools often double-invoice your company. Without transaction hashing, these go completely unnoticed.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-warning/15 bg-card/40 backdrop-blur-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">SaaS Subscription Spikes</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Slack, AWS, and server utility fees increase dynamically with usage. Without alerts, a 40% vendor increase is only seen at quarter-end.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card/40 backdrop-blur-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary dark:text-[#2fb8a6] flex items-center justify-center">
                <TrendingDown className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Messy Statement formats</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                HDFC, ICICI, and UPI exports come with non-financial meta rows, headers, and varying date schemas. Parsing them manually takes hours.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card/40 backdrop-blur-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary dark:text-[#2fb8a6] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Delayed Compliance</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Accountants spend days categorizing transactions manually for tax filing. Kaeo builds clean, accountant-ready ledgers in minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 border-t border-border bg-muted/20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">How Kaeo Works</h2>
            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">Five simple steps to clear cashflow transparency.</p>
          </div>

          <AnimatedGroup className="grid grid-cols-1 md:grid-cols-5 gap-8" staggerDelay={0.15}>
            {/* Step 1 */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full premium-glass">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  1
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
                  Upload Statement
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Drag and drop your bank CSV or XLSX file. No formatting cleanups needed.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full premium-glass">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  2
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
                  Automated Cleanup
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Kaeo detects headers, maps debits/credits, cleans dates, and parses amounts.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full premium-glass">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  3
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
                  Analyze Risks
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automatically screen for double charges, vendor anomalies, and cash leaks.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full premium-glass">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  4
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
                  Ask Libby
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Query your numbers in natural language. Get immediate fiscal advice.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full premium-glass">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  5
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
                  Export Reports
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Download accountant-ready PDFs or CSV summaries of categorized transactions.
                </p>
              </div>
            </div>
          </AnimatedGroup>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="py-24 border-t border-border/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Core CFO Features</h2>
            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">Engineered for absolute fiscal precision.</p>
          </div>

          <AnimatedGroup className="grid grid-cols-1 md:grid-cols-3 gap-8" staggerDelay={0.1}>
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl hover:border-primary/25 transition-all premium-glass">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">CSV/XLSX Ingestion</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Direct ledger parsing. Handles messy sheets, blank rows, and multiple worksheets automatically without breaking column offsets.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl hover:border-primary/25 transition-all premium-glass">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Duplicate Detection</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Protect against double invoicing and incorrect gateway payouts. Kaeo hashes key parameters to isolate exact duplicate rows instantly.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl hover:border-primary/25 transition-all premium-glass">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Vendor Intelligence</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Uncover where your capital flows. Classifies expenses by vendors and categories automatically to highlight spend spikes.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl hover:border-primary/25 transition-all premium-glass">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Risk Inbox</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A centralized queue for suspicious entries, unmapped transactions, and currency warnings. Resolve items in a few clicks.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl hover:border-primary/25 transition-all premium-glass">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Libby AI Advisor</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A fully integrated semantic financial companion. Analyze top vendors, identify anomalies, and prompt questions for Libby's immediate answers.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl hover:border-primary/25 transition-all premium-glass">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <FileCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Accountant-Ready Reports</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Export complete transaction logs with verified mappings. Speed up tax compliance and reconciliations for your accountants.
                </p>
              </div>
            </div>
          </AnimatedGroup>
        </div>
      </section>

      {/* Libby Preview Section */}
      <section className="py-24 border-t border-border/40 bg-muted/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Context Left */}
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-[#2fb8a6] bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">Ask Libby</span>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
                An AI CFO Operator that actually knows your bank accounts
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Stop waiting for custom queries or pivot tables. Kaeo provides a semantic chatbot that analyzes your uploaded statement files in real time. Ask about recurring costs, SaaS licenses, vendor growths, and tax categories.
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-[#2fb8a6]" />
                  Fully isolated local vector queries
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-[#2fb8a6]" />
                  Flags potential double charges dynamically
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-[#2fb8a6]" />
                  No configuration or prompt engineering required
                </div>
              </div>
            </div>

            {/* Mock Chat Interface Right */}
            <div className="lg:col-span-7 p-5 rounded-2xl border border-border/60 bg-card premium-glass shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#2fb8a6]" />
                  <span className="text-xs font-bold text-foreground">Libby Advisor</span>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">Session Active</span>
              </div>

              {/* Chat Bubble Container */}
              <div className="space-y-4 h-[280px] overflow-y-auto pr-1 text-xs">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="max-w-[75%] p-3 rounded-xl rounded-tr-none bg-primary text-primary-foreground font-semibold">
                    Who are my top 3 growing SaaS vendors this quarter, and did we have any double invoices?
                  </div>
                </div>

                {/* Kaeo AI Reply */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/25 flex items-center justify-center shrink-0">
                    <img src={aeLogo} alt="ae" className="w-3.5 h-3.5 object-contain" />
                  </div>
                  <div className="flex-1 max-w-[80%] p-3.5 rounded-xl rounded-tl-none bg-muted/40 border border-border/30 space-y-2.5">
                    <p className="leading-relaxed">
                      Analyzing transaction ledgers for <strong>Q1 FY26</strong>. Here are the growing software vendors:
                    </p>
                    <div className="p-2 rounded-lg bg-background/50 border border-border/20 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="font-bold">1. Amazon Web Services</span>
                        <span className="text-risk font-semibold">₹2,45,000 (+42%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold">2. Slack Technologies</span>
                        <span className="text-risk font-semibold">₹90,000 (+15%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold">3. Google Workspace</span>
                        <span className="text-muted-foreground">₹45,000 (Flat)</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-risk/5 border border-risk/20 flex gap-2 items-start">
                      <AlertTriangle className="w-3.5 h-3.5 text-risk shrink-0 mt-0.5" />
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        <strong>Duplicate Warning:</strong> I detected a potential double payment of <strong>₹75,000</strong> to <strong>Slack Technologies</strong> on <strong>12 April 2026</strong>. Both transactions shared identical descriptor hashes. Action recommended in Risk Inbox.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reports Preview Section */}
      <section className="py-24 border-t border-border/40 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2fb8a6] bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">Reports & Mappings</span>
            <h2 className="text-3xl md:text-5xl font-black mt-6 mb-4 tracking-tight leading-tight">
              Instant tax-ready accounting outputs
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Skip manual categorization spreadsheets. Kaeo automatically maps transactions to semantic accounting categories.
            </p>
          </div>

          <div className="max-w-5xl mx-auto rounded-2xl border border-border/80 overflow-hidden shadow-2xl bg-card premium-glass">
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-muted/20 border-b border-border/50 select-none">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
                <span className="text-xs font-bold text-foreground">Verified Ledgers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-muted/60 text-foreground text-[10px] font-bold border border-border">CSV Export</span>
                <span className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">PDF Export</span>
              </div>
            </div>

            {/* Ledger content */}
            <div className="p-4 overflow-x-auto">
              <table className="w-full min-w-[600px] text-xs text-left">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground uppercase text-[9px] tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category Mapping</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 font-medium">
                  <tr>
                    <td className="py-3.5 px-4 text-muted-foreground">12 Apr 2026</td>
                    <td className="py-3.5 px-4 font-bold">Slack Technologies</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/15 text-[9px]">SaaS Subscription</span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-risk font-bold">-₹75,000</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-risk/10 text-risk border border-risk/15 text-[9px] font-bold">Risk Flagged</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-muted-foreground">08 Apr 2026</td>
                    <td className="py-3.5 px-4 font-bold">Acme Sales Corp Pvt Ltd</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/15 text-[9px]">Inflow / Revenue</span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-success font-bold">+₹9,42,500</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-success/10 text-success border border-success/15 text-[9px] font-bold">Verified</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-muted-foreground">05 Apr 2026</td>
                    <td className="py-3.5 px-4 font-bold">Razorpay Inward Transfer</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/15 text-[9px]">Refund / Reversal</span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-success font-bold">+₹16,000</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-success/10 text-success border border-success/15 text-[9px] font-bold">Verified</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-muted-foreground">01 Apr 2026</td>
                    <td className="py-3.5 px-4 font-bold">Amazon Web Services Cloud</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/15 text-[9px]">Utility / SaaS</span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-risk font-bold">-₹2,45,000</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-success/10 text-success border border-success/15 text-[9px] font-bold">Verified</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Tiers Section */}
      <section id="pricing" className="py-24 border-t border-border/40 bg-muted/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Pricing Plans</h2>
            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">Start simple, scale as your transaction volume grows.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-stretch max-w-6xl mx-auto">
            {/* Free */}
            <div className="p-6 rounded-2xl border border-border bg-card flex flex-col justify-between h-full relative premium-glass">
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">₹0</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <p className="text-xs text-muted-foreground">Perfect for early sandbox testing and small side-hustles.</p>
                <div className="w-full h-px bg-border/50" />
                <ul className="space-y-2 text-xs font-semibold">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 1 Client Profile</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 2 Files Ingested / mo</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 100 Transactions Limit</li>
                </ul>
              </div>
              <Link 
                to={user ? "/billing" : "/signup"}
                className="w-full mt-8 py-3 bg-muted hover:bg-muted/80 text-foreground text-center text-xs font-bold rounded-xl transition-all cursor-pointer border border-border/40"
              >
                {user ? 'View billing' : 'Start free'}
              </Link>
            </div>

            {/* Starter */}
            <div className="p-6 rounded-2xl border border-border bg-card flex flex-col justify-between h-full relative premium-glass">
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Starter</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">₹999</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <p className="text-xs text-muted-foreground">Ideal for growing freelancers and small consulting shops.</p>
                <div className="w-full h-px bg-border/50" />
                <ul className="space-y-2 text-xs font-semibold">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 3 Client Profiles</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 10 Files Ingested / mo</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 500 Transactions Limit</li>
                </ul>
              </div>
              <Link 
                to={user ? "/billing" : "/signup"}
                className="w-full mt-8 py-3 bg-primary text-primary-foreground text-center text-xs font-bold rounded-xl hover:opacity-90 shadow-md shadow-primary/10 transition-all cursor-pointer"
              >
                {user ? 'Upgrade to Starter' : 'Start Free Trial'}
              </Link>
            </div>

            {/* Growth */}
            <div className="p-6 rounded-2xl border-2 border-primary bg-card flex flex-col justify-between h-full relative shadow-xl premium-glass">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg">
                Most Popular
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-primary">Growth</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">₹2,999</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <p className="text-xs text-muted-foreground">For active SME businesses needing full monthly cash flow audits.</p>
                <div className="w-full h-px bg-border/50" />
                <ul className="space-y-2 text-xs font-semibold">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 10 Client Profiles</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 30 Files Ingested / mo</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 2,500 Transactions Limit</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> Priority Support</li>
                </ul>
              </div>
              <Link 
                to={user ? "/billing" : "/signup"}
                className="w-full mt-8 py-3 bg-primary text-primary-foreground text-center text-xs font-bold rounded-xl hover:opacity-90 shadow-md shadow-primary/10 transition-all cursor-pointer"
              >
                {user ? 'Upgrade to Growth' : 'Start Free Trial'}
              </Link>
            </div>

            {/* Accountant */}
            <div className="p-6 rounded-2xl border border-border bg-card flex flex-col justify-between h-full relative premium-glass">
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Accountant</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">₹7,999</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <p className="text-xs text-muted-foreground">For accountants and agencies managing client organizations.</p>
                <div className="w-full h-px bg-border/50" />
                <ul className="space-y-2 text-xs font-semibold">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> Unlimited Clients</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 100 Files Ingested / mo</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> 10,000 Transactions Limit</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> Dedicated Account Manager</li>
                </ul>
              </div>
              <Link 
                to={user ? "/billing" : "/signup"}
                className="w-full mt-8 py-3 bg-muted hover:bg-muted/80 text-foreground text-center text-xs font-bold rounded-xl transition-all cursor-pointer border border-border/40"
              >
                {user ? 'Contact Support' : 'Sign Up Now'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 border-t border-border/40 relative overflow-hidden bg-[#070908] text-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Stop losing money on hidden spend today.
          </h2>
          <p className="text-sm md:text-base text-muted-slate max-w-xl mx-auto leading-relaxed">
            Get accountant-ready reports, verify SaaS bills, and query your transaction files with Libby, your AI CFO operator. Sign up in 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to={user ? "/dashboard" : "/signup"}
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-95 shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              {user ? 'Go to Dashboard' : 'Start free'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="#product-preview"
              onClick={(e) => handleScrollToSection(e, 'product-preview')}
              className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              View demo preview
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 bg-card text-muted-foreground">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/25 shrink-0">
              <img src={aeLogo} alt="ae Logo" className="w-4 h-4 object-contain" />
            </div>
            <span className="text-lg font-black tracking-tight text-foreground leading-none">
              Kaeo
            </span>
          </Link>
          <p className="text-xs">
            &copy; 2026 Kaeo Finance OS. India-first SME CFO Intelligence. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs font-semibold">
            {user ? (
              <Link to="/dashboard" className="hover:text-foreground transition-colors">Go to Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
                <Link to="/signup" className="hover:text-foreground transition-colors">Start Free</Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
