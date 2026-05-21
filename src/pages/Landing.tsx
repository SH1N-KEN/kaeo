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
  Users
} from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      {/* Navigation Header */}
      <KaeoLandingHeader />

      {/* Hero Section */}
      <div id="product">
        <KaeoHero />
      </div>

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
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  1
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-primary" />
                  Upload Statement
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Drag and drop your bank CSV or XLSX file. No formatting cleanups needed.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  2
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Automated Cleanup
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Kaeo detects headers, maps debits/credits, cleans dates, and parses amounts.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  3
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  Analyze Risks
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automatically screen for double charges, vendor anomalies, and cash leaks.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  4
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Ask Kaeo AI
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Query your numbers in natural language. Get immediate fiscal advise.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative group">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black mb-4 group-hover:scale-105 transition-transform">
                  5
                </div>
                <h3 className="text-base font-bold mb-2 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-primary" />
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
      <section className="py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Core CFO Features</h2>
            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">Engineered for absolute fiscal precision.</p>
          </div>

          <AnimatedGroup className="grid grid-cols-1 md:grid-cols-3 gap-8" staggerDelay={0.1}>
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl transition-all">
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
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl transition-all">
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
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl transition-all">
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
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl transition-all">
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
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl transition-all">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Ask Kaeo AI Advisor</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A fully integrated semantic financial companion. Analyze top vendors, identify anomalies, and prompt questions for immediate answers.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-xl transition-all">
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

      {/* Pricing Tiers Section */}
      <section id="pricing" className="py-24 border-t border-border bg-muted/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Pricing Plans</h2>
            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">Start simple, scale as your transaction volume grows.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-stretch max-w-6xl mx-auto">
            {/* Free */}
            <div className="p-6 rounded-2xl border border-border bg-card flex flex-col justify-between h-full relative">
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
                className="w-full mt-8 py-3 bg-muted hover:bg-muted/80 text-foreground text-center text-xs font-bold rounded-xl transition-all"
              >
                {user ? 'View billing' : 'Start free'}
              </Link>
            </div>

            {/* Starter */}
            <div className="p-6 rounded-2xl border border-border bg-card flex flex-col justify-between h-full relative">
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
                className="w-full mt-8 py-3 bg-primary text-primary-foreground text-center text-xs font-bold rounded-xl hover:opacity-90 shadow-md shadow-primary/10 transition-all"
              >
                {user ? 'Upgrade to Starter' : 'Start Free Trial'}
              </Link>
            </div>

            {/* Growth */}
            <div className="p-6 rounded-2xl border-2 border-primary bg-card flex flex-col justify-between h-full relative shadow-xl">
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
                className="w-full mt-8 py-3 bg-primary text-primary-foreground text-center text-xs font-bold rounded-xl hover:opacity-90 shadow-md shadow-primary/10 transition-all"
              >
                {user ? 'Upgrade to Growth' : 'Start Free Trial'}
              </Link>
            </div>

            {/* Accountant */}
            <div className="p-6 rounded-2xl border border-border bg-card flex flex-col justify-between h-full relative">
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
                className="w-full mt-8 py-3 bg-muted hover:bg-muted/80 text-foreground text-center text-xs font-bold rounded-xl transition-all"
              >
                {user ? 'Contact Support' : 'Sign Up Now'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-card text-muted-foreground">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-black text-sm">K</span>
            </div>
            <span className="text-sm font-bold text-foreground">Kaeo Finance OS</span>
          </div>
          <p className="text-xs">
            &copy; 2026 Kaeo Finance OS. India-first SME CFO Intelligence. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs font-semibold">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Start Free</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
