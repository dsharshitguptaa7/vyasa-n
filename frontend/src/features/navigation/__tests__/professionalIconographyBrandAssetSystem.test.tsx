import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppIcon, DropdownChevron, NotificationBell } from '@vyasa/ui';
import { PublicNavbar } from '../../../components/common/PublicNavbar';
import { Navbar } from '../../../components/common/Navbar';
import { ServicesMenu } from '../../../components/common/ServicesMenu';
import { ProfileMenu } from '../../../components/common/ProfileMenu';
import { ApplicantSidebar } from '../../applicant/components/ApplicantSidebar';
import * as AuthContextModule from '../../../context/AuthContext';
import { AuthenticatedUser } from '../../../types/auth';

const mockScholarUser: AuthenticatedUser = {
  id: 'user-scholar-1',
  email: 'scholar@csjmu.ac.in',
  first_name: 'Harshit',
  last_name: 'Gupta',
  fullName: 'Harshit Gupta',
  roles: ['applicant'],
  is_active: true,
  is_verified: true,
};

const mockAuth = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
  const defaultAuth: AuthContextModule.AuthContextValue = {
    user: mockScholarUser,
    token: 'valid-test-token',
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    hasRole: vi.fn(),
    hasAuthorityRole: vi.fn(),
    isSuperAdmin: false,
    isAdmin: false,
    isAuthority: false,
    isApplicant: true,
    isGuest: false,
    isManager: false,
    isAssistantDean: false,
    isAssociateDean: false,
    isDean: false,
    isFixedAuthority: false,
    authorityRole: null,
    authorityId: null,
    authorityDesignation: null,
    displayName: 'Harshit Gupta',
    ...overrides,
  };

  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
  return defaultAuth;
};

