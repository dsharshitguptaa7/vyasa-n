import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { VedicInvocation, hasInvocationCompleted } from './VedicInvocation';

export interface VedicInvocationWrapperProps {
  children: React.ReactNode;
  /**
   * Optional override for automated tests
   */
  forceShow?: boolean;
}

/**
 * VedicInvocationWrapper
 *
 * Wraps the top-level application routing tree.
 * On the initial application load in a browser session, mounts the full-screen
 * VedicInvocation overlay while the application and authentication layer initialize
 * asynchronously in the background.
 *
 * Once initialization is complete and the minimum invocation sequence has played,
 * the overlay smoothly fades out, revealing the target view (e.g. /dashboard for
 * authenticated users, or the ecosystem landing page for public users).
 *
 * Subsequent internal route navigations (e.g. Dashboard -> Services -> Nivaran)
 * do NOT replay the invocation, ensuring optimal, immediate responsiveness.
 */
export const VedicInvocationWrapper: React.FC<VedicInvocationWrapperProps> = ({
  children,
  forceShow = false,
}) => {
  const { isLoading } = useAuth();
  const [showOverlay, setShowOverlay] = useState<boolean>(() => {
    if (forceShow) return true;
    return !hasInvocationCompleted();
  });

  const handleComplete = () => {
    setShowOverlay(false);
  };

  return (
    <>
      {showOverlay && (
        <VedicInvocation
          isAppReady={!isLoading}
          onComplete={handleComplete}
          forceShow={forceShow}
        />
      )}
      {children}
    </>
  );
};

export default VedicInvocationWrapper;
