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
  const [unreadCount, setUnreadCount] = useState<number>(3);

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
        // Retain fallback value
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const nivaranDestination = getNivaranDestination(auth);

  const handleNivaranClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(nivaranDestination);
  };

  const sidebarContent = (
    <aside
      className={`vyasa-portal-sidebar ${className}`}
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
            backgroundColor: activeItem === 'dashboard' ? '#f0f7ff' : 'transparent',
            color: activeItem === 'dashboard' ? '#1d4ed8' : '#334155',
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
            color={activeItem === 'dashboard' ? '#2563eb' : '#64748b'}
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
            backgroundColor: activeItem === 'profile' ? '#f0f7ff' : 'transparent',
            color: activeItem === 'profile' ? '#1d4ed8' : '#334155',
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
            color={activeItem === 'profile' ? '#2563eb' : '#64748b'}
          />
          <span>My Profile</span>
        </button>

        {/* Services Dropdown */}
        <div style={{ marginTop: '2px' }}>
          <button
            type="button"
            onClick={() => setIsServicesOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: '#334155',
              fontWeight: 500,
              fontSize: '13.5px',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AppIcon name="grid" size={17} color="#64748b" />
              <span>Services</span>
            </div>
            <AppIcon
              name={isServicesOpen ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="#94a3b8"
            />
          </button>

          {/* Sub-services */}
          {isServicesOpen && (
            <div
              style={{
                marginLeft: '18px',
                paddingLeft: '12px',
                borderLeft: '1.5px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                marginTop: '3px',
              }}
            >
              {activeServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={handleNivaranClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#fefce8',
                    color: '#a16207',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    border: '1px solid #fef08a',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                    boxShadow: '0 1px 2px rgba(202, 138, 4, 0.08)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <AppIcon name="scale" size={14} color="#ca8a04" />
                  <span style={{ flex: 1 }}>{service.name}</span>
                  <span style={{ fontSize: '11px', color: '#b45309' }}>&rsaquo;</span>
                </button>
              ))}
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
            backgroundColor: activeItem === 'notifications' ? '#f0f7ff' : 'transparent',
            color: activeItem === 'notifications' ? '#1d4ed8' : '#334155',
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
              color={activeItem === 'notifications' ? '#2563eb' : '#64748b'}
            />
            <span>Notifications</span>
          </div>
          {unreadCount > 0 && (
            <span
              style={{
                padding: '1px 6px',
                backgroundColor: '#ef4444',
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
            backgroundColor: activeItem === 'settings' ? '#f0f7ff' : 'transparent',
            color: activeItem === 'settings' ? '#1d4ed8' : '#334155',
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
            color={activeItem === 'settings' ? '#2563eb' : '#64748b'}
          />
          <span>Settings</span>
        </button>

        {/* Guidelines & Help */}
        <button
          type="button"
          onClick={() => {
            if (onSelectHelp) onSelectHelp();
            else navigate('/modules/atharva-veda/nivaran/my-grievances');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '9px 12px',
            borderRadius: '8px',
            backgroundColor: activeItem === 'help' ? '#f0f7ff' : 'transparent',
            color: activeItem === 'help' ? '#1d4ed8' : '#334155',
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
