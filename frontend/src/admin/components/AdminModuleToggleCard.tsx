import React from 'react';
import { Card, Badge } from '@vyasa/ui';
import { VEDA_MODULE_NAV } from '../../core/navigation';

export const AdminModuleToggleCard: React.FC = () => {
  return (
    <Card
      variant="gold-accent"
      title="Institutional Module Registry & RBAC Governance"
      subtitle="Veda Domain Status & Navigation Orchestration"
      headerAction={<Badge variant="teal">Admin Console</Badge>}
    >
      <div style={{ padding: '8px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 16px', fontSize: '14px' }}>
          The module registry governs operational states across the 4 foundational Veda pillars.
          Disabling a module immediately hides its navigation routes and denies API access through backend RBAC guards.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {VEDA_MODULE_NAV.map((mod) => (
            <div
              key={mod.key}
              style={{
                padding: '16px',
                borderRadius: '6px',
                border: '1px solid var(--vyasa-border)',
                backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ color: 'var(--vyasa-navy)', fontSize: '14px' }}>{mod.name}</strong>
                  <Badge variant={mod.isEnabled ? 'teal' : 'neutral'}>
                    {mod.isEnabled ? 'Active' : 'Planned'}
                  </Badge>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--vyasa-text-muted)' }}>
                  {mod.description}
                </p>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)' }}>
                Route: <code>{mod.path}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
