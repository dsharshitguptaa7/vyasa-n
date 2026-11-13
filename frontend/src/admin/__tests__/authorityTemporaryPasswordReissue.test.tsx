import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthoritiesPage } from '../pages/atharva/AuthoritiesPage';
import { atharvaAdminService } from '../services/atharvaAdminService';
import { Authority } from '../types/atharva';

const mockAuthorities: Authority[] = [
  {
    id: 'auth-101',
    vyasa_user_id: 'user-101',
    role: 'DEAN',
    name_snapshot: 'Prof. Ananya Sen',
    email_snapshot: 'ananya.sen@csjmu.ac.in',
    phone_snapshot: '+919876500001',
    designation: 'Dean of Academic Governance',
    department: 'University Administration',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    onboarding_status: 'ACTIVE',
  },
  {
    id: 'auth-102',
    vyasa_user_id: 'user-102',
    role: 'ASSISTANT_DEAN',
    name_snapshot: 'Dr. Vikram Malhotra',
    email_snapshot: 'vikram.m@csjmu.ac.in',
    phone_snapshot: null,
    designation: 'Assistant Dean (Engineering)',
    department: 'School of Engineering',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    onboarding_status: 'PASSWORD_CHANGE_REQUIRED',
  },
];

describe('SADMIN Authority Management: Reissue Temporary Password UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders Reissue Temporary Password action button for each authority in table', async () => {
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);

    render(
      <MemoryRouter>
        <AuthoritiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Prof. Ananya Sen')).toBeInTheDocument();
      expect(screen.getByText('Dr. Vikram Malhotra')).toBeInTheDocument();
    });

    // Check Reissue buttons exist
    const reissueButtons = screen.getAllByRole('button', { name: /Reissue Temporary Password for/i });
    expect(reissueButtons.length).toBe(2);
    expect(reissueButtons[0]).toHaveAttribute('title', 'Reissue Temporary Password');
  });

  it('2. Clicking Reissue action opens confirmation dialog displaying authority name and registered email', async () => {
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);

    render(
      <MemoryRouter>
        <AuthoritiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Prof. Ananya Sen')).toBeInTheDocument();
    });

    const reissueButtons = screen.getAllByRole('button', { name: /Reissue Temporary Password for/i });
    fireEvent.click(reissueButtons[0]);

    // Confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText('Reissue Temporary Password')).toBeInTheDocument();
    });

    // Authority name and email snapshot are prominently displayed
    expect(screen.getAllByText('Prof. Ananya Sen').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('ananya.sen@csjmu.ac.in').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Are you sure you want to reissue a temporary password/i)).toBeInTheDocument();
    expect(screen.getByText(/Security Invariants:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reissue & Send Email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('3. Canceling confirmation dialog closes modal without calling API', async () => {
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);
    const reissueSpy = vi.spyOn(atharvaAdminService, 'reissuePassword');

    render(
      <MemoryRouter>
        <AuthoritiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Prof. Ananya Sen')).toBeInTheDocument();
    });

    const reissueButtons = screen.getAllByRole('button', { name: /Reissue Temporary Password for/i });
    fireEvent.click(reissueButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Reissue & Send Email/i })).not.toBeInTheDocument();
    });

    expect(reissueSpy).not.toHaveBeenCalled();
  });

  it('4. Confirming reissuance successfully calls API and displays Sent delivery status', async () => {
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);
    const reissueSpy = vi.spyOn(atharvaAdminService, 'reissuePassword').mockResolvedValue({
      authority_id: 'auth-101',
      name: 'Prof. Ananya Sen',
      email: 'ananya.sen@csjmu.ac.in',
      delivery_status: 'SENT',
      delivery_error: null,
    });

    render(
      <MemoryRouter>
        <AuthoritiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Prof. Ananya Sen')).toBeInTheDocument();
    });

    const reissueButtons = screen.getAllByRole('button', { name: /Reissue Temporary Password for/i });
    fireEvent.click(reissueButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reissue & Send Email/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Reissue & Send Email/i }));

    await waitFor(() => {
      expect(reissueSpy).toHaveBeenCalledWith('auth-101');
      // Result modal opens
      expect(screen.getByText('Temporary Password Reissued')).toBeInTheDocument();
      // Delivery status Sent badge is displayed
      expect(screen.getByText('✓ Sent')).toBeInTheDocument();
      expect(screen.getByText(/successfully delivered to/i)).toBeInTheDocument();
    });

    // Close result modal
    const closeBtn = screen.getByRole('button', { name: /Done & Close/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Temporary Password Reissued')).not.toBeInTheDocument();
    });
  });

  it('5. Handles Brevo email delivery failure and displays Failed status with retry button', async () => {
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);
    vi.spyOn(atharvaAdminService, 'reissuePassword').mockResolvedValue({
      authority_id: 'auth-101',
      name: 'Prof. Ananya Sen',
      email: 'ananya.sen@csjmu.ac.in',
      delivery_status: 'FAILED',
      delivery_error: 'Brevo authentication rejected (401)',
    });

    render(
      <MemoryRouter>
        <AuthoritiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Prof. Ananya Sen')).toBeInTheDocument();
    });

    const reissueButtons = screen.getAllByRole('button', { name: /Reissue Temporary Password for/i });
    fireEvent.click(reissueButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reissue & Send Email/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Reissue & Send Email/i }));

    await waitFor(() => {
      // Result modal displays Failed status
      expect(screen.getByText('⚠ Failed')).toBeInTheDocument();
      expect(screen.getByText(/Brevo authentication rejected/i)).toBeInTheDocument();
      // Prominent Retry Reissue button is available
      expect(screen.getByRole('button', { name: /Retry Reissue/i })).toBeInTheDocument();
    });

    // Clicking Retry Reissue re-opens the confirmation modal
    fireEvent.click(screen.getByRole('button', { name: /Retry Reissue/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reissue & Send Email/i })).toBeInTheDocument();
    });
  });

  it('6. Displays error message in dialog when API fails with 429 rate limit or 400', async () => {
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);
    vi.spyOn(atharvaAdminService, 'reissuePassword').mockRejectedValue(
      new Error('Password reissuance rate limit exceeded (3 requests per 15 minutes).')
    );

    render(
      <MemoryRouter>
        <AuthoritiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Prof. Ananya Sen')).toBeInTheDocument();
    });

    const reissueButtons = screen.getAllByRole('button', { name: /Reissue Temporary Password for/i });
    fireEvent.click(reissueButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reissue & Send Email/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Reissue & Send Email/i }));

    // Error message appears in dialog
    await waitFor(() => {
      expect(screen.getByText(/Password reissuance rate limit exceeded/i)).toBeInTheDocument();
    });
  });
});
