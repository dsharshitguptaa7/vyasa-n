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
  { id: 'nivaran', label: 'NIVARAN', hash: '#nivaran', isOperational: true },
  { id: 'samiksha', label: 'SAMIKSHA', hash: '#samiksha' },
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

  const isAuthPage =
    location.pathname.startsWith('/applicant/login') ||
    location.pathname.startsWith('/applicant/register') ||
    location.pathname.startsWith('/authority/login');

  // 1. Sticky Navigation & Compact Header on Scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 1b. Pathname & Module-Aware Active Tab Detection
  useEffect(() => {
    if (
      location.pathname.startsWith('/modules/sama-veda') ||
      location.pathname.startsWith('/sama-veda') ||
      location.pathname.startsWith('/felicitation')
    ) {
      setActiveSection('samiksha');
    } else if (
      location.pathname.startsWith('/modules/atharva-veda/nivaran') ||
      location.pathname.startsWith('/atharva-veda/nivaran') ||
      location.pathname.startsWith('/nivaran')
    ) {
      setActiveSection('nivaran');
    } else if (location.pathname === '/') {
      if (location.hash) {
        const hashId = location.hash.replace('#', '');
        if (PUBLIC_SECTIONS.some((s) => s.id === hashId)) {
          setActiveSection(hashId);
        }
      }
    }
  }, [location.pathname, location.hash]);

  // 2. Scroll-Aware Active Section Detection using IntersectionObserver
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const sectionElements = [
      document.getElementById('overview') || document.getElementById('hero'),
      document.getElementById('vision'),
      document.getElementById('domains'),
      document.getElementById('nivaran'),
      document.getElementById('samiksha'),
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

    // Section 15 Requirement: Clicking NIVARAN respects authentication
    if (section.id === 'nivaran') {
      const dest = getNivaranDestination(auth);
      navigate(dest);
      return;
    }

    // SAMIKSHA Navigation: Direct access to public institutional research portal
    if (section.id === 'samiksha') {
      if (onSelectTab) {
        onSelectTab('samiksha');
      }
      navigate('/modules/sama-veda');
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
        <div className="vyasa-page-container csjmu-top-bar__inner">
          <UniversityBrand size="md" showAccreditation={true} theme="dark" />
          <div className="csjmu-top-bar__meta">
            <span className="csjmu-top-bar__location">{CSJMU_INSTITUTION.location}</span>
          </div>
        </div>
      </div>

      {/* 2. Solid Antique Gold Accent Divider Line */}
      <div className="vyasa-masthead-divider" aria-hidden="true" />

      {/* 3. Primary Ecosystem Masthead */}
      <div className="vyasa-public-masthead">
        <div className="vyasa-page-container vyasa-public-masthead__inner">
          {/* VYASA Logo & Horizontal Brand Lockup */}
          <div
            className="vyasa-public-logo-lockup"
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            aria-label={`${VYASA_BRAND.productName} - ${VYASA_BRAND.taglineHindi}`}
          >
            <VyasaLogo size={isScrolled ? 36 : 42} />
            <div className="vyasa-public-logo-text">
              <span className="vyasa-public-logo-title">VYASAᴺ ECOSYSTEM</span>
              <span className="vyasa-public-logo-tagline" lang="hi">
                {VYASA_BRAND.taglineHindi}
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          {isAuthPage ? (
            <nav aria-label="Authentication navigation" className="vyasa-public-nav-container">
              <button
                type="button"
                className="vyasa-auth-return-link"
                onClick={() => navigate('/')}
              >
                <AppIcon name="arrow-left" size={13} color="var(--vyasa-gold, #d4a017)" />
                <span>Return to Ecosystem Portal</span>
              </button>
            </nav>
          ) : (
            <nav aria-label="Ecosystem section navigation" className="vyasa-public-nav-container">
              <ul className="vyasa-public-nav-list">
                {PUBLIC_SECTIONS.map((sec) => {
                  const isActive = activeSection === sec.id;
                  const isSamiksha = sec.id === 'samiksha';
                  return (
                    <li key={sec.id} className="vyasa-public-nav-item">
                      <button
                        type="button"
                        className={`vyasa-public-nav-link ${isSamiksha ? 'vyasa-public-nav-link--samiksha' : ''} ${isActive ? 'is-active' : ''}`}
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
          )}

          {/* Divider between Navigation and Action Buttons */}
          <div className="vyasa-nav-vertical-divider" aria-hidden="true" />

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
                <AppIcon name="user" size={13} color="#ffffff" />
                <span>LOGIN</span>
                <DropdownChevron isOpen={isLoginOpen} size={11} color="#ffffff" />
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
                      <AppIcon name="graduation-cap" size={16} color="var(--vyasa-gold, #b2811a)" />
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
                      <AppIcon name="building" size={16} color="var(--vyasa-primary, #0f2b48)" />
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
                <DropdownChevron isOpen={isRegisterOpen} size={11} color="#ffffff" />
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
                      <AppIcon name="graduation-cap" size={16} color="var(--vyasa-gold, #b2811a)" />
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
          {isAuthPage ? (
            <ul className="vyasa-mobile-nav-list">
              <li>
                <button
                  type="button"
                  className="vyasa-mobile-nav-link is-active"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <AppIcon name="arrow-left" size={15} color="var(--vyasa-gold, #d4a017)" />
                  <span>Return to Ecosystem Portal</span>
                </button>
              </li>
            </ul>
          ) : (
            <ul className="vyasa-mobile-nav-list">
              {PUBLIC_SECTIONS.map((sec) => (
                <li key={sec.id}>
                  <button
                    type="button"
                    className={`vyasa-mobile-nav-link ${sec.id === 'samiksha' ? 'vyasa-mobile-nav-link--samiksha' : ''} ${activeSection === sec.id ? 'is-active' : ''}`}
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
          )}

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
