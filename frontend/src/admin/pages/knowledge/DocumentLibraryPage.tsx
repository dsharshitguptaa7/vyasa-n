import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LoadingState, Button, Card, Badge, AppIcon, Modal, EmptyState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { knowledgeAdminService } from '../../services/knowledgeAdminService';
import {
  KnowledgeDocumentItem,
  KNOWLEDGE_DOMAINS,
  DOCUMENT_TYPES,
} from '../../types/knowledge';
import './KnowledgeCenter.css';

export const DocumentLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters state from search params
  const currentDomain = searchParams.get('domain') || '';
  const currentStatus = searchParams.get('status') || '';
  const currentSearch = searchParams.get('search') || '';
  const currentType = searchParams.get('document_type') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 15;

  // Modals state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const skip = (currentPage - 1) * pageSize;
      const res = await knowledgeAdminService.getDocuments({
        skip,
        limit: pageSize,
        domain: currentDomain || undefined,
        status: currentStatus || undefined,
        search: currentSearch || undefined,
        document_type: currentType || undefined,
      });
      setDocuments(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve documents from knowledge repository.');
    } finally {
      setLoading(false);
    }
  }, [currentDomain, currentStatus, currentSearch, currentType, currentPage]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleApprove = async (docId: string) => {
    try {
      setActionInProgress(true);
      await knowledgeAdminService.approveDocument(docId);
      setSuccessMsg('Document successfully approved and published for AI retrieval.');
      fetchDocuments();
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
      setSuccessMsg('Document version successfully rejected.');
      setRejectModalOpen(false);
      setRejectReason('');
      setSelectedDocId(null);
      fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject document.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleArchive = async (docId: string) => {
    if (!window.confirm('Are you sure you want to archive this document? It will be removed from live AI retrieval.')) {
      return;
    }
    try {
      setActionInProgress(true);
      await knowledgeAdminService.archiveDocument(docId);
      setSuccessMsg('Document successfully archived.');
      fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to archive document.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDownload = async (docId: string, filename?: string) => {
    try {
      await knowledgeAdminService.downloadDocumentFile(docId, undefined, filename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download document.');
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getStatusBadgeVariant = (status: string): 'teal' | 'saffron' | 'gold' | 'danger' | 'neutral' => {
    switch (status) {
      case 'active':
        return 'teal';
      case 'pending_approval':
        return 'saffron';
      case 'processing':
        return 'gold';
      case 'draft':
        return 'neutral';
      case 'rejected':
      case 'failed':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const getDomainLabel = (domVal: string) => {
    const found = KNOWLEDGE_DOMAINS.find((d) => d.value === domVal);
    return found ? found.label : domVal;
  };

  return (
    <AdminLayout activeTab="knowledge-library">
      <div className="vyasa-kc-page space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              <span>AI Knowledge Centre</span>
              <span>/</span>
              <span>Document Library</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              Knowledge Repository
              <Badge variant="neutral" size="sm">{totalCount} Documents</Badge>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Browse, inspect passages, approve versions, and manage authoritative university documents.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDocuments}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <AppIcon name="settings" size={16} />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/admin/knowledge-centre/upload')}
              className="flex items-center gap-2"
            >
              <AppIcon name="upload" size={16} />
              Upload New Document
            </Button>
          </div>
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

        {/* Filters Toolbar */}
        <Card className="p-4 border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search title, authority..."
                value={currentSearch}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Domain Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Domain</label>
              <select
                value={currentDomain}
                onChange={(e) => updateFilter('domain', e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Knowledge Domains</option>
                {KNOWLEDGE_DOMAINS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={currentStatus}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Lifecycle Statuses</option>
                <option value="active">Active (Live in AI)</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="processing">Processing</option>
                <option value="draft">Draft</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Document Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select
                value={currentType}
                onChange={(e) => updateFilter('document_type', e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Document Types</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {(currentDomain || currentStatus || currentSearch || currentType) && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
              <span className="text-gray-500">Filters applied</span>
              <button
                onClick={() => setSearchParams(new URLSearchParams())}
                className="text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <AppIcon name="close" size={14} />
                Reset All Filters
              </button>
            </div>
          )}
        </Card>

        {/* Documents Table */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingState message="Loading repository documents..." />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents found"
            description="No documents match the active filter criteria or the repository is empty."
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/admin/knowledge-centre/upload')}>
                Upload Document
              </Button>
            }
          />
        ) : (
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-800 text-xs">
                  <tr>
                    <th className="py-3.5 px-4">Title & Session</th>
                    <th className="py-3.5 px-4">Domain</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Version</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Passages</th>
                    <th className="py-3.5 px-4">Uploaded</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div
                          onClick={() => navigate(`/admin/knowledge-centre/documents/${doc.id}`)}
                          className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary cursor-pointer line-clamp-1"
                        >
                          {doc.title}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          {doc.academic_session && <span>Session: {doc.academic_session}</span>}
                          {doc.issuing_authority && <span>• {doc.issuing_authority}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {getDomainLabel(doc.domain)}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono capitalize text-gray-600 dark:text-gray-400">
                        {doc.document_type}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono">
                        v{doc.current_version ? doc.current_version.version_number : 1}
                        {doc.version_count > 1 && (
                          <span className="text-gray-400 ml-1">({doc.version_count} total)</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={getStatusBadgeVariant(doc.status)} size="sm">
                          {doc.status.replace('_', ' ')}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-400">
                        {doc.chunk_count} chunks
                      </td>

                      <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc.id, doc.current_version?.original_filename)}
                            title="Download original file"
                            className="p-1.5"
                          >
                            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/knowledge-centre/documents/${doc.id}`)}
                            title="View details & chunks"
                            className="text-xs text-primary"
                          >
                            Details
                          </Button>

                          {doc.status === 'pending_approval' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApprove(doc.id)}
                              disabled={actionInProgress}
                              className="text-xs px-2.5 py-1"
                            >
                              Approve
                            </Button>
                          )}

                          {doc.status === 'pending_approval' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDocId(doc.id);
                                setRejectModalOpen(true);
                              }}
                              disabled={actionInProgress}
                              className="text-xs px-2.5 py-1 text-red-600 border-red-200"
                            >
                              Reject
                            </Button>
                          )}

                          {doc.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(doc.id)}
                              disabled={actionInProgress}
                              title="Archive document"
                              className="p-1.5 text-gray-400 hover:text-red-500"
                            >
                              <AppIcon name="layers" size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/30">
                <div>
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, totalCount)} of {totalCount} documents
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateFilter('page', String(currentPage - 1))}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateFilter('page', String(currentPage + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
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
              placeholder="e.g. Scanned copy illegible, missing academic council stamp, outdated ordinance version..."
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
