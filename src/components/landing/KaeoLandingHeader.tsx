import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

export const KaeoLandingHeader: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent, targetId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    
    // Check if we are on the landing page
    if (window.location.pathname !== '/') {
      navigate('/', { state: { scrollTo: targetId } });
      return;
    }

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
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'py-4 bg-background/80 dark:bg-[#070908]/80 backdrop-blur-lg border-b border-border' 
          : 'py-6 bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/10 transition-all group-hover:scale-105">
            <span className="text-primary-foreground font-black text-xl">K</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            Kaeo<span className="text-primary dark:text-[#2fb8a6]">.</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <a 
            href="#product" 
            onClick={(e) => handleNavClick(e, 'product')}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Product
          </a>
          <a 
            href="#how-it-works" 
            onClick={(e) => handleNavClick(e, 'how-it-works')}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            How it works
          </a>
          <a 
            href="#pricing" 
            onClick={(e) => handleNavClick(e, 'pricing')}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </a>
        </nav>

        {/* Desktop Auth Actions */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <Link 
              to="/dashboard"
              className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-md shadow-primary/10 hover:opacity-90 transition-all flex items-center gap-1.5"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link 
                to="/login"
                className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
              >
                Sign in
              </Link>
              <Link 
                to="/signup"
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-md shadow-primary/10 hover:opacity-90 transition-all"
              >
                Start free
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background/95 dark:bg-[#070908]/95 backdrop-blur-xl border-b border-border py-6 px-6 animate-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col gap-5 mb-6">
            <a 
              href="#product" 
              onClick={(e) => handleNavClick(e, 'product')}
              className="text-base font-bold text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Product
            </a>
            <a 
              href="#how-it-works" 
              onClick={(e) => handleNavClick(e, 'how-it-works')}
              className="text-base font-bold text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              How it works
            </a>
            <a 
              href="#pricing" 
              onClick={(e) => handleNavClick(e, 'pricing')}
              className="text-base font-bold text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Pricing
            </a>
          </nav>
          
          <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
            {user ? (
              <Link 
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-center shadow-md shadow-primary/10 hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link 
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 text-center font-bold text-muted-foreground hover:text-foreground transition-colors border border-border rounded-xl bg-muted/20"
                >
                  Sign in
                </Link>
                <Link 
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-center shadow-md shadow-primary/10 hover:opacity-90 transition-all"
                >
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
