import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CommitteesListPage } from '../pages/CommitteesListPage';
import { CommitteeWorkspacePage } from '../pages/CommitteeWorkspacePage';
import { committeeService } from '../services/committeeService';
import {
  CommitteeItem,
  CommitteeOverviewMetrics,
  CommitteeWorkspaceDetail,
} from '../types/committee';

// Mock committeeService
vi.mock('../services/committeeService', () => ({
  committeeService: {
    getOverviewMetrics: vi.fn(),
    listCommittees: vi.fn(),
    listRequests: vi.fn(),
    getCommitteeWorkspaceDetail: vi.fn(),
    dissolveCommittee: vi.fn(),
    listMessages: vi.fn(),
    postMessage: vi.fn(),
    getChatWsTicket: vi.fn().mockResolvedValue('mock-ticket'),
    getCommitteeWsUrl: vi.fn().mockReturnValue('ws://localhost:8000/api/modules/atharva-veda/nivaran/committees/comm-1/ws'),
    listPolls: vi.fn(),
    createPoll: vi.fn(),
    castVote: vi.fn(),
    closePoll: vi.fn(),
    listMeetings: vi.fn(),
    scheduleMeeting: vi.fn(),
    cancelMeeting: vi.fn(),
    getGoogleMeetStatus: vi.fn(),
    listDocuments: vi.fn(),
    uploadDocument: vi.fn(),
    listDecisions: vi.fn(),
    recordDecision: vi.fn(),
    reviewRequest: vi.fn(),
    formCommitteeDirect: vi.fn(),
    getEligibleAuthorities: vi.fn(),
  },
}));

// Mock useAuth
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'mock-user-123',
      email: 'dean@csjmu.ac.in',
      fullName: 'Prof. Alok Kumar',
      roles: ['authority'],
    },
    displayName: 'Prof. Alok Kumar',
    isAuthority: true,
    isDean: true,
    isAssociateDean: false,
    isAssistantDean: false,
    isApplicant: false,
    isAdmin: false,
    isManager: false,
    authorityRole: 'DEAN',
    authorityDesignation: 'Dean Research & Development',
  }),
}));

const mockMetrics: CommitteeOverviewMetrics = {
  total_committees: 5,
  active_committees: 3,
  dissolved_committees: 2,
  pending_requests: 1,
  pending_polls_for_user: 2,
  upcoming_meetings: 4,
};

const mockCommittees: CommitteeItem[] = [
  {
    id: 'comm-1',
    grievance_id: 'griev-1',
    grievance_tracking_id: 'CSJMU-G-2026-001',
    grievance_title: 'Course Fee Calculation Discrepancy',
    committee_name: 'Examination Fee Inquiry Panel',
    terms_of_reference: 'Review fee structure calculations for PhD course work.',
    chairperson_id: 'mock-user-123',
    chairperson_name: 'Prof. Alok Kumar',
    status: 'ACTIVE',
    chartered_at: '2026-10-10T10:00:00Z',
    members_count: 3,
    messages_count: 5,
    polls_count: 1,
    meetings_count: 1,
    documents_count: 2,
    decisions_count: 0,
    members: [
      {
        id: 'mem-1',
        authority_id: 'mock-user-123',
        authority_name: 'Prof. Alok Kumar',
        authority_role: 'DEAN',
        member_role: 'CHAIRPERSON',
        appointed_at: '2026-10-10T10:00:00Z',
        is_active: true,
      },
      {
        id: 'mem-2',
        authority_id: 'mock-user-456',
        authority_name: 'Dr. Sweta Pandey',
        authority_role: 'ASSOCIATE_DEAN',
        member_role: 'MEMBER',
        appointed_at: '2026-10-10T10:00:00Z',
        is_active: true,
      },
    ],
  },
  {
    id: 'comm-2',
    grievance_id: 'griev-2',
    grievance_tracking_id: 'CSJMU-G-2026-002',
    grievance_title: 'Lab Access Redressal',
    committee_name: 'Laboratory Access Fact Finding Committee',
    terms_of_reference: 'Investigate access permissions for cleanroom facilities.',
    chairperson_id: 'mock-user-456',
    chairperson_name: 'Dr. Sweta Pandey',
    status: 'DISSOLVED',
    chartered_at: '2026-09-01T10:00:00Z',
    disbanded_at: '2026-09-20T12:00:00Z',
    dissolution_reason: 'Mandate fulfilled. Final report accepted by Dean R&D.',
    members_count: 2,
    messages_count: 12,
    polls_count: 2,
    meetings_count: 2,
    documents_count: 4,
    decisions_count: 1,
    members: [],
  },
];

