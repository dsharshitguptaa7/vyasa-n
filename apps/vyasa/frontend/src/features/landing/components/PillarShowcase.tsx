import React, { useEffect, useState } from 'react';
import { pillarService } from '../../../services';
import { PillarMetadata } from '../../../types';
import { Card, Badge, SectionHeading, EmptyState } from '@vyasa/ui';

export const PillarShowcase: React.FC = () => {
  const [pillars, setPillars] = useState<PillarMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    pillarService
      .getPillars()
      .then((data) => {
        if (isMounted) {
          setPillars(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPillars([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section id="pillars" style={{ margin: '48px 0' }}>
      <SectionHeading
        eyebrow="Ecosystem Discovery"
        title="Pillar Registry Contract"
        description="VYASA Core discovers subsystems via typed metadata contracts. Adding or updating a pillar requires zero modification to core logic."
      />

      {loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--vyasa-text-muted)' }}>
            Polling Pillar Registry...
          </div>
        </Card>
      ) : pillars.length === 0 ? (
        <Card variant="scholarly">
          <EmptyState
            title="Registry Initialized (0 Active Registrations)"
            description="In compliance with core isolation principles, no pillar implementations are hardcoded in VYASA. External pillars register via the PillarMetadata contract:"
          />

          <div
            style={{
              backgroundColor: 'var(--vyasa-primary)',
              borderRadius: 'var(--vyasa-radius-sm)',
              border: '1px solid var(--vyasa-border)',
              margin: '24px auto 0',
              maxWidth: '720px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--vyasa-gold-border)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <span>PillarMetadata Contract Interface</span>
              <Badge variant="teal" size="sm">
                TypeScript Schema
              </Badge>
            </div>
            <pre
              style={{
                padding: '16px',
                color: '#7dd3fc',
                fontFamily: 'var(--vyasa-font-mono)',
                fontSize: '13px',
                lineHeight: 1.5,
                margin: 0,
                overflowX: 'auto',
              }}
            >
{`interface PillarMetadata {
  id: string;             // Unique pillar identifier
  name: string;           // Display name (e.g., 'Grievance Redressal')
  slug: string;           // URL routing segment
  description: string;    // Scope and functional summary
  icon: string;           // Visual identifier
  route: string;          // Destination path or micro-frontend mount
  status: 'active' | 'maintenance' | 'beta' | 'disabled';
  enabled: boolean;       // Feature flag toggle
  requiredRoles: string[];// RBAC protection (e.g., ['applicant', 'authority_admin'])
}`}
            </pre>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {pillars.map((pillar) => (
            <Card
              key={pillar.id}
              variant="scholarly"
              title={pillar.name}
              subtitle={pillar.slug}
              headerAction={
                <Badge variant={pillar.status === 'active' ? 'teal' : 'gold'}>
                  {pillar.status}
                </Badge>
              }
            >
              <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', marginBottom: '14px' }}>
                {pillar.description}
              </p>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)' }}>
                Route: <code>{pillar.route}</code>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
