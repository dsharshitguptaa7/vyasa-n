import React from 'react';
import { UnifiedSidebar } from '../../../components/layout/UnifiedSidebar';
import { Navbar } from '../../../components/common/Navbar';

export interface VyasaPortalLayoutProps {
  children: React.ReactNode;
  activeItem?: 'dashboard' | 'profile' | 'services' | 'notifications' | 'settings' | 'help' | string;
  onSelectProfile?: () => void;
  onSelectHelp?: () => void;
  onSelectSettings?: () => void;
  className?: string;
}

/**
 * VyasaPortalLayout (WorkspaceShell): Authenticated portal workspace layout.
 * Provides a fixed 100vh application shell with stable Navbar and UnifiedSidebar,
 * and an independently scrolling main content canvas. No marketing footer.
 */
export const VyasaPortalLayout: React.FC<VyasaPortalLayoutProps> = ({
  children,
  activeItem = 'dashboard',
  onSelectProfile,
  onSelectHelp,
  onSelectSettings,
  className = '',
}) => {
  return (
    <div
      className={`vyasa-portal-workspace-layout ${className}`}
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--vyasa-ivory, #faf7f2)',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Universal Top Header (Fixed at top) */}
      <header style={{ flexShrink: 0, zIndex: 50 }}>
        <Navbar currentTab="governance" />
      </header>

      {/* 2. Portal Workspace Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <UnifiedSidebar
          activeItem={activeItem}
          activeTab={activeItem}
          onSelectProfile={onSelectProfile}
          onOpenProfile={onSelectProfile}
          onSelectHelp={onSelectHelp}
          onOpenHelp={onSelectHelp}
          onSelectSettings={onSelectSettings}
        />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            padding: '24px 28px',
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
