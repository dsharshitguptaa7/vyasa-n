import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppIcon, DropdownChevron } from '@vyasa/ui';
import { useAuth } from '../../context/AuthContext';

interface ProfileMenuProps {
  className?: string;
  onSignOut?: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ className = '', onSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { displayName, user, logout } = useAuth();

  // Handle outside click & escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSignOutClick = () => {
    setIsOpen(false);
    if (onSignOut) {
      onSignOut();
    } else {
      logout();
      navigate('/');
    }
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    navigate('/dashboard');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`vyasa-profile-menu ${className}`}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <button
        ref={buttonRef}
        type="button"
        data-testid="navbar-profile-btn"
        aria-label="User Profile & Account Menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#ffffff',
          backgroundColor: isOpen || isHovered ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)',
          border: isOpen || isHovered ? '1px solid var(--vyasa-gold, #d4a017)' : '1px solid rgba(255, 255, 255, 0.35)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px rgba(212, 160, 23, 0.4)' : 'none',
          lineHeight: 1.4,
          height: '30px',
          boxSizing: 'border-box',
        }}
      >
        <AppIcon name="user" size={13} color="#ffffff" style={{ opacity: 0.9 }} />
        <span style={{ color: '#ffffff', fontWeight: 600 }}>Profile</span>
        <DropdownChevron isOpen={isOpen} size={11} color="var(--vyasa-gold, #d4a017)" />
        <span style={{ display: 'none' }} aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          data-testid="navbar-profile-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '240px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.08)',
            border: '1px solid var(--vyasa-border, #e2e8f0)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Authenticated user dossier preview */}
          <div
            style={{
              padding: '10px 14px 8px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid rgba(15, 43, 72, 0.08)',
            }}
          >
            <div
              data-testid="profile-dropdown-user-name"
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--vyasa-primary, #0f2b48)',
                wordBreak: 'break-word',
              }}
            >
              {displayName}
            </div>
            <div
              data-testid="profile-dropdown-user-email"
              style={{
                fontSize: '11.5px',
                color: '#5a6a7e',
                marginTop: '2px',
                wordBreak: 'break-all',
              }}
            >
              {user?.email}
            </div>
          </div>

          <div style={{ padding: '6px' }}>
            <button
              type="button"
              role="menuitem"
              data-testid="profile-menu-item-profile"
              onClick={handleProfileClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: 'none',
                borderLeft: '2px solid transparent',
                backgroundColor: 'transparent',
                color: 'var(--vyasa-primary, #0f2b48)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderLeftColor = 'var(--vyasa-gold, #b2811a)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderLeftColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AppIcon name="user" size={15} color="var(--vyasa-primary, #0f2b48)" />
                <span>Institutional Profile</span>
              </div>
              <AppIcon name="arrow-right" size={12} color="#5a6a7e" />
            </button>

            <div style={{ height: '1px', backgroundColor: 'rgba(15, 43, 72, 0.08)', margin: '4px 0' }} />

            <button
              type="button"
              role="menuitem"
              data-testid="profile-menu-item-signout"
              onClick={handleSignOutClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: 'none',
                borderLeft: '2px solid transparent',
                backgroundColor: 'transparent',
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fef2f2';
                e.currentTarget.style.borderLeftColor = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderLeftColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AppIcon name="log-out" size={15} color="#dc2626" />
                <span>Sign Out</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
