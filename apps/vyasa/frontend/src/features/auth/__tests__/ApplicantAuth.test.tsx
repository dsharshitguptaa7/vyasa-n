import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../context/AuthContext';
import { ApplicantLoginPage } from '../ApplicantLoginPage';
import { ApplicantRegisterPage } from '../ApplicantRegisterPage';
import { AuthorityLoginPage } from '../AuthorityLoginPage';
import { LandingPage } from '../../landing/LandingPage';
import { ApplicantRoute } from '../../../components/auth/ApplicantRoute';
import { authService } from '../../../services/authService';
import { AuthenticatedUser } from '../../../types/auth';

const mockApplicantUser: AuthenticatedUser = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'scholar.rohan@csjmu.ac.in',
  first_name: 'Rohan',
  last_name: 'Verma',
  fullName: 'Rohan Verma',
  roles: ['applicant'],
  is_active: true,
};

const mockAuthorityUser: AuthenticatedUser = {
  id: '11111111-2222-3333-4444-555555555555',
  email: 'authority.dean@vyasa.local',
  first_name: 'Institutional',
  last_name: 'Dean',
  fullName: 'Institutional Dean',
  roles: ['authority'],
  is_active: true,
};

describe('Separated Applicant Authentication UX & Dedicated Login', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authService, 'getSubjects').mockResolvedValue([
      { id: 'sub-1', name: 'Chemistry' },
      { id: 'sub-2', name: 'Physics' },
    ]);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('1. Applicant Registration route renders with applicant branding and form fields', async () => {
    render(
      <MemoryRouter initialEntries={['/applicant/register']}>
        <AuthProvider>
          <ApplicantRegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Applicant Registration')).toBeInTheDocument();
      expect(screen.getByText('Register as Applicant')).toBeInTheDocument();
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Complete Scholar Registration/i })).toBeInTheDocument();
    });
  });

  it('2. Applicant Login route renders with email, password, and institutional branding', () => {
    render(
      <MemoryRouter initialEntries={['/applicant/login']}>
        <AuthProvider>
          <ApplicantLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Applicant Login')).toBeInTheDocument();
    expect(screen.getByText('Applicant Sign In')).toBeInTheDocument();
    expect(screen.getByLabelText(/Institutional Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Security Credential/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In as Applicant/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Applicant\? Register here/i })).toBeInTheDocument();
  });

  it('3. Applicant can navigate from Login → Register', async () => {
    render(
      <MemoryRouter initialEntries={['/applicant/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/applicant/login" element={<ApplicantLoginPage />} />
            <Route path="/applicant/register" element={<ApplicantRegisterPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /New Applicant\? Register here/i }));

    await waitFor(() => {
      expect(screen.getByText('Applicant Registration')).toBeInTheDocument();
    });
  });

  it('4. Applicant can navigate from Register → Login', async () => {
    render(
      <MemoryRouter initialEntries={['/applicant/register']}>
        <AuthProvider>
          <Routes>
            <Route path="/applicant/register" element={<ApplicantRegisterPage />} />
            <Route path="/applicant/login" element={<ApplicantLoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Already Registered\? Sign In/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Already Registered\? Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText('Applicant Login')).toBeInTheDocument();
    });
  });

  it('5. Applicant Login enforces validation on empty or invalid inputs', async () => {
    const loginSpy = vi.spyOn(authService, 'login');

    render(
      <MemoryRouter initialEntries={['/applicant/login']}>
        <AuthProvider>
          <ApplicantLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /Sign In as Applicant/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Institutional email address is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Institutional credential password is required/i)).toBeInTheDocument();
    });
    expect(loginSpy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid institutional email address/i)).toBeInTheDocument();
    });
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('6. Applicant login submits correct credentials via existing authService', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({
      access_token: 'applicant-jwt-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: mockApplicantUser,
    });
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/applicant/login']}>
        <AuthProvider>
          <ApplicantLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'scholar.rohan@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'Scholar@123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In as Applicant/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('scholar.rohan@csjmu.ac.in', 'Scholar@123');
    });
  });

  it('7. Successful applicant login redirects to /applicant', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({
      access_token: 'applicant-jwt-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: mockApplicantUser,
    });
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/applicant/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/applicant/login" element={<ApplicantLoginPage />} />
            <Route path="/applicant" element={<div>Target Applicant Workspace</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'scholar.rohan@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'Scholar@123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In as Applicant/i }));

    await waitFor(() => {
      expect(screen.getByText('Target Applicant Workspace')).toBeInTheDocument();
    });
  });

  it('8. Non-applicant account (authority) is blocked from entering /applicant and shown access restriction', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('authority-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <ApplicantRoute>
            <div>Restricted Applicant Area</div>
          </ApplicantRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Institutional Access Restricted')).toBeInTheDocument();
      expect(screen.getByText('Applicant Role Required')).toBeInTheDocument();
      expect(screen.queryByText('Restricted Applicant Area')).not.toBeInTheDocument();
    });
  });

  it('9. Authority Login contains only authority login functionality and NO registration UI', () => {
    render(
      <MemoryRouter initialEntries={['/authority/login']}>
        <AuthProvider>
          <AuthorityLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Institutional Authority Console')).toBeInTheDocument();
    expect(screen.getByText('Institutional Sign In')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In as Authority/i })).toBeInTheDocument();

    // Verify NO registration button/link exists on Authority Login
    expect(screen.queryByRole('button', { name: /register/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/register/i)).not.toBeInTheDocument();
  });

  it('10. Public Landing page renders separated Applicant and Authority gateways with no authority registration', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <LandingPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Section exists
    expect(screen.getByText('Institutional Access Gateways')).toBeInTheDocument();

    // Applicant card has Login and Register
    expect(screen.getByText('Doctoral Scholars & Applicants')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Applicant Login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register as Applicant/i })).toBeInTheDocument();

    // Authority card has Login ONLY, NO register
    expect(screen.getByText('Institutional Authorities')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Authority Login/i })).toBeInTheDocument();
    expect(screen.getByText(/Public registration is not permitted/i)).toBeInTheDocument();
  });
});
