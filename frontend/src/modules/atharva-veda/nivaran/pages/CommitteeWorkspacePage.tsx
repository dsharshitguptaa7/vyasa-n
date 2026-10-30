import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Badge, Button, AppIcon } from '@vyasa/ui';
import { useAuth } from '../../../../context/AuthContext';
import { committeeService } from '../services/committeeService';
import './CaseReview.css';
import {
  CommitteeWorkspaceDetail,
  CommitteeMessageItem,
  GoogleMeetIntegrationStatus,
} from '../types/committee';

type TabKey =
  | 'overview'
  | 'members'
  | 'chat'
  | 'documents'
  | 'polls'
  | 'meetings'
  | 'decisions'
  | 'history';

export const CommitteeWorkspacePage: React.FC = () => {
  const { id: committeeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isDean, isAssociateDean, isAssistantDean, displayName } = useAuth();

  const [workspace, setWorkspace] = useState<CommitteeWorkspaceDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real-Time Chat state
  const [messages, setMessages] = useState<CommitteeMessageItem[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatAttachmentUrl, setChatAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const chatFeedRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isNearBottomRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<any>(null);

  // Google Meet integration status
  const [meetStatus, setMeetStatus] = useState<GoogleMeetIntegrationStatus | null>(null);
  const [showMeetGuide, setShowMeetGuide] = useState(false);

  // Dissolution modal state
  const [isDissolveModalOpen, setIsDissolveModalOpen] = useState(false);
  const [dissolutionReason, setDissolutionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Poll modal state
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollDescription, setPollDescription] = useState('');
  const [pollPolicy, setPollPolicy] = useState('SIMPLE_MAJORITY');
  const [pollQuorum, setPollQuorum] = useState<number>(3);
  const [pollOptions, setPollOptions] = useState<string[]>(['In Favor / Approve', 'Against / Reject', 'Abstain']);
  const [votingOnPollId, setVotingOnPollId] = useState<string | null>(null);
  const [selectedPollOption, setSelectedPollOption] = useState<{ [pollId: string]: string }>({});

  // Meeting modal state
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [meetingType, setMeetingType] = useState('VIDEO_CALL');
  const [meetingStart, setMeetingStart] = useState('');
  const [meetingEnd, setMeetingEnd] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [externalMeetLink, setExternalMeetLink] = useState('');

  // Document modal state
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('EVIDENCE');
  const [docBase64, setDocBase64] = useState('');

  // Decision modal state
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionType, setDecisionType] = useState<'DRAFT_DECISION' | 'FORMAL_DECISION' | 'MEETING_MINUTES' | 'FINAL_ORDER'>('FORMAL_DECISION');
  const [decisionOutcome, setDecisionOutcome] = useState<'APPROVED' | 'REJECTED' | 'ACTION_RECOMMENDED' | 'POLICY_REVIEW' | 'INCONCLUSIVE'>('APPROVED');
  const [decisionSummary, setDecisionSummary] = useState('');
  const [decisionMeetingId, setDecisionMeetingId] = useState('');
  const [decisionPollId, setDecisionPollId] = useState('');
  const [isFinalInstitutionalOrder, setIsFinalInstitutionalOrder] = useState(false);
  const [institutionalOrderRef, setInstitutionalOrderRef] = useState('');

  // Load committee detail
  const loadWorkspace = async (showSpinner = true) => {
    if (!committeeId) return;
    try {
      if (showSpinner) setLoading(true);
      setErrorMsg(null);
      const data = await committeeService.getCommitteeWorkspaceDetail(committeeId);
      setWorkspace(data);
      setMessages(data.recent_messages || []);

      // Pre-set poll quorum recommendation
      if (data.committee?.members?.length) {
        setPollQuorum(Math.ceil((data.committee.members.length + 1) / 2));
      }

      // Check Google Meet status
      committeeService
        .getGoogleMeetStatus(committeeId)
        .then((s) => setMeetStatus(s))
        .catch((e) => console.warn('Could not check Google Meet status:', e));
    } catch (err: any) {
      console.error('Failed to load committee workspace:', err);
      const msg = err.response?.data?.message || err.message || 'Access denied or committee not found.';
      setErrorMsg(msg);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [committeeId]);

  // Helper to scroll chat smoothly to bottom
  const scrollToBottom = (smooth = true) => {
    chatBottomRef.current?.scrollIntoView?.({ behavior: smooth ? 'smooth' : 'auto' });
    setHasUnreadBelow(false);
  };

  // Track scroll position to prevent forcefully pulling users to bottom when reading history
  const handleFeedScroll = () => {
    const el = chatFeedRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceToBottom < 75;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setHasUnreadBelow(false);
    }
  };

  // Real-Time Chat WebSocket Connection with single-use ticket and exponential backoff
  useEffect(() => {
    if (!committeeId || !workspace) return;

    let isMounted = true;

    const connectWs = async () => {
      if (!isMounted) return;
      try {
        setWsStatus('connecting');
        setChatError(null);

        // 1. Obtain secure short-lived single-use ticket (no bearer token in WS URL)
        let ticket = '';
        try {
          ticket = await committeeService.getChatWsTicket(committeeId);
        } catch (ticketErr: any) {
          console.warn('Could not acquire WS ticket, attempting fallback:', ticketErr);
        }

        if (!isMounted) return;

        // 2. Canonical WebSocket path derived directly from config.apiBaseUrl
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
        const wsUrl = committeeService.getCommitteeWsUrl(committeeId, ticket || undefined);

        let ws: WebSocket;
        if (ticket) {
          ws = new WebSocket(wsUrl);
        } else if (token) {
          ws = new WebSocket(wsUrl, [`vyasa-auth.${token}`]);
        } else {
          ws = new WebSocket(wsUrl);
        }

        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) {
            ws.close();
            return;
          }
          setWsStatus('connected');
          setChatError(null);
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'chat_message' && data.payload) {
              setMessages((prev) => {
                // Deduplicate by message ID
                if (prev.some((m) => m.id === data.payload.id)) return prev;
                return [...prev, data.payload];
              });

              if (isNearBottomRef.current) {
                setTimeout(() => scrollToBottom(true), 50);
              } else {
                setHasUnreadBelow(true);
              }
            } else if (data.type === 'error') {
              setChatError(data.detail || 'WebSocket communication error.');
            } else if (data.type === 'message_ack') {
              setIsSending(false);
            }
          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        };

        ws.onclose = (event) => {
          if (!isMounted) return;
          setWsStatus('disconnected');
          // If close code was 1008 (Policy Violation / Unauthorized), do not spam reconnect
          if (event.code === 1008 || event.code === 4403 || event.code === 4401) {
            setChatError('WebSocket authorization denied. Chat room is locked to unauthorized personas.');
            return;
          }
          // Exponential backoff reconnect: 1.5s, 3s, 6s... up to 30s
          const attempts = reconnectAttemptsRef.current;
          const delay = Math.min(1500 * Math.pow(1.5, attempts), 30000);
          reconnectAttemptsRef.current += 1;
          reconnectTimerRef.current = setTimeout(connectWs, delay);
        };

        ws.onerror = (e) => {
          if (!isMounted) return;
          console.warn('WebSocket connection error, falling back to REST sync:', e);
          setWsStatus('disconnected');
        };
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Failed to initialize WebSocket:', err);
        setWsStatus('disconnected');
        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(2000 * Math.pow(1.5, attempts), 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connectWs, delay);
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [committeeId, !!workspace]);

  // Scroll chat to bottom on tab open
  useEffect(() => {
    if (activeTab === 'chat') {
      setTimeout(() => {
        scrollToBottom(false);
      }, 100);
    }
  }, [activeTab]);

  const isDissolved = workspace?.committee?.status === 'DISSOLVED';
  const canManage = !!workspace?.can_manage && !isDissolved;
  const canVote = !!workspace?.can_vote && !isDissolved;

  // Handle Send Chat Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedText = chatInput.trim();
    if (!trimmedText || !committeeId || isDissolved || isSending) return;

    const clientMsgId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `msg-${Date.now()}`;

    const payload = {
      message_text: trimmedText,
      message_type: 'MESSAGE',
      attachment_url: chatAttachmentUrl.trim() || undefined,
    };

    setIsSending(true);
    setChatError(null);
    setChatInput('');
    setChatAttachmentUrl('');
    setShowAttachmentInput(false);

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: 'send_message',
            payload,
            client_msg_id: clientMsgId,
          })
        );
        setTimeout(() => scrollToBottom(true), 50);
      } else {
        // Fallback REST
        const newMsg = await committeeService.postMessage(committeeId, payload);
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch (err: any) {
      console.error('Failed to post message:', err);
      setChatError(err.response?.data?.message || err.message || 'Failed to send message');
      setChatInput(trimmedText);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Committee Dissolution
  const handleDissolveCommittee = async () => {
    if (!committeeId || !dissolutionReason.trim()) {
      alert('Please state a valid institutional reason for committee dissolution.');
      return;
    }
    try {
      setActionLoading(true);
      await committeeService.dissolveCommittee(committeeId, dissolutionReason.trim());
      setIsDissolveModalOpen(false);
      setDissolutionReason('');
      await loadWorkspace(false);
    } catch (err: any) {
      console.error('Failed to dissolve committee:', err);
      alert('Failed to dissolve committee: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Poll
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeId || !pollTitle.trim()) return;

    const filteredOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      alert('A poll must have at least two distinct options.');
      return;
    }

    try {
      setActionLoading(true);
      await committeeService.createPoll(committeeId, {
        title: pollTitle.trim(),
        description: pollDescription.trim(),
        voting_policy: pollPolicy,
        quorum_required: Number(pollQuorum) || 1,
        options: filteredOptions,
      });
      setIsPollModalOpen(false);
      setPollTitle('');
      setPollDescription('');
      setPollOptions(['In Favor / Approve', 'Against / Reject', 'Abstain']);
      await loadWorkspace(false);
    } catch (err: any) {
      console.error('Failed to create poll:', err);
      alert('Failed to create poll: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cast Vote
  const handleCastVote = async (pollId: string) => {
    const optionId = selectedPollOption[pollId];
    if (!optionId) {
      alert('Please select an option before casting your vote.');
      return;
    }

    try {
      setVotingOnPollId(pollId);
      await committeeService.castVote(pollId, optionId);
      await loadWorkspace(false);
    } catch (err: any) {
      console.error('Failed to cast vote:', err);
      alert('Failed to cast vote: ' + (err.response?.data?.message || err.message));
    } finally {
      setVotingOnPollId(null);
    }
  };

  // Handle Close Poll
  const handleClosePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to close this poll and ratify the recorded outcome?')) return;
    try {
      setActionLoading(true);
      await committeeService.closePoll(pollId);
      await loadWorkspace(false);
    } catch (err: any) {
      console.error('Failed to close poll:', err);
      alert('Failed to close poll: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Schedule Meeting
  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeId || !meetingTitle.trim() || !meetingStart || !meetingEnd) {
      alert('Please fill in title, start time, and end time.');
      return;
    }

    try {
      setActionLoading(true);
      await committeeService.scheduleMeeting(committeeId, {
        title: meetingTitle.trim(),
        agenda: meetingAgenda.trim() || undefined,
        meeting_type: meetingType,
        scheduled_start: new Date(meetingStart).toISOString(),
        scheduled_end: new Date(meetingEnd).toISOString(),
        notes: meetingNotes.trim() || undefined,
        external_meet_link: externalMeetLink.trim() || undefined,
      });
      setIsMeetingModalOpen(false);
      setMeetingTitle('');
      setMeetingAgenda('');
      setMeetingStart('');
      setMeetingEnd('');
      setMeetingNotes('');
      setExternalMeetLink('');
      await loadWorkspace(false);
    } catch (err: any) {
      console.error('Failed to schedule meeting:', err);
      alert('Failed to schedule meeting: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Meeting
  const handleCancelMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled meeting?')) return;
    try {
      setActionLoading(true);
      await committeeService.cancelMeeting(meetingId);
      await loadWorkspace(false);
    } catch (err: any) {
      console.error('Failed to cancel meeting:', err);
      alert('Failed to cancel meeting: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Document Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File size exceeds the 15 MB institutional limit.');
      return;
    }

    setDocFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setDocBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeId || !docFile || !docBase64) {
      alert('Please select a valid document to upload.');
      return;
    }

    try {
      setActionLoading(true);
      await committeeService.uploadDocument(committeeId, {
        file_name: docFile.name,
        mime_type: docFile.type || 'application/octet-stream',
        file_size: docFile.size,
        document_type: docType,
        content_base64: docBase64,
      });
      setIsDocModalOpen(false);
      setDocFile(null);
      setDocBase64('');
      await loadWorkspace(false);
    } catch (err: any) {
      console.error('Failed to upload document:', err);
      alert('Failed to upload document: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Record Formal Decision
  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeId || !decisionTitle.trim() || !decisionSummary.trim()) {
      alert('Please provide a decision title and summary text.');
      return;
    }

    try {
      setActionLoading(true);
      await committeeService.recordDecision(committeeId, {
        title: decisionTitle.trim(),
        decision_type: decisionType,
        outcome: decisionOutcome,
        summary: decisionSummary.trim(),
        meeting_id: decisionMeetingId || undefined,
        poll_id: decisionPollId || undefined,
        is_final_institutional_order: isFinalInstitutionalOrder,
        institutional_order_ref: institutionalOrderRef.trim() || undefined,
      });
      setIsDecisionModalOpen(false);
      setDecisionTitle('');
      setDecisionSummary('');
      setDecisionMeetingId('');
      setDecisionPollId('');
      setIsFinalInstitutionalOrder(false);
      setInstitutionalOrderRef('');
      await loadWorkspace(false);
    } catch (err: any) {
      console.error('Failed to record decision:', err);
      alert('Failed to record decision: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px 20px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--vyasa-text-secondary)' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            Loading Committee Workspace...
          </div>
          <div style={{ fontSize: '13px' }}>Verifying institutional credentials and permissions...</div>
        </div>
      </div>
    );
  }

  if (errorMsg || !workspace) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px 20px', boxSizing: 'border-box' }}>
        <Card variant="scholarly" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px', color: '#c53030' }}>&bull; Access Restricted</div>
          <p style={{ color: 'var(--vyasa-text-secondary)', marginBottom: '24px' }}>
            {errorMsg || 'You do not have authorization to view this confidential committee workspace.'}
          </p>
          <Button variant="primary" onClick={() => navigate('/modules/atharva-veda/nivaran/committees')}>
            &larr; Return to Committees Directory
          </Button>
        </Card>
      </div>
    );
  }

  const { committee } = workspace;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px 20px', boxSizing: 'border-box' }}>

      {/* 0. Clean Institutional Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#64748b',
          marginBottom: '16px',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
          <span>VYASA Dashboard</span>
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/assistant-dean/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          NIVARAN
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/committees')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Committees Workspace
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <span style={{ color: '#64748b', fontWeight: 500 }}>{committee.committee_name}</span>
      </nav>

      {/* Prominent Dissolved Banner */}
      {isDissolved && (
        <div
          style={{
            backgroundColor: '#fffaf0',
            border: '1px solid #feebc8',
            borderLeft: '4px solid #dd6b20',
            borderRadius: '6px',
            padding: '16px 20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Badge variant="saffron">DISSOLVED COMMITTEE</Badge>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#7b341e' }}>
              Historical Workspace Retained (Read-Only)
            </span>
            {committee.disbanded_at && (
              <span style={{ fontSize: '12px', color: '#9c4221' }}>
                Concluded on {new Date(committee.disbanded_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#7b341e', lineHeight: 1.5 }}>
            <strong>Institutional Reason:</strong> {committee.dissolution_reason || 'Mandate fulfilled / resolved.'}
          </div>
          <div style={{ fontSize: '12px', color: '#9c4221', marginTop: '6px' }}>
            In accordance with CSJMU governance policies, all committee discussions, voting records, meeting agendas,
            uploaded evidence, and recorded decisions are permanently preserved for statutory audit and compliance review.
          </div>
        </div>
      )}

      {/* 1. Canonical Committee Header with Watermark */}
      <div className="nivaran-case-header">
        {/* Architectural building watermark */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '160px',
            top: 0,
            bottom: 0,
            width: '260px',
            opacity: 0.04,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <AppIcon name="building" size={200} color="#0f2b48" />
        </div>

        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip" aria-hidden="true">
              <AppIcon name="users" size={20} color="var(--vyasa-navy, #1b2a4a)" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--vyasa-gold, #b2811a)',
                  marginBottom: '2px',
                }}
              >
                Chhatrapati Shahu Ji Maharaj University, Kanpur
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading">
                  {committee.committee_name}
                </h1>
                <Badge variant={committee.status === 'ACTIVE' ? 'teal' : 'saffron'}>
                  {committee.status}
                </Badge>
                {workspace.user_role_in_committee && (
                  <Badge variant="saffron">
                    Your Role: {workspace.user_role_in_committee}
                  </Badge>
                )}
                {/* Academic Session Indicator */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(27, 42, 74, 0.06)',
                    border: '1px solid rgba(27, 42, 74, 0.12)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--vyasa-navy, #1b2a4a)',
                  }}
                  title="Current Academic Governance Session"
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      display: 'inline-block',
                    }}
                  />
                  <span>Session 2026–27</span>
                </div>
              </div>

              <p className="nivaran-case-meta">
                <span className="nivaran-case-meta__item">
                  <strong>Chairperson:</strong> {committee.chairperson_name}
                </span>
                <span className="nivaran-case-meta__sep">&bull;</span>
                <span className="nivaran-case-meta__item">
                  <strong>Chartered:</strong> {committee.chartered_at ? new Date(committee.chartered_at).toLocaleDateString() : 'N/A'}
                </span>
                <span className="nivaran-case-meta__sep">&bull;</span>
                <span className="nivaran-case-meta__item">
                  <strong>Appointed Members:</strong> {committee.members?.length || committee.members_count || 0}
                </span>
              </p>
            </div>
          </div>

          <div className="nivaran-case-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {committee.grievance_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isAssistantDean) {
                    navigate(`/modules/atharva-veda/nivaran/assistant-dean/grievance/${committee.grievance_id}`);
                  } else if (isAssociateDean) {
                    navigate(`/modules/atharva-veda/nivaran/associate-dean/grievance/${committee.grievance_id}`);
                  } else {
                    navigate(`/modules/atharva-veda/nivaran/manager/review/${committee.grievance_id}`);
                  }
                }}
              >
                Related Grievance {committee.grievance_tracking_id ? `(#${committee.grievance_tracking_id})` : ''} &rarr;
              </Button>
            )}

            {canManage && (
              <Button
                variant="outline"
                size="sm"
                style={{ borderColor: '#e53e3e', color: '#c53030' }}
                onClick={() => setIsDissolveModalOpen(true)}
              >
                Dissolve Committee
              </Button>
            )}
          </div>
        </div>

        {committee.terms_of_reference && (
          <div
            style={{
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(27, 42, 74, 0.08)',
              fontSize: '13px',
              color: 'var(--vyasa-text-secondary, #475569)',
              lineHeight: 1.5,
            }}
          >
            <strong>Terms of Reference:</strong> {committee.terms_of_reference}
          </div>
        )}
      </div>

      {/* 2. Authority Identity & Committee Jurisdiction Summary Strip */}
      <div
        data-testid="authority-identity-summary"
        className="nivaran-authority-identity-strip"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid var(--vyasa-gold, #b2811a)',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(178, 129, 26, 0.12)',
              color: 'var(--vyasa-gold, #b2811a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vyasa-navy, #0f2b48)' }}>
              {user?.fullName || displayName || 'Authorized Authority'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Your Role in Committee:{' '}
              <span style={{ fontWeight: 600, color: 'var(--vyasa-navy, #0f2b48)' }}>
                {workspace.user_role_in_committee || 'Authorized Viewer'}
              </span>
              {' '}&bull; Deliberation Status:{' '}
              <span style={{ fontWeight: 600, color: committee.status === 'ACTIVE' ? '#166534' : '#991b1b' }}>
                {committee.status}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#64748b' }}>
          <div>
            <strong>Quorum Rule:</strong> Simple Majority
          </div>
          <span style={{ color: '#cbd5e1' }}>&bull;</span>
          <div>
            <strong>Compliance:</strong> UGC (Grievance Redressal) Regulations
          </div>
        </div>
      </div>

      {/* 8-Section Dedicated Workspace Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '24px',
          gap: '4px',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        {[
          { key: 'overview', label: '1. Overview' },
          { key: 'members', label: `2. Members (${committee.members?.length || 0})` },
          { key: 'chat', label: `3. Real-Time Chat (${messages.length})` },
          { key: 'documents', label: `4. Documents & Evidence (${workspace.recent_documents?.length || 0})` },
          { key: 'polls', label: `5. Polls & Voting (${workspace.active_polls?.length || 0})` },
          { key: 'meetings', label: `6. Meetings (${workspace.upcoming_meetings?.length || 0})` },
          { key: 'decisions', label: `7. Decisions & Minutes (${workspace.recent_decisions?.length || 0})` },
          { key: 'history', label: '8. Activity History' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              style={{
                background: 'none',
                border: 'none',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--vyasa-navy)' : 'var(--vyasa-text-secondary)',
                borderBottom: isActive ? '3px solid var(--vyasa-navy)' : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Quick Stats Grid */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            <Card variant="scholarly" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                {committee.members?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
                Committee Members
              </div>
            </Card>

            <Card variant="scholarly" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                {messages.length}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
                Deliberation Messages
              </div>
            </Card>

            <Card variant="scholarly" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                {workspace.active_polls?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
                Polls &amp; Ballots
              </div>
            </Card>

            <Card variant="scholarly" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                {workspace.upcoming_meetings?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
                Committee Meetings
              </div>
            </Card>

            <Card variant="scholarly" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                {workspace.recent_documents?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
                Documents &amp; Evidence
              </div>
            </Card>

            <Card variant="scholarly" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                {workspace.recent_decisions?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
                Recorded Decisions
              </div>
            </Card>
          </div>

          {/* Terms of Reference & Mandate */}
          <Card variant="scholarly" title="Terms of Reference & Mandate" style={{ padding: '20px' }}>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--vyasa-text-secondary)', marginBottom: '16px' }}>
              {committee.terms_of_reference || 'No specific terms of reference recorded.'}
            </p>
            <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <strong>Authority Standard:</strong> Established under CSJMU Research &amp; Academic Redressal Regulations.
              Proceedings are privileged and strictly accessible to appointed members and supervisory deans.
            </div>
          </Card>

          {/* Grievance & Case Context */}
          <Card variant="scholarly" title="Related Grievance Context" style={{ padding: '20px' }}>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>Tracking ID:</span>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
                {committee.grievance_tracking_id || 'N/A'}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>Case Subject / Title:</span>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
                {committee.grievance_title || 'Institutional Grievance Case'}
              </div>
            </div>

            {committee.grievance_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isAssistantDean) {
                    navigate(`/modules/atharva-veda/nivaran/assistant-dean/grievance/${committee.grievance_id}`);
                  } else if (isAssociateDean) {
                    navigate(`/modules/atharva-veda/nivaran/associate-dean/grievance/${committee.grievance_id}`);
                  } else {
                    navigate(`/modules/atharva-veda/nivaran/manager/review/${committee.grievance_id}`);
                  }
                }}
              >
                Inspect Full Case Docket &rarr;
              </Button>
            )}
          </Card>

          {/* Quick Actions Row */}
          {!isDissolved && (
            <Card variant="scholarly" title="Quick Workspace Actions" style={{ gridColumn: '1 / -1', padding: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button variant="primary" size="sm" onClick={() => setActiveTab('chat')}>
                  Open Deliberation Chat &rarr;
                </Button>
                {canManage && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setIsPollModalOpen(true)}>
                      + Create Poll / Ballot
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsMeetingModalOpen(true)}>
                      + Schedule Meeting
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsDocModalOpen(true)}>
                      + Upload Evidence
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsDecisionModalOpen(true)}>
                      + Record Formal Decision
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: MEMBERS AND RESPONSIBILITIES */}
      {activeTab === 'members' && (
        <Card variant="scholarly" title="Committee Membership Roster" style={{ padding: '20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', marginBottom: '16px' }}>
            Appointed faculty and administrative authorities formally assigned to this inquiry committee.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {committee.members?.map((m) => {
              const isChair = m.member_role === 'CHAIRPERSON' || m.authority_id === committee.chairperson_id;
              return (
                <div
                  key={m.id || m.authority_id}
                  style={{
                    border: isChair ? '2px solid #b7791f' : '1px solid #e2e8f0',
                    backgroundColor: isChair ? '#fffaf0' : '#ffffff',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--vyasa-navy)' }}>
                      {m.authority_name}
                    </div>
                    <Badge variant={isChair ? 'gold' : 'teal'}>
                      {m.member_role || (isChair ? 'CHAIRPERSON' : 'MEMBER')}
                    </Badge>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', marginBottom: '6px' }}>
                    <strong>Institutional Role:</strong> {m.authority_role || 'Faculty Authority'}
                  </div>

                  {m.authority_designation && (
                    <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginBottom: '6px' }}>
                      <strong>Designation:</strong> {m.authority_designation}
                    </div>
                  )}

                  <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)', borderTop: '1px solid #edf2f7', paddingTop: '8px', marginTop: '8px' }}>
                    Appointed: {m.appointed_at ? new Date(m.appointed_at).toLocaleDateString() : 'At Formation'}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* TAB 3: REAL-TIME CHAT */}
      {activeTab === 'chat' && (
        <Card variant="scholarly" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
          {/* Chat Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--vyasa-navy)' }}>
                Committee Deliberation Channel
              </div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
                Confidential real-time communications between committee members and supervisors.
              </div>
            </div>

            {/* Connection Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor:
                    wsStatus === 'connected' ? '#38a169' : wsStatus === 'connecting' ? '#dd6b20' : '#e53e3e',
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vyasa-text-secondary)' }}>
                {wsStatus === 'connected'
                  ? 'WebSocket Connected'
                  : wsStatus === 'connecting'
                  ? 'Connecting...'
                  : 'REST Sync Active'}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {chatError && (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#fed7d7',
                color: '#9b2c2c',
                fontSize: '12px',
                borderBottom: '1px solid #feb2b2',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{chatError}</span>
              <button
                type="button"
                onClick={() => setChatError(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9b2c2c', fontWeight: 700 }}
              >
                &times;
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div
            ref={chatFeedRef}
            onScroll={handleFeedScroll}
            role="log"
            aria-live="polite"
            aria-label="Committee messages feed"
            style={{
              padding: '20px',
              height: '420px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#ffffff',
            }}
          >
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--vyasa-text-secondary)', fontSize: '13px' }}>
                No messages yet in this committee room. Start the deliberation below.
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = user?.id === msg.sender_authority_id || displayName === msg.sender_name;
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      backgroundColor: isMe ? '#edf2f7' : '#f7fafc',
                      border: isMe ? '1px solid #cbd5e0' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px', fontSize: '11px' }}>
                      <span style={{ fontWeight: 700, color: isMe ? 'var(--vyasa-navy)' : '#2d3748' }}>
                        {msg.sender_name} {msg.sender_role ? `(${msg.sender_role})` : ''}
                      </span>
                      <span style={{ color: 'var(--vyasa-text-secondary)' }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#1a202c', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {msg.message_text}
                    </div>

                    {msg.attachment_url && (
                      <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #cbd5e0' }}>
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '12px', color: 'var(--vyasa-navy)', textDecoration: 'underline' }}
                        >
                          &bull; View Attached Document &rarr;
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* New Messages Floating Indicator */}
          {hasUnreadBelow && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              style={{
                position: 'absolute',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--vyasa-navy)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                zIndex: 10,
              }}
            >
              &darr; New messages below
            </button>
          )}

          {/* Chat Input Bar */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            {isDissolved ? (
              <div style={{ fontSize: '13px', color: '#7b341e', textAlign: 'center', fontStyle: 'italic' }}>
                Deliberation channel is locked because this committee has been formally dissolved.
              </div>
            ) : (
              <form onSubmit={handleSendMessage}>
                {showAttachmentInput && (
                  <div style={{ marginBottom: '8px' }}>
                    <input
                      type="url"
                      placeholder="Enter attachment URL (document, Google Drive link, report)..."
                      value={chatAttachmentUrl}
                      onChange={(e) => setChatAttachmentUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e0',
                      }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAttachmentInput(!showAttachmentInput)}
                  >
                    {showAttachmentInput ? 'Cancel Attachment' : '+ Attachment'}
                  </Button>
                  <textarea
                    aria-label="Committee deliberation message"
                    placeholder="Type committee deliberation message... (Enter to send, Shift+Enter for newline)"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    rows={2}
                    style={{
                      flex: 1,
                      padding: '8px 14px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e0',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 1.4,
                    }}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!chatInput.trim() || isSending}
                  >
                    {isSending ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>
      )}

      {/* TAB 4: DOCUMENTS AND EVIDENCE */}
      {activeTab === 'documents' && (
        <Card variant="scholarly" title="Documents & Evidence Repository" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
              Tamper-evident evidentiary documents, case dossiers, and hearing transcripts secured with SHA-256 integrity hashes.
            </p>
            {canManage && (
              <Button variant="primary" size="sm" onClick={() => setIsDocModalOpen(true)}>
                + Upload Document / Evidence
              </Button>
            )}
          </div>

          {(!workspace.recent_documents || workspace.recent_documents.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vyasa-text-secondary)', fontSize: '13px' }}>
              No documents or evidence files uploaded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--vyasa-text-secondary)' }}>
                    <th style={{ padding: '10px' }}>File Name</th>
                    <th style={{ padding: '10px' }}>Category</th>
                    <th style={{ padding: '10px' }}>Size</th>
                    <th style={{ padding: '10px' }}>Uploaded By</th>
                    <th style={{ padding: '10px' }}>Upload Date</th>
                    <th style={{ padding: '10px' }}>SHA-256 Integrity Hash</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.recent_documents.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
                        {doc.file_name}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <Badge variant="neutral">{doc.document_type || 'EVIDENCE'}</Badge>
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--vyasa-text-secondary)' }}>
                        {(doc.file_size / 1024).toFixed(1)} KB
                      </td>
                      <td style={{ padding: '12px 10px' }}>{doc.uploaded_by_name}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--vyasa-text-secondary)' }}>
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        {doc.content_hash ? (
                          <span
                            title={doc.content_hash}
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              backgroundColor: '#edf2f7',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {doc.content_hash.slice(0, 12)}...
                          </span>
                        ) : (
                          <span style={{ color: '#a0aec0', fontSize: '11px' }}>Unverified</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <a
                          href={doc.file_path}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '12px',
                            color: 'var(--vyasa-navy)',
                            textDecoration: 'underline',
                            fontWeight: 600,
                          }}
                        >
                          View / Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 5: POLLS AND VOTING */}
      {activeTab === 'polls' && (
        <Card variant="scholarly" title="Committee Polls & Voting Ballots" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
                Formal committee consensus polling with quorum verification and ballot recording.
              </p>
              <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>
                Note: Poll outcomes represent advisory committee consensus and must be ratified as decisions before executive action.
              </div>
            </div>
            {canManage && (
              <Button variant="primary" size="sm" onClick={() => setIsPollModalOpen(true)}>
                + Create Formal Poll
              </Button>
            )}
          </div>

          {(!workspace.active_polls || workspace.active_polls.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vyasa-text-secondary)', fontSize: '13px' }}>
              No polls or voting ballots active or recorded for this committee.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {workspace.active_polls.map((poll) => {
                const isOpen = poll.status === 'OPEN';
                const hasVoted = poll.user_has_voted;

                return (
                  <div
                    key={poll.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                            {poll.title}
                          </h3>
                          <Badge variant={isOpen ? 'teal' : 'saffron'}>{poll.status}</Badge>
                          <Badge variant="neutral">{poll.voting_policy}</Badge>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
                          {poll.description}
                        </p>
                      </div>

                      {canManage && isOpen && (
                        <Button
                          variant="outline"
                          size="sm"
                          style={{ borderColor: '#e53e3e', color: '#c53030' }}
                          onClick={() => handleClosePoll(poll.id)}
                        >
                          Close &amp; Ratify Ballot
                        </Button>
                      )}
                    </div>

                    {/* Quorum & Participation Bar */}
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: 'var(--vyasa-text-secondary)',
                        marginBottom: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        <strong>Votes Cast:</strong> {poll.total_votes} / {poll.total_eligible} eligible
                      </span>
                      <span>
                        <strong>Quorum Required:</strong> {poll.quorum_required} &bull;{' '}
                        {poll.quorum_reached ? (
                          <span style={{ color: '#38a169', fontWeight: 600 }}>Quorum Met &check;</span>
                        ) : (
                          <span style={{ color: '#dd6b20', fontWeight: 600 }}>Quorum Pending</span>
                        )}
                      </span>
                    </div>

                    {/* Voting Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                      {poll.options.map((opt) => {
                        const isSelected = selectedPollOption[poll.id] === opt.id;
                        const isUserVote = poll.user_voted_option_id === opt.id;

                        return (
                          <div
                            key={opt.id}
                            style={{
                              border: isUserVote ? '2px solid #38a169' : '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '10px 14px',
                              backgroundColor: isUserVote ? '#f0fff4' : '#ffffff',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isOpen && !hasVoted ? 'pointer' : 'default', fontWeight: 600, fontSize: '13px' }}>
                                {isOpen && !hasVoted && canVote && (
                                  <input
                                    type="radio"
                                    name={`poll_${poll.id}`}
                                    value={opt.id}
                                    checked={isSelected}
                                    onChange={() =>
                                      setSelectedPollOption((prev) => ({ ...prev, [poll.id]: opt.id }))
                                    }
                                  />
                                )}
                                <span>{opt.option_text}</span>
                                {isUserVote && (
                                  <span style={{ marginLeft: '6px' }}>
                                    <Badge variant="teal">
                                      Your Vote &check;
                                    </Badge>
                                  </span>
                                )}
                              </label>

                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vyasa-text-secondary)' }}>
                                {opt.vote_count} votes ({opt.vote_percentage.toFixed(0)}%)
                              </span>
                            </div>

                            {/* Percentage progress bar */}
                            <div style={{ height: '6px', width: '100%', backgroundColor: '#edf2f7', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${opt.vote_percentage}%`,
                                  backgroundColor: isUserVote ? '#38a169' : 'var(--vyasa-navy)',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Submit Vote Action */}
                    {isOpen && !hasVoted && canVote && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={!selectedPollOption[poll.id] || votingOnPollId === poll.id}
                          onClick={() => handleCastVote(poll.id)}
                        >
                          {votingOnPollId === poll.id ? 'Recording Vote...' : 'Submit Formal Vote'}
                        </Button>
                      </div>
                    )}

                    {hasVoted && isOpen && (
                      <div style={{ fontSize: '12px', color: '#38a169', fontWeight: 600, textAlign: 'right' }}>
                        &check; Your ballot has been securely registered.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* TAB 6: MEETINGS */}
      {activeTab === 'meetings' && (
        <Card variant="scholarly" title="Committee Meetings & Google Meet Integration" style={{ padding: '20px' }}>
          {/* Google Meet Diagnostic Status Card */}
          <div
            style={{
              border: meetStatus?.configured ? '1px solid #c6f6d5' : '1px solid #feebc8',
              backgroundColor: meetStatus?.configured ? '#f0fff4' : '#fffaf0',
              borderRadius: '6px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Badge variant={meetStatus?.configured ? 'teal' : 'saffron'}>
                    {meetStatus?.configured ? 'GOOGLE MEET CONFIGURED' : 'SETUP REQUIRED'}
                  </Badge>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: meetStatus?.configured ? '#276749' : '#7b341e' }}>
                    {meetStatus?.configured
                      ? 'Secure Google Calendar / Meet integration active'
                      : 'Google Meet credentials unconfigured (Manual links supported)'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: meetStatus?.configured ? '#2f855a' : '#9c4221' }}>
                  {meetStatus?.message ||
                    'Configure GOOGLE_MEET_CLIENT_ID and GOOGLE_MEET_CLIENT_SECRET to enable automated 1-click meeting room creation.'}
                </div>
              </div>

              {!meetStatus?.configured && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMeetGuide(!showMeetGuide)}
                >
                  {showMeetGuide ? 'Hide Setup Guide' : 'View Setup Guide'}
                </Button>
              )}
            </div>

            {/* Collapsible Setup Instructions */}
            {showMeetGuide && !meetStatus?.configured && (
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #feebc8',
                  fontSize: '12px',
                  color: '#7b341e',
                  lineHeight: 1.5,
                }}
              >
                <strong>Institutional Google Meet Configuration Instructions:</strong>
                <ol style={{ paddingLeft: '18px', marginTop: '6px', marginBottom: '6px' }}>
                  <li>Create a Google Cloud project with Google Calendar API enabled.</li>
                  <li>Configure OAuth 2.0 Client credentials with scopes: <code>https://www.googleapis.com/auth/calendar.events</code>.</li>
                  <li>Set <code>GOOGLE_MEET_CLIENT_ID</code>, <code>GOOGLE_MEET_CLIENT_SECRET</code>, and <code>GOOGLE_MEET_REFRESH_TOKEN</code> in backend environment.</li>
                </ol>
                <em>Note: In the meantime, meeting convenors can manually supply any valid institutional Google Meet URL when scheduling.</em>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
              Scheduled hearing sessions, evidence reviews, and virtual committee conferences.
            </p>
            {canManage && (
              <Button variant="primary" size="sm" onClick={() => setIsMeetingModalOpen(true)}>
                + Schedule Committee Meeting
              </Button>
            )}
          </div>

          {(!workspace.upcoming_meetings || workspace.upcoming_meetings.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vyasa-text-secondary)', fontSize: '13px' }}>
              No meetings scheduled for this committee.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {workspace.upcoming_meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                          {meeting.title}
                        </h3>
                        <Badge variant={meeting.meeting_status === 'SCHEDULED' ? 'teal' : 'neutral'}>
                          {meeting.meeting_status}
                        </Badge>
                      </div>
                      {meeting.agenda && (
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
                          <strong>Agenda:</strong> {meeting.agenda}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {meeting.meet_link && meeting.meeting_status === 'SCHEDULED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => window.open(meeting.meet_link, '_blank')}
                        >
                          Join Google Meet &rarr;
                        </Button>
                      )}

                      {canManage && meeting.meeting_status === 'SCHEDULED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          style={{ borderColor: '#e53e3e', color: '#c53030' }}
                          onClick={() => handleCancelMeeting(meeting.id)}
                        >
                          Cancel Meeting
                        </Button>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '20px',
                      fontSize: '12px',
                      color: 'var(--vyasa-text-secondary)',
                      borderTop: '1px solid #edf2f7',
                      paddingTop: '8px',
                      marginTop: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      <strong>Date &amp; Time:</strong> {new Date(meeting.scheduled_start).toLocaleString()} &ndash;{' '}
                      {new Date(meeting.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>
                      <strong>Meeting Mode:</strong> {meeting.meeting_type}
                    </span>
                    {meeting.meet_link && (
                      <span>
                        <strong>Conference Link:</strong>{' '}
                        <a href={meeting.meet_link} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                          {meeting.meet_link}
                        </a>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 7: DECISIONS AND MINUTES */}
      {activeTab === 'decisions' && (
        <Card variant="scholarly" title="Decisions, Findings & Minutes of Proceeding" style={{ padding: '20px' }}>
          {/* Statutory Order Notice */}
          <div
            style={{
              backgroundColor: '#ebf8ff',
              borderLeft: '4px solid #3182ce',
              borderRadius: '4px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#2b6cb0',
              lineHeight: 1.5,
            }}
          >
            <strong>Governance Standard:</strong> Committee recorded decisions represent collegiate findings,
            inquiry conclusions, and formal recommendations. Unless ratified as an Executive Order by the Dean or Vice-Chancellor,
            they remain advisory institutional determinations.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
              Structured minutes, resolutions, and recommendations finalized by the committee.
            </p>
            {canManage && (
              <Button variant="primary" size="sm" onClick={() => setIsDecisionModalOpen(true)}>
                + Record Formal Decision
              </Button>
            )}
          </div>

          {(!workspace.recent_decisions || workspace.recent_decisions.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vyasa-text-secondary)', fontSize: '13px' }}>
              No formal decisions or minutes recorded yet for this committee.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {workspace.recent_decisions.map((dec) => (
                <div
                  key={dec.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                          {dec.title}
                        </h3>
                        <Badge variant="neutral">{dec.decision_type}</Badge>
                        <Badge
                          variant={
                            dec.outcome === 'APPROVED'
                              ? 'teal'
                              : dec.outcome === 'REJECTED'
                              ? 'neutral'
                              : 'saffron'
                          }
                        >
                          {dec.outcome}
                        </Badge>
                        {dec.is_final_institutional_order && (
                          <Badge variant="gold">EXECUTIVE ORDER RATIFIED</Badge>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#2d3748', lineHeight: 1.5 }}>
                        {dec.summary}
                      </p>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)', textAlign: 'right' }}>
                      <div>Recorded on {new Date(dec.recorded_at).toLocaleDateString()}</div>
                      <div>by {dec.recorded_by_name} ({dec.recorded_by_role})</div>
                    </div>
                  </div>

                  {dec.institutional_order_ref && (
                    <div style={{ fontSize: '12px', color: '#2b6cb0', marginTop: '6px' }}>
                      <strong>Statutory Order Reference:</strong> {dec.institutional_order_ref}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 8: ACTIVITY HISTORY */}
      {activeTab === 'history' && (
        <Card variant="scholarly" title="Audit Trail & Committee Activity History" style={{ padding: '20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', marginBottom: '16px' }}>
            Comprehensive chronological governance activity timeline for compliance and institutional review.
          </p>

          <div style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '12px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Dissolution event */}
            {isDissolved && (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-27px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#c53030' }} />
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#c53030' }}>
                  Committee Formally Dissolved
                </div>
                <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
                  Reason: {committee.dissolution_reason || 'Mandate concluded'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)' }}>
                  {committee.disbanded_at ? new Date(committee.disbanded_at).toLocaleString() : ''}
                </div>
              </div>
            )}

            {/* Decisions */}
            {workspace.recent_decisions?.map((dec) => (
              <div key={dec.id} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-27px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--vyasa-navy)' }} />
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--vyasa-navy)' }}>
                  Decision Recorded: {dec.title} ({dec.outcome})
                </div>
                <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
                  Recorded by {dec.recorded_by_name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)' }}>
                  {new Date(dec.recorded_at).toLocaleString()}
                </div>
              </div>
            ))}

            {/* Meetings */}
            {workspace.upcoming_meetings?.map((m) => (
              <div key={m.id} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-27px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#38a169' }} />
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#276749' }}>
                  Meeting Scheduled: {m.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)' }}>
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            ))}

            {/* Formation Event */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-27px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3182ce' }} />
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#2b6cb0' }}>
                Committee Chartered &amp; Formed
              </div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
                Chairperson appointed: {committee.chairperson_name} with {committee.members?.length || 0} members.
              </div>
              <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)' }}>
                {committee.chartered_at ? new Date(committee.chartered_at).toLocaleString() : ''}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* DISSOLVE COMMITTEE MODAL */}
      {isDissolveModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <Card variant="scholarly" style={{ maxWidth: '500px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 700, color: '#c53030' }}>
              Dissolve Committee
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Dissolving this committee formally marks its mandate as concluded. All deliberation history,
              poll ballots, meeting records, uploaded documents, and decisions will remain accessible in <strong>read-only mode</strong> for institutional auditing.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Reason for Dissolution *
              </label>
              <textarea
                rows={3}
                placeholder="State formal findings, resolution summary, or reason for closure..."
                value={dissolutionReason}
                onChange={(e) => setDissolutionReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="outline" size="sm" onClick={() => setIsDissolveModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                style={{ backgroundColor: '#c53030', borderColor: '#c53030' }}
                disabled={!dissolutionReason.trim() || actionLoading}
                onClick={handleDissolveCommittee}
              >
                {actionLoading ? 'Dissolving...' : 'Confirm Dissolution'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* CREATE POLL MODAL */}
      {isPollModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <Card variant="scholarly" style={{ maxWidth: '520px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
              Create Committee Poll / Ballot
            </h3>
            <form onSubmit={handleCreatePoll}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Poll Question / Resolution Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Approve preliminary investigation findings?"
                  value={pollTitle}
                  onChange={(e) => setPollTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Context / Resolution Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide background or context for this vote..."
                  value={pollDescription}
                  onChange={(e) => setPollDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Voting Policy
                  </label>
                  <select
                    value={pollPolicy}
                    onChange={(e) => setPollPolicy(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                  >
                    <option value="SIMPLE_MAJORITY">Simple Majority (&gt; 50%)</option>
                    <option value="TWO_THIRDS_MAJORITY">Two-Thirds Majority (66.7%)</option>
                    <option value="UNANIMOUS">Unanimous Consensus (100%)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Quorum Required
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={committee.members?.length || 10}
                    value={pollQuorum}
                    onChange={(e) => setPollQuorum(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Ballot Options
                </label>
                {pollOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...pollOptions];
                        copy[idx] = e.target.value;
                        setPollOptions(copy);
                      }}
                      style={{ flex: 1, padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                    />
                    {pollOptions.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                      >
                        &times;
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPollOptions([...pollOptions, `Option ${pollOptions.length + 1}`])}
                  style={{ marginTop: '4px' }}
                >
                  + Add Option
                </Button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPollModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={actionLoading}>
                  {actionLoading ? 'Creating Poll...' : 'Launch Poll'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* SCHEDULE MEETING MODAL */}
      {isMeetingModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <Card variant="scholarly" style={{ maxWidth: '520px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
              Schedule Committee Meeting
            </h3>
            <form onSubmit={handleScheduleMeeting}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Meeting Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Evidence Review Session &amp; Hearing"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Agenda
                </label>
                <textarea
                  rows={2}
                  placeholder="Key discussion points and witness statements..."
                  value={meetingAgenda}
                  onChange={(e) => setMeetingAgenda(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Meeting Type
                </label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                >
                  <option value="VIDEO_CALL">Virtual Video Call (Google Meet)</option>
                  <option value="HYBRID">Hybrid Hearing</option>
                  <option value="IN_PERSON">In-Person Deliberation Session</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Start Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={meetingStart}
                    onChange={(e) => setMeetingStart(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    End Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={meetingEnd}
                    onChange={(e) => setMeetingEnd(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  External Google Meet URL (Optional if Google Meet API configured)
                </label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/xyz-abc-def"
                  value={externalMeetLink}
                  onChange={(e) => setExternalMeetLink(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsMeetingModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={actionLoading}>
                  {actionLoading ? 'Scheduling...' : 'Schedule Meeting'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {isDocModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <Card variant="scholarly" style={{ maxWidth: '500px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
              Upload Evidence / Document
            </h3>
            <form onSubmit={handleUploadDocument}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Document Category
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                >
                  <option value="EVIDENCE">Tamper-Evident Case Evidence</option>
                  <option value="MINUTES">Meeting Minutes &amp; Proceeding Notes</option>
                  <option value="INVESTIGATION_REPORT">Investigation Finding Report</option>
                  <option value="TOR_RECORD">Terms of Reference Record</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Select File (PDF, DOCX, PNG, JPG &bull; Max 15 MB) *
                </label>
                <input
                  type="file"
                  required
                  onChange={handleFileChange}
                  style={{ width: '100%', fontSize: '13px' }}
                />
                {docFile && (
                  <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
                    Selected: {docFile.name} ({(docFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsDocModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={!docFile || !docBase64 || actionLoading}>
                  {actionLoading ? 'Hashing & Uploading...' : 'Upload & Hash'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* RECORD DECISION MODAL */}
      {isDecisionModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <Card variant="scholarly" style={{ maxWidth: '540px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
              Record Formal Committee Decision
            </h3>
            <form onSubmit={handleRecordDecision}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Decision / Resolution Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Findings regarding examination fee redressal"
                  value={decisionTitle}
                  onChange={(e) => setDecisionTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Record Type
                  </label>
                  <select
                    value={decisionType}
                    onChange={(e) => setDecisionType(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                  >
                    <option value="FORMAL_DECISION">Formal Committee Decision</option>
                    <option value="DRAFT_DECISION">Draft Decision (Working Copy)</option>
                    <option value="MEETING_MINUTES">Meeting Minutes &amp; Proceedings</option>
                    <option value="FINAL_ORDER">Executive Institutional Order</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Outcome Determination
                  </label>
                  <select
                    value={decisionOutcome}
                    onChange={(e) => setDecisionOutcome(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                  >
                    <option value="APPROVED">Grievance Upheld / Approved</option>
                    <option value="REJECTED">Grievance Dismissed / Rejected</option>
                    <option value="ACTION_RECOMMENDED">Corrective Action Recommended</option>
                    <option value="POLICY_REVIEW">Academic Policy Review Required</option>
                    <option value="INCONCLUSIVE">Inconclusive / Further Inquiry</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Summary of Findings &amp; Rationale *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Elaborate the committee's unanimous or majority findings..."
                  value={decisionSummary}
                  onChange={(e) => setDecisionSummary(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
                />
              </div>

              {isDean && (
                <div style={{ marginBottom: '12px', backgroundColor: '#fffaf0', padding: '10px 14px', borderRadius: '6px', border: '1px solid #feebc8' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isFinalInstitutionalOrder}
                      onChange={(e) => setIsFinalInstitutionalOrder(e.target.checked)}
                    />
                    <span>Ratify as Final Statutory University Order</span>
                  </label>
                  {isFinalInstitutionalOrder && (
                    <div style={{ marginTop: '8px' }}>
                      <input
                        type="text"
                        placeholder="Order Dispatch Reference (e.g. CSJMU/RD/2026/044)"
                        value={institutionalOrderRef}
                        onChange={(e) => setInstitutionalOrderRef(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsDecisionModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={actionLoading}>
                  {actionLoading ? 'Recording Decision...' : 'Record Decision'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
