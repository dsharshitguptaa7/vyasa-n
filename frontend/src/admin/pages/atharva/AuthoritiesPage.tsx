import React, { useEffect, useState, useMemo, useRef } from 'react';
import { LoadingState, Button, Modal, Input, Select, AppIcon, CsjmuLogo } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import { Authority, NivaranRole, CreateAuthorityPayload, UpdateAuthorityPayload } from '../../types/atharva';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  DEAN: 'Dean',
  ASSOCIATE_DEAN: 'Associate Dean',
  ASSISTANT_DEAN: 'Assistant Dean',
  MANAGER: 'Manager',
  GUEST_MEMBER: 'Guest Member',
  SUPERADMIN: 'Super Admin',
};

export const AuthoritiesPage: React.FC = () => {
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Checkbox row selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Row dropdown menu state (for ⋮ more actions)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Pagination state: default 10 per page matching screenshot reference
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Status toggle confirmation modal state
  const [pendingAuthority, setPendingAuthority] = useState<Authority | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Add Authority Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<CreateAuthorityPayload>({
    name: '',
    email: '',
    role: 'ASSISTANT_DEAN',
    designation: '',
    department: '',
    phone: '',
    is_active: true,
  });

  // Edit Authority Modal State
  const [editingAuthority, setEditingAuthority] = useState<Authority | null>(null);
  const [editForm, setEditForm] = useState<UpdateAuthorityPayload>({});

  // Transfer Assignments Modal State
  const [transferSource, setTransferSource] = useState<Authority | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string>('');

  // Delete Confirmation Modal State
  const [deletingAuthority, setDeletingAuthority] = useState<Authority | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchAuthorities = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await atharvaAdminService.getAuthorities();
      setAuthorities(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch authorities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthorities();
  }, []);

  // Close row popup menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, departmentFilter, statusFilter, searchQuery]);

  // Unique departments for filter dropdown
  const departmentOptions = useMemo(() => {
    const depts = new Set<string>();
    authorities.forEach((a) => {
      if (a.department && a.department.trim()) {
        depts.add(a.department.trim());
      }
    });
    return Array.from(depts).sort();
  }, [authorities]);

  const filteredAuthorities = useMemo(() => {
    return authorities.filter((auth) => {
      if (roleFilter && auth.role !== roleFilter) return false;
      if (departmentFilter && auth.department !== departmentFilter) return false;
      if (statusFilter === 'active' && !auth.is_active) return false;
      if (statusFilter === 'inactive' && auth.is_active) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = auth.name_snapshot.toLowerCase().includes(q);
        const matchesEmail = auth.email_snapshot.toLowerCase().includes(q);
        const matchesDesig = auth.designation?.toLowerCase().includes(q) ?? false;
        const matchesDept = auth.department?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesEmail && !matchesDesig && !matchesDept) return false;
      }
      return true;
    });
  }, [authorities, roleFilter, departmentFilter, statusFilter, searchQuery]);

  // Paginated records
  const paginatedAuthorities = useMemo(() => {
    if (pageSize === 0) return filteredAuthorities; // 'All' option
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAuthorities.slice(startIndex, startIndex + pageSize);
  }, [filteredAuthorities, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(filteredAuthorities.length / pageSize));
  }, [filteredAuthorities.length, pageSize]);

  const stats = useMemo(() => {
    const total = authorities.length;
    const active = authorities.filter((a) => a.is_active).length;
    const roleCounts: Record<string, number> = {};
    authorities.forEach((a) => {
      roleCounts[a.role] = (roleCounts[a.role] || 0) + 1;
    });
    return { total, active, roleCounts };
  }, [authorities]);

  const activePercentage = useMemo(() => {
    if (stats.total === 0) return 100;
    return Math.round((stats.active / stats.total) * 100);
  }, [stats.active, stats.total]);

  // Checkbox bulk selection helpers
  const isAllSelected = useMemo(() => {
    if (paginatedAuthorities.length === 0) return false;
    return paginatedAuthorities.every((a) => selectedIds.has(a.id));
  }, [paginatedAuthorities, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      paginatedAuthorities.forEach((a) => next.add(a.id));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleConfirmToggle = async () => {
    if (!pendingAuthority) return;
    try {
      setIsUpdating(true);
      const newStatus = !pendingAuthority.is_active;
      const updated = await atharvaAdminService.updateAuthorityStatus(pendingAuthority.id, newStatus);
      setAuthorities((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a))
      );
      setPendingAuthority(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update authority status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateAuthority = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.email.trim()) {
      alert('Name and Email are required.');
      return;
    }
    try {
      setIsUpdating(true);
      const created = await atharvaAdminService.createAuthority(addForm);
      setAuthorities((prev) => [...prev, created]);
      setIsAddModalOpen(false);
      setAddForm({
        name: '',
        email: '',
        role: 'ASSISTANT_DEAN',
        designation: '',
        department: '',
        phone: '',
        is_active: true,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to provision authority');
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditModal = (auth: Authority) => {
    setEditingAuthority(auth);
    setEditForm({
      name: auth.name_snapshot,
      email: auth.email_snapshot,
      role: auth.role,
      designation: auth.designation || '',
      department: auth.department || '',
      phone: auth.phone_snapshot || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingAuthority) return;
    try {
      setIsUpdating(true);
      const updated = await atharvaAdminService.updateAuthority(editingAuthority.id, editForm);
      setAuthorities((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a))
      );
      setEditingAuthority(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update authority');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTransferAssignments = async () => {
    if (!transferSource || !transferTargetId) return;
    try {
      setIsUpdating(true);
      await atharvaAdminService.transferAuthority(transferSource.id, transferTargetId);
      setTransferSource(null);
      setTransferTargetId('');
      fetchAuthorities();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to transfer assignments');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAuthority = async () => {
    if (!deletingAuthority) return;
    try {
      setIsUpdating(true);
      setDeleteError(null);
      await atharvaAdminService.deleteAuthority(deletingAuthority.id);
      setAuthorities((prev) => prev.filter((a) => a.id !== deletingAuthority.id));
      setDeletingAuthority(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete authority');
    } finally {
      setIsUpdating(false);
    }
  };

  const getInitials = (name: string): string => {
    const cleaned = name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return 'AU';
  };

  const getAvatarPalette = (_role: NivaranRole, name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorOptions = [
      { bg: '#dbeafe', text: '#1d4ed8' }, // Light Blue
      { bg: '#dcfce7', text: '#15803d' }, // Light Emerald
      { bg: '#fef3c7', text: '#b45309' }, // Light Amber
      { bg: '#f3e8ff', text: '#7e22ce' }, // Light Purple
      { bg: '#fee2e2', text: '#b91c1c' }, // Light Coral
      { bg: '#ccfbf1', text: '#0f766e' }, // Light Teal
    ];
    const index = Math.abs(hash) % colorOptions.length;
    return colorOptions[index];
  };

  const getRoleBadgeStyle = (role: NivaranRole) => {
    switch (role) {
      case 'DEAN':
        return {
          bg: '#ffedd5',
          text: '#c2410c',
          border: '1px solid #fed7aa',
        };
      case 'ASSOCIATE_DEAN':
        return {
          bg: '#ccfbf1',
          text: '#0f766e',
          border: '1px solid #99f6e4',
        };
      case 'ASSISTANT_DEAN':
        return {
          bg: '#fef3c7',
          text: '#b45309',
          border: '1px solid #fde68a',
        };
      case 'MANAGER':
        return {
          bg: '#f3e8ff',
          text: '#7e22ce',
          border: '1px solid #e9d5ff',
        };
      default:
        return {
          bg: '#f1f5f9',
          text: '#475569',
          border: '1px solid #cbd5e1',
        };
    }
  };

  return (
    <AdminLayout activeTab="authorities" onAddAuthority={() => setIsAddModalOpen(true)}>
      {/* 1. Official Directory Top Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '16px',
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 43, 72, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              padding: '6px',
              backgroundColor: '#ffffff',
              border: '1.5px solid var(--vyasa-gold-border, #ecdfba)',
              borderRadius: '50%',
              boxShadow: '0 2px 6px rgba(178, 129, 26, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CsjmuLogo size={42} />
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '2px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--vyasa-gold, #b2811a)',
                }}
              >
                Chhatrapati Shahu Ji Maharaj University, Kanpur
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--vyasa-teal, #0d766e)',
                }}
              >
                Atharva Veda Governance
              </span>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--vyasa-primary, #0f2b48)',
                letterSpacing: '-0.01em',
                lineHeight: 1.25,
                fontFamily: 'var(--vyasa-font-sans)',
              }}
            >
              Institutional Authorities &amp; Administrative Officers
            </h1>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: '12.5px',
                color: '#64748b',
                lineHeight: 1.4,
              }}
            >
              Authorized roster of Deans, Associate Deans, Assistant Deans and Grievance Managers under University Statute No. 14.
            </p>
          </div>
        </div>

        {/* Header Right Actions: Session Selector & + Add Authority */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12.5px',
              color: '#475569',
              fontWeight: 500,
            }}
          >
            <AppIcon name="clock" size={14} color="#64748b" />
            <span>Session:</span>
            <strong style={{ color: '#0f2b48' }}>2026–27</strong>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>⌵</span>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#b2811a',
              border: '1px solid #996e14',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(178, 129, 26, 0.25)',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#9e7115')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#b2811a')}
          >
            <span>+ Add Authority</span>
          </button>
        </div>
      </div>

      {/* 2. Telemetry Stat Cards in a single responsive row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Total Authorities */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="users" size={15} color="#2563eb" />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Total Authorities
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f2b48', lineHeight: 1.2 }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Registered officers
          </div>
        </div>

        {/* Active Authorities (with circular % progress ring) */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="check-circle" size={15} color="#10b981" />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Active Authorities
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
              {stats.active}
            </div>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '2px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                color: '#059669',
              }}
              title={`${activePercentage}% active`}
            >
              {activePercentage}%
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Operational status
          </div>
        </div>

        {/* Deans */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#fff7ed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="graduation-cap" size={15} color="#ea580c" />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Deans
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ea580c', lineHeight: 1.2 }}>
            {stats.roleCounts['DEAN'] || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Executive leadership
          </div>
        </div>

        {/* Associate Deans */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="shield" size={15} color="#2563eb" />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Associate Deans
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563eb', lineHeight: 1.2 }}>
            {stats.roleCounts['ASSOCIATE_DEAN'] || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Grievance clusters
          </div>
        </div>

        {/* Assistant Deans */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#fffbeb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="book-open" size={15} color="#d97706" />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Assistant Deans
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', lineHeight: 1.2 }}>
            {stats.roleCounts['ASSISTANT_DEAN'] || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Subject clusters
          </div>
        </div>

        {/* Managers */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#f5f3ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="settings" size={15} color="#9333ea" />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Managers
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#9333ea', lineHeight: 1.2 }}>
            {stats.roleCounts['MANAGER'] || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Triage &amp; operations
          </div>
        </div>
      </div>

      {/* 3. Unified Search & Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '16px',
          backgroundColor: '#ffffff',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
        }}
      >
        {/* Search Input with Search Icon */}
        <div
          style={{
            flex: '1 1 280px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
          }}
        >
          <AppIcon name="search" size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by name, email, designation, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '13px',
              color: '#1e293b',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '12px',
                padding: '0 2px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Role Filter */}
        <div style={{ width: '150px' }}>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              fontSize: '12.5px',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="">All Roles</option>
            <option value="DEAN">Dean</option>
            <option value="ASSOCIATE_DEAN">Associate Dean</option>
            <option value="ASSISTANT_DEAN">Assistant Dean</option>
            <option value="MANAGER">Manager</option>
            <option value="GUEST_MEMBER">Guest Member</option>
          </select>
        </div>

        {/* Department Filter */}
        <div style={{ width: '170px' }}>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              fontSize: '12.5px',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="">All Departments</option>
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ width: '130px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              fontSize: '12.5px',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        {/* More Filters / Reset */}
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setRoleFilter('');
            setDepartmentFilter('');
            setStatusFilter('');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '12.5px',
            color: '#475569',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <AppIcon name="settings" size={14} color="#64748b" />
          <span>More Filters</span>
          {(roleFilter || departmentFilter || statusFilter || searchQuery) && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#b2811a',
              }}
            />
          )}
        </button>
      </div>

      {/* 4. Authorities Data Table */}
      {loading ? (
        <LoadingState message="Loading institutional authority records..." />
      ) : errorMsg ? (
        <div
          style={{
            padding: '24px',
            backgroundColor: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '8px',
            color: '#991b1b',
          }}
        >
          {errorMsg}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f8fafc',
                    borderBottom: '1.5px solid #e2e8f0',
                    color: '#64748b',
                    fontSize: '11.5px',
                    letterSpacing: '0.04em',
                    fontWeight: 600,
                  }}
                >
                  <th style={{ padding: '12px 14px', width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      aria-label="Select all authorities"
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>
                    <span>Authority</span> <span style={{ color: '#94a3b8' }}>⇕</span>
                  </th>
                  <th style={{ padding: '12px 14px' }}>
                    <span>Role</span> <span style={{ color: '#94a3b8' }}>⇕</span>
                  </th>
                  <th style={{ padding: '12px 14px' }}>
                    <span>Designation &amp; Department</span> <span style={{ color: '#94a3b8' }}>⇕</span>
                  </th>
                  <th style={{ padding: '12px 14px' }}>
                    <span>Subjects / Clusters</span> <span style={{ color: '#94a3b8' }}>⇕</span>
                  </th>
                  <th style={{ padding: '12px 14px' }}>
                    <span>Status</span> <span style={{ color: '#94a3b8' }}>⇕</span>
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuthorities.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No institutional authorities matched the specified filters.
                    </td>
                  </tr>
                ) : (
                  paginatedAuthorities.map((auth) => {
                    const avatarStyle = getAvatarPalette(auth.role, auth.name_snapshot);
                    const roleBadge = getRoleBadgeStyle(auth.role);
                    const isSelected = selectedIds.has(auth.id);

                    return (
                      <tr
                        key={auth.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                          transition: 'background-color 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#fafaf9';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(auth.id)}
                            aria-label={`Select ${auth.name_snapshot}`}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        {/* Authority (Initials Avatar Circle + Name + Email) */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: avatarStyle.bg,
                                color: avatarStyle.text,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(auth.name_snapshot)}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--vyasa-primary, #0f2b48)',
                                  fontSize: '13.5px',
                                  lineHeight: 1.25,
                                }}
                              >
                                {auth.name_snapshot}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                                {auth.email_snapshot}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2.5px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              letterSpacing: '0.03em',
                              backgroundColor: roleBadge.bg,
                              color: roleBadge.text,
                              border: roleBadge.border,
                            }}
                          >
                            {ROLE_DISPLAY_NAMES[auth.role] || auth.role}
                          </span>
                        </td>

                        {/* Designation & Department */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <div style={{ color: '#1e293b', fontWeight: 500, fontSize: '13px' }}>
                            {auth.designation || '—'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                            {auth.department || '—'}
                          </div>
                        </td>

                        {/* Subjects / Clusters */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          {auth.role === 'ASSISTANT_DEAN' ? (
                            <div>
                              <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 500 }}>
                                5 Subjects
                              </div>
                              <div style={{ fontSize: '11px', color: '#2563eb' }}>
                                2 Clusters
                              </div>
                            </div>
                          ) : auth.role === 'ASSOCIATE_DEAN' ? (
                            <div>
                              <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 500 }}>
                                3 Categories
                              </div>
                              <div style={{ fontSize: '11px', color: '#2563eb' }}>
                                1 Cluster
                              </div>
                            </div>
                          ) : auth.role === 'DEAN' ? (
                            <div>
                              <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 500 }}>
                                8 Subjects
                              </div>
                              <div style={{ fontSize: '11px', color: '#2563eb' }}>
                                4 Clusters
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '2.5px 8px',
                              borderRadius: '9999px',
                              backgroundColor: auth.is_active ? '#ecfdf5' : '#f1f5f9',
                              color: auth.is_active ? '#047857' : '#64748b',
                              border: auth.is_active ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: auth.is_active ? '#10b981' : '#94a3b8',
                                display: 'inline-block',
                              }}
                            />
                            {auth.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '6px',
                              position: 'relative',
                            }}
                          >
                            {/* Compact Edit Button ✎ */}
                            <button
                              type="button"
                              title="Edit Authority"
                              aria-label={`Edit ${auth.name_snapshot}`}
                              onClick={() => openEditModal(auth)}
                              style={{
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                color: '#475569',
                                cursor: 'pointer',
                                fontSize: '13px',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f1f5f9';
                                e.currentTarget.style.color = '#0f2b48';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.color = '#475569';
                              }}
                            >
                              ✎
                            </button>

                            {/* Direct Status Toggle (Preserves accessibility for unit tests & instant deactivation) */}
                            <Button
                              variant="outline"
                              size="sm"
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                height: '28px',
                                borderRadius: '6px',
                                color: auth.is_active ? '#b91c1c' : '#047857',
                                borderColor: auth.is_active ? '#fca5a5' : '#a7f3d0',
                                backgroundColor: auth.is_active ? '#fff5f5' : '#f0fdf4',
                              }}
                              onClick={() => setPendingAuthority(auth)}
                            >
                              {auth.is_active ? 'Deactivate' : 'Activate'}
                            </Button>

                            {/* More Actions Dropdown Trigger ⋮ */}
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                title="More Actions"
                                aria-label={`More actions for ${auth.name_snapshot}`}
                                onClick={() => setOpenMenuId(openMenuId === auth.id ? null : auth.id)}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  color: '#475569',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#ffffff';
                                }}
                              >
                                ⋮
                              </button>

                              {/* Dropdown Menu Popup */}
                              {openMenuId === auth.id && (
                                <div
                                  ref={menuRef}
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '32px',
                                    width: '180px',
                                    backgroundColor: '#ffffff',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                    zIndex: 60,
                                    padding: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTransferSource(auth);
                                      setTransferTargetId('');
                                      setOpenMenuId(null);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '7px 10px',
                                      fontSize: '12px',
                                      color: '#334155',
                                      border: 'none',
                                      background: 'none',
                                      width: '100%',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      borderRadius: '4px',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <AppIcon name="layers" size={13} color="#64748b" />
                                    <span>Transfer Assignments</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeletingAuthority(auth);
                                      setDeleteError(null);
                                      setOpenMenuId(null);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '7px 10px',
                                      fontSize: '12px',
                                      color: '#dc2626',
                                      border: 'none',
                                      background: 'none',
                                      width: '100%',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      borderRadius: '4px',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <AppIcon name="close" size={13} color="#dc2626" />
                                    <span>Delete Authority</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 5. Pagination Bar matching Reference */}
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12.5px',
              color: '#64748b',
            }}
          >
            {/* Left: Telemetry text */}
            <div>
              Showing{' '}
              <strong style={{ color: '#0f2b48' }}>
                {filteredAuthorities.length === 0
                  ? 0
                  : pageSize === 0
                  ? 1
                  : (currentPage - 1) * pageSize + 1}
              </strong>
              –
              <strong style={{ color: '#0f2b48' }}>
                {pageSize === 0
                  ? filteredAuthorities.length
                  : Math.min(currentPage * pageSize, filteredAuthorities.length)}
              </strong>{' '}
              of{' '}
              <strong style={{ color: '#0f2b48' }}>
                {filteredAuthorities.length}
              </strong>{' '}
              authorities
            </div>

            {/* Center: Pagination numbers with prev/next */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: currentPage <= 1 ? '#cbd5e1' : '#334155',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                }}
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .slice(0, 6)
                .map((pageNum) => {
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        minWidth: '28px',
                        height: '28px',
                        padding: '0 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isActive ? '1px solid #0f2b48' : '1px solid transparent',
                        borderRadius: '6px',
                        backgroundColor: isActive ? '#0f2b48' : 'transparent',
                        color: isActive ? '#ffffff' : '#334155',
                        fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer',
                        fontSize: '12.5px',
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}

              {totalPages > 6 && <span style={{ padding: '0 4px', color: '#94a3b8' }}>…</span>}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: currentPage >= totalPages ? '#cbd5e1' : '#334155',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                }}
              >
                ›
              </button>
            </div>

            {/* Right: Per-page dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '12px',
                  color: '#0f2b48',
                  cursor: 'pointer',
                }}
              >
                <option value={10}>10 per page</option>
                <option value={15}>15 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={0}>All</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Add Authority Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title="Provision Institutional Authority"
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateAuthority} disabled={isUpdating}>
                {isUpdating ? 'Provisioning...' : 'Provision Authority'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Officer Name *
              </label>
              <Input
                placeholder="e.g. Prof. Rajesh Kumar"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Institutional Email *
              </label>
              <Input
                type="email"
                placeholder="e.g. rajesh.kumar@csjmu.ac.in"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                System Role *
              </label>
              <Select
                options={[
                  { value: 'ASSISTANT_DEAN', label: 'Assistant Dean (Academic Disciplines)' },
                  { value: 'ASSOCIATE_DEAN', label: 'Associate Dean (Grievance Clusters)' },
                  { value: 'DEAN', label: 'Dean (Supreme Research & Development)' },
                  { value: 'MANAGER', label: 'Manager (Grievance Triage & Operations)' },
                  { value: 'GUEST_MEMBER', label: 'Guest Member (External Expert / Reviewer)' },
                ]}
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value as NivaranRole })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Designation
                </label>
                <Input
                  placeholder="e.g. Associate Professor"
                  value={addForm.designation || ''}
                  onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Department
                </label>
                <Input
                  placeholder="e.g. Department of Physics"
                  value={addForm.department || ''}
                  onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Contact Phone
              </label>
              <Input
                placeholder="e.g. +91 9876543210"
                value={addForm.phone || ''}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Authority Modal */}
      {editingAuthority && (
        <Modal
          isOpen={true}
          onClose={() => setEditingAuthority(null)}
          title={`Edit Authority: ${editingAuthority.name_snapshot}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setEditingAuthority(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Name
              </label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Institutional Email
              </label>
              <Input
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                System Role
              </label>
              <Select
                options={[
                  { value: 'ASSISTANT_DEAN', label: 'Assistant Dean' },
                  { value: 'ASSOCIATE_DEAN', label: 'Associate Dean' },
                  { value: 'DEAN', label: 'Dean' },
                  { value: 'MANAGER', label: 'Manager' },
                  { value: 'GUEST_MEMBER', label: 'Guest Member' },
                ]}
                value={editForm.role || ''}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as NivaranRole })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Designation
                </label>
                <Input
                  value={editForm.designation || ''}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                  Department
                </label>
                <Input
                  value={editForm.department || ''}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Phone
              </label>
              <Input
                value={editForm.phone || ''}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Transfer Assignments Modal */}
      {transferSource && (
        <Modal
          isOpen={true}
          onClose={() => setTransferSource(null)}
          title={`Transfer Assignments: ${transferSource.name_snapshot}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setTransferSource(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleTransferAssignments} disabled={isUpdating || !transferTargetId}>
                {isUpdating ? 'Transferring...' : 'Execute Transfer'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>
              Select an active replacement authority to receive all Subject Clusters, Grievance Clusters,
              and Fixed Category routing assignments currently held by <strong>{transferSource.name_snapshot}</strong>.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
                Replacement Authority *
              </label>
              <Select
                options={[
                  { value: '', label: '-- Select Active Replacement Officer --' },
                  ...authorities
                    .filter((a) => a.id !== transferSource.id && a.is_active && (a.role === transferSource.role || a.role === 'DEAN'))
                    .map((a) => ({
                      value: a.id,
                      label: `${a.name_snapshot} (${a.role}) - ${a.department || 'General'}`,
                    })),
                ]}
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Authority Modal */}
      {deletingAuthority && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingAuthority(null)}
          title={`Delete Authority: ${deletingAuthority.name_snapshot}`}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setDeletingAuthority(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                onClick={handleDeleteAuthority}
                disabled={isUpdating}
              >
                {isUpdating ? 'Checking references...' : 'Confirm Permanent Deletion'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete authority <strong>{deletingAuthority.name_snapshot}</strong>?
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
              <strong>Safety Guard:</strong> Deletion is only permitted if this authority has zero associated cluster mappings,
              routing rules, or historical grievances. If referenced, deletion will be blocked and you will be advised to deactivate instead.
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

      {/* Confirmation Toggle Modal */}
      {pendingAuthority && (
        <Modal
          isOpen={true}
          onClose={() => setPendingAuthority(null)}
          title={pendingAuthority.is_active ? 'Deactivate Authority' : 'Activate Authority'}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setPendingAuthority(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                variant={pendingAuthority.is_active ? 'outline' : 'primary'}
                size="sm"
                onClick={handleConfirmToggle}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : pendingAuthority.is_active ? 'Confirm Deactivation' : 'Confirm Activation'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>
              Are you sure you want to {pendingAuthority.is_active ? 'deactivate' : 'activate'}{' '}
              <strong>{pendingAuthority.name_snapshot}</strong> ({pendingAuthority.role})?
            </p>
            {pendingAuthority.is_active && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '6px',
                  color: '#92400e',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                <strong>Warning:</strong> If this officer is currently assigned as an Assistant Dean or
                Associate Dean to active clusters, future grievance routing to those clusters will fail
                validation until a new active officer is re-mapped.
              </div>
            )}
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              This administrative action is logged to the Core audit trail with timestamp and administrator identity.
            </p>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
