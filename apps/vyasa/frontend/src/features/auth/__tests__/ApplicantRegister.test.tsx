import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../context/AuthContext';
import { ApplicantRegisterPage } from '../ApplicantRegisterPage';
import { ApplicantLoginPage } from '../ApplicantLoginPage';
import { AuthorityLoginPage } from '../AuthorityLoginPage';
import { authService, AuthError } from '../../../services/authService';
import { SubjectItem } from '../../../types/auth';

const mockSubjects: SubjectItem[] = [
  { id: '2e79b5bc-27b5-4006-af24-27550c2ec56d', name: 'Agricultural Chemistry' },
  { id: 'e43a06c4-0883-47fd-90d1-5d8d2daf4816', name: 'Chemistry' },
  { id: 'b729db1e-5a5c-4137-a9da-72e2e27ff62c', name: 'Mathematics' },
  { id: '0c590459-4720-4f78-aada-32708e7a05bc', name: 'Physics' },
];

describe('Applicant Registration Component & Workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authService, 'getSubjects').mockResolvedValue(mockSubjects);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('Criterion 1: Renders registration form with all required and optional fields', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <ApplicantRegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Applicant Registration')).toBeInTheDocument();
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
    });
    expect(screen.getByText('Register as Applicant')).toBeInTheDocument();

    // Required inputs
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Academic Subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();

    // Optional inputs
    expect(screen.getByLabelText(/PhD Registration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Academic Department/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact Phone/i)).toBeInTheDocument();

    // Buttons
    expect(screen.getByRole('button', { name: /Complete Scholar Registration/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Already Registered\? Sign In/i })).toBeInTheDocument();
  });

  it('Criterion 2: Loads and populates canonical subjects into dropdown', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <ApplicantRegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
      expect(screen.getByText('Mathematics')).toBeInTheDocument();
      expect(screen.getByText('Physics')).toBeInTheDocument();
    });
  });

  it('Criterion 3: Enforces client-side validation on empty inputs without calling API', async () => {
    const registerSpy = vi.spyOn(authService, 'register');

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <ApplicantRegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Chemistry')).toBeInTheDocument());

    const submitBtn = screen.getByRole('button', { name: /Complete Scholar Registration/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Full legal name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Email address is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Please select your academic subject discipline/i)).toBeInTheDocument();

    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('Criterion 4: Enforces email format validation', async () => {
    const registerSpy = vi.spyOn(authService, 'register');

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <ApplicantRegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Chemistry')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Rohan Sharma' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'Password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Complete Scholar Registration/i }));

    expect(await screen.findByText(/Please enter a valid email address/i)).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('Criterion 5: Enforces password complexity and matching requirements', async () => {
    const registerSpy = vi.spyOn(authService, 'register');

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <ApplicantRegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Chemistry')).toBeInTheDocument());

    // 1. Too short
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Rohan Sharma' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'rohan@csjmu.ac.in' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Short1A' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'Short1A' } });
    fireEvent.click(screen.getByRole('button', { name: /Complete Scholar Registration/i }));

    expect(await screen.findByText(/Password must be at least 8 characters long/i)).toBeInTheDocument();

    // 2. Mismatched passwords
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'DifferentPass123' } });
    fireEvent.click(screen.getByRole('button', { name: /Complete Scholar Registration/i }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('Criterion 6: Successful registration calls authService.register and redirects to /login', async () => {
    const registerSpy = vi.spyOn(authService, 'register').mockResolvedValue({
      message: 'Registration successful',
      user_id: '99999999-8888-7777-6666-555555555555',
      email: 'rohan.sharma@csjmu.ac.in',
      full_name: 'Rohan Sharma',
      role: 'applicant',
      subject_id: mockSubjects[1].id,
      subject_name: mockSubjects[1].name,
      phd_registration_number: 'PHD/2026/001',
    });

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
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Rohan Sharma' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'rohan.sharma@csjmu.ac.in' } });
    fireEvent.change(screen.getByLabelText(/Academic Subject/i), { target: { value: mockSubjects[1].id } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/PhD Registration/i), { target: { value: 'PHD/2026/001' } });
    fireEvent.change(screen.getByLabelText(/Academic Department/i), { target: { value: 'Chemical Sciences' } });
    fireEvent.change(screen.getByLabelText(/Contact Phone/i), { target: { value: '+919876543210' } });

    fireEvent.click(screen.getByRole('button', { name: /Complete Scholar Registration/i }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith({
        full_name: 'Rohan Sharma',
        email: 'rohan.sharma@csjmu.ac.in',
        password: 'Password123',
        phone: '+919876543210',
        phd_registration_number: 'PHD/2026/001',
        department: 'Chemical Sciences',
        subject_id: mockSubjects[1].id,
      });
    });

    // Verify redirected to applicant login with success banner
    await waitFor(() => {
      expect(screen.getByText(/Registration successful! You may now sign in/i)).toBeInTheDocument();
      expect(screen.getByText('Applicant Login')).toBeInTheDocument();
    });
  });

  it('Criterion 7: Handles 409 duplicate email conflict error gracefully', async () => {
    vi.spyOn(authService, 'register').mockRejectedValue(
      new AuthError('An account with this email address already exists', 409)
    );

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <ApplicantRegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Duplicate Scholar' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'existing@csjmu.ac.in' } });
    fireEvent.change(screen.getByLabelText(/Academic Subject/i), { target: { value: mockSubjects[0].id } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'Password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Complete Scholar Registration/i }));

    expect(await screen.findByText(/An account with this email address already exists/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete Scholar Registration/i })).not.toBeDisabled();
  });

  it('Criterion 8: Displays registration success banner and pre-fills email on applicant login page', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/applicant/login',
            state: {
              registrationSuccess: true,
              email: 'prefilled.scholar@csjmu.ac.in',
            },
          },
        ]}
      >
        <AuthProvider>
          <ApplicantLoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Registration successful! You may now sign in/i)).toBeInTheDocument();
    const emailInput = screen.getByLabelText(/Institutional Email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('prefilled.scholar@csjmu.ac.in');
  });
});
