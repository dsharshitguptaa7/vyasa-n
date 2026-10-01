import React, { useEffect, useState } from 'react';
import { PageContainer, LoadingState, Button, Badge, Modal, Select } from '@vyasa/ui';
import { AdminNav } from '../../components/AdminNav';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import { GrievanceCluster, Authority } from '../../types/atharva';

export const GrievanceClustersPage: React.FC = () => {
  const [clusters, setClusters] = useState<GrievanceCluster[]>([]);
  const [associateDeans, setAssociateDeans] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Re-map modal state
  const [selectedCluster, setSelectedCluster] = useState<GrievanceCluster | null>(null);
  const [selectedDeanId, setSelectedDeanId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [clustersData, authData] = await Promise.all([
        atharvaAdminService.getGrievanceClusters(),
        atharvaAdminService.getAuthorities({ role: 'ASSOCIATE_DEAN', is_active: true }),
      ]);
      setClusters(clustersData);
      setAssociateDeans(authData);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load grievance clusters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openRemapModal = (cluster: GrievanceCluster) => {
    setSelectedCluster(cluster);
    setSelectedDeanId(cluster.associate_dean_id || '');
  };

  const handleSaveRemap = async () => {
    if (!selectedCluster) return;
    try {
      setIsSaving(true);
      const updated = await atharvaAdminService.updateGrievanceClusterAssociateDean(
        selectedCluster.id,
        selectedDeanId ? selectedDeanId : null
      );
      setClusters((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, associate_dean_id: updated.associate_dean_id, associate_dean: updated.associate_dean } : c))
      );
      setSelectedCluster(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update Associate Dean mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleClusterStatus = async (cluster: GrievanceCluster) => {
    try {
      const updated = await atharvaAdminService.updateGrievanceClusterStatus(cluster.id, !cluster.is_active);
      setClusters((prev) =>
        prev.map((c) => (c.id === cluster.id ? { ...c, is_active: updated.is_active } : c))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update grievance cluster status');
    }
  };

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <AdminNav />

      {/* Header Info */}
      <div style={{ marginBottom: '24px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>
          Grievance Functional Clusters &amp; Associate Dean Mappings
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
          Grievance clusters group functional categories (e.g. Fellowship &amp; Scholarship Affairs, Examination &amp; Evaluation, Campus Amenities).
          Categories configured for <strong>CLUSTER</strong> routing dynamically dispatch assigned cases to the
          Associate Dean mapped to each cluster. Re-mapping below takes effect instantly across the ecosystem.
        </p>
      </div>

      {loading ? (
        <LoadingState message="Loading grievance clusters and active Associate Deans..." />
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
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Associate Dean</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '120px' }}>Categories</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '100px' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster) => (
                <tr key={cluster.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge variant="teal">#{cluster.cluster_number}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{cluster.name}</div>
                    {cluster.description && (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{cluster.description}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {cluster.associate_dean ? (
                      <div>
                        <div style={{ fontWeight: 500, color: '#0f172a' }}>
                          {cluster.associate_dean.name_snapshot}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {cluster.associate_dean.email_snapshot}
                        </div>
                        {cluster.associate_dean.designation && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {cluster.associate_dean.designation}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>
                        &times; No Associate Dean Mapped
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                      {cluster.category_count} categories
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

      {/* Reassign Associate Dean Modal */}
      {selectedCluster && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCluster(null)}
          title={`Reassign Associate Dean: ${selectedCluster.name}`}
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
              <strong>Administrative Warning:</strong> Changing this mapping will affect future category-based
              routing for this cluster. All new grievances submitted under categories assigned to{' '}
              <strong>{selectedCluster.name}</strong> will resolve to the chosen Associate Dean immediately
              without database restarts or source code edits.
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Select Active Associate Dean
              </label>
              <Select
                options={[
                  { value: '', label: '-- None (Unassigned) --' },
                  ...associateDeans.map((dean) => ({
                    value: dean.id,
                    label: `${dean.name_snapshot} (${dean.designation || 'Associate Dean'} - ${dean.email_snapshot})`,
                  })),
                ]}
                value={selectedDeanId}
                onChange={(e) => setSelectedDeanId(e.target.value)}
              />
            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Current Assigned Officer: {selectedCluster.associate_dean?.name_snapshot || 'None'}
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
