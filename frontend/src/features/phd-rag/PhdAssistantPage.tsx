import React, { useState, useEffect, useRef } from 'react';
import { Badge, Button, PageContainer } from '@vyasa/ui';
import {
  phdRagService,
  ChatMessage,
  SuggestedQuestionItem,
  PhdStatusResponse,
} from '../../services/phdRagService';
import { VyasaAvatar } from './components/VyasaAvatar';
import { CopyButton } from './components/CopyButton';
import { AudioSpeechPlayer, SpeechPlaybackState } from './components/AudioSpeechPlayer';
import { VoiceInputButton } from './components/VoiceInputButton';
import { FeedbackButtons } from './components/FeedbackButtons';
import { BRAND_NAMES } from '../../constants/userFacingCopy';
import './PhdAssistant.css';

export const PhdAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestionItem[]>([]);
  const [statusInfo, setStatusInfo] = useState<PhdStatusResponse | null>(null);
  const [expandedCitationId, setExpandedCitationId] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Audio Playback State tracking
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<SpeechPlaybackState>('idle');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load suggestions and status
    phdRagService
      .getSuggestedQuestions()
      .then((res) => setSuggestedQuestions(res.questions))
      .catch((err) => console.error('Failed to load questions:', err));

    phdRagService
      .getStatus()
      .then((res) => setStatusInfo(res))
      .catch((err) => console.error('Failed to load status:', err));
  }, []);

  // Cleanup audio playback on component unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handlePlaybackStateChange = (messageId: string | null, state: SpeechPlaybackState) => {
    setActivePlayingId(messageId);
    setPlaybackState(state);
  };

  const handleSendQuery = async (queryText?: string) => {
    const text = (queryText || inputText).trim();
    if (!text || isLoading) return;

    // Stop any currently running text-to-speech reading
    if (typeof window !== 'undefined' && window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
      window.speechSynthesis.cancel();
    }
    setActivePlayingId(null);
    setPlaybackState('idle');

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    setLastFailedQuery(null);

    // Format conversation history (up to last 4 turns)
    const historyPayload = messages.slice(-4).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await phdRagService.askQuestion(text, historyPayload);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: response.citations,
        has_conflict: response.has_conflict,
        is_grounded: response.is_grounded,
        suggested_followups: response.suggested_followups,
        model_used: response.model_used,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      console.error('Chat error:', err);
      let errMsg = err instanceof Error ? err.message : 'Network error';
      // Prevent internal AI provider details or model identifiers from leaking to end users
      if (/gemini|google[\s_-]*genai|flash-lite|embedding-001/i.test(errMsg)) {
        errMsg = 'The AI Assistant service encountered a temporary processing error';
      }
      setLastFailedQuery(text);

      const errorAssistantMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errMsg}. Please try again or rephrase your question.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        is_error: true,
      };

      setMessages((prev) => [...prev, errorAssistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
      window.speechSynthesis.cancel();
    }
    setActivePlayingId(null);
    setPlaybackState('idle');
    setMessages([]);
    setLastFailedQuery(null);
  };

  const handleTopicClick = (topic: string) => {
    if (selectedTopic === topic) {
      setSelectedTopic(null);
    } else {
      setSelectedTopic(topic);
      if (!inputText) {
        if (topic === 'Doctoral Studies') {
          setInputText('What are the Ph.D. coursework requirements?');
        } else if (topic === 'Academic Regulations') {
          setInputText('Which university regulations apply to doctoral studies?');
        } else if (topic === 'Admissions (2026-27)') {
          setInputText('What is the Ph.D. application fee and eligibility criteria?');
        }
      }
    }
  };

  const renderInlineMarkdown = (text: string) => {
    // Highlight bracketed citations, bold, code
    const parts = text.split(/(\[[^\]]+\]|\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx} style={{ fontWeight: 650, color: '#0f172a' }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={pIdx}
            style={{
              backgroundColor: '#f1f5f9',
              color: '#0f172a',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '0.88em',
              fontFamily: 'monospace',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('[') && part.endsWith(']')) {
        return (
          <span
            key={pIdx}
            style={{
              backgroundColor: '#fef3c7',
              color: '#92400e',
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '0.85em',
              fontWeight: 600,
              margin: '0 2px',
              border: '1px solid #fde68a',
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const renderFormattedAnswer = (content: string) => {
    const rawLines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        elements.push(<div key={`spacer-${i}`} style={{ height: '8px' }} />);
        i++;
        continue;
      }

      // Check for Markdown Table: lines starting and ending with |
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
        const tableLines: string[] = [];
        while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
          tableLines.push(rawLines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const headerCells = tableLines[0]
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());

          const hasSeparator = tableLines.length > 1 && /^\|(\s*[-:]+\s*\|)+$/.test(tableLines[1]);
          const rowLines = hasSeparator ? tableLines.slice(2) : tableLines.slice(1);

          elements.push(
            <div key={`table-${i}`} className="vyasa-table-wrapper">
              <table className="vyasa-markdown-table">
                <thead>
                  <tr>
                    {headerCells.map((h, hIdx) => (
                      <th key={hIdx}>{renderInlineMarkdown(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowLines.map((r, rIdx) => {
                    const cells = r
                      .split('|')
                      .slice(1, -1)
                      .map((c) => c.trim());
                    return (
                      <tr key={rIdx}>
                        {cells.map((c, cIdx) => (
                          <td key={cIdx}>{renderInlineMarkdown(c)}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4
            key={`h4-${i}`}
            style={{
              margin: '14px 0 6px 0',
              color: 'var(--vyasa-navy-primary, #0f2b48)',
              fontWeight: 700,
              fontSize: '1.02rem',
              letterSpacing: '-0.01em',
            }}
          >
            {renderInlineMarkdown(trimmed.replace('### ', ''))}
          </h4>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3
            key={`h3-${i}`}
            style={{
              margin: '16px 0 8px 0',
              color: 'var(--vyasa-navy-primary, #0f2b48)',
              fontWeight: 700,
              fontSize: '1.14rem',
              letterSpacing: '-0.01em',
            }}
          >
            {renderInlineMarkdown(trimmed.replace('## ', ''))}
          </h3>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('# ')) {
        elements.push(
          <h2
            key={`h2-${i}`}
            style={{
              margin: '18px 0 8px 0',
              color: 'var(--vyasa-navy-primary, #0f2b48)',
              fontWeight: 800,
              fontSize: '1.24rem',
              letterSpacing: '-0.02em',
            }}
          >
            {renderInlineMarkdown(trimmed.replace('# ', ''))}
          </h2>
        );
        i++;
        continue;
      }

      // Bullet List Items
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const bulletText = trimmed.substring(2);
        elements.push(
          <li
            key={`li-${i}`}
            style={{
              marginLeft: '20px',
              marginBottom: '5px',
              lineHeight: 1.6,
              color: 'var(--vyasa-text-secondary, #334155)',
            }}
          >
            {renderInlineMarkdown(bulletText)}
          </li>
        );
        i++;
        continue;
      }

      // Numbered List Items
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        elements.push(
          <div
            key={`num-${i}`}
            style={{
              display: 'flex',
              gap: '8px',
              marginLeft: '6px',
              marginBottom: '5px',
              lineHeight: 1.6,
              color: 'var(--vyasa-text-secondary, #334155)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--vyasa-navy-primary, #0f2b48)' }}>
              {numberedMatch[1]}.
            </span>
            <div style={{ flex: 1 }}>{renderInlineMarkdown(numberedMatch[2])}</div>
          </div>
        );
        i++;
        continue;
      }

      // Regular Paragraph
      elements.push(
        <p
          key={`p-${i}`}
          style={{
            margin: '0 0 8px 0',
            lineHeight: 1.65,
            color: 'var(--vyasa-text-secondary, #334155)',
          }}
        >
          {renderInlineMarkdown(trimmed)}
        </p>
      );
      i++;
    }

    return elements;
  };

  // Header avatar state
  const headerAvatarState = isLoading
    ? 'thinking'
    : playbackState === 'speaking'
    ? 'speaking'
    : playbackState === 'paused'
    ? 'paused'
    : 'idle';

  // Default suggestions reflecting the 4 core institutional research categories
  const defaultPrompts: SuggestedQuestionItem[] = [
    {
      category: 'Ph.D. Coursework',
      question: 'How many credits are required for Ph.D. course work?',
      primary_source: 'Course Work PPT (2026-27)',
    },
    {
      category: 'Admission & Eligibility',
      question: 'What is the Ph.D. application fee?',
      primary_source: 'Admission Brochure (2026-27)',
    },
    {
      category: 'Doctoral Ordinances',
      question: 'Which university regulations apply to doctoral studies?',
      primary_source: 'Ph.D. Ordinance (2024-25)',
    },
    {
      category: 'Research Methodology',
      question: 'What are the research submission requirements and coursework components?',
      primary_source: 'Course Work PPT (2026-27)',
    },
  ];

  // Merge backend suggestions into prompts if present
  const displayPrompts = suggestedQuestions.length > 0 ? suggestedQuestions : defaultPrompts;

  return (
    <PageContainer style={{ padding: '0', maxWidth: '100%', margin: '0' }}>
      <div className="vyasa-assistant-page">
        {/* 1. Compact Institutional Header */}
        <header className="vyasa-compact-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <VyasaAvatar
              size="sm"
              state={headerAvatarState}
              alt="VYASA AI Assistant Logo"
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 750, margin: 0, color: 'var(--vyasa-navy-primary)', letterSpacing: '-0.01em' }}>
                  VYASA AI Assistant
                </h1>
                <Badge variant="gold">Research & Development Assistant</Badge>
                <Badge variant="neutral">Public &bull; No Login</Badge>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: '#92400e', fontWeight: 600 }}>Chhatrapati Shahu Ji Maharaj University, Kanpur</span>
                <span>&bull;</span>
                <span>Your AI guide to research, doctoral studies, and academic regulations at CSJMU.</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => handleTopicClick('Doctoral Studies')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <Badge variant={selectedTopic === 'Doctoral Studies' ? 'gold' : 'teal'}>Doctoral Studies</Badge>
            </button>
            <button
              type="button"
              onClick={() => handleTopicClick('Academic Regulations')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <Badge variant={selectedTopic === 'Academic Regulations' ? 'gold' : 'primary'}>Academic Regulations</Badge>
            </button>
            <button
              type="button"
              onClick={() => handleTopicClick('Admissions (2026-27)')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <Badge variant={selectedTopic === 'Admissions (2026-27)' ? 'teal' : 'gold'}>Admissions (2026-27)</Badge>
            </button>

            {statusInfo && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.76rem',
                  color: '#334155',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span>
                  <strong>{statusInfo.total_documents} Authoritative University Documents</strong> ({statusInfo.total_chunks} verified passages) &bull; Zero Hallucination Mode
                </span>
              </div>
            )}
          </div>
        </header>

        {/* 2. Main AI Research Workspace Frame */}
        <main className="vyasa-chat-frame">
          {/* Transcript Container with Natural Flow */}
          <div className="vyasa-chat-transcript">
            {messages.length === 0 ? (
              /* Centered, Minimal Welcome State */
              <div className="vyasa-welcome-container">
                <div style={{ marginBottom: '14px' }}>
                  <VyasaAvatar
                    size="lg"
                    state="welcome"
                    alt="VYASA AI Assistant Logo"
                  />
                </div>

                <h2 style={{ fontSize: '1.65rem', fontWeight: 750, color: 'var(--vyasa-navy-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                  How can I help with your research?
                </h2>

                <p style={{ fontSize: '0.98rem', color: '#475569', maxWidth: '620px', margin: '0 auto 6px auto', lineHeight: 1.6 }}>
                  Your AI guide to research, doctoral studies, and academic regulations at CSJMU.
                </p>

                <p style={{ fontSize: '0.88rem', color: '#64748b', maxWidth: '580px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
                  Ask questions about Ph.D. coursework, academic regulations, research requirements, or university guidelines.
                </p>

                {/* Active Knowledge Domain Scope Card */}
                <div
                  style={{
                    maxWidth: '720px',
                    margin: '0 auto 20px auto',
                    padding: '10px 16px',
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid var(--vyasa-border-subtle)',
                    fontSize: '0.84rem',
                    color: '#475569',
                    lineHeight: 1.5,
                    textAlign: 'left',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.02)',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📘 Active Knowledge Domain:</span>
                    <span style={{ color: '#0369a1', fontWeight: 600 }}>Doctoral Studies & Academic Regulations</span>
                  </div>
                  Ask questions regarding Ph.D. research coursework credit requirements, doctoral degree ordinances, supervisor allocation rules, academic eligibility, and admission guidelines. Every response is strictly grounded in authoritative university documentation with verifiable citations.
                </div>

                {/* Suggestion Prompt Cards */}
                <div style={{ maxWidth: '780px', margin: '0 auto' }}>
                  <div className="vyasa-prompt-grid">
                    {displayPrompts.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={isLoading}
                        aria-label={p.question}
                        onClick={() => handleSendQuery(p.question)}
                        className="vyasa-prompt-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.74rem', color: '#d97706', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {p.category}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>&rarr;</span>
                        </div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>
                          {p.question}
                        </div>
                        {p.primary_source && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Source: {p.primary_source}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Message Stream */
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`vyasa-message-row ${
                    msg.role === 'user' ? 'vyasa-message-row--user' : 'vyasa-message-row--assistant'
                  }`}
                >
                  {/* Author Label & Time */}
                  <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: '4px', padding: '0 4px' }}>
                    {msg.role === 'user' ? 'You' : 'VYASA AI Assistant'} &bull; {msg.timestamp}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={
                      msg.role === 'user'
                        ? 'vyasa-bubble-user'
                        : `vyasa-bubble-assistant vyasa-answer-entrance ${msg.is_error ? 'vyasa-bubble-error' : ''}`
                    }
                    style={
                      msg.is_error
                        ? {
                            backgroundColor: '#fef2f2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                          }
                        : undefined
                    }
                  >
                    {/* Conflict Notice Banner */}
                    {msg.has_conflict && (
                      <div
                        style={{
                          backgroundColor: '#fffbeb',
                          borderLeft: '4px solid #f59e0b',
                          padding: '8px 12px',
                          marginBottom: '12px',
                          borderRadius: '0 4px 4px 0',
                          fontSize: '0.85rem',
                          color: '#92400e',
                        }}
                      >
                        <strong>Discrepancy Detected Between Authoritative Sources:</strong> The Ph.D. Orientation Course Work PPT (2026-27) specifies 12 credits across 5 components, while the Ph.D. Ordinance (2024-25) references 16 credits under general regulatory provisions. Both provisions are presented below.
                      </div>
                    )}

                    {/* Render content */}
                    {msg.role === 'user' ? (
                      <p style={{ margin: 0, lineHeight: 1.55 }}>{msg.content}</p>
                    ) : (
                      <div>{renderFormattedAnswer(msg.content)}</div>
                    )}

                    {/* Grounding & Action Bar for Assistant Messages */}
                    {msg.role === 'assistant' && !msg.is_error && (
                      <div
                        style={{
                          marginTop: '14px',
                          paddingTop: '10px',
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                          fontSize: '0.78rem',
                          color: '#64748b',
                        }}
                      >
                        <span>
                          {msg.is_grounded ? '✓ Source Grounded' : 'ℹ Informational'} &bull; {BRAND_NAMES.assistant}
                        </span>

                        {/* Action Bar: Copy Answer, Listen Controls, Feedback */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FeedbackButtons messageId={msg.id} />
                          <CopyButton textToCopy={msg.content} />
                          <AudioSpeechPlayer
                            textToRead={msg.content}
                            messageId={msg.id}
                            activePlayingId={activePlayingId}
                            onPlaybackStateChange={handlePlaybackStateChange}
                          />
                        </div>
                      </div>
                    )}

                    {/* Citations List */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                          Source Citations ({msg.citations.length} Retrieved Passages):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {msg.citations.map((cite) => {
                            const isExpanded = expandedCitationId === cite.chunk_id;
                            return (
                              <div
                                key={cite.chunk_id}
                                style={{
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  backgroundColor: '#f8fafc',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  onClick={() =>
                                    setExpandedCitationId(isExpanded ? null : cite.chunk_id)
                                  }
                                  style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.82rem',
                                    fontWeight: 500,
                                    color: '#1e293b',
                                  }}
                                >
                                  <span>📖 {cite.citation_label}</span>
                                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                    {isExpanded ? '▲ Hide snippet' : '▼ View passage'}
                                  </span>
                                </div>
                                {isExpanded && (
                                  <div
                                    style={{
                                      padding: '10px 12px',
                                      borderTop: '1px solid #e2e8f0',
                                      backgroundColor: '#ffffff',
                                      fontSize: '0.8rem',
                                      color: '#475569',
                                      lineHeight: 1.5,
                                      whiteSpace: 'pre-wrap',
                                      maxHeight: '200px',
                                      overflowY: 'auto',
                                    }}
                                  >
                                    {cite.chunk_text}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Follow-up question chips */}
                    {msg.suggested_followups && msg.suggested_followups.length > 0 && (
                      <div style={{ marginTop: '14px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>
                          Suggested follow-ups:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {msg.suggested_followups.map((f, fIdx) => (
                            <button
                              key={fIdx}
                              disabled={isLoading}
                              onClick={() => handleSendQuery(f)}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '16px',
                                fontSize: '0.78rem',
                                color: '#334155',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                textAlign: 'left',
                                opacity: isLoading ? 0.7 : 1,
                              }}
                            >
                              {f} &rarr;
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Subtle Thinking Experience */}
            {isLoading && (
              <div
                role="status"
                aria-live="polite"
                className="vyasa-thinking-card vyasa-answer-entrance"
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2.5px solid #cbd5e1',
                    borderTopColor: '#d97706',
                    borderRadius: '50%',
                    animation: 'vyasa-spin 0.9s linear infinite',
                    flexShrink: 0,
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#92400e' }}>
                      VYASA is preparing your answer...
                    </span>
                    <div className="vyasa-thinking-dots">
                      <span className="vyasa-thinking-dot" />
                      <span className="vyasa-thinking-dot" />
                      <span className="vyasa-thinking-dot" />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Searching authoritative passages and synthesizing source-grounded response...
                  </span>
                </div>
              </div>
            )}

            {/* Retry Button if last query failed */}
            {lastFailedQuery && (
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendQuery(lastFailedQuery)}
                >
                  Retry Last Question
                </Button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 3. Modern Floating Sticky Composer Component */}
          <div className="vyasa-composer-wrapper">
            <div className="vyasa-composer-pill">
              <VoiceInputButton
                currentText={inputText}
                onTranscriptChange={setInputText}
                disabled={isLoading}
              />

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendQuery();
                  }
                }}
                placeholder="Ask anything about CSJMU Ph.D. regulations, coursework, or research..."
                rows={1}
                maxLength={1000}
                disabled={isLoading}
                className="vyasa-composer-textarea"
                aria-label="Ask anything about CSJMU Ph.D. regulations, coursework, or research"
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearChat}
                    disabled={isLoading}
                    aria-label="Clear chat transcript"
                    title="Clear current transcript"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '6px',
                      color: '#94a3b8',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSendQuery()}
                  disabled={isLoading || !inputText.trim()}
                  style={{
                    borderRadius: '18px',
                    padding: '7px 16px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{isLoading ? 'Searching...' : 'Ask Question'}</span>
                  {!isLoading && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', fontSize: '0.74rem', color: '#94a3b8' }}>
              <span>
                Official CSJMU Ph.D. Research Assistant &bull; Answers strictly grounded in authoritative university documents.
              </span>
              <span>{inputText.length} / 1000 characters</span>
            </div>
          </div>
        </main>
      </div>
    </PageContainer>
  );
};
export default PhdAssistantPage;
