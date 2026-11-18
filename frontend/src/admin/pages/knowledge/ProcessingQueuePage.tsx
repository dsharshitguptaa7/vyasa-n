import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingState, Button, Card, Badge, AppIcon, EmptyState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { knowledgeAdminService } from '../../services/knowledgeAdminService';
import { KnowledgeDocumentItem, KNOWLEDGE_DOMAINS } from '../../types/knowledge';

export const ProcessingQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProcessing = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await knowledgeAdminService.getDocuments({
        status: 'processing',
        limit: 50,
      });
      setDocuments(res.items);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retrieve processing queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProcessing();
    const interval = setInterval(fetchProcessing, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchProcessing]);

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
              <span>Processing Queue</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              Extraction & Embedding Queue
              <Badge variant="gold" size="sm">{documents.length} Active Jobs</Badge>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Documents currently undergoing text extraction, semantic chunking, and 768-dimensional vector embedding.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchProcessing}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <AppIcon name="settings" size={16} />
            Refresh
          </Button>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AppIcon name="alert-circle" size={20} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold underline">Dismiss</button>
          </div>
        )}

        {loading && documents.length === 0 ? (
          <div className="py-20 flex justify-center">
            <LoadingState message="Checking active extraction jobs..." />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents currently processing"
            description="All extraction jobs have completed. Background workers are idle."
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/admin/knowledge-centre/documents')}>
                View Knowledge Library
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-5 border border-blue-200 dark:border-blue-900/60 bg-blue-50/10 dark:bg-blue-950/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="gold" size="sm" className="flex items-center gap-1.5">
                        <AppIcon name="settings" size={12} className="animate-spin" />
                        Processing
                      </Badge>
                      <Badge variant="neutral" size="sm">{getDomainLabel(doc.domain)}</Badge>
                      <Badge variant="neutral" size="sm" className="font-mono capitalize">{doc.document_type}</Badge>
                    </div>

                    <h2
                      onClick={() => navigate(`/admin/knowledge-centre/documents/${doc.id}`)}
                      className="text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-primary cursor-pointer"
                    >
                      {doc.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <span>Authority: {doc.issuing_authority || 'University Authority'}</span>
                      <span>•</span>
                      <span>Version: v{doc.current_version ? doc.current_version.version_number : 1}</span>
                      <span>•</span>
                      <span>Started: {new Date(doc.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/knowledge-centre/documents/${doc.id}`)}
                      className="text-xs"
                    >
                      Inspect Status
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
