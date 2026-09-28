import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Card, Badge, Button, PageContainer, LoadingState } from '@vyasa/ui';
import { applicantService } from '../services/applicantService';
import { ApplicantProfileData, ApplicantTabKey } from '../types';
import { ApplicantSidebar } from '../components/ApplicantSidebar';
import { ApplicantIdentityCard } from '../components/ApplicantIdentityCard';
import { ApplicantAcademicProfile } from '../components/ApplicantAcademicProfile';
import { ApplicantPillarsSection } from '../components/ApplicantPillarsSection';
import { ApplicantNotifications } from '../components/ApplicantNotifications';

export const ApplicantDashboardPage: React.FC = () => {
  const { displayName, logout } = useAuth();
  const navigate = useNavigate();

  const [currentTab, setCurrentTab] = useState<ApplicantTabKey>('overview');
  const [profile, setProfile] = useState<ApplicantProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await applicantService.getProfile();
      setProfile(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load scholar profile.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = () => {
    logout();
    navigate('/applicant/login');
  };

  if (loading) {
    return (
      <PageContainer style={{ padding: '80px 0', textAlign: 'center' }}>
        <LoadingState message="Hydrating institutional scholar workspace..." />
      </PageContainer>
    );
  }

  if (error || !profile) {
    return (
      <PageContainer narrow style={{ padding: '80px 0' }}>
        <Card
          variant="scholarly"
          title="Scholar Workspace Unavailable"
          subtitle="Identity Profile Verification"
          headerAction={<Badge variant="saffron">Error</Badge>}
        >
          <div style={{ padding: '16px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '16px' }}>
              {error || 'Unable to retrieve your institutional profile from VYASA Core identity authority.'}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="primary" size="sm" onClick={fetchProfile}>
                Retry Loading
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const renderTabContent = () => {
    switch (currentTab) {
      case 'academic':
        return <ApplicantAcademicProfile profile={profile} />;

      case 'pillars':
        return <ApplicantPillarsSection />;

      case 'notifications':
        return <ApplicantNotifications />;

      case 'account':
        return (
          <Card
            variant="scholarly"
            title="Account & Security Status"
            subtitle="VYASA Institutional Authentication Credential"
            headerAction={<Badge variant="teal">Secured</Badge>}
          >
            <div style={{ padding: '12px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase' }}>Account Email</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 600, color: 'var(--vyasa-navy)' }}>{profile.email}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase' }}>Security Level</span>
                  <p style={{ margin: '4px 0 0', color: 'var(--vyasa-navy)' }}>PBKDF2 Hashed Credential</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase' }}>Assigned Roles</span>
                  <p style={{ margin: '4px 0 0', color: 'var(--vyasa-navy)' }}>{profile.roles.join(', ')}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase' }}>Verification Status</span>
                  <div style={{ margin: '4px 0 0' }}>
                    <Badge variant={profile.is_verified ? 'teal' : 'gold'}>
                      {profile.is_verified ? 'Verified Institutional Account' : 'Self-Registered (Pending Verification)'}
                    </Badge>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', margin: 0 }}>
                This identity is managed by the CSJMU Central Identity Authority. Plaintext credentials are never
                stored or exposed across connected pillars.
              </p>
            </div>
          </Card>
        );

      case 'overview':
      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <ApplicantIdentityCard profile={profile} />

            {/* Quick Navigation / Ecosystem Access Card */}
            <Card
              variant="gold-accent"
              title="Ecosystem Access & Single Sign-On"
              subtitle="Gateway to affiliated university governance services"
              headerAction={<Badge variant="teal">Active Session</Badge>}
            >
              <div style={{ padding: '8px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 16px', fontSize: '14px' }}>
                  Welcome to the VYASA Scholar Workspace. Your verified identity enables single sign-on access across
                  all affiliated university governance pillars, beginning with NIVARAN for doctoral research and
                  grievance management.
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Button variant="primary" size="sm" onClick={() => setCurrentTab('pillars')}>
                    View Connected Pillars &rarr;
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentTab('academic')}>
                    View Academic Record
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        );
    }
  };

  return (
    <PageContainer style={{ padding: '40px 0 80px' }}>
      {/* Top Profile Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '24px',
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--vyasa-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'var(--vyasa-navy, #1b2a4a)',
              color: 'var(--vyasa-gold, #c49a45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(27, 42, 74, 0.12)',
              border: '2px solid var(--vyasa-gold, #c49a45)',
              flexShrink: 0,
            }}
          >
            {profile.first_name ? profile.first_name.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
                  fontSize: '24px',
                  color: 'var(--vyasa-navy)',
                  margin: 0,
                  fontWeight: 700,
                }}
              >
                {displayName || profile.full_name}
              </h1>
              <Badge variant="saffron">Applicant</Badge>
              {profile.is_verified && <Badge variant="teal">Verified</Badge>}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
              {profile.email} &bull; {profile.subject_name || 'Doctoral Scholar'} &bull; CSJMU VYASA Core
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            Ecosystem Home
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Workspace: Sidebar + Content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 260px) 1fr',
          gap: '32px',
          alignItems: 'start',
        }}
      >
        <ApplicantSidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          scholarName={profile.full_name}
          subjectName={profile.subject_name || undefined}
        />

        <main style={{ minWidth: 0 }}>
          {renderTabContent()}
        </main>
      </div>
    </PageContainer>
  );
};
