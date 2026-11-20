import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingState, Button, Card, Badge, AppIcon } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { knowledgeAdminService } from '../../services/knowledgeAdminService';
import { KnowledgeDashboardStats, KnowledgeDocumentItem, KNOWLEDGE_DOMAINS } from '../../types/knowledge';
import './KnowledgeCenter.css';

export const KnowledgeDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<KnowledgeDashboardStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<KnowledgeDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [statsData, docsData] = await Promise.all([
        knowledgeAdminService.getDashboardStats(),
        knowledgeAdminService.getDocuments({ limit: 5 }),
      ]);
      setStats(statsData);
      setRecentDocs(docsData.items);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load Knowledge Centre dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  return (
    <AdminLayout activeTab="knowledge-dashboard">
      <div className="vyasa-kc-page space-y-8 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <AppIcon name="book-open" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  VYASAⁿ AI Knowledge Centre
                  <Badge variant="teal" size="sm">Authoritative Repository</Badge>
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Institutional repository for university regulations, ordinances, and doctoral guidelines powering VYASA AI retrieval.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
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
              Upload Document
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-center gap-3">
            <AppIcon name="alert-circle" size={20} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingState message="Loading AI Knowledge inventory..." />
          </div>
        ) : (
          <>
            {/* Primary KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Documents */}
              <Card className="p-5 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Documents</span>
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                    <AppIcon name="file-text" size={20} />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
                    {stats?.total_documents ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">Across 5 university domains</div>
                </div>
              </Card>

              {/* Published Documents */}
              <Card className="p-5 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Live in AI Retrieval</span>
                  <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600">
                    <AppIcon name="check-circle" size={20} />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold text-teal-700 dark:text-teal-300">
                    {stats?.published_documents ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">Approved & indexed passages</div>
                </div>
              </Card>

              {/* Pending Approvals */}
              <Card
                className="p-5 border border-amber-200 dark:border-amber-900/60 shadow-sm hover:shadow transition-shadow cursor-pointer bg-amber-50/20 dark:bg-amber-950/10"
                onClick={() => navigate('/admin/knowledge-centre/approvals')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Approvals</span>
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600">
                    <AppIcon name="clock" size={20} />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold text-amber-700 dark:text-amber-300">
                    {stats?.pending_approvals ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                    <span>Awaiting SADMIN review</span>
                    <AppIcon name="arrow-right" size={14} />
                  </div>
                </div>
              </Card>

              {/* Vector Passages */}
              <Card className="p-5 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Indexed Passages</span>
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                    <AppIcon name="layers" size={20} />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold text-purple-700 dark:text-purple-300">
                    {stats?.indexed_passages ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {stats?.total_passages ?? 0} total chunks extracted
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Action Queue Banners */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => navigate('/admin/knowledge-centre/approvals')}
                className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-200/60 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                    <AppIcon name="clipboard" size={20} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Approval Queue</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {stats?.pending_approvals ?? 0} documents ready for verification
                    </div>
                  </div>
                </div>
                <AppIcon name="chevron-right" size={20} className="text-gray-400" />
              </div>

              <div
                onClick={() => navigate('/admin/knowledge-centre/processing')}
                className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-200/60 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                    <AppIcon name="layers" size={20} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Processing Queue</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {stats?.processing_documents ?? 0} documents being chunked & embedded
                    </div>
                  </div>
                </div>
                <AppIcon name="chevron-right" size={20} className="text-gray-400" />
              </div>

              <div
                onClick={() => navigate('/admin/knowledge-centre/failed')}
                className="p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 hover:bg-red-100/60 dark:hover:bg-red-900/30 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-200/60 dark:bg-red-900/50 text-red-800 dark:text-red-300">
                    <AppIcon name="alert-circle" size={20} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Failed Extractions</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {stats?.failed_documents ?? 0} versions with parser errors
                    </div>
                  </div>
                </div>
                <AppIcon name="chevron-right" size={20} className="text-gray-400" />
              </div>
            </div>

            {/* Domain Inventory Breakdown */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <AppIcon name="grid" size={20} className="text-primary" />
                Knowledge Domains Distribution
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {KNOWLEDGE_DOMAINS.map((domain) => {
                  const count = stats?.domain_distribution?.[domain.value] || 0;
                  return (
                    <Card
                      key={domain.value}
                      className="p-5 border border-gray-200 dark:border-gray-800 hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/knowledge-centre/documents?domain=${domain.value}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                            {domain.label}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {domain.description}
                          </div>
                        </div>
                        <Badge variant="teal" size="sm">
                          {count} docs
                        </Badge>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-xs text-primary font-medium">
                        <span>Explore Domain</span>
                        <AppIcon name="arrow-right" size={14} />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Recent Uploads Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <AppIcon name="clock" size={20} className="text-primary" />
                  Recent Documents
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin/knowledge-centre/documents')}
                  className="text-xs text-primary flex items-center gap-1"
                >
                  View All Documents
                  <AppIcon name="arrow-right" size={14} />
                </Button>
              </div>

              {recentDocs.length === 0 ? (
                <Card className="p-8 text-center border border-gray-200 dark:border-gray-800">
                  <div className="text-gray-500 text-sm">No documents in the repository yet.</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate('/admin/knowledge-centre/upload')}
                  >
                    Upload First Document
                  </Button>
                </Card>
              ) : (
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-900">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4">Domain</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Passages</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                      {recentDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{doc.title}</div>
                            {doc.academic_session && (
                              <div className="text-xs text-gray-500">Session: {doc.academic_session}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-400">
                            {getDomainLabel(doc.domain)}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono capitalize">
                            {doc.document_type}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant={getStatusBadgeVariant(doc.status)} size="sm">
                              {doc.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-400">
                            {doc.chunk_count} passages
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/knowledge-centre/documents/${doc.id}`)}
                              className="text-xs text-primary"
                            >
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};
