import React from 'react';
import { Card, Badge, AppIcon, IconName } from '@vyasa/ui';
import { VEDA_MODULE_NAV } from '../../core/navigation';

interface VedaMeta {
  sanskrit: string;
  shortName: string;
  focus: string;
  domainCharter: string;
  icon: IconName;
  accessLevel: string;
}

const VEDA_METADATA: Record<string, VedaMeta> = {
  'rig-veda': {
    sanskrit: 'ऋग्वेद',
    shortName: 'Rig Veda',
    focus: 'Research & Knowledge Creation',
    domainCharter: 'Doctoral thesis repository, research output tracking & supervisor allocations',
    icon: 'book-open',
    accessLevel: 'Dean (Academic) & Supervisors',
  },
  'yajur-veda': {
    sanskrit: 'यजुर्वेद',
    shortName: 'Yajur Veda',
    focus: 'Research Administration & Incentives',
    domainCharter: 'Extramural project grants, seed funding, ethical approvals & equipment catalog',
    icon: 'file-text',
    accessLevel: 'Dean (R&D) & Principal Investigators',
  },
  'sama-veda': {
    sanskrit: 'सामवेद',
    shortName: 'Sama Veda',
    focus: 'Research Recognition & Outreach',
    domainCharter: 'Symposia, conference sponsorships, faculty awards & NIRF ranking telemetry',
    icon: 'bar-chart',
    accessLevel: 'Dean (International & Outreach)',
  },
  'atharva-veda': {
    sanskrit: 'अथर्ववेद',
    shortName: 'Atharva Veda',
    focus: 'Grievance Redressal & Institutional Health',
    domainCharter: 'Statutory multi-tier dispute resolution, ombudsperson governance & confidential scholar appeals',
    icon: 'shield',
    accessLevel: 'SuperAdmin, Deans & Grievance Incharges',
  },
};

export const AdminModuleToggleCard: React.FC = () => {
  return (
    <Card
      variant="gold-accent"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '6px',
              backgroundColor: 'var(--vyasa-gold-light, #fcf7eb)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppIcon name="grid" size={18} color="var(--vyasa-gold, #b2811a)" />
          </div>
          <span>Institutional Module Registry &amp; RBAC Governance</span>
        </div>
      }
      subtitle="Four Foundational Veda Domains • Operational Deployment &amp; RBAC Navigation Orchestration"
      headerAction={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Badge variant="teal">RBAC Matrix Active</Badge>
          <Badge variant="gold">University Governance Core</Badge>
        </div>
      }
    >
      <div style={{ padding: '8px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: 'var(--vyasa-text-secondary, #4b5565)' }}>
          The university institutional module registry orchestrates operational states across all 4 foundational Veda pillars. 
          Active modules provide authenticated access through strict role-based guards, while scheduled domains remain locked in phased deployment.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px',
          }}
        >
          {VEDA_MODULE_NAV.map((mod) => {
            const meta = VEDA_METADATA[mod.key] || {
              sanskrit: '',
              shortName: mod.name,
              focus: mod.description,
              domainCharter: mod.description,
              icon: 'layers' as IconName,
              accessLevel: 'Institutional Admins',
            };

            const isAtharva = mod.key === 'atharva-veda' || mod.isEnabled;

            return (
              <div
                key={mod.key}
                style={{
                  padding: '18px 16px',
                  borderRadius: '8px',
                  border: isAtharva
                    ? '1.5px solid var(--vyasa-teal, #0d766e)'
                    : '1px solid var(--vyasa-border, #e3dcd1)',
                  backgroundColor: isAtharva
                    ? '#f0fdfa'
                    : 'var(--vyasa-surface-warm, #fdfbf7)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  boxShadow: isAtharva
                    ? '0 2px 10px rgba(13, 118, 110, 0.1)'
                    : 'var(--vyasa-shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top 3px accent line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    backgroundColor: isAtharva
                      ? 'var(--vyasa-teal, #0d766e)'
                      : 'var(--vyasa-border, #cbd5e1)',
                  }}
                />

                {/* Top Section */}
                <div>
                  {/* Card Header: Icon + Name & Sanskrit + Status Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '6px',
                          backgroundColor: isAtharva ? '#ccfbf1' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <AppIcon
                          name={meta.icon}
                          size={16}
                          color={isAtharva ? '#0d766e' : '#64748b'}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              color: 'var(--vyasa-primary, #0f2b48)',
                              fontSize: '15px',
                              fontWeight: 700,
                              lineHeight: 1.2,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {meta.shortName}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontFamily: 'var(--vyasa-font-devanagari, sans-serif)',
                              color: isAtharva ? 'var(--vyasa-teal, #0d766e)' : 'var(--vyasa-gold, #b2811a)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {meta.sanskrit}
                          </span>
                        </div>
                        {isAtharva && (
                          <div
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              color: 'var(--vyasa-teal, #0d766e)',
                              textTransform: 'uppercase',
                              marginTop: '1px',
                            }}
                          >
                            NIVARAN Portal
                          </div>
                        )}
                      </div>
                    </div>

                    <Badge variant={isAtharva ? 'teal' : 'neutral'} size="sm">
                      {isAtharva ? 'Active' : 'Planned'}
                    </Badge>
                  </div>

                  {/* Focus Domain */}
                  <div
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: isAtharva ? 'var(--vyasa-teal, #0d766e)' : 'var(--vyasa-primary, #0f2b48)',
                      marginBottom: '6px',
                      lineHeight: 1.35,
                    }}
                  >
                    {meta.focus}
                  </div>

                  {/* Domain Charter Description */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'var(--vyasa-text-secondary, #4b5565)',
                      lineHeight: 1.45,
                    }}
                  >
                    {meta.domainCharter}
                  </p>
                </div>

                {/* Card Footer: Route + RBAC Guard */}
                <div
                  style={{
                    paddingTop: '10px',
                    borderTop: '1px solid var(--vyasa-border-subtle, #f1f5f9)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '11px',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <span style={{ color: 'var(--vyasa-text-muted, #64748b)', flexShrink: 0 }}>Route:</span>
                    <code
                      style={{
                        color: 'var(--vyasa-primary, #0f2b48)',
                        fontWeight: 600,
                        backgroundColor: 'rgba(15, 43, 72, 0.05)',
                        padding: '2px 5px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={mod.path}
                    >
                      {mod.path}
                    </code>
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isAtharva ? 'var(--vyasa-teal, #0d766e)' : 'var(--vyasa-text-muted, #64748b)',
                      fontSize: '11px',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    <AppIcon name="shield" size={12} color={isAtharva ? '#0d766e' : '#94a3b8'} />
                    <span>RBAC Guard</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
