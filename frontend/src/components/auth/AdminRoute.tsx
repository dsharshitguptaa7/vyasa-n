import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, PageContainer, LoadingState } from '@vyasa/ui';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isAdmin, user, logout } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <PageContainer narrow style={{ padding: '100px 0', textAlign: 'center' }}>
        <LoadingState message="Verifying institutional administrator credentials..." />
      </PageContainer>
    );
  }

  // Unauthenticated users redirected to /authority/login
  if (!isAuthenticated) {
    return <Navigate to="/authority/login" replace />;
  }

  // If logged in but lacks 'administrator' role, show access denied
  if (!isAdmin) {
    return (
      <PageContainer narrow style={{ padding: '80px 0' }}>
        <Card
          variant="scholarly"
          title="Administrative Control Plane Restricted"
          subtitle="Administrator Role Required"
          headerAction={<Badge variant="saffron">Access Denied</Badge>}
        >
          <div style={{ padding: '16px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '16px' }}>
              The authenticated account (<strong>{user?.email}</strong>) does not possess the institutional{' '}
              <strong>administrator</strong> platform role required to access the VYASA Admin Control Plane.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--vyasa-text-muted)', marginBottom: '24px' }}>
              Active roles on your profile: {user?.roles && user.roles.length > 0 ? user.roles.join(', ') : 'None'}.<br />
              Administrative functions are restricted to authorized platform controllers.
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
