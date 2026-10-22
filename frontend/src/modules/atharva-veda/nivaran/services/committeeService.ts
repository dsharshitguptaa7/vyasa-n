import { apiClient } from '../../../../services/apiClient';
import { config } from '../../../../config/env';
import {
  CommitteeItem,
  CommitteeOverviewMetrics,
  CommitteeWorkspaceDetail,
  CommitteeMessageItem,
  CommitteePollItem,
  CommitteeMeetingItem,
  CommitteeDocumentItem,
  CommitteeFormalDecisionItem,
  GoogleMeetIntegrationStatus,
  CommitteeCreationRequestItem,
} from '../types/committee';
import { EligibleAuthorityItem } from '../types/grievance';

const BASE_PREFIX = '/modules/atharva-veda/nivaran';

export const committeeService = {
  /**
   * Retrieves summary overview metrics across all authorized committees.
   */
  async getOverviewMetrics(): Promise<CommitteeOverviewMetrics> {
    const res = await apiClient.get<CommitteeOverviewMetrics>(
      `${BASE_PREFIX}/committees/overview-metrics`
    );
    return res.data!;
  },

  /**
   * Lists committees filtered by status or grievance.
   */
  async listCommittees(params?: {
    grievance_id?: string;
    status?: string;
  }): Promise<CommitteeItem[]> {
    const query = new URLSearchParams();
    if (params?.grievance_id) query.append('grievance_id', params.grievance_id);
    if (params?.status) query.append('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<CommitteeItem[]>(`${BASE_PREFIX}/committees${qs}`);
    return res.data || [];
  },

  /**
   * Retrieves full workspace detail for an authorized committee.
   */
  async getCommitteeWorkspaceDetail(
    committeeId: string
  ): Promise<CommitteeWorkspaceDetail> {
    const res = await apiClient.get<CommitteeWorkspaceDetail>(
      `${BASE_PREFIX}/committees/${committeeId}`
    );
    return res.data!;
  },

  /**
   * Formally dissolves a committee with reason, preserving historical data in read-only mode.
   */
  async dissolveCommittee(
    committeeId: string,
    reason: string
  ): Promise<{ id: string; status: string; disbanded_at?: string; dissolution_reason?: string }> {
    const res = await apiClient.post<{
      id: string;
      status: string;
      disbanded_at?: string;
      dissolution_reason?: string;
    }>(`${BASE_PREFIX}/committees/${committeeId}/dissolve`, { reason });
    return res.data!;
  },

  /**
   * Retrieves chronological chat messages for a committee room.
   */
  async listMessages(
    committeeId: string,
    limit: number = 50,
    beforeId?: string
  ): Promise<CommitteeMessageItem[]> {
    const query = new URLSearchParams();
    query.append('limit', String(limit));
    if (beforeId) query.append('before_id', beforeId);

    const res = await apiClient.get<CommitteeMessageItem[]>(
      `${BASE_PREFIX}/committees/${committeeId}/messages?${query.toString()}`
    );
    return res.data || [];
  },

  /**
   * Posts a new chat message to a committee workspace.
   */
  async postMessage(
    committeeId: string,
    payload: { message_text: string; message_type?: string; attachment_url?: string }
  ): Promise<CommitteeMessageItem> {
    const res = await apiClient.post<CommitteeMessageItem>(
      `${BASE_PREFIX}/committees/${committeeId}/messages`,
      payload
    );
    return res.data!;
  },

  /**
   * Requests a secure, single-use ticket for authenticating WebSocket connections.
   */
  async getChatWsTicket(committeeId: string): Promise<string> {
    const res = await apiClient.post<{ ticket: string; expires_in_seconds: number }>(
      `${BASE_PREFIX}/committees/${committeeId}/ws-ticket`
    );
    return res.data?.ticket || '';
  },

  /**
   * Generates the canonical WebSocket URL for a committee room.
   * Derives origin and protocol directly from config.apiBaseUrl, converting http->ws and https->wss.
   */
  getCommitteeWsUrl(committeeId: string, ticket?: string): string {
    const baseWs = config.apiBaseUrl.replace(/^http/, 'ws');
    const url = `${baseWs}${BASE_PREFIX}/committees/${committeeId}/ws`;
    return ticket ? `${url}?ticket=${encodeURIComponent(ticket)}` : url;
  },

  /**
   * Lists polls and vote tallies for a committee.
   */
  async listPolls(committeeId: string): Promise<CommitteePollItem[]> {
    const res = await apiClient.get<CommitteePollItem[]>(
      `${BASE_PREFIX}/committees/${committeeId}/polls`
    );
    return res.data || [];
  },

  /**
   * Creates a new formal committee poll.
   */
  async createPoll(
    committeeId: string,
    payload: {
      title: string;
      description: string;
      voting_policy?: string;
      quorum_required?: number;
      closing_time?: string;
      results_visibility?: string;
      options: string[];
    }
  ): Promise<CommitteePollItem> {
    const res = await apiClient.post<CommitteePollItem>(
      `${BASE_PREFIX}/committees/${committeeId}/polls`,
      payload
    );
    return res.data!;
  },

  /**
   * Casts a vote on an active committee poll.
   */
  async castVote(pollId: string, optionId: string): Promise<CommitteePollItem> {
    const res = await apiClient.post<CommitteePollItem>(
      `${BASE_PREFIX}/committees/polls/${pollId}/vote`,
      { option_id: optionId }
    );
    return res.data!;
  },

  /**
   * Closes a poll and ratifies the outcome.
   */
  async closePoll(pollId: string): Promise<CommitteePollItem> {
    const res = await apiClient.post<CommitteePollItem>(
      `${BASE_PREFIX}/committees/polls/${pollId}/close`
    );
    return res.data!;
  },

  /**
   * Lists scheduled committee meetings.
   */
  async listMeetings(committeeId: string): Promise<CommitteeMeetingItem[]> {
    const res = await apiClient.get<CommitteeMeetingItem[]>(
      `${BASE_PREFIX}/committees/${committeeId}/meetings`
    );
    return res.data || [];
  },

  /**
   * Schedules a new committee meeting with optional Google Meet generation.
   */
  async scheduleMeeting(
    committeeId: string,
    payload: {
      title: string;
      agenda?: string;
      meeting_type?: string;
      scheduled_start: string;
      scheduled_end: string;
      notes?: string;
      participant_authority_ids?: string[];
      external_meet_link?: string;
    }
  ): Promise<CommitteeMeetingItem> {
    const res = await apiClient.post<CommitteeMeetingItem>(
      `${BASE_PREFIX}/committees/${committeeId}/meetings`,
      payload
    );
    return res.data!;
  },

  /**
   * Updates meeting details.
   */
  async updateMeeting(
    meetingId: string,
    payload: Partial<CommitteeMeetingItem>
  ): Promise<CommitteeMeetingItem> {
    const res = await apiClient.patch<CommitteeMeetingItem>(
      `${BASE_PREFIX}/committees/meetings/${meetingId}`,
      payload
    );
    return res.data!;
  },

  /**
   * Cancels a committee meeting.
   */
  async cancelMeeting(meetingId: string): Promise<CommitteeMeetingItem> {
    const res = await apiClient.post<CommitteeMeetingItem>(
      `${BASE_PREFIX}/committees/meetings/${meetingId}/cancel`
    );
    return res.data!;
  },

  /**
   * Checks Google Meet integration readiness and setup requirements.
   */
  async getGoogleMeetStatus(
    committeeId: string
  ): Promise<GoogleMeetIntegrationStatus> {
    const res = await apiClient.get<GoogleMeetIntegrationStatus>(
      `${BASE_PREFIX}/committees/${committeeId}/meetings/integration-status`
    );
    return res.data!;
  },

  /**
   * Lists documents and evidence for a committee's case.
   */
  async listDocuments(committeeId: string): Promise<CommitteeDocumentItem[]> {
    const res = await apiClient.get<CommitteeDocumentItem[]>(
      `${BASE_PREFIX}/committees/${committeeId}/documents`
    );
    return res.data || [];
  },

  /**
   * Uploads evidence or minutes document with SHA-256 integrity hash.
   */
  async uploadDocument(
    committeeId: string,
    payload: {
      file_name: string;
      mime_type: string;
      file_size: number;
      document_type?: string;
      content_base64: string;
    }
  ): Promise<CommitteeDocumentItem> {
    const res = await apiClient.post<CommitteeDocumentItem>(
      `${BASE_PREFIX}/committees/${committeeId}/documents`,
      payload
    );
    return res.data!;
  },

  /**
   * Lists recorded formal committee decisions and minutes.
   */
  async listDecisions(committeeId: string): Promise<CommitteeFormalDecisionItem[]> {
    const res = await apiClient.get<CommitteeFormalDecisionItem[]>(
      `${BASE_PREFIX}/committees/${committeeId}/decisions`
    );
    return res.data || [];
  },

  /**
   * Records an official committee decision or meeting minutes.
   */
  async recordDecision(
    committeeId: string,
    payload: {
      title: string;
      decision_type: string;
      outcome: string;
      summary: string;
      meeting_id?: string;
      poll_id?: string;
      supporting_document_url?: string;
      is_final_institutional_order?: boolean;
      institutional_order_ref?: string;
    }
  ): Promise<CommitteeFormalDecisionItem> {
    const res = await apiClient.post<CommitteeFormalDecisionItem>(
      `${BASE_PREFIX}/committees/${committeeId}/decisions`,
      payload
    );
    return res.data!;
  },

  /**
   * Lists committee formation requests.
   */
  async listRequests(params?: {
    grievance_id?: string;
    status?: string;
  }): Promise<CommitteeCreationRequestItem[]> {
    const query = new URLSearchParams();
    if (params?.grievance_id) query.append('grievance_id', params.grievance_id);
    if (params?.status) query.append('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<CommitteeCreationRequestItem[]>(
      `${BASE_PREFIX}/committees/requests${qs}`
    );
    return res.data || [];
  },

  /**
   * Reviews a committee formation request (APPROVE, REJECT, REQUEST_CLARIFICATION).
   */
  async reviewRequest(
    requestId: string,
    payload: { action: string; remarks?: string }
  ): Promise<CommitteeCreationRequestItem> {
    const res = await apiClient.post<CommitteeCreationRequestItem>(
      `${BASE_PREFIX}/committees/requests/${requestId}/review`,
      payload
    );
    return res.data!;
  },

  /**
   * Forms a committee directly (Associate Dean or Dean).
   */
  async formCommitteeDirect(payload: any): Promise<CommitteeItem> {
    const res = await apiClient.post<CommitteeItem>(
      `${BASE_PREFIX}/committees/direct`,
      payload
    );
    return res.data!;
  },

  /**
   * Retrieves active authorities eligible for committee membership.
   */
  async getEligibleAuthorities(): Promise<EligibleAuthorityItem[]> {
    const res = await apiClient.get<EligibleAuthorityItem[]>(
      `${BASE_PREFIX}/authorities/eligible-committee-members`
    );
    return res.data || [];
  },
};
