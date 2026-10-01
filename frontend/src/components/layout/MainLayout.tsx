import React from 'react';
import { Navbar } from '../common/Navbar';
import { Footer } from '../common/Footer';

interface MainLayoutProps {
  children: React.ReactNode;
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  onSignInClick?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  currentTab,
  onSelectTab,
  onSignInClick,
}) => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        onSignInClick={onSignInClick}
      />
      <main style={{ flex: 1, paddingBottom: '48px' }}>{children}</main>
      <Footer onSelectTab={onSelectTab} />
    </div>
  );
};
