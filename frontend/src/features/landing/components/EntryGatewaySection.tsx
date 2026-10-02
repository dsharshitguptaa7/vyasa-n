import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button, SectionHeading } from '@vyasa/ui';

export const EntryGatewaySection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section id="entry-gateways" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
      <SectionHeading
        title="Institutional Access Gateways"
        description="Select your institutional role to access affiliated research, scholar services, and governance consoles"
        eyebrow="Unified Authentication"
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '28px',
        }}
      >
        {/* 1. APPLICANT GATEWAY */}
        <Card
          className="vyasa-gateway-card"
          variant="scholarly"
          title="Doctoral Scholars & Applicants"
          subtitle="Scholar Workspace & NIVARAN Grievance Redressal"
          headerAction={<Badge variant="saffron">Applicant</Badge>}
        >
          <div style={{ padding: '8px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 20px', fontSize: '14px' }}>
              Access your doctoral academic profile, manage university research credentials, monitor application
              lifecycles, and submit research grievances directly through the connected NIVARAN pillar.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/applicant/login')}
              >
                Applicant Login &rarr;
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/applicant/register')}
              >
                Register as Applicant
              </Button>
            </div>
          </div>
        </Card>

        {/* 2. AUTHORITY GATEWAY */}
        <Card
          className="vyasa-gateway-card"
          variant="gold-accent"
          title="Institutional Authorities"
          subtitle="Administrative Review & Governance Console"
          headerAction={<Badge variant="teal">Authority</Badge>}
        >
          <div style={{ padding: '8px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 20px', fontSize: '14px' }}>
              Restricted console for university administrative officers, deans, associate deans, managers,
              and committee members to oversee grievance cases, policy compliance, and ecosystem operations.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/authority/login')}
              >
                Authority Login &rarr;
              </Button>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: '12px', color: 'var(--vyasa-text-muted)' }}>
              Note: Authority identities are provisioned centrally by the University Administration. Public registration is not permitted.
            </p>
          </div>
        </Card>

        {/* 3. PUBLIC VYASA ASSISTANT GATEWAY */}
        <Card
          className="vyasa-gateway-card"
          variant="scholarly"
          title="VYASA AI Assistant"
          subtitle="Research & Development Assistant • CSJMU, Kanpur"
          headerAction={<Badge variant="gold">Public • No Login</Badge>}
        >
          <div style={{ padding: '8px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 20px', fontSize: '14px' }}>
              Your AI guide to research, doctoral studies, and academic regulations at CSJMU. Explore authoritative doctoral guidelines, course work credits, ordinance provisions, and admission criteria with source-grounded answers.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/phd-admission')}
              >
                Open VYASA AI Assistant &rarr;
              </Button>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: '12px', color: 'var(--vyasa-text-muted)' }}>
              Accessible publicly without login or user registration. Sourced directly from official university documents.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
};

