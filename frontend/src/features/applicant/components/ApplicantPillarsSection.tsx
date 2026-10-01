import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button, LoadingState } from '@vyasa/ui';
import { pillarService } from '../../../services/pillarService';
import { PillarMetadata } from '../../../types/pillar';

export const ApplicantPillarsSection: React.FC = () => {
  const navigate = useNavigate();
  const [pillars, setPillars] = useState<PillarMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const loadPillars = async () => {
      try {
        const list = await pillarService.getPillars(['applicant']);
        if (isMounted) {
          setPillars(list);
        }
      } catch {
        if (isMounted) {
          setPillars([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPillars();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenNivaran = () => {
    navigate('/modules/atharva-veda/nivaran');
  };

  if (loading) {
    return <LoadingState message="Loading registered ecosystem governance pillars..." />;
  }

  const otherActivePillars = pillars.filter(
    (p) => p.slug.toLowerCase() !== 'nivaran' && p.enabled && p.status === 'active'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Atharva Veda: NIVARAN Feature Pillar */}
      <Card
        variant="gold-accent"
        title="Atharva Veda: NIVARAN: Grievance Redressal & Research Governance"
        subtitle="Affiliated Doctoral Research & Administrative Redressal Pillar"
        headerAction={<Badge variant="teal">Connected Pillar</Badge>}
      >
        <div style={{ padding: '8px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 16px', fontSize: '14px' }}>
            NIVARAN is the official doctoral grievance and research resolution pillar of CSJMU. As a registered scholar,
            you will be able to file grievances, track supervisor allocations, monitor RAC/RDC status, and submit thesis
            clearance applications.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              padding: '14px 16px',
              backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)',
              borderRadius: '6px',
              border: '1px solid var(--vyasa-border)',
            }}
          >
            <div>
              <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase' }}>
                Single Sign-On Pipeline
              </span>
              <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
                VYASA Core &rarr; NIVARAN Handoff Contract
              </p>
            </div>
            <Button variant="primary" size="md" onClick={handleOpenNivaran}>
              Open NIVARAN &rarr;
            </Button>
          </div>
        </div>
      </Card>

      {/* Only display other pillars if there are active registered ones */}
      {otherActivePillars.length > 0 && (
        <div>
          <h3
            style={{
              fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
              fontSize: '18px',
              color: 'var(--vyasa-navy)',
              margin: '0 0 16px',
              fontWeight: 700,
            }}
          >
            Other Ecosystem Pillars
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {otherActivePillars.map((p) => (
              <Card
                key={p.slug}
                variant="scholarly"
                title={p.name}
                subtitle={`Pillar Slug: ${p.slug}`}
                headerAction={<Badge variant="teal">Active</Badge>}
              >
                <div style={{ padding: '8px 0', color: 'var(--vyasa-text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
                  <p style={{ margin: '0 0 12px' }}>{p.description}</p>
                  <Button variant="outline" size="sm" onClick={() => navigate(p.route)}>
                    Open Subsystem &rarr;
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
