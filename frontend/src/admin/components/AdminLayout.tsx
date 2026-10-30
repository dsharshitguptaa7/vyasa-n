import React from 'react';
import { AdminSidebar } from './AdminSidebar';
import { Navbar } from '../../components/common/Navbar';

export interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onAddAuthority?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * AdminLayout (AdminShell): Central administration workspace layout.
 * Provides a fixed 100vh viewport application layout with stable Navbar and AdminSidebar,
 * and an independently scrolling main content canvas. No marketing footer.
 */
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
        height: '100vh',
        maxHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--vyasa-ivory, #faf7f2)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* 1. Universal Top Header (Fixed at top) */}
      <header style={{ flexShrink: 0, zIndex: 50 }}>
        <Navbar currentTab="governance" />
      </header>

      {/* 2. Admin Workspace Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <AdminSidebar activeTab={activeTab} onAddAuthority={onAddAuthority} />
        <main
          className="vyasa-admin-main-canvas"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            padding: '20px 24px 48px 24px',
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
