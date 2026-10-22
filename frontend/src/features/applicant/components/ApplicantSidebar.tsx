import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AppIcon, IconName } from '@vyasa/ui';
import { useAuth } from '../../../context/AuthContext';
import { ApplicantTabKey } from '../types';

export interface ApplicantSidebarProps {
  currentTab?: ApplicantTabKey;
  onSelectTab?: (tab: ApplicantTabKey) => void;
  scholarName?: string;
  subjectName?: string;
  activeTab?: string;
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: IconName;
  action?: 'profile' | 'help' | 'link';
}

export const ApplicantSidebar: React.FC<ApplicantSidebarProps> = ({
  currentTab,
  onSelectTab,
  scholarName,
  subjectName,
  activeTab = 'my-grievances',
  onOpenProfile,
  onOpenHelp,
  className = '',
}) => {
  let user: any = null;
  let displayName: string = '';
  try {
    const auth = useAuth();
    user = auth?.user;
    displayName = auth?.displayName || '';
  } catch {
    // Safe fallback when rendered in isolated test environments without AuthProvider
  }

  let navigate: any = () => {};
  let location: any = { pathname: '' };
  try {
    navigate = useNavigate();
    location = useLocation();
  } catch {
    // Safe fallback when rendered outside Router in isolated test environments
  }
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Tab-based navigation support for legacy ApplicantDashboardPage
  if (onSelectTab) {
    const legacyNavItems: { key: ApplicantTabKey; label: string; iconName: IconName; legacyEmoji: string }[] = [
      { key: 'overview', label: 'Ecosystem Overview', iconName: 'building', legacyEmoji: '🏛️' },
      { key: 'academic', label: 'Academic Record', iconName: 'graduation-cap', legacyEmoji: '🎓' },
      { key: 'pillars', label: 'Connected Pillars', iconName: 'globe', legacyEmoji: '🌐' },
      { key: 'notifications', label: 'Notifications', iconName: 'bell', legacyEmoji: '🔔' },
      { key: 'account', label: 'Account & Security', iconName: 'shield', legacyEmoji: '🛡️' },
    ];

    return (
      <aside
        className={`vyasa-applicant-sidebar ${className}`}
        style={{
          width: '100%',
          backgroundColor: 'var(--vyasa-bg-card, #ffffff)',
          border: '1px solid var(--vyasa-border)',
          borderRadius: '8px',
          padding: '20px 16px',
          height: 'fit-content',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div
          style={{
            paddingBottom: '16px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--vyasa-border)',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Scholar Workspace
          </span>
          <h4 style={{ margin: '4px 0 2px', fontSize: '15px', color: 'var(--vyasa-navy)', fontWeight: 700 }}>
            {scholarName || displayName || user?.first_name || 'Doctoral Scholar'}
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
            {subjectName || user?.department || 'CSJMU Scholar'}
          </p>
        </div>

        <nav aria-label="Applicant Workspace Navigation">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {legacyNavItems.map((item) => {
              const isActive = currentTab === item.key;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onSelectTab(item.key)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: isActive ? 600 : 500,
                      backgroundColor: isActive ? 'var(--vyasa-navy, #1b2a4a)' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--vyasa-text-primary, #2d3748)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <AppIcon
                      name={item.iconName}
                      size={16}
                      color={isActive ? '#ffffff' : 'var(--vyasa-primary, #0f2b48)'}
                    />
                    <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap' }}>
                      {item.legacyEmoji}
                    </span>
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    );
  }

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/modules/atharva-veda/nivaran/my-grievances',
      icon: 'layout-dashboard',
    },
    {
      id: 'my-grievances',
      label: 'My Grievances',
      path: '/modules/atharva-veda/nivaran/my-grievances',
      icon: 'file-text',
    },
    {
      id: 'submit-grievance',
      label: 'Submit Grievance',
      path: '/modules/atharva-veda/nivaran/submit',
      icon: 'check-circle',
    },
    {
      id: 'my-efiles',
      label: 'My E-Files',
      path: '/modules/atharva-veda/nivaran/e-files',
      icon: 'clipboard',
    },
    {
      id: 'my-student-record',
      label: 'My Student Record',
      path: '/modules/atharva-veda/nivaran/student-records/me',
      icon: 'graduation-cap',
    },
    {
      id: 'scholar-profile',
      label: 'Scholar Profile',
      path: '#profile',
      icon: 'user',
      action: 'profile',
    },
    {
      id: 'guidelines-help',
      label: 'Guidelines & Help',
      path: '#help',
      icon: 'info',
      action: 'help',
    },
  ];

  const handleItemClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.action === 'profile') {
      e.preventDefault();
      if (onOpenProfile) onOpenProfile();
      else navigate('/profile');
    } else if (item.action === 'help') {
      e.preventDefault();
      if (onOpenHelp) onOpenHelp();
    } else if (item.id === 'my-grievances') {
      if (location.pathname === '/modules/atharva-veda/nivaran/my-grievances') {
        const el = document.getElementById('my-grievances-section');
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  const isItemActive = (item: NavItem) => {
    if (activeTab) return activeTab === item.id;
    if (item.action) return false;
    if (item.id === 'dashboard') {
      return location.pathname === '/modules/atharva-veda/nivaran/my-grievances' && !location.hash.includes('my-grievances-section');
    }
    if (item.id === 'my-grievances') {
      return activeTab === 'my-grievances' || location.hash.includes('my-grievances-section');
    }
    return location.pathname.startsWith(item.path);
  };

  const sidebarBody = (
    <aside
      className={`vyasa-applicant-sidebar ${className}`}
      style={{
        width: '260px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        padding: '20px 16px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Sidebar Header: NIVARAN Scale Logo & Portal Identity */}
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#0f2b48',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(15, 43, 72, 0.2)',
              flexShrink: 0,
            }}
          >
            <AppIcon name="scale" size={20} color="#f59e0b" />
          </div>
          <div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--vyasa-primary, #0f2b48)',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                fontFamily: 'var(--vyasa-font-sans)',
              }}
            >
              NIVARAN-AI
            </div>
            <div
              style={{
                fontSize: '11.5px',
                color: '#64748b',
                marginTop: '2px',
                fontWeight: 500,
              }}
            >
              Scholar Redressal Portal
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation List */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const active = isItemActive(item);

          return (
            <div key={item.id}>
              {item.action ? (
                <button
                  type="button"
                  onClick={(e) => handleItemClick(item, e)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: active ? '#eff6ff' : 'transparent',
                    color: active ? '#1d4ed8' : '#334155',
                    fontWeight: active ? 600 : 500,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.color = '#0f2b48';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#334155';
                    }
                  }}
                >
                  <AppIcon
                    name={item.icon}
                    size={17}
                    color={active ? '#2563eb' : '#64748b'}
                  />
                  <span>{item.label}</span>
                </button>
              ) : (
                <NavLink
                  to={item.path}
                  onClick={(e) => handleItemClick(item, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    backgroundColor: active ? '#eff6ff' : 'transparent',
                    color: active ? '#1d4ed8' : '#334155',
                    fontWeight: active ? 600 : 500,
                    fontSize: '13.5px',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.color = '#0f2b48';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#334155';
                    }
                  }}
                >
                  <AppIcon
                    name={item.icon}
                    size={17}
                    color={active ? '#2563eb' : '#64748b'}
                  />
                  <span>{item.label}</span>
                </NavLink>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Card: Need Help? */}
      <div
        style={{
          marginTop: '24px',
          backgroundColor: '#fefaf3',
          border: '1px solid #f3e5b8',
          borderRadius: '10px',
          padding: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppIcon name="info" size={14} color="#b45309" />
          </div>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#0f2b48',
              fontFamily: 'var(--vyasa-font-sans)',
            }}
          >
            Need Help?
          </span>
        </div>
        <p
          style={{
            margin: '0 0 10px 0',
            fontSize: '11.5px',
            color: '#64748b',
            lineHeight: 1.4,
          }}
        >
          Guidelines, FAQs and support resources
        </p>
        <button
          type="button"
          onClick={onOpenHelp}
          style={{
            width: '100%',
            padding: '7px 12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#0f2b48',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <span>Open Help Center</span>
          <span style={{ fontSize: '11px' }}>→</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile Drawer Trigger Bar */}
      <div
        className="vyasa-applicant-mobile-bar"
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
          <span>Scholar Navigation</span>
        </button>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
          Scholar Redressal
        </span>
      </div>

      {/* Desktop Sidebar Container */}
      <div className="vyasa-applicant-desktop-sidebar" style={{ display: 'flex' }}>
        {sidebarBody}
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="vyasa-applicant-mobile-drawer"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
              boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarBody}
          </div>
        </div>
      )}
    </>
  );
};
