import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppIcon } from '@vyasa/ui';
import { useAuth } from '../../../context/AuthContext';
import { getNivaranDestination } from '../../../utils/personaRouting';
import { getActiveServices } from '../../../services/serviceRegistry';
import { notificationService } from '../../../services/notificationService';

export interface VyasaPortalSidebarProps {
  activeItem?: 'dashboard' | 'profile' | 'services' | 'notifications' | 'settings' | 'help';
  onSelectProfile?: () => void;
  onSelectHelp?: () => void;
  onSelectSettings?: () => void;
  className?: string;
}

export const VyasaPortalSidebar: React.FC<VyasaPortalSidebarProps> = ({
  activeItem = 'dashboard',
  onSelectProfile,
  onSelectHelp,
  onSelectSettings,
  className = '',
}) => {
  const auth = useAuth();
  const { user, displayName } = auth;
  const navigate = useNavigate();
  const activeServices = getActiveServices();

  const [isServicesOpen, setIsServicesOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

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
        // Non-fatal; retain neutral state (0) upon failure without fabricating count
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const nivaranDestination = getNivaranDestination(auth);

  const handleLogout = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsMobileOpen(false);
    if (auth.logout) {
      try {
        auth.logout();
      } catch {
        // ignore
      }
    }
    navigate('/applicant/login');
  };

  const handleServiceClick = (service: (typeof activeServices)[number], e: React.MouseEvent) => {
    e.preventDefault();
    if (service.id === 'nivaran') {
      navigate(nivaranDestination);
    } else {
      navigate(service.route);
    }
  };

  const sidebarContent = (
    <aside
      className={`vyasa-portal-sidebar ${className}`}
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
      <nav
        aria-label="VYASA Portal Navigation"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}
      >
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '9px 12px',
            borderRadius: '8px',
            backgroundColor: activeItem === 'dashboard' ? 'var(--vyasa-primary-surface, #eff5fa)' : 'transparent',
            color: activeItem === 'dashboard' ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #4b5565)',
            fontWeight: activeItem === 'dashboard' ? 600 : 500,
            fontSize: '13.5px',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.15s ease',
          }}
        >
          <AppIcon
            name="layout-dashboard"
            size={17}
            color={activeItem === 'dashboard' ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)'}
          />
          <span>Dashboard</span>
        </button>

        {/* My Profile */}
        <button
          type="button"
          data-testid="sidebar-nav-profile"
          onClick={() => {
            if (onSelectProfile) onSelectProfile();
            else navigate('/profile');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '9px 12px',
            borderRadius: '8px',
            backgroundColor: activeItem === 'profile' ? 'var(--vyasa-primary-surface, #eff5fa)' : 'transparent',
            color: activeItem === 'profile' ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #4b5565)',
            fontWeight: activeItem === 'profile' ? 600 : 500,
            fontSize: '13.5px',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.15s ease',
          }}
        >
          <AppIcon
            name="user"
            size={17}
            color={activeItem === 'profile' ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)'}
          />
          <span>My Profile</span>
        </button>

        {/* Services Dropdown */}
        <div style={{ marginTop: '2px' }}>
          <button
            type="button"
            data-testid="sidebar-services-toggle"
            onClick={() => setIsServicesOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: 'var(--vyasa-text-secondary, #4b5565)',
              fontWeight: 500,
              fontSize: '13.5px',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AppIcon name="grid" size={17} color="var(--vyasa-text-muted, #64748b)" />
              <span>Services</span>
            </div>
            <AppIcon
              name={isServicesOpen ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="var(--vyasa-text-muted, #64748b)"
            />
          </button>

          {/* Sub-services */}
          {isServicesOpen && (
            <div
              style={{
                marginLeft: '18px',
                paddingLeft: '12px',
                borderLeft: '1.5px solid var(--vyasa-border, #e3dcd1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                marginTop: '3px',
              }}
            >
              {activeServices.map((service) => {
                const isServiceActive = location.pathname.startsWith(service.route);
                const iconName: any = service.id === 'nivaran' ? 'shield' : service.id === 'sama-veda' ? 'book-open' : 'grid';
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={(e) => handleServiceClick(service, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: isServiceActive ? 'var(--vyasa-primary-surface, #eff5fa)' : 'var(--vyasa-surface-warm, #fdfbf7)',
                      color: isServiceActive ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #4b5565)',
                      fontWeight: isServiceActive ? 700 : 500,
                      fontSize: '12.5px',
                      border: isServiceActive ? '1px solid var(--vyasa-primary-border, #cadbef)' : '1px solid var(--vyasa-border, #e3dcd1)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      boxShadow: isServiceActive ? '0 1px 2px rgba(15, 43, 72, 0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <AppIcon
                      name={iconName}
                      size={14}
                      color={isServiceActive ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)'}
                    />
                    <span style={{ flex: 1 }}>{service.id === 'sama-veda' ? 'SAMIKSHA' : service.name}</span>
                    <span style={{ fontSize: '11px', color: isServiceActive ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)' }}>&rsaquo;</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications */}
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 12px',
            borderRadius: '8px',
            backgroundColor: activeItem === 'notifications' ? 'var(--vyasa-primary-surface, #eff5fa)' : 'transparent',
            color: activeItem === 'notifications' ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #4b5565)',
            fontWeight: activeItem === 'notifications' ? 600 : 500,
            fontSize: '13.5px',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AppIcon
              name="bell"
              size={17}
              color={activeItem === 'notifications' ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)'}
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
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => {
            if (onSelectSettings) onSelectSettings();
            else {
              const el = document.getElementById('security-posture-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '9px 12px',
            borderRadius: '8px',
            backgroundColor: activeItem === 'settings' ? 'var(--vyasa-primary-surface, #eff5fa)' : 'transparent',
            color: activeItem === 'settings' ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #4b5565)',
            fontWeight: activeItem === 'settings' ? 600 : 500,
            fontSize: '13.5px',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.15s ease',
          }}
        >
          <AppIcon
            name="settings"
            size={17}
            color={activeItem === 'settings' ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-muted, #64748b)'}
          />
          <span>Settings</span>
        </button>

        {/* Guidelines & Help */}
        <button
          type="button"
          onClick={() => {
            if (onSelectHelp) onSelectHelp();
            else navigate('/phd-admission');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '9px 12px',
            borderRadius: '8px',
            backgroundColor: activeItem === 'help' ? 'var(--vyasa-primary-surface, #eff5fa)' : 'transparent',
            color: activeItem === 'help' ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #4b5565)',
            fontWeight: activeItem === 'help' ? 600 : 500,
            fontSize: '13.5px',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.15s ease',
          }}
        >
          <AppIcon
            name="info"
            size={17}
            color={activeItem === 'help' ? '#2563eb' : '#64748b'}
          />
          <span>Guidelines &amp; Help</span>
        </button>
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
          onClick={onSelectHelp || (() => navigate('/modules/atharva-veda/nivaran/my-grievances'))}
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
          <span style={{ fontSize: '11px' }}>&rarr;</span>
        </button>
      </div>

      {/* Bottom Account & Logout Section */}
      <div
        className="vyasa-sidebar-account-section"
        style={{
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid var(--vyasa-border, #e3dcd1)',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '0 4px 8px',
          }}
        >
          ACCOUNT
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--vyasa-primary-surface, #eff5fa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--vyasa-primary, #0f2b48)',
              fontWeight: 700,
              fontSize: '13px',
              border: '1px solid #d3e2ef',
              flexShrink: 0,
            }}
          >
            <AppIcon name="user" size={17} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--vyasa-primary, #0f2b48)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={displayName || 'Account'}
            >
              {displayName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Scholar')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)', marginTop: '1px' }}>
              {user?.department || (auth.isAuthority ? (auth.authorityDesignation || 'Authority') : 'CSJMU Scholar')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setIsMobileOpen(false);
              if (onSelectProfile) onSelectProfile();
              else navigate('/profile');
            }}
            style={{
              flex: 1,
              padding: '6px 10px',
              backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)',
              border: '1px solid var(--vyasa-border, #e3dcd1)',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--vyasa-primary, #0f2b48)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <AppIcon name="user" size={13} />
            <span>Profile</span>
          </button>
          <button
            type="button"
            data-testid="sidebar-logout-btn"
            aria-label="Logout"
            onClick={handleLogout}
            style={{
              flex: 1,
              padding: '6px 10px',
              backgroundColor: '#ffffff',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#dc2626',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fef2f2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <AppIcon name="log-out" size={13} color="#dc2626" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile Drawer Trigger Bar */}
      <div
        className="vyasa-portal-mobile-bar"
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
          <span>Portal Navigation</span>
        </button>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
          {displayName || user?.first_name || 'Scholar'}
        </span>
      </div>

      {/* Desktop Sidebar Container */}
      <div className="vyasa-portal-desktop-sidebar" style={{ display: 'flex' }}>
        {sidebarContent}
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="vyasa-portal-mobile-drawer"
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
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
