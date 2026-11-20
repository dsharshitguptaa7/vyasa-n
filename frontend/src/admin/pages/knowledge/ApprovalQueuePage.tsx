import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingState, Button, Card, Badge, AppIcon, Modal, EmptyState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { knowledgeAdminService } from '../../services/knowledgeAdminService';
import { KnowledgeDocumentItem, KNOWLEDGE_DOMAINS } from '../../types/knowledge';
import './KnowledgeCenter.css';

export const ApprovalQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Rejection Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await knowledgeAdminService.getDocuments({
        status: 'pending_approval',
        limit: 50,
      });
      setDocuments(res.items);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retrieve approval queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (docId: string) => {
    try {
      setActionInProgress(true);
      await knowledgeAdminService.approveDocument(docId);
      setSuccessMsg('Document successfully approved! It is now active and retrievable by VYASA AI.');
      fetchPending();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve document.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedDocId || rejectReason.trim().length < 3) {
      setErrorMsg('A valid rejection reason (minimum 3 characters) is strictly mandatory.');
      return;
    }
    try {
      setActionInProgress(true);
      await knowledgeAdminService.rejectDocument(selectedDocId, { reason: rejectReason.trim() });
      setSuccessMsg('Document successfully rejected.');
      setRejectModalOpen(false);
      setRejectReason('');
      setSelectedDocId(null);
      fetchPending();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject document.');
    } finally {
      setActionInProgress(false);
    }
  };

  const getDomainLabel = (domVal: string) => {
    const found = KNOWLEDGE_DOMAINS.find((d) => d.value === domVal);
    return found ? found.label : domVal;
  };

  return (
    <AdminLayout activeTab="knowledge-approvals">
      <div className="vyasa-kc-page space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              <span onClick={() => navigate('/admin/knowledge-centre')} className="cursor-pointer hover:underline">
                Knowledge Centre
              </span>
              <span>/</span>
              <span>Approval Queue</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              Mandatory Approval Queue
              <Badge variant="saffron" size="sm">{documents.length} Pending</Badge>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Authoritative university documents requiring Super Administrator sign-off before being indexed into VYASA AI.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchPending}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <AppIcon name="settings" size={16} />
            Refresh Queue
          </Button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AppIcon name="alert-circle" size={20} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold underline">Dismiss</button>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AppIcon name="check-circle" size={20} className="flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-xs font-bold underline">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingState message="Loading approval queue..." />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="Approval queue is clear"
            description="All uploaded documents have been reviewed and approved. No items awaiting authorization."
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/admin/knowledge-centre/documents')}>
                View Knowledge Library
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-5 border border-amber-200 dark:border-amber-900/60 bg-amber-50/10 dark:bg-amber-950/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="saffron" size="sm">Pending SADMIN Approval</Badge>
                      <Badge variant="neutral" size="sm">{getDomainLabel(doc.domain)}</Badge>
                      <Badge variant="neutral" size="sm" className="font-mono capitalize">{doc.document_type}</Badge>
                      {doc.academic_session && (
                        <span className="text-xs text-gray-500 font-mono">Session: {doc.academic_session}</span>
                      )}
                    </div>

                    <h2
                      onClick={() => navigate(`/admin/knowledge-centre/documents/${doc.id}`)}
                      className="text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-primary cursor-pointer"
                    >
                      {doc.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <span>Authority: {doc.issuing_authority || 'Academic Council'}</span>
                      <span>•</span>
                      <span className="font-semibold text-primary">{doc.chunk_count} Passages Extracted</span>
                      <span>•</span>
                      <span>Uploaded {new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/knowledge-centre/documents/${doc.id}`)}
                      className="text-xs"
                    >
                      Inspect Chunks
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setRejectModalOpen(true);
                      }}
                      disabled={actionInProgress}
                      className="text-xs text-red-600 border-red-200"
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(doc.id)}
                      disabled={actionInProgress}
                      className="text-xs"
                    >
                      Approve & Publish
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Rejection Modal */}
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => {
            setRejectModalOpen(false);
            setRejectReason('');
            setSelectedDocId(null);
          }}
          title="Mandatory Document Rejection Reason"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please enter the official institutional justification for rejecting this document or version. Minimum 3 characters required.
            </p>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Inconsistent ordinance provisions, missing signatures, superseded regulation..."
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectReason('');
                  setSelectedDocId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRejectSubmit}
                disabled={actionInProgress || rejectReason.trim().length < 3}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};
