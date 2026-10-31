import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../context/AuthContext';
import { AuthorityLoginPage } from '../AuthorityLoginPage';
import { authService } from '../../../services/authService';
import { twoFactorService } from '../../../services/twoFactorService';
import { AuthenticatedUser } from '../../../types/auth';

const mockAuthorityUser: AuthenticatedUser = {
  id: 'a87a039c-f192-4433-a3f8-bc53ba23e82c',
  email: 'new.authority@csjmu.ac.in',
  first_name: 'Dr. New',
  last_name: 'Officer',
  roles: ['authority'],
  is_active: true,
};

describe('Authority First-Login Onboarding & Mandatory TOTP UI Experience', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. Transitions to Set Permanent Password screen when temporary password is used', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      requires_password_change: true,
      requires_two_factor: false,
      challenge_id: 'challenge-pwd-1234',
      message: 'Temporary password detected. You must set a permanent password before proceeding.',
    });

    render(
      <MemoryRouter initialEntries={['/authority/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'new.authority@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'Temp#Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    await waitFor(() => {
      expect(screen.getByText('Set Permanent Password')).toBeInTheDocument();
      expect(screen.getByText(/Temporary Password Detected/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/New Permanent Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Confirm Permanent Password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Set Password & Continue/i })).toBeInTheDocument();
    });
  });

  it('2. Enforces password confirmation mismatch validation', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      requires_password_change: true,
      requires_two_factor: false,
      challenge_id: 'challenge-pwd-1234',
    });

    render(
      <MemoryRouter initialEntries={['/authority/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'new.authority@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'Temp#Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    await waitFor(() => {
      expect(screen.getByText('Set Permanent Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/New Permanent Password/i), {
      target: { value: 'Permanent#Pass1' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Permanent Password/i), {
      target: { value: 'Different#Pass1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Set Password & Continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('3. Successful password change advances directly to mandatory TOTP enrollment', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      requires_password_change: true,
      requires_two_factor: false,
      challenge_id: 'challenge-pwd-1234',
    });

    vi.spyOn(authService, 'setPermanentPassword').mockResolvedValueOnce({
      requires_password_change: false,
      requires_two_factor: true,
      two_factor_setup_required: true,
      challenge_id: 'challenge-totp-5678',
      message: 'Permanent password set successfully. Mandatory two-factor authentication enrollment is required.',
    });

    vi.spyOn(twoFactorService, 'getSetupDetails').mockResolvedValueOnce({
      challenge_id: 'challenge-totp-5678',
      requires_2fa_setup: true,
      issuer: 'VYASA-N (CSJMU)',
      account_name: 'new.authority@csjmu.ac.in',
      qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      manual_setup_key: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    });

    render(
      <MemoryRouter initialEntries={['/authority/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'new.authority@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'Temp#Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    await waitFor(() => {
      expect(screen.getByText('Set Permanent Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/New Permanent Password/i), {
      target: { value: 'Permanent#Pass2026' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Permanent Password/i), {
      target: { value: 'Permanent#Pass2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Set Password & Continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Enrollment')).toBeInTheDocument();
      expect(screen.getByText('Mandatory Setup')).toBeInTheDocument();
      expect(screen.getByText(/1\. Scan QR Code/i)).toBeInTheDocument();
      expect(screen.getByText('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')).toBeInTheDocument();
    });
  });
});
