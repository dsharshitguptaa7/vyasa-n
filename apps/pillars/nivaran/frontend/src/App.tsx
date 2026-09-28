import React, { useEffect, useState, useCallback } from 'react';
import { CsjmuLogo } from '@vyasa/ui/branding';
import { UnifiedSessionResponse, AuthorityErrorState } from './types/authority';
import { NivaranAuthService } from './services/nivaranAuthService';
import { ManagerWorkspace } from './components/ManagerWorkspace';
import { ApplicantWorkspace } from './components/ApplicantWorkspace';
import { ErrorScreen } from './components/ErrorScreen';

export const App: React.FC = () => {
  const [session, setSession] = useState<UnifiedSessionResponse | null>(null);
  const [error, setError] = useState<AuthorityErrorState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing Institutional Session Handshake...');

  const [isApplicantFlow, setIsApplicantFlow] = useState<boolean>(false);

  const getTargetRole = (): 'applicant' | 'authority' => {
    try {
      const params = new URLSearchParams(window.location.search);
      const role = params.get('role');
      if (role === 'applicant') return 'applicant';
      const storedRole = localStorage.getItem('nivaran_target_role');
      if (storedRole === 'applicant') return 'applicant';
    } catch {
      // ignore
    }
    return 'authority';
  };

  const verifyToken = useCallback(async (token: string, targetRole?: 'applicant' | 'authority') => {
    setIsLoading(true);
    const role = targetRole || getTargetRole();
    if (role === 'applicant') {
      setIsApplicantFlow(true);
      setStatusMessage('Registering you with NIVARAN...');
    } else {
      setIsApplicantFlow(false);
      setStatusMessage('Verifying Cryptographic Session with VYASA Core...');
    }
    try {
      if (role === 'applicant') {
        const applicantSession = await NivaranAuthService.fetchApplicantSession(token);
        setSession({ success: true, role_type: 'applicant', session: applicantSession });
      } else {
        const authSession = await NivaranAuthService.fetchAuthoritySession(token);
        setSession({ success: true, role_type: 'authority', session: authSession });
      }
      setError(null);
    } catch (err: unknown) {
      const errState = err as AuthorityErrorState;
      if (errState.status === 401) {
        // Token is invalid/expired in VYASA Core — clear stale token from storage
        NivaranAuthService.clearToken();
      }
      setError(errState);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initiateHandshake = useCallback(() => {
    setIsLoading(true);
    setError(null);

    // 1. Check local storage for page reloads (when not in a cross-window handoff)
    const existingToken = NivaranAuthService.getToken();
    if (existingToken && !window.opener) {
      verifyToken(existingToken);
      return;
    }
    if (existingToken && window.opener) {
      // Cross-window handoff: attempt to verify existing token, but keep postMessage listener active
      verifyToken(existingToken);
    }

    // 2. No existing token; listen for postMessage from VYASA console
    setStatusMessage('Awaiting VYASA Institutional Session Handshake...');

    let resolved = false;

    const handleMessage = (event: MessageEvent) => {
      // Strict origin validation
      if (event.origin !== 'http://localhost:5173') return;

      if (event.data?.type === 'VYASA_SESSION_TOKEN' && typeof event.data.token === 'string') {
        resolved = true;
        const receivedToken = event.data.token;
        const role = event.data.role === 'applicant' ? 'applicant' : getTargetRole();
        if (role === 'applicant') {
          try {
            localStorage.setItem('nivaran_target_role', 'applicant');
          } catch {
            // ignore
          }
        }
        NivaranAuthService.setToken(receivedToken);
        verifyToken(receivedToken, role);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request session from opener if present
    if (window.opener) {
      try {
        window.opener.postMessage({ type: 'REQUEST_VYASA_SESSION' }, 'http://localhost:5173');
      } catch {
        // Opener might be cross-origin or blocked
      }
    }

    // Set fallback timeout if no message is received
    const timeout = setTimeout(() => {
      if (!resolved) {
        window.removeEventListener('message', handleMessage);
        setIsLoading(false);
        setError({
          code: 'MISSING_TOKEN',
          status: 401,
          message: 'No institutional session token provided.',
          detail: 'Session handoff timed out. Please launch NIVARAN from the VYASA Authority Console.',
        });
      }
    }, 2500);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
    };
  }, [verifyToken]);

  useEffect(() => {
    const cleanup = initiateHandshake();
    return cleanup;
  }, [initiateHandshake]);

  if (isLoading) {
    if (isApplicantFlow) {
      const steps = [
        { num: 1, label: 'Verifying VYASA identity' },
        { num: 2, label: 'Fetching applicant profile' },
        { num: 3, label: 'Registering applicant in NIVARAN' },
        { num: 4, label: 'Synchronizing academic affiliation' },
        { num: 5, label: 'Preparing grievance workspace' },
      ];

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--vyasa-ivory, #FAF8F5)',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 8px 24px rgba(27, 42, 74, 0.08)',
              padding: '36px 32px',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <CsjmuLogo size={60} />
            </div>
            <h2
              style={{
                fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
                color: 'var(--vyasa-navy, #1B2A4A)',
                fontSize: '22px',
                margin: '0 0 6px',
                fontWeight: 700,
              }}
            >
              NIVARAN Grievance Redressal
            </h2>
            <p
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--vyasa-navy, #1B2A4A)',
                margin: '0 0 4px',
              }}
            >
              Registering you with NIVARAN
            </p>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--vyasa-text-muted, #64748B)',
                margin: '0 0 24px',
              }}
            >
              Synchronizing institutional records &amp; JIT domain profile...
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                textAlign: 'left',
                backgroundColor: 'var(--vyasa-ivory, #FAF8F5)',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #EDE8E1',
                marginBottom: '20px',
              }}
            >
              {steps.map((step) => (
                <div
                  key={step.num}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '13px',
                    color: 'var(--vyasa-navy, #1B2A4A)',
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--vyasa-navy, #1B2A4A)',
                      color: 'var(--vyasa-gold, #D4A017)',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {step.num}
                  </span>
                  <span style={{ fontWeight: 500 }}>{step.label}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                fontSize: '13px',
                color: 'var(--vyasa-text-secondary, #475569)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#D4A017',
                }}
              />
              <span>{statusMessage}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--vyasa-ivory, #FAF8F5)',
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '20px' }}>
            <CsjmuLogo size={64} />
          </div>
          <h2
            style={{
              fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
              color: 'var(--vyasa-navy, #1B2A4A)',
              fontSize: '22px',
              margin: '0 0 10px',
            }}
          >
            NIVARAN Grievance Redressal
          </h2>
          <div
            style={{
              fontSize: '14px',
              color: 'var(--vyasa-text-secondary, #475569)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>{statusMessage}</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={initiateHandshake} />;
  }

  if (session) {
    if (session.role_type === 'applicant') {
      return <ApplicantWorkspace session={session.session} />;
    }
    return <ManagerWorkspace session={session.session} />;
  }

  return null;
};

export default App;
