import React from 'react';
import { VyasaPortalSidebar, VyasaPortalSidebarProps } from './VyasaPortalSidebar';

export interface VyasaPortalLayoutProps extends VyasaPortalSidebarProps {
  children: React.ReactNode;
}

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
        display: 'flex',
        minHeight: 'calc(100vh - 70px)',
        backgroundColor: '#fcfbfa',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <VyasaPortalSidebar
        activeItem={activeItem}
        onSelectProfile={onSelectProfile}
        onSelectHelp={onSelectHelp}
        onSelectSettings={onSelectSettings}
      />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: '24px 28px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
};
