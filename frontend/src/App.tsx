import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import {
  ApplicantRoute,
  AdminRoute,
  ManagerRoute,
  AuthorityScopedRoute,
  AuthenticatedRoute,
} from './components/auth';
import { MainLayout } from './components/layout';
import { VedicInvocationWrapper } from './components/common/VedicInvocationWrapper';
import { LandingPage } from './features/landing';
import { AuthorityLoginPage, ApplicantLoginPage, ApplicantRegisterPage } from './features/auth';
import { VyasaDashboardPage } from './features/dashboard';
import { SystemBoundaryView } from './features/system';
import { RigVedaDashboardPage } from './modules/rig-veda';
import { YajurVedaDashboardPage } from './modules/yajur-veda';
import { SamaVedaDashboardPage } from './modules/sama-veda';
import {
  NivaranWorkspacePage,
  GrievanceSubmitPage,
  ApplicantGrievanceListPage,
  ApplicantGrievanceDetailPage,
  ManagerTriageQueuePage,
  ManagerGrievanceReviewPage,
  AuthorityCasesPage,
  AssistantDeanDashboardPage,
  AssistantDeanGrievanceDetailPage,
  AssociateDeanDashboardPage,
  AssociateDeanGrievanceDetailPage,
  DeanExecutiveDashboardPage,
  ManagerClosureQueuePage,
  NivaranEFilesPage,
  StudentMasterRecordsPage,
  StudentMasterRecordDetailPage,
  MyStudentRecordPage,
  StudentRecordSearchPage,
} from './modules/atharva-veda/nivaran';

import {

  AdminDashboardPage,
  AuthoritiesPage,
  SubjectClustersPage,
  SubjectsPage,
  GrievanceClustersPage,
  GrievanceCategoriesPage,
  AuditLogsPage,
} from './admin';
import { PhdAssistantPage } from './features/phd-rag';
import { Card, Badge, Button, PageContainer } from '@vyasa/ui';



