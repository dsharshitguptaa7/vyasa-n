import React, { useEffect, useState } from 'react';
import { PageContainer, LoadingState, Button, Badge, Modal, Select } from '@vyasa/ui';
import { AdminNav } from '../../components/AdminNav';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import { SubjectCluster, Authority } from '../../types/atharva';

export const SubjectClustersPage: React.FC = () => {
  const [clusters, setClusters] = useState<SubjectCluster[]>([]);
  const [assistantDeans, setAssistantDeans] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Re-map modal state
  const [selectedCluster, setSelectedCluster] = useState<SubjectCluster | null>(null);
  const [selectedDeanId, setSelectedDeanId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <AdminNav />

      {/* Header Info */}
      <div style={{ marginBottom: '24px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>
          Academic Subject Clusters &amp; Assistant Dean Mappings
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
          Subject clusters group academic disciplines under university faculty domains.
          When an applicant files a grievance categorized for <strong>Subject Assistant Dean</strong>,
          the dynamic routing engine queries the applicant&apos;s registered subject, resolves its cluster,
          and routes the case to the configured Assistant Dean below.
        </p>
      </div>

      {loading ? (
        <LoadingState message="Loading subject clusters and active Assistant Deans..." />
      ) : errorMsg ? (
        <div style={{ padding: '24px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#991b1b' }}>
          {errorMsg}
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '80px' }}>Cluster</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cluster Name &amp; Description</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Assistant Dean</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '100px' }}>Subjects</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '100px' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster) => (
                <tr key={cluster.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge variant="neutral">#{cluster.cluster_number}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{cluster.name}</div>
                    {cluster.description && (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{cluster.description}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {cluster.assistant_dean ? (
                      <div>
                        <div style={{ fontWeight: 500, color: '#0f172a' }}>
                          {cluster.assistant_dean.name_snapshot}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {cluster.assistant_dean.email_snapshot}
                        </div>
                        {cluster.assistant_dean.designation && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {cluster.assistant_dean.designation}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>
                        &times; No Assistant Dean Mapped
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                      {cluster.subject_count} subjects
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: cluster.is_active ? '#059669' : '#dc2626',
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: cluster.is_active ? '#10b981' : '#ef4444',
                        }}
                      />
                      {cluster.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Button variant="primary" size="sm" onClick={() => openRemapModal(cluster)}>
                        Reassign Dean
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleClusterStatus(cluster)}
                      >
                        {cluster.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reassign Assistant Dean Modal */}
      {selectedCluster && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCluster(null)}
          title={`Reassign Assistant Dean: ${selectedCluster.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedCluster(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveRemap} disabled={isSaving}>
                {isSaving ? 'Saving Changes...' : 'Save Reassignment'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Warning Dialog Banner */}
            <div
              style={{
                padding: '14px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                color: '#92400e',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <strong>Administrative Notice:</strong> Changing this mapping will immediately affect future
              subject-based routing. All new grievances submitted under academic subjects belonging to{' '}
              <strong>{selectedCluster.name}</strong> will resolve to the chosen Assistant Dean without
              requiring code changes or service restart. Existing historical grievances retain their
              assigned officer.
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Select Active Assistant Dean
              </label>
              <Select
                options={[
                  { value: '', label: '-- None (Unassigned) --' },
                  ...assistantDeans.map((dean) => ({
                    value: dean.id,
                    label: `${dean.name_snapshot} (${dean.designation || 'Assistant Dean'} - ${dean.email_snapshot})`,
                  })),
                ]}
                value={selectedDeanId}
                onChange={(e) => setSelectedDeanId(e.target.value)}
              />
            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Current Mapping: {selectedCluster.assistant_dean?.name_snapshot || 'None'}
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
