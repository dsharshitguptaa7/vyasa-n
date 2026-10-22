import React from 'react';
import { NavLink } from 'react-router-dom';
import { AppIcon, IconName, CsjmuLogo } from '@vyasa/ui';

interface AdminNavProps {
  currentTab?: string;
}

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
}

export const AdminNav: React.FC<AdminNavProps> = () => {
  const navItems: NavItem[] = [
    { label: 'Platform Overview', path: '/admin', icon: 'layout-dashboard' },
    { label: 'Authorities', path: '/admin/atharva/authorities', icon: 'users' },
    { label: 'Subject Clusters', path: '/admin/atharva/subject-clusters', icon: 'layers' },
    { label: 'Subjects', path: '/admin/atharva/subjects', icon: 'book-open' },
    { label: 'Grievance Clusters', path: '/admin/atharva/grievance-clusters', icon: 'shield' },
    { label: 'Categories & Routing', path: '/admin/atharva/categories', icon: 'settings' },
    { label: 'Audit Logs', path: '/admin/atharva/audit-logs', icon: 'file-text' },
  ];

  return (
    <header
      style={{
        marginBottom: '28px',
        borderBottom: '1px solid var(--vyasa-border, #e3dcd1)',
        backgroundColor: '#ffffff',
        borderRadius: '8px 8px 0 0',
        padding: '20px 24px 0 24px',
        boxShadow: '0 1px 3px rgba(15, 43, 72, 0.05)',
      }}
    >
      {/* University Official Masthead Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '6px',
              backgroundColor: '#ffffff',
              border: '1.5px solid var(--vyasa-gold-border, #ecdfba)',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(178, 129, 26, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CsjmuLogo size={46} />
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '2px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--vyasa-gold, #b2811a)',
                  fontWeight: 700,
                  fontFamily: 'var(--vyasa-font-sans)',
                }}
              >
                Chhatrapati Shahu Ji Maharaj University, Kanpur
              </span>
              <span style={{ color: 'var(--vyasa-border, #cbd5e1)' }}>•</span>
              <span
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--vyasa-teal, #0d766e)',
                  fontWeight: 600,
                }}
              >
                Atharva Veda Governance
              </span>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--vyasa-primary, #0f2b48)',
                fontFamily: 'var(--vyasa-font-scholarly, serif)',
                letterSpacing: '0.01em',
                lineHeight: 1.25,
              }}
            >
              Institutional Administration Console
            </h1>

            <p
              style={{
                margin: '3px 0 0',
                fontSize: '12.5px',
                color: 'var(--vyasa-text-secondary, #4b5565)',
              }}
            >
              Statutory Authority Directory, Subject Taxonomy &amp; Multi-Tier Grievance Routing Matrix
            </p>
          </div>
        </div>

        {/* Right-aligned Governance Status Pills */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              padding: '5px 12px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '20px',
              color: '#15803d',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                display: 'inline-block',
                boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.2)',
              }}
            />
            Session: 2026–27
          </div>

          <div
            style={{
              fontSize: '11.5px',
              padding: '5px 12px',
              backgroundColor: 'var(--vyasa-primary-surface, #eff5fa)',
              border: '1px solid var(--vyasa-primary-border, #cadbef)',
              borderRadius: '20px',
              color: 'var(--vyasa-primary, #0f2b48)',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            Tiered SuperAdmin Console
          </div>

          <div
            style={{
              fontSize: '11.5px',
              padding: '5px 12px',
              backgroundColor: 'var(--vyasa-gold-light, #fcf7eb)',
              border: '1px solid var(--vyasa-gold-border, #ecdfba)',
              borderRadius: '20px',
              color: 'var(--vyasa-gold, #b2811a)',
              fontWeight: 600,
            }}
          >
            Config-as-Data Active
          </div>
        </div>
      </div>

      {/* University Administrative Navigation Tabs */}
      <nav
        aria-label="Institutional Admin Navigation"
        style={{
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
          paddingBottom: '0',
          scrollbarWidth: 'thin',
        }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            style={({ isActive }) => ({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              borderRadius: '6px 6px 0 0',
              borderBottom: isActive
                ? '3px solid var(--vyasa-saffron, #c85602)'
                : '3px solid transparent',
              color: isActive
                ? 'var(--vyasa-primary, #0f2b48)'
                : 'var(--vyasa-text-secondary, #4b5565)',
              backgroundColor: isActive
                ? 'var(--vyasa-primary-surface, #eff5fa)'
                : 'transparent',
              transition: 'all 0.18s ease-in-out',
              whiteSpace: 'nowrap',
            })}
          >
            {({ isActive }) => (
              <>
                <AppIcon
                  name={item.icon}
                  size={15}
                  color={
                    isActive
                      ? 'var(--vyasa-saffron, #c85602)'
                      : 'var(--vyasa-text-muted, #6b7280)'
                  }
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};
