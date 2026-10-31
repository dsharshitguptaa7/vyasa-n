import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Button, Input, PageContainer, AppIcon } from '@vyasa/ui';
import { CsjmuLogo } from '@vyasa/ui/branding';
import { VYASAWisdomModal } from '../../components/common/VYASAWisdomModal';
import { getNextWisdomShloka } from '../../services/wisdomService';
import { twoFactorService } from '../../services/twoFactorService';
import { authService } from '../../services/authService';
import { VedaShloka } from '../../types/wisdom';
import { TokenResponse, TwoFactorSetupDetails } from '../../types/auth';

import './Auth.css';

interface LocationState {
  from?: {
    pathname: string;
  };
  registrationSuccess?: boolean;
  email?: string;
  challenge_id?: string;
  two_factor_setup_required?: boolean;
}

type AuthStep = 'credentials' | 'password-change' | 'verify' | 'enrollment' | 'recovery' | 'recovery-display';

export const AuthorityLoginPage: React.FC = () => {
  const auth = useAuth();
  const { login, completeTwoFactorAuth, isAuthenticated, isLoading } = auth;
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as LocationState | null;

  // Step state
  const [step, setStep] = useState<AuthStep>('credentials');
  const [challengeId, setChallengeId] = useState<string>('');

  // Step 1: Credentials
  const [email, setEmail] = useState(locationState?.email || '');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Mandatory First-Login Password Change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2 & Enrollment: TOTP Code
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState('');

  // Enrollment Setup Data
  const [setupDetails, setSetupDetails] = useState<TwoFactorSetupDetails | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Recovery Codes Display after Enrollment
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedRecovery, setCopiedRecovery] = useState(false);
  const [confirmedRecovery, setConfirmedRecovery] = useState(false);
  const pendingTokenRef = useRef<TokenResponse | null>(null);

  // Recovery Code Verification
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  // Shared UI Feedback
  const [loginError, setLoginError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(
    locationState?.registrationSuccess
      ? 'Registration successful! You may now sign in with your credentials.'
      : null
  );
  const [submitting, setSubmitting] = useState(false);

  // Wisdom Modal
  const [wisdomShloka, setWisdomShloka] = useState<VedaShloka | null>(null);
  const [showWisdom, setShowWisdom] = useState(false);
  const pendingDestinationRef = useRef<string | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Check stored challenge or location state on mount
  useEffect(() => {
    let cid = locationState?.challenge_id;
    let setupReq = locationState?.two_factor_setup_required;

    if (!cid) {
      const stored = twoFactorService.getStoredChallenge();
      if (stored) {
        cid = stored.challenge_id;
        setupReq = stored.two_factor_setup_required;
      }
    }

    if (cid) {
      setChallengeId(cid);
      if (setupReq) {
        setStep('enrollment');
        loadSetupData(cid);
      } else {
        setStep('verify');
      }
    }
  }, [locationState]);

  // If already fully authenticated, redirect
  useEffect(() => {
    if (isSubmittingRef.current || showWisdom) {
      return;
    }

    if (isAuthenticated && !isLoading) {
      const fromPath = (location.state as LocationState)?.from?.pathname;
      if (
        fromPath &&
        fromPath !== '/authority/login' &&
        fromPath !== '/login' &&
        fromPath !== '/authority' &&
        fromPath !== '/applicant'
      ) {
        navigate(fromPath, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate, location.state, showWisdom]);

  const loadSetupData = async (cid: string) => {
    setLoadingSetup(true);
    setLoginError(null);
    try {
      const data = await twoFactorService.getSetupDetails(cid);
      setSetupDetails(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load enrollment configuration.';
      setLoginError(msg);
    } finally {
      setLoadingSetup(false);
    }
  };

  const validateCredentials = (): boolean => {
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

  const proceedWithFinalSession = async (tokenRes: TokenResponse) => {
    const fromPath = (location.state as LocationState)?.from?.pathname;
    const destination =
      fromPath &&
      fromPath !== '/authority/login' &&
      fromPath !== '/login' &&
      fromPath !== '/authority' &&
      fromPath !== '/applicant'
        ? fromPath
        : '/dashboard';
    pendingDestinationRef.current = destination;

    const wisdomPromise = getNextWisdomShloka().catch((err) => {
      console.warn('[VYASA Wisdom] Non-blocking shloka pre-fetch error:', err);
      return null;
    });

    try {
      await completeTwoFactorAuth(tokenRes);

      const shloka = await wisdomPromise;
      if (shloka) {
        setWisdomShloka(shloka);
        setShowWisdom(true);
        return;
      }

      isSubmittingRef.current = false;
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      const msg = err instanceof Error ? err.message : 'Session initialization failed.';
      setLoginError(msg);
    }
  };

  // 1. Submit Credentials (Step 1)
  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!validateCredentials()) {
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const res = await login(email.trim(), password);

      if (res?.requires_password_change && res.challenge_id) {
        setChallengeId(res.challenge_id);
        setPassword('');
        setStep('password-change');
        isSubmittingRef.current = false;
        return;
      }

      if (res?.requires_two_factor && res.challenge_id) {
        setChallengeId(res.challenge_id);
        twoFactorService.setStoredChallenge({
          challenge_id: res.challenge_id,
          two_factor_setup_required: Boolean(res.two_factor_setup_required),
        });

        if (res.two_factor_setup_required) {
          setStep('enrollment');
          loadSetupData(res.challenge_id);
        } else {
          setStep('verify');
        }
        isSubmittingRef.current = false;
        return;
      }

      // If directly authenticated (e.g. applicant or direct session)
      if (res?.access_token) {
        await proceedWithFinalSession(res);
      }
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      const errorObj = err as {
        status?: number;
        code?: string;
        message?: string;
      };

      if (errorObj?.status === 401 || errorObj?.code === 'UNAUTHORIZED') {
        setLoginError("We couldn't sign you in. Please check your institutional email and password.");
      } else if (errorObj?.status === 403) {
        setLoginError('Your institutional account has been deactivated or does not possess authority access.');
      } else if (errorObj?.status === 429) {
        setLoginError('Too many failed sign-in attempts. Your account is temporarily locked for security. Please try again in 15 minutes.');
      } else if (errorObj?.message?.toLowerCase().includes('network')) {
        setLoginError('Unable to connect to the server. Please verify your internet connection.');
      } else if (errorObj?.message) {
        setLoginError(errorObj.message);
      } else {
        setLoginError('An unexpected error occurred while signing in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 1b. Submit Mandatory First-Login Permanent Password
  const validatePermanentPassword = (): boolean => {
    let isValid = true;
    setNewPasswordError('');
    setConfirmPasswordError('');

    if (!newPassword) {
      setNewPasswordError('Permanent password is required.');
      isValid = false;
    } else if (newPassword.length < 8) {
      setNewPasswordError('Password must be at least 8 characters long.');
      isValid = false;
    } else if (!/[A-Z]/.test(newPassword)) {
      setNewPasswordError('Password must contain at least one uppercase letter.');
      isValid = false;
    } else if (!/[a-z]/.test(newPassword)) {
      setNewPasswordError('Password must contain at least one lowercase letter.');
      isValid = false;
    } else if (!/\d/.test(newPassword)) {
      setNewPasswordError('Password must contain at least one number.');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your permanent password.');
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      isValid = false;
    }

    return isValid;
  };

  const handleSetPermanentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!validatePermanentPassword()) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.setPermanentPassword(challengeId, newPassword, confirmPassword);
      setNewPassword('');
      setConfirmPassword('');

      if (res?.requires_two_factor && res.challenge_id) {
        setChallengeId(res.challenge_id);
        twoFactorService.setStoredChallenge({
          challenge_id: res.challenge_id,
          two_factor_setup_required: Boolean(res.two_factor_setup_required),
        });

        if (res.two_factor_setup_required) {
          setStep('enrollment');
          loadSetupData(res.challenge_id);
        } else {
          setStep('verify');
        }
        return;
      }

      if (res?.access_token) {
        await proceedWithFinalSession(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set permanent password.';
      setLoginError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Verify Standard TOTP Code (Step 2)
  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setTotpError('');

    const cleanCode = totpCode.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setTotpError('Please enter the 6-digit verification code from your authenticator.');
      return;
    }

    setSubmitting(true);
    isSubmittingRef.current = true;

    try {
      const res = await twoFactorService.verifyLogin(challengeId, cleanCode);
      await proceedWithFinalSession(res);
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      const msg = err instanceof Error ? err.message : 'Invalid or expired verification code.';
      setLoginError(msg);
      setTotpCode('');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Confirm Initial Enrollment TOTP Code
  const handleConfirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setTotpError('');

    const cleanCode = totpCode.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setTotpError('Please enter the 6-digit code shown in your authenticator app.');
      return;
    }

    setSubmitting(true);
    isSubmittingRef.current = true;

    try {
      const res = await twoFactorService.confirmSetup(challengeId, cleanCode);
      if (res.recovery_codes && res.recovery_codes.length > 0) {
        pendingTokenRef.current = res;
        setRecoveryCodes(res.recovery_codes);
        setStep('recovery-display');
        isSubmittingRef.current = false;
      } else {
        await proceedWithFinalSession(res);
      }
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      const msg = err instanceof Error ? err.message : 'Invalid code. Please ensure your device clock is synchronized.';
      setLoginError(msg);
      setTotpCode('');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Verify Single-Use Backup Recovery Code
  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setRecoveryError('');

    const cleanCode = recoveryCode.trim();
    if (!cleanCode) {
      setRecoveryError('Please enter an emergency recovery code.');
      return;
    }

    setSubmitting(true);
    isSubmittingRef.current = true;

    try {
      const res = await twoFactorService.verifyRecovery(challengeId, cleanCode);
      await proceedWithFinalSession(res);
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      const msg = err instanceof Error ? err.message : 'Invalid or already consumed recovery code.';
      setLoginError(msg);
      setRecoveryCode('');
    } finally {
      setSubmitting(false);
    }
  };

  // Copy manual key
  const handleCopySetupKey = () => {
    if (!setupDetails?.manual_setup_key) return;
    navigator.clipboard.writeText(setupDetails.manual_setup_key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Copy all recovery codes
  const handleCopyAllRecoveryCodes = () => {
    if (!recoveryCodes.length) return;
    const text =
      `VYASA-N Institutional Two-Factor Recovery Codes\nGenerated On: ${new Date().toLocaleString()}\n\n` +
      recoveryCodes.map((code, idx) => `${idx + 1}. ${code}`).join('\n') +
      '\n\nStore these codes securely. Each code is single-use and will be invalidated once consumed.';
    navigator.clipboard.writeText(text);
    setCopiedRecovery(true);
    setTimeout(() => setCopiedRecovery(false), 2500);
  };

  // Download recovery codes as .txt
  const handleDownloadRecoveryCodes = () => {
    if (!recoveryCodes.length) return;
    const text =
      `VYASA-N Institutional Two-Factor Recovery Codes\nGenerated On: ${new Date().toLocaleString()}\n\n` +
      recoveryCodes.map((code, idx) => `${idx + 1}. ${code}`).join('\n') +
      '\n\nStore this file securely. Each code can only be used once.';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vyasa-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Restart / Return to Step 1
  const handleReturnToStep1 = () => {
    twoFactorService.clearStoredChallenge();
    setStep('credentials');
    setChallengeId('');
    setTotpCode('');
    setRecoveryCode('');
    setLoginError(null);
    setSuccessBanner(null);
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
            Institutional Authority Console
          </h1>
          <p className="vyasa-auth-page-subtitle">
            Chhatrapati Shahu Ji Maharaj University, Kanpur &bull; VYASAᴺ Research Ecosystem Gateway
          </p>
        </div>

        {/* STEP 1: CREDENTIALS */}
        {step === 'credentials' && (
          <Card
            className="vyasa-auth-card vyasa-auth-card--authority"
            title="Institutional Sign In"
            subtitle="Step 1 of 2: Authenticate with your university credentials"
            headerAction={<Badge variant="teal">Step 1: Credentials</Badge>}
          >
            <form onSubmit={handleSubmitCredentials} noValidate>
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
                  className="vyasa-auth-alert vyasa-auth-alert--error"
                >
                  <span style={{ fontWeight: 700 }}>&bull;</span>
                  <span style={{ flex: 1 }}>{loginError}</span>
                </div>
              )}

              <div style={{ marginBottom: '18px' }}>
                <Input
                  id="authority-email"
                  label="Institutional Email"
                  placeholder="e.g. ankit.trivedi@csjmu.ac.in"
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {submitting ? 'Verifying Credentials...' : 'Sign In as Authority \u2192'}
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
                  <span>Institutional Access Protocol</span>
                </div>
                <p style={{ margin: 0 }}>
                  Institutional authorities, deans, and academic governance personnel are protected with mandatory
                  two-factor authentication (TOTP). Standard authenticator apps (Google Authenticator, Microsoft Authenticator) are supported.
                </p>
              </div>
            </form>
          </Card>
        )}

        {/* STEP 1b: MANDATORY FIRST-LOGIN PASSWORD CHANGE */}
        {step === 'password-change' && (
          <Card
            className="vyasa-auth-card vyasa-auth-card--authority"
            title="Set Permanent Password"
            subtitle="First-login security onboarding: Establish your permanent institutional password"
            headerAction={<Badge variant="saffron">Mandatory Setup</Badge>}
          >
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 14px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '6px',
                color: '#92400e',
                fontSize: '13px',
                lineHeight: '1.5',
              }}
            >
              <strong>Temporary Password Detected</strong>
              <p style={{ margin: '4px 0 0 0' }}>
                You have authenticated with a temporary credential. Institutional policy requires you to establish a secure permanent password before completing two-factor enrollment and accessing your dashboard.
              </p>
            </div>

            <form onSubmit={handleSetPermanentPassword} noValidate>
              {loginError && (
                <div
                  role="alert"
                  className="vyasa-auth-alert vyasa-auth-alert--error"
                >
                  <span style={{ fontWeight: 700 }}>&bull;</span>
                  <span style={{ flex: 1 }}>{loginError}</span>
                </div>
              )}

              <div style={{ marginBottom: '18px' }}>
                <div style={{ position: 'relative' }}>
                  <Input
                    id="authority-new-password"
                    label="New Permanent Password"
                    placeholder="Enter new permanent password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (newPasswordError) setNewPasswordError('');
                    }}
                    error={newPasswordError}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '38px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <div style={{ position: 'relative' }}>
                  <Input
                    id="authority-confirm-password"
                    label="Confirm Permanent Password"
                    placeholder="Re-enter your new permanent password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (confirmPasswordError) setConfirmPasswordError('');
                    }}
                    error={confirmPasswordError}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '38px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  lineHeight: '1.6',
                  marginBottom: '20px',
                }}
              >
                <strong style={{ color: '#334155' }}>Password Policy:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li>Minimum 8 characters in length</li>
                  <li>At least one uppercase letter (A-Z) and one lowercase (a-z)</li>
                  <li>At least one numerical digit (0-9)</li>
                  <li>Must differ from your temporary password</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep('credentials');
                    setPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setLoginError(null);
                  }}
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submitting}
                  disabled={submitting}
                  style={{ flex: 2 }}
                >
                  {submitting ? 'Updating...' : 'Set Password & Continue'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* STEP 2: TOTP VERIFICATION */}
        {step === 'verify' && (
          <Card
            className="vyasa-auth-card vyasa-auth-card--authority"
            title="Two-Factor Verification"
            subtitle="Step 2 of 2: Enter the 6-digit code from your authenticator app"
            headerAction={<Badge variant="teal">Step 2: 2FA</Badge>}
          >
            <form onSubmit={handleVerifyTotp} noValidate>
              {loginError && (
                <div
                  role="alert"
                  className="vyasa-auth-alert vyasa-auth-alert--error"
                >
                  <span style={{ fontWeight: 700 }}>&bull;</span>
                  <span style={{ flex: 1 }}>{loginError}</span>
                </div>
              )}

              <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <label
                  htmlFor="totp-code"
                  className="vyasa-label"
                  style={{ marginBottom: '10px', fontSize: '14px' }}
                >
                  6-Digit Authenticator Code
                </label>
                <input
                  id="totp-code"
                  type="text"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={totpCode}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setTotpCode(cleaned);
                    if (totpError) setTotpError('');
                    if (loginError) setLoginError(null);
                  }}
                  placeholder="123456"
                  className="vyasa-input vyasa-totp-input"
                  disabled={submitting}
                />
                {totpError && (
                  <span className="vyasa-form-hint" style={{ color: '#b91c1c', marginTop: '8px' }}>
                    {totpError}
                  </span>
                )}
                <span className="vyasa-form-hint" style={{ marginTop: '8px' }}>
                  Open Google Authenticator or your standard TOTP app to view your current 6-digit code.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting || totpCode.length !== 6}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {submitting ? 'Verifying Code...' : 'Verify & Enter Console \u2192'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep('recovery');
                    setLoginError(null);
                  }}
                  disabled={submitting}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Lost your phone? Use emergency recovery code
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReturnToStep1}
                  disabled={submitting}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  &larr; Return to Credential Sign In
                </Button>
              </div>

              <div className="vyasa-auth-protocol">
                <div className="vyasa-auth-protocol-title">
                  <AppIcon name="shield" size={13} color="var(--vyasa-primary)" />
                  <span>Time-Synchronized OTP Standard</span>
                </div>
                <p style={{ margin: 0 }}>
                  Codes refresh every 30 seconds according to RFC 6238. For security, repeated or expired codes are rejected automatically.
                </p>
              </div>
            </form>
          </Card>
        )}

        {/* ENROLLMENT STEP */}
        {step === 'enrollment' && (
          <Card
            className="vyasa-auth-card vyasa-auth-card--authority"
            title="Two-Factor Enrollment"
            subtitle="Configure your authenticator app to protect your institutional access"
            headerAction={<Badge variant="saffron">Mandatory Setup</Badge>}
          >
            {loginError && (
              <div
                role="alert"
                className="vyasa-auth-alert vyasa-auth-alert--error"
              >
                <span style={{ fontWeight: 700 }}>&bull;</span>
                <span style={{ flex: 1 }}>{loginError}</span>
              </div>
            )}

            {loadingSetup ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--vyasa-text-secondary)' }}>
                <p>Generating institutional QR provisioning code...</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmEnrollment} noValidate>
                {/* Step 1: Scan QR */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--vyasa-primary)', marginBottom: '6px', fontSize: '14px' }}>
                    1. Scan QR Code
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', margin: '0 0 10px' }}>
                    Open your authenticator app (such as Google Authenticator or Microsoft Authenticator) and scan the barcode below:
                  </p>

                  {setupDetails?.qr_code && (
                    <div className="vyasa-qr-frame">
                      <img
                        src={setupDetails.qr_code}
                        alt="TOTP Enrollment QR Code"
                        className="vyasa-qr-image"
                      />
                    </div>
                  )}
                </div>

                {/* Step 2: Manual Key */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--vyasa-primary)', marginBottom: '4px', fontSize: '14px' }}>
                    2. Or Enter Setup Key Manually
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--vyasa-text-secondary)', margin: 0 }}>
                    If you cannot scan the QR code, type or copy this secret key into your authenticator app:
                  </p>

                  <div className="vyasa-manual-key-box">
                    <span>{setupDetails?.manual_setup_key || 'Loading...'}</span>
                    <button
                      type="button"
                      onClick={handleCopySetupKey}
                      className="vyasa-copy-btn"
                    >
                      {copiedKey ? '\u2713 Copied' : 'Copy Key'}
                    </button>
                  </div>
                </div>

                {/* Step 3: Confirm with first OTP code */}
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: 'var(--vyasa-primary)', marginBottom: '6px', fontSize: '14px' }}>
                    3. Verify &amp; Activate Authenticator
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', margin: '0 0 12px' }}>
                    Enter the 6-digit confirmation code displayed in your authenticator app to complete activation:
                  </p>

                  <input
                    id="enrollment-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTotpCode(cleaned);
                      if (totpError) setTotpError('');
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="123456"
                    className="vyasa-input vyasa-totp-input"
                    disabled={submitting}
                  />
                  {totpError && (
                    <span className="vyasa-form-hint" style={{ color: '#b91c1c', marginTop: '8px' }}>
                      {totpError}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={submitting || totpCode.length !== 6}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {submitting ? 'Confirming Activation...' : 'Activate 2FA & Generate Recovery Codes \u2192'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReturnToStep1}
                    disabled={submitting}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    &larr; Return to Credential Sign In
                  </Button>
                </div>
              </form>
            )}
          </Card>
        )}

        {/* RECOVERY CODES DISPLAY STEP */}
        {step === 'recovery-display' && (
          <Card
            className="vyasa-auth-card vyasa-auth-card--authority"
            title="Save Emergency Recovery Codes"
            subtitle="Store these 10 backup codes safely before entering your dashboard"
            headerAction={<Badge variant="saffron">Backup Keys</Badge>}
          >
            <div className="vyasa-recovery-notice">
              <span style={{ fontSize: '16px', fontWeight: 700 }}>&#9888;</span>
              <div>
                <strong>Critical Security Notice:</strong> These recovery codes will <strong>never be shown again</strong>.
                If you ever lose your phone or authenticator app, these are your sole self-service backup keys.
              </div>
            </div>

            <div className="vyasa-recovery-grid">
              {recoveryCodes.map((code, idx) => (
                <div key={idx} className="vyasa-recovery-item">
                  <span className="vyasa-recovery-item-idx">#{idx + 1}</span>
                  <span>{code}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCopyAllRecoveryCodes}
                className="vyasa-copy-btn"
                style={{ flex: 1, padding: '10px 14px', justifyContent: 'center' }}
              >
                {copiedRecovery ? '\u2713 Copied All Codes' : 'Copy All 10 Codes'}
              </button>

              <button
                type="button"
                onClick={handleDownloadRecoveryCodes}
                className="vyasa-copy-btn"
                style={{ flex: 1, padding: '10px 14px', justifyContent: 'center' }}
              >
                Download .txt File
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--vyasa-text)' }}>
                <input
                  type="checkbox"
                  checked={confirmedRecovery}
                  onChange={(e) => setConfirmedRecovery(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  I confirm that I have safely copied or downloaded all 10 emergency recovery codes and stored them securely.
                </span>
              </label>
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!confirmedRecovery}
              onClick={() => {
                if (pendingTokenRef.current) {
                  proceedWithFinalSession(pendingTokenRef.current);
                }
              }}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Proceed to Institutional Dashboard &rarr;
            </Button>
          </Card>
        )}

        {/* RECOVERY CODE INPUT STEP */}
        {step === 'recovery' && (
          <Card
            className="vyasa-auth-card vyasa-auth-card--authority"
            title="Emergency Recovery Access"
            subtitle="Sign in using one of your 10 single-use backup recovery codes"
            headerAction={<Badge variant="teal">Emergency</Badge>}
          >
            <form onSubmit={handleVerifyRecovery} noValidate>
              {loginError && (
                <div
                  role="alert"
                  className="vyasa-auth-alert vyasa-auth-alert--error"
                >
                  <span style={{ fontWeight: 700 }}>&bull;</span>
                  <span style={{ flex: 1 }}>{loginError}</span>
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="recovery-code-input"
                  className="vyasa-label"
                  style={{ marginBottom: '8px' }}
                >
                  Backup Recovery Code
                </label>
                <input
                  id="recovery-code-input"
                  type="text"
                  autoFocus
                  required
                  value={recoveryCode}
                  onChange={(e) => {
                    setRecoveryCode(e.target.value.toUpperCase());
                    if (recoveryError) setRecoveryError('');
                    if (loginError) setLoginError(null);
                  }}
                  placeholder="e.g. 2A4B-9XYZ"
                  className="vyasa-input"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textAlign: 'center',
                  }}
                  disabled={submitting}
                />
                {recoveryError && (
                  <span className="vyasa-form-hint" style={{ color: '#b91c1c', marginTop: '8px' }}>
                    {recoveryError}
                  </span>
                )}
                <span className="vyasa-form-hint" style={{ marginTop: '8px' }}>
                  Each recovery code can only be used once. Hyphens and spaces are optional.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting || !recoveryCode.trim()}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {submitting ? 'Verifying Recovery Code...' : 'Authenticate & Enter Dashboard \u2192'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep('verify');
                    setLoginError(null);
                  }}
                  disabled={submitting}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  &larr; Return to 6-Digit Authenticator
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReturnToStep1}
                  disabled={submitting}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  &larr; Return to Credential Sign In
                </Button>
              </div>
            </form>
          </Card>
        )}
      </PageContainer>
    </>
  );
};
