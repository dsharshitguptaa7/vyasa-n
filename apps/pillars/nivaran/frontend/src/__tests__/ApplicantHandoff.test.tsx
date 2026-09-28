import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from '../App';
import { NivaranAuthService } from '../services/nivaranAuthService';
import { ApplicantSessionResponse } from '../types/authority';

const mockApplicantSession: ApplicantSessionResponse = {
  success: true,
  role: 'applicant',
  vyasa_identity: {
    id: '88aa11bb-22cc-33dd-44ee-55ff66aa77bb',
    email: 'scholar.raj@csjmu.ac.in',
    first_name: 'Raj',
    last_name: 'Sharma',
    roles: ['applicant'],
  },
  student_record: {
    id: '11223344-5566-7788-9900-aabbccddeeff',
    student_vyasa_user_id: '88aa11bb-22cc-33dd-44ee-55ff66aa77bb',
    record_number: 'SMR-88AA11BB22',
    registration_number: 'CSJMU/PHD/2024/001',
    enrollment_number: null,
    department: 'Computer Science and Engineering',
    program_name: 'Ph.D.',
    full_name: 'Raj Sharma',
    email: 'scholar.raj@csjmu.ac.in',
    mobile: '+91 9876543210',
    status: 'ACTIVE',
    subject_id: '99887766-5544-3322-1100-ffeeddccbbaa',
    subject_name: 'Computer Science and Engineering',
  },
};

describe('NIVARAN Applicant Handoff & Applicant Workspace', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // 1. Session restored from localStorage for applicant
  it('loads and renders Applicant Workspace when applicant role is indicated in localStorage', async () => {
    localStorage.setItem('nivaran_access_token', 'valid-applicant-token');
    localStorage.setItem('nivaran_target_role', 'applicant');
    const fetchSpy = vi.spyOn(NivaranAuthService, 'fetchApplicantSession').mockResolvedValue(mockApplicantSession);

    render(<App />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('valid-applicant-token');
      expect(screen.getByRole('heading', { name: /Raj Sharma/i, level: 1 })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/CSJMU\/PHD\/2024\/001/).length).toBeGreaterThan(0);
    expect(screen.getByText('Ph.D. Scholar')).toBeInTheDocument();
    expect(screen.getAllByText(/SMR-88AA11BB22/).length).toBeGreaterThan(0);
  });

  // 2. Cross-pillar postMessage handoff from VYASA Applicant Dashboard
  it('receives token via postMessage with role=applicant, saves it and loads Applicant Workspace', async () => {
    const fetchSpy = vi.spyOn(NivaranAuthService, 'fetchApplicantSession').mockResolvedValue(mockApplicantSession);

    // Mock window.opener
    const openerPostMessageSpy = vi.fn();
    window.opener = { postMessage: openerPostMessageSpy };

    render(<App />);

    // Simulate postMessage reply from VYASA applicant portal
    const messageEvent = new MessageEvent('message', {
      origin: 'http://localhost:5173',
      data: { type: 'VYASA_SESSION_TOKEN', token: 'received-applicant-jwt', role: 'applicant' },
    });
    act(() => {
      window.dispatchEvent(messageEvent);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('received-applicant-jwt');
      expect(screen.getByRole('heading', { name: /Raj Sharma/i, level: 1 })).toBeInTheDocument();
    });

    expect(localStorage.getItem('nivaran_access_token')).toBe('received-applicant-jwt');
    expect(localStorage.getItem('nivaran_target_role')).toBe('applicant');
  });

  // 3. Operational features visible on workspace
  it('displays grievance submission action cards and quota policy on applicant workspace', async () => {
    localStorage.setItem('nivaran_access_token', 'valid-applicant-token');
    localStorage.setItem('nivaran_target_role', 'applicant');
    vi.spyOn(NivaranAuthService, 'fetchApplicantSession').mockResolvedValue(mockApplicantSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/File New Grievance/i)).toBeInTheDocument();
      expect(screen.getByText(/Track Active Grievances/i)).toBeInTheDocument();
      expect(screen.getByText(/Quota Policy:/i)).toBeInTheDocument();
      expect(screen.getByText(/Maximum of 3 grievances per calendar day/i)).toBeInTheDocument();
    });
  });

  // 4. Sign Out clears both token and target role
  it('clears token and target role upon clicking Sign Out', async () => {
    localStorage.setItem('nivaran_access_token', 'valid-applicant-token');
    localStorage.setItem('nivaran_target_role', 'applicant');
    vi.spyOn(NivaranAuthService, 'fetchApplicantSession').mockResolvedValue(mockApplicantSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Raj Sharma/i, level: 1 })).toBeInTheDocument();
    });

    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOutBtn);

    expect(localStorage.getItem('nivaran_access_token')).toBeNull();
    expect(localStorage.getItem('nivaran_target_role')).toBeNull();
  });

  // 5. First-time JIT provisioning welcome banner
  it('displays first-time registration banner when is_new_registration is true', async () => {
    localStorage.setItem('nivaran_access_token', 'first-time-token');
    localStorage.setItem('nivaran_target_role', 'applicant');
    const newRegSession: ApplicantSessionResponse = {
      ...mockApplicantSession,
      is_new_registration: true,
      academic_context: {
        subject_id: '99887766-5544-3322-1100-ffeeddccbbaa',
        subject_name: 'Computer Science and Engineering',
        cluster_id: 'cluster-123',
        cluster_name: 'Engineering & Technology',
        assistant_dean_id: 'dean-456',
        assistant_dean_name: 'Dr. Academic Dean',
      },
    };
    vi.spyOn(NivaranAuthService, 'fetchApplicantSession').mockResolvedValue(newRegSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Doctoral Scholar Registered in NIVARAN/i)).toBeInTheDocument();
      expect(screen.getByText(/Engineering & Technology/i)).toBeInTheDocument();
    });
  });

  // 6. Dedicated provisioning progress screen while verifying applicant
  it('renders multi-step provisioning progress state while loading applicant session', async () => {
    localStorage.setItem('nivaran_access_token', 'valid-applicant-token');
    localStorage.setItem('nivaran_target_role', 'applicant');
    let resolveSession: (value: ApplicantSessionResponse) => void = () => {};
    const pendingPromise = new Promise<ApplicantSessionResponse>((resolve) => {
      resolveSession = resolve;
    });
    vi.spyOn(NivaranAuthService, 'fetchApplicantSession').mockReturnValue(pendingPromise);

    render(<App />);

    expect(screen.getAllByText(/Registering you with NIVARAN/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Verifying VYASA identity/i)).toBeInTheDocument();
    expect(screen.getByText(/Fetching applicant profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Registering applicant in NIVARAN/i)).toBeInTheDocument();
    expect(screen.getByText(/Synchronizing academic affiliation/i)).toBeInTheDocument();
    expect(screen.getByText(/Preparing grievance workspace/i)).toBeInTheDocument();

    await act(async () => {
      resolveSession(mockApplicantSession);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Raj Sharma/i, level: 1 })).toBeInTheDocument();
    });
  });
});

