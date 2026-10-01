import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer, LoadingState, Button, Badge, Modal, Input, Select } from '@vyasa/ui';
import { AdminNav } from '../../components/AdminNav';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import { Category, GrievanceCluster, Authority, CategoryRoutingType } from '../../types/atharva';

export const GrievanceCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [clusters, setClusters] = useState<GrievanceCluster[]>([]);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [routingTypeFilter, setRoutingTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Configure Routing modal state
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedRoutingType, setSelectedRoutingType] = useState<CategoryRoutingType>('CLUSTER');
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [selectedAuthorityId, setSelectedAuthorityId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [cats, cls, auths] = await Promise.all([
        atharvaAdminService.getCategories(),
        atharvaAdminService.getGrievanceClusters({ is_active: true }),
        atharvaAdminService.getAuthorities({ is_active: true }),
      ]);
      setCategories(cats);
      setClusters(cls);
      setAuthorities(auths);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load grievance categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (routingTypeFilter && c.routing_type !== routingTypeFilter) return false;
      if (statusFilter === 'active' && !c.is_active) return false;
      if (statusFilter === 'inactive' && c.is_active) return false;
      if (searchQuery) {
        if (!c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [categories, routingTypeFilter, statusFilter, searchQuery]);

  const openRoutingModal = (category: Category) => {
    setSelectedCategory(category);
    setSelectedRoutingType(category.routing_type);
    setSelectedClusterId(category.grievance_cluster_id || '');
    setSelectedAuthorityId(category.fixed_authority_id || '');
  };

  const handleSaveRouting = async () => {
    if (!selectedCategory) return;
    try {
      setIsSaving(true);
      const payload = {
        routing_type: selectedRoutingType,
        grievance_cluster_id:
          selectedRoutingType === 'CLUSTER' || selectedRoutingType === 'GRIEVANCE_CLUSTER'
            ? selectedClusterId || null
            : null,
        fixed_authority_id:
          selectedRoutingType === 'FIXED_AUTHORITY' ? selectedAuthorityId || null : null,
      };

      const updated = await atharvaAdminService.updateCategoryRouting(selectedCategory.id, payload);
      setCategories((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setSelectedCategory(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update category routing configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (category: Category) => {
    try {
      const updated = await atharvaAdminService.updateCategoryStatus(category.id, !category.is_active);
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, is_active: updated.is_active } : c))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update category status');
    }
  };

  const getRoutingTypeBadgeVariant = (type: CategoryRoutingType): 'primary' | 'saffron' | 'gold' | 'teal' | 'neutral' => {
    switch (type) {
      case 'CLUSTER':
      case 'GRIEVANCE_CLUSTER':
        return 'teal';
      case 'FIXED_AUTHORITY':
        return 'saffron';
      case 'SUBJECT_ASSISTANT_DEAN':
        return 'gold';
      default:
        return 'neutral';
    }
  };

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <AdminNav />

      {/* Header Info */}
      <div style={{ marginBottom: '24px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>
          Grievance Category Taxonomy &amp; Dynamic Routing Engine Mappings
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
          Categories define the subject matter of an applicant&apos;s grievance. Every category defines its
          routing path: <strong>CLUSTER</strong> (routes to configured Associate Dean),{' '}
          <strong>FIXED_AUTHORITY</strong> (routes directly to a specific institutional officer), or{' '}
          <strong>SUBJECT_ASSISTANT_DEAN</strong> (delegates to scholar&apos;s department Assistant Dean).
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
            placeholder="Search grievance categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ width: '220px' }}>
          <Select
            options={[
              { value: '', label: 'All Routing Types' },
              { value: 'CLUSTER', label: 'Cluster -> Associate Dean' },
              { value: 'FIXED_AUTHORITY', label: 'Fixed Authority' },
              { value: 'SUBJECT_ASSISTANT_DEAN', label: 'Subject Assistant Dean' },
            ]}
            value={routingTypeFilter}
            onChange={(e) => setRoutingTypeFilter(e.target.value)}
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
        <LoadingState message="Loading grievance categories..." />
      ) : errorMsg ? (
        <div style={{ padding: '24px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#991b1b' }}>
          {errorMsg}
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Category Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '180px' }}>Routing Mode</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Target Destination</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '100px' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No grievance categories found matching filters.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                      {cat.name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={getRoutingTypeBadgeVariant(cat.routing_type)}>
                        {cat.routing_type}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {cat.routing_type === 'CLUSTER' || cat.routing_type === 'GRIEVANCE_CLUSTER' ? (
                        cat.cluster_name ? (
                          <div style={{ color: '#0369a1' }}>
                            <strong>#{cat.cluster_number}</strong> {cat.cluster_name}
                          </div>
                        ) : (
                          <span style={{ color: '#dc2626' }}>No cluster mapped</span>
                        )
                      ) : cat.routing_type === 'FIXED_AUTHORITY' ? (
                        cat.fixed_authority_name ? (
                          <div style={{ color: '#b45309' }}>
                            <strong>{cat.fixed_authority_name}</strong> ({cat.fixed_authority_role})
                          </div>
                        ) : (
                          <span style={{ color: '#dc2626' }}>No authority mapped</span>
                        )
                      ) : (
                        <div style={{ color: '#475569', fontStyle: 'italic' }}>
                          Delegated to Scholar&apos;s Subject Assistant Dean
                        </div>
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
                          color: cat.is_active ? '#059669' : '#dc2626',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: cat.is_active ? '#10b981' : '#ef4444',
                          }}
                        />
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Button variant="primary" size="sm" onClick={() => openRoutingModal(cat)}>
                          Configure Routing
                        </Button>
                        <Button
                          variant={cat.is_active ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => handleToggleStatus(cat)}
                        >
                          {cat.is_active ? 'Disable' : 'Enable'}
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

      {/* Configure Routing Modal */}
      {selectedCategory && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCategory(null)}
          title={`Configure Routing: ${selectedCategory.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedCategory(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveRouting} disabled={isSaving}>
                {isSaving ? 'Updating Routing...' : 'Save Configuration'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              <strong>Notice:</strong> Updates take effect immediately for all new grievance filings.
              This modification is logged into the Core immutable audit trail.
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Routing Strategy
              </label>
              <Select
                options={[
                  { value: 'CLUSTER', label: 'Functional Grievance Cluster (Associate Dean)' },
                  { value: 'FIXED_AUTHORITY', label: 'Fixed Authority Record' },
                  { value: 'SUBJECT_ASSISTANT_DEAN', label: 'Academic Subject Assistant Dean' },
                ]}
                value={selectedRoutingType}
                onChange={(e) => setSelectedRoutingType(e.target.value as CategoryRoutingType)}
              />
            </div>

            {(selectedRoutingType === 'CLUSTER' || selectedRoutingType === 'GRIEVANCE_CLUSTER') && (
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Target Grievance Cluster
                </label>
                <Select
                  options={[
                    { value: '', label: '-- Select Grievance Cluster --' },
                    ...clusters.map((c) => ({
                      value: c.id,
                      label: `#${c.cluster_number} - ${c.name} (${c.associate_dean?.name_snapshot || 'No Dean Assigned'})`,
                    })),
                  ]}
                  value={selectedClusterId}
                  onChange={(e) => setSelectedClusterId(e.target.value)}
                />
              </div>
            )}

            {selectedRoutingType === 'FIXED_AUTHORITY' && (
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Target Institutional Officer
                </label>
                <Select
                  options={[
                    { value: '', label: '-- Select Institutional Authority --' },
                    ...authorities.map((a) => ({
                      value: a.id,
                      label: `${a.name_snapshot} (${a.role} - ${a.designation || a.email_snapshot})`,
                    })),
                  ]}
                  value={selectedAuthorityId}
                  onChange={(e) => setSelectedAuthorityId(e.target.value)}
                />
              </div>
            )}

            {selectedRoutingType === 'SUBJECT_ASSISTANT_DEAN' && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  color: '#166534',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                Grievances under this category will automatically resolve to the Assistant Dean of the
                student&apos;s registered subject cluster during submission. No static cluster or authority FK is needed.
              </div>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
