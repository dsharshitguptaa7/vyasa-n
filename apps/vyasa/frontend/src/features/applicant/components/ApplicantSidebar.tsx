import React from 'react';
import { ApplicantTabKey } from '../types';

interface ApplicantSidebarProps {
  currentTab: ApplicantTabKey;
  onSelectTab: (tab: ApplicantTabKey) => void;
  scholarName?: string;
  subjectName?: string;
}

export const ApplicantSidebar: React.FC<ApplicantSidebarProps> = ({
  currentTab,
  onSelectTab,
  scholarName,
  subjectName,
}) => {
  const navItems: { key: ApplicantTabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Ecosystem Overview', icon: '🏛️' },
    { key: 'academic', label: 'Academic Record', icon: '🎓' },
    { key: 'pillars', label: 'Connected Pillars', icon: '🌐' },
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
    { key: 'account', label: 'Account & Security', icon: '🛡️' },
  ];

  return (
    <aside
      style={{
        width: '100%',
        maxWidth: '260px',
        backgroundColor: 'var(--vyasa-bg-card, #ffffff)',
        border: '1px solid var(--vyasa-border)',
        borderRadius: '8px',
        padding: '20px 16px',
        height: 'fit-content',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Mini Scholar Badge */}
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
          {scholarName || 'Doctoral Scholar'}
        </h4>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
          {subjectName || 'CSJMU Scholar'}
        </p>
      </div>

      {/* Nav List */}
      <nav aria-label="Applicant Workspace Navigation">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
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
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};
