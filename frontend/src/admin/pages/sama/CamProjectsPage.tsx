import React, { useState, useEffect, useCallback } from 'react';
import { AppIcon, Button, Badge, Modal, Input, Select, EmptyState, LoadingState } from '@vyasa/ui';
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
  }, [page, categoryFilter, statusFilter, search]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Search handler
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
          .map((item) => (typeof item === 'string' ? item : item.name || ''))
          .filter(Boolean)
          .join(', ')
      : '';

    setFormData({
      project_title: project.project_title || project.title || '',
      category: (project.category as 'minor' | 'major' | 'special') || 'minor',
      domain: project.domain || '',
      principal_investigator:
        project.principal_investigator ||
        (project.principal_investigators && project.principal_investigators[0]?.name) ||
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
  const handleSaveProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      setSuccessMessage('CAM-AI Project deleted successfully.');
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
        return <Badge variant="primary">Awarded</Badge>;
      case 'in_progress':
        return <Badge variant="saffron">In Progress</Badge>;
      case 'completed':
        return <Badge variant="teal">Completed</Badge>;
      case 'terminated':
        return <Badge variant="neutral">Terminated</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'major':
        return <Badge variant="saffron">Major Grant</Badge>;
      case 'minor':
        return <Badge variant="teal">Minor Grant</Badge>;
      default:
        return <Badge variant="neutral">Special</Badge>;
    }
  };

  return (
    <AdminLayout activeTab="sama-cam-projects">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Top Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b2811a' }}>
              SAMIKSHA • Research Grants & Innovation
            </div>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="grid" size={22} color="var(--vyasa-primary, #0f2b48)" />
              CAM-AI Projects Management
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#64748b' }}>
              Manage research schemes, AI & machine learning grants, investigators, and project deliverables.
            </p>
          </div>
          <div>
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              <AppIcon name="upload" size={14} style={{ marginRight: '6px' }} />
              New CAM-AI Project
            </Button>
          </div>
        </div>

        {/* Notifications */}
        {error && projects.length > 0 && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', display: 'flex', alignItems: 'center' }}>
              <AppIcon name="close" size={14} />
            </button>
          </div>
        )}
        {successMessage && (
          <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', display: 'flex', alignItems: 'center' }}>
              <AppIcon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Search & Filters Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#ffffff',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1 1 300px' }}>
            <Input
              placeholder="Search by title, investigator, or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button variant="outline" size="sm" type="submit">
              Search
            </Button>
          </form>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Category:</span>
              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Categories' },
                  { value: 'major', label: 'Major Grants' },
                  { value: 'minor', label: 'Minor Grants' },
                  { value: 'special', label: 'Special Schemes' },
                ]}
                style={{ minWidth: '140px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Status:</span>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'awarded', label: 'Awarded' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'terminated', label: 'Terminated' },
                ]}
                style={{ minWidth: '130px' }}
              />
            </div>

            {(search || categoryFilter !== 'all' || statusFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Projects Table */}
        {loading ? (
          <LoadingState message="Loading projects ledger..." />
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
          <EmptyState
            title="No CAM-AI Projects Found"
            description="No projects match your current search or filters. Register a new research project or clear search filters."
            action={
              <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                + Register First CAM-AI Project
              </Button>
            }
          />
        ) : (
          <div className="vyasa-table-card" style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid var(--vyasa-border, #e3dcd1)', overflowX: 'auto', boxShadow: '0 2px 6px rgba(15, 43, 72, 0.04)' }}>
            <table className="vyasa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)', borderBottom: '2px solid var(--vyasa-border, #e3dcd1)', color: 'var(--vyasa-primary, #0f2b48)', fontWeight: 600 }}>
                  <th style={{ padding: '12px 16px' }}>Project Title & Domain</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Investigators</th>
                  <th style={{ padding: '12px 16px' }}>Funding</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((proj) => (
                  <tr key={proj.id} style={{ borderBottom: '1px solid var(--vyasa-border-subtle, #ede7de)' }}>
                    <td style={{ padding: '12px 16px', maxWidth: '340px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)', lineHeight: 1.4 }}>
                        {proj.project_title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                        {proj.domain && <span>Domain: <strong>{proj.domain}</strong></span>}
                        {proj.sanction_year && <span>• Year: {proj.sanction_year}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {getCategoryBadge(proj.category)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                        PI: {proj.principal_investigator || 'Not assigned'}
                      </div>
                      {proj.co_investigators && proj.co_investigators.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Co-PIs: {proj.co_investigators.join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: '#0f2b48' }}>
                        {proj.funding_amount_display || (proj.funding_amount != null ? `₹${proj.funding_amount.toLocaleString('en-IN')}` : 'N/A')}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {getStatusBadge(proj.status)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(proj)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                          onClick={() => {
                            setProjectToDelete(proj);
                            setShowDeleteModal(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--vyasa-border-subtle, #ede7de)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
              <span>
                Showing {projects.length} of {totalCount} projects
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * limit >= totalCount}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add / Edit Project */}
        <Modal
          isOpen={showAddEditModal}
          onClose={() => setShowAddEditModal(false)}
          title={editingProject ? 'Edit CAM-AI Project' : 'Register New CAM-AI Project'}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowAddEditModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={submitting}
                onClick={() => handleSaveProject()}
              >
                {submitting ? 'Saving...' : editingProject ? 'Update Project' : 'Register Project'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="Project Title"
              required
              value={formData.project_title}
              onChange={(e) => setFormData({ ...formData, project_title: e.target.value })}
              placeholder="e.g. AI-driven Diagnostics for Rural Healthcare"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <Select
                label="Category"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as 'minor' | 'major' | 'special' })}
                options={[
                  { value: 'minor', label: 'Minor Grant' },
                  { value: 'major', label: 'Major Grant' },
                  { value: 'special', label: 'Special Scheme' },
                ]}
              />

              <Select
                label="Status"
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'awarded' | 'in_progress' | 'completed' | 'terminated' })}
                options={[
                  { value: 'awarded', label: 'Awarded' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'terminated', label: 'Terminated' },
                ]}
              />

              <Input
                label="Sanction Year"
                type="number"
                value={formData.sanction_year}
                onChange={(e) => setFormData({ ...formData, sanction_year: e.target.value })}
                placeholder="2026"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <Input
                label="Research Domain"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="e.g. Computer Vision / Agriculture"
              />

              <Input
                label="Principal Investigator (PI)"
                value={formData.principal_investigator}
                onChange={(e) => setFormData({ ...formData, principal_investigator: e.target.value })}
                placeholder="e.g. Dr. A. Sharma"
              />
            </div>

            <Input
              label="Co-Investigators (Comma-separated)"
              value={formData.co_investigators_raw}
              onChange={(e) => setFormData({ ...formData, co_investigators_raw: e.target.value })}
              placeholder="e.g. Dr. B. Patel, Dr. C. Verma"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <Input
                label="Funding Amount (INR)"
                type="number"
                value={formData.funding_amount}
                onChange={(e) => setFormData({ ...formData, funding_amount: e.target.value })}
                placeholder="e.g. 500000"
              />

              <Input
                label="Display Funding (Label)"
                value={formData.funding_amount_display}
                onChange={(e) => setFormData({ ...formData, funding_amount_display: e.target.value })}
                placeholder="e.g. ₹5.0 Lakhs or ₹500,000"
              />
            </div>

            <div className="vyasa-form-group">
              <label className="vyasa-label">
                <span>Deliverables & Milestone Summary</span>
              </label>
              <textarea
                value={formData.deliverables_summary}
                onChange={(e) => setFormData({ ...formData, deliverables_summary: e.target.value })}
                rows={3}
                placeholder="Key deliverables, expected publications, datasets, or patent targets..."
                className="vyasa-input"
                style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </form>
        </Modal>

        {/* Modal: Delete Confirmation */}
        <Modal
          isOpen={showDeleteModal && !!projectToDelete}
          onClose={() => {
            setShowDeleteModal(false);
            setProjectToDelete(null);
          }}
          title="Delete CAM-AI Project"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setProjectToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={submitting}
                style={{ backgroundColor: '#b91c1c', borderColor: '#b91c1c' }}
                onClick={handleDeleteConfirm}
              >
                {submitting ? 'Deleting...' : 'Delete Project'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
              Are you sure you want to delete this project?
            </p>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontWeight: 600,
                color: '#0f2b48',
              }}
            >
              {projectToDelete?.project_title}
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#dc2626' }}>
              This action cannot be undone. Associated investigator records will remain intact.
            </p>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};
