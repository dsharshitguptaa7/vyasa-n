import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState, EmptyState, Modal } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { phase6dService } from '../services/phase6dService';
import { ClosureQueueItem, FinalizeClosureResponse } from '../types/phase6d';

export const ManagerClosureQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ClosureQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal / Review state
  const [selectedCase, setSelectedCase] = useState<ClosureQueueItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [closureSuccess, setClosureSuccess] = useState<FinalizeClosureResponse | null>(null);
  const [closureModalError, setClosureModalError] = useState<string | null>(null);

  const fetchQueue = async (p: number) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await phase6dService.getClosureQueue(p, pageSize);
      setQueue(data.items);
      setTotal(data.total);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve manager closure queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(page);
  }, [page]);

  const handleOpenClosureModal = (item: ClosureQueueItem) => {
    setSelectedCase(item);
    setClosureNotes('');
    setClosureSuccess(null);
    setClosureModalError(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedCase(null);
    setClosureSuccess(null);
    if (closureSuccess) {
      fetchQueue(page);
    }
  };

  const handleFinalizeClosure = async () => {
    if (!selectedCase) return;
    try {
      setSubmitting(true);
      setClosureModalError(null);
      const res = await phase6dService.finalizeClosure(selectedCase.id, {
        closure_notes: closureNotes.trim() ? closureNotes.trim() : undefined,
      });
      setClosureSuccess(res);
      // Refresh list
      fetchQueue(page);
    } catch (err: unknown) {
      setClosureModalError(err instanceof Error ? err.message : 'Failed to finalize institutional closure.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--vyasa-navy, #0f2b48)' }}>
              Institutional Closure &amp; E-File Queue
            </h2>
            <Badge variant="teal">{total} Resolved Cases</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Manager final oversight: review authority resolution notes and applicant feedback ratings before executing atomic closure and compiling digitally-sealed E-Files.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" onClick={() => navigate('/modules/atharva-veda/nivaran/manager/queue')}>
            &larr; Triage Queue
          </Button>
          <Button variant="outline" onClick={() => fetchQueue(page)}>
            Refresh
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading resolved cases awaiting manager closure..." />
      ) : queue.length === 0 ? (
        <EmptyState
          title="No Cases Awaiting Closure"
          description="All resolved grievances have either been finalized or there are currently no cases in RESOLVED status."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {queue.map((item) => (
            <Card key={item.id} variant="default" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--vyasa-navy, #0f2b48)' }}>
                      {item.grievance_id}
                    </span>
                    <Badge variant="saffron">{item.priority}</Badge>
                    <Badge variant="teal">RESOLVED</Badge>
                    {item.feedback_rating !== undefined && item.feedback_rating !== null ? (
                      <Badge variant="gold">
                        ★ {item.feedback_rating}/5 Feedback
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Pending Applicant Feedback</Badge>
                    )}
                  </div>

                  <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: '#1e293b' }}>
                    {item.title}
                  </h4>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--vyasa-text-secondary, #64748b)', flexWrap: 'wrap' }}>
                    <span>
                      Applicant: <strong>{item.applicant_name}</strong>
                      {item.registration_number ? ` (${item.registration_number})` : ''}
                    </span>
                    <span>
                      Subject: <strong>{item.subject_name}</strong>
                    </span>
                    <span>
                      Category: <strong>{item.category_name}</strong>
                    </span>
                    {item.resolved_by_name && (
                      <span>
                        Resolved by: <strong>{item.resolved_by_name}</strong>
                        {item.resolved_by_role ? ` (${item.resolved_by_role})` : ''}
                      </span>
                    )}
                  </div>

                  {item.resolution_summary && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#334155',
                      }}
                    >
                      <strong style={{ color: '#0f2b48' }}>Resolution Summary:</strong> {item.resolution_summary}
                    </div>
                  )}

                  {item.feedback_text && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fef3c7',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#92400e',
                        fontStyle: 'italic',
                      }}
                    >
                      <strong>Applicant Comment:</strong> "{item.feedback_text}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary, #64748b)' }}>
                    Resolved {item.resolved_at ? new Date(item.resolved_at).toLocaleDateString() : 'N/A'}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${item.id}`)}
                      style={{ fontSize: '12px' }}
                    >
                      View Dossier
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleOpenClosureModal(item)}
                      style={{ fontSize: '12px' }}
                    >
                      Finalize Closure &amp; E-File &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &larr; Previous
          </Button>
          <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <Button
            variant="outline"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next &rarr;
          </Button>
        </div>
      )}

      {/* Finalize Institutional Closure Modal */}
      {selectedCase && (
        <Modal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          title={`Institutional Final Closure • ${selectedCase.grievance_id}`}
          className="vyasa-modal--md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <Button variant="ghost" onClick={handleCloseModal} disabled={submitting}>
                {closureSuccess ? 'Close' : 'Cancel'}
              </Button>
              {!closureSuccess && (
                <Button
                  variant="primary"
                  onClick={handleFinalizeClosure}
                  disabled={submitting}
                >
                  {submitting ? 'Executing Atomic Closure...' : 'Execute Final Closure & Seal E-File'}
                </Button>
              )}
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            {closureModalError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                }}
              >
                {closureModalError}
              </div>
            )}

            {closureSuccess ? (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                }}
              >
                <h4 style={{ margin: '0 0 8px', fontSize: '16px' }}>Grievance Formally Closed &amp; Sealed</h4>
                <p style={{ margin: '0 0 10px' }}>
                  The grievance has transitioned to <strong>CLOSED</strong>. Official tamper-proof E-File compilation and Student Master Record linkage succeeded.
                </p>
                <div style={{ fontSize: '12px', lineHeight: 1.8 }}>
                  <div><strong>E-File Number:</strong> <code>{closureSuccess.e_file_number}</code></div>
                  <div><strong>Master Record Number:</strong> <code>{closureSuccess.student_record_number}</code></div>
                  <div><strong>Pages Compiled:</strong> {closureSuccess.page_count} pages</div>
                  <div><strong>SHA-256 Digest:</strong> <code style={{ wordBreak: 'break-all' }}>{closureSuccess.content_hash}</code></div>
                </div>
              </div>
            ) : (
              <>
                <p style={{ margin: 0, color: 'var(--vyasa-text-secondary)' }}>
                  By executing final closure, you verify that the grievance resolution conforms to university standards. An immutable ReportLab PDF dossier will be generated, cryptographically sealed with SHA-256, and linked permanently to the student's Master Record.
                </p>

                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#0f2b48', marginBottom: '4px' }}>
                    {selectedCase.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Applicant: {selectedCase.applicant_name} &bull; Category: {selectedCase.category_name}
                  </div>
                  {selectedCase.feedback_rating !== undefined && selectedCase.feedback_rating !== null && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#b45309', fontWeight: 600 }}>
                      Applicant Evaluation: Quality ★{selectedCase.feedback_rating}/5 &bull; Timeliness ★{selectedCase.feedback_timeliness}/5 &bull; Fairness ★{selectedCase.feedback_fairness}/5
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="closure-notes"
                    style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#1e293b' }}
                  >
                    Manager Institutional Closure Notes (Optional)
                  </label>
                  <textarea
                    id="closure-notes"
                    rows={3}
                    value={closureNotes}
                    onChange={(e) => setClosureNotes(e.target.value)}
                    placeholder="Enter institutional closing remarks or administrative directives..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