const EcosystemHome: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const navigate = useNavigate();

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    if (tabId === 'vision') {
      setTimeout(() => {
        document.getElementById('vision')?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else if (tabId === 'domains' || tabId === 'pillars') {
      setTimeout(() => {
        document.getElementById('domains')?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else if (tabId === 'nivaran') {
      setTimeout(() => {
        document.getElementById('nivaran')?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else if (tabId === 'innovation') {
      setTimeout(() => {
        document.getElementById('innovation')?.scrollIntoView({ behavior: 'smooth' });
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

      case 'phd-admission':
        return <PhdAssistantPage />;

      case 'vision':
      case 'domains':
      case 'nivaran':
      case 'innovation':
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

      {/* Public Ph.D. Admission Assistant (Accessible without authentication) */}
      <Route
        path="/phd-admission"
        element={
          <MainLayout
            currentTab="phd-admission"
            onSelectTab={() => navigate('/')}
            onSignInClick={() => navigate('/applicant/login')}
          >
            <PhdAssistantPage />
          </MainLayout>
        }
      />
      <Route path="/phd" element={<Navigate to="/phd-admission" replace />} />
      <Route path="/vyasa-assistant" element={<Navigate to="/phd-admission" replace />} />
      <Route path="/assistant" element={<Navigate to="/phd-admission" replace />} />

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

      {/* 5. Authenticated Unified VYASA Platform Dashboard */}
      <Route
        path="/dashboard"
        element={
          <AuthenticatedRoute>
            <MainLayout
              currentTab="governance"
              onSelectTab={() => navigate('/')}
              onSignInClick={() => navigate('/authority/login')}
            >
              <VyasaDashboardPage />
            </MainLayout>
          </AuthenticatedRoute>
        }
      />

      {/* 6. Legacy Authenticated Dashboard Redirects to Canonical /dashboard */}
      <Route path="/authority" element={<Navigate to="/dashboard" replace />} />
      <Route path="/applicant" element={<Navigate to="/dashboard" replace />} />
      <Route path="/scholar" element={<Navigate to="/dashboard" replace />} />

      {/* 7. Veda Governance Modules */}
      <Route
        path="/modules/rig-veda"
        element={
          <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
            <RigVedaDashboardPage />
          </MainLayout>
        }
      />
      <Route
        path="/modules/yajur-veda"
        element={
          <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
            <YajurVedaDashboardPage />
          </MainLayout>
        }
      />
      <Route
        path="/modules/sama-veda"
        element={
          <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
            <SamaVedaDashboardPage />
          </MainLayout>
        }
      />
      {/* Atharva Veda: NIVARAN Workspace & Grievance Lifecycle */}
      <Route
        path="/modules/atharva-veda/nivaran"
        element={
          <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
            <NivaranWorkspacePage />
          </MainLayout>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/submit"
        element={
          <ApplicantRoute>
            <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
              <GrievanceSubmitPage />
            </MainLayout>
          </ApplicantRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/my-grievances"
        element={
          <ApplicantRoute>
            <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
              <ApplicantGrievanceListPage />
            </MainLayout>
          </ApplicantRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/grievance/:id"
        element={
          <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
            <ApplicantGrievanceDetailPage />
          </MainLayout>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/manager/queue"
        element={
          <ManagerRoute>
            <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <ManagerTriageQueuePage />
            </MainLayout>
          </ManagerRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/manager/review/:id"
        element={
          <ManagerRoute>
            <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <ManagerGrievanceReviewPage />
            </MainLayout>
          </ManagerRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/manager/closure-queue"
        element={
          <ManagerRoute>
            <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <ManagerClosureQueuePage />
            </MainLayout>
          </ManagerRoute>
        }
      />

      {/* Atharva Veda: Scoped Authority Case Queues */}
      <Route
        path="/modules/atharva-veda/nivaran/assistant-dean/cases"
        element={
          <AuthorityScopedRoute allowedRoles={['ASSISTANT_DEAN']} roleTitle="Assistant Dean">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AssistantDeanDashboardPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/assistant-dean/dashboard"
        element={
          <AuthorityScopedRoute allowedRoles={['ASSISTANT_DEAN']} roleTitle="Assistant Dean">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AssistantDeanDashboardPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/assistant-dean/grievance/:id"
        element={
          <AuthorityScopedRoute allowedRoles={['ASSISTANT_DEAN']} roleTitle="Assistant Dean">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AssistantDeanGrievanceDetailPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/assistant-dean/grievances/:id"
        element={
          <AuthorityScopedRoute allowedRoles={['ASSISTANT_DEAN']} roleTitle="Assistant Dean">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AssistantDeanGrievanceDetailPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/associate-dean/cases"
        element={
          <AuthorityScopedRoute allowedRoles={['ASSOCIATE_DEAN']} roleTitle="Associate Dean">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AssociateDeanDashboardPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/associate-dean/dashboard"
        element={
          <AuthorityScopedRoute allowedRoles={['ASSOCIATE_DEAN']} roleTitle="Associate Dean">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AssociateDeanDashboardPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/associate-dean/grievance/:id"
        element={
          <AuthorityScopedRoute allowedRoles={['ASSOCIATE_DEAN']} roleTitle="Associate Dean">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AssociateDeanGrievanceDetailPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/associate-dean/grievances/:id"
        element={
          <AuthorityScopedRoute allowedRoles={['ASSOCIATE_DEAN']} roleTitle="Associate Dean">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AssociateDeanGrievanceDetailPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/dean/dashboard"
        element={
          <AuthorityScopedRoute allowedRoles={['DEAN']} roleTitle="Dean of Research & Development">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <DeanExecutiveDashboardPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/dean/cases"
        element={
          <AuthorityScopedRoute allowedRoles={['DEAN']} roleTitle="Dean of Academic Affairs">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AuthorityCasesPage forcedScope="DEAN" />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />

      {/* Global Atharva Veda: E-Files & Student Master Records */}
      <Route
        path="/modules/atharva-veda/nivaran/e-files"
        element={
          <AuthenticatedRoute>
            <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
              <NivaranEFilesPage />
            </MainLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/student-records"
        element={
          <AuthenticatedRoute>
            <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
              <StudentMasterRecordsPage />
            </MainLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/student-records/me"
        element={
          <ApplicantRoute>
            <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
              <MyStudentRecordPage />
            </MainLayout>
          </ApplicantRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/student-records/search"
        element={
          <AuthorityScopedRoute allowedRoles={['MANAGER', 'ASSISTANT_DEAN', 'ASSOCIATE_DEAN', 'DEAN']} roleTitle="Student Records Directory">
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <StudentRecordSearchPage />
            </MainLayout>
          </AuthorityScopedRoute>
        }
      />
      <Route
        path="/modules/atharva-veda/nivaran/student-records/:id"
        element={
          <AuthenticatedRoute>
            <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
              <StudentMasterRecordDetailPage />
            </MainLayout>
          </AuthenticatedRoute>
        }
      />

      {/* Direct Atharva Veda aliases (without /modules prefix) */}
      <Route path="/atharva-veda/nivaran" element={<Navigate to="/modules/atharva-veda/nivaran" replace />} />
      <Route path="/atharva-veda/nivaran/submit" element={<Navigate to="/modules/atharva-veda/nivaran/submit" replace />} />
      <Route path="/atharva-veda/nivaran/my-grievances" element={<Navigate to="/modules/atharva-veda/nivaran/my-grievances" replace />} />
      <Route
        path="/atharva-veda/nivaran/grievance/:id"
        element={
          <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
            <ApplicantGrievanceDetailPage />
          </MainLayout>
        }
      />
      <Route path="/atharva-veda/nivaran/manager/queue" element={<Navigate to="/modules/atharva-veda/nivaran/manager/queue" replace />} />
      <Route
        path="/atharva-veda/nivaran/manager/review/:id"
        element={
          <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
            <ManagerGrievanceReviewPage />
          </MainLayout>
        }
      />
      <Route path="/atharva-veda/nivaran/assistant-dean/dashboard" element={<Navigate to="/modules/atharva-veda/nivaran/assistant-dean/dashboard" replace />} />
      <Route path="/atharva-veda/nivaran/assistant-dean/cases" element={<Navigate to="/modules/atharva-veda/nivaran/assistant-dean/cases" replace />} />
      <Route path="/atharva-veda/nivaran/assistant-dean/grievance/:id" element={<Navigate to="/modules/atharva-veda/nivaran/assistant-dean/grievance/:id" replace />} />
      <Route path="/atharva-veda/nivaran/assistant-dean/grievances/:id" element={<Navigate to="/modules/atharva-veda/nivaran/assistant-dean/grievances/:id" replace />} />
      <Route path="/atharva-veda/nivaran/associate-dean/dashboard" element={<Navigate to="/modules/atharva-veda/nivaran/associate-dean/dashboard" replace />} />
      <Route path="/atharva-veda/nivaran/associate-dean/cases" element={<Navigate to="/modules/atharva-veda/nivaran/associate-dean/cases" replace />} />
      <Route path="/atharva-veda/nivaran/associate-dean/grievance/:id" element={<Navigate to="/modules/atharva-veda/nivaran/associate-dean/grievance/:id" replace />} />
      <Route path="/atharva-veda/nivaran/associate-dean/grievances/:id" element={<Navigate to="/modules/atharva-veda/nivaran/associate-dean/grievances/:id" replace />} />
      <Route path="/associate-dean" element={<Navigate to="/modules/atharva-veda/nivaran/associate-dean/dashboard" replace />} />
      <Route path="/atharva-veda/nivaran/dean/dashboard" element={<Navigate to="/modules/atharva-veda/nivaran/dean/dashboard" replace />} />
      <Route path="/dean/dashboard" element={<Navigate to="/modules/atharva-veda/nivaran/dean/dashboard" replace />} />
      <Route path="/atharva-veda/nivaran/dean/cases" element={<Navigate to="/modules/atharva-veda/nivaran/dean/cases" replace />} />

      {/* Legacy NIVARAN alias redirects */}
      <Route path="/modules/nivaran" element={<Navigate to="/modules/atharva-veda/nivaran" replace />} />
      <Route path="/nivaran" element={<Navigate to="/modules/atharva-veda/nivaran" replace />} />
      <Route path="/nivaran/submit" element={<Navigate to="/modules/atharva-veda/nivaran/submit" replace />} />
      <Route path="/nivaran/my-grievances" element={<Navigate to="/modules/atharva-veda/nivaran/my-grievances" replace />} />
      <Route path="/nivaran/assistant-dean/dashboard" element={<Navigate to="/modules/atharva-veda/nivaran/assistant-dean/dashboard" replace />} />
      <Route path="/nivaran/assistant-dean/cases" element={<Navigate to="/modules/atharva-veda/nivaran/assistant-dean/cases" replace />} />
      <Route path="/nivaran/assistant-dean/grievance/:id" element={<Navigate to="/modules/atharva-veda/nivaran/assistant-dean/grievance/:id" replace />} />
      <Route path="/nivaran/assistant-dean/grievances/:id" element={<Navigate to="/modules/atharva-veda/nivaran/assistant-dean/grievances/:id" replace />} />

      <Route
        path="/nivaran/grievance/:id"
        element={
          <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
            <ApplicantGrievanceDetailPage />
          </MainLayout>
        }
      />
      <Route path="/nivaran/manager/queue" element={<Navigate to="/modules/atharva-veda/nivaran/manager/queue" replace />} />
      <Route
        path="/nivaran/manager/review/:id"
        element={
          <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
            <ManagerGrievanceReviewPage />
          </MainLayout>
        }
      />

      {/* 8. Institutional Admin Console */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AdminDashboardPage />
            </MainLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/atharva/authorities"
        element={
          <AdminRoute>
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AuthoritiesPage />
            </MainLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/atharva/subject-clusters"
        element={
          <AdminRoute>
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <SubjectClustersPage />
            </MainLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/atharva/subjects"
        element={
          <AdminRoute>
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <SubjectsPage />
            </MainLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/atharva/grievance-clusters"
        element={
          <AdminRoute>
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <GrievanceClustersPage />
            </MainLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/atharva/categories"
        element={
          <AdminRoute>
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <GrievanceCategoriesPage />
            </MainLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/atharva/audit-logs"
        element={
          <AdminRoute>
            <MainLayout currentTab="governance" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
              <AuditLogsPage />
            </MainLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={<Navigate to="/admin/atharva/audit-logs" replace />}
      />


      {/* 9. Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <VedicInvocationWrapper>
          <AppRoutes />
        </VedicInvocationWrapper>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
