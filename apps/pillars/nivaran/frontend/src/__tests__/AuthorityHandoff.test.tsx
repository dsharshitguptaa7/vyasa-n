import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from '../App';
import { NivaranAuthService } from '../services/nivaranAuthService';
import { AuthoritySessionResponse } from '../types/authority';

const mockManagerSession: AuthoritySessionResponse = {
  success: true,
  vyasa_identity: {
    id: '73fd427c-30c5-54d7-ba9a-4101620815f8',
    email: 'rdmmanager@csjmu.ac.in',
    first_name: 'Ashfaq',
    last_name: 'Ansari',
    roles: ['authority'],
  },
  nivaran_authority: {
    id: '43bf1ae5-9aba-465d-bb71-6cb57cd28a63',
    vyasa_user_id: '73fd427c-30c5-54d7-ba9a-4101620815f8',
    role: 'MANAGER',
    name: 'Mr. Ashfaq Ansari',
    email: 'rdmmanager@csjmu.ac.in',
    designation: 'Manager',
    department: 'Redressal & Dispute Management',
    is_active: true,
  },
};

describe('NIVARAN Authority Handoff & Manager Workspace', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // 1. Session restored from localStorage
  it('loads and renders Manager Workspace from existing localStorage token', async () => {
    localStorage.setItem('nivaran_access_token', 'valid-mock-token');
    vi.spyOn(NivaranAuthService, 'fetchAuthoritySession').mockResolvedValue(mockManagerSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Mr. Ashfaq Ansari/i, level: 1 })).toBeInTheDocument();
      expect(screen.getAllByText('rdmmanager@csjmu.ac.in').length).toBeGreaterThan(0);
      expect(screen.getAllByText('MANAGER').length).toBeGreaterThan(0);
      expect(screen.getByText('Generic: authority')).toBeInTheDocument();
    });

    // Cross-pillar telemetry verification
    expect(screen.getByText('73fd427c-30c5-54d7-ba9a-4101620815f8')).toBeInTheDocument();
    expect(screen.getByText('43bf1ae5-9aba-465d-bb71-6cb57cd28a63')).toBeInTheDocument();

    // Operational triage shell
    expect(screen.getByText(/Grievance Triage & Redressal Console/i)).toBeInTheDocument();
    expect(screen.getByText(/Manager Triage Pipeline Synchronized/i)).toBeInTheDocument();
  });

  // 2. Cross-pillar postMessage handoff from VYASA Console
  it('receives token via postMessage from http://localhost:5173, saves it and loads session', async () => {
    const fetchSpy = vi.spyOn(NivaranAuthService, 'fetchAuthoritySession').mockResolvedValue(mockManagerSession);

    // Mock window.opener
    const openerPostMessageSpy = vi.fn();
    window.opener = { postMessage: openerPostMessageSpy };

    render(<App />);

    // Expect initial loading / awaiting state
    expect(screen.getByText(/Awaiting VYASA Institutional Session Handshake/i)).toBeInTheDocument();

    // Expect handshake request dispatched to opener
    expect(openerPostMessageSpy).toHaveBeenCalledWith(
      { type: 'REQUEST_VYASA_SESSION' },
      'http://localhost:5173'
    );

    // Simulate postMessage reply from VYASA console
    const messageEvent = new MessageEvent('message', {
      origin: 'http://localhost:5173',
      data: { type: 'VYASA_SESSION_TOKEN', token: 'received-jwt-token' },
    });
    act(() => {
      window.dispatchEvent(messageEvent);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('received-jwt-token');
      expect(screen.getByRole('heading', { name: /Mr. Ashfaq Ansari/i, level: 1 })).toBeInTheDocument();
    });

    // Token must be stored in localStorage for reload persistence
    expect(localStorage.getItem('nivaran_access_token')).toBe('received-jwt-token');
  });

  // 3. Security: Ignores postMessage from untrusted origins
  it('rejects postMessage tokens from untrusted origins', async () => {
    const fetchSpy = vi.spyOn(NivaranAuthService, 'fetchAuthoritySession');

    render(<App />);

    const untrustedEvent = new MessageEvent('message', {
      origin: 'http://attacker-controlled.site',
      data: { type: 'VYASA_SESSION_TOKEN', token: 'malicious-token' },
    });
    act(() => {
      window.dispatchEvent(untrustedEvent);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('nivaran_access_token')).toBeNull();
  });

  // 4. Missing Token Error (Handshake timeout)
  it('displays Missing Token error screen when no token arrives within timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<App />);

    expect(screen.getByText(/Awaiting VYASA Institutional Session Handshake/i)).toBeInTheDocument();

    // Fast-forward timeout inside act so React processes the state transition
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText('Missing VYASA Session Token')).toBeInTheDocument();
    expect(screen.getByText(/Institutional Authentication Required/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  // 5. Invalid / Expired Token Error (HTTP 401)
  it('displays Invalid/Expired Token error screen on 401 response', async () => {
    localStorage.setItem('nivaran_access_token', 'expired-token');
    vi.spyOn(NivaranAuthService, 'fetchAuthoritySession').mockRejectedValue({
      code: 'INVALID_TOKEN',
      status: 401,
      message: 'Token signature has expired',
      detail: 'Token signature has expired',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Session Expired or Invalid')).toBeInTheDocument();
      expect(screen.getByText(/Cryptographic Token Verification Failed/i)).toBeInTheDocument();
      expect(screen.getByText(/Detail: Token signature has expired/i)).toBeInTheDocument();
    });
  });

  // 6. VYASA Core Unreachable Error (503 / Service Unavailable)
  it('displays VYASA Core Unreachable error screen when backend cannot reach VYASA Core', async () => {
    localStorage.setItem('nivaran_access_token', 'valid-token');
    vi.spyOn(NivaranAuthService, 'fetchAuthoritySession').mockRejectedValue({
      code: 'VYASA_UNREACHABLE',
      status: 401,
      message: 'VYASA Core identity authority is unreachable',
      detail: 'VYASA Core identity authority is unreachable',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('VYASA Identity Authority Unreachable')).toBeInTheDocument();
      expect(screen.getByText(/Decoupled Service Verification Unavailable/i)).toBeInTheDocument();
    });
  });

  // 7. Unmapped Authority Profile Error (HTTP 403)
  it('displays Unmapped Institutional Authority error when user has no nivaran_authorities record', async () => {
    localStorage.setItem('nivaran_access_token', 'valid-token');
    vi.spyOn(NivaranAuthService, 'fetchAuthoritySession').mockRejectedValue({
      code: 'UNMAPPED_AUTHORITY',
      status: 403,
      message: 'Your VYASA identity is valid, but no NIVARAN authority profile is assigned.',
      detail: 'Your VYASA identity is valid, but no NIVARAN authority profile is assigned.',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Unmapped Institutional Authority')).toBeInTheDocument();
      expect(screen.getByText(/Domain Role Assignment Not Found/i)).toBeInTheDocument();
    });
  });

  // 8. Forbidden Role Error (HTTP 403 - applicant rejected)
  it('displays Institutional Access Forbidden error when non-authority role attempts access', async () => {
    localStorage.setItem('nivaran_access_token', 'applicant-token');
    vi.spyOn(NivaranAuthService, 'fetchAuthoritySession').mockRejectedValue({
      code: 'FORBIDDEN_ROLE',
      status: 403,
      message: "Forbidden: Your VYASA identity does not have the 'authority' ecosystem role.",
      detail: "Forbidden: Your VYASA identity does not have the 'authority' ecosystem role.",
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Institutional Access Forbidden')).toBeInTheDocument();
      expect(screen.getByText(/Authority Role Required/i)).toBeInTheDocument();
    });
  });

  // 9. Sign Out Clears Token
  it('clears token from localStorage upon clicking Sign Out', async () => {
    localStorage.setItem('nivaran_access_token', 'active-token');
    vi.spyOn(NivaranAuthService, 'fetchAuthoritySession').mockResolvedValue(mockManagerSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Mr. Ashfaq Ansari/i, level: 1 })).toBeInTheDocument();
    });

    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOutBtn);

    expect(localStorage.getItem('nivaran_access_token')).toBeNull();
  });
});
