import React from 'react';
import { AdminSidebar } from './AdminSidebar';

export interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onAddAuthority?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeTab,
  onAddAuthority,
  className = '',
  style,
}) => {
  return (
    <div
      className={`vyasa-admin-layout ${className}`}
      style={{
        display: 'flex',
        minHeight: 'calc(100vh - 70px)',
        backgroundColor: '#f8fafc',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <AdminSidebar activeTab={activeTab} onAddAuthority={onAddAuthority} />
      <main
        className="vyasa-admin-main-canvas"
        style={{
          flex: 1,
          minWidth: 0,
          padding: '20px 24px 48px 24px',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        {children}
      </main>
    </div>
  );
};
