import React from 'react';
import { Card, Badge, Button, PageContainer, SectionHeading } from '@vyasa/ui';
import { CsjmuLogo } from '@vyasa/ui/branding';
import { AuthoritySessionResponse } from '../types/authority';
import { NivaranAuthService } from '../services/nivaranAuthService';

interface ManagerWorkspaceProps {
  session: AuthoritySessionResponse;
}

export const ManagerWorkspace: React.FC<ManagerWorkspaceProps> = ({ session }) => {
  const { vyasa_identity, nivaran_authority } = session;

  const handleReturnToVyasa = () => {
    window.location.href = 'http://localhost:5173/authority';
  };

  const handleSignOut = () => {
    NivaranAuthService.clearToken();
    window.location.href = 'http://localhost:5173/login';
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--vyasa-ivory, #FAF8F5)' }}>
      {/* Top University Brand Bar */}
      <header
        style={{
          backgroundColor: 'var(--vyasa-navy, #1B2A4A)',
          color: '#ffffff',
          padding: '12px 24px',
          borderBottom: '3px solid var(--vyasa-gold, #D4A017)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <CsjmuLogo size={42} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>
                NIVARAN &bull; निवारण
              </div>
              <div style={{ fontSize: '11px', color: 'var(--vyasa-gold-border, #E6C566)' }}>
                CSJMU Institutional Grievance Redressal Pillar
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button variant="outline" size="sm" onClick={handleReturnToVyasa}>
              &larr; Return to VYASA Console
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <PageContainer style={{ padding: '36px 0 80px', flex: 1 }}>
        {/* Authority Profile Section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '24px',
            marginBottom: '32px',
            paddingBottom: '24px',
            borderBottom: '1px solid var(--vyasa-border, #E2E8F0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: 'var(--vyasa-navy, #1B2A4A)',
                color: 'var(--vyasa-gold, #D4A017)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(27, 42, 74, 0.18)',
                border: '2px solid var(--vyasa-gold, #D4A017)',
                flexShrink: 0,
              }}
            >
              {nivaran_authority.name ? nivaran_authority.name.charAt(0).toUpperCase() : 'M'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1
                  style={{
                    fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
                    fontSize: '28px',
                    color: 'var(--vyasa-navy, #1B2A4A)',
                    margin: 0,
                    fontWeight: 700,
                  }}
                >
                  {nivaran_authority.name || `${vyasa_identity.first_name} ${vyasa_identity.last_name}`}
                </h1>
                <Badge variant="gold">{nivaran_authority.role}</Badge>
                <Badge variant="teal">Generic: {vyasa_identity.roles.join(', ')}</Badge>
              </div>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--vyasa-text-secondary, #475569)',
                  margin: '6px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <span>{nivaran_authority.email || vyasa_identity.email}</span>
                <span>&bull;</span>
                <span>{nivaran_authority.designation || 'Grievance Manager'}</span>
                {nivaran_authority.department && (
                  <>
                    <span>&bull;</span>
                    <span>{nivaran_authority.department}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div>
            <Badge variant="gold">Domain Workspace Active</Badge>
          </div>
        </div>

        {/* Cross-Pillar Handoff Verification Telemetry */}
        <div style={{ marginBottom: '36px' }}>
          <Card
            variant="gold-accent"
            title="Cross-Pillar Identity Handoff Telemetry"
            subtitle="Verified by VYASA Core (Port 8000) &bull; Resolved by NIVARAN (Port 8001)"
            headerAction={<Badge variant="gold">Cryptographically Verified</Badge>}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
                padding: '6px 0',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  VYASA User Canonical UUID
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-navy, #1B2A4A)', marginTop: '4px' }}>
                  {vyasa_identity.id}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #475569)', marginTop: '2px' }}>
                  Authority Subject (sub)
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  NIVARAN Authority Record UUID
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-navy, #1B2A4A)', marginTop: '4px' }}>
                  {nivaran_authority.id}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #475569)', marginTop: '2px' }}>
                  <code>nivaran_authorities.id</code>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Resolved Domain Role
                </div>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant="gold">{nivaran_authority.role}</Badge>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #475569)', marginTop: '4px' }}>
                  Independent Domain Privilege
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Cross-Pillar Security Architecture
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vyasa-navy, #1B2A4A)', marginTop: '4px' }}>
                  Decoupled Token Delegation
                </div>
                <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #475569)', marginTop: '2px' }}>
                  Zero query param transmission
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Manager Triage Operations Section */}
        <div style={{ marginBottom: '40px' }}>
          <SectionHeading
            title="Grievance Triage &amp; Redressal Console"
            description="Operational command workspace for central grievance review, cluster assignment, and escalation"
          />

          {/* Operational Metrics Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '20px',
              marginTop: '20px',
              marginBottom: '28px',
            }}
          >
            <Card variant="scholarly" title="Pending Intake">
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--vyasa-navy, #1B2A4A)', margin: '8px 0' }}>
                0
              </div>
              <div style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary, #475569)' }}>
                New grievances awaiting triage classification
              </div>
            </Card>

            <Card variant="scholarly" title="Under Review">
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--vyasa-teal, #265D72)', margin: '8px 0' }}>
                0
              </div>
              <div style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary, #475569)' }}>
                Active cluster investigations
              </div>
            </Card>

            <Card variant="scholarly" title="Escalated">
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--vyasa-saffron, #B45309)', margin: '8px 0' }}>
                0
              </div>
              <div style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary, #475569)' }}>
                Referrals with Deans &amp; High-level Panels
              </div>
            </Card>

            <Card variant="scholarly" title="Resolved Today">
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--vyasa-success, #15803D)', margin: '8px 0' }}>
                0
              </div>
              <div style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary, #475569)' }}>
                Formal resolution notices issued
              </div>
            </Card>
          </div>

          {/* Manager Triage Queue Shell */}
          <Card
            variant="scholarly"
            title="Central Triage Queue"
            subtitle="Automated AI triage and manual routing workspace"
            headerAction={<Badge variant="neutral">Queue Ready</Badge>}
          >
            <div
              style={{
                backgroundColor: 'rgba(27, 42, 74, 0.02)',
                border: '1px dashed var(--vyasa-border, #CBD5E1)',
                borderRadius: '8px',
                padding: '48px 24px',
                textAlign: 'center',
                margin: '12px 0',
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <h3
                style={{
                  fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
                  color: 'var(--vyasa-navy, #1B2A4A)',
                  fontSize: '20px',
                  margin: '0 0 8px',
                }}
              >
                Manager Triage Pipeline Synchronized
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--vyasa-text-secondary, #475569)',
                  maxWidth: '560px',
                  margin: '0 auto 20px',
                  lineHeight: 1.6,
                }}
              >
                Authority session for <strong>{nivaran_authority.name || nivaran_authority.name_snapshot}</strong> is successfully validated.
                The 40-table NIVARAN schema, cluster authority matrix, and AI-assisted triage models are active.
              </p>
              <div style={{ display: 'inline-flex', gap: '8px' }}>
                <Badge variant="gold">Role: MANAGER</Badge>
                <Badge variant="teal">Cluster: Central Redressal</Badge>
              </div>
            </div>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
};