const mockWorkspaceDetail: CommitteeWorkspaceDetail = {
  committee: mockCommittees[0],
  user_role_in_committee: 'CHAIRPERSON',
  can_manage: true,
  can_vote: true,
  recent_messages: [
    {
      id: 'msg-1',
      committee_id: 'comm-1',
      sender_authority_id: 'mock-user-123',
      sender_name: 'Prof. Alok Kumar',
      sender_role: 'DEAN',
      message_text: 'Welcome colleagues. Let us review the ledger documents.',
      message_type: 'TEXT',
      created_at: '2026-10-10T11:00:00Z',
    },
  ],
  active_polls: [
    {
      id: 'poll-1',
      committee_id: 'comm-1',
      title: 'Adopt Preliminary Finding Draft',
      description: 'Vote on ratifying draft finding before publishing report.',
      voting_policy: 'SIMPLE_MAJORITY',
      status: 'OPEN',
      quorum_required: 2,
      total_eligible: 3,
      total_votes: 1,
      quorum_reached: false,
      user_has_voted: true,
      user_voted_option_id: 'opt-1',
      results_visibility: 'VISIBLE_TO_MEMBERS',
      launched_at: '2026-10-11T10:00:00Z',
      options: [
        { id: 'opt-1', option_key: 'A', option_text: 'Approve Finding', display_order: 1, vote_count: 1, vote_percentage: 100 },
        { id: 'opt-2', option_key: 'B', option_text: 'Reject Finding', display_order: 2, vote_count: 0, vote_percentage: 0 },
      ],
    },
  ],
  upcoming_meetings: [
    {
      id: 'meet-1',
      committee_id: 'comm-1',
      title: 'Hearing with Accounts Branch',
      agenda: 'Examine ledger transaction entries.',
      meeting_type: 'VIDEO_CALL',
      scheduled_start: '2026-10-15T14:00:00Z',
      scheduled_end: '2026-10-15T15:00:00Z',
      meeting_status: 'SCHEDULED',
      created_at: '2026-10-10T12:00:00Z',
      participants: [],
    },
  ],
  recent_documents: [
    {
      id: 'doc-1',
      grievance_id: 'griev-1',
      file_name: 'Account_Ledger_2026.pdf',
      file_path: '/uploads/doc-1.pdf',
      mime_type: 'application/pdf',
      file_size: 204800,
      document_type: 'EVIDENCE',
      content_hash: '3f5b89a8b92c4314e392ec8411d04495c202021c3b12388e2c39e0839f2913e1',
      uploaded_by_name: 'Prof. Alok Kumar',
      created_at: '2026-10-10T11:30:00Z',
    },
  ],
  recent_decisions: [
    {
      id: 'dec-1',
      committee_id: 'comm-1',
      title: 'Interim Fee Waiver Recommended',
      decision_type: 'FORMAL_DECISION',
      outcome: 'ACTION_RECOMMENDED',
      summary: 'Committee recommends provisional fee waiver pending syllabus reconciliation.',
      recorded_by_authority_id: 'mock-user-123',
      recorded_by_name: 'Prof. Alok Kumar',
      recorded_by_role: 'DEAN',
      recorded_at: '2026-10-12T16:00:00Z',
      is_final_institutional_order: false,
      created_at: '2026-10-12T16:00:00Z',
      updated_at: '2026-10-12T16:00:00Z',
    },
  ],
};

