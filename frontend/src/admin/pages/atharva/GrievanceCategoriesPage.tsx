import React, { useEffect, useState, useMemo } from 'react';
import { LoadingState, Button, Badge, Modal, Input, Select, AppIcon } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import {
  Category,
  GrievanceCluster,
  Authority,
  Subject,
  CategoryRoutingType,
  CreateCategoryPayload,
  RoutingSimulationResult,
} from '../../types/atharva';

const ROUTING_TYPE_DISPLAY: Record<string, string> = {
  CLUSTER: 'Cluster -> Associate Dean',
  GRIEVANCE_CLUSTER: 'Cluster -> Associate Dean',
  FIXED_AUTHORITY: 'Fixed Statutory Authority',
  SUBJECT_ASSISTANT_DEAN: 'Subject Assistant Dean',
};

export const GrievanceCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [clusters, setClusters] = useState<GrievanceCluster[]>([]);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [routingTypeFilter, setRoutingTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Configure Routing modal state
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedRoutingType, setSelectedRoutingType] = useState<CategoryRoutingType>('CLUSTER');
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [selectedAuthorityId, setSelectedAuthorityId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Add Category modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<CreateCategoryPayload>({
    name: '',
    description: '',
    routing_type: 'CLUSTER',
    grievance_cluster_id: null,
    fixed_authority_id: null,
    is_active: true,
  });

  // Edit Category modal state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string }>({
    name: '',
    description: '',
  });

  // Delete Category modal state
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Simulation modal state
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [simCategoryId, setSimCategoryId] = useState<string>('');
  const [simSubjectId, setSimSubjectId] = useState<string>('');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<RoutingSimulationResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [catsData, clustersData, authsData, subsData] = await Promise.all([
        atharvaAdminService.getCategories(),
        atharvaAdminService.getGrievanceClusters(),
        atharvaAdminService.getAuthorities(),
        atharvaAdminService.getSubjects(),
      ]);
      setCategories(catsData);
      setClusters(clustersData);
      setAuthorities(authsData);
      setSubjects(subsData);

      if (clustersData.length > 0) {
        setAddForm((prev) => ({ ...prev, grievance_cluster_id: clustersData[0].id }));
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load grievance categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, routingTypeFilter, statusFilter]);

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (routingTypeFilter && cat.routing_type !== routingTypeFilter) return false;
      if (statusFilter === 'active' && !cat.is_active) return false;
      if (statusFilter === 'inactive' && cat.is_active) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = cat.name.toLowerCase().includes(q);
        const matchesDesc = cat.description?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [categories, routingTypeFilter, statusFilter, searchQuery]);

  const paginatedCategories = useMemo(() => {
    if (pageSize === 0) return filteredCategories;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCategories.slice(startIndex, startIndex + pageSize);
  }, [filteredCategories, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  }, [filteredCategories.length, pageSize]);

  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.is_active).length;
    const clusterRouted = categories.filter((c) => c.routing_type === 'CLUSTER' || c.routing_type === 'GRIEVANCE_CLUSTER').length;
    const subjectRouted = categories.filter((c) => c.routing_type === 'SUBJECT_ASSISTANT_DEAN').length;
    const fixedRouted = categories.filter((c) => c.routing_type === 'FIXED_AUTHORITY').length;
    return { total, active, clusterRouted, subjectRouted, fixedRouted };
  }, [categories]);

  const openRouteModal = (category: Category) => {
    setSelectedCategory(category);
    setSelectedRoutingType(category.routing_type);
    setSelectedClusterId(category.grievance_cluster_id || (clusters.length > 0 ? clusters[0].id : ''));
    setSelectedAuthorityId(category.fixed_authority_id || (authorities.length > 0 ? authorities[0].id : ''));
  };

  const handleSaveRoute = async () => {
    if (!selectedCategory) return;
    try {
      setIsSaving(true);
      const payload = {
        routing_type: selectedRoutingType,
        grievance_cluster_id: selectedRoutingType === 'CLUSTER' || selectedRoutingType === 'GRIEVANCE_CLUSTER' ? selectedClusterId : null,
        fixed_authority_id: selectedRoutingType === 'FIXED_AUTHORITY' ? selectedAuthorityId : null,
      };
      const updated = await atharvaAdminService.updateCategoryRouting(selectedCategory.id, payload);
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelectedCategory(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update category routing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (cat: Category) => {
    try {
      const updated = await atharvaAdminService.updateCategoryStatus(cat.id, !cat.is_active);
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, is_active: updated.is_active } : c)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update category status');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      alert('Category Name is required.');
      return;
    }
    try {
      setIsSaving(true);
      const payload: CreateCategoryPayload = {
        ...addForm,
        name: addForm.name.trim(),
        description: addForm.description?.trim() || null,
        grievance_cluster_id: addForm.routing_type === 'CLUSTER' || addForm.routing_type === 'GRIEVANCE_CLUSTER' ? addForm.grievance_cluster_id : null,
        fixed_authority_id: addForm.routing_type === 'FIXED_AUTHORITY' ? addForm.fixed_authority_id : null,
      };
      const created = await atharvaAdminService.createCategory(payload);
      setCategories((prev) => [...prev, created]);
      setIsAddModalOpen(false);
      setAddForm({
        name: '',
        description: '',
        routing_type: 'CLUSTER',
        grievance_cluster_id: clusters.length > 0 ? clusters[0].id : null,
        fixed_authority_id: authorities.length > 0 ? authorities[0].id : null,
        is_active: true,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setEditForm({
      name: category.name,
      description: category.description || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCategory) return;
    try {
      setIsSaving(true);
      const updated = await atharvaAdminService.updateCategory(editingCategory.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
      });
      setCategories((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? { ...c, name: updated.name, description: updated.description }
            : c
        )
      );
      setEditingCategory(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      setIsSaving(true);
      setDeleteError(null);
      await atharvaAdminService.deleteCategory(deletingCategory.id);
      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
      setDeletingCategory(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setIsSaving(false);
    }
  };

  const openSimulateModal = (catId?: string) => {
    setSimCategoryId(catId || (categories.length > 0 ? categories[0].id : ''));
    setSimSubjectId('');
    setSimResult(null);
    setSimError(null);
    setIsSimModalOpen(true);
  };

  const handleRunSimulation = async () => {
    if (!simCategoryId) {
      setSimError('Please select a grievance category to simulate.');
      return;
    }
    try {
      setSimLoading(true);
      setSimError(null);
      const res = await atharvaAdminService.simulateRouting({
        category_id: simCategoryId,
        subject_id: simSubjectId || null,
      });
      setSimResult(res);
    } catch (err: unknown) {
      setSimError(err instanceof Error ? err.message : 'Routing simulation failed');
    } finally {
      setSimLoading(false);
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

  const getSimStatusBadgeVariant = (status: string): 'primary' | 'teal' | 'saffron' | 'neutral' => {
    switch (status) {
      case 'ROUTED':
        return 'teal';
      case 'FALLBACK':
        return 'saffron';
      case 'AMBIGUOUS':
      case 'UNRESOLVED':
        return 'primary';
      default:
        return 'neutral';
    }
  };

  return (
    <AdminLayout activeTab="categories">

      {/* Official Categories Header Banner */}
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
        <div style={{ maxWidth: '820px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--vyasa-teal, #0d766e)',
              marginBottom: '3px',
            }}
          >
            NIVARAN Intake Architecture • Dynamic Routing Engine
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
            Grievance Category Taxonomy &amp; Dynamic Routing Engine Mappings
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', lineHeight: 1.55 }}>
            Categories define the subject matter of an applicant&apos;s grievance. Every category defines its
            routing path: <strong>CLUSTER</strong> (routes to configured Associate Dean),{' '}
            <strong>FIXED_AUTHORITY</strong> (routes directly to a specific institutional officer), or{' '}
            <strong>SUBJECT_ASSISTANT_DEAN</strong> (delegates to scholar&apos;s department Assistant Dean).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openSimulateModal()}
          >
            🔍 Simulate Routing Engine
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<AppIcon name="settings" size={14} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add Category
          </Button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid var(--vyasa-border, #e3dcd1)', boxShadow: 'var(--vyasa-shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--vyasa-primary, #0f2b48)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Total Categories
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)' }}>
            {stats.total}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Grievance types cataloged</span>
        </div>

        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid var(--vyasa-border, #e3dcd1)', boxShadow: 'var(--vyasa-shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: '#059669' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Active Categories
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: '#059669' }}>
            {stats.active}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Enabled for submission</span>
        </div>

        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid var(--vyasa-border, #e3dcd1)', boxShadow: 'var(--vyasa-shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--vyasa-teal, #0d766e)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Cluster Routing
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: 'var(--vyasa-teal, #0d766e)' }}>
            {stats.clusterRouted}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Associate Dean paths</span>
        </div>

        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid var(--vyasa-border, #e3dcd1)', boxShadow: 'var(--vyasa-shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--vyasa-gold, #b2811a)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Subject Routing
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: 'var(--vyasa-gold, #b2811a)' }}>
            {stats.subjectRouted}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Assistant Dean paths</span>
        </div>

        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid var(--vyasa-border, #e3dcd1)', boxShadow: 'var(--vyasa-shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--vyasa-saffron, #c85602)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Fixed Authority
          </span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 700, color: 'var(--vyasa-saffron, #c85602)' }}>
            {stats.fixedRouted}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>Direct officer paths</span>
        </div>
      </div>

      {/* Filters */}
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
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Category Name &amp; Description</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Routing Type</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Destination Authority / Target</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No categories matched the specified filters.
                    </td>
                  </tr>
                ) : (
                  paginatedCategories.map((cat) => (
                    <tr
                      key={cat.id}
                      style={{
                        borderBottom: '1px solid var(--vyasa-border-subtle, #f1f5f9)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)', fontSize: '14px' }}>
                          {cat.name}
                        </div>
                        {cat.description && (
                          <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #64748b)', marginTop: '2px' }}>
                            {cat.description}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <Badge variant={getRoutingTypeBadgeVariant(cat.routing_type)}>
                          {ROUTING_TYPE_DISPLAY[cat.routing_type] || cat.routing_type}
                        </Badge>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {cat.routing_type === 'SUBJECT_ASSISTANT_DEAN' ? (
                          <span style={{ color: 'var(--vyasa-gold, #b2811a)', fontWeight: 600, fontSize: '12.5px' }}>
                            🎓 Dynamic: Scholar&apos;s Subject Assistant Dean
                          </span>
                        ) : cat.routing_type === 'FIXED_AUTHORITY' ? (
                          cat.fixed_authority_name ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                {cat.fixed_authority_name}
                              </div>
                              {cat.fixed_authority_role && (
                                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                  Role: {cat.fixed_authority_role}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#dc2626', fontWeight: 500, fontSize: '12px' }}>
                              ⚠️ Unassigned Officer
                            </span>
                          )
                        ) : cat.cluster_name ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              Cluster #{cat.cluster_number}: {cat.cluster_name}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#dc2626', fontWeight: 500, fontSize: '12px' }}>
                            ⚠️ Unmapped Cluster
                          </span>
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
                            backgroundColor: cat.is_active ? '#ecfdf5' : '#fef2f2',
                            color: cat.is_active ? '#059669' : '#dc2626',
                            border: cat.is_active ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          }}
                        >
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: cat.is_active ? '#10b981' : '#ef4444',
                              display: 'inline-block',
                            }}
                          />
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openRouteModal(cat)}
                          >
                            Route
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openEditModal(cat)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openSimulateModal(cat.id)}
                          >
                            Simulate
                          </Button>
                          <Button
                            variant={cat.is_active ? 'outline' : 'primary'}
                            size="sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleToggleStatus(cat)}
                          >
                            {cat.is_active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              borderColor: 'var(--vyasa-danger-border, #fecaca)',
                              color: 'var(--vyasa-danger, #b91c1c)',
                            }}
                            onClick={() => {
                              setDeletingCategory(cat);
                              setDeleteError(null);
                            }}
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
                  {filteredCategories.length === 0
                    ? 0
                    : pageSize === 0
                    ? 1
                    : (currentPage - 1) * pageSize + 1}
                </strong>
                –
                <strong style={{ color: 'var(--vyasa-primary, #0f2b48)' }}>
                  {pageSize === 0
                    ? filteredCategories.length
                    : Math.min(currentPage * pageSize, filteredCategories.length)}
                </strong>{' '}
                of{' '}
                <strong style={{ color: 'var(--vyasa-primary, #0f2b48)' }}>
                  {filteredCategories.length}
                </strong>{' '}
                categories
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

      {/* Add Category Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Grievance Category"
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateCategory} disabled={isSaving}>
                {isSaving ? 'Creating...' : 'Create Category'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Category Name *
              </label>
              <Input
                placeholder="e.g. Delayed Examination Result"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Description
              </label>
              <Input
                placeholder="Scope and eligibility criteria..."
                value={addForm.description || ''}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Routing Strategy *
              </label>
              <Select
                options={[
                  { value: 'CLUSTER', label: 'Cluster -> Accountable Associate Dean' },
                  { value: 'SUBJECT_ASSISTANT_DEAN', label: 'Subject -> Department Assistant Dean' },
                  { value: 'FIXED_AUTHORITY', label: 'Fixed Statutory Officer' },
                ]}
                value={addForm.routing_type}
                onChange={(e) => setAddForm({ ...addForm, routing_type: e.target.value as CategoryRoutingType })}
              />
            </div>
            {(addForm.routing_type === 'CLUSTER' || addForm.routing_type === 'GRIEVANCE_CLUSTER') && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Target Grievance Cluster *
                </label>
                <Select
                  options={clusters.map((c) => ({
                    value: c.id,
                    label: `Cluster #${c.cluster_number}: ${c.name}`,
                  }))}
                  value={addForm.grievance_cluster_id || ''}
                  onChange={(e) => setAddForm({ ...addForm, grievance_cluster_id: e.target.value })}
                />
              </div>
            )}
            {addForm.routing_type === 'FIXED_AUTHORITY' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Target Statutory Authority *
                </label>
                <Select
                  options={authorities.map((a) => ({
                    value: a.id,
                    label: `${a.name_snapshot} (${a.role}) - ${a.department || 'General'}`,
                  }))}
                  value={addForm.fixed_authority_id || ''}
                  onChange={(e) => setAddForm({ ...addForm, fixed_authority_id: e.target.value })}
                />
              </div>
            )}
          </div>
        </Modal>
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
              <Button variant="primary" size="sm" onClick={handleSaveRoute} disabled={isSaving}>
                {isSaving ? 'Updating...' : 'Save Routing Matrix'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, fontSize: '13.5px' }}>
              Configure how grievances under <strong>{selectedCategory.name}</strong> are evaluated and dispatched by the central intake engine.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Routing Strategy
              </label>
              <Select
                options={[
                  { value: 'CLUSTER', label: 'Cluster -> Accountable Associate Dean' },
                  { value: 'SUBJECT_ASSISTANT_DEAN', label: 'Subject -> Department Assistant Dean' },
                  { value: 'FIXED_AUTHORITY', label: 'Fixed Statutory Officer' },
                ]}
                value={selectedRoutingType}
                onChange={(e) => setSelectedRoutingType(e.target.value as CategoryRoutingType)}
              />
            </div>
            {(selectedRoutingType === 'CLUSTER' || selectedRoutingType === 'GRIEVANCE_CLUSTER') && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Target Grievance Cluster
                </label>
                <Select
                  options={clusters.map((c) => ({
                    value: c.id,
                    label: `Cluster #${c.cluster_number}: ${c.name} (${c.associate_dean ? c.associate_dean.name_snapshot : 'No Dean'})`,
                  }))}
                  value={selectedClusterId}
                  onChange={(e) => setSelectedClusterId(e.target.value)}
                />
              </div>
            )}
            {selectedRoutingType === 'FIXED_AUTHORITY' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Target Fixed Authority
                </label>
                <Select
                  options={authorities.map((a) => ({
                    value: a.id,
                    label: `${a.name_snapshot} (${a.role}) - ${a.department || 'General'}`,
                  }))}
                  value={selectedAuthorityId}
                  onChange={(e) => setSelectedAuthorityId(e.target.value)}
                />
              </div>
            )}
            {selectedRoutingType === 'SUBJECT_ASSISTANT_DEAN' && (
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
                <strong>Dynamic Scholar Delegation:</strong> Cases will resolve the applicant&apos;s registered academic discipline,
                map to its faculty Subject Cluster, and dispatch to the designated Assistant Dean.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <Modal
          isOpen={true}
          onClose={() => setEditingCategory(null)}
          title={`Edit Category: ${editingCategory.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setEditingCategory(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Category Name
              </label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Description
              </label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Category Modal */}
      {deletingCategory && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingCategory(null)}
          title={`Delete Category: ${deletingCategory.name}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeletingCategory(null);
                  setDeleteError(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                style={{ backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#dc2626' }}
                onClick={handleDeleteCategory}
                disabled={isSaving}
              >
                {isSaving ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {deleteError && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '13px',
                }}
              >
                <strong>Deletion Blocked:</strong> {deleteError}
              </div>
            )}
            <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
              Are you sure you want to delete category <strong>{deletingCategory.name}</strong>?
            </p>
            <div
              style={{
                padding: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12.5px',
                color: '#64748b',
                lineHeight: 1.5,
              }}
            >
              <strong>Safety Guard:</strong> Categories associated with active or historical grievances cannot be permanently deleted.
              Disable the category instead to prevent future submissions.
            </div>
          </div>
        </Modal>
      )}

      {/* Simulation Modal */}
      {isSimModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsSimModalOpen(false)}
          title="Dynamic Routing Simulation & Decision Path Inspector"
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setIsSimModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" size="sm" onClick={handleRunSimulation} disabled={simLoading}>
                {simLoading ? 'Simulating...' : 'Run Simulation'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              Dry-run the complete routing pipeline against current taxonomy state to audit whether
              a grievance will reach its target authority or trigger fallback logic.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Test Grievance Category *
                </label>
                <Select
                  options={categories.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.routing_type})`,
                  }))}
                  value={simCategoryId}
                  onChange={(e) => setSimCategoryId(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Applicant Academic Subject (Optional)
                </label>
                <Select
                  options={[
                    { value: '', label: '-- None / Not Applicable --' },
                    ...subjects.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${s.cluster_name || 'No Cluster'})`,
                    })),
                  ]}
                  value={simSubjectId}
                  onChange={(e) => setSimSubjectId(e.target.value)}
                />
              </div>
            </div>

            {simError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '13px',
                }}
              >
                {simError}
              </div>
            )}

            {simResult && (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>Simulation Result:</span>
                    <Badge variant={getSimStatusBadgeVariant(simResult.status)}>
                      {simResult.status}
                    </Badge>
                  </div>
                  {simResult.fallback_used && (
                    <Badge variant="saffron">Fallback Active</Badge>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Target Authority</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                      {simResult.target_authority_name || 'Unassigned / Escrow'}
                    </div>
                    {simResult.target_authority_role && (
                      <div style={{ fontSize: '11px', color: '#475569' }}>
                        Role: {simResult.target_authority_role}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Resolved Cluster</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                      {simResult.cluster_name ? `#${simResult.cluster_number}: ${simResult.cluster_name}` : 'Direct Routing (No Cluster)'}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 600, color: '#334155', fontSize: '13px', marginBottom: '6px' }}>
                    Decision Path Traced:
                  </div>
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    {simResult.path_taken.map((step, idx) => (
                      <div key={idx} style={{ color: '#1e293b' }}>
                        &rarr; {step}
                      </div>
                    ))}
                  </div>
                </div>

                {simResult.warnings.length > 0 && (
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fef3c7',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#92400e',
                    }}
                  >
                    <strong>Routing Warnings:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                      {simResult.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