describe('VYASA Professional Iconography & Brand Asset System Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------
   * 1. Professional Icon Library & Consistency
   * ----------------------------------------------------------------------- */
  describe('1. Global Icon Family & Lucide-Style SVG Standards', () => {
    it('renders AppIcon with standard Lucide outline attributes (viewBox, strokeWidth, lineCap)', () => {
      const { container } = render(<AppIcon name="user" size={20} color="#0f2b48" />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg).toHaveAttribute('stroke-width', '2');
      expect(svg).toHaveAttribute('stroke-linecap', 'round');
      expect(svg).toHaveAttribute('stroke-linejoin', 'round');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('supports functional accessibility titles when specified', () => {
      const { container } = render(<AppIcon name="search" title="Search Ecosystem" />);
      const svg = container.querySelector('svg');
      const title = container.querySelector('title');

      expect(svg).toHaveAttribute('role', 'img');
      expect(svg).not.toHaveAttribute('aria-hidden');
      expect(title).toHaveTextContent('Search Ecosystem');
    });

    it('renders DropdownChevron with smooth state rotation class and standard stroke', () => {
      const { container, rerender } = render(<DropdownChevron isOpen={false} size={14} />);
      const svgClosed = container.querySelector('svg');
      expect(svgClosed).toHaveClass('vyasa-chevron-icon');
      expect(svgClosed).not.toHaveClass('is-open');

      rerender(<DropdownChevron isOpen={true} size={14} />);
      const svgOpen = container.querySelector('svg');
      expect(svgOpen).toHaveClass('is-open');
    });

    it('renders NotificationBell with subtle unread indicator dot', () => {
      const { container, rerender } = render(<NotificationBell hasUnread={false} size={18} />);
      expect(container.querySelectorAll('span').length).toBe(1); // container only

      rerender(<NotificationBell hasUnread={true} size={18} />);
      expect(container.querySelectorAll('span').length).toBe(2); // container + indicator
    });
  });

  /* -------------------------------------------------------------------------
   * 2. No UI Emojis in Navigation, Dropdowns, and Cards
   * ----------------------------------------------------------------------- */
  describe('2. Elimination of UI Emojis across Navigation and Dropdowns', () => {
    it('Login dropdown uses SVG icons instead of raw emojis for Scholar and Authority', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <AuthContextModule.AuthProvider>
            <PublicNavbar />
          </AuthContextModule.AuthProvider>
        </MemoryRouter>
      );

      const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
      fireEvent.click(loginBtn);

      const menu = screen.getByTestId('login-dropdown-menu');
      expect(menu).toBeInTheDocument();

      // Verify SVG icons exist inside the menu items
      const svgs = menu.querySelectorAll('svg.vyasa-icon');
      expect(svgs.length).toBeGreaterThanOrEqual(2);
      expect(menu.querySelector('.vyasa-icon--graduation-cap')).toBeInTheDocument();
      expect(menu.querySelector('.vyasa-icon--building')).toBeInTheDocument();
    });

    it('Register dropdown uses SVG icons instead of raw emojis', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <AuthContextModule.AuthProvider>
            <PublicNavbar />
          </AuthContextModule.AuthProvider>
        </MemoryRouter>
      );

      const regBtn = screen.getByRole('button', { name: /^REGISTER/i });
      fireEvent.click(regBtn);

      const menu = screen.getByTestId('register-dropdown-menu');
      expect(menu.querySelector('.vyasa-icon--graduation-cap')).toBeInTheDocument();
    });

    it('Services dropdown uses professional SVG shield icon for NIVARAN-AI', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <ServicesMenu />
        </MemoryRouter>
      );

      const servicesBtn = screen.getByRole('button', { name: /Services/i });
      fireEvent.click(servicesBtn);

      const menu = screen.getByRole('menu', { name: /Available VYASA Services/i });
      const shieldIcon = menu.querySelector('.vyasa-icon--shield');
      expect(shieldIcon).toBeInTheDocument();
    });

    it('Profile menu uses professional user and logout outline SVG icons', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <ProfileMenu />
        </MemoryRouter>
      );

      const profileBtn = screen.getByTestId('navbar-profile-btn');
      fireEvent.click(profileBtn);

      const menu = screen.getByTestId('navbar-profile-dropdown');
      expect(menu.querySelector('.vyasa-icon--user')).toBeInTheDocument();
      expect(menu.querySelector('.vyasa-icon--log-out')).toBeInTheDocument();
    });

    it('Applicant sidebar uses consistent SVG outline icons for all navigation items', () => {
      const onSelectTab = vi.fn();

      render(
        <ApplicantSidebar
          currentTab="overview"
          onSelectTab={onSelectTab}
          scholarName="Harshit Gupta"
          subjectName="M.Sc. Mathematics with AI"
        />
      );

      expect(document.querySelector('.vyasa-icon--building')).toBeInTheDocument();
      expect(document.querySelector('.vyasa-icon--graduation-cap')).toBeInTheDocument();
      expect(document.querySelector('.vyasa-icon--globe')).toBeInTheDocument();
      expect(document.querySelector('.vyasa-icon--bell')).toBeInTheDocument();
      expect(document.querySelector('.vyasa-icon--shield')).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------
   * 3. VYASA Logo & Centered Tagline Identity Lockup
   * ----------------------------------------------------------------------- */
  describe('3. Brand Assets & Centered Vertical Axis Lockup', () => {
    it('PublicNavbar renders dedicated vertical logo-lockup container with centered tagline', () => {
      mockAuth();

      const { container } = render(
        <MemoryRouter>
          <AuthContextModule.AuthProvider>
            <PublicNavbar />
          </AuthContextModule.AuthProvider>
        </MemoryRouter>
      );

      const lockup = container.querySelector('.vyasa-public-logo-lockup');
      expect(lockup).toBeInTheDocument();

      const logoImg = lockup?.querySelector('img');
      const tagline = lockup?.querySelector('.vyasa-public-logo-tagline');

      expect(logoImg).toBeInTheDocument();
      expect(tagline).toBeInTheDocument();
      expect(tagline).toHaveTextContent('ज्ञान से शोध तक, AI के साथ');
    });
  });

  /* -------------------------------------------------------------------------
   * 4. Responsive Mobile Navigation Drawer (Shell 1 & Shell 2)
   * ----------------------------------------------------------------------- */
  describe('4. Authenticated Responsive Mobile Navigation Drawer', () => {
    it('Authenticated NIVARAN shell renders mobile toggle and opens drawer with focus and backdrop', () => {
      mockAuth({
        isAuthenticated: true,
        isApplicant: true,
        displayName: 'Harshit Gupta',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/my-grievances']}>
          <Navbar />
        </MemoryRouter>
      );

      const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i });
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

      // Click to open drawer
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

      // Drawer dialog should be visible
      const drawer = screen.getByRole('dialog', { name: /NIVARAN Service Mobile Menu/i });
      expect(drawer).toBeInTheDocument();
      expect(screen.getByText('Return to VYASA Dashboard')).toBeInTheDocument();

      // Press Escape to dismiss
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      expect(screen.queryByRole('dialog', { name: /NIVARAN Service Mobile Menu/i })).not.toBeInTheDocument();
    });
  });
});

