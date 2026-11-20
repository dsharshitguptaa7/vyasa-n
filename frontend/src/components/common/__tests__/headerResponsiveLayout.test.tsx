import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PublicNavbar } from '../PublicNavbar';
import { Navbar } from '../Navbar';
import * as AuthContextModule from '../../../context/AuthContext';
import { CSJMU_INSTITUTION, VYASA_BRAND } from '@vyasa/ui/branding';

describe('Responsive Institutional Header & Navbar Validation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAuth = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
    const defaultAuth: AuthContextModule.AuthContextValue = {
      user: {
        id: 'test-user-1',
        email: 'test@csjmu.ac.in',
        fullName: 'Prof. Test User',
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
      displayName: 'Prof. Test User',
      ...overrides,
    };

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
    return defaultAuth;
  };

  it('1. Renders all 5 institutional elements in PublicNavbar without overflow-causing inline constraints', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PublicNavbar />
      </MemoryRouter>
    );

    // 1. Logo/Emblem
    const emblem = screen.getByAltText(CSJMU_INSTITUTION.nameEnglish);
    expect(emblem).toBeInTheDocument();

    // 2. English University Name
    const nameEn = screen.getByText(CSJMU_INSTITUTION.nameEnglish);
    expect(nameEn).toBeInTheDocument();
    expect(nameEn).toHaveClass('university-brand__name-en');
    expect(nameEn.style.whiteSpace).toBe('normal');

    // 3. Subtitle / Accreditation
    const subtitle = screen.getByText(CSJMU_INSTITUTION.accreditation);
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveClass('university-brand__subtitle');
    expect(subtitle.style.whiteSpace).toBe('normal');

    // 4. Hindi University Name
    const nameHi = screen.getByText(CSJMU_INSTITUTION.nameHindi);
    expect(nameHi).toBeInTheDocument();
    expect(nameHi).toHaveClass('university-brand__name-hi');
    expect(nameHi.style.whiteSpace).toBe('normal');

    // 5. Right-side institutional info (Location)
    const location = screen.getByText(CSJMU_INSTITUTION.location);
    expect(location).toBeInTheDocument();
    expect(location).toHaveClass('csjmu-top-bar__location');
  });

  it('2. VYASA Navbar renders logo lockup, title, tagline and mobile hamburger toggle', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PublicNavbar />
      </MemoryRouter>
    );

    // VYASA Title
    expect(screen.getByText('VYASAᴺ ECOSYSTEM')).toBeInTheDocument();

    // VYASA Hindi Tagline
    expect(screen.getByText(VYASA_BRAND.taglineHindi)).toBeInTheDocument();

    // Mobile Hamburger Toggle
    const toggle = screen.getByRole('button', { name: /Toggle navigation menu/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveClass('vyasa-mobile-toggle');
  });

  it('3. Authenticated InstitutionalHeader retains institutional branding and notification actions without rigid clipping', () => {
    mockAuth();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    // Emblem
    expect(screen.getByAltText(CSJMU_INSTITUTION.nameEnglish)).toBeInTheDocument();

    // English & Hindi names
    expect(screen.getByText(CSJMU_INSTITUTION.nameEnglish)).toBeInTheDocument();
    expect(screen.getByText(CSJMU_INSTITUTION.nameHindi)).toBeInTheDocument();

    // Subtitle
    expect(screen.getByText(CSJMU_INSTITUTION.accreditation)).toBeInTheDocument();

    // Location
    expect(screen.getByText(CSJMU_INSTITUTION.location)).toBeInTheDocument();

    // Notification action
    expect(screen.getByRole('button', { name: /^Notifications$/i })).toBeInTheDocument();

    // Top bar element has flexible styling (not locked with rigid maxHeight)
    const topBar = document.querySelector('.csjmu-top-bar') as HTMLElement;
    expect(topBar).toBeInTheDocument();
    expect(topBar.style.maxHeight).toBeFalsy();
  });
});
