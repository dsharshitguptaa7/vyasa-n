import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NotificationBellMenu } from '../NotificationBellMenu';
import { NotificationCenterPage } from '../NotificationCenterPage';
import { notificationService } from '../../../services/notificationService';
import { AuthProvider } from '../../../context/AuthContext';
import { authService } from '../../../services/authService';
import { NotificationItem, NotificationSummary, PillarMetadata, NotificationPreferenceItem } from '../../../types/notification';

const mockUser = {
  id: 'user-notif-123',
  email: 'scholar@csjmu.ac.in',
  first_name: 'Harshit',
  last_name: 'Gupta',
  fullName: 'Harshit Gupta',
  roles: ['applicant'],
  is_active: true,
};

const mockSummary: NotificationSummary = {
  unread_count: 2,
  action_required_count: 1,
  total_count: 3,
  by_pillar: {
    NIVARAN: 2,
    VYASA_AI: 1,
  },
  by_priority: {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 0,
  },
};

const mockNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    user_id: 'user-notif-123',
    source_pillar: 'NIVARAN',
    source_display_name: 'VYASA-N | NIVARAN',
    event_type: 'grievance.document_requested',
    event_id: 'evt-101',
    title: 'Additional Documentation Requested',
    message: 'Assistant Dean has requested updated thesis receipts.',
    type: 'NOTIFICATION',
    priority: 'HIGH',
    entity_type: 'grievance',
    entity_id: 'GRV-2026-001',
    action_route: '/atharva-veda/nivaran/grievance/GRV-2026-001',
    action_required: true,
    is_read: false,
    created_at: '2026-10-13T10:00:00Z',
    updated_at: '2026-10-13T10:00:00Z',
  },
  {
    id: 'notif-2',
    user_id: 'user-notif-123',
    source_pillar: 'NIVARAN',
    source_display_name: 'VYASA-N | NIVARAN',
    event_type: 'grievance.submitted',
    event_id: 'evt-102',
    title: 'Grievance Registered',
    message: 'Your research grievance GRV-2026-001 has been logged.',
    type: 'NOTIFICATION',
    priority: 'MEDIUM',
    entity_type: 'grievance',
    entity_id: 'GRV-2026-001',
    action_route: '/atharva-veda/nivaran/grievance/GRV-2026-001',
    action_required: false,
    is_read: false,
    created_at: '2026-10-13T09:00:00Z',
    updated_at: '2026-10-13T09:00:00Z',
  },
  {
    id: 'notif-3',
    user_id: 'user-notif-123',
    source_pillar: 'VYASA_AI',
    source_display_name: 'VYASA-N | VYASA AI',
    event_type: 'knowledge.citation_update',
    event_id: 'evt-103',
    title: 'Research Citation Updated',
    message: 'New doctoral guidelines for 2026-27 are now active.',
    type: 'NOTIFICATION',
    priority: 'LOW',
    entity_type: 'citation',
    entity_id: 'CIT-2026',
    action_route: '/phd-assistant',
    action_required: false,
    is_read: true,
    read_at: '2026-10-13T09:30:00Z',
    created_at: '2026-10-13T08:00:00Z',
    updated_at: '2026-10-13T09:30:00Z',
  },
];

const mockPillars: PillarMetadata[] = [
  {
    pillar_id: 'NIVARAN',
    display_name: 'VYASA-N | NIVARAN',
    description: 'Institutional grievance governance and dispute resolution',
    supported_events: ['grievance.submitted', 'grievance.document_requested'],
    channels: ['IN_APP', 'EMAIL'],
  },
  {
    pillar_id: 'VYASA_AI',
    display_name: 'VYASA-N | VYASA AI',
    description: 'Academic knowledge RAG and regulations assistant',
    supported_events: ['knowledge.citation_update'],
    channels: ['IN_APP', 'EMAIL'],
  },
];

const mockPreferences: NotificationPreferenceItem[] = [
  {
    id: 'pref-1',
    user_id: 'user-notif-123',
    source_pillar: 'NIVARAN',
    event_type: '*',
    in_app_enabled: true,
    email_enabled: true,
    created_at: '2026-10-13T00:00:00Z',
    updated_at: '2026-10-13T00:00:00Z',
  },
  {
    id: 'pref-2',
    user_id: 'user-notif-123',
    source_pillar: 'VYASA_AI',
    event_type: '*',
    in_app_enabled: true,
    email_enabled: false,
    created_at: '2026-10-13T00:00:00Z',
    updated_at: '2026-10-13T00:00:00Z',
  },
];

