import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Button, PageContainer, SectionHeading } from '@vyasa/ui';

export const AuthorityDashboard: React.FC = () => {
  const auth = useAuth();
  const { user, displayName, logout } = auth;
  const navigate = useNavigate();

  const handleOpenNivaran = () => {
    navigate('/modules/atharva-veda/nivaran');
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <PageContainer style={{ padding: '40px 0 80px' }}>
      {/* Header Profile Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '24px',
          marginBottom: '36px',
          paddingBottom: '28px',
          borderBottom: '1px solid var(--vyasa-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--vyasa-navy)',
              color: 'var(--vyasa-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(27, 42, 74, 0.15)',
              border: '2px solid var(--vyasa-gold)',
              flexShrink: 0,
            }}
          >
            {displayName ? displayName.charAt(0).toUpperCase() : 'A'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
                  fontSize: '26px',
                  color: 'var(--vyasa-navy)',
                  margin: 0,
                  fontWeight: 700,
                }}
              >
                {displayName || 'Institutional Authority'}
              </h1>
              <Badge variant="teal">Authority</Badge>
              <Badge variant="neutral">CSJMU Core</Badge>
            </div>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--vyasa-text-secondary)',
                margin: '6px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span>{user?.email}</span>
              {user?.id && (
                <>
                  <span>&bull;</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--vyasa-text-muted)' }}>
                    ID: {user.id}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            Ecosystem Overview
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Console Content */}
      <div style={{ marginBottom: '40px' }}>
        <SectionHeading
          title="Institutional Governance Pillars"
          description="Autonomous domain pillars registered with VYASA Core Identity Authority"
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '24px',
            marginTop: '20px',
          }}
        >
          {/* NIVARAN Pillar Card (Active) */}
          <Card
            variant="gold-accent"
            title="NIVARAN"
            subtitle="AI-Assisted Grievance Redressal System"
            headerAction={<Badge variant="teal">Active Pillar</Badge>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
                  CSJMU central grievance redressal, authority triage, and dispute resolution platform.
                  Handles academic, administrative, and collegiate grievance lifecycles with multi-tier routing.
                </p>
                <div
                  style={{
                    backgroundColor: 'rgba(212, 160, 23, 0.08)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    marginBottom: '20px',
                    fontSize: '12px',
                    color: 'var(--vyasa-navy)',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Domain Integration:</strong> Identity verified via VYASA Core JWT. Domain role assignments and cluster authority are maintained within NIVARAN.
                </div>
              </div>

              <div>
                <Button
                  variant="primary"
                  size="md"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleOpenNivaran}
                >
                  Open NIVARAN &rarr;
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Identity Authority Information Card */}
      <Card
        variant="scholarly"
        title="Institutional Identity Verification"
        subtitle="VYASA Ecosystem Identity Authority"
        headerAction={<Badge variant="teal">Verified Session</Badge>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', padding: '8px 0' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Account Identity
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--vyasa-navy)', marginTop: '4px' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', marginTop: '2px' }}>
              {user?.email}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ecosystem Role
            </div>
            <div style={{ marginTop: '4px' }}>
              <Badge variant="teal">Authority</Badge>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
              Generic Institutional Role
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Institutional Issuer
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--vyasa-navy)', marginTop: '4px' }}>
              CSJMU VYASA Core
            </div>
            <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '2px' }}>
              JWT Identity Provider
            </div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
};
