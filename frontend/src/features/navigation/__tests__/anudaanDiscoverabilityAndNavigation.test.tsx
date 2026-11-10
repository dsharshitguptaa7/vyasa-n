import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FourDomainsSection from '../../landing/components/FourDomainsSection';
import { UnifiedSidebar } from '../../../components/layout/UnifiedSidebar';
import { VyasaPortalSidebar } from '../../dashboard/components/VyasaPortalSidebar';
import { PublicShell } from '../../../components/layout/PublicShell';
import * as AuthContextModule from '../../../context/AuthContext';
import { getActiveServices } from '../../../services/serviceRegistry';
import { getAnudaanNavItems } from '../../../config/navigation';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock notification service
vi.mock('../../../services/notificationService', () => ({
  notificationService: {
    getSummary: vi.fn().mockResolvedValue({ unread_count: 0 }),
  },
}));

// Mock Anudaan service to avoid network calls
vi.mock('../../../modules/yajur-veda/services/anudaanService', () => ({
  anudaanService: {
    checkHealth: vi.fn().mockResolvedValue({ status: 'healthy', module: 'anudaan' }),
    createDraft: vi.fn(),
    resumeDraft: vi.fn(),
  },
  ApiError: class extends Error {},
}));

describe('ANUDAAN Phase 4.3.2: Public Discoverability & Authenticated Dashboard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAuth = (overrides: Partial<any> = {}) => {
    const defaultAuth = {
      isAuthenticated: false,
      user: null,
      displayName: '',
      isApplicant: false,
      isAuthority: false,
      isDean: false,
      isAdmin: false,
      isSuperAdmin: false,
      logout: vi.fn(),
      ...overrides,
    };
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth as any);
    return defaultAuth;
  };

  describe('1. Public Homepage Discoverability (FourDomainsSection)', () => {
    it('1.1 Renders Yajur Veda with ANUDAAN title, badge, and institutional description', () => {
      render(
        <MemoryRouter>
          <FourDomainsSection />
        </MemoryRouter>
      );

      // Verify Yajur Veda title
      expect(screen.getByRole('heading', { level: 3, name: 'Yajur Veda' })).toBeInTheDocument();

      // Verify Operational Domain Badge
      const badges = screen.getAllByText('Operational Domain');
      expect(badges.length).toBeGreaterThanOrEqual(2); // Atharva Veda and Yajur Veda

      // Verify ANUDAAN dimension heading
      expect(
        screen.getByText(/ANUDAAN\s+[–-]\s+Research Publication Incentive Management System/i)
      ).toBeInTheDocument();

      // Verify institutional eligibility description
      expect(
        screen.getByText(/eligible CSJMU Campus Faculty, Registered Research Scholars and Post-Doctoral Researchers/i)
      ).toBeInTheDocument();

      // Verify Subsystem Portal indicator
      expect(screen.getByText('Portal: ANUDAAN')).toBeInTheDocument();

      // Verify CTA button
      const ctaBtn = screen.getByRole('button', { name: /Open Yajur Veda \/ ANUDAAN/i });
      expect(ctaBtn).toBeInTheDocument();
      expect(ctaBtn).toHaveTextContent(/Explore ANUDAAN/i);
    });

    it('1.2 Clicking "Explore ANUDAAN" navigates to /modules/yajur-veda/anudaan', () => {
      render(
        <MemoryRouter>
          <FourDomainsSection />
        </MemoryRouter>
      );

      const ctaBtn = screen.getByRole('button', { name: /Open Yajur Veda \/ ANUDAAN/i });
      fireEvent.click(ctaBtn);

      expect(mockNavigate).toHaveBeenCalledWith('/modules/yajur-veda/anudaan');
    });
  });

  describe('2. Service Registry & Navigation Config Integration', () => {
    it('2.1 serviceRegistry registers ANUDAAN as an active service with canonical route', () => {
      const activeServices = getActiveServices();
      const anudaanService = activeServices.find((s) => s.id === 'anudaan');

      expect(anudaanService).toBeDefined();
      expect(anudaanService?.name).toBe('ANUDAAN');
      expect(anudaanService?.subtitle).toBe('Research Publication Incentives');
      expect(anudaanService?.route).toBe('/modules/yajur-veda/anudaan');
      expect(anudaanService?.pillar).toBe('Yajur Veda');
      expect(anudaanService?.isActive).toBe(true);
    });

    it('2.2 getAnudaanNavItems returns canonical portal, apply, and track items', () => {
      const items = getAnudaanNavItems();
      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({
        id: 'anudaan-portal',
        label: 'Incentive Portal',
        path: '/modules/yajur-veda/anudaan',
        icon: 'building',
      });
      expect(items[1]).toEqual({
        id: 'anudaan-apply',
        label: 'Apply for Incentive',
        path: '/modules/yajur-veda/anudaan/apply',
        icon: 'file-text',
      });
      expect(items[2]).toEqual({
        id: 'anudaan-track',
        label: 'Track Application',
        path: '/modules/yajur-veda/anudaan/track',
        icon: 'search',
      });
    });
  });

  describe('3. Authenticated UnifiedSidebar Integration', () => {
    it('3.1 UnifiedSidebar renders ANUDAAN accordion with label and subtitle under SERVICES', () => {
      mockAuth({
        isAuthenticated: true,
        displayName: 'Dr. Faculty Member',
        isApplicant: false,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <UnifiedSidebar />
        </MemoryRouter>
      );

      expect(screen.getByText('ANUDAAN')).toBeInTheDocument();
      expect(screen.getByText('Research Publication Incentives')).toBeInTheDocument();
    });

    it('3.2 Expanding ANUDAAN renders Incentive Portal, Apply, and Track subitems', () => {
      mockAuth({
        isAuthenticated: true,
        displayName: 'Dr. Faculty Member',
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <UnifiedSidebar />
        </MemoryRouter>
      );

      // Toggle ANUDAAN accordion open
      const toggleBtn = screen.getByRole('button', { name: /Toggle ANUDAAN sections/i });
      fireEvent.click(toggleBtn);

      expect(screen.getByText('Incentive Portal')).toBeInTheDocument();
      expect(screen.getByText('Apply for Incentive')).toBeInTheDocument();
      expect(screen.getByText('Track Application')).toBeInTheDocument();
    });

    it('3.3 UnifiedSidebar auto-expands ANUDAAN when current location is under /modules/yajur-veda', () => {
      mockAuth({
        isAuthenticated: true,
        displayName: 'Dr. Faculty Member',
      });

      render(
        <MemoryRouter initialEntries={['/modules/yajur-veda/anudaan']}>
          <UnifiedSidebar />
        </MemoryRouter>
      );

      // Without clicking toggle, subitems should be visible because route matches
      expect(screen.getByText('Incentive Portal')).toBeInTheDocument();
      expect(screen.getByText('Apply for Incentive')).toBeInTheDocument();
      expect(screen.getByText('Track Application')).toBeInTheDocument();
    });
  });

  describe('4. VyasaPortalSidebar Integration', () => {
    it('4.1 VyasaPortalSidebar renders ANUDAAN item and navigates on click', () => {
      mockAuth({
        isAuthenticated: true,
        displayName: 'Scholar User',
        isApplicant: true,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <VyasaPortalSidebar />
        </MemoryRouter>
      );

      const anudaanBtn = screen.getByRole('button', { name: /ANUDAAN/i });
      expect(anudaanBtn).toBeInTheDocument();

      fireEvent.click(anudaanBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/modules/yajur-veda/anudaan');
    });
  });

  describe('5. Shell Consistency: Public vs Authenticated Mode', () => {
    it('5.1 Unauthenticated access renders within PublicShell without UnifiedSidebar', () => {
      mockAuth({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={['/modules/yajur-veda/anudaan']}>
          <PublicShell currentTab="pillars">
            <div data-testid="anudaan-content">ANUDAAN Public Content</div>
          </PublicShell>
        </MemoryRouter>
      );

      // Content renders
      expect(screen.getByTestId('anudaan-content')).toBeInTheDocument();
      // Public shell top banner header is rendered
      expect(screen.getByRole('banner')).toBeInTheDocument();
      // Authenticated unified sidebar is NOT rendered
      expect(document.querySelector('.vyasa-unified-sidebar')).not.toBeInTheDocument();
      expect(screen.queryByText('Research Publication Incentives')).not.toBeInTheDocument();
    });

    it('5.2 Authenticated access seamlessly wraps inside WorkspaceShell with UnifiedSidebar', () => {
      mockAuth({
        isAuthenticated: true,
        displayName: 'Prof. Researcher',
      });

      render(
        <MemoryRouter initialEntries={['/modules/yajur-veda/anudaan']}>
          <PublicShell currentTab="pillars">
            <div data-testid="anudaan-content">ANUDAAN Authenticated Content</div>
          </PublicShell>
        </MemoryRouter>
      );

      // Content renders
      expect(screen.getByTestId('anudaan-content')).toBeInTheDocument();
      // WorkspaceShell renders left UnifiedSidebar with ANUDAAN section
      expect(document.querySelector('.vyasa-unified-sidebar')).toBeInTheDocument();
      expect(screen.getByText('ANUDAAN')).toBeInTheDocument();
      expect(screen.getByText('Incentive Portal')).toBeInTheDocument();
    });
  });

  describe('6. Mobile Drawer Responsiveness', () => {
    it('6.1 Mobile toggle button opens drawer with ANUDAAN navigation intact', () => {
      mockAuth({
        isAuthenticated: true,
        displayName: 'Mobile Researcher',
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <UnifiedSidebar />
        </MemoryRouter>
      );

      const mobileToggle = screen.getByLabelText('Toggle navigation menu');
      expect(mobileToggle).toBeInTheDocument();

      // Open drawer
      fireEvent.click(mobileToggle);

      // Overlay should be present with ANUDAAN (both desktop sidebar and mobile drawer)
      const anudaanLabels = screen.getAllByText('Research Publication Incentives');
      expect(anudaanLabels.length).toBe(2);
    });
  });
});
