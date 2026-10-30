import React from 'react';
import { ApplicantSidebar } from './ApplicantSidebar';
import { Navbar } from '../../../components/common/Navbar';

export interface ApplicantLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ApplicantLayout (WorkspaceShell): Scholar/Applicant workspace layout.
 * Enforces a fixed 100vh application shell with stable Navbar and ApplicantSidebar,
 * and an independently scrolling main content canvas. No marketing footer.
 */
export const ApplicantLayout: React.FC<ApplicantLayoutProps> = ({
  children,
  activeTab = 'my-grievances',
  onOpenProfile,
  onOpenHelp,
  className = '',
  style,
}) => {
  return (
    <div
      className={`vyasa-applicant-workspace-layout ${className}`}
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
        <Navbar currentTab="pillars" />
      </header>

      {/* 2. Applicant Workspace Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <ApplicantSidebar
          activeTab={activeTab}
          onOpenProfile={onOpenProfile}
          onOpenHelp={onOpenHelp}
        />
        <main
          className="vyasa-applicant-main-canvas"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            padding: '20px 28px 48px 28px',
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
