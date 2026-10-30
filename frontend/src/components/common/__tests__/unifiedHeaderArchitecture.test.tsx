import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from '../Navbar';
import * as AuthContextModule from '../../../context/AuthContext';

describe('Unified VYASA Header System - Cross-Pillar Architecture Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAuth = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
    const defaultAuth: AuthContextModule.AuthContextValue = {
      user: {
        id: 'test-user-1',
        email: 'test@csjmu.ac.in',
        fullName: 'Prof. Namita Tiwari',
        roles: ['authority'],
      },
      token: 'test-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(),
      hasAuthorityRole: vi.fn(),
      isSuperAdmin: false,
      isAdmin: false,
      isAuthority: true,
      isApplicant: false,
      isGuest: false,
      isManager: false,
      isAssistantDean: false,
      isAssociateDean: false,
      isDean: true,
      isFixedAuthority: false,
      authorityRole: 'DEAN',
      authorityId: 'auth-dean-1',
      authorityDesignation: 'Dean R&D',
      persona: 'dean',
      displayName: 'Prof. Namita Tiwari',
      ...overrides,
    };

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
    return defaultAuth;
  };

  /* =========================================================================
   * 1. Institutional Affiliation Bar
   * ======================================================================= */
  describe('1. Institutional Affiliation Bar', () => {
    it('renders CSJMU emblem, university English & Hindi names, and accreditation metadata', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      // Emblem image
      const emblem = screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University, Kanpur/i);
      expect(emblem).toBeInTheDocument();

      // University Name
      expect(screen.getByText('Chhatrapati Shahu Ji Maharaj University, Kanpur')).toBeInTheDocument();
      expect(screen.getByText('छत्रपति शाहू जी महाराज विश्वविद्यालय, कानपुर')).toBeInTheDocument();

      // Accreditation & State metadata
      expect(screen.getByText(/State University of Uttar Pradesh/i)).toBeInTheDocument();
    });
  });

  /* =========================================================================
   * 2. Unified Authenticated Top Header System
   * ======================================================================= */
  describe('2. Unified Authenticated Top Header System', () => {
    it('contains ONLY institutional branding and the notification bell', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      // University Brand Emblem exists
      expect(screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();

      // Notifications bell button exists with accessible label
      expect(screen.getByRole('button', { name: /^Notifications$/i })).toBeInTheDocument();

      // STRICT CHECK: Navbar must NOT contain navigation menus or redundant actions
      expect(screen.queryByRole('navigation', { name: /Platform navigation/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /VYASA Services Menu/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Profile Menu/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('navbar-profile-section')).not.toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Services')).not.toBeInTheDocument();
      expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      expect(screen.queryByText('Guidelines & Help')).not.toBeInTheDocument();
      expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
    });

    it('renders identical compact header for Scholar / Applicant', () => {
      mockAuth({
        isDean: false,
        isAuthority: false,
        isApplicant: true,
        authorityRole: null,
        displayName: 'Aditi Sharma',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/my-grievances']}>
          <Navbar />
        </MemoryRouter>
      );

      // Institutional brand & Notification bell
      expect(screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Notifications$/i })).toBeInTheDocument();

      // No redundant app navbar items
      expect(screen.queryByRole('navigation', { name: /Platform navigation/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Services')).not.toBeInTheDocument();
    });

    it('renders identical compact header for Assistant Dean', () => {
      mockAuth({
        isDean: false,
        isAuthority: true,
        isAssistantDean: true,
        authorityRole: 'ASSISTANT_DEAN',
        authorityDesignation: 'Assistant Dean Academics',
        displayName: 'Dr. Ankit Trivedi',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/assistant-dean/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Notifications$/i })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: /Platform navigation/i })).not.toBeInTheDocument();
    });

    it('renders identical compact header for Manager', () => {
      mockAuth({
        isDean: false,
        isAuthority: true,
        isManager: true,
        authorityRole: 'MANAGER',
        authorityDesignation: 'Triage Manager',
        displayName: 'Vikram Singh',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/manager/queue']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Notifications$/i })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: /Platform navigation/i })).not.toBeInTheDocument();
    });

    it('renders identical compact header for System Administrator', () => {
      mockAuth({
        isAdmin: true,
        isDean: false,
        isAuthority: false,
        authorityRole: null,
        displayName: 'Admin User',
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Notifications$/i })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: /Platform navigation/i })).not.toBeInTheDocument();
    });

    it('renders identical compact header on SAMIKSHA (Sama Veda) routes', () => {
      mockAuth({
        isDean: true,
        displayName: 'Prof. Namita Tiwari',
      });

      render(
        <MemoryRouter initialEntries={['/modules/sama-veda']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Notifications$/i })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: /Platform navigation/i })).not.toBeInTheDocument();
    });
  });

  /* =========================================================================
   * 3. Public Navbar Isolation
   * ======================================================================= */
  describe('3. Public Navbar Isolation', () => {
    it('unauthenticated users see PublicNavbar without authenticated controls', () => {
      mockAuth({
        isAuthenticated: false,
        user: null,
        displayName: '',
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <Navbar />
        </MemoryRouter>
      );

      // Public branding / navigation items
      expect(screen.getByText('ज्ञान से शोध तक, AI के साथ')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /LOGIN/i })).toBeInTheDocument();

      // Top bar notification bell is not shown for unauthenticated users
      expect(screen.queryByTitle('Institutional Notifications')).not.toBeInTheDocument();
    });
  });
});
