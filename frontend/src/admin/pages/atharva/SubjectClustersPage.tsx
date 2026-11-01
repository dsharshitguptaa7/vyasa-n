import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, Button, Badge, Modal, Input, Select, AppIcon } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import { SubjectCluster, Authority, CreateSubjectClusterPayload, UpdateSubjectClusterPayload } from '../../types/atharva';

export const SubjectClustersPage: React.FC = () => {
  const [clusters, setClusters] = useState<SubjectCluster[]>([]);
  const [assistantDeans, setAssistantDeans] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Re-map modal state
  const [selectedCluster, setSelectedCluster] = useState<SubjectCluster | null>(null);
  const [selectedDeanId, setSelectedDeanId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Add Cluster Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<CreateSubjectClusterPayload>({
    cluster_number: 1,
    name: '',
    description: '',
    assistant_dean_id: null,
    is_active: true,
  });

  // Edit Cluster Modal State
  const [editingCluster, setEditingCluster] = useState<SubjectCluster | null>(null);
  const [editForm, setEditForm] = useState<UpdateSubjectClusterPayload>({});

  // Delete Cluster Modal State
  const [deletingCluster, setDeletingCluster] = useState<SubjectCluster | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [clustersData, authData] = await Promise.all([
        atharvaAdminService.getSubjectClusters(),
        atharvaAdminService.getAuthorities({ role: 'ASSISTANT_DEAN', is_active: true }),
      ]);
      setClusters(clustersData);
      setAssistantDeans(authData);
      if (clustersData.length > 0) {
        const nextNum = Math.max(...clustersData.map((c) => c.cluster_number)) + 1;
        setAddForm((prev) => ({ ...prev, cluster_number: nextNum }));
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load subject clusters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openRemapModal = (cluster: SubjectCluster) => {
    setSelectedCluster(cluster);
    setSelectedDeanId(cluster.assistant_dean_id || '');
  };

  const handleSaveRemap = async () => {
    if (!selectedCluster) return;
    try {
      setIsSaving(true);
      const updated = await atharvaAdminService.updateSubjectClusterAssistantDean(
        selectedCluster.id,
        selectedDeanId ? selectedDeanId : null
      );
      setClusters((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, assistant_dean_id: updated.assistant_dean_id, assistant_dean: updated.assistant_dean } : c))
      );
      setSelectedCluster(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update Assistant Dean mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleClusterStatus = async (cluster: SubjectCluster) => {
    try {
      const updated = await atharvaAdminService.updateSubjectClusterStatus(cluster.id, !cluster.is_active);
      setClusters((prev) =>
        prev.map((c) => (c.id === cluster.id ? { ...c, is_active: updated.is_active } : c))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update cluster status');
    }
  };

  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.cluster_number) {
      alert('Cluster Number and Name are required.');
      return;
    }
    try {
      setIsSaving(true);
      const created = await atharvaAdminService.createSubjectCluster(addForm);
      setClusters((prev) => [...prev, created]);
      setIsAddModalOpen(false);
      setAddForm({
        cluster_number: created.cluster_number + 1,
        name: '',
        description: '',
        assistant_dean_id: null,
        is_active: true,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create subject cluster');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (cluster: SubjectCluster) => {
    setEditingCluster(cluster);
    setEditForm({
      name: cluster.name,
      description: cluster.description || '',
      cluster_number: cluster.cluster_number,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCluster) return;
    try {
      setIsSaving(true);
      const updated = await atharvaAdminService.updateSubjectCluster(editingCluster.id, editForm);
      setClusters((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? {
                ...c,
                name: updated.name,
                description: updated.description,
                cluster_number: updated.cluster_number,
              }
            : c
        )
      );
      setEditingCluster(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update cluster');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCluster = async () => {
    if (!deletingCluster) return;
    try {
      setIsSaving(true);
      setDeleteError(null);
      await atharvaAdminService.deleteSubjectCluster(deletingCluster.id);
      setClusters((prev) => prev.filter((c) => c.id !== deletingCluster.id));
      setDeletingCluster(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete cluster');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredClusters = useMemo(() => {
    if (!searchQuery.trim()) return clusters;
    const q = searchQuery.toLowerCase();
    return clusters.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        String(c.cluster_number).includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.assistant_dean && c.assistant_dean.name_snapshot.toLowerCase().includes(q))
    );
  }, [clusters, searchQuery]);

  const stats = useMemo(() => {
    const total = clusters.length;
    const active = clusters.filter((c) => c.is_active).length;
    const assigned = clusters.filter((c) => c.assistant_dean_id).length;
    const totalSubjects = clusters.reduce((acc, c) => acc + (c.subject_count || 0), 0);
    return { total, active, assigned, totalSubjects };
  }, [clusters]);

  const getInitials = (name: string): string => {
    return name
      .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'AD';
  };

  return (
    <AdminLayout activeTab="subject-clusters">

      {/* Official Academic Banner */}
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
            Academic Senate Taxonomy • Disciplinary Mappings
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
            Academic Subject Clusters &amp; Assistant Dean Mappings
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', lineHeight: 1.55 }}>
            Subject clusters group academic disciplines under university faculty domains.
            When an applicant files a grievance categorized for <strong>Subject Assistant Dean</strong>,
            the dynamic routing engine queries the applicant&apos;s registered subject, resolves its cluster,
            and routes the case to the configured Assistant Dean below.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<AppIcon name="layers" size={14} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add Cluster
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

      {/* Cluster Metrics Strip */}
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
            Subject Clusters
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)' }}>
            {stats.total}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Faculty discipline groups</span>
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
            Active Clusters
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: '#059669' }}>
            {stats.active}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Routing operational</span>
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
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--vyasa-teal, #0d766e)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Assigned Deans
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: 'var(--vyasa-teal, #0d766e)' }}>
            {stats.assigned} / {stats.total}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Assistant Dean mappings</span>
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
            Total Disciplines
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: 'var(--vyasa-gold, #b2811a)' }}>
            {stats.totalSubjects}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Cataloged doctoral subjects</span>
        </div>
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '20px',
          backgroundColor: '#ffffff',
          padding: '14px 20px',
          borderRadius: '8px',
          border: '1px solid var(--vyasa-border, #e3dcd1)',
          boxShadow: 'var(--vyasa-shadow-sm)',
        }}
      >
        <div style={{ flex: 1 }}>
          <Input
            placeholder="Search clusters by name, number, description, or assigned Assistant Dean..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted, #64748b)' }}>
          Showing {filteredClusters.length} clusters
        </span>
      </div>

      {loading ? (
        <LoadingState message="Loading subject clusters and active Assistant Deans..." />
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
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Cluster # &amp; Name</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Mapped Assistant Dean</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Disciplines</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClusters.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No academic subject clusters matched your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredClusters.map((c) => (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid var(--vyasa-border-subtle, #f1f5f9)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: 'var(--vyasa-gold, #b2811a)',
                              backgroundColor: 'var(--vyasa-gold-light, #fcf7eb)',
                              border: '1px solid var(--vyasa-gold-border, #ecdfba)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            #{c.cluster_number}
                          </span>
                          <strong style={{ color: 'var(--vyasa-primary, #0f2b48)', fontSize: '14px' }}>
                            {c.name}
                          </strong>
                        </div>
                        {c.description && (
                          <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #64748b)', marginTop: '4px' }}>
                            {c.description}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {c.assistant_dean ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--vyasa-gold-light, #fcf7eb)',
                                border: '1px solid var(--vyasa-gold-border, #ecdfba)',
                                color: 'var(--vyasa-gold, #b2811a)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(c.assistant_dean.name_snapshot)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)' }}>
                                {c.assistant_dean.name_snapshot}
                              </div>
                              <div style={{ fontSize: '12px', color: '#2563eb' }}>
                                {c.assistant_dean.email_snapshot}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#b45309',
                              backgroundColor: '#fffbeb',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            ⚠️ No Assistant Dean Assigned
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <Link
                          to={`/admin/atharva/subjects?cluster=${c.id}`}
                          style={{ textDecoration: 'none' }}
                          title={`View all subjects mapped to ${c.name}`}
                        >
                          <Badge variant="neutral" style={{ cursor: 'pointer' }}>
                            {c.subject_count} subjects →
                          </Badge>
                        </Link>
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
                            backgroundColor: c.is_active ? '#ecfdf5' : '#fef2f2',
                            color: c.is_active ? '#059669' : '#dc2626',
                            border: c.is_active ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          }}
                        >
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: c.is_active ? '#10b981' : '#ef4444',
                              display: 'inline-block',
                            }}
                          />
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openEditModal(c)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openRemapModal(c)}
                          >
                            Reassign Dean
                          </Button>
                          <Button
                            variant={c.is_active ? 'outline' : 'primary'}
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleToggleClusterStatus(c)}
                          >
                            {c.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px', color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => { setDeletingCluster(c); setDeleteError(null); }}
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
        </div>
      )}

      {/* Add Cluster Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title="Create Academic Subject Cluster"
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateCluster} disabled={isSaving}>
                {isSaving ? 'Creating...' : 'Create Cluster'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Cluster # *
                </label>
                <Input
                  type="number"
                  value={addForm.cluster_number}
                  onChange={(e) => setAddForm({ ...addForm, cluster_number: parseInt(e.target.value, 10) || 1 })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Cluster Name *
                </label>
                <Input
                  placeholder="e.g. Life Sciences & Biotechnology"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Description
              </label>
              <Input
                placeholder="Faculty grouping description..."
                value={addForm.description || ''}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Accountable Assistant Dean
              </label>
              <Select
                options={[
                  { value: '', label: '-- Unassigned (Manual Assignment Required) --' },
                  ...assistantDeans.map((d) => ({
                    value: d.id,
                    label: `${d.name_snapshot} (${d.department || 'General'})`,
                  })),
                ]}
                value={addForm.assistant_dean_id || ''}
                onChange={(e) => setAddForm({ ...addForm, assistant_dean_id: e.target.value ? e.target.value : null })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Re-map Assistant Dean Modal */}
      {selectedCluster && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCluster(null)}
          title={`Reconfigure Assistant Dean: ${selectedCluster.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedCluster(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveRemap} disabled={isSaving}>
                {isSaving ? 'Re-mapping...' : 'Save Dean Assignment'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, fontSize: '13.5px' }}>
              Future coursework and disciplinary grievances mapped to this cluster (#{selectedCluster.cluster_number})
              will immediately route to the selected Assistant Dean below.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Select Active Assistant Dean
              </label>
              <Select
                options={[
                  { value: '', label: '-- Unassign (Clear Dean) --' },
                  ...assistantDeans.map((d) => ({
                    value: d.id,
                    label: `${d.name_snapshot} (${d.department || 'General'})`,
                  })),
                ]}
                value={selectedDeanId}
                onChange={(e) => setSelectedDeanId(e.target.value)}
              />
            </div>
            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--vyasa-gold-light, #fcf7eb)',
                border: '1px solid var(--vyasa-gold-border, #ecdfba)',
                borderRadius: '6px',
                fontSize: '12.5px',
                color: 'var(--vyasa-gold, #b2811a)',
                lineHeight: 1.45,
              }}
            >
              <strong>Governance Rule:</strong> Assistant Deans must be active members of the institutional directory. 
              Existing in-flight cases will retain their original reviewer unless explicitly transferred.
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Cluster Modal */}
      {editingCluster && (
        <Modal
          isOpen={true}
          onClose={() => setEditingCluster(null)}
          title={`Edit Cluster: ${editingCluster.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setEditingCluster(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Cluster #
                </label>
                <Input
                  type="number"
                  value={editForm.cluster_number || 1}
                  onChange={(e) => setEditForm({ ...editForm, cluster_number: parseInt(e.target.value, 10) || 1 })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Cluster Name
                </label>
                <Input
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Description
              </label>
              <Input
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Cluster Modal */}
      {deletingCluster && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingCluster(null)}
          title={`Delete Cluster: ${deletingCluster.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setDeletingCluster(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                onClick={handleDeleteCluster}
                disabled={isSaving}
              >
                {isSaving ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>
              Are you sure you want to delete subject cluster <strong>#{deletingCluster.cluster_number}: {deletingCluster.name}</strong>?
            </p>
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <strong>Constraint:</strong> Subject clusters with mapped subjects cannot be deleted. All subjects must first be re-mapped to another cluster.
            </div>
            {deleteError && (
              <div
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
