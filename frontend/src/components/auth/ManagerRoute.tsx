import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, PageContainer, LoadingState } from '@vyasa/ui';

interface ManagerRouteProps {
  children: React.ReactNode;
}

export const ManagerRoute: React.FC<ManagerRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isManager, user, logout } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <PageContainer narrow style={{ padding: '100px 0', textAlign: 'center' }}>
        <LoadingState message="Verifying institutional triage manager credentials..." />
      </PageContainer>
    );
  }

  // Unauthenticated users redirected to /authority/login
  if (!isAuthenticated) {
    return <Navigate to="/authority/login" replace />;
  }

  // If logged in but lacks 'MANAGER' role, show access denied
  if (!isManager) {
    return (
      <PageContainer narrow style={{ padding: '80px 0' }}>
        <Card
          variant="scholarly"
          title="Triage Command Center Restricted"
          subtitle="Triage Manager Role Required"
          headerAction={<Badge variant="saffron">Access Denied</Badge>}
        >
          <div style={{ padding: '16px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '16px' }}>
              The authenticated account (<strong>{user?.email}</strong>) is not assigned to the institutional{' '}
              <strong>Triage Manager</strong> role required to access the NIVARAN Triage Command Center.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--vyasa-text-muted)', marginBottom: '24px' }}>
              Authority role: {user?.authority_role || 'None'}.<br />
              Triage and initial assignment operations are restricted to the designated Triage Manager.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout();
                  navigate('/authority/login');
                }}
              >
                Sign Out
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/authority')}>
                Return to Authority Console
              </Button>
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return <>{children}</>;
};
