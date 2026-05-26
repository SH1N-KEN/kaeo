import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  LogOut, 
  Loader2, 
  Building,
  CheckCircle2
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAuth } from '../components/auth/AuthProvider';
import { useToast } from '../hooks/useToast';
import aeLogo from '../assets/kaeo-ae-logo.png';

type OnboardingStep = 1 | 2 | 3;
type AccountMode = 'business_owner' | 'accountant';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { completeOnboarding } = useWorkspace();
  const { signOut } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<OnboardingStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Survey State
  const [mode, setMode] = useState<AccountMode | null>(null);
  
  // Singular Business State
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [spendRange, setSpendRange] = useState('10k_50k');
  const [teamSize, setTeamSize] = useState('2-10');
  const [accountingTool, setAccountingTool] = useState('Tally');
  const [painPoints, setPainPoints] = useState<string[]>([]);

  // Accountant State
  const [firmName, setFirmName] = useState('');
  const [clientsCount, setClientsCount] = useState('1-5');
  const [clientSize, setClientSize] = useState('Small (10-50 employees)');
  const [industriesServed, setIndustriesServed] = useState('');
  const [accountantTool, setAccountantTool] = useState('Tally');
  const [workflowPains, setWorkflowPains] = useState<string[]>([]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast('Signed out successfully', 'success');
      navigate('/login');
    } catch (err: any) {
      toast(err.message || 'Failed to sign out', 'error');
    }
  };

  const togglePainPoint = (pain: string) => {
    setPainPoints(prev => 
      prev.includes(pain) ? prev.filter(p => p !== pain) : [...prev, pain]
    );
  };

  const toggleWorkflowPain = (pain: string) => {
    setWorkflowPains(prev => 
      prev.includes(pain) ? prev.filter(p => p !== pain) : [...prev, pain]
    );
  };

  const handleNextStep = () => {
    if (step === 1 && !mode) {
      toast('Please select how you will use Kaeo to continue', 'info');
      return;
    }
    if (step === 2) {
      if (mode === 'business_owner' && !businessName.trim()) {
        toast('Please enter your business name', 'info');
        return;
      }
      if (mode === 'accountant' && !firmName.trim()) {
        toast('Please enter your firm or operator name', 'info');
        return;
      }
    }
    setStep(prev => (prev + 1) as OnboardingStep);
  };

  const handlePrevStep = () => {
    setStep(prev => (prev - 1) as OnboardingStep);
  };

  const handleSubmit = async () => {
    if (!mode) return;
    setLoading(true);
    setError(null);

    try {
      if (mode === 'business_owner') {
        const answers = {
          industry,
          monthly_spend_range: spendRange,
          team_size: teamSize,
          accounting_tools: [accountingTool],
          pain_points: painPoints
        };
        const clientMetadata = {
          industry,
          monthly_spend_range: spendRange,
          team_size: teamSize,
          accounting_tools: [accountingTool],
          pain_points: painPoints
        };
        await completeOnboarding(
          'business_owner',
          answers,
          businessName, // Org name
          businessName, // Default Client name
          clientMetadata
        );
        toast('Onboarding completed! Welcome to Kaeo.', 'success');
        navigate('/dashboard');
      } else {
        const answers = {
          clients_managed: clientsCount,
          typical_client_size: clientSize,
          industries_served: industriesServed,
          accounting_tools: [accountantTool],
          pain_points: workflowPains
        };
        await completeOnboarding(
          'accountant',
          answers,
          firmName // Org name
        );
        toast('Onboarding completed! Add your first client to start.', 'success');
        navigate('/clients');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save onboarding details');
      toast('Failed to complete setup', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Render Step 1: Mode Selection
  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[#2fb8a6]">Step 1 of 3</span>
        <h1 className="text-3xl font-black tracking-tight text-white">How will you use Kaeo?</h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          We will tailor your analytics workspace based on your primary workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Business Option */}
        <button
          type="button"
          onClick={() => setMode('business_owner')}
          className={`p-6 rounded-2xl border text-left transition-all relative flex flex-col justify-between h-48 cursor-pointer ${
            mode === 'business_owner'
              ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
              : 'bg-white/5 border-white/10 hover:border-white/20'
          }`}
        >
          {mode === 'business_owner' && (
            <div className="absolute top-4 right-4 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
          <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center border border-teal-500/20 text-teal-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">For my business</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              I manage one company and want Kaeo to review our spend, risks, and reports.
            </p>
          </div>
        </button>

        {/* Accountant Option */}
        <button
          type="button"
          onClick={() => setMode('accountant')}
          className={`p-6 rounded-2xl border text-left transition-all relative flex flex-col justify-between h-48 cursor-pointer ${
            mode === 'accountant'
              ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
              : 'bg-white/5 border-white/10 hover:border-white/20'
          }`}
        >
          {mode === 'accountant' && (
            <div className="absolute top-4 right-4 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
          <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center border border-teal-500/20 text-teal-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">For client businesses</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              I manage finance for multiple businesses as an accountant, consultant, or operator.
            </p>
          </div>
        </button>
      </div>

      <button
        onClick={handleNextStep}
        className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-lg shadow-primary/10 cursor-pointer"
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  // Render Step 2: Details Survey
  const renderStep2 = () => {
    const isBusiness = mode === 'business_owner';
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#2fb8a6]">Step 2 of 3</span>
          <h1 className="text-3xl font-black tracking-tight text-white">
            {isBusiness ? 'Tell us about your business' : 'Tell us about your practice'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Basic background details to configure your initial close parameters.
          </p>
        </div>

        <div className="space-y-4">
          {isBusiness ? (
            <>
              {/* Business Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Software Pvt Ltd"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>

              {/* Industry */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Industry</label>
                <input
                  type="text"
                  placeholder="e.g. Technology, E-commerce, Logistics"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>

              {/* Monthly Spend & Team Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly Spend</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#161a18] text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={spendRange}
                    onChange={(e) => setSpendRange(e.target.value)}
                  >
                    <option value="under_10k">Under ₹10k</option>
                    <option value="10k_50k">₹10k - ₹50k</option>
                    <option value="50k_2l">₹50k - ₹2L</option>
                    <option value="above_2l">Above ₹2L</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Size</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#161a18] text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                  >
                    <option value="1">1 (Solo Founder)</option>
                    <option value="2-10">2 - 10 employees</option>
                    <option value="11-50">11 - 50 employees</option>
                    <option value="50+">50+ employees</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Firm Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Firm / Operator Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Consulting & Accounting"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  required
                />
              </div>

              {/* Clients count & typical size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clients Managed</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#161a18] text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={clientsCount}
                    onChange={(e) => setClientsCount(e.target.value)}
                  >
                    <option value="1-5">1 - 5 clients</option>
                    <option value="6-15">6 - 15 clients</option>
                    <option value="16-50">16 - 50 clients</option>
                    <option value="50+">50+ clients</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client Size</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#161a18] text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={clientSize}
                    onChange={(e) => setClientSize(e.target.value)}
                  >
                    <option value="Micro (< 10 employees)">Micro (&lt; 10 employees)</option>
                    <option value="Small (10-50 employees)">Small (10-50 employees)</option>
                    <option value="Medium (50-250 employees)">Medium (50-250 employees)</option>
                    <option value="Large (250+ employees)">Large (250+ employees)</option>
                  </select>
                </div>
              </div>

              {/* Industries Served */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Industries Served</label>
                <input
                  type="text"
                  placeholder="e.g. SaaS, E-commerce, Manufacturing"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30"
                  value={industriesServed}
                  onChange={(e) => setIndustriesServed(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handlePrevStep}
            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleNextStep}
            className="flex-2 w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-lg shadow-primary/10 cursor-pointer"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render Step 3: Workflows & Pain points
  const renderStep3 = () => {
    const isBusiness = mode === 'business_owner';
    const activeTool = isBusiness ? accountingTool : accountantTool;
    const setActiveTool = isBusiness ? setAccountingTool : setAccountantTool;

    const availablePains = isBusiness 
      ? [
          { id: 'duplicate_payments', label: 'Duplicate Payments & Overdrafts' },
          { id: 'messy_statements', label: 'Messy Bank / Card Statements' },
          { id: 'vendor_overspend', label: 'Vendor & Software Overspend' },
          { id: 'month_end_reports', label: 'Time-consuming Month-End Reports' },
          { id: 'cashflow_visibility', label: 'Lack of Real-time Cashflow Visibility' },
          { id: 'accountant_handoff', label: 'Messy Accountant Collaboration' }
        ]
      : [
          { id: 'collecting_files', label: 'Chasing Clients for Bank Statements' },
          { id: 'cleaning_statements', label: 'Manually Formatting & Cleaning Sheets' },
          { id: 'identifying_risks', label: 'Finding Hidden Ledger Anomalies' },
          { id: 'preparing_reports', label: 'Preparing Structured Month-End Packs' },
          { id: 'client_communication', label: 'Inefficient Client Query Communication' },
          { id: 'month_end_review', label: 'Stressful Close Deadlines & Review' }
        ];

    const currentPains = isBusiness ? painPoints : workflowPains;
    const togglePain = isBusiness ? togglePainPoint : toggleWorkflowPain;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#2fb8a6]">Step 3 of 3</span>
          <h1 className="text-3xl font-black tracking-tight text-white">Select your workflow</h1>
          <p className="text-sm text-muted-foreground">
            We will calibrate the Libby Advisor to prioritize these pain points.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 text-xs text-risk font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-5">
          {/* Accounting tool */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Accounting Tool</label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#161a18] text-white focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                value={activeTool}
                onChange={(e) => setActiveTool(e.target.value)}
              >
                <option value="Tally">Tally</option>
                <option value="Zoho Books">Zoho Books</option>
                <option value="Excel/Sheets">Excel / Google Sheets</option>
                <option value="Razorpay">Razorpay</option>
                <option value="Other">Other / None</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <ArrowRight className="w-4 h-4 rotate-45" />
              </div>
            </div>
          </div>

          {/* Pain points checklist */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isBusiness ? 'Where do you lose the most time/money?' : 'What is your biggest workflow bottleneck?'}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {availablePains.map((pain) => {
                const isSelected = currentPains.includes(pain.id);
                return (
                  <button
                    key={pain.id}
                    type="button"
                    onClick={() => togglePain(pain.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all text-xs font-semibold flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-primary/5 border-primary/45 text-white'
                        : 'bg-white/5 border-white/5 text-muted-foreground hover:border-white/15'
                    }`}
                  >
                    <span>{pain.label}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handlePrevStep}
            disabled={loading}
            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-2 w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Finish Setup
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#070908] flex flex-col font-sans text-white relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-0 w-[450px] h-[450px] bg-primary/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[350px] h-[350px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header bar */}
      <header className="px-6 h-16 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#070908]/80 backdrop-blur-md relative z-20">
        <div className="flex items-center gap-2 select-none">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/25">
            <img src={aeLogo} alt="ae" className="w-4 h-4 object-contain" />
          </div>
          <span className="text-lg font-bold tracking-tight text-teal-400 leading-none">
            Kaeo
          </span>
        </div>

        <button 
          onClick={handleSignOut}
          className="px-3.5 py-1.5 rounded-lg border border-white/10 hover:border-rose-500/20 text-xs font-bold text-muted-foreground hover:text-rose-400 bg-white/5 hover:bg-rose-500/5 transition-all flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </header>

      {/* Wizard area */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-xl bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl relative">
          
          {/* Progress bar indicator */}
          <div className="absolute top-0 inset-x-8 h-1 flex gap-1">
            <div className={`flex-1 rounded-full transition-colors duration-300 ${step >= 1 ? 'bg-primary' : 'bg-white/10'}`} />
            <div className={`flex-1 rounded-full transition-colors duration-300 ${step >= 2 ? 'bg-primary' : 'bg-white/10'}`} />
            <div className={`flex-1 rounded-full transition-colors duration-300 ${step >= 3 ? 'bg-primary' : 'bg-white/10'}`} />
          </div>

          <div className="pt-2">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>
        </div>
      </div>

      <footer className="h-12 border-t border-white/5 flex items-center justify-center text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">
        <span>© 2026 Kaeo Finance OS &middot; Privacy &amp; Terms</span>
      </footer>
    </div>
  );
};

export default Onboarding;