describe('NIVARAN-AI Committee Management & Workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CommitteesListPage', () => {
    it('renders overview metric cards correctly from live backend records', async () => {
      vi.mocked(committeeService.getOverviewMetrics).mockResolvedValue(mockMetrics);
      vi.mocked(committeeService.listCommittees).mockResolvedValue(mockCommittees);
      vi.mocked(committeeService.listRequests).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <CommitteesListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Committee Management System/)).toBeInTheDocument();
      });

      // Verify KPI metrics rendered
      expect(screen.getByText('Total Committees')).toBeInTheDocument();
      expect(screen.getByText('Active Committees')).toBeInTheDocument();
      expect(screen.getByText('Dissolved Committees')).toBeInTheDocument();
      expect(screen.getByText('Pending Requests')).toBeInTheDocument();
      expect(screen.getByText('Votes Requiring Action')).toBeInTheDocument();
      expect(screen.getByText('Upcoming Meetings')).toBeInTheDocument();

      // Check values
      expect(screen.getByText('5')).toBeInTheDocument(); // total
      expect(screen.getByText('3')).toBeInTheDocument(); // active
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // dissolved & pending polls
    });

    it('filters between active and dissolved committee tabs', async () => {
      vi.mocked(committeeService.getOverviewMetrics).mockResolvedValue(mockMetrics);
      vi.mocked(committeeService.listCommittees).mockResolvedValue(mockCommittees);
      vi.mocked(committeeService.listRequests).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <CommitteesListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Examination Fee Inquiry Panel')).toBeInTheDocument();
      });

      // Initially active committee is visible, dissolved is not in active tab
      expect(screen.queryByText('Laboratory Access Fact Finding Committee')).not.toBeInTheDocument();

      // Switch to Dissolved tab
      const dissolvedTab = screen.getByRole('button', { name: /Dissolved Committees/ });
      fireEvent.click(dissolvedTab);

      await waitFor(() => {
        expect(screen.getByText('Laboratory Access Fact Finding Committee')).toBeInTheDocument();
      });
      expect(screen.queryByText('Examination Fee Inquiry Panel')).not.toBeInTheDocument();
    });

    it('searches committees by name or tracking ID', async () => {
      vi.mocked(committeeService.getOverviewMetrics).mockResolvedValue(mockMetrics);
      vi.mocked(committeeService.listCommittees).mockResolvedValue(mockCommittees);
      vi.mocked(committeeService.listRequests).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <CommitteesListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Examination Fee Inquiry Panel')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by name, chairperson/);
      fireEvent.change(searchInput, { target: { value: 'Non-existent query' } });

      expect(screen.queryByText('Examination Fee Inquiry Panel')).not.toBeInTheDocument();
      expect(screen.getByText('No active committees found within your authorized scope.')).toBeInTheDocument();
    });
  });

  describe('CommitteeWorkspacePage', () => {
    it('renders committee workspace header, tabs, and overview data', async () => {
      vi.mocked(committeeService.getCommitteeWorkspaceDetail).mockResolvedValue(mockWorkspaceDetail);
      vi.mocked(committeeService.getGoogleMeetStatus).mockResolvedValue({
        configured: false,
        status: 'CREDENTIALS_REQUIRED',
        provider: 'GOOGLE_MEET',
        required_scopes: ['https://www.googleapis.com/auth/calendar.events'],
        message: 'Google Meet API credentials not configured in backend environment.',
        setup_instructions: 'Configure GOOGLE_MEET_CLIENT_ID and GOOGLE_MEET_CLIENT_SECRET.',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/committees/comm-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/committees/:id"
              element={<CommitteeWorkspacePage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Examination Fee Inquiry Panel' })).toBeInTheDocument();
      });

      // Verify 8 Workspace Tabs exist
      expect(screen.getByText('1. Overview')).toBeInTheDocument();
      expect(screen.getByText(/2. Members/)).toBeInTheDocument();
      expect(screen.getByText(/3. Real-Time Chat/)).toBeInTheDocument();
      expect(screen.getByText(/4. Documents & Evidence/)).toBeInTheDocument();
      expect(screen.getByText(/5. Polls & Voting/)).toBeInTheDocument();
      expect(screen.getByText(/6. Meetings/)).toBeInTheDocument();
      expect(screen.getByText(/7. Decisions & Minutes/)).toBeInTheDocument();
      expect(screen.getByText('8. Activity History')).toBeInTheDocument();

      // Terms of Reference
      expect(screen.getAllByText(/Review fee structure calculations for PhD course work./).length).toBeGreaterThan(0);
    });

    it('switches to Real-Time Chat tab and shows messages feed', async () => {
      vi.mocked(committeeService.getCommitteeWorkspaceDetail).mockResolvedValue(mockWorkspaceDetail);
      vi.mocked(committeeService.getGoogleMeetStatus).mockResolvedValue({
        configured: false,
        status: 'CREDENTIALS_REQUIRED',
        provider: 'GOOGLE_MEET',
        required_scopes: [],
        message: 'Setup required',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/committees/comm-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/committees/:id"
              element={<CommitteeWorkspacePage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Examination Fee Inquiry Panel' })).toBeInTheDocument();
      });

      // Switch to Chat Tab
      fireEvent.click(screen.getByText(/3. Real-Time Chat/));

      await waitFor(() => {
        expect(screen.getByText('Committee Deliberation Channel')).toBeInTheDocument();
        expect(screen.getByText('Welcome colleagues. Let us review the ledger documents.')).toBeInTheDocument();
      });
    });

    it('switches to Polls tab and displays vote records with duplicate vote state', async () => {
      vi.mocked(committeeService.getCommitteeWorkspaceDetail).mockResolvedValue(mockWorkspaceDetail);
      vi.mocked(committeeService.getGoogleMeetStatus).mockResolvedValue({
        configured: false,
        status: 'CREDENTIALS_REQUIRED',
        provider: 'GOOGLE_MEET',
        required_scopes: [],
        message: 'Setup required',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/committees/comm-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/committees/:id"
              element={<CommitteeWorkspacePage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Examination Fee Inquiry Panel' })).toBeInTheDocument();
      });

      // Switch to Polls Tab
      fireEvent.click(screen.getByText(/5. Polls & Voting/));

      await waitFor(() => {
        expect(screen.getByText('Adopt Preliminary Finding Draft')).toBeInTheDocument();
        expect(screen.getByText('Approve Finding')).toBeInTheDocument();
        expect(screen.getByText('Reject Finding')).toBeInTheDocument();
        expect(screen.getByText(/Your Vote/)).toBeInTheDocument();
      });
    });

    it('displays Google Meet diagnostic notice and setup guide when unconfigured', async () => {
      vi.mocked(committeeService.getCommitteeWorkspaceDetail).mockResolvedValue(mockWorkspaceDetail);
      vi.mocked(committeeService.getGoogleMeetStatus).mockResolvedValue({
        configured: false,
        status: 'CREDENTIALS_REQUIRED',
        provider: 'GOOGLE_MEET',
        required_scopes: ['https://www.googleapis.com/auth/calendar.events'],
        message: 'Google Meet API credentials not configured in backend environment.',
        setup_instructions: 'Configure GOOGLE_MEET_CLIENT_ID and GOOGLE_MEET_CLIENT_SECRET.',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/committees/comm-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/committees/:id"
              element={<CommitteeWorkspacePage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Examination Fee Inquiry Panel' })).toBeInTheDocument();
      });

      // Switch to Meetings Tab
      fireEvent.click(screen.getByText(/6. Meetings/));

      await waitFor(() => {
        expect(screen.getByText('SETUP REQUIRED')).toBeInTheDocument();
        expect(screen.getByText(/Google Meet credentials unconfigured/)).toBeInTheDocument();
        expect(screen.getByText('View Setup Guide')).toBeInTheDocument();
      });

      // Toggle Setup Guide
      fireEvent.click(screen.getByText('View Setup Guide'));
      expect(screen.getByText(/Institutional Google Meet Configuration Instructions/)).toBeInTheDocument();
    });

    it('displays prominent dissolution banner and read-only mode when committee is dissolved', async () => {
      const dissolvedWorkspace: CommitteeWorkspaceDetail = {
        ...mockWorkspaceDetail,
        committee: mockCommittees[1], // comm-2 is DISSOLVED
        can_manage: false,
        can_vote: false,
      };

      vi.mocked(committeeService.getCommitteeWorkspaceDetail).mockResolvedValue(dissolvedWorkspace);
      vi.mocked(committeeService.getGoogleMeetStatus).mockResolvedValue({
        configured: false,
        status: 'CREDENTIALS_REQUIRED',
        provider: 'GOOGLE_MEET',
        required_scopes: [],
        message: 'Setup required',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/committees/comm-2']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/committees/:id"
              element={<CommitteeWorkspacePage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Laboratory Access Fact Finding Committee' })).toBeInTheDocument();
      });

      // Check Dissolution Banner
      expect(screen.getByText('DISSOLVED COMMITTEE')).toBeInTheDocument();
      expect(screen.getByText('Historical Workspace Retained (Read-Only)')).toBeInTheDocument();
      expect(
        screen.getByText(/Mandate fulfilled. Final report accepted by Dean R&D./)
      ).toBeInTheDocument();

      // Check that mutation buttons are not shown in Overview
      expect(screen.queryByText('+ Create Poll / Ballot')).not.toBeInTheDocument();
      expect(screen.queryByText('+ Schedule Meeting')).not.toBeInTheDocument();
    });
  });
});
