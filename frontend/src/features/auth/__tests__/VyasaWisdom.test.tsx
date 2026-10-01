import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../context/AuthContext';
import { ApplicantLoginPage } from '../ApplicantLoginPage';
import { AuthorityLoginPage } from '../AuthorityLoginPage';
import { authService } from '../../../services/authService';
import { AuthenticatedUser } from '../../../types/auth';
import { VedaShloka } from '../../../types/wisdom';
import {
  selectWisdomShloka,
  loadVedaShlokas,
  LAST_WISDOM_STORAGE_KEY,
} from '../../../services/wisdomService';
import { VYASAWisdomModal } from '../../../components/common/VYASAWisdomModal';

const mockShlokas: VedaShloka[] = [
  {
    id: 'rig-10-191-2',
    veda: 'Rig Veda',
    mandala_kanda: '10',
    sukta: '191',
    mantra: '2',
    sanskrit: 'सङ्गच्छध्वं संवदध्वं सं वो मनांसि जानताम् । देवा भागं यथा पूर्वे सञ्जानाना उपासते ॥',
    transliteration: 'Saṅgacchadhvaṁ saṁvadadhvaṁ saṁ vo manāṁsi jānatām | devā bhāgaṁ yathā pūrve sañjānānā upāsate ||',
    meaning_hi: 'साथ चलो, साथ बोलो, तुम्हारे मन एक साथ समझें। जैसे प्राचीन देवों ने एकमत होकर अपना भाग स्वीकार किया था।',
    meaning_en: 'Assemble together, speak together, let your minds be all of one accord, as ancient gods unanimous sit down to their appointed share.',
    source: 'Rig Veda 10.191.2',
    theme: 'Unity and Collective Purpose',
  },
  {
    id: 'atharva-19-9-1',
    veda: 'Atharva Veda',
    mandala_kanda: '19',
    sukta: '9',
    mantra: '1',
    sanskrit: 'शान्ता द्यौः शान्ता पृथिवी शान्तमिदमुर्वन्तरिक्षम् । शान्ता उदन्वतीरापः शान्ता नः सन्त्वोषधीः ॥',
    transliteration: 'Śāntā dyauḥ śāntā pṛthivī śāntamidamurvantarikṣam | śāntā udanvatīrāpaḥ śāntā naḥ santvoṣadhīḥ ||',
    meaning_hi: 'द्युलोक शान्त हो, पृथ्वी शान्त हो, यह विशाल अन्तरिक्ष शान्त हो। जल शान्त हों और औषधियाँ हमारे लिए शान्तिप्रद हों।',
    meaning_en: 'Peaceful be heaven, peaceful the earth, peaceful the broad atmosphere. Peaceful the waters, and peaceful be herbs unto us.',
    source: 'Atharva Veda 19.9.1',
    theme: 'Universal Harmony and Peace',
  },
  {
    id: 'samaveda-1-1',
    veda: 'Sama Veda',
    mandala_kanda: '1',
    sukta: '1',
    mantra: '1',
    sanskrit: 'अग्न आ याहि वीतये गृणानो हव्यदातये । नि होता सत्सि बर्हिषि ॥',
    transliteration: 'Agna ā yāhi vītaye gṛṇāno havyadātaye | ni hotā satsi barhiṣi ||',
    meaning_hi: 'हे अग्नि! यज्ञ में पधारिए और हवि स्वीकार कीजिए।',
    meaning_en: 'Come, Agni, praised with song, to feast and give the offering.',
    source: 'Sama Veda 1.1',
    theme: 'Invocation of Light',
  },
];

const mockApplicantUser: AuthenticatedUser = {
  id: 'appl-wisdom-101',
  email: 'scholar.vedic@csjmu.ac.in',
  first_name: 'Vidya',
  last_name: 'Dhar',
  roles: ['applicant'],
  is_active: true,
};

const mockAuthorityUser: AuthenticatedUser = {
  id: 'auth-wisdom-202',
  email: 'dean.vedic@csjmu.ac.in',
  first_name: 'Acharya',
  last_name: 'Dev',
  roles: ['authority'],
  authority_role: 'DEAN',
  is_active: true,
};

