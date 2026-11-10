import React from 'react';
import { AdminShell } from '../../components/layout/AdminShell';

export interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onAddAuthority?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * AdminLayout (AdminShell): Central administration workspace layout.
 * Standardized on the global WorkspaceShell architecture with AdminSidebar
 * and fluid canvas scrolling. No duplicate shells or marketing footers.
 */
export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeTab,
  onAddAuthority,
  className = '',
  style,
}) => {
  return (
    <AdminShell
      activeTab={activeTab}
      onAddAuthority={onAddAuthority}
      className={`vyasa-admin-layout ${className}`.trim()}
      style={style}
    >
      {children}
    </AdminShell>
  );
};
