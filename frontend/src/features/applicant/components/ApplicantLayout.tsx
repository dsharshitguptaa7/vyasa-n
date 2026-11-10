import React from 'react';
import { WorkspaceShell } from '../../../components/layout/WorkspaceShell';
import { ApplicantSidebar } from './ApplicantSidebar';

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
 * Standardized on the global WorkspaceShell architecture with ApplicantSidebar
 * and fluid canvas scrolling. No duplicate shells or marketing footers.
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
    <WorkspaceShell
      currentTab="pillars"
      className={`vyasa-applicant-workspace-layout ${className}`.trim()}
      style={style}
      sidebar={
        <ApplicantSidebar
          activeTab={activeTab}
          onOpenProfile={onOpenProfile}
          onOpenHelp={onOpenHelp}
        />
      }
    >
      <div
        className="vyasa-applicant-main-canvas"
        style={{
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </WorkspaceShell>
  );
};
