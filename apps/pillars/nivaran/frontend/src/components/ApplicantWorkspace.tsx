import React from 'react';
import { Card, Badge, Button, PageContainer, SectionHeading } from '@vyasa/ui';
import { CsjmuLogo } from '@vyasa/ui/branding';
import { ApplicantSessionResponse } from '../types/authority';
import { NivaranAuthService } from '../services/nivaranAuthService';

interface ApplicantWorkspaceProps {
  session: ApplicantSessionResponse;
}

export const ApplicantWorkspace: React.FC<ApplicantWorkspaceProps> = ({ session }) => {
  const { vyasa_identity, student_record } = session;

  const handleReturnToVyasa = () => {
    window.location.href = 'http://localhost:5173/applicant';
  };

  const handleSignOut = () => {
    NivaranAuthService.clearToken();
    window.location.href = 'http://localhost:5173/applicant/login';
  };

  const scholarName =
    student_record.full_name ||
    `${vyasa_identity.first_name} ${vyasa_identity.last_name}`.trim() ||
    'Doctoral Scholar';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--vyasa-ivory, #FAF8F5)',
      }}
    >
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
                CSJMU Doctoral Grievance Redressal &amp; Governance Pillar
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button variant="outline" size="sm" onClick={handleReturnToVyasa}>
              &larr; Return to VYASA Portal
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <PageContainer style={{ padding: '36px 0 80px', flex: 1 }}>
        {/* Scholar Profile Section */}
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
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--vyasa-navy, #1B2A4A)',
                color: 'var(--vyasa-gold, #D4A017)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(27, 42, 74, 0.15)',
                border: '2px solid var(--vyasa-gold, #D4A017)',
                flexShrink: 0,
              }}
            >
              {scholarName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1
                  style={{
                    fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
                    fontSize: '26px',
                    color: 'var(--vyasa-navy, #1B2A4A)',
                    margin: 0,
                    fontWeight: 700,
                  }}
                >
                  {scholarName}
                </h1>
                <Badge variant="gold">Ph.D. Scholar</Badge>
                <Badge variant="teal">Verified Identity</Badge>
                <Badge variant="neutral">CSJMU Core</Badge>
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
                <span>{vyasa_identity.email}</span>
                {student_record.registration_number && (
                  <>
                    <span>&bull;</span>
                    <span style={{ fontWeight: 600, color: 'var(--vyasa-navy, #1B2A4A)' }}>
                      Reg: {student_record.registration_number}
                    </span>
                  </>
                )}
                <span>&bull;</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--vyasa-text-muted, #64748B)' }}>
                  Record: {student_record.record_number}
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                padding: '6px 12px',
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                borderRadius: '9999px',
                fontWeight: 600,
                border: '1px solid #A7F3D0',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                }}
              />
              NIVARAN Domain Active
            </span>
          </div>
        </div>

        {/* First-Time JIT Registration Banner */}
        {session.is_new_registration && (
          <div
            role="status"
            style={{
              backgroundColor: '#ECFDF5',
              border: '1px solid #10B981',
              borderRadius: '8px',
              padding: '16px 20px',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              color: '#065F46',
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 700 }}>✓</div>
            <div>
              <strong style={{ fontSize: '15px', display: 'block', marginBottom: '2px' }}>
                Doctoral Scholar Registered in NIVARAN
              </strong>
              <span style={{ fontSize: '13px' }}>
                Your institutional domain record ({student_record.record_number}) has been created JIT and linked with your verified VYASA identity. Academic cluster: {session.academic_context?.cluster_name || 'Academic Administration'}.
              </span>
            </div>
          </div>
        )}

        {/* Academic Affiliation & Domain Profile Card */}
        <div style={{ marginBottom: '36px' }}>
          <SectionHeading
            title="Academic Affiliation & Domain Record"
            description="Authoritative Ph.D. enrollment profile synchronized via VYASA Core Identity"
          />

          <Card variant="gold-accent" style={{ marginTop: '16px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '24px',
                padding: '12px 0',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: 'var(--vyasa-text-muted, #64748B)',
                    letterSpacing: '0.5px',
                    fontWeight: 600,
                  }}
                >
                  Doctoral Registration
                </span>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--vyasa-navy, #1B2A4A)',
                  }}
                >
                  {student_record.registration_number || 'Under Provisional Verification'}
                </p>
                <span style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #475569)' }}>
                  Official University Roll / Ref
                </span>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: 'var(--vyasa-text-muted, #64748B)',
                    letterSpacing: '0.5px',
                    fontWeight: 600,
                  }}
                >
                  Academic Department
                </span>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--vyasa-navy, #1B2A4A)',
                  }}
                >
                  {student_record.department || 'Academic Affairs'}
                </p>
                <span style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #475569)' }}>
                  Faculty Division
                </span>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: 'var(--vyasa-text-muted, #64748B)',
                    letterSpacing: '0.5px',
                    fontWeight: 600,
                  }}
                >
                  Taxonomy Subject
                </span>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--vyasa-navy, #1B2A4A)',
                  }}
                >
                  {student_record.subject_name || 'Assigned Subject'}
                </p>
                <span style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #475569)' }}>
                  Cluster Routing Taxonomy
                </span>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: 'var(--vyasa-text-muted, #64748B)',
                    letterSpacing: '0.5px',
                    fontWeight: 600,
                  }}
                >
                  NIVARAN Record Number
                </span>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '15px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: 'var(--vyasa-navy, #1B2A4A)',
                  }}
                >
                  {student_record.record_number}
                </p>
                <span style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #475569)' }}>
                  Domain Master Identifier
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Grievance Operations & Actions */}
        <div style={{ marginBottom: '40px' }}>
          <SectionHeading
            title="Grievance Redressal Workspace"
            description="Institutional dispute resolution and administrative petition pipeline"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              marginTop: '16px',
            }}
          >
            {/* File Petition Card */}
            <Card
              variant="scholarly"
              title="File New Grievance"
              subtitle="Submit a formal academic or administrative petition"
              headerAction={<Badge variant="gold">Active Portal</Badge>}
            >
              <div style={{ padding: '8px 0', fontSize: '14px', lineHeight: 1.6, color: 'var(--vyasa-text-secondary, #475569)' }}>
                <p style={{ margin: '0 0 16px' }}>
                  Submit an institutional grievance regarding RAC/RDC evaluations, supervisor allocation,
                  fellowship disbursement, or administrative hurdles. Petitions are routed using AI triage
                  to the appropriate Assistant Dean cluster.
                </p>
                <div
                  style={{
                    backgroundColor: 'rgba(212, 160, 23, 0.08)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    marginBottom: '18px',
                    fontSize: '12px',
                    color: 'var(--vyasa-navy, #1B2A4A)',
                  }}
                >
                  <strong>Quota Policy:</strong> Maximum of 3 grievances per calendar day (Asia/Kolkata).
                  Duplicate active submissions under the same category are automatically filtered.
                </div>
                <Button variant="primary" size="md" style={{ width: '100%', justifyContent: 'center' }}>
                  Proceed to Grievance Form &rarr;
                </Button>
              </div>
            </Card>

            {/* Track Submissions Card */}
            <Card
              variant="scholarly"
              title="Track Active Grievances"
              subtitle="Monitor resolution lifecycles &amp; authority remarks"
              headerAction={<Badge variant="teal">Real-Time</Badge>}
            >
              <div style={{ padding: '8px 0', fontSize: '14px', lineHeight: 1.6, color: 'var(--vyasa-text-secondary, #475569)' }}>
                <p style={{ margin: '0 0 16px' }}>
                  Check real-time progress of your submitted grievances across Assistant Dean, Associate Dean,
                  and Dean review tiers. Review official responses, uploaded attachments, and closure notes.
                </p>
                <div
                  style={{
                    backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    marginBottom: '18px',
                    fontSize: '12px',
                    color: 'var(--vyasa-text-muted, #64748B)',
                  }}
                >
                  <strong>Current Status:</strong> No active grievances filed under this account yet.
                </div>
                <Button variant="outline" size="md" style={{ width: '100%', justifyContent: 'center' }}>
                  View Grievance History
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Security & Cryptographic Boundary Assurance */}
        <Card
          variant="scholarly"
          title="Institutional Identity & Security Boundary"
          subtitle="Cryptographic Single Sign-On Architecture"
          headerAction={<Badge variant="neutral">Verified</Badge>}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px',
              padding: '8px 0',
              fontSize: '13px',
              color: 'var(--vyasa-text-secondary, #475569)',
              lineHeight: 1.6,
            }}
          >
            <div>
              <strong style={{ color: 'var(--vyasa-navy, #1B2A4A)', display: 'block', marginBottom: '4px' }}>
                Identity Authority
              </strong>
              <span>
                Your session is authenticated cryptographically by <strong>VYASA Core</strong>. NIVARAN does not
                store or inspect your login credentials.
              </span>
            </div>

            <div>
              <strong style={{ color: 'var(--vyasa-navy, #1B2A4A)', display: 'block', marginBottom: '4px' }}>
                Domain Decoupling
              </strong>
              <span>
                NIVARAN operates as an autonomous governance pillar. Grievance records, AI classifications, and
                resolution audits are stored securely within the NIVARAN domain.
              </span>
            </div>

            <div>
              <strong style={{ color: 'var(--vyasa-navy, #1B2A4A)', display: 'block', marginBottom: '4px' }}>
                Audit Compliance
              </strong>
              <span>
                All handoffs, profile synchronizations, and petition submissions emit tamper-evident audit records
                under institutional governance rules.
              </span>
            </div>
          </div>
        </Card>
      </PageContainer>
    </div>
  );
};
