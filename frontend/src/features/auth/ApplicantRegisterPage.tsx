import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, AuthError } from '../../services/authService';
import { SubjectItem } from '../../types/auth';
import { Card, Badge, Button, Input, Select, PageContainer, AppIcon } from '@vyasa/ui';
import { CsjmuLogo } from '@vyasa/ui/branding';

import './Auth.css';

export const ApplicantRegisterPage: React.FC = () => {
  const navigate = useNavigate();

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [phdRegistrationNumber, setPhdRegistrationNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [subjectId, setSubjectId] = useState('');

  // Catalog state
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  // Validation & submission state
  const [fullNameError, setFullNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch canonical institutional subjects on mount
  useEffect(() => {
    let isMounted = true;
    const loadSubjects = async () => {
      setLoadingSubjects(true);
      setSubjectsError(null);
      try {
        const list = await authService.getSubjects();
        if (isMounted) {
          setSubjects(list);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof AuthError ? err.message : 'Unable to load subjects';
          setSubjectsError(msg);
        }
      } finally {
        if (isMounted) {
          setLoadingSubjects(false);
        }
      }
    };

    loadSubjects();
    return () => {
      isMounted = false;
    };
  }, []);

  const validate = (): boolean => {
    let isValid = true;
    setFullNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setSubjectError('');

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setFullNameError('Full legal name is required (minimum 2 characters).');
      isValid = false;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Email address is required.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      isValid = false;
    } else if (!/[A-Z]/.test(password)) {
      setPasswordError('Password must contain at least one uppercase letter.');
      isValid = false;
    } else if (!/[a-z]/.test(password)) {
      setPasswordError('Password must contain at least one lowercase letter.');
      isValid = false;
    } else if (!/\d/.test(password)) {
      setPasswordError('Password must contain at least one number.');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      isValid = false;
    }

    if (!subjectId) {
      setSubjectError('Please select your academic subject discipline.');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await authService.register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        phd_registration_number: phdRegistrationNumber.trim() || undefined,
        department: department.trim() || undefined,
        subject_id: subjectId,
      });

      // Redirect to applicant login page with registration success state
      navigate('/applicant/login', {
        replace: true,
        state: {
          registrationSuccess: true,
          email: email.trim().toLowerCase(),
        },
      });
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("We couldn't create your account. Please check your information and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const subjectOptions = subjects.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  return (
    <PageContainer className="vyasa-auth-page-container vyasa-auth-page-container--register">
      {/* Institutional Branding Masthead */}
      <div className="vyasa-auth-masthead">
        <div className="vyasa-auth-seal-wrap">
          <CsjmuLogo size={68} />
        </div>
        <h1 className="vyasa-auth-page-title">
          Applicant Registration
        </h1>
        <p className="vyasa-auth-page-subtitle">
          Chhatrapati Shahu Ji Maharaj University, Kanpur &bull; VYASAᴺ Research Ecosystem Gateway
        </p>
      </div>

      <Card
        className="vyasa-auth-card vyasa-auth-card--applicant"
        title="Register as Applicant"
        subtitle="Establish your unified institutional scholar identity"
        headerAction={<Badge variant="gold">Applicant</Badge>}
      >
        <form onSubmit={handleSubmit} noValidate>
          {submitError && (
            <div
              role="alert"
              className="vyasa-auth-alert vyasa-auth-alert--error"
            >
              <AppIcon name="alert-circle" size={16} color="#c9302c" />
              <span style={{ flex: 1 }}>{submitError}</span>
            </div>
          )}

          {subjectsError && (
            <div
              role="alert"
              className="vyasa-auth-alert vyasa-auth-alert--warning"
            >
              <AppIcon name="alert-circle" size={16} color="#b26a00" />
              <span style={{ flex: 1 }}>
                Notice: Unable to load subject catalog. Please verify backend service connection.
              </span>
            </div>
          )}

          {/* 1. Full Name (Required, Full-width) */}
          <div className="vyasa-form-row">
            <Input
              id="applicant-name"
              label="Full Name"
              placeholder="e.g. Dr. Ankit Kumar Trivedi"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fullNameError) setFullNameError('');
                if (submitError) setSubmitError(null);
              }}
              error={fullNameError}
              disabled={submitting}
              required
              autoComplete="name"
            />
          </div>

          {/* 2. Email Address (Required, Full-width) */}
          <div className="vyasa-form-row">
            <Input
              id="applicant-email"
              label="Email Address"
              placeholder="e.g. scholar@csjmu.ac.in"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
                if (submitError) setSubmitError(null);
              }}
              error={emailError}
              disabled={submitting}
              required
              autoComplete="email"
            />
          </div>

          {/* 3. Academic Subject / Discipline Dropdown (Required, Full-width) */}
          <div className="vyasa-form-row">
            <Select
              id="applicant-subject"
              label="Academic Subject / Discipline"
              placeholder={loadingSubjects ? 'Loading subjects...' : 'Select your subject discipline'}
              options={subjectOptions}
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                if (subjectError) setSubjectError('');
                if (submitError) setSubmitError(null);
              }}
              error={subjectError}
              disabled={submitting || loadingSubjects}
              required
            />
          </div>

          {/* 4. Password & Confirm Password (2 Columns Side by Side on Desktop) */}
          <div className="vyasa-form-grid-2">
            <div>
              <Input
                id="applicant-password"
                label="Password"
                placeholder="Minimum 8 characters"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                  if (submitError) setSubmitError(null);
                }}
                error={passwordError}
                disabled={submitting}
                required
                autoComplete="new-password"
                hint="At least 8 chars, 1 uppercase, 1 lowercase, 1 digit"
              />
            </div>
            <div>
              <Input
                id="applicant-confirm-password"
                label="Confirm Password"
                placeholder="Re-enter password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (confirmPasswordError) setConfirmPasswordError('');
                  if (submitError) setSubmitError(null);
                }}
                error={confirmPasswordError}
                disabled={submitting}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* 5. PhD Registration Number & Academic Department (2 Columns Side by Side on Desktop) */}
          <div className="vyasa-form-grid-2">
            <div>
              <Input
                id="applicant-phd-reg"
                label="PhD Registration / Roll Number"
                placeholder="e.g. CSJMU/PHD/2024/042 (Optional)"
                value={phdRegistrationNumber}
                onChange={(e) => {
                  setPhdRegistrationNumber(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                disabled={submitting}
              />
            </div>
            <div>
              <Input
                id="applicant-department"
                label="Academic Department"
                placeholder="e.g. Department of Physics (Optional)"
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                disabled={submitting}
              />
            </div>
          </div>

          {/* 6. Contact Phone (Optional, Full-width) */}
          <div className="vyasa-form-row" style={{ marginBottom: '28px' }}>
            <Input
              id="applicant-phone"
              label="Contact Phone"
              placeholder="e.g. +91 9876543210 (Optional)"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (submitError) setSubmitError(null);
              }}
              disabled={submitting}
              autoComplete="tel"
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting}
              className="vyasa-btn--primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {submitting ? 'Registering Account...' : 'Complete Scholar Registration'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/applicant/login')}
              disabled={submitting}
              className="vyasa-btn--outline"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Already Registered? Sign In &rarr;
            </Button>
          </div>

          {/* Institutional Single Sign-On (SSO) Notice */}
          <div className="vyasa-auth-protocol">
            <div className="vyasa-auth-protocol-title">
              <AppIcon name="shield" size={14} color="var(--vyasa-primary, #0f2b48)" />
              <span>Institutional Single Sign-On (SSO) Foundation</span>
            </div>
            <p style={{ margin: 0 }}>
              Registering in VYASAᴺ Core provisions your unified university identity. Once registered,
              you will use these credentials across all affiliated university pillars including NIVARAN.
            </p>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
};

export default ApplicantRegisterPage;
