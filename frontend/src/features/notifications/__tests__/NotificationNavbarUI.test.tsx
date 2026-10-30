import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '../../../components/common/Navbar';
import { VyasaPortalSidebar } from '../../dashboard/components/VyasaPortalSidebar';
import * as AuthContextModule from '../../../context/AuthContext';
import { notificationService } from '../../../services/notificationService';

describe('Standardized Notification Navbar & Sidebar UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockAuth = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
    const defaultAuth: AuthContextModule.AuthContextValue = {
      user: {
        id: 'test-user-1',
        email: 'scholar@csjmu.ac.in',
        fullName: 'Aarav Sharma',
        roles: ['applicant'],
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
      displayName: 'Aarav Sharma',
      ...overrides,
    };

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
    return defaultAuth;
  };

  it('1. Top navbar renders the notification bell button without visible "Notifications" text', async () => {
    mockAuth();
    vi.spyOn(notificationService, 'getSummary').mockResolvedValue({
      total_count: 3,
      unread_count: 3,
      action_required_count: 1,
      by_source: { NIVARAN: 3 },
    });
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      notifications: [],
      total: 0,
      page: 1,
      limit: 5,
      unread_count: 3,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    // Bell button exists and has accessible name
    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    expect(bellBtn).toBeInTheDocument();

    // Verify there is NO visible "Notifications" text label rendered inside the top navbar navigation
    const platformNav = screen.queryByRole('navigation', { name: /Platform navigation/i });
    if (platformNav) {
      expect(platformNav).not.toHaveTextContent('Notifications');
    }

    // Verify the unread badge is present
    await waitFor(() => {
      const badge = screen.getByTestId('notification-badge-count');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
    });
  });

  it('2. Clicking top navbar bell opens the notification popover dropdown', async () => {
    mockAuth();
    vi.spyOn(notificationService, 'getSummary').mockResolvedValue({
      total_count: 1,
      unread_count: 1,
      action_required_count: 0,
      by_source: { NIVARAN: 1 },
    });
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      notifications: [
        {
          id: 'notif-1',
          user_id: 'test-user-1',
          title: 'Grievance Assigned',
          message: 'Your grievance dossier has been assigned to Assistant Dean.',
          is_read: false,
          created_at: '2026-10-20T10:00:00Z',
          source_pillar: 'NIVARAN',
        },
      ],
      total: 1,
      page: 1,
      limit: 5,
      unread_count: 1,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    expect(screen.queryByRole('region', { name: /Notifications Dropdown/i })).not.toBeInTheDocument();

    fireEvent.click(bellBtn);

    // Popover opens
    expect(await screen.findByRole('region', { name: /Notifications Dropdown/i })).toBeInTheDocument();
    expect(screen.getByText('Grievance Assigned')).toBeInTheDocument();
    expect(screen.getByText(/Your grievance dossier has been assigned/i)).toBeInTheDocument();
  });

  it('3. Left sidebar preserves the full "Notifications" text label and icon', () => {
    mockAuth();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <VyasaPortalSidebar activeItem="dashboard" />
      </MemoryRouter>
    );

    // Sidebar navigation contains full Notifications item
    const sidebar = screen.getByRole('navigation', { name: /VYASA Portal Navigation/i });
    expect(sidebar).toBeInTheDocument();

    const notifBtn = screen.getByRole('button', { name: /Notifications/i });
    expect(notifBtn).toBeInTheDocument();
    expect(notifBtn).toHaveTextContent('Notifications');
  });

  it('4. Consistent across Dean & Authority roles', async () => {
    mockAuth({
      isApplicant: false,
      isAuthority: true,
      isDean: true,
      authorityRole: 'DEAN',
      authorityDesignation: 'Dean R&D',
      displayName: 'Prof. Namita Tiwari',
    });
    vi.spyOn(notificationService, 'getSummary').mockResolvedValue({
      total_count: 0,
      unread_count: 0,
      action_required_count: 0,
      by_source: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    // Platform nav should not exist on the unified authenticated top navbar
    const platformNav = screen.queryByRole('navigation', { name: /Platform navigation/i });
    expect(platformNav).not.toBeInTheDocument();

    // Bell button exists with clean accessible name
    const bellBtn = screen.getByRole('button', { name: /^Notifications$/i });
    expect(bellBtn).toBeInTheDocument();

    // No unread badge when count is 0
    expect(screen.queryByTestId('notification-badge-count')).not.toBeInTheDocument();
  });

  it('5. VyasaPortalSidebar does NOT display fabricated mock count (neutral state 0)', async () => {
    mockAuth();
    // Delay resolution to verify initial render state
    vi.spyOn(notificationService, 'getSummary').mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <VyasaPortalSidebar activeItem="dashboard" />
      </MemoryRouter>
    );

    const notifBtn = screen.getByRole('button', { name: /^Notifications$/i });
    expect(notifBtn).toBeInTheDocument();
    // Verify there is no fabricated "3" badge
    expect(notifBtn).not.toHaveTextContent('3');
  });

  it('6. VyasaPortalSidebar displays real unread count when API succeeds', async () => {
    mockAuth();
    vi.spyOn(notificationService, 'getSummary').mockResolvedValue({
      total_count: 5,
      unread_count: 5,
      action_required_count: 2,
      by_source: { NIVARAN: 5 },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <VyasaPortalSidebar activeItem="dashboard" />
      </MemoryRouter>
    );

    await waitFor(() => {
      const notifBtn = screen.getByRole('button', { name: /Notifications/i });
      expect(notifBtn).toHaveTextContent('5');
    });
  });

  it('7. VyasaPortalSidebar does NOT display fabricated count when API fails', async () => {
    mockAuth();
    vi.spyOn(notificationService, 'getSummary').mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <VyasaPortalSidebar activeItem="dashboard" />
      </MemoryRouter>
    );

    const notifBtn = screen.getByRole('button', { name: /^Notifications$/i });
    expect(notifBtn).toBeInTheDocument();

    // Give microtasks time to run catch handler
    await waitFor(() => {
      expect(notifBtn).not.toHaveTextContent('3');
      expect(notifBtn).toHaveTextContent(/^Notifications$/);
    });
  });
});
