import React, { useState, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AppIcon, IconName, CsjmuLogo } from '@vyasa/ui';
import { useAuth } from '../../context/AuthContext';

export interface AdminSidebarProps {
  activeTab?: string;
  onAddAuthority?: () => void;
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: IconName;
  badge?: string;
  disabled?: boolean;
  subitems?: {
    id: string;
    label: string;
    path: string;
    action?: 'add-authority' | 'link';
  }[];
}

interface NavSection {
  id: string;
  title: string;
  badge?: string;
  items: NavItem[];
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onAddAuthority,
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [authoritiesOpen, setAuthoritiesOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { user, isSuperAdmin, logout } = useAuth();
  const userRoles = useMemo(() => (user?.roles || []).map((r) => r.toLowerCase()), [user]);
  const isAdministrator = isSuperAdmin || userRoles.includes('super_admin') || userRoles.includes('administrator');
  const isSamaAdmin = isAdministrator || userRoles.includes('sama_content_admin');
  const isSamaEditor = isSamaAdmin || userRoles.includes('sama_content_editor');

  const navSections: NavSection[] = useMemo(() => {
    const sections: NavSection[] = [];

    // 1. Core Governance
    if (isAdministrator || isSamaEditor) {
      sections.push({
        id: 'core-governance',
        title: 'Core Governance',
        items: [
          {
            id: 'overview',
            label: 'Overview',
            path: '/admin',
            icon: 'layout-dashboard',
          },
          ...(isAdministrator
            ? [
                {
                  id: 'audit-logs',
                  label: 'Audit Explorer',
                  path: '/admin/atharva/audit-logs',
                  icon: 'file-text' as IconName,
                },
                {
                  id: 'settings',
                  label: 'System Settings',
                  path: '/admin',
                  icon: 'settings' as IconName,
                },
              ]
            : []),
        ],
      });
    }

    // 2. ANVESHAN (Sama Veda CMS)
    if (isSamaEditor) {
      const samaItems: NavItem[] = [
        {
          id: 'sama-overview',
          label: 'Overview',
          path: '/admin/sama',
          icon: 'book-open',
        },
        {
          id: 'sama-publications',
          label: 'Publications',
          path: '/admin/sama/publications',
          icon: 'file-text',
        },
        {
          id: 'sama-authors',
          label: 'Authors & Scopus',
          path: '/admin/sama/authors',
          icon: 'users',
        },
        {
          id: 'sama-bulletins',
          label: 'Bulletins',
          path: '/admin/sama/bulletins',
          icon: 'layers',
        },
        {
          id: 'sama-certificates',
          label: 'Certificates',
          path: '/admin/sama/certificates',
          icon: 'check-circle',
        },
        {
          id: 'sama-cam-projects',
          label: 'CAM-AI Schemes',
          path: '/admin/sama/cam-projects',
          icon: 'grid',
        },
        {
          id: 'sama-spotlights',
          label: 'Spotlights',
          path: '/admin/sama/spotlights',
          icon: 'settings',
        },
      ];

      if (isSamaAdmin) {
        samaItems.push({
          id: 'sama-import',
          label: 'Data Import',
          path: '/admin/sama/import',
          icon: 'layers',
        });
      }

      sections.push({
        id: 'sama-veda',
        title: 'SAMIKSHA (Sama Veda)',
        badge: 'Research CMS',
        items: samaItems,
      });
    }

    // 3. NIVARAN (Atharva Veda Operations)
    if (isAdministrator) {
      sections.push({
        id: 'atharva-veda',
        title: 'NIVARAN (Atharva Veda)',
        badge: 'Grievance CMS',
        items: [
          {
            id: 'authorities',
            label: 'Authorities',
            path: '/admin/atharva/authorities',
            icon: 'users',
            subitems: [
              { id: 'all-authorities', label: 'All Authorities', path: '/admin/atharva/authorities' },
              { id: 'add-authority', label: 'Add Authority', path: '/admin/atharva/authorities', action: 'add-authority' },
              { id: 'bulk-upload', label: 'Import / Bulk Upload', path: '/admin/atharva/authorities' },
              { id: 'role-assignments', label: 'Role Assignments', path: '/admin/atharva/authorities' },
              { id: 'assignment-history', label: 'Assignment History', path: '/admin/atharva/audit-logs' },
            ],
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
            id: 'categories',
            label: 'Categories & Routing',
            path: '/admin/atharva/categories',
            icon: 'settings',
          },
        ],
      });
    }

    return sections;
  }, [isAdministrator, isSamaAdmin, isSamaEditor]);

  const handleSubitemClick = (sub: { id: string; path: string; action?: string }, e: React.MouseEvent) => {
    if (sub.action === 'add-authority' && onAddAuthority) {
      e.preventDefault();
      onAddAuthority();
    }
  };

  const isCurrentActive = (item: NavItem) => {
    if (activeTab && activeTab === item.id) return true;
    if (item.path === '/admin' || item.path === '/admin/sama') {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  };

  const displayName =
    user?.fullName ||
    (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) ||
    user?.email ||
    'Administrator';
  const roleLabel = isSuperAdmin ? 'Super Administrator' : 'System Administrator';
  const initials = useMemo(() => {
    if (!displayName) return 'AD';
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  const handleLogout = () => {
    logout();
    navigate('/authority/login');
  };

  const sidebarContent = (
    <aside
      className={`vyasa-admin-sidebar ${className}`}
      style={{
        width: '260px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--vyasa-border, #e3dcd1)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        padding: '20px 16px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Sidebar Header: CSJMU Seal & Admin Console Identity */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              padding: '4px',
              backgroundColor: '#ffffff',
              border: '1.5px solid var(--vyasa-gold-border, #ecdfba)',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(178, 129, 26, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CsjmuLogo size={36} />
          </div>
          <div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--vyasa-primary, #0f2b48)',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                fontFamily: 'var(--vyasa-font-sans)',
              }}
            >
              Admin Console
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#64748b',
                marginTop: '2px',
                fontWeight: 500,
              }}
            >
              System Administration
            </div>
          </div>
        </div>

        {/* Back to VYASA-N Dashboard Button */}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '7px 12px',
            backgroundColor: '#fdf8ee',
            border: '1px solid #ebd8a8',
            borderRadius: '20px',
            color: '#8b5e09',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#faedd0';
            e.currentTarget.style.borderColor = '#dfc382';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fdf8ee';
            e.currentTarget.style.borderColor = '#ebd8a8';
          }}
        >
          <span>←</span>
          <span>VYASAᴺ Dashboard</span>
        </button>
      </div>

      {/* Main Navigation List - Grouped by Modular Veda Domain */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {navSections.map((section) => (
          <div key={section.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 10px 4px 10px',
                fontSize: '10.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#64748b',
              }}
            >
              <span>{section.title}</span>
              {section.badge && (
                <span
                  style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    fontWeight: 600,
                    textTransform: 'none',
                    letterSpacing: 'normal',
                  }}
                >
                  {section.badge}
                </span>
              )}
            </div>

            {section.items.map((item) => {
              const active = isCurrentActive(item);
              const hasSubitems = item.subitems && item.subitems.length > 0;

              if (item.disabled) {
                return (
                  <div
                    key={item.id}
                    title="Scheduled for Phase C (Sama Veda CMS Implementation)"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#94a3b8',
                      fontSize: '13px',
                      cursor: 'not-allowed',
                      userSelect: 'none',
                      backgroundColor: 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <AppIcon name={item.icon} size={18} color="#94a3b8" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          fontWeight: 600,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '8px',
                      backgroundColor: active ? 'var(--vyasa-primary-surface, #eff5fa)' : 'transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <NavLink
                      to={item.path}
                      end={item.path === '/admin'}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        color: active ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #4b5565)',
                        fontWeight: active ? 600 : 500,
                        fontSize: '13px',
                        textDecoration: 'none',
                        borderRadius: '8px',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.parentElement!.style.backgroundColor = 'var(--vyasa-surface-warm, #fdfbf7)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.parentElement!.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <AppIcon
                        name={item.icon}
                        size={18}
                        color={active ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)'}
                      />
                      <span>{item.label}</span>
                    </NavLink>

                    {hasSubitems && (
                      <button
                        type="button"
                        aria-label={`Toggle ${item.label} submenu`}
                        onClick={() => setAuthoritiesOpen((prev) => !prev)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          color: active ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: '11px', transform: authoritiesOpen ? 'rotate(0deg)' : 'rotate(180deg)', display: 'inline-block' }}>
                          {authoritiesOpen ? '⌃' : '⌵'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Subitems collapsible drawer */}
                  {hasSubitems && authoritiesOpen && active && (
                    <div
                      style={{
                        margin: '3px 0 6px 16px',
                        paddingLeft: '14px',
                        borderLeft: '1.5px solid var(--vyasa-border, #e3dcd1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      {item.subitems!.map((sub) => {
                        const isAllSelected = sub.id === 'all-authorities';
                        return (
                          <NavLink
                            key={sub.id}
                            to={sub.path}
                            onClick={(e) => handleSubitemClick(sub, e)}
                            style={{
                              display: 'block',
                              padding: '6px 10px',
                              fontSize: '12.5px',
                              color: isAllSelected ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)',
                              fontWeight: isAllSelected ? 600 : 400,
                              backgroundColor: isAllSelected ? 'var(--vyasa-primary-surface, #eff5fa)' : 'transparent',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              transition: 'all 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isAllSelected) {
                                e.currentTarget.style.backgroundColor = '#f1f5f9';
                                e.currentTarget.style.color = '#1e293b';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isAllSelected) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#64748b';
                              }
                            }}
                          >
                            {isAllSelected ? `• ${sub.label}` : sub.label}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sidebar Footer Cards */}
      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Session & Config Status Pill Card */}
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '8px',
            padding: '9px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#065f46',
                fontFamily: 'var(--vyasa-font-mono, monospace)',
              }}
            >
              Session: 2026–27
            </span>
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#047857',
              fontWeight: 500,
              paddingLeft: '13px',
            }}
          >
            Config-as-Data Active
          </div>
        </div>

        {/* Institution Statutory Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '9px 12px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#94a3b8',
              fontWeight: 600,
              marginBottom: '2px',
            }}
          >
            Institution
          </div>
          <div
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#0f2b48',
              lineHeight: 1.2,
            }}
          >
            CSJMU, Kanpur
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#64748b',
              marginTop: '2px',
            }}
          >
            Statutory Governance
          </div>
        </div>

        {/* Section D: Administrator Account & Session Control */}
        <div
          style={{
            marginTop: '4px',
            paddingTop: '12px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              data-testid="admin-sidebar-initials"
              style={{
                width: '32px',
                height: '32px',
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
                data-testid="admin-sidebar-name"
                style={{
                  fontSize: '12.5px',
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
                data-testid="admin-sidebar-role"
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

          <div style={{ display: 'flex', gap: '6px' }}>
            <NavLink
              to="/profile"
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
              }}
            >
              <AppIcon name="user" size={13} color="currentColor" />
              <span>Profile</span>
            </NavLink>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#e11d48',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <AppIcon name="log-out" size={13} color="#e11d48" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile Drawer Trigger Pill */}
      <div
        className="vyasa-admin-mobile-bar"
        style={{
          display: 'none',
          padding: '10px 16px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '13px',
            color: '#0f2b48',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <AppIcon name={isMobileOpen ? 'close' : 'menu'} size={16} />
          <span>Admin Navigation</span>
        </button>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
          Session: 2026–27
        </span>
      </div>

      {/* Render Desktop Sidebar */}
      <div className="vyasa-admin-desktop-sidebar-container" style={{ display: 'flex' }}>
        {sidebarContent}
      </div>

      {/* Mobile Overlay Drawer */}
      {isMobileOpen && (
        <div
          className="vyasa-admin-mobile-drawer"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            zIndex: 9999,
            display: 'flex',
          }}
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            style={{
              width: '280px',
              height: '100%',
              backgroundColor: '#ffffff',
              boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
