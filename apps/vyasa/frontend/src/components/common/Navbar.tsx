import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, Button, Badge } from '@vyasa/ui';
import { InstitutionalHeader } from '@vyasa/ui/branding';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  onSignInClick?: () => void;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Ecosystem Overview' },
  { id: 'pillars', label: 'Pillars & Registry', badge: 'Contract' },
  { id: 'applicant', label: 'Applicant Portal' },
  { id: 'governance', label: 'Institutional Governance' },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentTab = 'overview',
  onSelectTab,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, isAuthority, isApplicant, displayName, logout } = useAuth();

  const handleTabSelect = (tabId: string) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    }
    navigate('/');
  };

  const handleLogoClick = () => {
    if (onSelectTab) {
      onSelectTab('overview');
    }
    navigate('/');
  };

  const handleSignOut = () => {
    const wasApplicant = isApplicant;
    logout();
    navigate(wasApplicant ? '/applicant/login' : '/authority/login');
  };

  return (
    <InstitutionalHeader
      onLogoClick={handleLogoClick}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAuthenticated ? (
            <>
              {isAuthority && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--vyasa-navy)',
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={displayName}
                  >
                    {displayName}
                  </span>
                  <Badge variant="teal" size="sm">
                    Authority
                  </Badge>
                </div>
              )}
              {isApplicant && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--vyasa-navy)',
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={displayName}
                  >
                    {displayName}
                  </span>
                  <Badge variant="saffron" size="sm">
                    Applicant
                  </Badge>
                </div>
              )}
              {isAuthority && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/authority')}
                >
                  Authority Console
                </Button>
              )}
              {isApplicant && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/applicant')}
                >
                  Scholar Workspace
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/applicant/login')}
              >
                Scholar Portal
              </Button>
              <Button
                variant="saffron"
                size="sm"
                onClick={() => navigate('/authority/login')}
              >
                Authority Sign In
              </Button>
            </>
          )}
        </div>
      }
    >
      <Navigation
        items={NAV_ITEMS}
        activeId={currentTab}
        onSelect={handleTabSelect}
      />
    </InstitutionalHeader>
  );
};
