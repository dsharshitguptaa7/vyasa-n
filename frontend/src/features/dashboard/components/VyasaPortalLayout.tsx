import React from 'react';
import { WorkspaceShell } from '../../../components/layout/WorkspaceShell';
import { UnifiedSidebar } from '../../../components/layout/UnifiedSidebar';

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
 * Standardized on the global WorkspaceShell architecture with UnifiedSidebar
 * and fluid canvas scrolling. No duplicate shells or marketing footers.
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
    <WorkspaceShell
      currentTab="governance"
      className={`vyasa-portal-workspace-layout ${className}`.trim()}
      sidebar={
        <UnifiedSidebar
          activeItem={activeItem}
          activeTab={activeItem}
          onSelectProfile={onSelectProfile}
          onOpenProfile={onSelectProfile}
          onSelectHelp={onSelectHelp}
          onOpenHelp={onSelectHelp}
          onSelectSettings={onSelectSettings}
        />
      }
    >
      <div
        style={{
          boxSizing: 'border-box',
          minWidth: 0,
          width: '100%',
        }}
      >
        {children}
      </div>
    </WorkspaceShell>
  );
};
