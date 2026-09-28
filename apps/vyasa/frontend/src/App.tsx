import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuthorityRoute } from './components/auth/AuthorityRoute';
import { ApplicantRoute } from './components/auth/ApplicantRoute';
import { MainLayout } from './components/layout';
import { LandingPage } from './features/landing';
import { AuthorityLoginPage, ApplicantLoginPage, ApplicantRegisterPage } from './features/auth';
import { AuthorityDashboard } from './features/dashboard';
import { ApplicantDashboardPage } from './features/applicant';
import { SystemBoundaryView } from './features/system';
import { Card, Badge, Button, PageContainer } from '@vyasa/ui';

const EcosystemHome: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const navigate = useNavigate();

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    if (tabId === 'pillars') {
      setTimeout(() => {
        document.getElementById('pillars')?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'system':
        return <SystemBoundaryView onReturnHome={() => handleSelectTab('overview')} />;

      case 'applicant':
        return (
          <PageContainer narrow style={{ padding: '60px 0' }}>
            <Card
              variant="scholarly"
              title="Doctoral Scholar & Applicant Portal"
              subtitle="Ecosystem Scholar Gateway"
              headerAction={<Badge variant="saffron">Applicant</Badge>}
            >
              <p style={{ color: 'var(--vyasa-text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                The applicant portal provides unified application lifecycle tracking, submission
                pipelines, status monitoring, and grievance management across all registered governance pillars.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button variant="primary" size="sm" onClick={() => navigate('/applicant/login')}>
                  Applicant Login &rarr;
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/applicant/register')}>
                  Register as Applicant
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSelectTab('overview')}>
                  &larr; Return to Ecosystem Overview
                </Button>
              </div>
            </Card>
          </PageContainer>
        );

      case 'governance':
        return (
          <PageContainer narrow style={{ padding: '60px 0' }}>
            <Card
              variant="gold-accent"
              title="Institutional Governance Console"
              subtitle="Core Authority &amp; Policy Interface"
              headerAction={<Badge variant="teal">Authority</Badge>}
            >
              <p style={{ color: 'var(--vyasa-text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                The institutional governance console supports role-based case reviews, workflow
                supervision, policy compliance, and ecosystem telemetry for authorized university officers.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button variant="primary" size="sm" onClick={() => navigate('/authority/login')}>
                  Authority Login &rarr;
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSelectTab('overview')}>
                  &larr; Return to Ecosystem Overview
                </Button>
              </div>
            </Card>
          </PageContainer>
        );

      case 'pillars':
      case 'overview':
      default:
        return <LandingPage onEnterEcosystem={() => navigate('/applicant/login')} />;
    }
  };

  return (
    <MainLayout
      currentTab={currentTab}
      onSelectTab={handleSelectTab}
      onSignInClick={() => navigate('/applicant/login')}
    >
      {renderTabContent()}
    </MainLayout>
  );
};

export const AppRoutes: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Routes>
      {/* 1. Public Ecosystem Home */}
      <Route path="/" element={<EcosystemHome />} />

      {/* 2. Applicant Authentication */}
      <Route
        path="/applicant/login"
        element={
          <MainLayout
            currentTab="applicant"
            onSelectTab={() => navigate('/')}
            onSignInClick={() => navigate('/applicant/login')}
          >
            <ApplicantLoginPage />
          </MainLayout>
        }
      />
      <Route
        path="/applicant/register"
        element={
          <MainLayout
            currentTab="applicant"
            onSelectTab={() => navigate('/')}
            onSignInClick={() => navigate('/applicant/login')}
          >
            <ApplicantRegisterPage />
          </MainLayout>
        }
      />

      {/* 3. Institutional Authority Authentication */}
      <Route
        path="/authority/login"
        element={
          <MainLayout
            currentTab="governance"
            onSelectTab={() => navigate('/')}
            onSignInClick={() => navigate('/authority/login')}
          >
            <AuthorityLoginPage />
          </MainLayout>
        }
      />

      {/* 4. Compatibility Redirects */}
      <Route path="/login" element={<Navigate to="/authority/login" replace />} />
      <Route path="/register" element={<Navigate to="/applicant/register" replace />} />

      {/* 5. Guarded Authority Dashboard */}
      <Route
        path="/authority"
        element={
          <AuthorityRoute>
            <MainLayout
              currentTab="governance"
              onSelectTab={() => navigate('/')}
              onSignInClick={() => navigate('/authority/login')}
            >
              <AuthorityDashboard />
            </MainLayout>
          </AuthorityRoute>
        }
      />

      {/* 6. Guarded Applicant Workspace */}
      <Route
        path="/applicant"
        element={
          <ApplicantRoute>
            <MainLayout
              currentTab="applicant"
              onSelectTab={() => navigate('/')}
              onSignInClick={() => navigate('/applicant/login')}
            >
              <ApplicantDashboardPage />
            </MainLayout>
          </ApplicantRoute>
        }
      />

      {/* 7. Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
