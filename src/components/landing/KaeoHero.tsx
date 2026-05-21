import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Play, 
  UploadCloud, 
  Brain, 
  ShieldCheck, 
  CheckCircle2, 
  MessageSquare,
  LayoutDashboard,
  Files,
  ArrowRightLeft,
  Users,
  AlertTriangle,
  BarChart3,
  Download,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Info,
  AlertCircle,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { motion } from 'framer-motion';
import aeLogo from '../../assets/kaeo-ae-logo.png';

export const KaeoHero: React.FC = () => {
  const { user } = useAuth();

  const handleScrollToPreview = (e: React.MouseEvent) => {
    e.preventDefault();
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
            className="text-lg md:text-xl text-muted-foreground/90 font-medium leading-relaxed max-w-3xl mx-auto mb-10"
          >
            Kaeo is an AI CFO workspace for SMEs. Upload messy CSV/XLSX statements, detect duplicate payments, risky vendors, uncontrolled spend, and generate accountant-ready reports.
          </motion.p>

          {/* CTAs */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link 
              to={user ? "/dashboard" : "/signup"}
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-95 shadow-xl shadow-primary/15 hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              {user ? 'Go to Dashboard' : 'Start free'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="#product-preview"
              onClick={handleScrollToPreview}
              className="w-full sm:w-auto px-8 py-4 bg-card hover:bg-muted/10 border border-border text-foreground rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
              View demo
            </a>
          </motion.div>

          {/* 3 Proof/Value Bullet Points */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mt-6 text-xs text-muted-foreground font-bold"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
              No Credit Card Required
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
              Indian Banks & CSV / XLSX Support
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary dark:text-[#2fb8a6]" />
              GDPR Compliant & Local-First Processing
            </div>
          </motion.div>
        </motion.div>

        {/* Product Preview Card (Realistic Kaeo Dashboard) */}
        <motion.div 
          id="product-preview"
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ type: 'spring', damping: 28, stiffness: 80, delay: 0.1 }}
          className="relative max-w-6xl mx-auto rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#070908] text-white flex flex-col md:flex-row min-h-[580px] select-none"
        >
          {/* Collapsed Sidebar Rail Mock */}
          <div className="hidden md:flex flex-col items-center justify-between py-6 w-16 border-r border-white/10 bg-white/5 select-none text-muted-foreground">
            <div className="flex flex-col items-center gap-8">
              {/* compact logo */}
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/25 flex items-center justify-center">
                <img src={aeLogo} alt="ae" className="w-4 h-4 object-contain" />
              </div>
              
              {/* menu items mock */}
              <div className="flex flex-col items-center gap-4">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors">
                  <Files className="w-4 h-4" />
                </div>
                <div className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors">
                  <Users className="w-4 h-4" />
                </div>
                <div className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
            </div>
            
            <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-[#2fb8a6] font-bold text-xs">
              C
            </div>
          </div>

          {/* Right Side: Main Application View */}
          <div className="flex-1 flex flex-col bg-[#070908] text-white">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/10 select-none">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 border border-yellow-500/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/40 border border-green-500/10" />
                <span className="text-xs font-semibold text-muted-foreground ml-2">Kaeo CFO Workspace</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/10 text-[#2fb8a6] border border-[#2fb8a6]/20 shadow-sm shadow-teal-500/5">
                Product Preview &middot; Illustrative Data
              </span>
            </div>

            {/* Dashboard Workspace */}
            <div className="p-6 space-y-6 flex-1 overflow-hidden">
              {/* CFO Workspace Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight text-white">CFO Workspace</h2>
                    <div className="px-1.5 py-0.5 bg-teal-500/10 text-[#2fb8a6] text-[9px] font-black rounded border border-[#2fb8a6]/20 uppercase tracking-widest">Live OS</div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Strategic workspace overview for <span className="text-white font-semibold">an illustrative SME</span></p>
                </div>
                
                <div className="flex gap-2">
                  <div className="px-3 py-1.5 bg-white/5 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-white/10">
                    <Download className="w-3 h-3 text-muted-foreground" /> Download Report
                  </div>
                  <div className="px-3 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg text-[10px] flex items-center gap-1.5 shadow-sm">
                    <Plus className="w-3 h-3" /> Add Transaction
                  </div>
                </div>
              </div>

              {/* 5 Authentic Metric Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Total Revenue */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:border-[#2fb8a6]/30 hover:bg-white/10 group">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="p-2 bg-white/5 rounded-xl group-hover:bg-[#2fb8a6]/10 transition-colors duration-500">
                      <TrendingUp className="w-4 h-4 text-teal-400" />
                    </div>
                    <div className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                      +12.4%
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Revenue</h4>
                    <div className="text-lg font-black tracking-tight text-success">₹28,85,000</div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1 font-medium leading-tight">From customer payments</p>
                  </div>
                </div>

                {/* 2. Refunds & Recoveries */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:border-[#2fb8a6]/30 hover:bg-white/10 group">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="p-2 bg-white/5 rounded-xl group-hover:bg-[#2fb8a6]/10 transition-colors duration-500">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                      +4.8%
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Refunds & Recoveries</h4>
                    <div className="text-lg font-black tracking-tight text-success">₹52,500</div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1 font-medium leading-tight">From 3 reversal entries</p>
                  </div>
                </div>

                {/* 3. Total Expenses */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:border-[#2fb8a6]/30 hover:bg-white/10 group">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="p-2 bg-white/5 rounded-xl group-hover:bg-primary/10 transition-colors duration-500">
                      <TrendingDown className="w-4 h-4 text-rose-400/80" />
                    </div>
                    <div className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-risk/10 text-risk">
                      -8.2%
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Expenses</h4>
                    <div className="text-lg font-black tracking-tight text-risk">₹18,04,566</div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1 font-medium leading-tight">From imported expense rows</p>
                  </div>
                </div>

                {/* 4. Net Cash Movement */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:border-[#2fb8a6]/30 hover:bg-white/10 group">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="p-2 bg-white/5 rounded-xl group-hover:bg-[#2fb8a6]/10 transition-colors duration-500">
                      <DollarSign className="w-4 h-4 text-success" />
                    </div>
                    <div className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-success/10 text-success font-bold">
                      Positive
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Net Cash Movement</h4>
                    <div className="text-lg font-black tracking-tight text-success">₹11,32,934</div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1 font-medium leading-tight">Net cashflow positive</p>
                  </div>
                </div>

                {/* 5. Transactions */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:border-[#2fb8a6]/30 hover:bg-white/10 group col-span-2 lg:col-span-1">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="p-2 bg-white/5 rounded-xl group-hover:bg-[#2fb8a6]/10 transition-colors duration-500">
                      <FileText className="w-4 h-4 text-[#2fb8a6]" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Transactions</h4>
                    <div className="text-lg font-black tracking-tight text-white">39</div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1 font-medium leading-tight">Imported transactions</p>
                  </div>
                </div>
              </div>

              {/* Chart and Detail Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column: Timeline Chart + Ask Kaeo Advisor Bubble */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Custom Cash Flow Timeline Chart */}
                  <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex flex-col justify-between min-h-[220px]">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-white">Cash Flow Timeline</h4>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Real-time daily flow tracking</p>
                      </div>
                      <div className="flex items-center gap-3 text-[9px] font-bold">
                        <span className="flex items-center gap-1 text-success"><span className="w-1.5 h-1.5 rounded-full bg-success" /> Inflow</span>
                        <span className="flex items-center gap-1 text-risk"><span className="w-1.5 h-1.5 rounded-full bg-risk" /> Outflow</span>
                      </div>
                    </div>

                    {/* SVG Chart Visualization */}
                    <div className="relative h-28 w-full mt-3">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                        {/* Grid Lines */}
                        <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                        <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                        <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                        
                        {/* Gradients */}
                        <defs>
                          <linearGradient id="svgInflow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.03" />
                            <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="svgOutflow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#E5484D" stopOpacity="0.02" />
                            <stop offset="100%" stopColor="#E5484D" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {/* Inflow Area & Path */}
                        <path d="M0,100 L0,80 Q100,20 200,60 T400,30 Q450,10 500,25 L500,100 Z" fill="url(#svgInflow)" />
                        <path d="M0,80 Q100,20 200,60 T400,30 Q450,10 500,25" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
                        
                        {/* Outflow Area & Path */}
                        <path d="M0,100 L0,95 Q100,75 200,85 T400,60 Q450,45 500,55 L500,100 Z" fill="url(#svgOutflow)" />
                        <path d="M0,95 Q100,75 200,85 T400,60 Q450,45 500,55" fill="none" stroke="#E5484D" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 1" />
                      </svg>
                    </div>

                    <div className="flex justify-between text-[8px] text-muted-foreground font-bold mt-2 uppercase border-t border-white/10 pt-1.5">
                      <span>May 01</span>
                      <span>May 07</span>
                      <span>May 14</span>
                      <span>May 21</span>
                      <span>Live (May 22)</span>
                    </div>
                  </div>

                  {/* Ask Kaeo Advisor Bubble */}
                  <div className="p-4.5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white">Ask Kaeo Advisor</span>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">AI Active</span>
                    </div>
                    <div className="space-y-3 text-[10px]">
                      {/* User chat bubble */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-tr-none bg-primary text-primary-foreground font-semibold">
                          Who are my top growing SaaS vendors this quarter?
                        </div>
                      </div>
                      {/* AI reply bubble */}
                      <div className="flex gap-2.5 items-start">
                        <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/25 flex items-center justify-center shrink-0">
                          <img src={aeLogo} alt="ae" className="w-3 h-3 object-contain" />
                        </div>
                        <div className="flex-1 bg-white/5 border border-white/10 p-2.5 rounded-xl rounded-tl-none text-muted-foreground leading-relaxed">
                          <strong className="text-white">Amazon Web Services</strong> spend increased by 42% (cumulative spend: <span className="text-risk font-bold">₹2,45,000</span>). I also identified a duplicate payment of <span className="text-risk font-bold">₹75,000</span> to Slack Technologies in the Risk Inbox.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Strategic Insights Panel */}
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md space-y-4 h-full flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Strategic Insights Title */}
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 border-b border-white/10 pb-2">
                        <Info className="w-3.5 h-3.5 text-teal-400" />
                        Strategic Insights
                      </h3>

                      {/* Primary Expense Destination Card */}
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1.5">Primary Expense Destination</p>
                        <p className="text-xs font-bold text-white mb-0.5 truncate">Amazon Web Services</p>
                        <p className="text-[10px] text-muted-foreground">
                          Cumulative spend: <span className="font-extrabold text-risk">₹2,45,000</span>
                        </p>
                      </div>

                      {/* Risk Alert Card */}
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="text-[9px] font-black uppercase tracking-wider text-risk flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-risk" /> Risk Alert
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-risk/10 text-risk border border-risk/20 text-[8px] font-black uppercase tracking-wider">
                            High Severity
                          </span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-risk/10 border border-risk/20 flex items-center justify-center shrink-0">
                            <MoreHorizontal className="w-4 h-4 text-risk" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">Slack Technologies</h4>
                            <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                              Duplicate payment of <span className="text-risk font-semibold">₹75,000</span> flagged for review on April 12.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ingested Ledgers Card */}
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                        <h5 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Ingested Ledgers</h5>
                        <span className="text-[8px] font-black text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Active</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="truncate text-white max-w-[110px] font-bold">hdfc_fy26.xlsx</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-teal-500/10 text-[#2fb8a6] font-black border border-[#2fb8a6]/25">Excel Support</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="truncate text-white max-w-[110px] font-bold">razorpay_mar.csv</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-teal-500/10 text-[#2fb8a6] font-black border border-[#2fb8a6]/25">CSV Support</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                <UploadCloud className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CSV/XLSX Support</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 rounded-lg bg-primary/5 text-primary dark:text-[#2fb8a6]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accountant-ready Reports</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 rounded-lg bg-primary/5 text-primary dark:text-[#2fb8a6]">
                <Brain className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">AI CFO Advisor</span>
            </div>
            <div className="col-span-2 md:col-span-1 flex flex-col items-center gap-2">
              <div className="p-2.5 rounded-lg bg-primary/5 text-primary dark:text-[#2fb8a6]">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Razorpay-ready Billing</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
