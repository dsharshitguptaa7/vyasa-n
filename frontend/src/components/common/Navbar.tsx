import React from 'react';
import { useNavigate } from 'react-router-dom';
import { InstitutionalHeader } from '@vyasa/ui/branding';
import { useAuth } from '../../context/AuthContext';
import { PublicNavbar } from './PublicNavbar';
import { NotificationBellMenu } from '../../features/notifications';

interface NavbarProps {
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  onSignInClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab = 'overview',
  onSelectTab,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();

  // =========================================================================
  // UNIFIED AUTHENTICATED HEADER SYSTEM (Across all pillars & roles)
  // Authenticated top navbar contains ONLY:
  // - Institutional / VYASA branding
  // - Notification bell with unread badge
  // No navigation menus, service dropdowns, profile menus, or logout buttons.
  // =========================================================================
  if (isAuthenticated) {
    return (
      <div className="vyasa-authenticated-header-wrapper" style={{ position: 'sticky', top: 0, zIndex: 60 }}>
        <InstitutionalHeader
          authenticatedMode={true}
          onLogoClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
          actions={<NotificationBellMenu />}
        />
      </div>
    );
  }

  // =========================================================================
  // PUBLIC ECOSYSTEM SHELL (when unauthenticated)
  // =========================================================================
  return (
    <PublicNavbar
      currentTab={currentTab}
      onSelectTab={onSelectTab}
    />
  );
};
