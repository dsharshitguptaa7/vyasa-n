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
  id: 'e87a039c-f192-4433-a3f8-bc53ba23e82c',
  email: 'dean@csjmu.ac.in',
  first_name: 'Dr. Ramesh',
  last_name: 'Shukla',
  roles: ['authority'],
  is_active: true,
};

describe('Authority Two-Factor Authentication (TOTP) UI Experience', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. Transitions to Step 2 Authenticator Verification when 2FA is required', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      requires_two_factor: true,
      two_factor_setup_required: false,
      challenge_id: 'test-challenge-uuid-1234',
      message: 'Please enter the 6-digit verification code from your authenticator app.',
    });

    render(
      <MemoryRouter initialEntries={['/authority/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'dean@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'AuthorityPass#1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Verification')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Verify & Enter Console/i })).toBeInTheDocument();
    });

    // Verify no access token was set into storage
    expect(localStorage.getItem('vyasa_access_token')).toBeNull();
  });

  it('2. Transitions to Enrollment when authority has not yet set up 2FA', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      requires_two_factor: true,
      two_factor_setup_required: true,
      challenge_id: 'test-setup-uuid-5678',
      message: 'Two-factor enrollment required.',
    });

    vi.spyOn(twoFactorService, 'getSetupDetails').mockResolvedValueOnce({
      challenge_id: 'test-setup-uuid-5678',
      requires_2fa_setup: true,
      issuer: 'VYASA-N',
      account_name: 'dean@csjmu.ac.in',
      qr_code: 'data:image/png;base64,mockQrCodeData',
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
      target: { value: 'dean@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'AuthorityPass#1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Enrollment')).toBeInTheDocument();
      expect(screen.getByText('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copy Key/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Activate 2FA & Generate Recovery Codes/i })).toBeInTheDocument();
    });
  });

  it('3. Successful Step 2 TOTP verification sets access token and completes authentication', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      requires_two_factor: true,
      two_factor_setup_required: false,
      challenge_id: 'test-challenge-uuid-1234',
    });

    vi.spyOn(twoFactorService, 'verifyLogin').mockResolvedValueOnce({
      access_token: 'valid-authority-jwt-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: mockAuthorityUser,
    });
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);

    render(
      <MemoryRouter initialEntries={['/authority/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Step 1
    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'dean@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'AuthorityPass#1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    // Wait for Step 2
    await waitFor(() => {
      expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
    });

    // Step 2 code entry
    const codeInput = screen.getByPlaceholderText('123456');
    fireEvent.change(codeInput, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify & Enter Console/i }));

    await waitFor(() => {
      expect(twoFactorService.verifyLogin).toHaveBeenCalledWith('test-challenge-uuid-1234', '654321');
      expect(localStorage.getItem('vyasa_access_token')).toBe('valid-authority-jwt-token');
    });
  });

  it('4. Switch to emergency recovery code and authenticate successfully', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      requires_two_factor: true,
      two_factor_setup_required: false,
      challenge_id: 'test-challenge-uuid-1234',
    });

    vi.spyOn(twoFactorService, 'verifyRecovery').mockResolvedValueOnce({
      access_token: 'recovery-authority-jwt',
      token_type: 'bearer',
      expires_in: 3600,
      user: mockAuthorityUser,
    });
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);

    render(
      <MemoryRouter initialEntries={['/authority/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Step 1
    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'dean@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'AuthorityPass#1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    // Step 2 -> Click recovery code option
    await waitFor(() => {
      expect(screen.getByText(/Lost your phone\? Use emergency recovery code/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Lost your phone\? Use emergency recovery code/i));

    // Recovery view
    await waitFor(() => {
      expect(screen.getByText('Emergency Recovery Access')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. 2A4B-9XYZ')).toBeInTheDocument();
    });

    // Enter recovery code
    fireEvent.change(screen.getByPlaceholderText('e.g. 2A4B-9XYZ'), {
      target: { value: 'abcd-1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Authenticate & Enter Dashboard/i }));

    await waitFor(() => {
      expect(twoFactorService.verifyRecovery).toHaveBeenCalledWith('test-challenge-uuid-1234', 'ABCD-1234');
      expect(localStorage.getItem('vyasa_access_token')).toBe('recovery-authority-jwt');
    });
  });

  it('5. Allows user to return to Step 1 and resets challenge state', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      requires_two_factor: true,
      two_factor_setup_required: false,
      challenge_id: 'test-challenge-uuid-1234',
    });

    render(
      <MemoryRouter initialEntries={['/authority/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'dean@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'AuthorityPass#1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Verification')).toBeInTheDocument();
    });

    // Click Return to Credential Sign In
    fireEvent.click(screen.getByRole('button', { name: /Return to Credential Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText('Step 1 of 2: Authenticate with your university credentials')).toBeInTheDocument();
      expect(screen.getByLabelText(/Institutional Email/i)).toBeInTheDocument();
    });
  });
});
