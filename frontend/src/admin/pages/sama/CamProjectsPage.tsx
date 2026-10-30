import React, { useState, useEffect, useCallback } from 'react';
import { AppIcon, Button } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { samaAdminService } from '../../services/samaAdminService';
import type { CamProjectRecord, CreateCamProjectPayload } from '../../types/sama';

export const CamProjectsPage: React.FC = () => {
  // State
  const [projects, setProjects] = useState<CamProjectRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingProject, setEditingProject] = useState<CamProjectRecord | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<CamProjectRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    project_title: '',
    category: 'minor' as 'minor' | 'major' | 'special',
    domain: '',
    principal_investigator: '',
    co_investigators_raw: '',
    funding_amount: '',
    funding_amount_display: '',
    status: 'awarded' as 'awarded' | 'in_progress' | 'completed' | 'terminated',
    sanction_year: new Date().getFullYear().toString(),
    deliverables_summary: '',
  });

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await samaAdminService.getCamProjects({
        skip: (page - 1) * limit,
        limit,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
      });

      setProjects(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to load CAM-AI projects');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProjects();
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingProject(null);
    setFormData({
      project_title: '',
      category: 'minor',
      domain: '',
      principal_investigator: '',
      co_investigators_raw: '',
      funding_amount: '',
      funding_amount_display: '',
      status: 'awarded',
      sanction_year: new Date().getFullYear().toString(),
      deliverables_summary: '',
    });
    setShowAddEditModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (project: CamProjectRecord) => {
    setEditingProject(project);
    const coInvRaw = Array.isArray(project.co_investigators)
      ? project.co_investigators
          .map((c) => (typeof c === 'string' ? c : c.name))
          .join(', ')
      : '';

    setFormData({
      project_title: project.title || project.project_title || '',
      category: (project.category as 'minor' | 'major' | 'special') || 'minor',
      domain: project.domain || '',
      principal_investigator:
        project.principal_investigator ||
        project.principal_investigators?.map((p) => p.name).join(', ') ||
        '',
      co_investigators_raw: coInvRaw,
      funding_amount:
        project.funding_amount != null
          ? project.funding_amount.toString()
          : project.funding_amount_inr != null
          ? project.funding_amount_inr.toString()
          : '',
      funding_amount_display: project.funding_display || project.funding_amount_display || '',
      status: (project.status as 'awarded' | 'in_progress' | 'completed' | 'terminated') || 'awarded',
      sanction_year: project.sanction_year != null ? project.sanction_year.toString() : '',
      deliverables_summary: project.deliverables_summary || '',
    });
    setShowAddEditModal(true);
  };

  // Save Project
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_title.trim()) {
      setError('Project title is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const coInvestigators = formData.co_investigators_raw
        ? formData.co_investigators_raw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const payload: CreateCamProjectPayload = {
        title: formData.project_title.trim(),
        project_title: formData.project_title.trim(),
        category: formData.category,
        domain: formData.domain.trim() || undefined,
        principal_investigator: formData.principal_investigator.trim() || undefined,
        principal_investigators: formData.principal_investigator.trim()
          ? [{ name: formData.principal_investigator.trim() }]
          : [],
        co_investigators: coInvestigators.map((name) => ({ name })),
        funding_amount_inr: formData.funding_amount ? parseFloat(formData.funding_amount) : undefined,
        funding_amount: formData.funding_amount ? parseFloat(formData.funding_amount) : undefined,
        funding_display: formData.funding_amount_display.trim() || undefined,
        funding_amount_display: formData.funding_amount_display.trim() || undefined,
        status: formData.status,
        sanction_year: formData.sanction_year ? parseInt(formData.sanction_year, 10) : undefined,
        deliverables_summary: formData.deliverables_summary.trim() || undefined,
      };

      if (editingProject) {
        await samaAdminService.updateCamProject(editingProject.id, payload);
        setSuccessMessage('CAM-AI Project updated successfully.');
      } else {
        await samaAdminService.createCamProject(payload);
        setSuccessMessage('CAM-AI Project registered successfully.');
      }

      setShowAddEditModal(false);
      fetchProjects();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Project
  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    try {
      setSubmitting(true);
      setError(null);
      await samaAdminService.deleteCamProject(projectToDelete.id);
      setSuccessMessage('CAM-AI Project removed successfully.');
      setShowDeleteModal(false);
      setProjectToDelete(null);
      fetchProjects();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to delete project');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'awarded':
        return <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Awarded</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">In Progress</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Completed</span>;
      case 'terminated':
        return <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Terminated</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">{status}</span>;
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'major':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Major Grant</span>;
      case 'minor':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">Minor Grant</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">Special</span>;
    }
  };

  return (
    <AdminLayout activeTab="sama-cam-projects">
      <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AppIcon name="grid" className="text-blue-600" />
            CAM-AI Projects Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage research schemes, AI & machine learning grants, investigators, and project deliverables.
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <AppIcon name="upload" className="w-4 h-4" />
            New CAM-AI Project
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && projects.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300 flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-500 hover:text-green-700">
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-96">
          <div className="relative flex-1">
            <AppIcon
              name="search"
              className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by title, investigator, or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="major">Major Grants</option>
              <option value="minor">Minor Grants</option>
              <option value="special">Special Schemes</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="awarded">Awarded</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-600 rounded-full mb-2"></div>
            <p className="text-sm">Loading projects ledger...</p>
          </div>
        ) : error ? (
          <div
            data-testid="cam-projects-error-state"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              padding: '40px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ color: '#991b1b', fontWeight: 600, fontSize: '16px' }}>
              Failed to load CAM-AI projects
            </div>
            <div style={{ color: '#64748b', fontSize: '14px', maxWidth: '520px', lineHeight: 1.5 }}>
              {error}
            </div>
            <div style={{ marginTop: '8px' }}>
              <Button variant="primary" size="sm" onClick={fetchProjects}>
                Retry
              </Button>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <AppIcon name="grid" className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-base font-medium text-gray-700 dark:text-gray-300">No CAM-AI projects found</p>
            <p className="text-xs text-gray-400 mt-1">Register a new research project or clear search filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3">Project Title & Domain</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Investigators</th>
                  <th className="px-6 py-3">Funding</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {projects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                    <td className="px-6 py-4 max-w-sm">
                      <div className="font-semibold text-gray-900 dark:text-white line-clamp-2">
                        {proj.project_title}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        {proj.domain && <span>Domain: {proj.domain}</span>}
                        {proj.sanction_year && <span>• Year: {proj.sanction_year}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getCategoryBadge(proj.category)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        PI: {proj.principal_investigator || 'Not assigned'}
                      </div>
                      {proj.co_investigators && proj.co_investigators.length > 0 && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          Co-PIs: {proj.co_investigators.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {proj.funding_amount_display || (proj.funding_amount != null ? `₹${proj.funding_amount.toLocaleString('en-IN')}` : 'N/A')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(proj.status)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(proj)}
                        className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setProjectToDelete(proj);
                          setShowDeleteModal(true);
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Showing {projects.length} of {totalCount} projects
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded disabled:opacity-50 transition"
            >
              Previous
            </button>
            <span className="px-2 py-1">Page {page}</span>
            <button
              disabled={page * limit >= totalCount}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded disabled:opacity-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Add / Edit Project */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingProject ? 'Edit CAM-AI Project' : 'Register New CAM-AI Project'}
              </h2>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <AppIcon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.project_title}
                  onChange={(e) => setFormData({ ...formData, project_title: e.target.value })}
                  placeholder="e.g. AI-driven Diagnostics for Rural Healthcare"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as 'minor' | 'major' | 'special' })}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="minor">Minor Grant</option>
                    <option value="major">Major Grant</option>
                    <option value="special">Special Scheme</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'awarded' | 'in_progress' | 'completed' | 'terminated' })}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="awarded">Awarded</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Sanction Year
                  </label>
                  <input
                    type="number"
                    value={formData.sanction_year}
                    onChange={(e) => setFormData({ ...formData, sanction_year: e.target.value })}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Research Domain
                  </label>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    placeholder="e.g. Computer Vision / Agriculture"
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Principal Investigator (PI)
                  </label>
                  <input
                    type="text"
                    value={formData.principal_investigator}
                    onChange={(e) => setFormData({ ...formData, principal_investigator: e.target.value })}
                    placeholder="e.g. Dr. A. Sharma"
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Co-Investigators (Comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.co_investigators_raw}
                  onChange={(e) => setFormData({ ...formData, co_investigators_raw: e.target.value })}
                  placeholder="e.g. Dr. B. Patel, Dr. C. Verma"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Funding Amount (Numeric INR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.funding_amount}
                    onChange={(e) => setFormData({ ...formData, funding_amount: e.target.value })}
                    placeholder="250000"
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Display String (e.g. ₹2.5 Lakhs)
                  </label>
                  <input
                    type="text"
                    value={formData.funding_amount_display}
                    onChange={(e) => setFormData({ ...formData, funding_amount_display: e.target.value })}
                    placeholder="₹2,50,000 / ₹2.5 L"
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Deliverables & Milestones Summary
                </label>
                <textarea
                  rows={3}
                  value={formData.deliverables_summary}
                  onChange={(e) => setFormData({ ...formData, deliverables_summary: e.target.value })}
                  placeholder="Summary of project scope, prototype deliverables, and timeline..."
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingProject ? 'Update Project' : 'Register Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Delete CAM-AI Project</h2>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to delete project:
              </p>
              <p className="font-semibold text-gray-900 dark:text-white text-sm bg-gray-50 dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                {projectToDelete.project_title}
              </p>
              <p className="text-xs text-red-500">
                This action cannot be undone. Associated investigator records will remain intact.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setProjectToDelete(null);
                }}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
};

export default CamProjectsPage;