describe('VYASA Wisdom Post-Login Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Wisdom Selection Algorithm & Consecutive Exclusion', () => {
    it('returns null when shloka list is empty', () => {
      expect(selectWisdomShloka([])).toBeNull();
    });

    it('returns the sole item when list has length 1 and records ID in localStorage', () => {
      const single = [mockShlokas[0]];
      const res = selectWisdomShloka(single);
      expect(res).toEqual(mockShlokas[0]);
      expect(localStorage.getItem(LAST_WISDOM_STORAGE_KEY)).toBe('rig-10-191-2');
    });

    it('excludes consecutive shloka previously displayed in localStorage when multiple exist', () => {
      localStorage.setItem(LAST_WISDOM_STORAGE_KEY, 'rig-10-191-2');
      // Across multiple runs, it should never select 'rig-10-191-2'
      for (let i = 0; i < 20; i++) {
        localStorage.setItem(LAST_WISDOM_STORAGE_KEY, 'rig-10-191-2');
        const selected = selectWisdomShloka(mockShlokas);
        expect(selected).not.toBeNull();
        expect(selected?.id).not.toBe('rig-10-191-2');
      }
    });

    it('updates localStorage with the newly selected shloka id', () => {
      const selected = selectWisdomShloka(mockShlokas);
      expect(selected).not.toBeNull();
      expect(localStorage.getItem(LAST_WISDOM_STORAGE_KEY)).toBe(selected?.id);
    });
  });

  describe('2. VYASAWisdomModal Component Direct Rendering & Accessibility', () => {
    it('renders shloka details accurately: Sanskrit, transliteration, meanings, source, badge', () => {
      const onContinue = vi.fn();
      const onSkip = vi.fn();

      render(
        <VYASAWisdomModal
          shloka={mockShlokas[0]}
          isOpen={true}
          onContinue={onContinue}
          onSkip={onSkip}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('VYASA Wisdom')).toBeInTheDocument();
      expect(screen.getByText('Rig Veda')).toBeInTheDocument();
      expect(screen.getByText(/सङ्गच्छध्वं संवदध्वं/)).toBeInTheDocument();
      expect(screen.getByText(/Saṅgacchadhvaṁ saṁvadadhvaṁ/)).toBeInTheDocument();
      expect(screen.getByText(/साथ चलो, साथ बोलो/)).toBeInTheDocument();
      expect(screen.getByText(/Assemble together, speak together/)).toBeInTheDocument();
      expect(screen.getByText('Rig Veda 10.191.2')).toBeInTheDocument();
    });

    it('triggers onContinue when Continue button is clicked', () => {
      const onContinue = vi.fn();
      render(
        <VYASAWisdomModal
          shloka={mockShlokas[0]}
          isOpen={true}
          onContinue={onContinue}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Continue to dashboard/i }));
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('triggers onSkip when Skip button or close icon is clicked', () => {
      const onContinue = vi.fn();
      const onSkip = vi.fn();
      render(
        <VYASAWisdomModal
          shloka={mockShlokas[0]}
          isOpen={true}
          onContinue={onContinue}
          onSkip={onSkip}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Skip to destination/i }));
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('triggers dismiss on Escape key press', () => {
      const onContinue = vi.fn();
      const onSkip = vi.fn();
      render(
        <VYASAWisdomModal
          shloka={mockShlokas[0]}
          isOpen={true}
          onContinue={onContinue}
          onSkip={onSkip}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onSkip).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Applicant Login Flow Interception with Wisdom', () => {
    it('shows Wisdom modal upon successful login, then navigates to dashboard on Continue', async () => {
      vi.spyOn(authService, 'login').mockResolvedValue({
        access_token: 'applicant-wisdom-jwt',
        token_type: 'bearer',
        expires_in: 3600,
        user: mockApplicantUser,
      });
      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

      // Mock fetch for /data/veda-shlokas.json
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockShlokas,
      } as unknown as Response);

      render(
        <MemoryRouter initialEntries={['/applicant/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/applicant/login" element={<ApplicantLoginPage />} />
              <Route path="/dashboard" element={<div data-testid="resolved-dashboard">Applicant Dashboard</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
        target: { value: 'scholar.vedic@csjmu.ac.in' },
      });
      fireEvent.change(screen.getByLabelText(/Security Credential/i), {
        target: { value: 'ValidPass123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Sign In as Applicant/i }));

      // Wisdom Modal should appear and user should NOT yet be at dashboard
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('VYASA Wisdom')).toBeInTheDocument();
        expect(screen.queryByTestId('resolved-dashboard')).not.toBeInTheDocument();
      });

      // Click Continue
      fireEvent.click(screen.getByRole('button', { name: /Continue to dashboard/i }));

      // Now lands on /dashboard
      await waitFor(() => {
        expect(screen.getByTestId('resolved-dashboard')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('navigates to deep-linked return path (from location state) when dismissed via Skip', async () => {
      vi.spyOn(authService, 'login').mockResolvedValue({
        access_token: 'applicant-wisdom-jwt',
        token_type: 'bearer',
        expires_in: 3600,
        user: mockApplicantUser,
      });
      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockShlokas,
      } as unknown as Response);

      const locationState = {
        from: { pathname: '/grievances/create' },
      };

      render(
        <MemoryRouter initialEntries={[{ pathname: '/applicant/login', state: locationState }]}>
          <AuthProvider>
            <Routes>
              <Route path="/applicant/login" element={<ApplicantLoginPage />} />
              <Route path="/grievances/create" element={<div data-testid="target-deep-link">Grievance Submission</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
        target: { value: 'scholar.vedic@csjmu.ac.in' },
      });
      fireEvent.change(screen.getByLabelText(/Security Credential/i), {
        target: { value: 'ValidPass123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Sign In as Applicant/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click Skip
      fireEvent.click(screen.getByRole('button', { name: /Skip to destination/i }));

      await waitFor(() => {
        expect(screen.getByTestId('target-deep-link')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('fails gracefully and proceeds directly to destination if shloka fetch fails', async () => {
      vi.spyOn(authService, 'login').mockResolvedValue({
        access_token: 'applicant-wisdom-jwt',
        token_type: 'bearer',
        expires_in: 3600,
        user: mockApplicantUser,
      });
      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

      // Simulate fetch failure
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

      render(
        <MemoryRouter initialEntries={['/applicant/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/applicant/login" element={<ApplicantLoginPage />} />
              <Route path="/dashboard" element={<div data-testid="direct-dashboard">Direct Dashboard</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
        target: { value: 'scholar.vedic@csjmu.ac.in' },
      });
      fireEvent.change(screen.getByLabelText(/Security Credential/i), {
        target: { value: 'ValidPass123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Sign In as Applicant/i }));

      // Should seamlessly navigate to dashboard without blocking the user
      await waitFor(() => {
        expect(screen.getByTestId('direct-dashboard')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('4. Authority Login Flow Interception with Wisdom', () => {
    it('shows Wisdom modal upon authority login, then navigates to dashboard on Continue', async () => {
      vi.spyOn(authService, 'login').mockResolvedValue({
        access_token: 'authority-wisdom-jwt',
        token_type: 'bearer',
        expires_in: 3600,
        user: mockAuthorityUser,
      });
      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockShlokas,
      } as unknown as Response);

      render(
        <MemoryRouter initialEntries={['/authority/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/authority/login" element={<AuthorityLoginPage />} />
              <Route path="/dashboard" element={<div data-testid="authority-dashboard">Authority Dashboard</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
        target: { value: 'dean.vedic@csjmu.ac.in' },
      });
      fireEvent.change(screen.getByLabelText(/Security Credential/i), {
        target: { value: 'AuthorityKey123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('VYASA Wisdom')).toBeInTheDocument();
        expect(screen.queryByTestId('authority-dashboard')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Continue to dashboard/i }));

      await waitFor(() => {
        expect(screen.getByTestId('authority-dashboard')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('REGRESSION FIX: Wisdom modal displays even when auth state updates before shloka fetch finishes', async () => {
      // Simulates real browser race condition where login resolves, triggering AuthProvider re-render
      // with isAuthenticated=true, while getNextWisdomShloka is still in-flight
      vi.spyOn(authService, 'login').mockResolvedValue({
        access_token: 'applicant-wisdom-jwt',
        token_type: 'bearer',
        expires_in: 3600,
        user: mockApplicantUser,
      });
      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

      // Delayed fetch to ensure auth effect runs before fetch completes
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => mockShlokas,
              } as unknown as Response);
            }, 60);
          })
      );

      render(
        <MemoryRouter initialEntries={['/applicant/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/applicant/login" element={<ApplicantLoginPage />} />
              <Route path="/dashboard" element={<div data-testid="resolved-dashboard">Applicant Dashboard</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
        target: { value: 'scholar.vedic@csjmu.ac.in' },
      });
      fireEvent.change(screen.getByLabelText(/Security Credential/i), {
        target: { value: 'ValidPass123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Sign In as Applicant/i }));

      // Wisdom modal MUST appear despite the in-flight delay, preventing auto-redirect
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('VYASA Wisdom')).toBeInTheDocument();
        expect(screen.queryByTestId('resolved-dashboard')).not.toBeInTheDocument();
      });

      // Continue navigates to destination
      fireEvent.click(screen.getByRole('button', { name: /Continue to dashboard/i }));

      await waitFor(() => {
        expect(screen.getByTestId('resolved-dashboard')).toBeInTheDocument();
      });
    });
  });
});
