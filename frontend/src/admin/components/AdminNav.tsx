import React from 'react';
import { NavLink } from 'react-router-dom';

interface AdminNavProps {
  currentTab?: string;
}

export const AdminNav: React.FC<AdminNavProps> = () => {
  const navItems = [
    { label: 'Platform Overview', path: '/admin' },
    { label: 'Authorities', path: '/admin/atharva/authorities' },
    { label: 'Subject Clusters', path: '/admin/atharva/subject-clusters' },
    { label: 'Subjects', path: '/admin/atharva/subjects' },
    { label: 'Grievance Clusters', path: '/admin/atharva/grievance-clusters' },
    { label: 'Categories & Routing', path: '/admin/atharva/categories' },
    { label: 'Audit Logs', path: '/admin/atharva/audit-logs' },
  ];

  return (
    <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--vyasa-border, #e2e8f0)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vyasa-gold, #b45309)', fontWeight: 600 }}>
            Atharva Veda / NIVARAN Governance
          </span>
          <h1 style={{ margin: '4px 0 0', fontSize: '24px', color: 'var(--vyasa-navy, #0f172a)' }}>
            Institutional Administration Console
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#f1f5f9', borderRadius: '4px', color: '#475569' }}>
            Single Application Monolith
          </span>
          <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#ecfdf5', borderRadius: '4px', color: '#047857', fontWeight: 600 }}>
            Config-as-Data
          </span>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            style={({ isActive }) => ({
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              borderRadius: '6px 6px 0 0',
              borderBottom: isActive ? '2px solid var(--vyasa-saffron, #f97316)' : '2px solid transparent',
              color: isActive ? 'var(--vyasa-navy, #0f172a)' : 'var(--vyasa-text-secondary, #64748b)',
              backgroundColor: isActive ? '#f8fafc' : 'transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
