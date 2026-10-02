import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Badge, NotificationBell, AppIcon } from '@vyasa/ui';
import { InstitutionalHeader } from '@vyasa/ui/branding';
import { useAuth } from '../../context/AuthContext';
import { ServicesMenu } from './ServicesMenu';
import { ProfileMenu } from './ProfileMenu';
import { PublicNavbar } from './PublicNavbar';

interface NavbarProps {
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  onSignInClick?: () => void;
}

interface WorkspaceItem {
  id: string;
  label: string;
  to: string;
}

interface WorkspaceConfig {
  productTitle: string;
  authorityTitle: string;
  homeRoute: string;
  badgeVariant: 'gold' | 'teal' | 'primary' | 'saffron';
  badgeLabel: string;
  items: WorkspaceItem[];
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab = 'overview',
  onSelectTab,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const {
    isAuthenticated,
    isAdmin,
    isApplicant,
    isManager,
    isAssistantDean,
    isAssociateDean,
    isDean,
    authorityRole,
    authorityDesignation,
    displayName,
    logout,
  } = auth;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll and listen for Escape key when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsMobileMenuOpen(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isMobileMenuOpen]);

  const handleSignOut = () => {
    setIsMobileMenuOpen(false);
    const wasApplicant = isApplicant;
    logout();
    navigate(wasApplicant ? '/applicant/login' : '/authority/login');
  };

  // Determine persona-specific workspace configuration for NIVARAN Service Shell
  const getWorkspaceConfig = (): WorkspaceConfig => {
    if (isDean) {
      return {
        productTitle: 'NIVARAN-AI',
        authorityTitle: 'Dean Executive Authority',
        homeRoute: '/modules/atharva-veda/nivaran/dean/dashboard',
        badgeVariant: 'gold',
        badgeLabel: authorityDesignation || 'Dean R&D',
        items: [
          { id: 'dean-dashboard', label: 'Executive Dashboard', to: '/modules/atharva-veda/nivaran/dean/dashboard' },
          { id: 'dean-cases', label: 'Executive Queue', to: '/modules/atharva-veda/nivaran/dean/cases' },
          { id: 'dean-efiles', label: 'E-Files', to: '/modules/atharva-veda/nivaran/e-files' },
          { id: 'dean-smr', label: 'Student Records', to: '/modules/atharva-veda/nivaran/student-records' },
        ],
      };
    }

    if (isAssociateDean) {
      return {
        productTitle: 'NIVARAN-AI',
        authorityTitle: 'Associate Dean Authority',
        homeRoute: '/modules/atharva-veda/nivaran/associate-dean/dashboard',
        badgeVariant: 'teal',
        badgeLabel: authorityDesignation || 'Associate Dean',
        items: [
          { id: 'assoc-dashboard', label: 'Executive Docket', to: '/modules/atharva-veda/nivaran/associate-dean/dashboard' },
          { id: 'assoc-cases', label: 'Cluster Cases', to: '/modules/atharva-veda/nivaran/associate-dean/cases' },
          { id: 'assoc-efiles', label: 'E-Files', to: '/modules/atharva-veda/nivaran/e-files' },
          { id: 'assoc-smr', label: 'Student Records', to: '/modules/atharva-veda/nivaran/student-records' },
        ],
      };
    }

    if (isAssistantDean) {
      return {
        productTitle: 'NIVARAN-AI',
        authorityTitle: 'Assistant Dean Authority',
        homeRoute: '/modules/atharva-veda/nivaran/assistant-dean/dashboard',
        badgeVariant: 'teal',
        badgeLabel: authorityDesignation || 'Assistant Dean',
        items: [
          { id: 'asst-dashboard', label: 'Jurisdictional Docket', to: '/modules/atharva-veda/nivaran/assistant-dean/dashboard' },
          { id: 'asst-cases', label: 'Assigned Cases', to: '/modules/atharva-veda/nivaran/assistant-dean/cases' },
          { id: 'asst-efiles', label: 'E-Files', to: '/modules/atharva-veda/nivaran/e-files' },
          { id: 'asst-smr', label: 'Student Records', to: '/modules/atharva-veda/nivaran/student-records' },
        ],
      };
    }

    if (isManager) {
      return {
        productTitle: 'NIVARAN-AI',
        authorityTitle: 'Triage & Verification Authority',
        homeRoute: '/modules/atharva-veda/nivaran/manager/queue',
        badgeVariant: 'teal',
        badgeLabel: 'Triage Manager',
        items: [
          { id: 'mgr-queue', label: 'Triage Queue', to: '/modules/atharva-veda/nivaran/manager/queue' },
          { id: 'mgr-closure-queue', label: 'Closure Review', to: '/modules/atharva-veda/nivaran/manager/closure-queue' },
          { id: 'mgr-efiles', label: 'E-Files', to: '/modules/atharva-veda/nivaran/e-files' },
          { id: 'mgr-smr', label: 'Student Records', to: '/modules/atharva-veda/nivaran/student-records' },
          { id: 'mgr-ledger', label: 'Governance Ledger', to: '/authority' },
        ],
      };
    }

    if (isAdmin && !authorityRole) {
      return {
        productTitle: 'VYASAᴺ PLATFORM',
        authorityTitle: 'Central Administration Console',
        homeRoute: '/admin',
        badgeVariant: 'primary',
        badgeLabel: 'Administrator',
        items: [
          { id: 'admin-dashboard', label: 'Dashboard', to: '/admin' },
          { id: 'admin-authorities', label: 'Authorities', to: '/admin/atharva/authorities' },
          { id: 'admin-subj-clusters', label: 'Subject Clusters', to: '/admin/atharva/subject-clusters' },
          { id: 'admin-subjects', label: 'Subjects', to: '/admin/atharva/subjects' },
          { id: 'admin-grv-clusters', label: 'Grievance Clusters', to: '/admin/atharva/grievance-clusters' },
          { id: 'admin-categories', label: 'Categories', to: '/admin/atharva/categories' },
          { id: 'admin-audit', label: 'Audit Logs', to: '/admin/atharva/audit-logs' },
        ],
      };
    }

    if (isApplicant) {
      return {
        productTitle: 'NIVARAN-AI',
        authorityTitle: 'Scholar Redressal Portal',
        homeRoute: '/modules/atharva-veda/nivaran/my-grievances',
        badgeVariant: 'saffron',
        badgeLabel: 'Scholar',
        items: [
          { id: 'app-grievances', label: 'My Grievances', to: '/modules/atharva-veda/nivaran/my-grievances' },
          { id: 'app-submit', label: 'Submit Grievance', to: '/modules/atharva-veda/nivaran/submit' },
          { id: 'app-efiles', label: 'My E-Files', to: '/modules/atharva-veda/nivaran/e-files' },
          { id: 'app-smr', label: 'My Student Record', to: '/modules/atharva-veda/nivaran/student-records' },
          { id: 'app-profile', label: 'Scholar Profile', to: '/dashboard' },
        ],
      };
    }

    // Generic Authority fallback
    return {
      productTitle: 'VYASAᴺ PLATFORM',
      authorityTitle: 'Institutional Governance',
      homeRoute: '/dashboard',
      badgeVariant: 'teal',
      badgeLabel: authorityDesignation || 'Authority',
      items: [
        { id: 'auth-workspace', label: 'Dashboard', to: '/dashboard' },
      ],
    };
  };

  // Check if current route is inside the NIVARAN Service
  const isInsideNivaran =
    location.pathname.startsWith('/modules/atharva-veda/nivaran') ||
    location.pathname.startsWith('/atharva-veda/nivaran') ||
    location.pathname.startsWith('/nivaran');

  // =========================================================================
  // SHELL 1: NIVARAN SERVICE SHELL (when authenticated and inside NIVARAN)
  // =========================================================================
  if (isAuthenticated && isInsideNivaran) {
    const workspace = getWorkspaceConfig();

    return (
      <div className="vyasa-authenticated-header-wrapper" style={{ position: 'sticky', top: 0, zIndex: 60 }}>
        <InstitutionalHeader
          onLogoClick={() => navigate('/dashboard')}
          subBrand={
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)' }}>
                <span>VYASAᴺ</span>
                <span>/</span>
                <span>Services</span>
                <span>/</span>
                <span style={{ color: 'var(--vyasa-gold, #d4a017)', fontWeight: 700 }}>NIVARAN-AI</span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  marginTop: '1px',
                }}
              >
                {workspace.authorityTitle}
              </span>
            </div>
          }
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Authenticated User Identity */}
              <div
                data-testid="navbar-profile-section"
                className="vyasa-header-profile-badge"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px 4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#ffffff',
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={displayName}
                >
                  {displayName}
                </span>
                <Badge variant={workspace.badgeVariant} size="sm">
                  {workspace.badgeLabel}
                </Badge>
              </div>

              <ProfileMenu onSignOut={handleSignOut} />

              {/* Mobile Hamburger Toggle */}
              <button
                type="button"
                className="vyasa-auth-mobile-toggle"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls="nivaran-mobile-drawer"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              >
                <AppIcon name={isMobileMenuOpen ? "close" : "menu"} size={18} color="#ffffff" />
              </button>
            </div>
          }
        >
          {/* Desktop NIVARAN Domain Navigation */}
          <nav
            className="vyasa-desktop-auth-nav"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              overflowX: 'auto',
              maxWidth: '100%',
              WebkitOverflowScrolling: 'touch',
              padding: '2px 0',
            }}
            aria-label="NIVARAN Service navigation"
          >
            {/* Subtle Return to VYASA Dashboard button */}
            <NavLink
              to="/dashboard"
              className="nivaran-nav-return-btn"
            >
              &larr; VYASAᴺ Dashboard
            </NavLink>

            {workspace.items.map((item) => {
              const isActive =
                location.pathname === item.to ||
                (item.to !== '/admin' &&
                  item.to !== '/authority' &&
                  location.pathname.startsWith(item.to));

              return (
                <NavLink
                  key={item.id}
                  to={item.to}
                  className={`nivaran-nav-link ${isActive ? 'is-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </InstitutionalHeader>

        {/* Mobile Navigation Drawer for NIVARAN Service */}
        {isMobileMenuOpen && (
          <>
            <div
              className="vyasa-mobile-backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              id="nivaran-mobile-drawer"
              ref={mobileDrawerRef}
              className="vyasa-auth-mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="NIVARAN Service Mobile Menu"
            >
              <div className="vyasa-auth-mobile-drawer__user">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                    {displayName}
                  </span>
                  <Badge variant={workspace.badgeVariant} size="sm">
                    {workspace.badgeLabel}
                  </Badge>
                </div>
                <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.75)' }}>
                  {workspace.authorityTitle}
                </div>
              </div>

              <div className="vyasa-auth-mobile-drawer__section-title">
                NIVARAN-AI WORKSPACE
              </div>

              <div className="vyasa-auth-mobile-drawer__nav-list">
                <NavLink
                  to="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="vyasa-auth-mobile-nav-item vyasa-auth-mobile-nav-item--return"
                >
                  <AppIcon name="grid" size={16} color="var(--vyasa-gold, #d4a017)" />
                  <span>Return to VYASAᴺ Dashboard</span>
                </NavLink>

                {workspace.items.map((item) => {
                  const isActive =
                    location.pathname === item.to ||
                    (item.to !== '/admin' &&
                      item.to !== '/authority' &&
                      location.pathname.startsWith(item.to));

                  return (
                    <NavLink
                      key={item.id}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`vyasa-auth-mobile-nav-item ${isActive ? 'is-active' : ''}`}
                    >
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>

              <div className="vyasa-auth-mobile-drawer__footer">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="vyasa-auth-mobile-nav-item vyasa-auth-mobile-nav-item--signout"
                >
                  <AppIcon name="log-out" size={16} color="#ef4444" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // =========================================================================
  // SHELL 2: AUTHENTICATED VYASA PLATFORM SHELL (when authenticated, outside NIVARAN)
  // =========================================================================
  if (isAuthenticated) {
    const workspace = getWorkspaceConfig();
    const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/';

    return (
      <div className="vyasa-authenticated-header-wrapper" style={{ position: 'sticky', top: 0, zIndex: 60 }}>
        <InstitutionalHeader
          onLogoClick={() => navigate('/dashboard')}
          subBrand={
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  color: 'var(--vyasa-gold, #d4a017)',
                  textTransform: 'uppercase',
                }}
              >
                VYASAᴺ PLATFORM
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                CSJMU Unified Governance
              </span>
            </div>
          }
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Authenticated User Identity */}
              <div
                data-testid="navbar-profile-section"
                className="vyasa-header-profile-badge"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px 4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#ffffff',
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={displayName}
                >
                  {displayName}
                </span>
                <Badge variant={workspace.badgeVariant} size="sm">
                  {workspace.badgeLabel}
                </Badge>
              </div>

              <ProfileMenu onSignOut={handleSignOut} />

              {/* Mobile Hamburger Toggle */}
              <button
                type="button"
                className="vyasa-auth-mobile-toggle"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls="platform-mobile-drawer"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              >
                <AppIcon name={isMobileMenuOpen ? "close" : "menu"} size={18} color="#ffffff" />
              </button>
            </div>
          }
        >
          {/* Authenticated VYASA Global Platform Navigation */}
          <nav
            className="vyasa-desktop-auth-nav"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflow: 'visible',
              position: 'relative',
            }}
            aria-label="Platform navigation"
          >
            {/* Dashboard Link */}
            <NavLink
              to="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: isDashboardActive ? 600 : 500,
                textDecoration: 'none',
                color: isDashboardActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
                backgroundColor: isDashboardActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                border: isDashboardActive ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
                boxShadow: isDashboardActive ? '0 1px 3px rgba(0, 0, 0, 0.15)' : 'none',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                whiteSpace: 'nowrap',
              }}
            >
              Dashboard
            </NavLink>

            {/* Services Dropdown */}
            <ServicesMenu />

            {/* Notifications Tab / Indicator */}
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
                color: 'rgba(255, 255, 255, 0.8)',
                backgroundColor: 'transparent',
                border: '1px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title="Institutional Notifications"
            >
              <NotificationBell size={15} color="currentColor" />
              <span>Notifications</span>
            </button>
          </nav>
        </InstitutionalHeader>

        {/* Mobile Navigation Drawer for VYASA Platform */}
        {isMobileMenuOpen && (
          <>
            <div
              className="vyasa-mobile-backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              id="platform-mobile-drawer"
              ref={mobileDrawerRef}
              className="vyasa-auth-mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="VYASAᴺ Platform Mobile Menu"
            >
              <div className="vyasa-auth-mobile-drawer__user">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                    {displayName}
                  </span>
                  <Badge variant={workspace.badgeVariant} size="sm">
                    {workspace.badgeLabel}
                  </Badge>
                </div>
                <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.75)' }}>
                  CSJMU Unified Governance
                </div>
              </div>

              <div className="vyasa-auth-mobile-drawer__section-title">
                PLATFORM SECTIONS
              </div>

              <div className="vyasa-auth-mobile-drawer__nav-list">
                <NavLink
                  to="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`vyasa-auth-mobile-nav-item ${isDashboardActive ? 'is-active' : ''}`}
                >
                  <AppIcon name="grid" size={16} color="currentColor" />
                  <span>Institutional Dashboard</span>
                </NavLink>

                <NavLink
                  to={workspace.homeRoute}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="vyasa-auth-mobile-nav-item"
                >
                  <AppIcon name="building" size={16} color="var(--vyasa-gold, #d4a017)" />
                  <span>Open NIVARAN-AI Service</span>
                </NavLink>
              </div>

              <div className="vyasa-auth-mobile-drawer__footer">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="vyasa-auth-mobile-nav-item vyasa-auth-mobile-nav-item--signout"
                >
                  <AppIcon name="log-out" size={16} color="#ef4444" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // =========================================================================
  // SHELL 3: PUBLIC ECOSYSTEM SHELL (when unauthenticated)
  // =========================================================================
  return (
    <PublicNavbar
      currentTab={currentTab}
      onSelectTab={onSelectTab}
    />
  );
};
