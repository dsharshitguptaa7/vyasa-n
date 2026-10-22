import React, { useState } from 'react';
import { Modal, Button, Badge, AppIcon } from '@vyasa/ui';
import { DocumentRequestItem } from '../types/grievance';

interface RequestDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (items: DocumentRequestItem[]) => Promise<void>;
  grievanceId?: string;
  loading?: boolean;
}

const COMMON_RECORD_PRESETS = [
  'RAC Evaluation Report',
  'Fee Receipts / Challan',
  'Attendance Register',
  'Coursework Grade Sheet',
  'Supervisor Correspondence',
];

export const RequestDocumentModal: React.FC<RequestDocumentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  grievanceId,
  loading = false,
}) => {
  const [docName, setDocName] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docDeadline, setDocDeadline] = useState('');
  const [items, setItems] = useState<DocumentRequestItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleAddItem = () => {
    if (!docName.trim()) {
      setErrorMsg('Document title is required.');
      return;
    }
    setErrorMsg(null);
    setItems((prev) => [
      ...prev,
      {
        document_name: docName.trim(),
        description: docDescription.trim() || undefined,
        deadline: docDeadline || undefined,
      },
    ]);
    setDocName('');
    setDocDescription('');
    setDocDeadline('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const setDeadlineDaysAhead = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setDocDeadline(target.toISOString().split('T')[0]);
  };

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      if (y && m && d) {
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    const finalItems = [...items];
    if (docName.trim()) {
      finalItems.push({
        document_name: docName.trim(),
        description: docDescription.trim() || undefined,
        deadline: docDeadline || undefined,
      });
    }

    if (finalItems.length === 0) {
      setErrorMsg('Please specify at least one required document.');
      return;
    }

    setErrorMsg(null);
    try {
      await onSubmit(finalItems);
      setItems([]);
      setDocName('');
      setDocDescription('');
      setDocDeadline('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit document request.');
    }
  };

  const totalCount = items.length + (docName.trim() ? 1 : 0);

  const modalTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <AppIcon name="file-text" size={18} color="var(--vyasa-primary, #1b2a4a)" />
      <span>Request Evidentiary Documents</span>
      {grievanceId && (
        <Badge variant="primary" size="sm" style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
          {grievanceId}
        </Badge>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      className="vyasa-modal--md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '10px' }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={totalCount === 0 || loading}
          >
            {loading
              ? 'Requesting Documents...'
              : totalCount > 1
              ? `Issue Document Request (${totalCount})`
              : 'Issue Document Request'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Jurisdictional & Status Transition Notice */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            padding: '12px 14px',
            backgroundColor: 'var(--vyasa-surface-warm, #fcfbf9)',
            border: '1px solid var(--vyasa-border-subtle, #e2e8f0)',
            borderLeft: '4px solid var(--vyasa-primary, #1b2a4a)',
            borderRadius: '6px',
          }}
        >
          <div style={{ flexShrink: 0, marginTop: '2px' }}>
            <AppIcon name="info" size={16} color="var(--vyasa-primary, #1b2a4a)" />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary, #475569)', lineHeight: 1.5 }}>
            Issuing a document request transitions the case status to{' '}
            <Badge variant="gold" size="sm" style={{ fontWeight: 600, display: 'inline-flex' }}>
              AWAITING_INFORMATION
            </Badge>{' '}
            while keeping your active jurisdictional assignment. The applicant will be notified to upload the requested records.
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#b91c1c',
              fontSize: '13px',
            }}
          >
            <AppIcon name="alert-circle" size={16} color="#b91c1c" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Staged Document Requests List */}
        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--vyasa-primary, #1b2a4a)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <span>Staged Requests ({items.length})</span>
              </label>
              <span style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary, #64748b)' }}>
                Will be submitted together
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '10px 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    <div style={{ marginTop: '2px', color: 'var(--vyasa-primary, #1b2a4a)' }}>
                      <AppIcon name="file-text" size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.document_name}</strong>
                        {item.deadline && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: 500,
                            }}
                          >
                            <AppIcon name="clock" size={11} color="#92400e" /> Due: {formatDisplayDate(item.deadline)}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    aria-label={`Remove ${item.document_name}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px',
                      marginLeft: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      transition: 'color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#dc2626';
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#94a3b8';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <AppIcon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Card */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-primary, #1b2a4a)' }}>
              {items.length > 0 ? 'Add Another Document' : 'Specify Document to Request'}
            </h4>
            {items.length > 0 && (
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Item #{items.length + 1}
              </span>
            )}
          </div>

          {/* Quick Preset Document Chips */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>
              Quick presets for common records:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {COMMON_RECORD_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDocName(preset);
                    setErrorMsg(null);
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: docName === preset ? '#e0f2fe' : '#ffffff',
                    color: docName === preset ? '#0369a1' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (docName !== preset) {
                      e.currentTarget.style.borderColor = '#94a3b8';
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (docName !== preset) {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }
                  }}
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Document Name / Title */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                Document Name / Title <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g., RAC Evaluation Report, Fee Receipts, Attendance Register..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--vyasa-primary, #1b2a4a)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(27, 42, 74, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Description / Instructions */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                Description / Context for Scholar{' '}
                <span style={{ fontWeight: 400, color: '#64748b' }}>(Optional)</span>
              </label>
              <textarea
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                placeholder="Specify which semester, dates, or specific pages are required..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                  resize: 'vertical',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--vyasa-primary, #1b2a4a)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(27, 42, 74, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Deadline Field with Quick Shortcuts */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                  Submission Deadline{' '}
                  <span style={{ fontWeight: 400, color: '#64748b' }}>(Optional)</span>
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDeadlineDaysAhead(days)}
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                      title={`Set deadline to ${days} days from today`}
                    >
                      +{days}d
                    </button>
                  ))}
                  {docDeadline && (
                    <button
                      type="button"
                      onClick={() => setDocDeadline('')}
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fff',
                        color: '#b91c1c',
                        cursor: 'pointer',
                      }}
                      title="Clear deadline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <input
                type="date"
                min={todayStr}
                value={docDeadline}
                onChange={(e) => setDocDeadline(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--vyasa-primary, #1b2a4a)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(27, 42, 74, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Add to List Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '6px',
                marginTop: '2px',
                borderTop: '1px dashed #e2e8f0',
              }}
            >
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Adding to list allows requesting multiple records in one notification.
              </span>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleAddItem}
                disabled={!docName.trim()}
              >
                + Add to List
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
