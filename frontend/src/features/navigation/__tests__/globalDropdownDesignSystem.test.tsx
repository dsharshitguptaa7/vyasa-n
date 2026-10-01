import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicNavbar } from '../../../components/common/PublicNavbar';
import { ServicesMenu } from '../../../components/common/ServicesMenu';
import { ProfileMenu } from '../../../components/common/ProfileMenu';
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

describe('VYASA Global Dropdown Design System - Neutral Institutional UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------
   * 1. Public Navbar - Login Dropdown
   * ----------------------------------------------------------------------- */
  describe('1. Login Dropdown (Public Navbar)', () => {
    it('renders clean institutional Login trigger and toggles menu', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthContextModule.AuthProvider>
            <PublicNavbar />
          </AuthContextModule.AuthProvider>
        </MemoryRouter>
      );

      const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
      expect(loginBtn).toBeInTheDocument();
      expect(loginBtn).toHaveAttribute('aria-haspopup', 'menu');
      expect(loginBtn).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(loginBtn);
      expect(loginBtn).toHaveAttribute('aria-expanded', 'true');

      const menu = screen.getByTestId('login-dropdown-menu');
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveClass('vyasa-access-menu');
      expect(menu).toHaveAttribute('role', 'menu');
    });

    it('contains Applicant / Scholar and Authority Sign In items with proper hierarchy', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthContextModule.AuthProvider>
            <PublicNavbar />
          </AuthContextModule.AuthProvider>
        </MemoryRouter>
      );

      const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
      fireEvent.click(loginBtn);

      const menu = screen.getByTestId('login-dropdown-menu');
      expect(menu).toHaveTextContent('LOGIN');
      expect(menu).toHaveTextContent('Applicant / Scholar');
      expect(menu).toHaveTextContent('Access Scholar Workspace');
      expect(menu).toHaveTextContent('Authority');
      expect(menu).toHaveTextContent('Institutional Authority Sign In');
    });

    it('handles keyboard navigation with Escape key dismissing the menu', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthContextModule.AuthProvider>
            <PublicNavbar />
          </AuthContextModule.AuthProvider>
        </MemoryRouter>
      );

      const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
      fireEvent.click(loginBtn);
      expect(screen.getByTestId('login-dropdown-menu')).toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole('banner'), { key: 'Escape' });
      expect(screen.queryByTestId('login-dropdown-menu')).not.toBeInTheDocument();
      expect(loginBtn).toHaveAttribute('aria-expanded', 'false');
    });
  });

  /* -------------------------------------------------------------------------
   * 2. Public Navbar - Register Dropdown
   * ----------------------------------------------------------------------- */
  describe('2. Register Dropdown (Public Navbar)', () => {
    it('renders Register trigger and opens register menu', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthContextModule.AuthProvider>
            <PublicNavbar />
          </AuthContextModule.AuthProvider>
        </MemoryRouter>
      );

      const regBtn = screen.getByRole('button', { name: /^REGISTER/i });
      expect(regBtn).toBeInTheDocument();
      expect(regBtn).toHaveAttribute('aria-haspopup', 'menu');

      fireEvent.click(regBtn);
      const menu = screen.getByTestId('register-dropdown-menu');
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveClass('vyasa-access-menu');
      expect(menu).toHaveTextContent('REGISTER');
      expect(menu).toHaveTextContent('Applicant / Scholar');
      expect(menu).toHaveTextContent('Create Scholar Account');
    });

    it('strictly DOES NOT offer Authority registration option per institutional protocol', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthContextModule.AuthProvider>
            <PublicNavbar />
          </AuthContextModule.AuthProvider>
        </MemoryRouter>
      );

      const regBtn = screen.getByRole('button', { name: /^REGISTER/i });
      fireEvent.click(regBtn);

      const menu = screen.getByTestId('register-dropdown-menu');
      expect(menu).not.toHaveTextContent(/Authority Registration/i);
      expect(menu).not.toHaveTextContent(/Register Authority/i);
    });
  });

  /* -------------------------------------------------------------------------
   * 3. Services Dropdown (ServicesMenu)
   * ----------------------------------------------------------------------- */
  describe('3. Services Dropdown (ServicesMenu)', () => {
    it('uses light institutional surface (#ffffff) and soft elevation shadow', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <ServicesMenu />
        </MemoryRouter>
      );

      const servicesBtn = screen.getByRole('button', { name: /Services/i });
      fireEvent.click(servicesBtn);

      const menu = screen.getByRole('menu', { name: /Available VYASA Services/i });
      expect(menu).toBeInTheDocument();
      expect(menu.style.backgroundColor).toBe('rgb(255, 255, 255)');
      expect(menu.style.boxShadow).toContain('0 6px 18px rgba(0, 0, 0, 0.08)');
      expect(menu.style.borderRadius).toBe('8px');
    });

    it('features neutral header styling instead of dark AI banner', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <ServicesMenu />
        </MemoryRouter>
      );

      const servicesBtn = screen.getByRole('button', { name: /Services/i });
      fireEvent.click(servicesBtn);

      expect(screen.getByText('Institutional Services')).toBeInTheDocument();
      expect(screen.getByText('CSJMU Autonomous Portals')).toBeInTheDocument();
    });

    it('renders NIVARAN-AI portal link with active badge', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <ServicesMenu />
        </MemoryRouter>
      );

      const servicesBtn = screen.getByRole('button', { name: /Services/i });
      fireEvent.click(servicesBtn);

      expect(screen.getByText('NIVARAN-AI')).toBeInTheDocument();
      expect(screen.getByText('AI-Assisted Grievance Redressal')).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------
   * 4. Profile Dropdown (ProfileMenu)
   * ----------------------------------------------------------------------- */
  describe('4. Profile Dropdown (ProfileMenu)', () => {
    it('uses light institutional surface (#ffffff) and soft elevation shadow', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <ProfileMenu />
        </MemoryRouter>
      );

      const profileBtn = screen.getByTestId('navbar-profile-btn');
      fireEvent.click(profileBtn);

      const menu = screen.getByTestId('navbar-profile-dropdown');
      expect(menu).toBeInTheDocument();
      expect(menu.style.backgroundColor).toBe('rgb(255, 255, 255)');
      expect(menu.style.boxShadow).toContain('0 6px 18px rgba(0, 0, 0, 0.08)');
      expect(menu.style.borderRadius).toBe('8px');
    });

    it('renders user dossier in neutral warm surface (#f8fafc) with academic typography', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <ProfileMenu />
        </MemoryRouter>
      );

      const profileBtn = screen.getByTestId('navbar-profile-btn');
      fireEvent.click(profileBtn);

      const userName = screen.getByTestId('profile-dropdown-user-name');
      const userEmail = screen.getByTestId('profile-dropdown-user-email');

      expect(userName).toHaveTextContent('Harshit Gupta');
      expect(userEmail).toHaveTextContent('scholar@csjmu.ac.in');
    });

    it('renders Institutional Profile and Sign Out menu items', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <ProfileMenu />
        </MemoryRouter>
      );

      const profileBtn = screen.getByTestId('navbar-profile-btn');
      fireEvent.click(profileBtn);

      expect(screen.getByTestId('profile-menu-item-profile')).toHaveTextContent('Institutional Profile');
      expect(screen.getByTestId('profile-menu-item-signout')).toHaveTextContent('Sign Out');
    });
  });

  /* -------------------------------------------------------------------------
   * 5. Non-AI Visual Language & Global Standard Verification
   * ----------------------------------------------------------------------- */
  describe('5. Non-AI Visual Language Compliance', () => {
    it('does not render dark navy dropdown containers for any menu', () => {
      mockAuth();

      render(
        <MemoryRouter>
          <AuthContextModule.AuthProvider>
            <PublicNavbar />
            <ServicesMenu />
            <ProfileMenu />
          </AuthContextModule.AuthProvider>
        </MemoryRouter>
      );

      // Open all menus
      const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
      fireEvent.click(loginBtn);

      const servicesBtn = screen.getByRole('button', { name: /Services/i });
      fireEvent.click(servicesBtn);

      const profileBtn = screen.getByTestId('navbar-profile-btn');
      fireEvent.click(profileBtn);

      // Verify all rendered menus
      const loginMenu = screen.getByTestId('login-dropdown-menu');
      const servicesMenu = screen.getByRole('menu', { name: /Available VYASA Services/i });
      const profileMenu = screen.getByTestId('navbar-profile-dropdown');

      expect(loginMenu).toHaveClass('vyasa-access-menu');
      expect(servicesMenu.style.backgroundColor).toBe('rgb(255, 255, 255)');
      expect(profileMenu.style.backgroundColor).toBe('rgb(255, 255, 255)');
    });
  });

});
