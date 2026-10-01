import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { VyasaLogo, AppIcon, DropdownChevron } from '@vyasa/ui';
import { UniversityBrand, CSJMU_INSTITUTION, VYASA_BRAND } from '@vyasa/ui/branding';
import { useAuth } from '../../context/AuthContext';
import { getNivaranDestination } from '../../utils/personaRouting';
import './PublicNavbar.css';

export interface PublicNavbarProps {
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
}

interface NavSection {
  id: string;
  label: string;
  hash: string;
  isOperational?: boolean;
}

const PUBLIC_SECTIONS: NavSection[] = [
  { id: 'overview', label: 'Overview', hash: '#overview' },
  { id: 'vision', label: 'The Vision', hash: '#vision' },
  { id: 'domains', label: 'Four Domains', hash: '#domains' },
  { id: 'nivaran', label: 'NIVARAN-AI', hash: '#nivaran', isOperational: true },
  { id: 'innovation', label: 'Research & Innovation', hash: '#innovation' },
];

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  currentTab = 'overview',
  onSelectTab,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(currentTab || 'overview');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const loginTimeoutRef = useRef<number | null>(null);
  const registerTimeoutRef = useRef<number | null>(null);
  const loginContainerRef = useRef<HTMLDivElement>(null);
  const registerContainerRef = useRef<HTMLDivElement>(null);
  const loginBtnRef = useRef<HTMLButtonElement>(null);
  const registerBtnRef = useRef<HTMLButtonElement>(null);

  // 1. Sticky Navigation & Compact Header on Scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 2. Scroll-Aware Active Section Detection using IntersectionObserver
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const sectionElements = [
      document.getElementById('overview') || document.getElementById('hero'),
      document.getElementById('vision'),
      document.getElementById('domains'),
      document.getElementById('nivaran'),
      document.getElementById('innovation') || document.getElementById('research'),
    ].filter(Boolean) as HTMLElement[];

    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id === 'hero' || id === 'overview') {
              setActiveSection('overview');
            } else if (id === 'research' || id === 'innovation') {
              setActiveSection('innovation');
            } else {
              setActiveSection(id);
            }
          }
        });
      },
      {
        rootMargin: '-80px 0px -40% 0px',
        threshold: 0.15,
      }
    );

    sectionElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [location.pathname]);

  // 3. Close Dropdowns on Click Outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        loginContainerRef.current &&
        !loginContainerRef.current.contains(target)
      ) {
        setIsLoginOpen(false);
      }
      if (
        registerContainerRef.current &&
        !registerContainerRef.current.contains(target)
      ) {
        setIsRegisterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current);
      if (registerTimeoutRef.current) clearTimeout(registerTimeoutRef.current);
    };
  }, []);

  // 4. Keyboard Navigation (Escape Closes Menus)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isLoginOpen) {
        setIsLoginOpen(false);
        loginBtnRef.current?.focus();
      }
      if (isRegisterOpen) {
        setIsRegisterOpen(false);
        registerBtnRef.current?.focus();
      }
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    }
  };

  // Hover Handlers with safe debounce to prevent flickering
  const handleLoginMouseEnter = () => {
    if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current);
    setIsLoginOpen(true);
    setIsRegisterOpen(false);
  };

  const handleLoginMouseLeave = () => {
    loginTimeoutRef.current = window.setTimeout(() => {
      setIsLoginOpen(false);
    }, 180);
  };

  const handleRegisterMouseEnter = () => {
    if (registerTimeoutRef.current) clearTimeout(registerTimeoutRef.current);
    setIsRegisterOpen(true);
    setIsLoginOpen(false);
  };

  const handleRegisterMouseLeave = () => {
    registerTimeoutRef.current = window.setTimeout(() => {
      setIsRegisterOpen(false);
    }, 180);
  };

  // Navigation Click Handlers
  const handleSectionClick = (section: NavSection, e: React.MouseEvent) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);

    // Section 15 Requirement: Clicking NIVARAN-AI respects authentication
    if (section.id === 'nivaran') {
      const dest = getNivaranDestination(auth);
      navigate(dest);
      return;
    }

    if (onSelectTab) {
      onSelectTab(section.id);
    }

    if (location.pathname !== '/') {
      navigate(`/${section.hash}`);
      return;
    }

    if (section.id === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveSection('overview');
      return;
    }

    const targetEl =
      document.getElementById(section.id) ||
      (section.id === 'innovation' ? document.getElementById('research') : null);

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(section.id);
    }
  };

  const handleLogoClick = () => {
    if (onSelectTab) {
      onSelectTab('overview');
    }
    setActiveSection('overview');
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  return (
    <header
      className={`vyasa-public-header ${isScrolled ? 'is-scrolled' : ''}`}
      onKeyDown={handleKeyDown}
      role="banner"
    >
      {/* 1. CSJMU Institutional Affiliation Bar */}
      <div className="csjmu-top-bar">
        <div
          className="vyasa-page-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <UniversityBrand size="sm" showAccreditation={true} theme="dark" />
          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
            {CSJMU_INSTITUTION.location}
          </div>
        </div>
      </div>

      {/* 2. Primary Ecosystem Masthead */}
      <div className="vyasa-public-masthead">
        <div
          aria-hidden="true"
          style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, var(--vyasa-gold, #d4a017), transparent)',
          }}
        />

        <div className="vyasa-page-container vyasa-public-masthead__inner">
          {/* VYASA Logo & Perfectly Centered Tagline Identity Lockup */}
          <div
            className="vyasa-public-logo-lockup"
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            aria-label={`${VYASA_BRAND.productName} - ${VYASA_BRAND.taglineHindi}`}
          >
            <VyasaLogo size={isScrolled ? 42 : 46} />
            <span className="vyasa-public-logo-tagline" lang="hi">
              {VYASA_BRAND.taglineHindi}
            </span>
          </div>

          {/* Desktop Section Navigation Links */}
          <nav aria-label="Ecosystem section navigation">
            <ul className="vyasa-public-nav-list">
              {PUBLIC_SECTIONS.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <li key={sec.id} className="vyasa-public-nav-item">
                    <button
                      type="button"
                      className={`vyasa-public-nav-link ${isActive ? 'is-active' : ''}`}
                      onClick={(e) => handleSectionClick(sec, e)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span>{sec.label}</span>
                      {sec.isOperational && (
                        <span className="vyasa-operational-indicator" title="Operational Domain">
                          Live
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Contextual Access Dropdowns (LOGIN ▾ & REGISTER ▾) */}
          <div className="vyasa-public-actions">
            {/* LOGIN ▾ Dropdown */}
            <div
              ref={loginContainerRef}
              className="vyasa-dropdown-wrap"
              onMouseEnter={handleLoginMouseEnter}
              onMouseLeave={handleLoginMouseLeave}
            >
              <button
                ref={loginBtnRef}
                type="button"
                className={`vyasa-access-btn vyasa-access-btn--login ${isLoginOpen ? 'is-open' : ''}`}
                aria-haspopup="menu"
                aria-expanded={isLoginOpen}
                onClick={() => setIsLoginOpen((prev) => !prev)}
              >
                <span>LOGIN</span>
                <DropdownChevron isOpen={isLoginOpen} size={12} color="#ffffff" />
              </button>

              {isLoginOpen && (
                <div
                  className="vyasa-access-menu"
                  role="menu"
                  aria-label="Login options"
                  data-testid="login-dropdown-menu"
                >
                  <div className="vyasa-access-menu-header">LOGIN</div>

                  <button
                    type="button"
                    role="menuitem"
                    className="vyasa-access-menu-item"
                    onClick={() => {
                      setIsLoginOpen(false);
                      navigate('/applicant/login');
                    }}
                  >
                    <span className="vyasa-access-menu-icon" aria-hidden="true">
                      <AppIcon name="graduation-cap" size={17} color="var(--vyasa-primary, #0f2b48)" />
                    </span>
                    <div>
                      <div className="vyasa-access-menu-title">Applicant / Scholar</div>
                      <div className="vyasa-access-menu-desc">Access Scholar Workspace</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="vyasa-access-menu-item"
                    onClick={() => {
                      setIsLoginOpen(false);
                      navigate('/authority/login');
                    }}
                  >
                    <span className="vyasa-access-menu-icon" aria-hidden="true">
                      <AppIcon name="building" size={17} color="var(--vyasa-primary, #0f2b48)" />
                    </span>
                    <div>
                      <div className="vyasa-access-menu-title">Authority</div>
                      <div className="vyasa-access-menu-desc">Institutional Authority Sign In</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* REGISTER ▾ Dropdown */}
            <div
              ref={registerContainerRef}
              className="vyasa-dropdown-wrap"
              onMouseEnter={handleRegisterMouseEnter}
              onMouseLeave={handleRegisterMouseLeave}
            >
              <button
                ref={registerBtnRef}
                type="button"
                className={`vyasa-access-btn vyasa-access-btn--register ${isRegisterOpen ? 'is-open' : ''}`}
                aria-haspopup="menu"
                aria-expanded={isRegisterOpen}
                onClick={() => setIsRegisterOpen((prev) => !prev)}
              >
                <span>REGISTER</span>
                <DropdownChevron isOpen={isRegisterOpen} size={12} color="#ffffff" />
              </button>

              {isRegisterOpen && (
                <div
                  className="vyasa-access-menu"
                  role="menu"
                  aria-label="Register options"
                  data-testid="register-dropdown-menu"
                >
                  <div className="vyasa-access-menu-header">REGISTER</div>

                  <button
                    type="button"
                    role="menuitem"
                    className="vyasa-access-menu-item"
                    onClick={() => {
                      setIsRegisterOpen(false);
                      navigate('/applicant/register');
                    }}
                  >
                    <span className="vyasa-access-menu-icon" aria-hidden="true">
                      <AppIcon name="graduation-cap" size={17} color="var(--vyasa-primary, #0f2b48)" />
                    </span>
                    <div>
                      <div className="vyasa-access-menu-title">Applicant / Scholar</div>
                      <div className="vyasa-access-menu-desc">Create Scholar Account</div>
                    </div>
                  </button>

                  {/* NOTE: Strictly NO Authority Registration option per institutional security protocol */}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Hamburger Menu Toggle Button */}
          <button
            type="button"
            className="vyasa-mobile-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            <AppIcon name={isMobileMenuOpen ? "close" : "menu"} size={18} color="#ffffff" />
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        <div
          className={`vyasa-mobile-drawer ${isMobileMenuOpen ? 'is-open' : ''}`}
          data-testid="mobile-nav-drawer"
        >
          <ul className="vyasa-mobile-nav-list">
            {PUBLIC_SECTIONS.map((sec) => (
              <li key={sec.id}>
                <button
                  type="button"
                  className={`vyasa-mobile-nav-link ${activeSection === sec.id ? 'is-active' : ''}`}
                  onClick={(e) => handleSectionClick(sec, e)}
                >
                  <span>{sec.label}</span>
                  {sec.isOperational && (
                    <span className="vyasa-operational-indicator">Live</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="vyasa-mobile-divider" />

          <div className="vyasa-mobile-access-group">
            <div className="vyasa-mobile-access-heading">LOGIN</div>
            <button
              type="button"
              className="vyasa-mobile-access-btn"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/applicant/login');
              }}
            >
              <AppIcon name="graduation-cap" size={17} color="#ffffff" />
              <span>Applicant / Scholar</span>
            </button>
            <button
              type="button"
              className="vyasa-mobile-access-btn"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/authority/login');
              }}
            >
              <AppIcon name="building" size={17} color="#ffffff" />
              <span>Authority</span>
            </button>

            <div className="vyasa-mobile-access-heading" style={{ marginTop: '8px' }}>
              REGISTER
            </div>
            <button
              type="button"
              className="vyasa-mobile-access-btn vyasa-mobile-access-btn--register"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/applicant/register');
              }}
            >
              <AppIcon name="graduation-cap" size={17} color="#ffffff" />
              <span>Applicant / Scholar (Create Account)</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default PublicNavbar;
