import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import aeLogo from '../../assets/kaeo-ae-logo.png';

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

    if (targetId === 'pricing' && user) {
      navigate('/billing');
      return;
    }

    if (window.location.pathname !== '/') {
      navigate('/', { state: { scrollTo: targetId } });
      return;
    }

    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 72;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#080A09]/90 backdrop-blur-xl border-b border-[rgba(140,150,148,0.08)]'
          : 'bg-transparent border-b border-transparent'
      }`}
      style={{ padding: '0 0' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 48px',
          maxWidth: '1280px',
          margin: '0 auto',
        }}
      >
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img
            src={aeLogo}
            alt="Kaeo"
            style={{
              width: '28px',
              height: '28px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 8px rgba(19, 140, 126, 0.35))',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#E8F0EE',
              lineHeight: 1,
            }}
          >
            Kaeo
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav
          className="hidden md:flex"
          style={{ display: 'flex', alignItems: 'center', gap: '32px' }}
        >
          <a
            href="#how-it-works"
            onClick={(e) => handleNavClick(e, 'how-it-works')}
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'rgba(232, 240, 238, 0.55)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            className="hover:text-[#E8F0EE]"
          >
            How it works
          </a>
          <a
            href="#what-kaeo-catches"
            onClick={(e) => handleNavClick(e, 'what-kaeo-catches')}
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'rgba(232, 240, 238, 0.55)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            className="hover:text-[#E8F0EE]"
          >
            Features
          </a>
          <a
            href="#pricing"
            onClick={(e) => handleNavClick(e, 'pricing')}
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'rgba(232, 240, 238, 0.55)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            className="hover:text-[#E8F0EE]"
          >
            Pricing
          </a>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user ? (
            <Link
              to="/dashboard"
              style={{
                background: '#138C7E',
                color: '#080A09',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-block',
                textDecoration: 'none',
              }}
            >
              Dashboard →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'rgba(232, 240, 238, 0.55)',
                  textDecoration: 'none',
                  padding: '8px 12px',
                }}
                className="hover:text-[#E8F0EE]"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                style={{
                  background: '#138C7E',
                  color: '#080A09',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '999px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-block',
                  textDecoration: 'none',
                }}
              >
                Start reviewing →
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden"
          style={{
            padding: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#E8F0EE',
          }}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X style={{ width: '22px', height: '22px' }} /> : <Menu style={{ width: '22px', height: '22px' }} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            background: 'rgba(8, 10, 9, 0.98)',
            backdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(140, 150, 148, 0.10)',
            padding: '24px 24px 32px',
          }}
          className="md:hidden"
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'How it works', id: 'how-it-works' },
              { label: 'Features', id: 'what-kaeo-catches' },
              { label: 'Pricing', id: 'pricing' },
            ].map(({ label, id }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => handleNavClick(e, id)}
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: 'rgba(232, 240, 238, 0.7)',
                  textDecoration: 'none',
                  padding: '4px 0',
                }}
              >
                {label}
              </a>
            ))}
          </nav>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(140, 150, 148, 0.08)', paddingTop: '20px' }}>
            {user ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  background: '#138C7E',
                  color: '#080A09',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '15px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'block',
                }}
              >
                Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    border: '1px solid rgba(140, 150, 148, 0.15)',
                    color: '#E8F0EE',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    fontWeight: 500,
                    fontSize: '15px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    background: '#138C7E',
                    color: '#080A09',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '15px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >
                  Start reviewing →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
