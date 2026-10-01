import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, PageContainer, LoadingState } from '@vyasa/ui';

interface ApplicantRouteProps {
  children: React.ReactNode;
}

export const ApplicantRoute: React.FC<ApplicantRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isApplicant, user, logout } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <PageContainer narrow style={{ padding: '100px 0', textAlign: 'center' }}>
        <LoadingState message="Verifying institutional scholar credentials..." />
      </PageContainer>
    );
  }

  // Unauthenticated users redirected to /applicant/login
  if (!isAuthenticated) {
    return <Navigate to="/applicant/login" replace />;
  }

  // If authenticated but lacks generic 'applicant' role, show access denied
  if (!isApplicant) {
    return (
      <PageContainer narrow style={{ padding: '80px 0' }}>
        <Card
          variant="scholarly"
          title="Institutional Access Restricted"
          subtitle="Applicant Role Required"
          headerAction={<Badge variant="saffron">Access Denied</Badge>}
        >
          <div style={{ padding: '16px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '16px' }}>
              The authenticated account (<strong>{user?.email}</strong>) does not possess the institutional{' '}
              <strong>applicant</strong> platform role required to access the VYASA Applicant Workspace.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--vyasa-text-muted)', marginBottom: '24px' }}>
              Active roles on your profile: {user?.roles && user.roles.length > 0 ? user.roles.join(', ') : 'None'}.<br />
              If you are a doctoral candidate or institutional researcher, please verify your account status.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout();
                  navigate('/applicant/login');
                }}
              >
                Sign Out
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Return to Ecosystem Overview
              </Button>
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return <>{children}</>;
};
