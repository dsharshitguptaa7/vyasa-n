import React from 'react';
import { ApplicantSidebar } from './ApplicantSidebar';

export interface ApplicantLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

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
        display: 'flex',
        minHeight: 'calc(100vh - 70px)',
        backgroundColor: '#fcfbfa',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
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
          padding: '20px 28px 48px 28px',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        {children}
      </main>
    </div>
  );
};
