import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Button, Input, PageContainer } from '@vyasa/ui';
import { CsjmuLogo } from '@vyasa/ui/branding';

interface LocationState {
  from?: {
    pathname: string;
  };
  registrationSuccess?: boolean;
  email?: string;
}

export const AuthorityLoginPage: React.FC = () => {
  const { login, isAuthenticated, isAuthority, isApplicant, isLoading } = useAuth();
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

  // If already authenticated with authority or applicant role, redirect accordingly
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (isAuthority) {
        const fromPath = (location.state as LocationState)?.from?.pathname;
        navigate(fromPath || '/authority', { replace: true });
      } else if (isApplicant) {
        const fromPath = (location.state as LocationState)?.from?.pathname;
        navigate(fromPath || '/applicant', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, isAuthority, isApplicant, isLoading, navigate, location.state]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // Navigation is triggered by the useEffect upon authentication state update
    } catch (err: unknown) {
      const errorObj = err as {
        status?: number;
        code?: string;
        message?: string;
        response?: { data?: { message?: string } };
      };

      if (errorObj?.status === 401 || errorObj?.code === 'UNAUTHORIZED' || errorObj?.code === 'INVALID_CREDENTIALS') {
        setLoginError('Invalid institutional credentials. Please verify your email and password.');
      } else if (errorObj?.status === 403) {
        setLoginError('Your account does not possess institutional authorization for this console.');
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
    <PageContainer narrow style={{ padding: '60px 0 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '16px' }}>
          <CsjmuLogo size={64} />
        </div>
        <h1
          style={{
            fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
            fontSize: '28px',
            color: 'var(--vyasa-navy)',
            margin: '0 0 8px',
            fontWeight: 700,
          }}
        >
          Institutional Authority Console
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--vyasa-text-secondary)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Chhatrapati Shahu Ji Maharaj University, Kanpur &bull; VYASA Ecosystem Gateway
        </p>
      </div>

      <Card
        variant="scholarly"
        title="Institutional Sign In"
        subtitle="Authenticate with your verified university credentials"
        headerAction={<Badge variant="teal">Institutional</Badge>}
      >
        <form onSubmit={handleSubmit} noValidate style={{ padding: '16px 0 8px' }}>
          {successBanner && (
            <div
              role="status"
              style={{
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                border: '1px solid rgba(40, 167, 69, 0.4)',
                borderRadius: '6px',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#155724',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontWeight: 700 }}>✓</span>
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
                fontSize: '14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <span style={{ fontWeight: 600 }}>&bull;</span>
              <span style={{ flex: 1 }}>{loginError}</span>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <Input
              id="authority-email"
              label="Institutional Email"
              placeholder="e.g. ankit.trivedi@nivaran.local"
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
              id="authority-password"
              label="Security Credential"
              placeholder="Enter institutional password"
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {submitting ? 'Verifying Credentials...' : 'Sign In as Authority'}
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

          <div
            style={{
              marginTop: '28px',
              paddingTop: '20px',
              borderTop: '1px solid var(--vyasa-border)',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--vyasa-text-muted)',
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: '0 0 6px' }}>
              <strong>Institutional Access Protocol</strong>
            </p>
            <p style={{ margin: 0 }}>
              This console is strictly restricted to authorized university administrative officers,
              deans, and academic governance personnel. Access is authenticated via the VYASA Core Identity Authority.
            </p>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
};
