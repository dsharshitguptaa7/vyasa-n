import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, PageContainer, LoadingState } from '@vyasa/ui';

interface AdminRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, isAdmin, isSuperAdmin, user, logout } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <PageContainer narrow style={{ padding: '100px 0', textAlign: 'center' }}>
        <LoadingState message="Verifying Super Admin credentials..." />
      </PageContainer>
    );
  }

  // Unauthenticated users redirected to /authority/login
  if (!isAuthenticated) {
    return <Navigate to="/authority/login" replace />;
  }

  // Check super_admin by default, or explicit allowedRoles if configured.
  // Seeded administrator role is permitted when verified by AuthContext isAdmin.
  const userRoles = (user?.roles || []).map((r) => r.toLowerCase());
  const effectiveAllowedRoles = allowedRoles && allowedRoles.length > 0
    ? allowedRoles.map((ar) => ar.toLowerCase())
    : ['super_admin'];

  const isAuthorized =
    isSuperAdmin ||
    userRoles.includes('super_admin') ||
    (Boolean(allowedRoles && allowedRoles.length > 0) && userRoles.some((r) => effectiveAllowedRoles.includes(r))) ||
    (Boolean(isAdmin) && userRoles.includes('administrator'));

  if (!isAuthorized) {
    return (
      <PageContainer narrow style={{ padding: '80px 0' }}>
        <Card
          variant="scholarly"
          title="Administrative Control Plane Restricted"
          subtitle="Super Admin Role Required • Administrator Role Required"
          headerAction={<Badge variant="saffron">Access Denied</Badge>}
        >
          <div style={{ padding: '16px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '16px' }}>
              The authenticated account (<strong>{user?.email}</strong>) does not possess the central{' '}
              <strong>super_admin</strong> platform role required to access the VYASA Super Admin Control Plane.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--vyasa-text-muted)', marginBottom: '24px' }}>
              Active roles on your profile: {user?.roles && user.roles.length > 0 ? user.roles.join(', ') : 'None'}.<br />
              Administrative functions are restricted exclusively to authorized central system administrators.
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
