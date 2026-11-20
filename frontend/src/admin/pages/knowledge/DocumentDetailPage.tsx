import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LoadingState, Button, Card, Badge, AppIcon, Modal } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { knowledgeAdminService } from '../../services/knowledgeAdminService';
import {
  KnowledgeDocumentItem,
  KnowledgeDocumentVersionItem,
  KnowledgeChunkItem,
  KNOWLEDGE_DOMAINS,
} from '../../types/knowledge';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DocumentDetailPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<KnowledgeDocumentItem | null>(null);
  const [versions, setVersions] = useState<KnowledgeDocumentVersionItem[]>([]);
  const [chunks, setChunks] = useState<KnowledgeChunkItem[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);

  const [activeTab, setActiveTab] = useState<'chunks' | 'versions' | 'metadata'>('chunks');
  const [chunkSearch, setChunkSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [uploadVersionModalOpen, setUploadVersionModalOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!documentId) return;
    if (!UUID_REGEX.test(documentId)) {
      setLoading(false);
      setErrorCode(400);
      setErrorMsg(`Invalid document identifier "${documentId}". Expected a valid UUID.`);
      setDocument(null);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      setErrorCode(null);
      const res = await knowledgeAdminService.getDocumentDetail(documentId);
      setDocument(res.document);
      setVersions(res.versions || []);
      const resolvedChunks = res.chunks || (res as any).chunks_sample || [];
      setChunks(resolvedChunks);
      setTotalChunks(res.total_chunks ?? resolvedChunks.length);
    } catch (err: any) {
      setErrorCode(err.statusCode || err.status || (err.message?.includes('404') ? 404 : 500));
      setErrorMsg(err.message || 'Failed to retrieve document details.');
      setDocument(null);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleApprove = async (versionId?: string) => {
    if (!documentId) return;
    try {
      setActionInProgress(true);
      await knowledgeAdminService.approveDocument(documentId, { version_id: versionId });
      setSuccessMsg('Document successfully approved and live in VYASA AI retrieval.');
      loadDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve document.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    if (!documentId || rejectReason.trim().length < 3) {
      setErrorMsg('Mandatory rejection reason must be at least 3 characters.');
      return;
    }
    try {
      setActionInProgress(true);
      await knowledgeAdminService.rejectDocument(documentId, { reason: rejectReason.trim() });
      setSuccessMsg('Document / version rejected.');
      setRejectModalOpen(false);
      setRejectReason('');
      loadDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject document.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleArchive = async () => {
    if (!documentId) return;
    if (!window.confirm('Are you sure you want to archive this document? It will no longer be retrieved by AI.')) {
      return;
    }
    try {
      setActionInProgress(true);
      await knowledgeAdminService.archiveDocument(documentId);
      setSuccessMsg('Document successfully archived.');
      loadDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to archive document.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRetry = async (versionId?: string) => {
    if (!documentId) return;
    try {
      setActionInProgress(true);
      await knowledgeAdminService.retryExtraction(documentId, { version_id: versionId });
      setSuccessMsg('Background extraction re-dispatched. Passages are being regenerated.');
      loadDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retry extraction.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleUploadVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId || !versionFile) {
      setErrorMsg('Please select a file for the new version.');
      return;
    }
    try {
      setActionInProgress(true);
      await knowledgeAdminService.uploadNewVersion(documentId, { file: versionFile });
      setSuccessMsg('New version uploaded successfully. Extraction queued in background.');
      setUploadVersionModalOpen(false);
      setVersionFile(null);
      loadDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload new version.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDownload = async (verId?: string, filename?: string) => {
    if (!documentId) return;
    try {
      await knowledgeAdminService.downloadDocumentFile(documentId, verId, filename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download document.');
    }
  };

  const filteredChunks = chunks.filter((c) => {
    if (!chunkSearch.trim()) return true;
    const q = chunkSearch.toLowerCase();
    return (
      c.content.toLowerCase().includes(q) ||
      (c.section_heading && c.section_heading.toLowerCase().includes(q))
    );
  });

  const getDomainLabel = (domVal: string) => {
    const found = KNOWLEDGE_DOMAINS.find((d) => d.value === domVal);
    return found ? found.label : domVal;
  };

  const getStatusBadgeVariant = (status: string): 'teal' | 'saffron' | 'gold' | 'danger' | 'neutral' => {
    switch (status) {
      case 'active':
        return 'teal';
      case 'pending_approval':
        return 'saffron';
      case 'processing':
      case 'draft':
        return 'gold';
      case 'rejected':
      case 'failed':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  if (loading) {
    return (
      <AdminLayout activeTab="knowledge-centre">
        <div className="py-24 flex justify-center">
          <LoadingState message="Loading document details and vector passages..." />
        </div>
      </AdminLayout>
    );
  }

  if (!document) {
    const isInvalidId = Boolean(documentId && !UUID_REGEX.test(documentId));
    const isNotFound = errorCode === 404 || (!isInvalidId && Boolean(errorMsg?.toLowerCase().includes('not found')));
    const isAccessDenied = errorCode === 403 || Boolean(errorMsg?.toLowerCase().includes('access denied')) || Boolean(errorMsg?.toLowerCase().includes('forbidden'));

    return (
      <AdminLayout activeTab="knowledge-centre">
        <div className="p-8 max-w-lg mx-auto text-center space-y-4 my-12">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-red-100 dark:bg-red-950/40 text-red-600">
            <AppIcon name="alert-circle" size={24} />
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isInvalidId
              ? 'Invalid Document Identifier'
              : isNotFound
              ? 'Document Not Found'
              : isAccessDenied
              ? 'Access Denied'
              : 'Unable to Load Document'}
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isInvalidId
              ? `The document identifier "${documentId}" is invalid or malformed. Expected a canonical UUID.`
              : isNotFound
              ? `Document with ID "${documentId}" could not be found in the knowledge repository. It may have been deleted or the link is incorrect.`
              : isAccessDenied
              ? 'You do not have the required Super Admin permissions to view this document.'
              : errorMsg || 'An unexpected error occurred while communicating with the knowledge service.'}
          </p>

          <div className="pt-2 flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/knowledge-centre/documents')}>
              Return to Library
            </Button>
            {!isInvalidId && !isNotFound && !isAccessDenied && (
              <Button variant="primary" size="sm" onClick={loadDetail}>
                Retry Loading
              </Button>
            )}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const currentVer = document.current_version || (versions && versions.length > 0 ? versions[0] : null);

  return (
    <AdminLayout activeTab="knowledge-centre">
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <span onClick={() => navigate('/admin/knowledge-centre')} className="cursor-pointer hover:underline">
            Knowledge Centre
          </span>
          <span>/</span>
          <span onClick={() => navigate('/admin/knowledge-centre/documents')} className="cursor-pointer hover:underline">
            Documents
          </span>
          <span>/</span>
          <span className="text-gray-500 line-clamp-1">{document.title}</span>
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

        {/* Processing State Alert */}
        {(document.status === 'processing' || currentVer?.extraction_status === 'pending') && (
          <Card className="p-4 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 animate-pulse text-amber-600">
                <AppIcon name="settings" size={20} />
              </div>
              <div>
                <div className="font-semibold text-sm">Text Extraction & Embedding In Progress</div>
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  Passage chunking and vector embeddings are currently being generated in the background. Extracted passages will appear automatically once complete.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDetail}
              className="text-xs border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center gap-1.5 flex-shrink-0"
            >
              <AppIcon name="settings" size={14} />
              Refresh Status
            </Button>
          </Card>
        )}

        {/* Failed Processing Alert */}
        {currentVer?.extraction_status === 'failed' && (
          <Card className="p-4 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0 text-red-600">
                <AppIcon name="alert-circle" size={20} />
              </div>
              <div>
                <div className="font-semibold text-sm">Document Text Extraction Failed</div>
                <div className="text-xs text-red-700 dark:text-red-400">
                  {currentVer?.processing_error || 'An error occurred during text extraction or vector embedding.'}
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleRetry(currentVer?.id)}
              disabled={actionInProgress}
              className="text-xs bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 flex-shrink-0"
            >
              <AppIcon name="settings" size={14} />
              Retry Extraction
            </Button>
          </Card>
        )}

        {/* Header Card */}
        <Card className="p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getStatusBadgeVariant(document.status)} size="md">
                  {document.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant="neutral" size="sm">
                  {getDomainLabel(document.domain)}
                </Badge>
                <Badge variant="neutral" size="sm" className="font-mono capitalize">
                  {document.document_type}
                </Badge>
                {document.academic_session && (
                  <Badge variant="neutral" size="sm">
                    Session: {document.academic_session}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {document.title}
              </h1>

              {document.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {document.description}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <span className="font-semibold block text-gray-700 dark:text-gray-300">Issuing Authority:</span>
                  <span>{document.issuing_authority || 'Not Specified'}</span>
                </div>
                <div>
                  <span className="font-semibold block text-gray-700 dark:text-gray-300">Active Version:</span>
                  <span className="font-mono">
                    v{currentVer ? currentVer.version_number : 1} ({versions.length} total versions)
                  </span>
                </div>
                <div>
                  <span className="font-semibold block text-gray-700 dark:text-gray-300">Extracted Passages:</span>
                  <span>{totalChunks} passages ({document.chunk_count} verified)</span>
                </div>
                <div>
                  <span className="font-semibold block text-gray-700 dark:text-gray-300">Created:</span>
                  <span>{new Date(document.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* SADMIN Control Actions */}
            <div className="flex flex-wrap lg:flex-col gap-2.5 min-w-[200px]">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDetail}
                disabled={loading}
                className="flex items-center gap-2 justify-center"
              >
                <AppIcon name="settings" size={16} />
                Refresh Status
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(currentVer?.id, currentVer?.original_filename)}
                className="flex items-center gap-2 justify-center"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download Original
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadVersionModalOpen(true)}
                className="flex items-center gap-2 justify-center"
              >
                <AppIcon name="upload" size={16} />
                Upload New Version
              </Button>

              {document.status === 'pending_approval' && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove()}
                    disabled={actionInProgress}
                    className="flex items-center gap-2 justify-center"
                  >
                    <AppIcon name="check-circle" size={16} />
                    Approve Document
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectModalOpen(true)}
                    disabled={actionInProgress}
                    className="flex items-center gap-2 justify-center text-red-600 border-red-200"
                  >
                    <AppIcon name="close" size={16} />
                    Reject Document
                  </Button>
                </>
              )}

              {currentVer?.extraction_status === 'failed' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleRetry(currentVer?.id)}
                  disabled={actionInProgress}
                  className="flex items-center gap-2 justify-center bg-amber-600 hover:bg-amber-700"
                >
                  <AppIcon name="settings" size={16} />
                  Retry Text Extraction
                </Button>
              )}

              {document.status === 'active' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleArchive}
                  disabled={actionInProgress}
                  className="flex items-center gap-2 justify-center text-xs text-gray-500 hover:text-red-600"
                >
                  <AppIcon name="layers" size={16} />
                  Archive Document
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Tab Controls */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('chunks')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'chunks'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AppIcon name="layers" size={16} />
            Extracted Passages ({totalChunks})
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'versions'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AppIcon name="clock" size={16} />
            Version History ({versions.length})
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'metadata'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AppIcon name="info" size={16} />
            Storage & Audit Metadata
          </button>
        </div>

        {/* TAB 1: PASSAGES / CHUNKS */}
        {activeTab === 'chunks' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                These passages are retrieved by VYASA AI during scholar questions with strict citation back to this document.
              </div>
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Filter passages by keyword..."
                  value={chunkSearch}
                  onChange={(e) => setChunkSearch(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {filteredChunks.length === 0 ? (
              <Card className="p-8 text-center border border-gray-200 dark:border-gray-800 text-gray-500 text-sm space-y-2">
                {chunks.length === 0 ? (
                  document.status === 'processing' || currentVer?.extraction_status === 'pending' ? (
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">Extraction in progress...</div>
                      <div className="text-xs text-gray-500 mt-1">Passages are currently being extracted and embedded in the background.</div>
                      <Button variant="outline" size="sm" onClick={loadDetail} className="mt-3 text-xs">
                        Check for Passages
                      </Button>
                    </div>
                  ) : currentVer?.extraction_status === 'failed' ? (
                    <div>
                      <div className="font-semibold text-red-600">No passages extracted due to failure</div>
                      <div className="text-xs text-gray-500 mt-1">{currentVer.processing_error || 'Text extraction failed.'}</div>
                      <Button variant="primary" size="sm" onClick={() => handleRetry(currentVer?.id)} className="mt-3 text-xs">
                        Retry Extraction
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="font-semibold text-gray-700 dark:text-gray-300">No passages extracted</div>
                      <div className="text-xs text-gray-500 mt-1">This document does not currently contain any extracted text passages.</div>
                    </div>
                  )
                ) : (
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-300">No matching passages</div>
                    <div className="text-xs text-gray-500 mt-1">No passages match your keyword filter &quot;{chunkSearch}&quot;.</div>
                  </div>
                )}
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredChunks.map((chunk) => (
                  <Card key={chunk.id} className="p-4 border border-gray-200 dark:border-gray-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-gray-700 dark:text-gray-300">Chunk #{chunk.chunk_index}</span>
                        {chunk.page_number && <span>• Page {chunk.page_number}</span>}
                        {chunk.section_heading && <span className="text-primary">• {chunk.section_heading}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {chunk.token_count && <span>{chunk.token_count} tokens</span>}
                        <Badge variant={chunk.has_embedding ? 'teal' : 'neutral'} size="sm">
                          {chunk.has_embedding ? 'Vectorized' : 'No Embedding'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-200 font-sans leading-relaxed whitespace-pre-wrap">
                      {chunk.content}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VERSIONS */}
        {activeTab === 'versions' && (
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-800 text-xs">
                <tr>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">SHA-256 Checksum</th>
                  <th className="py-3 px-4">Extraction</th>
                  <th className="py-3 px-4">Approval</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
                {versions.map((ver) => {
                  const isCurrent = document.current_version_id === ver.id;
                  return (
                    <tr key={ver.id} className={isCurrent ? 'bg-primary/5' : ''}>
                      <td className="py-3.5 px-4 font-mono font-bold">
                        v{ver.version_number}
                        {isCurrent && <Badge variant="teal" size="sm" className="ml-2">Active</Badge>}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-gray-100">
                        {ver.original_filename}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {(ver.size_bytes / (1024 * 1024)).toFixed(2)} MB
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-500" title={ver.checksum_sha256}>
                        {ver.checksum_sha256.slice(0, 12)}...
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={ver.extraction_status === 'completed' ? 'teal' : ver.extraction_status === 'failed' ? 'danger' : 'gold'} size="sm">
                          {ver.extraction_status}
                        </Badge>
                        {ver.processing_error && (
                          <div className="text-red-500 mt-0.5 line-clamp-1 text-[11px]" title={ver.processing_error}>
                            {ver.processing_error}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={ver.approval_status === 'approved' ? 'teal' : ver.approval_status === 'rejected' ? 'danger' : 'saffron'} size="sm">
                          {ver.approval_status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(ver.id, ver.original_filename)}
                            className="p-1"
                          >
                            <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                          </Button>
                          {ver.approval_status === 'pending' && ver.extraction_status === 'completed' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApprove(ver.id)}
                              className="text-[11px] px-2 py-0.5"
                            >
                              Approve
                            </Button>
                          )}
                          {ver.extraction_status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(ver.id)}
                              className="text-[11px] px-2 py-0.5 text-amber-600 border-amber-300"
                            >
                              Retry
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: METADATA */}
        {activeTab === 'metadata' && (
          <Card className="p-6 border border-gray-200 dark:border-gray-800 space-y-4 text-sm">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-800 pb-2">
              Spaces Storage Key & Integrity Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <span className="text-gray-500 block font-sans">Storage Key:</span>
                <span className="text-primary font-semibold">{currentVer?.storage_key || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 block font-sans">Full SHA-256 Checksum:</span>
                <span className="text-gray-800 dark:text-gray-200 break-all">{currentVer?.checksum_sha256 || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 block font-sans">MIME Type:</span>
                <span>{currentVer?.mime_type || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 block font-sans">Document ID (UUID):</span>
                <span>{document.id}</span>
              </div>
              <div>
                <span className="text-gray-500 block font-sans">Effective Date Range:</span>
                <span>
                  {document.effective_from ? new Date(document.effective_from).toLocaleDateString() : 'Immediate'}
                  {' → '}
                  {document.effective_until ? new Date(document.effective_until).toLocaleDateString() : 'Indefinite'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block font-sans">Published Timestamp:</span>
                <span>{document.published_at ? new Date(document.published_at).toLocaleString() : 'Unpublished'}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Rejection Modal */}
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => {
            setRejectModalOpen(false);
            setRejectReason('');
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
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleReject}
                disabled={actionInProgress || rejectReason.trim().length < 3}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>

        {/* Upload Version Modal */}
        <Modal
          isOpen={uploadVersionModalOpen}
          onClose={() => {
            setUploadVersionModalOpen(false);
            setVersionFile(null);
          }}
          title={`Upload Version ${versions.length + 1} for Document`}
        >
          <form onSubmit={handleUploadVersionSubmit} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The existing active version remains live in VYASA AI retrieval until this new version is extracted, embedded, and explicitly approved by SADMIN.
            </p>
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.txt"
              required
              onChange={(e) => setVersionFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            <div className="flex justify-end gap-3 pt-3">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setUploadVersionModalOpen(false);
                  setVersionFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={actionInProgress || !versionFile}
              >
                Upload & Extract Version
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
};
