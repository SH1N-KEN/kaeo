import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, UploadCloud, Brain, ShieldCheck, CheckCircle2, MessageSquare } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { motion } from 'framer-motion';

export const KaeoHero: React.FC = () => {
  const { user } = useAuth();

  const handleScrollToPreview = (e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
      window.location.href = '/dashboard';
      return;
    }
    const element = document.getElementById('product-preview');
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring' as const, damping: 25, stiffness: 100 }
    }
  };

  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden bg-background text-foreground">
      {/* Decorative blurred background shapes */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-[90px] pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div 
          className="text-center max-w-4xl mx-auto mb-16 md:mb-24"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div 
            variants={itemVariants}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 dark:bg-primary/5 text-primary dark:text-[#2fb8a6] border border-primary/20 dark:border-[#2fb8a6]/20 text-xs font-bold uppercase tracking-wider mb-6"
          >
            <Brain className="w-3.5 h-3.5 animate-pulse" />
            <span>The SME AI CFO Workspace</span>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            variants={itemVariants}
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6"
          >
            Catch spend leaks before they hit your{' '}
            <span className="text-primary dark:text-[#2fb8a6] bg-gradient-to-r from-primary to-teal-500 bg-clip-text text-transparent dark:from-[#2fb8a6] dark:to-emerald-400">
              bottom line.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p 
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto mb-10"
          >
            Kaeo is an AI CFO workspace for SMEs. Upload messy bank statements and invoices, detect duplicate payments, risky vendors, uncontrolled spend, and generate accountant-ready reports.
          </motion.p>

          {/* CTAs */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link 
              to={user ? "/dashboard" : "/signup"}
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-95 shadow-xl shadow-primary/15 hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 group"
            >
              {user ? 'Go to Dashboard' : 'Start free'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="#product-preview"
              onClick={handleScrollToPreview}
              className="w-full sm:w-auto px-8 py-4 bg-card hover:bg-muted/10 border border-border text-foreground rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
              View demo
            </a>
          </motion.div>
        </motion.div>

        {/* Product Preview Card */}
        <motion.div 
          id="product-preview"
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ type: 'spring', damping: 28, stiffness: 80, delay: 0.1 }}
          className="relative max-w-5xl mx-auto rounded-2xl border border-border/80 overflow-hidden shadow-2xl bg-card"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-b border-border/50">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="text-xs font-semibold text-muted-foreground ml-2">Kaeo CFO Workspace Dashboard</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/10 text-teal-500 border border-teal-500/20">
              Product Preview &bull; Illustrative
            </span>
          </div>

          {/* Card Body (Mock Mini-Dashboard) */}
          <div className="p-6 md:p-8 space-y-8 bg-card">
            {/* Metric Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Inflow / Revenue</div>
                <div className="text-xl font-black text-success">&bull;&bull;&bull;&bull;&bull;</div>
                <div className="text-xs text-muted-foreground mt-1">₹24,85,000 &bull; 41 txns</div>
              </div>
              <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Outflow / Expenses</div>
                <div className="text-xl font-black text-risk">&bull;&bull;&bull;&bull;&bull;</div>
                <div className="text-xs text-muted-foreground mt-1">₹18,04,566 &bull; 39 txns</div>
              </div>
              <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Net Cashflow</div>
                <div className="text-xl font-black text-primary dark:text-[#2fb8a6]">&bull;&bull;&bull;&bull;&bull;</div>
                <div className="text-xs text-muted-foreground mt-1">₹6,80,434 net cash</div>
              </div>
              <div className="p-4 rounded-xl border border-border/60 bg-warning/5 border-warning/20">
                <div className="text-[10px] font-black uppercase tracking-widest text-warning mb-1">Risks Detected</div>
                <div className="text-xl font-black text-warning">3 Alerts</div>
                <div className="text-xs text-muted-foreground mt-1">2 Duplicate payments &bull; 1 Vendor</div>
              </div>
            </div>

            {/* Mock Charts & Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cashflow visualizer */}
              <div className="lg:col-span-2 p-6 rounded-xl border border-border/60 bg-muted/5 flex flex-col h-64">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Monthly Inflow vs Outflow Trend</h4>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Inflow</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-risk" /> Outflow</span>
                  </div>
                </div>
                {/* Visual grid representing columns */}
                <div className="flex-1 flex items-end justify-between gap-4 pt-6 border-b border-border/50">
                  <div className="flex-1 flex gap-1 items-end h-full">
                    <div className="w-full bg-success/80 rounded-t h-[40%]" />
                    <div className="w-full bg-risk/80 rounded-t h-[30%]" />
                  </div>
                  <div className="flex-1 flex gap-1 items-end h-full">
                    <div className="w-full bg-success/80 rounded-t h-[55%]" />
                    <div className="w-full bg-risk/80 rounded-t h-[40%]" />
                  </div>
                  <div className="flex-1 flex gap-1 items-end h-full">
                    <div className="w-full bg-success/80 rounded-t h-[75%]" />
                    <div className="w-full bg-risk/80 rounded-t h-[45%]" />
                  </div>
                  <div className="flex-1 flex gap-1 items-end h-full">
                    <div className="w-full bg-success/80 rounded-t h-[60%]" />
                    <div className="w-full bg-risk/80 rounded-t h-[50%]" />
                  </div>
                  <div className="flex-1 flex gap-1 items-end h-full">
                    <div className="w-full bg-success/80 rounded-t h-[90%]" />
                    <div className="w-full bg-risk/80 rounded-t h-[65%]" />
                  </div>
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground mt-2 font-bold uppercase">
                  <span>Dec</span>
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr (FY)</span>
                </div>
              </div>

              {/* Ingestion & Invoices Panel */}
              <div className="p-6 rounded-xl border border-border/60 bg-muted/5 flex flex-col justify-between h-64">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-4">Latest Uploaded Statements</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/30">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        <span className="text-[11px] font-bold truncate max-w-[120px]">hdfc_statement_fy26.xlsx</span>
                      </div>
                      <span className="text-[9px] font-black uppercase bg-success/10 text-success border border-success/15 px-1 py-0.5 rounded">98% Auto</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/30">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        <span className="text-[11px] font-bold truncate max-w-[120px]">razorpay_export_weird.csv</span>
                      </div>
                      <span className="text-[9px] font-black uppercase bg-success/10 text-success border border-success/15 px-1 py-0.5 rounded">100% Auto</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-center gap-2 text-xs">
                  <UploadCloud className="w-4 h-4 text-primary dark:text-[#2fb8a6] shrink-0" />
                  <span className="text-muted-foreground">Supported: CSV, XLSX, XLS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ask Kaeo preview chat bubble floating */}
          <div className="absolute bottom-6 right-6 max-w-sm p-4 rounded-xl shadow-2xl bg-foreground text-background dark:bg-card dark:text-foreground border border-border/80 flex items-start gap-3 animate-bounce shadow-teal-500/5 duration-1000">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-black text-sm">K</span>
            </div>
            <div className="space-y-1">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-primary dark:text-[#2fb8a6]" />
                Ask Kaeo Advisor
              </h5>
              <p className="text-xs font-semibold leading-relaxed">
                "You’re overspending on recurring tools. Review Slack, AWS, and duplicate vendor payments first."
              </p>
            </div>
          </div>
        </motion.div>

        {/* Value Strip */}
        <div className="mt-20 border-t border-border pt-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 rounded-lg bg-primary/5 text-primary dark:text-[#2fb8a6]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Built for SMEs</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 rounded-lg bg-primary/5 text-primary dark:text-[#2fb8a6]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accountant-Ready</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 rounded-lg bg-primary/5 text-primary dark:text-[#2fb8a6]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Razorpay-Ready</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 rounded-lg bg-primary/5 text-primary dark:text-[#2fb8a6]">
                <Brain className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">AI CFO Advisor</span>
            </div>
            <div className="col-span-2 md:col-span-1 flex flex-col items-center gap-2">
              <div className="p-2.5 rounded-lg bg-primary/5 text-primary dark:text-[#2fb8a6]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CSV / XLSX Support</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
