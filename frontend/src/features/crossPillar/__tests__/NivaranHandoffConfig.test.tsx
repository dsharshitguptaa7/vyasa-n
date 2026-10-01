import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ApplicantPillarsSection } from '../../applicant/components/ApplicantPillarsSection';
import { AuthorityDashboard } from '../../dashboard/AuthorityDashboard';
import { authService } from '../../../services/authService';
import { AuthProvider } from '../../../context/AuthContext';
import { NivaranWorkspaceCard } from '../../../modules/atharva-veda/nivaran/components/NivaranWorkspaceCard';
import { resolveNivaranUrl, resolveNivaranOrigin } from '../../../config/env';

import { pillarService } from '../../../services/pillarService';

describe('Modular Monolith Atharva Veda (NIVARAN) Internal Routing & Single Session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(pillarService, 'getPillars').mockResolvedValue([]);
  });

  describe('Configuration & Route Constants', () => {
    it('Requirement 1: Resolves local and configured development base routes', () => {
      expect(resolveNivaranUrl('http://localhost:5174')).toBe('http://localhost:5174');
      expect(resolveNivaranOrigin('http://localhost:5174')).toBe('http://localhost:5174');
    });

    it('Requirement 2: Resolves configured production URL format', () => {
      const prodUrl = 'https://nivaran-doctoral-frontend.onrender.com';
      expect(resolveNivaranUrl(prodUrl)).toBe(prodUrl);
      expect(resolveNivaranOrigin(prodUrl)).toBe('https://nivaran-doctoral-frontend.onrender.com');
    });
  });

  describe('Applicant Internal Modular Navigation', () => {
    it('Requirement 3: Applicant Open NIVARAN navigates internally to Atharva Veda module', async () => {
      vi.spyOn(authService, 'getToken').mockReturnValue('applicant-jwt-secret-token-123');

      render(
        <MemoryRouter initialEntries={['/applicant']}>
          <Routes>
            <Route path="/applicant" element={<ApplicantPillarsSection />} />
            <Route path="/modules/atharva-veda/nivaran" element={<div>Atharva Veda NIVARAN Workspace</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Open NIVARAN/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));

      await waitFor(() => {
        expect(screen.getByText('Atharva Veda NIVARAN Workspace')).toBeInTheDocument();
      });
    });

    it('Requirement 4: No popup windows or URL tokens are emitted during applicant navigation', async () => {
      const windowOpenSpy = vi.spyOn(window, 'open');

      render(
        <MemoryRouter initialEntries={['/applicant']}>
          <Routes>
            <Route path="/applicant" element={<ApplicantPillarsSection />} />
            <Route path="/modules/atharva-veda/nivaran" element={<div>Atharva Veda NIVARAN Workspace</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Open NIVARAN/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));

      expect(windowOpenSpy).not.toHaveBeenCalled();
    });
  });

  describe('Authority Internal Modular Navigation', () => {
    it('Requirement 5: Authority Open NIVARAN navigates internally from dashboard', async () => {
      vi.spyOn(authService, 'getToken').mockReturnValue('authority-jwt-secret-token-789');

      render(
        <MemoryRouter initialEntries={['/authority']}>
          <AuthProvider>
            <Routes>
              <Route path="/authority" element={<AuthorityDashboard />} />
              <Route path="/modules/atharva-veda/nivaran" element={<div>Atharva Veda NIVARAN Workspace</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));

      await waitFor(() => {
        expect(screen.getByText('Atharva Veda NIVARAN Workspace')).toBeInTheDocument();
      });
    });

    it('Requirement 6: No external window popups are triggered during authority navigation', async () => {
      const windowOpenSpy = vi.spyOn(window, 'open');

      render(
        <MemoryRouter initialEntries={['/authority']}>
          <AuthProvider>
            <Routes>
              <Route path="/authority" element={<AuthorityDashboard />} />
              <Route path="/modules/atharva-veda/nivaran" element={<div>Atharva Veda NIVARAN Workspace</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));

      expect(windowOpenSpy).not.toHaveBeenCalled();
    });
  });

  describe('Atharva Veda NIVARAN Workspace Component', () => {
    it('Requirement 7: Renders Atharva Veda NIVARAN header and modular architecture badge', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NivaranWorkspaceCard />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Atharva Veda: NIVARAN-AI')).toBeInTheDocument();
      expect(screen.getByText('Modular Monolith')).toBeInTheDocument();
      expect(screen.getByText(/Current User Session Context/i)).toBeInTheDocument();
    });

    it('Requirement 8: Provides return navigation to dashboard', () => {
      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran']}>
          <AuthProvider>
            <Routes>
              <Route path="/modules/atharva-veda/nivaran" element={<NivaranWorkspaceCard />} />
              <Route path="/" element={<div>Ecosystem Overview</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      const returnBtn = screen.getByRole('button', { name: /Return to Dashboard/i });
      expect(returnBtn).toBeInTheDocument();
      fireEvent.click(returnBtn);

      expect(screen.getByText('Ecosystem Overview')).toBeInTheDocument();
    });
  });
});
