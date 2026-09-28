import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, LoadingState } from '@vyasa/ui';
import { authService } from '../../../services/authService';
import { pillarService } from '../../../services/pillarService';
import { PillarMetadata } from '../../../types/pillar';

export const ApplicantPillarsSection: React.FC = () => {
  const [pillars, setPillars] = useState<PillarMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [handoffStatus, setHandoffStatus] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: Only respond to NIVARAN frontend
      if (event.origin !== 'http://localhost:5174') return;

      if (event.data?.type === 'REQUEST_VYASA_SESSION') {
        const token = authService.getToken();
        if (token && event.source) {
          (event.source as Window).postMessage(
            { type: 'VYASA_SESSION_TOKEN', token, role: 'applicant' },
            event.origin
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

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
    const targetUrl = 'http://localhost:5174?role=applicant';
    const nivaranWin = window.open(targetUrl, '_blank');
    const token = authService.getToken();
    if (nivaranWin && token) {
      setHandoffStatus('Cross-pillar session dispatched to NIVARAN.');
      const sendToken = () => {
        try {
          nivaranWin.postMessage(
            { type: 'VYASA_SESSION_TOKEN', token, role: 'applicant' },
            'http://localhost:5174'
          );
        } catch {
          // ignore cross-origin restrictions if child not yet ready
        }
      };
      setTimeout(sendToken, 500);
      setTimeout(sendToken, 1200);
      setTimeout(sendToken, 2000);
    }
  };

  if (loading) {
    return <LoadingState message="Loading registered ecosystem governance pillars..." />;
  }

  const otherPillars = pillars.filter((p) => p.slug.toLowerCase() !== 'nivaran');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {handoffStatus && (
        <div
          role="status"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '6px',
            padding: '16px 20px',
            color: '#065f46',
            fontSize: '14px',
            lineHeight: 1.6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div>
            <strong>Cross-Pillar Handoff Active:</strong> {handoffStatus}
          </div>
          <button
            onClick={() => setHandoffStatus(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#065f46',
              fontWeight: 700,
              fontSize: '16px',
            }}
            aria-label="Dismiss notice"
          >
            &times;
          </button>
        </div>
      )}

      {/* NIVARAN Feature Pillar */}
      <Card
        variant="gold-accent"
        title="NIVARAN: Grievance Redressal & Research Governance"
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

      {/* Other Registered Pillars */}
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
          Other Ecosystem Pillars (Registry)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {otherPillars.map((p) => (
            <Card
              key={p.slug}
              variant="scholarly"
              title={p.name}
              subtitle={`Pillar Slug: ${p.slug}`}
              headerAction={<Badge variant="saffron">Scheduled</Badge>}
            >
              <div style={{ padding: '8px 0', color: 'var(--vyasa-text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 12px' }}>
                  {p.description || 'Institutional ecosystem governance service under active development.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)' }}>Status: In Development</span>
                  <Button variant="outline" size="sm" disabled>
                    Unavailable
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
