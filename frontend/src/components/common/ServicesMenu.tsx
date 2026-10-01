import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, AppIcon, DropdownChevron, IconName } from '@vyasa/ui';
import { useAuth } from '../../context/AuthContext';
import { getActiveServices, VyasaService } from '../../services/serviceRegistry';
import { getNivaranDestination } from '../../utils/personaRouting';

interface ServicesMenuProps {
  className?: string;
}

export const ServicesMenu: React.FC<ServicesMenuProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const auth = useAuth();
  const activeServices = getActiveServices();

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

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

  // Desktop hover handlers with safe debounce delay (150ms) to prevent flicker
  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  // Keyboard accessibility
  const handleButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  // Click / Touch toggle
  const handleButtonClick = () => {
    setIsOpen((prev) => !prev);
  };

  const handleServiceClick = (service: VyasaService) => {
    setIsOpen(false);
    if (service.id === 'nivaran') {
      const destination = getNivaranDestination(auth);
      navigate(destination);
    } else {
      navigate(service.route);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`vyasa-services-menu ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        onKeyDown={handleButtonKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="VYASA Services Menu"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          color: isOpen ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
          backgroundColor: isOpen ? 'rgba(212, 160, 23, 0.22)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <span>Services</span>
        <DropdownChevron isOpen={isOpen} size={12} color="currentColor" />
        <span style={{ display: 'none' }} aria-hidden="true">▼</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Available VYASA Services"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '320px',
            minWidth: '280px',
            maxWidth: 'calc(100vw - 32px)',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.08)',
            border: '1px solid var(--vyasa-border, #e2e8f0)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px 14px 8px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid rgba(15, 43, 72, 0.08)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--vyasa-primary, #0f2b48)', textTransform: 'uppercase' }}>
              Institutional Services
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#5a6a7e', marginTop: '2px' }}>
              CSJMU Autonomous Portals
            </div>
          </div>

          {/* Active Services List */}
          <div style={{ padding: '6px' }}>
            {activeServices.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--vyasa-text-muted, #64748b)' }}>
                No active services available.
              </div>
            ) : (
              activeServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleServiceClick(service)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    borderLeft: '2px solid transparent',
                    backgroundColor: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
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
                  <span style={{ flexShrink: 0, marginTop: '2px', color: 'var(--vyasa-primary, #0f2b48)' }}>
                    <AppIcon name={(service.icon as IconName) || 'shield'} size={20} color="var(--vyasa-primary, #0f2b48)" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)' }}>
                        {service.name}
                      </span>
                      <Badge variant={service.badgeVariant} size="sm">
                        {service.badge}
                      </Badge>
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: 500, color: '#5a6a7e', marginBottom: '2px' }}>
                      {service.subtitle}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{service.category}</span>
                      <AppIcon name="arrow-right" size={12} color="var(--vyasa-primary, #0f2b48)" />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
