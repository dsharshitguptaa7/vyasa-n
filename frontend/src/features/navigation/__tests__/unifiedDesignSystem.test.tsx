import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vyasaColors, vyasaTokens, LoadingState, BookLoader } from '@vyasa/ui';
import { VyasaPortalSidebar } from '../../dashboard/components/VyasaPortalSidebar';
import { ApplicantSidebar } from '../../applicant/components/ApplicantSidebar';
import { AdminSidebar } from '../../../admin/components/AdminSidebar';
import { VyasaDashboardPage } from '../../dashboard/VyasaDashboardPage';
import { SamaVedaDashboardPage } from '../../../modules/sama-veda/pages/SamaVedaDashboardPage';
import * as AuthContextModule from '../../../context/AuthContext';

// Mock dependencies
vi.mock('../../../services/notificationService', () => ({
  notificationService: {
    getSummary: vi.fn().mockResolvedValue({ unread_count: 3 }),
  },
}));

vi.mock('../../../modules/atharva-veda/nivaran/services/grievanceService', () => ({
  grievanceService: {
    getMyGrievances: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../modules/sama-veda/services/samaVedaService', () => ({
  samaVedaService: {
    getBulletins: vi.fn().mockResolvedValue({ items: [] }),
    getCamProjects: vi.fn().mockResolvedValue({ items: [] }),
    getFellowships: vi.fn().mockResolvedValue({ items: [] }),
    getSpotlights: vi.fn().mockResolvedValue({ items: [] }),
    getPublications: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getAuthors: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    verifyCertificate: vi.fn(),
    downloadCertificate: vi.fn(),
    downloadBulletin: vi.fn(),
  },
}));

describe('VYASA Ecosystem Unified Design System & Token Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUserWithRole = (roles: string[], email: string = 'scholar@csjmu.ac.in') => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-1', email, roles },
      token: 'jwt-token',
      isAuthenticated: true,
      isLoading: false,
      isAdmin: roles.includes('super_admin') || roles.includes('administrator'),
      isSuperAdmin: roles.includes('super_admin'),
      isAuthority: roles.includes('authority'),
      isApplicant: roles.includes('applicant'),
      isManager: roles.includes('manager'),
      isAssistantDean: false,
      isAssociateDean: false,
      isDean: false,
      authorityRole: null,
      authorityId: null,
      authorityDesignation: null,
      persona: roles.includes('super_admin') ? 'admin' : 'guest',
      displayName: 'Test Scholar',
      login: vi.fn(),
      completeTwoFactorAuth: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  };

  describe('1. Centralized Global Color Palette & Design Tokens', () => {
    it('1.1 Verifies canonical brand color tokens (Deep Navy, Ivory, Gold, Teal, White)', () => {
      // Deep Navy Blue (Primary)
      expect(vyasaColors.primary.toLowerCase()).toBe('#0f2b48');
      expect(vyasaColors.primarySurface.toLowerCase()).toBe('#eff5fa');

      // Warm Ivory / Off-White (Primary Page Ground)
      expect(vyasaColors.ivory.toLowerCase()).toBe('#faf7f2');
      expect(vyasaColors.surface.toLowerCase()).toBe('#ffffff');

      // Muted Gold (Brand Highlights & Dividers)
      expect(vyasaColors.gold.toLowerCase()).toBe('#b2811a');

      // Teal (Restrained Secondary Accent for Research & Innovation)
      expect(vyasaColors.teal.toLowerCase()).toBe('#0d766e');

      // Text colors
      expect(vyasaColors.text.toLowerCase()).toBe('#19202a');
      expect(vyasaColors.textSecondary.toLowerCase()).toBe('#4b5565');

      // Borders
      expect(vyasaColors.border.toLowerCase()).toBe('#e3dcd1');
    });

    it('1.2 Verifies canonical semantic feedback tokens', () => {
      expect(vyasaColors.success.toLowerCase()).toBe('#15803d');
      expect(vyasaColors.warning.toLowerCase()).toBe('#b45309');
      expect(vyasaColors.danger.toLowerCase()).toBe('#b91c1c');
      expect(vyasaColors.info.toLowerCase()).toBe('#0d766e');
    });

    it('1.3 Verifies standardized layout, radii, and animation transition tokens', () => {
      expect(vyasaTokens.spacing[4]).toBe('1rem');
      expect(vyasaTokens.radii.sm).toBe('4px');
      expect(vyasaTokens.radii.md).toBe('6px');
      expect(vyasaTokens.transitions.fast).toContain('120ms');
      expect(vyasaTokens.transitions.normal).toContain('200ms');
    });
  });

  describe('2. Scholarly Book-Page Loading Animation', () => {
    it('2.1 Renders BookLoader with accessible status role and polite announcement', () => {
      render(<BookLoader message="Opening academic records..." />);

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl.getAttribute('aria-live')).toBe('polite');
      expect(screen.getByText('Opening academic records...')).toBeInTheDocument();
    });

    it('2.2 LoadingState defaults to book-page animation variant', () => {
      const { container } = render(<LoadingState message="Synchronizing with VYASA core..." />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Synchronizing with VYASA core...')).toBeInTheDocument();
      expect(container.querySelector('.vyasa-book-loader')).toBeInTheDocument();
      expect(container.querySelector('.vyasa-book-loader__book')).toBeInTheDocument();
      expect(container.querySelector('.vyasa-book-loader__page-flipping')).toBeInTheDocument();
    });

    it('2.3 LoadingState supports legacy spinner variant when explicitly requested', () => {
      const { container } = render(<LoadingState variant="spinner" message="Processing..." />);

      expect(container.querySelector('.vyasa-spinner')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  describe('3. Unified Color Palette & Consistency Across Sidebars', () => {
    it('3.1 VyasaPortalSidebar uses unified design tokens for active and surface states', () => {
      mockUserWithRole(['authority']);

      const { container } = render(
        <MemoryRouter>
          <VyasaPortalSidebar activeItem="dashboard" />
        </MemoryRouter>
      );

      const aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
      // Border right matches unified design token
      expect(aside?.getAttribute('style')).toContain('var(--vyasa-border');

      const dashboardBtn = screen.getByRole('button', { name: /dashboard/i });
      // Active background and text color use semantic primary tokens
      expect(dashboardBtn.getAttribute('style')).toContain('var(--vyasa-primary-surface');
      expect(dashboardBtn.getAttribute('style')).toContain('var(--vyasa-primary');
    });

    it('3.2 ApplicantSidebar uses unified design tokens for active and surface states', () => {
      mockUserWithRole(['applicant']);

      const { container } = render(
        <MemoryRouter>
          <ApplicantSidebar activeTab="dashboard" />
        </MemoryRouter>
      );

      const aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
      expect(aside?.getAttribute('style')).toContain('var(--vyasa-border');

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink.getAttribute('style')).toContain('var(--vyasa-primary');
    });

    it('3.3 AdminSidebar uses unified design tokens for active navigation states', () => {
      mockUserWithRole(['super_admin']);

      const { container } = render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminSidebar />
        </MemoryRouter>
      );

      const aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
      expect(aside?.getAttribute('style')).toContain('var(--vyasa-border');
    });
  });

  describe('4. Module Consistency: ANVESHAN & NIVARAN', () => {
    it('4.1 ANVESHAN research dashboard uses unified institutional palette without arbitrary neons', () => {
      mockUserWithRole(['applicant']);

      const { container } = render(
        <MemoryRouter initialEntries={['/modules/sama-veda']}>
          <SamaVedaDashboardPage />
        </MemoryRouter>
      );

      // Verify header banner presence
      expect(screen.getByText(/SAMIKSHA • Research, Recognition & Innovation Portal/i)).toBeInTheDocument();
      expect(screen.getByText(/Discover. Research. Inspire./i)).toBeInTheDocument();

      // Navigation tabs adhere to unified border tokens
      const tabsContainer = container.querySelector('div[style*="border-bottom"]');
      expect(tabsContainer).toBeInTheDocument();
    });

    it('4.2 Authenticated Dashboard launches both NIVARAN and ANVESHAN using institutional brand colors', () => {
      mockUserWithRole(['applicant']);

      render(
        <MemoryRouter>
          <VyasaDashboardPage />
        </MemoryRouter>
      );

      const nivaranCard = screen.getByTestId('service-card-nivaran');
      const anveshanCard = screen.getByTestId('service-card-anveshan');
      const nivaranBtn = screen.getByTestId('open-service-btn-nivaran');

      expect(nivaranCard).toBeInTheDocument();
      expect(anveshanCard).toBeInTheDocument();

      // ANVESHAN card uses restrained teal accent
      expect(anveshanCard.getAttribute('style')).toContain('var(--vyasa-teal');

      // NIVARAN card uses gold border and primary navy action button
      expect(nivaranCard.getAttribute('style')).toContain('var(--vyasa-gold');
      expect(nivaranBtn.getAttribute('style')).toContain('var(--vyasa-primary');
    });
  });
});
