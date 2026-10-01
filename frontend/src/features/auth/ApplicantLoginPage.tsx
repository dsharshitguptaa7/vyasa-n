import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Button, Input, PageContainer, AppIcon } from '@vyasa/ui';
import { CsjmuLogo } from '@vyasa/ui/branding';
import { VYASAWisdomModal } from '../../components/common/VYASAWisdomModal';
import { getNextWisdomShloka } from '../../services/wisdomService';
import { VedaShloka } from '../../types/wisdom';

import './Auth.css';

interface LocationState {
  from?: {
    pathname: string;
  };
  registrationSuccess?: boolean;
  email?: string;
}

export const ApplicantLoginPage: React.FC = () => {
  const { login, isAuthenticated, isApplicant, isAuthority, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as LocationState | null;
  const [email, setEmail] = useState(locationState?.email || '');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(
    locationState?.registrationSuccess
      ? 'Registration successful! You may now sign in with your credentials.'
      : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [wisdomShloka, setWisdomShloka] = useState<VedaShloka | null>(null);
  const [showWisdom, setShowWisdom] = useState(false);
  const pendingDestinationRef = useRef<string | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // If already authenticated with applicant role on initial visit, redirect to canonical /dashboard
  useEffect(() => {
    // If a login submission is actively in progress or Wisdom is showing, do not auto-redirect
    if (isSubmittingRef.current || showWisdom) {
      return;
    }

    if (isAuthenticated && !isLoading) {
      if (isApplicant) {
        const fromPath = (location.state as LocationState)?.from?.pathname;
        if (fromPath && fromPath !== '/applicant/login' && fromPath !== '/login' && fromPath !== '/applicant') {
          navigate(fromPath, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else if (isAuthority) {
        queueMicrotask(() => {
          setLoginError(
            'Access restricted: This account possesses institutional authority privileges. Please sign in via the Institutional Authority Console.'
          );
        });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, isApplicant, isAuthority, isLoading, navigate, location.state, showWisdom]);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Institutional email address is required.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid institutional email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Institutional credential password is required.');
      isValid = false;
    }

    return isValid;
  };

  const handleDismissWisdom = () => {
    setShowWisdom(false);
    isSubmittingRef.current = false;
    const dest = pendingDestinationRef.current || '/dashboard';
    navigate(dest, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!validate()) {
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    // Determine resolved destination
    const fromPath = (location.state as LocationState)?.from?.pathname;
    const destination =
      fromPath && fromPath !== '/applicant/login' && fromPath !== '/login' && fromPath !== '/applicant'
        ? fromPath
        : '/dashboard';
    pendingDestinationRef.current = destination;

    // Concurrently pre-load Wisdom shloka to eliminate latency gap
    const wisdomPromise = getNextWisdomShloka().catch((err) => {
      console.warn('[VYASA Wisdom] Non-blocking shloka pre-fetch error:', err);
      return null;
    });

    try {
      await login(email.trim(), password);

      // Await the pre-fetched shloka
      const shloka = await wisdomPromise;
      if (shloka) {
        setWisdomShloka(shloka);
        setShowWisdom(true);
        return;
      }

      // If shloka unavailable or failed, navigate directly
      isSubmittingRef.current = false;
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      const errorObj = err as {
        status?: number;
        code?: string;
        message?: string;
        response?: { data?: { message?: string } };
      };

      if (errorObj?.status === 401 || errorObj?.code === 'UNAUTHORIZED' || errorObj?.code === 'INVALID_CREDENTIALS') {
        setLoginError('Invalid institutional credentials. Please verify your email and password.');
      } else if (errorObj?.status === 403) {
        setLoginError('Your account does not possess scholar authorization for this workspace.');
      } else if (errorObj?.message?.toLowerCase().includes('network') || errorObj?.code === 'NETWORK_ERROR') {
        setLoginError('Unable to reach the institutional authentication gateway. Please check network connectivity.');
      } else if (errorObj?.message) {
        setLoginError(errorObj.message);
      } else {
        setLoginError('An unexpected error occurred during institutional verification. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {wisdomShloka && (
        <VYASAWisdomModal
          shloka={wisdomShloka}
          isOpen={showWisdom}
          onContinue={handleDismissWisdom}
          onSkip={handleDismissWisdom}
        />
      )}
      <PageContainer narrow className="vyasa-auth-page-container">
        {/* Institutional Masthead Header */}
        <div className="vyasa-auth-masthead">
          <div className="vyasa-auth-seal-wrap">
            <CsjmuLogo size={62} />
          </div>
          <h1 className="vyasa-auth-page-title">
            Applicant Login
          </h1>
          <p className="vyasa-auth-page-subtitle">
            Chhatrapati Shahu Ji Maharaj University, Kanpur &bull; VYASA Ecosystem Gateway
          </p>
        </div>

        <Card
          className="vyasa-auth-card vyasa-auth-card--applicant"
          title="Applicant Sign In"
          subtitle="Authenticate with your verified doctoral scholar credentials"
          headerAction={<Badge variant="saffron">Applicant</Badge>}
        >
          <form onSubmit={handleSubmit} noValidate>
            {successBanner && (
              <div
                role="status"
                style={{
                  backgroundColor: 'rgba(40, 167, 69, 0.08)',
                  border: '1px solid rgba(40, 167, 69, 0.35)',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  color: '#155724',
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AppIcon name="check-circle" size={16} color="#155724" />
                <span style={{ flex: 1 }}>{successBanner}</span>
              </div>
            )}

            {loginError && (
              <div
                role="alert"
                style={{
                  backgroundColor: 'rgba(217, 83, 79, 0.08)',
                  border: '1px solid rgba(217, 83, 79, 0.3)',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  color: '#c9302c',
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <span style={{ fontWeight: 700 }}>&bull;</span>
                <span style={{ flex: 1 }}>{loginError}</span>
              </div>
            )}

            <div style={{ marginBottom: '18px' }}>
              <Input
                id="applicant-login-email"
                label="Institutional Email"
                placeholder="e.g. scholar@csjmu.ac.in"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                  if (loginError) setLoginError(null);
                  if (successBanner) setSuccessBanner(null);
                }}
                error={emailError}
                disabled={submitting}
                required
                autoComplete="username"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <Input
                id="applicant-login-password"
                label="Security Credential"
                placeholder="Enter your password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                  if (loginError) setLoginError(null);
                  if (successBanner) setSuccessBanner(null);
                }}
                error={passwordError}
                disabled={submitting}
                required
                autoComplete="current-password"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {submitting ? 'Verifying Credentials...' : 'Sign In as Applicant'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/applicant/register')}
                disabled={submitting}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                New Applicant? Register here &rarr;
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/')}
                disabled={submitting}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                &larr; Return to Ecosystem Overview
              </Button>
            </div>

            <div className="vyasa-auth-protocol">
              <div className="vyasa-auth-protocol-title">
                <AppIcon name="shield" size={13} color="var(--vyasa-primary)" />
                <span>Doctoral Scholar Access Protocol</span>
              </div>
              <p style={{ margin: 0 }}>
                This portal is designated for registered doctoral research scholars and applicants. Access is authenticated via the central VYASA Core Identity Authority.
              </p>
            </div>
          </form>
        </Card>
      </PageContainer>
    </>
  );
};
