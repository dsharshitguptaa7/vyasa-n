import React from 'react';
import { Navbar } from '../common/Navbar';
import { UnifiedSidebar } from './UnifiedSidebar';

export interface WorkspaceShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  currentTab?: string;
  onSelectTab?: (tabId: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WorkspaceShell: Full-viewport application layout for authenticated scholars, authorities, and managers.
 * Enforces a fixed-height container (100vh) with an independently scrolling content canvas.
 * Prevents double scrollbars and never renders the heavy marketing footer.
 */
export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  children,
  sidebar,
  currentTab = 'governance',
  onSelectTab,
  className = '',
  style,
}) => {
  const effectiveSidebar = sidebar !== undefined ? sidebar : <UnifiedSidebar activeTab={currentTab} />;

  return (
    <div
      className={`vyasa-workspace-shell ${className}`}
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
        ...style,
      }}
    >
      {/* 1. Universal Top Header (Fixed at top) */}
      <header style={{ flexShrink: 0, zIndex: 50 }}>
        <Navbar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
        />
      </header>

      {/* 2. Workspace Body: Sidebar + Main Canvas */}
      <div
        className="vyasa-workspace-body"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {effectiveSidebar && (
          <aside
            style={{
              height: '100%',
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            {effectiveSidebar}
          </aside>
        )}

        <main
          className="vyasa-workspace-canvas"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
