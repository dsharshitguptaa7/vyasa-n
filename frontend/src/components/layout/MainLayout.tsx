import React from 'react';
import { Navbar } from '../common/Navbar';
import { Footer } from '../common/Footer';

interface MainLayoutProps {
  children: React.ReactNode;
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  onSignInClick?: () => void;
  hideFooter?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  currentTab,
  onSelectTab,
  onSignInClick,
  hideFooter = false,
}) => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        onSignInClick={onSignInClick}
      />
      <main style={{ flex: 1, paddingBottom: hideFooter ? '0px' : '48px' }}>{children}</main>
      {!hideFooter && <Footer onSelectTab={onSelectTab} />}
    </div>
  );
};
