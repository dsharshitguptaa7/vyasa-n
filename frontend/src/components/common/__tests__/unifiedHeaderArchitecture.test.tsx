import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '../Navbar';
import * as AuthContextModule from '../../../context/AuthContext';

describe('Unified VYASAᴺ Header System - Cross-Pillar Architecture Suite', () => {
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
   * 1. Tier 1: Institutional Affiliation Bar
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
   * 2. Tier 2: Primary VYASAᴺ Application Header
   * ======================================================================= */
  describe('2. Primary VYASAᴺ Application Header', () => {
    it('renders official VYASAᴺ logo lockup with Devanagari tagline and Ecosystem identity', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      // Official Logo & Tagline
      expect(screen.getByLabelText(/VYASA Official Emblem/i)).toBeInTheDocument();
      expect(screen.getByText('ज्ञान से शोध तक, AI के साथ')).toBeInTheDocument();

      // Ecosystem Sub-brand lockup
      expect(screen.getByText('VYASAᴺ ECOSYSTEM')).toBeInTheDocument();
      expect(screen.getByText('CSJMU Research & Governance')).toBeInTheDocument();
    });

    it('renders platform navigation with Dashboard, ServicesMenu and Notifications bell', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      // Platform navigation container
      const platNav = screen.getByRole('navigation', { name: /Platform navigation/i });
      expect(platNav).toBeInTheDocument();

      // Services Menu Trigger
      expect(screen.getByRole('button', { name: /VYASA Services Menu/i })).toBeInTheDocument();

      // Notification Center Trigger
      expect(screen.getByRole('button', { name: /Notifications/i })).toBeInTheDocument();

      // User Identity Pill
      const profileSection = screen.getByTestId('navbar-profile-section');
      expect(profileSection).toBeInTheDocument();
      expect(profileSection).toHaveTextContent('Prof. Namita Tiwari');
      expect(profileSection).toHaveTextContent('Dean R&D');
    });
  });

  /* =========================================================================
   * 3. Tier 3: Contextual Navigation across All Pillars
   * ======================================================================= */
  describe('3. Tier 3 Contextual Navigation across All Pillars', () => {
    it('renders NIVARAN-AI pillar context and Dean authority navigation', () => {
      mockAuth({
        isDean: true,
        authorityRole: 'DEAN',
        authorityDesignation: 'Dean R&D',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      // Pillar Tag
      expect(screen.getAllByText('NIVARAN-AI').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Dean Executive Authority/i)).toBeInTheDocument();

      // Return button
      expect(screen.getByRole('link', { name: /← VYASAᴺ Dashboard/i })).toBeInTheDocument();

      // Dean navigation items
      expect(screen.getByRole('link', { name: 'Executive Dashboard' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Executive Queue' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'E-Files' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Student Records' })).toBeInTheDocument();
    });

    it('renders NIVARAN-AI pillar context and Assistant Dean authority navigation', () => {
      mockAuth({
        isDean: false,
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

      // Assistant Dean context & items
      expect(screen.getByText(/Assistant Dean Authority/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Jurisdictional Docket' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Assigned Cases' })).toBeInTheDocument();
    });

    it('renders NIVARAN-AI pillar context and Scholar/Applicant navigation', () => {
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

      // Scholar context & items
      expect(screen.getByText(/Scholar Redressal Portal/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'My Grievances' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Submit Grievance' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'My E-Files' })).toBeInTheDocument();
    });

    it('renders VYASA AI Assistant pillar context and navigation items', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/phd-admission']}>
          <Navbar />
        </MemoryRouter>
      );

      // Pillar Tag
      expect(screen.getByText('VYASA AI Assistant')).toBeInTheDocument();
      expect(screen.getByText(/Academic Intelligence/i)).toBeInTheDocument();

      // Navigation links
      expect(screen.getByRole('link', { name: 'AI Assistant Chat' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Doctoral Regulations' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ph.D. Admissions (2026-27)' })).toBeInTheDocument();
    });

    it('renders Institutional Administration Console pillar context and navigation', () => {
      mockAuth({
        isAdmin: true,
        isDean: false,
        isAuthority: false,
        authorityRole: null,
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Navbar />
        </MemoryRouter>
      );

      // Admin Pillar Tag
      expect(screen.getByText('Admin Console')).toBeInTheDocument();
      expect(screen.getByText(/System Administration/i)).toBeInTheDocument();

      // Admin navigation links
      expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Authorities' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Subject Clusters' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Categories & Routing' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Audit Logs' })).toBeInTheDocument();
    });

    it('renders Future Governance Pillar context for Rig Veda (PRAMAAN)', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/modules/rig-veda']}>
          <Navbar />
        </MemoryRouter>
      );

      // Future Pillar Tag
      expect(screen.getByText('Rig Veda (PRAMAAN)')).toBeInTheDocument();
      expect(screen.getByText(/Research Publications & Ethics \(Scheduled\)/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'PRAMAAN Overview' })).toBeInTheDocument();
    });

    it('renders Core Platform context when on Institutional Dashboard', () => {
      mockAuth();

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      // Core Platform Tag
      expect(screen.getByText('VYASAᴺ Core Platform')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Institutional Dashboard' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Notification Centre' })).toBeInTheDocument();
    });
  });

  /* =========================================================================
   * 4. Responsive Mobile Drawer Interaction
   * ======================================================================= */
  describe('4. Responsive Mobile Drawer Interaction', () => {
    it('opens mobile drawer with active pillar section and user actions', () => {
      mockAuth({
        isDean: true,
        displayName: 'Prof. Namita Tiwari',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      const toggle = screen.getByRole('button', { name: /Toggle navigation menu/i });
      expect(toggle).toBeInTheDocument();

      // Open drawer
      fireEvent.click(toggle);

      const drawer = screen.getByRole('dialog', { name: /NIVARAN Service Mobile Menu/i });
      expect(drawer).toBeInTheDocument();
      expect(screen.getByText('NIVARAN-AI WORKSPACE')).toBeInTheDocument();
      expect(screen.getByText(/Return to VYASA.*Dashboard/i)).toBeInTheDocument();

      // Close on escape
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
