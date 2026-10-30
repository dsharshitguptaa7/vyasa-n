import React from 'react';
import { Navbar } from '../common/Navbar';
import { Footer } from '../common/Footer';
import { useAuth } from '../../context/AuthContext';
import { WorkspaceShell } from './WorkspaceShell';

export interface PublicShellProps {
  children: React.ReactNode;
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  onSignInClick?: () => void;
  hideFooter?: boolean;
}

/**
 * PublicShell: Dedicated shell for public marketing, institutional, and unauthenticated views.
 * When visited by an authenticated user (scholar, authority, or administrator), seamlessly integrates
 * into the unified WorkspaceShell to preserve the single persistent university header and left sidebar
 * without duplicate navigation or marketing footers.
 */
export const PublicShell: React.FC<PublicShellProps> = ({
  children,
  currentTab = 'overview',
  onSelectTab,
  onSignInClick,
  hideFooter = false,
}) => {
  let isAuthenticated = false;
  try {
    const auth = useAuth();
    isAuthenticated = !!auth?.isAuthenticated;
  } catch {
    // fallback in isolated tests
  }

  if (isAuthenticated) {
    return (
      <WorkspaceShell currentTab={currentTab} onSelectTab={onSelectTab}>
        {children}
      </WorkspaceShell>
    );
  }

  return (
    <div
      className="vyasa-public-shell"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
      }}
    >
      <Navbar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        onSignInClick={onSignInClick}
      />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {children}
      </main>
      {!hideFooter && <Footer onSelectTab={onSelectTab} />}
    </div>
  );
};
