import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingState, Button, Card, Badge, AppIcon, EmptyState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { knowledgeAdminService } from '../../services/knowledgeAdminService';
import { KnowledgeDocumentItem, KNOWLEDGE_DOMAINS } from '../../types/knowledge';

export const FailedProcessingPage: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchFailed = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await knowledgeAdminService.getDocuments({
        limit: 50,
      });
      // Filter documents where current version extraction status is 'failed'
      const failed = res.items.filter(
        (d) => d.current_version && d.current_version.extraction_status === 'failed'
      );
      setDocuments(failed);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retrieve failed extractions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFailed();
  }, [fetchFailed]);

  const handleRetry = async (docId: string, versionId?: string) => {
    try {
      setActionInProgress(true);
      await knowledgeAdminService.retryExtraction(docId, { version_id: versionId });
      setSuccessMsg('Background extraction re-dispatched. Passages are being regenerated.');
      fetchFailed();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retry extraction.');
    } finally {
      setActionInProgress(false);
    }
  };

  const getDomainLabel = (domVal: string) => {
    const found = KNOWLEDGE_DOMAINS.find((d) => d.value === domVal);
    return found ? found.label : domVal;
  };

  return (
    <AdminLayout activeTab="knowledge-centre">
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              <span onClick={() => navigate('/admin/knowledge-centre')} className="cursor-pointer hover:underline">
                Knowledge Centre
              </span>
              <span>/</span>
              <span>Failed Extractions</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              Failed Document Extractions
              <Badge variant="danger" size="sm">{documents.length} Errors</Badge>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Documents where document parsing or vector embeddings failed. SADMIN can review error diagnostics and trigger extraction retries.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchFailed}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <AppIcon name="settings" size={16} />
            Refresh
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
            <LoadingState message="Inspecting failed extraction logs..." />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="Zero failed extractions"
            description="All document parsing and embedding jobs completed successfully without unrecoverable errors."
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/admin/knowledge-centre/documents')}>
                View Knowledge Library
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-5 border border-red-200 dark:border-red-900/60 bg-red-50/10 dark:bg-red-950/5 space-y-3">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="danger" size="sm">Extraction Failed</Badge>
                      <Badge variant="neutral" size="sm">{getDomainLabel(doc.domain)}</Badge>
                      <Badge variant="neutral" size="sm" className="font-mono capitalize">{doc.document_type}</Badge>
                    </div>

                    <h2
                      onClick={() => navigate(`/admin/knowledge-centre/documents/${doc.id}`)}
                      className="text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-primary cursor-pointer"
                    >
                      {doc.title}
                    </h2>

                    <div className="text-xs text-gray-500 font-mono">
                      File: {doc.current_version?.original_filename} • Version: v{doc.current_version?.version_number}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/knowledge-centre/documents/${doc.id}`)}
                      className="text-xs"
                    >
                      View Details
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleRetry(doc.id, doc.current_version?.id)}
                      disabled={actionInProgress}
                      className="text-xs bg-amber-600 hover:bg-amber-700 flex items-center gap-1.5"
                    >
                      <AppIcon name="settings" size={14} />
                      Retry Extraction
                    </Button>
                  </div>
                </div>

                {doc.current_version?.processing_error && (
                  <div className="p-3 rounded-lg bg-red-100/60 dark:bg-red-900/20 text-red-800 dark:text-red-300 font-mono text-xs border border-red-200 dark:border-red-800 break-all">
                    <strong>Error Diagnostic:</strong> {doc.current_version.processing_error}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
