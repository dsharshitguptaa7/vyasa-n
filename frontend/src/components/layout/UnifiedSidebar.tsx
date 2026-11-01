import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AppIcon, IconName } from '@vyasa/ui';
import { useAuth } from '../../context/AuthContext';
import { getNivaranDestination } from '../../utils/personaRouting';
import { notificationService } from '../../services/notificationService';

export interface UnifiedSidebarProps {
  activeItem?: string;
  activeTab?: string;
  onSelectProfile?: () => void;
  onOpenProfile?: () => void;
  onSelectHelp?: () => void;
  onOpenHelp?: () => void;
  onSelectSettings?: () => void;
  onAddAuthority?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

interface NavSubItem {
  id: string;
  label: string;
  path: string;
  icon: IconName;
}

export const UnifiedSidebar: React.FC<UnifiedSidebarProps> = ({
  activeItem,
  activeTab,
  onSelectProfile,
  onOpenProfile,
  onSelectHelp,
  onOpenHelp,
  onSelectSettings,
  className = '',
  style,
}) => {
  let auth: any = null;
  try {
    auth = useAuth();
  } catch {
    // Safe fallback in isolated test environments
  }

  let navigate: any = () => {};
  let location: any = { pathname: '' };
  try {
    navigate = useNavigate();
    location = useLocation();
  } catch {
    // Safe fallback in isolated test environments
  }

  const user = auth?.user;
  const displayName =
    auth?.displayName ||
    (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Scholar');
  const logout = auth?.logout;

  const isApplicant = !!auth?.isApplicant;
  const isAuthority = !!auth?.isAuthority;
  const isManager = !!auth?.isManager;
  const isAssistantDean = !!auth?.isAssistantDean;
  const isAssociateDean = !!auth?.isAssociateDean;
  const isDean = !!auth?.isDean;
  const isSuperAdmin = !!auth?.isSuperAdmin;
  const isAdmin = !!auth?.isAdmin;

  const userRoles = useMemo(() => (user?.roles || []).map((r: string) => r.toLowerCase()), [user]);
  const isAdministrator =
    isSuperAdmin || isAdmin || userRoles.includes('super_admin') || userRoles.includes('administrator');
  const isSamaAdmin = isAdministrator || userRoles.includes('sama_content_admin');
  const isSamaEditor = isSamaAdmin || userRoles.includes('sama_content_editor');

  // Derive human-readable institutional role label
  const roleLabel = useMemo(() => {
    if (isSuperAdmin) return 'Super Administrator';
    if (isAdministrator) return 'Administrator';
    if (auth?.authorityDesignation) return auth.authorityDesignation;
    if (isDean) return 'Dean R&D';
    if (isAssociateDean) return 'Associate Dean';
    if (isAssistantDean) return 'Assistant Dean';
    if (isManager) return 'Grievance Manager';
    if (isAuthority) return 'Institutional Officer';
    if (isApplicant) return 'Doctoral Scholar';
    return 'Authenticated User';
  }, [
    isSuperAdmin,
    isAdministrator,
    isDean,
    isAssociateDean,
    isAssistantDean,
    isManager,
    isAuthority,
    isApplicant,
    auth?.authorityDesignation,
  ]);

  // Context detection
  const isInsideNivaran = Boolean(
    location?.pathname &&
      (location.pathname.startsWith('/modules/atharva-veda/nivaran') ||
        location.pathname.startsWith('/atharva-veda/nivaran') ||
        location.pathname.startsWith('/nivaran') ||
        location.pathname.startsWith('/admin/atharva'))
  );

  const isInsideSamiksha = Boolean(
    location?.pathname &&
      (location.pathname.startsWith('/modules/sama-veda') ||
        location.pathname.startsWith('/sama-veda') ||
        location.pathname.startsWith('/felicitation') ||
        location.pathname.startsWith('/admin/sama'))
  );

  const [isNivaranOpen, setIsNivaranOpen] = useState(true);
  const [isSamikshaOpen, setIsSamikshaOpen] = useState(isInsideSamiksha);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Sync accordion expansion on route changes
  useEffect(() => {
    if (isInsideNivaran) setIsNivaranOpen(true);
    if (isInsideSamiksha) setIsSamikshaOpen(true);
    setIsMobileOpen(false);
  }, [location?.pathname, isInsideNivaran, isInsideSamiksha]);

  // Notifications live polling
  useEffect(() => {
    let isMounted = true;
    notificationService
      .getSummary()
      .then((res) => {
        if (isMounted && res && typeof res.unread_count === 'number') {
          setUnreadCount(res.unread_count);
        }
      })
      .catch(() => {
        // Non-fatal
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Keyboard accessibility: Escape closes mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  // Role-appropriate Logout action
  const handleLogout = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsMobileOpen(false);
    const wasApplicant = isApplicant;
    if (logout) {
      try {
        logout();
      } catch {
        // Safe fallback
      }
    }
    navigate(wasApplicant ? '/applicant/login' : '/authority/login');
  };

  const handleProfileClick = (e?: React.MouseEvent) => {
    setIsMobileOpen(false);
    if (onSelectProfile) {
      if (e) e.preventDefault();
      onSelectProfile();
    } else if (onOpenProfile) {
      if (e) e.preventDefault();
      onOpenProfile();
    }
  };

  const handleHelpClick = (e?: React.MouseEvent) => {
    setIsMobileOpen(false);
    if (onSelectHelp) {
      if (e) e.preventDefault();
      onSelectHelp();
    } else if (onOpenHelp) {
      if (e) e.preventDefault();
      onOpenHelp();
    }
  };

  const handleSettingsClick = (e?: React.MouseEvent) => {
    setIsMobileOpen(false);
    if (onSelectSettings) {
      if (e) e.preventDefault();
      onSelectSettings();
    }
  };

  const nivaranDestination = useMemo(() => {
    return getNivaranDestination(auth || { isAuthenticated: true, isApplicant: true });
  }, [auth]);

  const handleNivaranToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsNivaranOpen((prev) => !prev);
    if (!location?.pathname?.startsWith('/modules/atharva-veda/nivaran') && location?.pathname !== nivaranDestination) {
      navigate(nivaranDestination);
    }
  };

  const handleSamikshaToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSamikshaOpen((prev) => !prev);
    if (!location?.pathname?.startsWith('/modules/sama-veda')) {
      navigate('/modules/sama-veda');
    }
  };

  // Helper to determine active state
  const isPathActive = (targetPath: string, itemId?: string) => {
    if (activeItem && itemId && activeItem === itemId) return true;
    if (activeTab && itemId && activeTab === itemId) return true;
    if (location?.pathname === targetPath) return true;
    if (
      (itemId === 'researchers' || itemId === 'authors') &&
      (location?.pathname === '/modules/sama-veda/researchers' || location?.pathname === '/modules/sama-veda/authors')
    ) {
      return true;
    }
    if (
      (itemId === 'certificates' || itemId === 'felicitation') &&
      (location?.pathname === '/modules/sama-veda/certificates' || location?.pathname === '/modules/sama-veda/felicitation')
    ) {
      return true;
    }
    if (
      targetPath !== '/dashboard' &&
      targetPath !== '/admin' &&
      targetPath !== '/profile' &&
      location?.pathname?.startsWith(targetPath)
    ) {
      return true;
    }
    return false;
  };

  // NIVARAN sub-items based on authorized role
  const nivaranItems: NavSubItem[] = useMemo(() => {
    if (isAdministrator) {
      return [
        {
          id: 'authorities',
          label: 'Authorities Management',
          path: '/admin/atharva/authorities',
          icon: 'users',
        },
        {
          id: 'categories',
          label: 'Grievance Categories',
          path: '/admin/atharva/categories',
          icon: 'grid',
        },
        {
          id: 'subject-clusters',
          label: 'Subject Clusters',
          path: '/admin/atharva/subject-clusters',
          icon: 'layers',
        },
        {
          id: 'subjects',
          label: 'Subjects',
          path: '/admin/atharva/subjects',
          icon: 'book-open',
        },
        {
          id: 'grievance-clusters',
          label: 'Grievance Clusters',
          path: '/admin/atharva/grievance-clusters',
          icon: 'shield',
        },
        {
          id: 'audit-logs',
          label: 'Audit Explorer',
          path: '/admin/atharva/audit-logs',
          icon: 'file-text',
        },
        {
          id: 'my-efiles',
          label: 'My E-Files',
          path: '/modules/atharva-veda/nivaran/e-files',
          icon: 'layers',
        },
      ];
    }

    if (isManager) {
      return [
        {
          id: 'manager-queue',
          label: 'Case Triage Queue',
          path: '/modules/atharva-veda/nivaran/manager/queue',
          icon: 'clipboard',
        },
        {
          id: 'closure-queue',
          label: 'Closure Review',
          path: '/modules/atharva-veda/nivaran/manager/closure-queue',
          icon: 'check-circle',
        },
        {
          id: 'my-efiles',
          label: 'My E-Files',
          path: '/modules/atharva-veda/nivaran/e-files',
          icon: 'layers',
        },
        {
          id: 'student-records',
          label: 'Student Records',
          path: '/modules/atharva-veda/nivaran/student-records/search',
          icon: 'search',
        },
        {
          id: 'committees',
          label: 'Committees Workspace',
          path: '/modules/atharva-veda/nivaran/committees',
          icon: 'users',
        },
      ];
    }

    if (isAssistantDean) {
      return [
        {
          id: 'assigned-cases',
          label: 'Assigned Cases',
          path: '/modules/atharva-veda/nivaran/assistant-dean/dashboard',
          icon: 'clipboard',
        },
        {
          id: 'my-efiles',
          label: 'My E-Files',
          path: '/modules/atharva-veda/nivaran/e-files',
          icon: 'layers',
        },
        {
          id: 'student-records',
          label: 'Student Records',
          path: '/modules/atharva-veda/nivaran/student-records/search',
          icon: 'search',
        },
        {
          id: 'committees',
          label: 'Committees Workspace',
          path: '/modules/atharva-veda/nivaran/committees',
          icon: 'users',
        },
      ];
    }

    if (isAssociateDean) {
      return [
        {
          id: 'jurisdiction-cases',
          label: 'Jurisdictional Cases',
          path: '/modules/atharva-veda/nivaran/associate-dean/dashboard',
          icon: 'clipboard',
        },
        {
          id: 'my-efiles',
          label: 'My E-Files',
          path: '/modules/atharva-veda/nivaran/e-files',
          icon: 'layers',
        },
        {
          id: 'student-records',
          label: 'Student Records',
          path: '/modules/atharva-veda/nivaran/student-records/search',
          icon: 'search',
        },
        {
          id: 'committees',
          label: 'Committees Workspace',
          path: '/modules/atharva-veda/nivaran/committees',
          icon: 'users',
        },
      ];
    }

    if (isDean) {
      return [
        {
          id: 'executive-review',
          label: 'Executive Command Center',
          path: '/modules/atharva-veda/nivaran/dean/dashboard',
          icon: 'clipboard',
        },
        {
          id: 'my-efiles',
          label: 'My E-Files',
          path: '/modules/atharva-veda/nivaran/e-files',
          icon: 'layers',
        },
        {
          id: 'student-records',
          label: 'Student Records',
          path: '/modules/atharva-veda/nivaran/student-records/search',
          icon: 'search',
        },
        {
          id: 'committees',
          label: 'Committees Workspace',
          path: '/modules/atharva-veda/nivaran/committees',
          icon: 'users',
        },
      ];
    }

    if (isAuthority) {
      return [
        {
          id: 'authority-cases',
          label: 'Authority Cases',
          path: nivaranDestination,
          icon: 'clipboard',
        },
        {
          id: 'my-efiles',
          label: 'My E-Files',
          path: '/modules/atharva-veda/nivaran/e-files',
          icon: 'layers',
        },
        {
          id: 'student-records',
          label: 'Student Records',
          path: '/modules/atharva-veda/nivaran/student-records/search',
          icon: 'search',
        },
        {
          id: 'committees',
          label: 'Committees Workspace',
          path: '/modules/atharva-veda/nivaran/committees',
          icon: 'users',
        },
      ];
    }

    // Default Scholar / Applicant items
    return [
      {
        id: 'submit-grievance',
        label: 'Submit Grievance',
        path: '/modules/atharva-veda/nivaran/submit',
        icon: 'file-text',
      },
      {
        id: 'my-grievances',
        label: 'My Grievances',
        path: '/modules/atharva-veda/nivaran/my-grievances',
        icon: 'clipboard',
      },
      {
        id: 'my-efiles',
        label: 'My E-Files',
        path: '/modules/atharva-veda/nivaran/e-files',
        icon: 'layers',
      },
      {
        id: 'my-student-record',
        label: 'My Student Record',
        path: '/modules/atharva-veda/nivaran/student-records/me',
        icon: 'graduation-cap',
      },
    ];
  }, [
    isAdministrator,
    isManager,
    isAssistantDean,
    isAssociateDean,
    isDean,
    isAuthority,
    nivaranDestination,
  ]);

  // SAMIKSHA sub-items (strictly adhering to required 6 items)
  const samikshaItems: NavSubItem[] = useMemo(() => {
    const items: NavSubItem[] = [
      {
        id: 'publications',
        label: 'Research Publications',
        path: '/modules/sama-veda/publications',
        icon: 'file-text',
      },
      {
        id: 'bulletins',
        label: 'Research Bulletins',
        path: '/modules/sama-veda/bulletins',
        icon: 'bell',
      },
      {
        id: 'researchers',
        label: 'Researcher Directory',
        path: '/modules/sama-veda/researchers',
        icon: 'users',
      },
      {
        id: 'certificates',
        label: 'Certificate Verification',
        path: '/modules/sama-veda/certificates',
        icon: 'check-circle',
      },
      {
        id: 'cam-projects',
        label: 'CAM-AI Projects',
        path: '/modules/sama-veda/cam-projects',
        icon: 'grid',
      },
      {
        id: 'fellowships',
        label: 'Fellowship Schemes',
        path: '/modules/sama-veda/fellowships',
        icon: 'graduation-cap',
      },
    ];

    if (isSamaEditor) {
      items.push({
        id: 'sama-cms',
        label: 'SAMIKSHA CMS',
        path: '/admin/sama',
        icon: 'edit',
      });
    }

    return items;
  }, [isSamaEditor]);

  // Initials
  const initials = useMemo(() => {
    if (!displayName) return 'VY';
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }, [displayName]);

  // Render a NavLink item
  const renderNavLink = (
    id: string,
    label: string,
    path: string,
    icon: IconName,
    onClick?: (e?: React.MouseEvent) => void,
    testId?: string
  ) => {
    const isActive = isPathActive(path, id);
    return (
      <NavLink
        key={id}
        to={path}
        data-testid={testId}
        onClick={(e) => {
          setIsMobileOpen(false);
          if (onClick) onClick(e);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          padding: '8px 12px',
          borderRadius: '7px',
          backgroundColor: isActive ? 'var(--vyasa-primary-surface, #eff5fa)' : 'transparent',
          color: isActive ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #4b5565)',
          fontWeight: isActive ? 600 : 500,
          fontSize: '13px',
          border: isActive
            ? '1px solid var(--vyasa-primary-border, #cadbef)'
            : '1px solid transparent',
          textDecoration: 'none',
          textAlign: 'left',
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: isActive ? '0 1px 2px rgba(15, 43, 72, 0.06)' : 'none',
          transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <AppIcon
          name={icon}
          size={16}
          color={isActive ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)'}
        />
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      </NavLink>
    );
  };

  const sidebarMarkup = (
    <aside
      className={`vyasa-unified-sidebar ${className}`}
      style={{
        width: '260px',
        height: '100%',
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--vyasa-border, #e3dcd1)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        boxSizing: 'border-box',
        flexShrink: 0,
        overflowY: 'auto',
        ...style,
      }}
    >
      {/* 1. PRIMARY NAVIGATION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '2px 8px 6px',
          }}
        >
          PLATFORM
        </div>
        {renderNavLink(
          'dashboard',
          'Dashboard',
          isAdministrator ? '/admin' : '/dashboard',
          'layout-dashboard'
        )}
        {renderNavLink('profile', 'My Profile', '/profile', 'user', handleProfileClick, 'sidebar-nav-profile')}
      </div>

      {/* 2. SERVICES SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '2px 8px 6px',
          }}
        >
          SERVICES
        </div>

        {/* NIVARAN Accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            type="button"
            data-testid="sidebar-services-toggle"
            aria-expanded={isNivaranOpen}
            onClick={handleNivaranToggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '7px',
              backgroundColor: isInsideNivaran ? 'rgba(15, 43, 72, 0.05)' : 'transparent',
              color: isInsideNivaran ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #4b5565)',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <AppIcon name="shield" size={16} color="var(--vyasa-primary, #0f2b48)" />
              <span>NIVARAN</span>
            </div>
            <AppIcon
              name={isNivaranOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="var(--vyasa-text-muted, #64748b)"
            />
          </button>

          {isNivaranOpen && (
            <div
              style={{
                marginLeft: '16px',
                paddingLeft: '10px',
                borderLeft: '1.5px solid var(--vyasa-border, #e3dcd1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                marginTop: '2px',
              }}
            >
              {nivaranItems.map((item) =>
                renderNavLink(item.id, item.label, item.path, item.icon)
              )}
            </div>
          )}
        </div>

        {/* SAMIKSHA Accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              borderRadius: '7px',
              backgroundColor: isInsideSamiksha ? 'rgba(13, 118, 110, 0.06)' : 'transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <NavLink
              to="/modules/sama-veda"
              onClick={() => setIsMobileOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '11px',
                flex: 1,
                padding: '8px 8px 8px 12px',
                color: isInsideSamiksha ? '#0f766e' : 'var(--vyasa-text-secondary, #4b5565)',
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              <AppIcon name="book-open" size={16} color="#0f766e" />
              <span>SAMIKSHA Research</span>
            </NavLink>
            <button
              type="button"
              aria-label="Toggle SAMIKSHA sections"
              aria-expanded={isSamikshaOpen}
              onClick={handleSamikshaToggle}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '8px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--vyasa-text-muted, #64748b)',
              }}
            >
              <AppIcon
                name={isSamikshaOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="var(--vyasa-text-muted, #64748b)"
              />
            </button>
          </div>

          {isSamikshaOpen && (
            <div
              style={{
                marginLeft: '16px',
                paddingLeft: '10px',
                borderLeft: '1.5px solid var(--vyasa-border, #e3dcd1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                marginTop: '2px',
              }}
            >
              {samikshaItems.map((item) =>
                renderNavLink(item.id, item.label, item.path, item.icon)
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. UTILITIES & NAVIGATION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '2px 8px 6px',
          }}
        >
          UTILITIES
        </div>

        {/* Notifications */}
        <NavLink
          to="/notifications"
          onClick={() => setIsMobileOpen(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '7px',
            backgroundColor: isPathActive('/notifications', 'notifications')
              ? 'var(--vyasa-primary-surface, #eff5fa)'
              : 'transparent',
            color: isPathActive('/notifications', 'notifications')
              ? 'var(--vyasa-primary, #0f2b48)'
              : 'var(--vyasa-text-secondary, #4b5565)',
            fontWeight: isPathActive('/notifications', 'notifications') ? 600 : 500,
            fontSize: '13px',
            border: isPathActive('/notifications', 'notifications')
              ? '1px solid var(--vyasa-primary-border, #cadbef)'
              : '1px solid transparent',
            textDecoration: 'none',
            textAlign: 'left',
            width: '100%',
            boxSizing: 'border-box',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <AppIcon
              name="bell"
              size={16}
              color={
                isPathActive('/notifications', 'notifications')
                  ? 'var(--vyasa-primary, #0f2b48)'
                  : 'var(--vyasa-text-muted, #64748b)'
              }
            />
            <span>Notifications</span>
          </div>
          {unreadCount > 0 && (
            <span
              style={{
                padding: '1px 6px',
                backgroundColor: 'var(--vyasa-danger, #b91c1c)',
                color: '#ffffff',
                fontSize: '10.5px',
                fontWeight: 700,
                borderRadius: '9999px',
              }}
            >
              {unreadCount}
            </span>
          )}
        </NavLink>

        {/* Settings */}
        {renderNavLink('settings', 'Settings', isAdministrator ? '/admin' : '/profile', 'settings', handleSettingsClick)}

        {/* Guidelines & Help */}
        {renderNavLink('help', 'Guidelines & Help', '/phd-admission', 'info', handleHelpClick)}
      </div>

      {/* 4. ACCOUNT SECTION — ALWAYS ANCHORED AT THE BOTTOM */}
      <div
        className="vyasa-sidebar-account-section"
        style={{
          marginTop: 'auto',
          paddingTop: '14px',
          borderTop: '1px solid var(--vyasa-border, #e3dcd1)',
        }}
      >
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '0 4px 8px',
          }}
        >
          ACCOUNT
        </div>

        {/* User Identity Preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div
            data-testid="sidebar-account-initials"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'var(--vyasa-primary-surface, #eff5fa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--vyasa-primary, #0f2b48)',
              fontWeight: 700,
              fontSize: '12px',
              border: '1px solid #d3e2ef',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              data-testid="sidebar-account-name"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--vyasa-primary, #0f2b48)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={displayName}
            >
              {displayName}
            </div>
            <div
              data-testid="sidebar-account-role"
              style={{
                fontSize: '11px',
                color: 'var(--vyasa-text-muted, #64748b)',
                marginTop: '1px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {roleLabel}
            </div>
          </div>
        </div>

        {/* Action Controls: Profile & Logout */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <NavLink
            to="/profile"
            data-testid="sidebar-profile-action"
            onClick={handleProfileClick}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 8px',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--vyasa-border, #e2e8f0)',
              color: 'var(--vyasa-text-secondary, #475569)',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <AppIcon name="user" size={13} color="currentColor" />
            <span>Profile</span>
          </NavLink>

          <button
            type="button"
            data-testid="sidebar-logout-btn"
            onClick={handleLogout}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 8px',
              borderRadius: '6px',
              backgroundColor: '#fff5f5',
              border: '1px solid #fed7d7',
              color: '#c53030',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <AppIcon name="log-out" size={13} color="currentColor" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile Drawer Toggle (visible only on small viewports via CSS) */}
      <button
        type="button"
        className="vyasa-sidebar-mobile-toggle"
        aria-label="Toggle navigation menu"
        aria-expanded={isMobileOpen}
        onClick={() => setIsMobileOpen((prev) => !prev)}
        style={{
          position: 'fixed',
          bottom: '18px',
          left: '18px',
          zIndex: 70,
          padding: '10px',
          borderRadius: '50%',
          backgroundColor: 'var(--vyasa-primary, #0f2b48)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(15, 43, 72, 0.3)',
          cursor: 'pointer',
        }}
      >
        <AppIcon name={isMobileOpen ? 'close' : 'menu'} size={20} color="#ffffff" />
      </button>

      {/* Desktop Sidebar (Default) */}
      <div className="vyasa-sidebar-desktop-container" style={{ height: '100%' }}>
        {sidebarMarkup}
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div
          className="vyasa-sidebar-mobile-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'flex',
          }}
        >
          <div
            className="vyasa-mobile-backdrop"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
            style={{
              position: 'relative',
              width: '280px',
              maxWidth: '85vw',
              height: '100%',
              backgroundColor: '#ffffff',
              boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
              zIndex: 90,
            }}
          >
            {sidebarMarkup}
          </div>
        </div>
      )}
    </>
  );
};
