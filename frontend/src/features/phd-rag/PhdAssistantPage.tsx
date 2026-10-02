import React, { useState, useEffect, useRef } from 'react';
import { Card, Badge, Button, PageContainer } from '@vyasa/ui';
import {
  phdRagService,
  ChatMessage,
  SuggestedQuestionItem,
  PhdStatusResponse,
} from '../../services/phdRagService';
import vyasaAssistantLogo from '../../../../assets/branding/vyasa/vyasa_assistant.png';


export const PhdAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestionItem[]>([]);
  const [statusInfo, setStatusInfo] = useState<PhdStatusResponse | null>(null);
  const [expandedCitationId, setExpandedCitationId] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSendQuery = async (queryText?: string) => {
    const text = (queryText || inputText).trim();
    if (!text || isLoading) return;

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
      const errMsg = err instanceof Error ? err.message : 'Network error';
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
    setMessages([]);
    setLastFailedQuery(null);
  };

  const renderFormattedAnswer = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} style={{ height: '8px' }} />;
      }

      if (trimmed.startsWith('### ')) {
        return (
          <h4
            key={idx}
            style={{
              margin: '12px 0 6px 0',
              color: 'var(--vyasa-text-primary, #1e293b)',
              fontWeight: 600,
              fontSize: '1.05rem',
            }}
          >
            {trimmed.replace('### ', '')}
          </h4>
        );
      }

      if (trimmed.startsWith('## ')) {
        return (
          <h3
            key={idx}
            style={{
              margin: '14px 0 8px 0',
              color: 'var(--vyasa-text-primary, #1e293b)',
              fontWeight: 700,
              fontSize: '1.15rem',
            }}
          >
            {trimmed.replace('## ', '')}
          </h3>
        );
      }

      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const bulletText = trimmed.substring(2);
        return (
          <li
            key={idx}
            style={{
              marginLeft: '20px',
              marginBottom: '4px',
              lineHeight: 1.6,
              color: 'var(--vyasa-text-secondary, #334155)',
            }}
          >
            {renderInlineMarkdown(bulletText)}
          </li>
        );
      }

      return (
        <p
          key={idx}
          style={{
            margin: '0 0 6px 0',
            lineHeight: 1.65,
            color: 'var(--vyasa-text-secondary, #334155)',
          }}
        >
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    });
  };

  const renderInlineMarkdown = (text: string) => {
    // Highlight bracketed citations
    const parts = text.split(/(\[[^\]]+\]|\*\*[^*]+\*\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('[') && part.endsWith(']')) {
        return (
          <span
            key={pIdx}
            style={{
              backgroundColor: '#fef3c7',
              color: '#92400e',
              padding: '2px 6px',
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

  return (
    <PageContainer style={{ padding: '32px 16px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          marginBottom: '24px',
          padding: '24px 28px',
          backgroundColor: '#fffdfa',
          borderRadius: '12px',
          border: '1px solid #f1e9d9',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: '1 1 500px' }}>
            <img
              src={vyasaAssistantLogo}
              alt="VYASA Assistant Logo"
              style={{
                width: '48px',
                height: '48px',
                objectFit: 'contain',
                flexShrink: 0,
                marginTop: '2px',
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Chhatrapati Shahu Ji Maharaj University, Kanpur
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  VYASA Assistant
                </h1>
                <Badge variant="gold">Research & Development Assistant</Badge>
                <Badge variant="neutral">Public &bull; No Login</Badge>
              </div>
              <p style={{ margin: '8px 0 0 0', color: '#475569', fontSize: '1.0rem', fontWeight: 500 }}>
                Your AI guide to research, doctoral studies, and academic regulations at CSJMU.
              </p>
            </div>
          </div>

          {/* Active Knowledge Domain Badges */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Knowledge Domain
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Badge variant="teal">Doctoral Studies</Badge>
              <Badge variant="primary">Academic Regulations</Badge>
              <Badge variant="gold">Admissions (2026-27)</Badge>
            </div>
          </div>
        </div>

        {/* Status Pill */}
        {statusInfo && (
          <div
            style={{
              marginTop: '16px',
              padding: '6px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.82rem',
              color: '#334155',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span>
              <strong>{statusInfo.total_documents} Authoritative University Documents</strong> ({statusInfo.total_chunks} verified passages) &bull; Zero Hallucination Mode
            </span>
          </div>
        )}
      </div>

      {/* 2. Main Chat Container */}
      <Card
        variant="scholarly"
        style={{
          minHeight: '480px',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
        }}
      >
        {/* Transcript Box */}
        <div
          style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            maxHeight: '560px',
            backgroundColor: '#fdfbf7',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {messages.length === 0 ? (
            /* Empty State */
            <div style={{ textAlign: 'center', padding: '36px 20px' }}>
              <img
                src={vyasaAssistantLogo}
                alt="VYASA Assistant Logo"
                style={{
                  width: '76px',
                  height: '76px',
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto 16px auto',
                }}
              />
              <h2 style={{ margin: '0 0 6px 0', fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>
                Welcome to VYASA Assistant
              </h2>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
                Chhatrapati Shahu Ji Maharaj University, Kanpur &bull; Research & Development Assistant
              </div>
              <p style={{ color: '#475569', maxWidth: '620px', margin: '0 auto 20px auto', lineHeight: 1.6, fontSize: '0.98rem' }}>
                Your AI guide to research, doctoral studies, and academic regulations at CSJMU.
              </p>

              {/* Active Knowledge Domain Scope Card */}
              <div
                style={{
                  maxWidth: '720px',
                  margin: '0 auto 28px auto',
                  padding: '12px 18px',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.88rem',
                  color: '#475569',
                  lineHeight: 1.5,
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📘 Active Knowledge Domain:</span>
                  <span style={{ color: '#0369a1', fontWeight: 500 }}>Doctoral Studies & Academic Regulations</span>
                </div>
                Ask questions regarding Ph.D. research coursework credit requirements, doctoral degree ordinances, supervisor allocation rules, academic eligibility, and admission guidelines. Every response is strictly grounded in authoritative university documentation with verifiable citations.
              </div>

              {/* Suggested Questions Grid */}
              <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'left' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Featured Research & Doctoral Questions:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendQuery(q.question)}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s',
                        fontSize: '0.88rem',
                        color: '#1e293b',
                        lineHeight: 1.4,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#d97706')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, marginBottom: '2px' }}>
                        {q.category} &bull; {q.primary_source}
                      </div>
                      {q.question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Message List */
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {/* Author Label & Time */}
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px' }}>
                  {msg.role === 'user' ? 'You' : 'VYASA Assistant'} &bull; {msg.timestamp}
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: msg.role === 'user' ? '80%' : '90%',
                    backgroundColor:
                      msg.role === 'user'
                        ? '#1e293b'
                        : msg.is_error
                        ? '#fef2f2'
                        : '#ffffff',
                    color:
                      msg.role === 'user'
                        ? '#ffffff'
                        : msg.is_error
                        ? '#991b1b'
                        : '#1e293b',
                    padding: '16px 20px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    border: msg.role === 'user' ? 'none' : msg.is_error ? '1px solid #fecaca' : '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
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
                    <p style={{ margin: 0, lineHeight: 1.5 }}>{msg.content}</p>
                  ) : (
                    <div>{renderFormattedAnswer(msg.content)}</div>
                  )}

                  {/* Grounding & Verification Tag */}
                  {msg.role === 'assistant' && !msg.is_error && (
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '8px',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        color: '#64748b',
                      }}
                    >
                      <span>
                        {msg.is_grounded ? '✓ Source Grounded' : 'ℹ Informational'} &bull; {msg.model_used || 'Gemini'}
                      </span>
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
                            onClick={() => handleSendQuery(f)}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '16px',
                              fontSize: '0.78rem',
                              color: '#334155',
                              cursor: 'pointer',
                              textAlign: 'left',
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

          {/* Loading Indicator */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '0.88rem' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #cbd5e1',
                  borderTopColor: '#d97706',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <span>Searching authoritative passages and synthesizing source-grounded response...</span>
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

        {/* Input Bar */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendQuery();
                }
              }}
              placeholder="Ask anything about CSJMU Ph.D. admissions, eligibility, fees, or coursework..."
              maxLength={1000}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => handleSendQuery()}
              disabled={isLoading || !inputText.trim()}
            >
              {isLoading ? 'Searching...' : 'Ask Question'}
            </Button>
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="md"
                onClick={handleClearChat}
                disabled={isLoading}
                title="Clear current transcript"
              >
                Clear
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
            <span>
              Official CSJMU Ph.D. RAG Assistant &bull; Answers strictly grounded in authoritative documents without guessing.
            </span>
            <span>{inputText.length} / 1000 characters</span>
          </div>
        </div>
      </Card>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </PageContainer>
  );
};
export default PhdAssistantPage;
