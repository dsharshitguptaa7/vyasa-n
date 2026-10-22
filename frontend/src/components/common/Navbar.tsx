import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Badge, AppIcon } from '@vyasa/ui';
import { InstitutionalHeader } from '@vyasa/ui/branding';
import { useAuth } from '../../context/AuthContext';
import { ServicesMenu } from './ServicesMenu';
import { ProfileMenu } from './ProfileMenu';
import { PublicNavbar } from './PublicNavbar';
import { NotificationBellMenu } from '../../features/notifications';

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

interface ActivePillarContext {
  id: 'nivaran' | 'vyasa-ai' | 'admin' | 'rig-veda' | 'yajur-veda' | 'sama-veda' | 'core';
  displayName: string;
  pillarBadge: string;
  badgeVariant: 'gold' | 'teal' | 'primary' | 'saffron';
  subtitle: string;
  authorityContext?: string;
  returnRoute?: string;
  returnLabel?: string;
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

  // Determine persona-specific workspace configuration
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
          { id: 'dean-committees', label: 'Committees', to: '/modules/atharva-veda/nivaran/committees' },
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
          { id: 'assoc-committees', label: 'Committees', to: '/modules/atharva-veda/nivaran/committees' },
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
          { id: 'asst-committees', label: 'Committees', to: '/modules/atharva-veda/nivaran/committees' },
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
          { id: 'mgr-committees', label: 'Committees', to: '/modules/atharva-veda/nivaran/committees' },
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
          { id: 'app-profile', label: 'Scholar Profile', to: '/profile' },
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

  // Determine active pillar context based on location pathname
  const getPillarContext = (workspace: WorkspaceConfig): ActivePillarContext => {
    // 1. NIVARAN-AI Pillar
    if (
      location.pathname.startsWith('/modules/atharva-veda/nivaran') ||
      location.pathname.startsWith('/atharva-veda/nivaran') ||
      location.pathname.startsWith('/nivaran')
    ) {
      return {
        id: 'nivaran',
        displayName: 'NIVARAN-AI',
        pillarBadge: 'NIVARAN-AI',
        badgeVariant: workspace.badgeVariant,
        subtitle: 'Grievance Redressal & Institutional Governance',
        authorityContext: workspace.authorityTitle,
        returnRoute: '/dashboard',
        returnLabel: '← VYASAᴺ Dashboard',
        items: workspace.items,
      };
    }

    // 2. VYASA AI Assistant Pillar
    if (
      location.pathname.startsWith('/phd-admission') ||
      location.pathname.startsWith('/phd') ||
      location.pathname.startsWith('/vyasa-assistant') ||
      location.pathname.startsWith('/assistant')
    ) {
      return {
        id: 'vyasa-ai',
        displayName: 'VYASA AI Assistant',
        pillarBadge: 'VYASA AI',
        badgeVariant: 'gold',
        subtitle: 'Research, Regulations & Doctoral Studies Assistant',
        authorityContext: 'Academic Intelligence',
        returnRoute: '/dashboard',
        returnLabel: '← VYASAᴺ Dashboard',
        items: [
          { id: 'ai-chat', label: 'AI Assistant Chat', to: '/phd-admission' },
          { id: 'ai-regulations', label: 'Doctoral Regulations', to: '/phd-admission#regulations' },
          { id: 'ai-admissions', label: 'Ph.D. Admissions (2026-27)', to: '/phd-admission#admissions' },
        ],
      };
    }

    // 3. Institutional Administration Console
    if (location.pathname.startsWith('/admin')) {
      return {
        id: 'admin',
        displayName: 'Admin Console',
        pillarBadge: 'ADMIN',
        badgeVariant: 'primary',
        subtitle: 'Central Governance & Taxonomy Administration',
        authorityContext: 'System Administration',
        returnRoute: '/dashboard',
        returnLabel: '← VYASAᴺ Dashboard',
        items: [
          { id: 'admin-dashboard', label: 'Overview', to: '/admin' },
          { id: 'admin-authorities', label: 'Authorities', to: '/admin/atharva/authorities' },
          { id: 'admin-subj-clusters', label: 'Subject Clusters', to: '/admin/atharva/subject-clusters' },
          { id: 'admin-subjects', label: 'Subjects', to: '/admin/atharva/subjects' },
          { id: 'admin-grv-clusters', label: 'Grievance Clusters', to: '/admin/atharva/grievance-clusters' },
          { id: 'admin-categories', label: 'Categories & Routing', to: '/admin/atharva/categories' },
          { id: 'admin-audit', label: 'Audit Logs', to: '/admin/atharva/audit-logs' },
        ],
      };
    }

    // 4. Future Veda Governance Pillars
    if (location.pathname.startsWith('/modules/rig-veda')) {
      return {
        id: 'rig-veda',
        displayName: 'Rig Veda (PRAMAAN)',
        pillarBadge: 'RIG VEDA',
        badgeVariant: 'primary',
        subtitle: 'Research Publications & Ethics (Scheduled)',
        authorityContext: 'Research Publications & Ethics (Scheduled)',
        returnRoute: '/dashboard',
        returnLabel: '← VYASAᴺ Dashboard',
        items: [{ id: 'rig-overview', label: 'PRAMAAN Overview', to: '/modules/rig-veda' }],
      };
    }

    if (location.pathname.startsWith('/modules/yajur-veda')) {
      return {
        id: 'yajur-veda',
        displayName: 'Yajur Veda (ANUDAN)',
        pillarBadge: 'YAJUR VEDA',
        badgeVariant: 'primary',
        subtitle: 'Grants & Fellowship Governance (Scheduled)',
        authorityContext: 'Grants & Fellowship Governance (Scheduled)',
        returnRoute: '/dashboard',
        returnLabel: '← VYASAᴺ Dashboard',
        items: [{ id: 'yajur-overview', label: 'ANUDAN Overview', to: '/modules/yajur-veda' }],
      };
    }

    if (location.pathname.startsWith('/modules/sama-veda')) {
      return {
        id: 'sama-veda',
        displayName: 'Sama Veda (SAMIKSHA)',
        pillarBadge: 'SAMA VEDA',
        badgeVariant: 'primary',
        subtitle: 'Curriculum & Academic Audit (Scheduled)',
        authorityContext: 'Curriculum & Academic Audit (Scheduled)',
        returnRoute: '/dashboard',
        returnLabel: '← VYASAᴺ Dashboard',
        items: [{ id: 'sama-overview', label: 'SAMIKSHA Overview', to: '/modules/sama-veda' }],
      };
    }

    // 5. Core Platform Pages (/dashboard, /notifications, etc.)
    return {
      id: 'core',
      displayName: 'VYASAᴺ Core Platform',
      pillarBadge: 'CORE',
      badgeVariant: 'gold',
      subtitle: 'CSJMU Unified Governance & Research Ecosystem',
      authorityContext: workspace.authorityTitle,
      items: [
        { id: 'core-dashboard', label: 'Institutional Dashboard', to: '/dashboard' },
        { id: 'core-notifications', label: 'Notification Centre', to: '/notifications' },
        { id: 'core-assistant', label: 'VYASA AI Assistant', to: '/phd-admission' },
      ],
    };
  };