describe('VYASA-N Unified Notification Centre Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-jwt-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser as any);
    vi.spyOn(notificationService, 'getSummary').mockResolvedValue(mockSummary);
    vi.spyOn(notificationService, 'getPillars').mockResolvedValue(mockPillars);
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      count: mockNotifications.length,
      unread_count: 2,
      action_required_count: 1,
      notifications: mockNotifications,
    });
    vi.spyOn(notificationService, 'getPreferences').mockResolvedValue(mockPreferences);
    vi.spyOn(notificationService, 'markAsRead').mockResolvedValue({
      id: 'notif-1',
      user_id: 'user-notif-123',
      source_pillar: 'NIVARAN',
      title: 'Additional Documentation Requested',
      message: 'Assistant Dean has requested updated thesis receipts.',
      type: 'NOTIFICATION',
      priority: 'HIGH',
      action_required: true,
      is_read: true,
      read_at: '2026-10-13T10:05:00Z',
      created_at: '2026-10-13T10:00:00Z',
      updated_at: '2026-10-13T10:05:00Z',
    });
    vi.spyOn(notificationService, 'markAllAsRead').mockResolvedValue(2);
    vi.spyOn(notificationService, 'updatePreference').mockResolvedValue({
      id: 'pref-1',
      user_id: 'user-notif-123',
      source_pillar: 'NIVARAN',
      event_type: '*',
      in_app_enabled: true,
      email_enabled: false,
      created_at: '2026-10-13T00:00:00Z',
      updated_at: '2026-10-13T10:00:00Z',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('NotificationBellMenu Component', () => {
    it('renders notification bell with live unread badge count', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationBellMenu />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(notificationService.getSummary).toHaveBeenCalled();
      });

      const badge = await screen.findByText('2');
      expect(badge).toBeInTheDocument();
    });

    it('opens dropdown popover when bell button is clicked and lists recent notifications', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationBellMenu />
          </AuthProvider>
        </MemoryRouter>
      );

      const bellButton = await screen.findByRole('button', { name: /notification/i });
      fireEvent.click(bellButton);

      await waitFor(() => {
        expect(screen.getByText(/Notifications/i)).toBeInTheDocument();
        expect(screen.getByText(/2 unread/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Additional Documentation Requested')).toBeInTheDocument();
      expect(screen.getAllByText('VYASA-N | NIVARAN').length).toBeGreaterThan(0);
      expect(screen.getByText(/Open Unified Notification Centre/i)).toBeInTheDocument();
    });

    it('marks all as read when clicking "Mark all read" in popover', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationBellMenu />
          </AuthProvider>
        </MemoryRouter>
      );

      const bellButton = await screen.findByRole('button', { name: /notification/i });
      fireEvent.click(bellButton);

      const markAllBtn = await screen.findByText('Mark all read');
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(notificationService.markAllAsRead).toHaveBeenCalled();
      });
    });

    it('marks individual notification as read on click and navigates', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<NotificationBellMenu />} />
              <Route path="/atharva-veda/nivaran/grievance/GRV-2026-001" element={<div>Grievance Target Page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      const bellButton = await screen.findByRole('button', { name: /notification/i });
      fireEvent.click(bellButton);

      const itemCard = await screen.findByText('Additional Documentation Requested');
      fireEvent.click(itemCard);

      await waitFor(() => {
        expect(notificationService.markAsRead).toHaveBeenCalledWith('notif-1');
        expect(screen.getByText('Grievance Target Page')).toBeInTheDocument();
      });
    });
  });

  describe('NotificationCenterPage Component', () => {
    it('renders the Unified Notification Centre inbox with summary metrics', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationCenterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      const notifItem = await screen.findByText('Additional Documentation Requested');
      expect(notifItem).toBeInTheDocument();

      // Metric cards
      expect(screen.getByText('Unread Items')).toBeInTheDocument();
      expect(screen.getByText('Total Messages')).toBeInTheDocument();

      // Notifications rendered with pillar identification
      expect(screen.getAllByText('VYASA-N | NIVARAN').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Action Required').length).toBeGreaterThan(0);
    });

    it('filters by tab: Unread and Action Required', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationCenterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await screen.findByText('Additional Documentation Requested');

      // Switch to UNREAD tab
      const unreadTab = screen.getByRole('tab', { name: /Unread/i });
      fireEvent.click(unreadTab);

      await waitFor(() => {
        expect(notificationService.getNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ is_read: false })
        );
      });

      // Switch to ACTION_REQUIRED tab
      const actionReqTab = screen.getByRole('tab', { name: /Action Required/i });
      fireEvent.click(actionReqTab);

      await waitFor(() => {
        expect(notificationService.getNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ action_required: true })
        );
      });
    });

    it('filters by source pillar dropdown', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationCenterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await screen.findByText('Additional Documentation Requested');

      const pillarSelect = screen.getByLabelText(/Pillar/i);
      fireEvent.change(pillarSelect, { target: { value: 'NIVARAN' } });

      await waitFor(() => {
        expect(notificationService.getNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ source_pillar: 'NIVARAN' })
        );
      });
    });

    it('marks an individual unread notification as read', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationCenterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await screen.findByText('Additional Documentation Requested');

      const markReadButtons = screen.getAllByRole('button', { name: /mark as read/i });
      expect(markReadButtons.length).toBeGreaterThan(0);
      fireEvent.click(markReadButtons[0]);

      await waitFor(() => {
        expect(notificationService.markAsRead).toHaveBeenCalledWith('notif-1');
      });
    });

    it('marks all as read via top action bar', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationCenterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await screen.findByText('Additional Documentation Requested');

      const markAllBtn = screen.getByRole('button', { name: /Mark All Read/i });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(notificationService.markAllAsRead).toHaveBeenCalled();
      });
    });

    it('opens and interacts with notification preferences modal', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationCenterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await screen.findByText('Additional Documentation Requested');

      const prefBtn = screen.getByRole('button', { name: /Preferences/i });
      fireEvent.click(prefBtn);

      await waitFor(() => {
        expect(screen.getByText('Notification Delivery Preferences')).toBeInTheDocument();
      });

      const emailCheckbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(emailCheckbox);

      await waitFor(() => {
        expect(notificationService.updatePreference).toHaveBeenCalled();
      });

      const doneBtn = screen.getByRole('button', { name: /Done/i });
      fireEvent.click(doneBtn);

      await waitFor(() => {
        expect(screen.queryByText('Notification Delivery Preferences')).not.toBeInTheDocument();
      });
    });
  });

  describe('Notification Source Branding Suite', () => {
    it('displays "VYASA-N | NIVARAN" for New Grievance Assigned and grievance lifecycle events', async () => {
      const grievanceNotifs: NotificationItem[] = [
        {
          id: 'grv-asgn-1',
          user_id: 'user-notif-123',
          source_pillar: 'NIVARAN',
          source_display_name: 'VYASA-N | NIVARAN',
          event_type: 'authority.case_assigned',
          title: 'New Grievance Assigned — GRV-2026-999',
          message: 'Case GRV-2026-999 assigned to your jurisdiction.',
          type: 'GRIEVANCE_ASSIGNED',
          priority: 'HIGH',
          action_required: true,
          is_read: false,
          created_at: '2026-10-13T10:00:00Z',
          updated_at: '2026-10-13T10:00:00Z',
        },
        {
          id: 'grv-comm-1',
          user_id: 'user-notif-123',
          source_pillar: 'NIVARAN',
          source_display_name: 'VYASA-N | NIVARAN',
          event_type: 'committee.formation_requested',
          title: 'Committee Creation Requested — GRV-2026-999',
          message: 'Committee formation requested for grievance inquiry.',
          type: 'COMMITTEE_REQUEST_RECEIVED',
          priority: 'HIGH',
          action_required: true,
          is_read: false,
          created_at: '2026-10-13T10:05:00Z',
          updated_at: '2026-10-13T10:05:00Z',
        },
      ];

      vi.spyOn(notificationService, 'getNotifications').mockResolvedValueOnce({
        count: grievanceNotifs.length,
        unread_count: 2,
        action_required_count: 2,
        notifications: grievanceNotifs,
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationCenterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await screen.findByText('New Grievance Assigned — GRV-2026-999');

      // Grievance cards and pillar filter select option display the exact branding 'VYASA-N | NIVARAN'
      const nivaranTags = screen.getAllByText('VYASA-N | NIVARAN');
      expect(nivaranTags.length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText('VYASA-N | CORE')).not.toBeInTheDocument();
    });

    it('displays "VYASA-N | CORE" for genuine platform announcements and "VYASA-N | [PILLAR]" for future pillars', async () => {
      const mixedNotifs: NotificationItem[] = [
        {
          id: 'core-notif-1',
          user_id: 'user-notif-123',
          source_pillar: 'VYASA_CORE',
          source_display_name: 'VYASA-N | CORE',
          event_type: 'platform.announcement',
          title: 'Ecosystem Scheduled Maintenance',
          message: 'Central VYASA-N infrastructure upgrade scheduled.',
          type: 'platform',
          priority: 'HIGH',
          action_required: false,
          is_read: false,
          created_at: '2026-10-13T11:00:00Z',
          updated_at: '2026-10-13T11:00:00Z',
        },
        {
          id: 'future-notif-1',
          user_id: 'user-notif-123',
          source_pillar: 'EXAM_CELL',
          source_display_name: 'VYASA-N | EXAM_CELL',
          event_type: 'exam.defense_scheduled',
          title: 'Doctoral Defense Scheduled',
          message: 'Dissertation viva voce scheduled for 25 Oct 2026.',
          type: 'exam',
          priority: 'HIGH',
          action_required: true,
          is_read: false,
          created_at: '2026-10-13T11:30:00Z',
          updated_at: '2026-10-13T11:30:00Z',
        },
      ];

      vi.spyOn(notificationService, 'getNotifications').mockResolvedValueOnce({
        count: mixedNotifs.length,
        unread_count: 2,
        action_required_count: 1,
        notifications: mixedNotifs,
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <NotificationCenterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await screen.findByText('Ecosystem Scheduled Maintenance');

      // Platform announcement displays VYASA-N | CORE
      expect(screen.getByText('VYASA-N | CORE')).toBeInTheDocument();

      // Future pillar displays its registered module identity without defaulting to CORE
      expect(screen.getByText('VYASA-N | EXAM_CELL')).toBeInTheDocument();
    });
  });
});
