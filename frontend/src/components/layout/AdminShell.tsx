import React from 'react';
import { WorkspaceShell } from './WorkspaceShell';
import { AdminSidebar } from '../../admin/components/AdminSidebar';

export interface AdminShellProps {
  children: React.ReactNode;
  activeTab?: string;
  onAddAuthority?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * AdminShell: Dedicated shell for Central Administration and CMS consoles.
 * Built on WorkspaceShell foundation with AdminSidebar and fluid canvas scrolling.
 * Zero marketing footers, no duplicate layout nesting.
 */
export const AdminShell: React.FC<AdminShellProps> = ({
  children,
  activeTab,
  onAddAuthority,
  className = '',
  style,
}) => {
  return (
    <WorkspaceShell
      currentTab="governance"
      className={`vyasa-admin-shell ${className}`}
      style={style}
      sidebar={
        <AdminSidebar
          activeTab={activeTab}
          onAddAuthority={onAddAuthority}
        />
      }
    >
      <div
        className="vyasa-admin-canvas-inner"
        style={{
          padding: '20px 24px 48px 24px',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </WorkspaceShell>
  );
};
