import React, { useEffect, useState, useMemo } from 'react';
import { LoadingState, Button, Badge, Modal, Input, Select, AppIcon } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import { Subject, SubjectCluster, CreateSubjectPayload, UpdateSubjectPayload } from '../../types/atharva';

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [clusters, setClusters] = useState<SubjectCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Global action notification
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [clusterFilter, setClusterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modal loading state
  const [isSaving, setIsSaving] = useState(false);

  // Re-map modal state
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [targetClusterId, setTargetClusterId] = useState<string>('');
  const [remapModalError, setRemapModalError] = useState<string | null>(null);

  // Add Subject modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<CreateSubjectPayload>({
    name: '',
    code: '',
    subject_cluster_id: '',
    is_active: true,
  });

  // Edit Subject modal state
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateSubjectPayload>({});

  // Delete Subject modal state
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [subjectsData, clustersData] = await Promise.all([
        atharvaAdminService.getSubjects(),
        atharvaAdminService.getSubjectClusters(),
      ]);
      setSubjects(subjectsData);
      setClusters(clustersData);
      if (clustersData.length > 0) {
        setAddForm((prev) => ({
          ...prev,
          subject_cluster_id: prev.subject_cluster_id || clustersData[0].id,
        }));
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load subjects catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Read cluster pre-filter from URL query params if provided
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const clusterParam = urlParams.get('cluster');
      if (clusterParam) {
        setClusterFilter(clusterParam);
      }
    } catch {
      // Ignore if URL query parsing fails
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, clusterFilter, statusFilter]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (clusterFilter && s.subject_cluster_id !== clusterFilter) return false;
      if (statusFilter === 'active' && !s.is_active) return false;
      if (statusFilter === 'inactive' && s.is_active) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesCode = s.code?.toLowerCase().includes(q) ?? false;
        const matchesCluster = s.cluster_name?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesCode && !matchesCluster) return false;
      }
      return true;
    });
  }, [subjects, clusterFilter, statusFilter, searchQuery]);

  const paginatedSubjects = useMemo(() => {
    if (pageSize === 0) return filteredSubjects;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredSubjects.slice(startIndex, startIndex + pageSize);
  }, [filteredSubjects, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(filteredSubjects.length / pageSize));
  }, [filteredSubjects.length, pageSize]);

  const stats = useMemo(() => {
    const total = subjects.length;
    const active = subjects.filter((s) => s.is_active).length;
    const mappedClusters = new Set(subjects.map((s) => s.subject_cluster_id)).size;
    return { total, active, mappedClusters };
  }, [subjects]);

  const handleToggleStatus = async (subject: Subject) => {
    try {
      const updated = await atharvaAdminService.updateSubjectStatus(subject.id, !subject.is_active);
      setSubjects((prev) =>
        prev.map((s) => (s.id === subject.id ? { ...s, is_active: updated.is_active } : s))
      );
      setActionFeedback({
        type: 'success',
        message: `Subject '${subject.name}' active status set to ${updated.is_active ? 'Active' : 'Inactive'}.`,
      });
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update subject status',
      });
    }
  };

  const handleOpenRemapModal = (subject: Subject) => {
    setSelectedSubject(subject);
    setTargetClusterId(subject.subject_cluster_id);
    setRemapModalError(null);
  };

  const handleSaveRemap = async () => {
    if (!selectedSubject || !targetClusterId) return;
    try {
      setIsSaving(true);
      setRemapModalError(null);
      const updated = await atharvaAdminService.updateSubjectMapping(
        selectedSubject.id,
        targetClusterId
      );
      const targetCluster = clusters.find((c) => c.id === targetClusterId);
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === updated.id
            ? {
                ...s,
                subject_cluster_id: updated.subject_cluster_id,
                cluster_name: targetCluster?.name || s.cluster_name,
                cluster_number: targetCluster?.cluster_number || s.cluster_number,
              }
            : s
        )
      );
      setActionFeedback({
        type: 'success',
        message: `Subject '${selectedSubject.name}' re-mapped to cluster successfully.`,
      });
      setSelectedSubject(null);
    } catch (err: unknown) {
      setRemapModalError(err instanceof Error ? err.message : 'Failed to re-map subject cluster');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setAddModalError(null);
    setAddForm({
      name: '',
      code: '',
      subject_cluster_id: clusters.length > 0 ? clusters[0].id : '',
      is_active: true,
    });
  };

  const handleCreateSubject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = addForm.name.trim();
    if (!cleanName) {
      setAddModalError('Subject Name is required.');
      return;
    }
    if (!addForm.subject_cluster_id) {
      setAddModalError('Faculty Subject Cluster is required.');
      return;
    }
    try {
      setIsSaving(true);
      setAddModalError(null);
      const created = await atharvaAdminService.createSubject({
        ...addForm,
        name: cleanName,
        code: addForm.code?.trim() || null,
      });
      setSubjects((prev) => [...prev, created]);
      setActionFeedback({
        type: 'success',
        message: `Subject '${created.name}' created successfully.`,
      });
      setIsAddModalOpen(false);
    } catch (err: unknown) {
      setAddModalError(err instanceof Error ? err.message : 'Failed to create subject');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (subject: Subject) => {
    setEditingSubject(subject);
    setEditModalError(null);
    setEditForm({
      name: subject.name,
      code: subject.code || '',
      subject_cluster_id: subject.subject_cluster_id,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSubject) return;
    if (typeof editForm.name === 'string' && !editForm.name.trim()) {
      setEditModalError('Subject Name cannot be empty.');
      return;
    }
    try {
      setIsSaving(true);
      setEditModalError(null);
      const updated = await atharvaAdminService.updateSubject(editingSubject.id, {
        name: editForm.name?.trim(),
        code: editForm.code?.trim() || null,
        subject_cluster_id: editForm.subject_cluster_id,
      });
      const targetCluster = clusters.find((c) => c.id === updated.subject_cluster_id);
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === updated.id
            ? {
                ...updated,
                cluster_name: targetCluster?.name || updated.cluster_name || s.cluster_name,
                cluster_number: targetCluster?.cluster_number || updated.cluster_number || s.cluster_number,
              }
            : s
        )
      );
      setActionFeedback({
        type: 'success',
        message: `Subject '${updated.name}' updated successfully.`,
      });
      setEditingSubject(null);
    } catch (err: unknown) {
      setEditModalError(err instanceof Error ? err.message : 'Failed to update subject');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteModal = (subject: Subject) => {
    setDeletingSubject(subject);
    setDeleteError(null);
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    try {
      setIsSaving(true);
      setDeleteError(null);
      await atharvaAdminService.deleteSubject(deletingSubject.id);
      setSubjects((prev) => prev.filter((s) => s.id !== deletingSubject.id));
      setActionFeedback({
        type: 'success',
        message: `Subject '${deletingSubject.name}' permanently deleted.`,
      });
      setDeletingSubject(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete subject');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout activeTab="subjects">
      {/* Action feedback notification banner */}
      {actionFeedback && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            marginBottom: '18px',
            borderRadius: '6px',
            backgroundColor: actionFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${actionFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: actionFeedback.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '13.5px',
            boxShadow: 'var(--vyasa-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{actionFeedback.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 700,
              fontSize: '14px',
              padding: '0 4px',
            }}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Official Subject Catalog Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          padding: '20px 24px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid var(--vyasa-border, #e3dcd1)',
          boxShadow: 'var(--vyasa-shadow-sm)',
        }}
      >
        <div style={{ maxWidth: '800px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--vyasa-gold, #b2811a)',
              marginBottom: '3px',
            }}
          >
            Academic Catalog • Doctoral &amp; Post-Graduate Disciplines
          </div>
          <h2
            style={{
              margin: '0 0 6px',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--vyasa-primary, #0f2b48)',
              fontFamily: 'var(--vyasa-font-scholarly, serif)',
            }}
          >
            Academic Disciplines &amp; Subject Mappings
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', lineHeight: 1.55 }}>
            Manage university academic subjects, disciplinary codes, and faculty cluster mappings.
            All registration taxonomies and grievance routing are driven dynamically from the database.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<AppIcon name="book-open" size={14} />}
            onClick={handleOpenAddModal}
          >
            + Add Subject
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<AppIcon name="settings" size={14} />}
            onClick={fetchData}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--vyasa-border, #e3dcd1)',
            boxShadow: 'var(--vyasa-shadow-sm)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--vyasa-primary, #0f2b48)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Total Subjects
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)' }}>
            {stats.total}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Doctoral disciplines cataloged</span>
        </div>

        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--vyasa-border, #e3dcd1)',
            boxShadow: 'var(--vyasa-shadow-sm)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: '#059669' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Active Subjects
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: '#059669' }}>
            {stats.active}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Available for intake</span>
        </div>

        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--vyasa-border, #e3dcd1)',
            boxShadow: 'var(--vyasa-shadow-sm)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--vyasa-gold, #b2811a)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Mapped Clusters
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: 'var(--vyasa-gold, #b2811a)' }}>
            {stats.mappedClusters}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Faculty discipline groups</span>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '20px',
          backgroundColor: '#ffffff',
          padding: '16px 20px',
          borderRadius: '8px',
          border: '1px solid var(--vyasa-border, #e3dcd1)',
          boxShadow: 'var(--vyasa-shadow-sm)',
        }}
      >
        <div style={{ flex: '1 1 240px' }}>
          <Input
            placeholder="Search subject by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ width: '240px' }}>
          <Select
            options={[
              { value: '', label: 'All Faculty Clusters' },
              ...clusters.map((c) => ({
                value: c.id,
                label: `Cluster #${c.cluster_number}: ${c.name}`,
              })),
            ]}
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
          />
        </div>
        <div style={{ width: '150px' }}>
          <Select
            options={[
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        {clusterFilter && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClusterFilter('')}
            style={{ fontSize: '12px' }}
          >
            Clear Cluster Filter
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState message="Loading academic disciplines..." />
      ) : errorMsg ? (
        <div style={{ padding: '24px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#991b1b' }}>
          {errorMsg}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid var(--vyasa-border, #e3dcd1)',
            boxShadow: 'var(--vyasa-shadow-sm)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f8fafc',
                    borderBottom: '1.5px solid var(--vyasa-border, #e3dcd1)',
                    color: 'var(--vyasa-text-secondary, #475569)',
                    fontSize: '11.5px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Subject Name &amp; Code</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Mapped Subject Cluster</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No subjects matched the specified filters.
                    </td>
                  </tr>
                ) : (
                  paginatedSubjects.map((s) => (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: '1px solid var(--vyasa-border-subtle, #f1f5f9)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {s.code && (
                            <code
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--vyasa-primary, #0f2b48)',
                                backgroundColor: 'var(--vyasa-primary-surface, #eff5fa)',
                                border: '1px solid var(--vyasa-primary-border, #cadbef)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {s.code}
                            </code>
                          )}
                          <strong style={{ color: 'var(--vyasa-primary, #0f2b48)', fontSize: '14px' }}>
                            {s.name}
                          </strong>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {s.cluster_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--vyasa-gold, #b2811a)',
                                backgroundColor: 'var(--vyasa-gold-light, #fcf7eb)',
                                border: '1px solid var(--vyasa-gold-border, #ecdfba)',
                                padding: '1px 5px',
                                borderRadius: '3px',
                              }}
                            >
                              #{s.cluster_number}
                            </span>
                            <span style={{ color: '#1e293b', fontWeight: 500 }}>
                              {s.cluster_name}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="neutral">Unassigned</Badge>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: s.is_active ? '#ecfdf5' : '#fef2f2',
                            color: s.is_active ? '#059669' : '#dc2626',
                            border: s.is_active ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          }}
                        >
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: s.is_active ? '#10b981' : '#ef4444',
                              display: 'inline-block',
                            }}
                          />
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openEditModal(s)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleOpenRemapModal(s)}
                          >
                            Re-map
                          </Button>
                          <Button
                            variant={s.is_active ? 'outline' : 'primary'}
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleToggleStatus(s)}
                          >
                            {s.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px', color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => handleOpenDeleteModal(s)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--vyasa-border-subtle, #f1f5f9)',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12.5px',
              color: 'var(--vyasa-text-secondary, #64748b)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>
                Showing{' '}
                <strong style={{ color: 'var(--vyasa-primary, #0f2b48)' }}>
                  {filteredSubjects.length === 0
                    ? 0
                    : pageSize === 0
                    ? 1
                    : (currentPage - 1) * pageSize + 1}
                </strong>
                –
                <strong style={{ color: 'var(--vyasa-primary, #0f2b48)' }}>
                  {pageSize === 0
                    ? filteredSubjects.length
                    : Math.min(currentPage * pageSize, filteredSubjects.length)}
                </strong>{' '}
                of{' '}
                <strong style={{ color: 'var(--vyasa-primary, #0f2b48)' }}>
                  {filteredSubjects.length}
                </strong>{' '}
                disciplines
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--vyasa-border, #cbd5e1)',
                    backgroundColor: '#ffffff',
                    fontSize: '12px',
                    color: 'var(--vyasa-primary, #0f2b48)',
                  }}
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={0}>All</option>
                </select>
              </div>
            </div>

            {pageSize > 0 && totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ padding: '3px 10px', fontSize: '12px' }}
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>

                <span style={{ padding: '0 8px', fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)' }}>
                  {currentPage} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  style={{ padding: '3px 10px', fontSize: '12px' }}
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Subject Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title="Add New Academic Subject"
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleCreateSubject()} disabled={isSaving}>
                {isSaving ? 'Adding...' : 'Add Subject'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {addModalError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '13px',
                }}
              >
                {addModalError}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Subject Name *
              </label>
              <Input
                placeholder="e.g. Molecular Biology & Genetics"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Subject Code
              </label>
              <Input
                placeholder="e.g. BIO-102"
                value={addForm.code || ''}
                onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Faculty Subject Cluster *
              </label>
              <Select
                options={clusters.map((c) => ({
                  value: c.id,
                  label: `Cluster #${c.cluster_number}: ${c.name}`,
                }))}
                value={addForm.subject_cluster_id}
                onChange={(e) => setAddForm({ ...addForm, subject_cluster_id: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Re-map Cluster Modal */}
      {selectedSubject && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSubject(null)}
          title={`Re-map Faculty Cluster: ${selectedSubject.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedSubject(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveRemap} disabled={isSaving}>
                {isSaving ? 'Re-mapping...' : 'Save Mapping'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {remapModalError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '13px',
                }}
              >
                {remapModalError}
              </div>
            )}
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, fontSize: '13.5px' }}>
              Select the new academic faculty cluster for <strong>{selectedSubject.name}</strong>.
              All applicants in this discipline will subsequently route to the assigned Assistant Dean of the selected cluster.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Target Subject Cluster *
              </label>
              <Select
                options={clusters.map((c) => ({
                  value: c.id,
                  label: `Cluster #${c.cluster_number}: ${c.name} (${c.assistant_dean ? c.assistant_dean.name_snapshot : 'No Dean'})`,
                }))}
                value={targetClusterId}
                onChange={(e) => setTargetClusterId(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Subject Modal */}
      {editingSubject && (
        <Modal
          isOpen={true}
          onClose={() => setEditingSubject(null)}
          title={`Edit Subject: ${editingSubject.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setEditingSubject(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {editModalError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '13px',
                }}
              >
                {editModalError}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Subject Name *
              </label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Subject Code
              </label>
              <Input
                value={editForm.code || ''}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Faculty Subject Cluster
              </label>
              <Select
                options={clusters.map((c) => ({
                  value: c.id,
                  label: `Cluster #${c.cluster_number}: ${c.name}`,
                }))}
                value={editForm.subject_cluster_id || ''}
                onChange={(e) => setEditForm({ ...editForm, subject_cluster_id: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Subject Modal */}
      {deletingSubject && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingSubject(null)}
          title={`Delete Subject: ${deletingSubject.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="outline" size="sm" onClick={() => setDeletingSubject(null)} disabled={isSaving}>
                Cancel
              </Button>
              {deletingSubject.is_active && (
                <Button
                  variant="outline"
                  size="sm"
                  style={{ color: '#059669', borderColor: '#10b981' }}
                  onClick={async () => {
                    await handleToggleStatus(deletingSubject);
                    setDeletingSubject(null);
                  }}
                  disabled={isSaving}
                >
                  Deactivate Subject Instead
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                onClick={handleDeleteSubject}
                disabled={isSaving}
              >
                {isSaving ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete academic subject <strong>{deletingSubject.name}</strong> ({deletingSubject.code || 'No Code'})?
            </p>
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                color: '#92400e',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <strong>Safety Guard:</strong> Subjects referenced by student master records, scholar applicant profiles, or historical grievance cases cannot be deleted. If intake for this discipline should be discontinued, deactivate the subject instead to preserve historical records.
            </div>
            {deleteError && (
              <div
                role="alert"
                style={{
                  padding: '12px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  color: '#7f1d1d',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                {deleteError}
              </div>
            )}
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
