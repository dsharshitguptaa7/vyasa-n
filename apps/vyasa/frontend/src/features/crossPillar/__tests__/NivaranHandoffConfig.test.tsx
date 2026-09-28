import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApplicantPillarsSection } from '../../applicant/components/ApplicantPillarsSection';
import { AuthorityDashboard } from '../../dashboard/AuthorityDashboard';
import { authService } from '../../../services/authService';
import { AuthProvider } from '../../../context/AuthContext';
import { resolveNivaranUrl, resolveNivaranOrigin } from '../../../config/env';

describe('Cross-Pillar Open NIVARAN URL & Origin Configuration', () => {
  const originalEnv = import.meta.env.VITE_NIVARAN_APP_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    import.meta.env.VITE_NIVARAN_APP_URL = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Configuration Resolution (Dev & Prod)', () => {
    it('Requirement 4: Local development configuration resolves to http://localhost:5174', () => {
      import.meta.env.VITE_NIVARAN_APP_URL = 'http://localhost:5174';
      expect(resolveNivaranUrl()).toBe('http://localhost:5174');
      expect(resolveNivaranOrigin()).toBe('http://localhost:5174');
    });

    it('Requirement 5: Production configuration resolves to production NIVARAN URL and derives origin', () => {
      const prodUrl = 'https://nivaran-doctoral-frontend.onrender.com';
      import.meta.env.VITE_NIVARAN_APP_URL = prodUrl;
      expect(resolveNivaranUrl()).toBe(prodUrl);
      expect(resolveNivaranOrigin()).toBe('https://nivaran-doctoral-frontend.onrender.com');
    });
  });

  describe('Applicant Open NIVARAN & postMessage Handshake', () => {
    it('Requirement 1 & 7: Applicant Open NIVARAN uses configured URL with NO token in URL', async () => {
      import.meta.env.VITE_NIVARAN_APP_URL = 'http://localhost:5174';
      vi.spyOn(authService, 'getToken').mockReturnValue('applicant-jwt-secret-token-123');

      const mockOpenedWindow = { postMessage: vi.fn() } as unknown as Window;
      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(mockOpenedWindow);

      render(
        <MemoryRouter>
          <ApplicantPillarsSection />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Open NIVARAN/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));

      // 1. Verifies opened URL matches configured URL
      expect(windowOpenSpy).toHaveBeenCalledWith('http://localhost:5174', '_blank');

      // 7. Verifies NO token is included in URL parameters or fragment
      const openedUrl = windowOpenSpy.mock.calls[0][0] as string;
      expect(openedUrl).not.toContain('applicant-jwt-secret-token-123');
      expect(openedUrl).not.toContain('token=');
      expect(openedUrl).not.toContain('access_token=');
    });

    it('Requirement 1 (Production): Applicant Open NIVARAN uses production Render URL when configured', async () => {
      const prodUrl = 'https://nivaran-doctoral-frontend.onrender.com';
      import.meta.env.VITE_NIVARAN_APP_URL = prodUrl;
      vi.spyOn(authService, 'getToken').mockReturnValue('applicant-jwt-token');

      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({ postMessage: vi.fn() } as unknown as Window);

      render(
        <MemoryRouter>
          <ApplicantPillarsSection />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Open NIVARAN/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));

      expect(windowOpenSpy).toHaveBeenCalledWith(prodUrl, '_blank');
      const openedUrl = windowOpenSpy.mock.calls[0][0] as string;
      expect(openedUrl).toBe(prodUrl);
    });

    it('Requirement 3 & 6: Applicant responds to REQUEST_VYASA_SESSION strictly from configured origin', async () => {
      const prodUrl = 'https://nivaran-doctoral-frontend.onrender.com';
      import.meta.env.VITE_NIVARAN_APP_URL = prodUrl;
      const expectedOrigin = 'https://nivaran-doctoral-frontend.onrender.com';
      vi.spyOn(authService, 'getToken').mockReturnValue('applicant-token-456');

      render(
        <MemoryRouter>
          <ApplicantPillarsSection />
        </MemoryRouter>
      );

      const attackerPostMessageSpy = vi.fn();
      const legitimatePostMessageSpy = vi.fn();

      // Requirement 6: Untrusted/Attacker origin is strictly ignored
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil-spoofed-site.com',
          data: { type: 'REQUEST_VYASA_SESSION' },
          source: { postMessage: attackerPostMessageSpy } as unknown as MessageEventSource,
        })
      );
      expect(attackerPostMessageSpy).not.toHaveBeenCalled();

      // Requirement 3: Legitimate configured origin receives token with exact targetOrigin
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: expectedOrigin,
          data: { type: 'REQUEST_VYASA_SESSION' },
          source: { postMessage: legitimatePostMessageSpy } as unknown as MessageEventSource,
        })
      );

      await waitFor(() => {
        expect(legitimatePostMessageSpy).toHaveBeenCalledWith(
          { type: 'VYASA_SESSION_TOKEN', token: 'applicant-token-456', role: 'applicant' },
          expectedOrigin
        );
      });
    });
  });

  describe('Authority Open NIVARAN & postMessage Handshake', () => {
    it('Requirement 2 & 7: Authority Open NIVARAN uses configured URL with NO token in URL', async () => {
      import.meta.env.VITE_NIVARAN_APP_URL = 'http://localhost:5174';
      vi.spyOn(authService, 'getToken').mockReturnValue('authority-jwt-secret-token-789');

      const mockOpenedWindow = { postMessage: vi.fn() } as unknown as Window;
      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(mockOpenedWindow);

      render(
        <MemoryRouter>
          <AuthProvider>
            <AuthorityDashboard />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));

      // 2. Verifies opened URL matches configured URL
      expect(windowOpenSpy).toHaveBeenCalledWith('http://localhost:5174', '_blank');

      // 7. Verifies NO token in URL
      const openedUrl = windowOpenSpy.mock.calls[0][0] as string;
      expect(openedUrl).not.toContain('authority-jwt-secret-token-789');
      expect(openedUrl).not.toContain('token=');
    });

    it('Requirement 2 (Production): Authority Open NIVARAN uses production Render URL when configured', async () => {
      const prodUrl = 'https://nivaran-doctoral-frontend.onrender.com';
      import.meta.env.VITE_NIVARAN_APP_URL = prodUrl;
      vi.spyOn(authService, 'getToken').mockReturnValue('authority-jwt-token');

      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({ postMessage: vi.fn() } as unknown as Window);

      render(
        <MemoryRouter>
          <AuthProvider>
            <AuthorityDashboard />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));

      expect(windowOpenSpy).toHaveBeenCalledWith(prodUrl, '_blank');
      const openedUrl = windowOpenSpy.mock.calls[0][0] as string;
      expect(openedUrl).toBe(prodUrl);
    });

    it('Requirement 3 & 6: Authority responds to REQUEST_VYASA_SESSION strictly from configured origin', async () => {
      const prodUrl = 'https://nivaran-doctoral-frontend.onrender.com';
      import.meta.env.VITE_NIVARAN_APP_URL = prodUrl;
      const expectedOrigin = 'https://nivaran-doctoral-frontend.onrender.com';
      vi.spyOn(authService, 'getToken').mockReturnValue('authority-token-xyz');

      render(
        <MemoryRouter>
          <AuthProvider>
            <AuthorityDashboard />
          </AuthProvider>
        </MemoryRouter>
      );

      const attackerPostMessageSpy = vi.fn();
      const legitimatePostMessageSpy = vi.fn();

      // Requirement 6: Untrusted/Attacker origin is strictly ignored
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://malicious-phishing.org',
          data: { type: 'REQUEST_VYASA_SESSION' },
          source: { postMessage: attackerPostMessageSpy } as unknown as MessageEventSource,
        })
      );
      expect(attackerPostMessageSpy).not.toHaveBeenCalled();

      // Requirement 3: Legitimate configured origin receives token with exact targetOrigin
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: expectedOrigin,
          data: { type: 'REQUEST_VYASA_SESSION' },
          source: { postMessage: legitimatePostMessageSpy } as unknown as MessageEventSource,
        })
      );

      await waitFor(() => {
        expect(legitimatePostMessageSpy).toHaveBeenCalledWith(
          { type: 'VYASA_SESSION_TOKEN', token: 'authority-token-xyz' },
          expectedOrigin
        );
      });
    });
  });
});
