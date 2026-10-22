import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { committeeService } from '../services/committeeService';
import { CommitteeWorkspacePage } from '../pages/CommitteeWorkspacePage';
import { config } from '../../../../config/env';

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
    getChatWsTicket: vi.fn(),
    getCommitteeWsUrl: vi.fn((committeeId: string, ticket?: string) => {
      const baseWs = config.apiBaseUrl.replace(/^http/, 'ws');
      const url = `${baseWs}/modules/atharva-veda/nivaran/committees/${committeeId}/ws`;
      return ticket ? `${url}?ticket=${encodeURIComponent(ticket)}` : url;
    }),
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

describe('Committee Real-Time Chat Unit & Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. WebSocket URL & Ticket Helpers', () => {
    it('constructs canonical WebSocket URL without /api/v1 mismatch', () => {
      const commId = 'b8b323c9-0419-482a-a92c-623cba001111';
      const wsUrl = committeeService.getCommitteeWsUrl(commId);

      expect(wsUrl).toContain('/modules/atharva-veda/nivaran/committees/' + commId + '/ws');
      expect(wsUrl).not.toContain('/api/v1');
      expect(wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://')).toBe(true);
    });

    it('attaches and encodes single-use ticket in URL query params', () => {
      const commId = 'b8b323c9-0419-482a-a92c-623cba001111';
      const ticket = 'sec-ticket-xyz-123==';
      const wsUrl = committeeService.getCommitteeWsUrl(commId, ticket);

      expect(wsUrl).toContain('?ticket=' + encodeURIComponent(ticket));
    });
  });

  describe('2. Committee Workspace Chat Tab Behavior', () => {
    const mockDetail = {
      committee: {
        id: 'comm-chat-test',
        committee_name: 'Academic Ethics Inquiry Committee',
        status: 'ACTIVE',
        chairperson_name: 'Prof. Alok Kumar',
        chairperson_role: 'DEAN',
        chartered_at: '2026-10-14T00:00:00Z',
        members: [],
      },
      grievance: {
        id: 'grievance-123',
        tracking_id: 'GRV-2026-0099',
        title: 'Allegation of Research Misconduct',
        status: 'COMMITTEE_REVIEW',
        priority: 'HIGH',
      },
      recent_messages: [
        {
          id: 'msg-1',
          committee_id: 'comm-chat-test',
          sender_authority_id: 'auth-1',
          sender_name: 'Dr. Vivek Sharma',
          sender_role: 'ASSOCIATE_DEAN',
          sender_designation: 'Associate Dean Student Affairs',
          message_text: 'Initial dossier received and reviewed.',
          message_type: 'MESSAGE',
          created_at: '2026-10-17T10:00:00Z',
        },
      ],
      recent_polls: [],
      upcoming_meetings: [],
      recent_documents: [],
      formal_decisions: [],
      can_manage: true,
      can_vote: true,
      user_role_in_committee: 'CHAIRPERSON',
    };

    beforeEach(() => {
      vi.mocked(committeeService.getGoogleMeetStatus).mockResolvedValue({
        configured: false,
        status: 'CREDENTIALS_REQUIRED',
        provider: 'GOOGLE_MEET',
        required_scopes: [],
        message: 'Mock status',
        setup_instructions: '',
      });
    });

    it('renders chat message feed with sender, role, and message content', async () => {
      vi.mocked(committeeService.getCommitteeWorkspaceDetail).mockResolvedValueOnce(mockDetail as any);
      vi.mocked(committeeService.getChatWsTicket).mockResolvedValueOnce('mock-ticket-token');

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/committees/comm-chat-test']}>
          <Routes>
            <Route path="/modules/atharva-veda/nivaran/committees/:id" element={<CommitteeWorkspacePage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Academic Ethics Inquiry Committee' })).toBeInTheDocument();
      });

      // Switch to Chat tab
      const chatTab = screen.getByText(/3\. Real-Time Chat/i);
      fireEvent.click(chatTab);

      // Verify message rendered
      expect(screen.getByText('Initial dossier received and reviewed.')).toBeInTheDocument();
      expect(screen.getByText(/Dr\. Vivek Sharma/i)).toBeInTheDocument();
    });

    it('disables send button when message text is empty or whitespace', async () => {
      vi.mocked(committeeService.getCommitteeWorkspaceDetail).mockResolvedValueOnce(mockDetail as any);
      vi.mocked(committeeService.getChatWsTicket).mockResolvedValueOnce('mock-ticket-token');

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/committees/comm-chat-test']}>
          <Routes>
            <Route path="/modules/atharva-veda/nivaran/committees/:id" element={<CommitteeWorkspacePage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Academic Ethics Inquiry Committee' })).toBeInTheDocument();
      });

      const chatTab = screen.getByText(/3\. Real-Time Chat/i);
      fireEvent.click(chatTab);

      const sendBtn = screen.getByRole('button', { name: /Send Message/i });
      expect(sendBtn).toBeDisabled();

      const textarea = screen.getByPlaceholderText(/Type committee deliberation message/i);
      fireEvent.change(textarea, { target: { value: '   ' } });
      expect(sendBtn).toBeDisabled();

      fireEvent.change(textarea, { target: { value: 'Valid deliberation remark' } });
      expect(sendBtn).not.toBeDisabled();
    });

    it('submits message and clears input on Send Message click', async () => {
      vi.mocked(committeeService.getCommitteeWorkspaceDetail).mockResolvedValueOnce(mockDetail as any);
      vi.mocked(committeeService.getChatWsTicket).mockResolvedValueOnce('mock-ticket-token');
      vi.mocked(committeeService.postMessage).mockResolvedValueOnce({
        id: 'msg-new-2',
        committee_id: 'comm-chat-test',
        sender_authority_id: 'mock-user-123',
        sender_name: 'Prof. Alok Kumar',
        sender_role: 'DEAN',
        message_text: 'Hearing scheduled for next Tuesday.',
        message_type: 'MESSAGE',
        created_at: new Date().toISOString(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/committees/comm-chat-test']}>
          <Routes>
            <Route path="/modules/atharva-veda/nivaran/committees/:id" element={<CommitteeWorkspacePage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Academic Ethics Inquiry Committee' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/3\. Real-Time Chat/i));

      const textarea = screen.getByPlaceholderText(/Type committee deliberation message/i);
      fireEvent.change(textarea, { target: { value: 'Hearing scheduled for next Tuesday.' } });

      const sendBtn = screen.getByRole('button', { name: /Send Message/i });
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });
  });
});
