import React, { useState } from 'react';
import { Modal, Button } from '@vyasa/ui';
import { DocumentRequestItem } from '../types/grievance';

interface RequestDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (items: DocumentRequestItem[]) => Promise<void>;
  grievanceId?: string;
  loading?: boolean;
}

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalItems = [...items];
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Request Evidentiary Documents &bull; ${grievanceId || 'Grievance'}`}
      className="vyasa-modal--md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={(items.length === 0 && !docName.trim()) || loading}
          >
            {loading ? 'Requesting Documents...' : 'Issue Document Request'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          Issuing a document request transitions the case status to <strong>AWAITING_INFORMATION</strong> while
          keeping your active jurisdictional assignment. The applicant will be notified to upload the requested records.
        </p>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#b91c1c',
              fontSize: '13px',
            }}
          >
            {errorMsg}
          </div>
        )}

        {items.length > 0 && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Pending Document Requests ({items.length}):
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <strong>{item.document_name}</strong>
                    {item.deadline && <span style={{ color: '#64748b' }}> &bull; Due: {item.deadline}</span>}
                    {item.description && (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{item.description}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#b91c1c',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--vyasa-navy)' }}>
            {items.length > 0 ? 'Add Another Document' : 'Specify Document to Request'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Document Name / Title *
              </label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g., RAC Evaluation Report, Fee Receipts, Attendance Register..."
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Description / Context for Scholar (Optional)
              </label>
              <textarea
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                placeholder="Specify which semester, dates, or specific pages are required..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Submission Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={docDeadline}
                  onChange={(e) => setDocDeadline(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 8px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div style={{ alignSelf: 'flex-end' }}>
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
        </div>
      </form>
    </Modal>
  );
};