  // =========================================================================
  // UNIFIED AUTHENTICATED HEADER SYSTEM (Across all pillars)
  // =========================================================================
  if (isAuthenticated) {
    const workspace = getWorkspaceConfig();
    const pillarContext = getPillarContext(workspace);
    const isInsideNivaran = pillarContext.id === 'nivaran';
    const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/';

    return (
      <div className="vyasa-authenticated-header-wrapper" style={{ position: 'sticky', top: 0, zIndex: 60 }}>
        <InstitutionalHeader
          onLogoClick={() => navigate('/dashboard')}
          subBrand={
            <div className="vyasa-header-subbrand" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  color: 'var(--vyasa-gold, #d4a017)',
                  textTransform: 'uppercase',
                }}
              >
                VYASAᴺ ECOSYSTEM
              </span>
              <span
                style={{
                  fontSize: '10.5px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                CSJMU Research &amp; Governance
              </span>
            </div>
          }
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Authenticated User Identity Pill */}
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

              {/* Notification Centre Bell */}
              <NotificationBellMenu />

              {/* User Account & Actions Menu */}
              <ProfileMenu onSignOut={handleSignOut} />

              {/* Mobile Navigation Drawer Toggle */}
              <button
                type="button"
                className="vyasa-auth-mobile-toggle"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls={isInsideNivaran ? "nivaran-mobile-drawer" : "vyasa-unified-mobile-drawer"}
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              >
                <AppIcon name={isMobileMenuOpen ? "close" : "menu"} size={18} color="#ffffff" />
              </button>
            </div>
          }
          contextualNav={
            <div
              className={`vyasa-context-nav-bar ${
                location.pathname.startsWith('/admin')
                  ? 'vyasa-admin-context-nav-hidden'
                  : isApplicant &&
                    (location.pathname.startsWith('/modules/atharva-veda/nivaran') ||
                      location.pathname.startsWith('/atharva-veda/nivaran') ||
                      location.pathname.startsWith('/nivaran'))
                  ? 'vyasa-applicant-context-nav-hidden'
                  : location.pathname === '/dashboard' ||
                    location.pathname === '/' ||
                    location.pathname.includes('/assistant-dean/dashboard') ||
                    location.pathname.includes('/assistant-dean/cases') ||
                    location.pathname.includes('/associate-dean/dashboard') ||
                    location.pathname.includes('/associate-dean/cases')
                  ? 'vyasa-portal-context-nav-hidden'
                  : ''
              }`}
              style={{
                backgroundColor: '#ffffff',
                borderBottom: '1px solid var(--vyasa-border, #e2e8f0)',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div
                className="vyasa-page-container vyasa-context-nav__inner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: '44px',
                  gap: '16px',
                }}
              >
                {/* Left: Active Pillar Context Identifier */}
                <div
                  className="vyasa-context-pillar-tag"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexShrink: 0,
                  }}
                >
                  <Badge variant={pillarContext.badgeVariant} size="sm">
                    {pillarContext.pillarBadge}
                  </Badge>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--vyasa-navy, #0f172a)' }}>
                      {pillarContext.displayName}
                    </span>
                    {pillarContext.authorityContext && (
                      <span
                        className="vyasa-context-authority-title"
                        style={{ color: '#64748b', fontWeight: 500 }}
                      >
                        &bull; {pillarContext.authorityContext}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Contextual Navigation Links */}
                <nav
                  className="vyasa-contextual-tabs"
                  aria-label={isInsideNivaran ? "NIVARAN Service navigation" : "Contextual navigation"}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    overflowX: 'auto',
                    maxWidth: '100%',
                    WebkitOverflowScrolling: 'touch',
                    padding: '2px 0',
                  }}
                >
                  {/* Return to VYASA Dashboard button (if inside a pillar) */}
                  {pillarContext.returnRoute && (
                    <NavLink
                      to={pillarContext.returnRoute}
                      className="nivaran-nav-return-btn"
                    >
                      {pillarContext.returnLabel || '← VYASAᴺ Dashboard'}
                    </NavLink>
                  )}

                  {pillarContext.items.map((item) => {
                    const isActive =
                      location.pathname === item.to ||
                      (item.to !== '/admin' &&
                        item.to !== '/authority' &&
                        item.to !== '/dashboard' &&
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
              </div>
            </div>
          }
        >
          {/* Tier 2 Primary Platform Navigation */}
          <nav
            className="vyasa-desktop-auth-nav"
            aria-label="Platform navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflow: 'visible',
              position: 'relative',
            }}
          >
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

            {/* Ecosystem Services Dropdown */}
            <ServicesMenu />
          </nav>
        </InstitutionalHeader>

        {/* Unified Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <>
            <div
              className="vyasa-mobile-backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              id={isInsideNivaran ? "nivaran-mobile-drawer" : "vyasa-unified-mobile-drawer"}
              ref={mobileDrawerRef}
              className="vyasa-auth-mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={isInsideNivaran ? "NIVARAN Service Mobile Menu" : "VYASAᴺ Mobile Navigation Menu"}
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
                  {pillarContext.authorityContext || 'Institutional Governance'}
                </div>
              </div>

              {/* Active Pillar Workspace Section */}
              <div className="vyasa-auth-mobile-drawer__section-title">
                {pillarContext.displayName.toUpperCase()} WORKSPACE
              </div>

              <div className="vyasa-auth-mobile-drawer__nav-list">
                {pillarContext.returnRoute && (
                  <NavLink
                    to={pillarContext.returnRoute}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="vyasa-auth-mobile-nav-item vyasa-auth-mobile-nav-item--return"
                  >
                    <AppIcon name="grid" size={16} color="var(--vyasa-gold, #d4a017)" />
                    <span>Return to VYASAᴺ Dashboard</span>
                  </NavLink>
                )}

                {pillarContext.items.map((item) => {
                  const isActive =
                    location.pathname === item.to ||
                    (item.to !== '/admin' &&
                      item.to !== '/authority' &&
                      item.to !== '/dashboard' &&
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

                <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)', margin: '8px 0' }} />

                <div className="vyasa-auth-mobile-drawer__section-title">
                  PLATFORM SECTIONS
                </div>

                <NavLink
                  to="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`vyasa-auth-mobile-nav-item ${isDashboardActive ? 'is-active' : ''}`}
                >
                  <AppIcon name="grid" size={16} color="currentColor" />
                  <span>Institutional Dashboard</span>
                </NavLink>

                <NavLink
                  to="/notifications"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`vyasa-auth-mobile-nav-item ${location.pathname === '/notifications' ? 'is-active' : ''}`}
                >
                  <AppIcon name="bell" size={16} color="currentColor" />
                  <span>Notifications</span>
                </NavLink>

                <NavLink
                  to="/phd-admission"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`vyasa-auth-mobile-nav-item ${location.pathname.startsWith('/phd-admission') ? 'is-active' : ''}`}
                >
                  <AppIcon name="graduation-cap" size={16} color="currentColor" />
                  <span>VYASA AI Assistant</span>
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
  // PUBLIC ECOSYSTEM SHELL (when unauthenticated)
  // =========================================================================
  return (
    <PublicNavbar
      currentTab={currentTab}
      onSelectTab={onSelectTab}
    />
  );
};
