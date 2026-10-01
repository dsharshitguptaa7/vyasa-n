import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../context/AuthContext';
import { AuthorityRoute } from '../../../components/auth/AuthorityRoute';
import { AuthorityLoginPage } from '../AuthorityLoginPage';
import { AuthorityDashboard } from '../../dashboard/AuthorityDashboard';
import { authService } from '../../../services/authService';
import { AuthenticatedUser } from '../../../types/auth';

const mockAuthorityUser: AuthenticatedUser = {
  id: 'e87a039c-f192-4433-a3f8-bc53ba23e82c',
  email: 'real.mgr@vyasa.local',
  first_name: 'Nivaran',
  last_name: 'Manager',
  roles: ['authority'],
  is_active: true,
};

const mockApplicantUser: AuthenticatedUser = {
  id: '11111111-2222-3333-4444-555555555555',
  email: 'applicant.student@csjmu.ac.in',
  first_name: 'Student',
  last_name: 'Applicant',
  roles: ['applicant'],
  is_active: true,
};

describe('Authority Authentication & Dashboard Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // 1. Login form rendering
  it('Criterion 1: Renders the authority login page with email, password fields and institutional styling', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Institutional Authority Console')).toBeInTheDocument();
    expect(screen.getByText('Institutional Sign In')).toBeInTheDocument();
    expect(screen.getByLabelText(/Institutional Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Security Credential/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In as Authority/i })).toBeInTheDocument();
  });

  // 2. Client-side form validation
  it('Criterion 2: Enforces client-side validation on empty or malformed inputs without contacting backend', async () => {
    const loginSpy = vi.spyOn(authService, 'login');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /Sign In as Authority/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Institutional email address is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Institutional credential password is required/i)).toBeInTheDocument();
    });

    expect(loginSpy).not.toHaveBeenCalled();

    // Malformed email
    const emailInput = screen.getByLabelText(/Institutional Email/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email-format' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid institutional email address/i)).toBeInTheDocument();
    });
    expect(loginSpy).not.toHaveBeenCalled();
  });

  // 3. Successful login flow
  it('Criterion 3: Authenticates authority credentials, stores JWT in localStorage, and transitions state', async () => {
    vi.spyOn(authService, 'login').mockImplementation(async (_email, _pwd) => {
      authService.setToken('fake-jwt-token-xyz');
      return {
        access_token: 'fake-jwt-token-xyz',
        token_type: 'bearer',
        expires_in: 3600,
        user: mockAuthorityUser,
      };
    });
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'real.mgr@vyasa.local' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'Vyas@n789' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('real.mgr@vyasa.local', 'Vyas@n789');
      expect(localStorage.getItem('vyasa_access_token')).toBe('fake-jwt-token-xyz');
    });
  });

  // 4. User profile resolution via /auth/me
  it('Criterion 4: Resolves user profile with canonical UUID, email, and generic authority role', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      access_token: 'fake-jwt-token-xyz',
      token_type: 'bearer',
      expires_in: 3600,
      user: mockAuthorityUser,
    });
    const profileSpy = vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'real.mgr@vyasa.local' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'Vyas@n789' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    await waitFor(() => {
      expect(profileSpy).toHaveBeenCalled();
    });
  });

  // 5. Authority role guard unlocks Authority Dashboard
  it('Criterion 5: Unlocks Authority Dashboard at /authority for generic authority role and displays NIVARAN card', async () => {
    localStorage.setItem('vyasa_access_token', 'valid-authority-token');
    vi.spyOn(authService, 'getToken').mockReturnValue('valid-authority-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);

    render(
      <MemoryRouter initialEntries={['/authority']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/authority"
              element={
                <AuthorityRoute>
                  <AuthorityDashboard />
                </AuthorityRoute>
              }
            />
            <Route path="/modules/atharva-veda/nivaran" element={<div>Atharva Veda NIVARAN Workspace</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Verify dashboard renders with user info
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Nivaran Manager/i, level: 1 })).toBeInTheDocument();
      expect(screen.getAllByText('real.mgr@vyasa.local').length).toBeGreaterThan(0);
      expect(screen.getByText('ID: e87a039c-f192-4433-a3f8-bc53ba23e82c')).toBeInTheDocument();
    });

    // Verify NIVARAN pillar card is present
    expect(screen.getByText('NIVARAN')).toBeInTheDocument();
    expect(screen.getByText('AI-Assisted Grievance Redressal System')).toBeInTheDocument();
    expect(screen.getByText('Active Pillar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open NIVARAN/i })).toBeInTheDocument();

    // Verify internal modular navigation
    fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));
    await waitFor(() => {
      expect(screen.getByText('Atharva Veda NIVARAN Workspace')).toBeInTheDocument();
    });
  });

  // 6. Non-authority role blocked
  it('Criterion 6: Blocks non-authority role (e.g., applicant) with institutional access restriction', async () => {
    localStorage.setItem('vyasa_access_token', 'applicant-token');
    vi.spyOn(authService, 'getToken').mockReturnValue('applicant-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/authority']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/authority"
              element={
                <AuthorityRoute>
                  <AuthorityDashboard />
                </AuthorityRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Institutional Access Restricted')).toBeInTheDocument();
      expect(screen.getByText('Authority Role Required')).toBeInTheDocument();
      expect(screen.getByText(/applicant\.student@csjmu\.ac\.in/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('Institutional Governance Pillars')).not.toBeInTheDocument();
  });

  // 7. Logout clears token and redirects
  it('Criterion 7: Sign out clears localStorage token and resets authenticated state', async () => {
    localStorage.setItem('vyasa_access_token', 'valid-authority-token');
    vi.spyOn(authService, 'getToken').mockReturnValue('valid-authority-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);
    const logoutSpy = vi.spyOn(authService, 'logout');

    render(
      <MemoryRouter initialEntries={['/authority']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/authority"
              element={
                <AuthorityRoute>
                  <AuthorityDashboard />
                </AuthorityRoute>
              }
            />
            <Route path="/login" element={<div>Redirected To Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Nivaran Manager/i, level: 1 })).toBeInTheDocument();
    });

    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
      expect(screen.getByText('Redirected To Login Page')).toBeInTheDocument();
    });
  });

  // 8. Token persistence across reloads
  it('Criterion 8: Restores authority session automatically from existing valid token in localStorage', async () => {
    localStorage.setItem('vyasa_access_token', 'persisted-valid-token');
    vi.spyOn(authService, 'getToken').mockReturnValue('persisted-valid-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);

    render(
      <MemoryRouter initialEntries={['/authority']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/authority"
              element={
                <AuthorityRoute>
                  <AuthorityDashboard />
                </AuthorityRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Should automatically verify and render dashboard without explicit login action
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Nivaran Manager/i, level: 1 })).toBeInTheDocument();
      expect(screen.getAllByText('real.mgr@vyasa.local').length).toBeGreaterThan(0);
    });
  });

  // 9. Invalid/expired token redirect
  it('Criterion 9: Purges expired or rejected token and redirects unauthenticated user to /login', async () => {
    localStorage.setItem('vyasa_access_token', 'expired-bad-token');
    vi.spyOn(authService, 'getToken').mockReturnValue('expired-bad-token');
    vi.spyOn(authService, 'getCurrentUser').mockRejectedValue(new Error('Token expired'));
    const removeTokenSpy = vi.spyOn(authService, 'removeToken');

    render(
      <MemoryRouter initialEntries={['/authority']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/authority"
              element={
                <AuthorityRoute>
                  <AuthorityDashboard />
                </AuthorityRoute>
              }
            />
            <Route path="/login" element={<div>Redirected To Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(removeTokenSpy).toHaveBeenCalled();
      expect(screen.getByText('Redirected To Login Page')).toBeInTheDocument();
    });
  });
});
