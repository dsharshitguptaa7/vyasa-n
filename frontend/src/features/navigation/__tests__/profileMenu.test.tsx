import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Navbar } from '../../../components/common/Navbar';
import { ProfileMenu } from '../../../components/common/ProfileMenu';
import * as AuthContextModule from '../../../context/AuthContext';
import { AuthenticatedUser } from '../../../types/auth';

const mockScholarUser: AuthenticatedUser = {
  id: 'user-scholar-1',
  email: 'harshit.gupta@csjmu.ac.in',
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

describe('VYASA Header - Profile Menu & Normal-State Button Visibility Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Profile button renders with visible label in its normal state before any hover', () => {
    mockAuth();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    const profileBtn = screen.getByTestId('navbar-profile-btn');
    expect(profileBtn).toBeInTheDocument();

    // Verify text content is visible and present without hovering
    expect(profileBtn).toHaveTextContent(/Profile/i);
    expect(profileBtn).toHaveTextContent(/▾/i);

    // Verify button has visible styling in default state
    expect(profileBtn.style.color).toBe('rgb(255, 255, 255)');
    expect(profileBtn.style.backgroundColor).not.toBe('transparent');
  });

  it('2. Button content does not depend on hover for visibility', () => {
    mockAuth();

    render(
      <MemoryRouter>
        <ProfileMenu />
      </MemoryRouter>
    );

    const profileBtn = screen.getByTestId('navbar-profile-btn');
    // Ensure display is not none, opacity is not 0, visibility is not hidden
    expect(profileBtn).toBeVisible();
    expect(profileBtn.style.opacity).not.toBe('0');
    expect(profileBtn.style.visibility).not.toBe('hidden');
    expect(profileBtn.textContent).toContain('Profile');
  });

  it('3. Profile button is keyboard accessible (Enter/Space opens, Escape closes)', () => {
    mockAuth();

    render(
      <MemoryRouter>
        <ProfileMenu />
      </MemoryRouter>
    );

    const profileBtn = screen.getByTestId('navbar-profile-btn');
    expect(profileBtn).toHaveAttribute('aria-haspopup', 'menu');
    expect(profileBtn).toHaveAttribute('aria-expanded', 'false');

    // Press Enter to open
    fireEvent.keyDown(profileBtn, { key: 'Enter' });
    expect(profileBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('navbar-profile-dropdown')).toBeInTheDocument();

    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(profileBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('navbar-profile-dropdown')).not.toBeInTheDocument();
  });

  it('4. Clicking Profile button opens dropdown with user dossier, Profile link, and Sign Out', () => {
    mockAuth();

    render(
      <MemoryRouter>
        <ProfileMenu />
      </MemoryRouter>
    );

    const profileBtn = screen.getByTestId('navbar-profile-btn');
    fireEvent.click(profileBtn);

    expect(screen.getByTestId('navbar-profile-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('profile-dropdown-user-name')).toHaveTextContent('Harshit Gupta');
    expect(screen.getByTestId('profile-dropdown-user-email')).toHaveTextContent('harshit.gupta@csjmu.ac.in');
    expect(screen.getByTestId('profile-menu-item-profile')).toHaveTextContent('Institutional Profile');
    expect(screen.getByTestId('profile-menu-item-signout')).toHaveTextContent('Sign Out');
  });

  it('5. Clicking Institutional Profile navigates to /dashboard and closes menu', async () => {
    mockAuth();

    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/my-grievances']}>
        <Routes>
          <Route path="/modules/atharva-veda/nivaran/my-grievances" element={<Navbar />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-target">Canonical Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    const profileBtn = screen.getByTestId('navbar-profile-btn');
    fireEvent.click(profileBtn);

    const profileItem = screen.getByTestId('profile-menu-item-profile');
    fireEvent.click(profileItem);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-target')).toBeInTheDocument();
      expect(screen.queryByTestId('navbar-profile-dropdown')).not.toBeInTheDocument();
    });
  });

  it('6. Clicking Sign Out triggers logout callback and redirects to login', async () => {
    const authState = mockAuth();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Navbar />} />
          <Route path="/applicant/login" element={<div data-testid="login-target">Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const profileBtn = screen.getByTestId('navbar-profile-btn');
    fireEvent.click(profileBtn);

    const signOutBtn = screen.getByTestId('profile-menu-item-signout');
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(authState.logout).toHaveBeenCalled();
      expect(screen.getByTestId('login-target')).toBeInTheDocument();
    });
  });

  it('7. Hovering over profile button enhances styling without layout shift', () => {
    mockAuth();

    render(
      <MemoryRouter>
        <ProfileMenu />
      </MemoryRouter>
    );

    const profileBtn = screen.getByTestId('navbar-profile-btn');
    const initialHeight = profileBtn.style.height;

    expect(profileBtn.style.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');

    fireEvent.mouseEnter(profileBtn);
    expect(profileBtn.style.height).toBe(initialHeight);
    expect(profileBtn.style.backgroundColor).toBe('rgba(255, 255, 255, 0.16)');

    fireEvent.mouseLeave(profileBtn);
    expect(profileBtn.style.height).toBe(initialHeight);
    expect(profileBtn.style.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
  });
});
