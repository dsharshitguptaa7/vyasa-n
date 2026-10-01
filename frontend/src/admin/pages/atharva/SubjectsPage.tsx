import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer, LoadingState, Button, Badge, Modal, Input, Select } from '@vyasa/ui';
import { AdminNav } from '../../components/AdminNav';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import { Subject, SubjectCluster } from '../../types/atharva';

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [clusters, setClusters] = useState<SubjectCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [clusterFilter, setClusterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Remap cluster modal state
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [targetClusterId, setTargetClusterId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [subs, cls] = await Promise.all([
        atharvaAdminService.getSubjects(),
        atharvaAdminService.getSubjectClusters(),
      ]);
      setSubjects(subs);
      setClusters(cls);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load academic subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (clusterFilter && s.subject_cluster_id !== clusterFilter) return false;
      if (statusFilter === 'active' && !s.is_active) return false;
      if (statusFilter === 'inactive' && s.is_active) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesCode = s.code.toLowerCase().includes(q);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    });
  }, [subjects, clusterFilter, statusFilter, searchQuery]);

  const handleToggleStatus = async (subject: Subject) => {
    try {
      const updated = await atharvaAdminService.updateSubjectStatus(subject.id, !subject.is_active);
      setSubjects((prev) =>
        prev.map((s) => (s.id === subject.id ? { ...s, is_active: updated.is_active } : s))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update subject status');
    }
  };

  const handleSaveRemap = async () => {
    if (!selectedSubject || !targetClusterId) return;
    try {
      setIsSaving(true);
      const updated = await atharvaAdminService.updateSubjectMapping(selectedSubject.id, targetClusterId);
      const targetCluster = clusters.find((c) => c.id === targetClusterId);
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === selectedSubject.id
            ? {
                ...s,
                subject_cluster_id: updated.subject_cluster_id,
                cluster_name: targetCluster?.name || null,
                cluster_number: targetCluster?.cluster_number || null,
              }
            : s
        )
      );
      setSelectedSubject(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update subject cluster mapping');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <AdminNav />

      {/* Header Info */}
      <div style={{ marginBottom: '24px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>
          Academic Disciplines &amp; Subject Catalog
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
          Academic subjects define the doctoral scholar&apos;s department discipline.
          Every subject maps to a faculty Subject Cluster. Managing cluster assignments dynamically redirects
          future scholar submissions to the cluster&apos;s designated Assistant Dean.
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '20px',
          backgroundColor: '#fff',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: '1 1 240px' }}>
          <Input
            placeholder="Search by subject code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ width: '240px' }}>
          <Select
            options={[
              { value: '', label: 'All Subject Clusters' },
              ...clusters.map((c) => ({
                value: c.id,
                label: `#${c.cluster_number} - ${c.name}`,
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
        <Button variant="outline" size="sm" onClick={fetchData}>
          Refresh
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState message="Loading academic subjects..." />
      ) : errorMsg ? (
        <div style={{ padding: '24px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#991b1b' }}>
          {errorMsg}
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '120px' }}>Code</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Subject Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Subject Cluster</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '100px' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No academic subjects found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant="neutral">{sub.code}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#0f172a' }}>
                      {sub.name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {sub.cluster_name ? (
                        <div style={{ color: '#334155' }}>
                          <span style={{ fontWeight: 600, color: '#0369a1' }}>#{sub.cluster_number}</span>{' '}
                          {sub.cluster_name}
                        </div>
                      ) : (
                        <span style={{ color: '#dc2626' }}>Unmapped</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: sub.is_active ? '#059669' : '#dc2626',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: sub.is_active ? '#10b981' : '#ef4444',
                          }}
                        />
                        {sub.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSubject(sub);
                            setTargetClusterId(sub.subject_cluster_id);
                          }}
                        >
                          Change Cluster
                        </Button>
                        <Button
                          variant={sub.is_active ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => handleToggleStatus(sub)}
                        >
                          {sub.is_active ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Change Cluster Modal */}
      {selectedSubject && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSubject(null)}
          title={`Re-map Subject: ${selectedSubject.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedSubject(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveRemap} disabled={isSaving || !targetClusterId}>
                {isSaving ? 'Re-mapping...' : 'Save Re-mapping'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
              Select target Subject Cluster for <strong>{selectedSubject.name}</strong> ({selectedSubject.code}):
            </p>
            <div>
              <Select
                options={clusters
                  .filter((c) => c.is_active)
                  .map((c) => ({
                    value: c.id,
                    label: `#${c.cluster_number} - ${c.name} (${c.assistant_dean?.name_snapshot || 'No Dean Assigned'})`,
                  }))}
                value={targetClusterId}
                onChange={(e) => setTargetClusterId(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Future academic grievances for applicants under this subject will route through the newly assigned cluster.
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
