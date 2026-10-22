export interface CommitteeMember {
  id: string;
  authority_id: string;
  authority_name: string;
  authority_role: string;
  authority_designation?: string;
  member_role: string;
  appointed_at: string;
  is_active: boolean;
}

export interface CommitteeItem {
  id: string;
  grievance_id: string;
  grievance_tracking_id?: string;
  grievance_title?: string;
  committee_name: string;
  terms_of_reference?: string;
  chairperson_id: string;
  chairperson_name: string;
  chairperson_role?: string;
  status: 'ACTIVE' | 'CLOSED' | 'DISSOLVED';
  creation_request_id?: string;
  chartered_at: string;
  disbanded_at?: string;
  dissolution_reason?: string;
  dissolved_by_id?: string;
  dissolved_by_name?: string;
  members_count: number;
  messages_count: number;
  polls_count: number;
  meetings_count: number;
  documents_count: number;
  decisions_count: number;
  members: CommitteeMember[];
}

export interface CommitteeOverviewMetrics {
  total_committees: number;
  active_committees: number;
  dissolved_committees: number;
  pending_requests: number;
  pending_polls_for_user: number;
  upcoming_meetings: number;
}

export interface CommitteeCreationRequestItem {
  id: string;
  grievance_id: string;
  grievance_tracking_id?: string;
  requested_by_id: string;
  requested_by_name: string;
  requested_by_role: string;
  target_authority_id?: string;
  target_authority_name?: string;
  target_authority_role?: string;
  request_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED' | 'CANCELLED';
  justification: string;
  proposed_members_snapshot?: any;
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_remarks?: string;
  created_at: string;
  committee_id?: string;
}

export interface CommitteeMessageItem {
  id: string;
  committee_id: string;
  sender_authority_id: string;
  sender_name: string;
  sender_role: string;
  sender_designation?: string;
  message_text: string;
  message_type: string;
  attachment_url?: string;
  created_at: string;
}

export interface CommitteePollOptionItem {
  id: string;
  option_key: string;
  option_text: string;
  display_order: number;
  vote_count: number;
  vote_percentage: number;
}

export interface CommitteePollItem {
  id: string;
  committee_id: string;
  title: string;
  description: string;
  voting_policy: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  quorum_required: number;
  closing_time?: string;
  results_visibility: string;
  launched_at: string;
  closed_at?: string;
  options: CommitteePollOptionItem[];
  total_eligible: number;
  total_votes: number;
  quorum_reached: boolean;
  user_has_voted: boolean;
  user_voted_option_id?: string;
  winning_option_id?: string;
  winning_option_text?: string;
  decision_status?: string;
}

export interface CommitteeMeetingParticipant {
  id: string;
  user_id: string;
  authority_id?: string;
  name: string;
  role: string;
  attendance_confirmed: boolean;
}

export interface CommitteeMeetingItem {
  id: string;
  committee_id: string;
  title: string;
  agenda?: string;
  meeting_type: string;
  scheduled_start: string;
  scheduled_end: string;
  meet_link?: string;
  meeting_status: 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  outcome_summary?: string;
  notes?: string;
  created_at: string;
  participants: CommitteeMeetingParticipant[];
}

export interface GoogleMeetIntegrationStatus {
  configured: boolean;
  status: string;
  provider: string;
  required_scopes: string[];
  message: string;
  setup_instructions?: string;
}

export interface CommitteeDocumentItem {
  id: string;
  grievance_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  document_type: string;
  content_hash?: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface CommitteeFormalDecisionItem {
  id: string;
  committee_id: string;
  title: string;
  decision_type: 'DRAFT_DECISION' | 'FORMAL_DECISION' | 'MEETING_MINUTES' | 'FINAL_ORDER';
  outcome: 'APPROVED' | 'REJECTED' | 'ACTION_RECOMMENDED' | 'POLICY_REVIEW' | 'INCONCLUSIVE';
  summary: string;
  meeting_id?: string;
  poll_id?: string;
  participating_members_snapshot?: any;
  supporting_document_url?: string;
  recorded_by_authority_id: string;
  recorded_by_name: string;
  recorded_by_role: string;
  recorded_at: string;
  is_final_institutional_order: boolean;
  institutional_order_ref?: string;
  created_at: string;
  updated_at: string;
}

export interface CommitteeWorkspaceDetail {
  committee: CommitteeItem;
  user_role_in_committee?: string;
  can_manage: boolean;
  can_vote: boolean;
  recent_messages: CommitteeMessageItem[];
  active_polls: CommitteePollItem[];
  upcoming_meetings: CommitteeMeetingItem[];
  recent_documents: CommitteeDocumentItem[];
  recent_decisions: CommitteeFormalDecisionItem[];
}
