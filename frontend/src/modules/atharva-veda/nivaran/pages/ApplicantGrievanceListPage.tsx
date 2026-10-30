import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingState, Button, Modal, AppIcon } from '@vyasa/ui';
import { useAuth } from '../../../../context/AuthContext';
import { ApplicantLayout } from '../../../../features/applicant';
import { grievanceService } from '../services/grievanceService';
import { GrievanceSummaryItem } from '../types/grievance';

export const ApplicantGrievanceListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, displayName } = useAuth();

  const [grievances, setGrievances] = useState<GrievanceSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Pagination state (default 10 matching screenshot reference)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row dropdown menu state (for ⋮ more actions)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Interactive Modals
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    async function loadGrievances() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await grievanceService.getMyGrievances();
        setGrievances(data || []);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load grievances.');
      } finally {
        setLoading(false);
      }
    }
    loadGrievances();
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
  }, [searchQuery, statusFilter, categoryFilter, sessionFilter, dateRange]);

  // Dynamic unique categories from applicant grievances
  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    grievances.forEach((g) => {
      const c = g.final_category_name || g.category_name;
      if (c && c.trim()) cats.add(c.trim());
    });
    return Array.from(cats).sort();
  }, [grievances]);

  // Telemetry KPI summary metrics
  const telemetry = useMemo(() => {
    const total = grievances.length;

    const inProgress = grievances.filter((g) =>
      ['SUBMITTED', 'AI_PROCESSING', 'PENDING_REVIEW', 'ASSIGNED', 'UNDER_INVESTIGATION'].includes(g.status)
    ).length;

    const resolved = grievances.filter((g) =>
      ['RESOLVED', 'CLOSED'].includes(g.status)
    ).length;

    const actionRequired = grievances.filter((g) =>
      ['CLARIFICATION_REQUESTED', 'FEEDBACK_REQUIRED', 'REOPENED', 'APPEALED'].includes(g.status)
    ).length;

    return { total, inProgress, resolved, actionRequired };
  }, [grievances]);

  // Filtered grievances list
  const filteredGrievances = useMemo(() => {
    return grievances.filter((item) => {
      // Status filter
      if (statusFilter) {
        if (statusFilter === 'in_progress') {
          if (!['SUBMITTED', 'AI_PROCESSING', 'PENDING_REVIEW', 'ASSIGNED', 'UNDER_INVESTIGATION'].includes(item.status)) {
            return false;
          }
        } else if (statusFilter === 'resolved') {
          if (!['RESOLVED', 'CLOSED'].includes(item.status)) return false;
        } else if (statusFilter === 'action_required') {
          if (!['CLARIFICATION_REQUESTED', 'FEEDBACK_REQUIRED', 'REOPENED', 'APPEALED'].includes(item.status)) {
            return false;
          }
        } else if (item.status !== statusFilter) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter) {
        const cat = item.final_category_name || item.category_name;
        if (cat !== categoryFilter) return false;
      }

      // Session filter
      if (sessionFilter && sessionFilter === '2026-27') {
        const year = new Date(item.created_at).getFullYear();
        if (year !== 2026 && year !== 2027) return false;
      }

      // Date range filter
      if (dateRange.start) {
        const itemDate = new Date(item.created_at).getTime();
        const startDate = new Date(dateRange.start).getTime();
        if (itemDate < startDate) return false;
      }
      if (dateRange.end) {
        const itemDate = new Date(item.created_at).getTime();
        const endDate = new Date(dateRange.end).getTime() + 86400000;
        if (itemDate > endDate) return false;
      }

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = item.grievance_id?.toLowerCase().includes(q) ?? false;
        const matchTitle = item.title?.toLowerCase().includes(q) ?? false;
        const matchSubject = item.subject_name?.toLowerCase().includes(q) ?? false;
        const matchCat = (item.final_category_name || item.category_name)?.toLowerCase().includes(q) ?? false;
        const matchAuth = item.assigned_authority_name?.toLowerCase().includes(q) ?? false;
        if (!matchId && !matchTitle && !matchSubject && !matchCat && !matchAuth) return false;
      }

      return true;
    });
  }, [grievances, statusFilter, categoryFilter, sessionFilter, dateRange, searchQuery]);

  // Paginated records
  const paginatedGrievances = useMemo(() => {
    if (pageSize === 0) return filteredGrievances;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredGrievances.slice(startIndex, startIndex + pageSize);
  }, [filteredGrievances, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(filteredGrievances.length / pageSize));
  }, [filteredGrievances.length, pageSize]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2.5px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#fefce8',
              color: '#a16207',
              border: '1px solid #fef08a',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ca8a04' }} />
            SUBMITTED
          </span>
        );
      case 'AI_PROCESSING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2.5px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
            AI Processing
          </span>
        );
      case 'PENDING_REVIEW':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2.5px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fde68a',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            Pending Review
          </span>
        );
      case 'ASSIGNED':
      case 'UNDER_INVESTIGATION':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2.5px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            ASSIGNED
          </span>
        );
      case 'RESOLVED':
      case 'CLOSED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2.5px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            {status}
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2.5px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
            }}
          >
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span
            style={{
              padding: '2.5px 7px',
              borderRadius: '4px',
              fontSize: '10.5px',
              fontWeight: 700,
              color: '#dc2626',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
            }}
          >
            URGENT
          </span>
        );
      case 'HIGH':
        return (
          <span
            style={{
              padding: '2.5px 7px',
              borderRadius: '4px',
              fontSize: '10.5px',
              fontWeight: 700,
              color: '#ea580c',
              backgroundColor: '#ffedd5',
              border: '1px solid #fed7aa',
            }}
          >
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span
            style={{
              padding: '2.5px 7px',
              borderRadius: '4px',
              fontSize: '10.5px',
              fontWeight: 700,
              color: '#b45309',
              backgroundColor: '#fef3c7',
              border: '1px solid #fde68a',
            }}
          >
            MEDIUM
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '2.5px 7px',
              borderRadius: '4px',
              fontSize: '10.5px',
              fontWeight: 600,
              color: '#475569',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
            }}
          >
            {priority}
          </span>
        );
    }
  };

  return (
    <ApplicantLayout
      activeTab="my-grievances"
      onOpenProfile={() => navigate('/profile')}
      onOpenHelp={() => setIsHelpModalOpen(true)}
    >
      {/* Stately Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#64748b',
          marginBottom: '18px',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
          <span>Dashboard</span>
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <span style={{ color: '#64748b', fontWeight: 500 }}>My Grievances</span>
      </nav>

      {/* 2. Grievance Summary / KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        {/* Total Grievances */}
        <div
          onClick={() => setStatusFilter('')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '14px 16px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#93c5fd')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="file-text" size={16} color="#2563eb" />
            </div>
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              ›
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f2b48', lineHeight: 1.2 }}>
            {telemetry.total}
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
            Total Grievances
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>All submitted requests</div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => setStatusFilter('in_progress')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '14px 16px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#fde68a')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#fffbeb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="clock" size={16} color="#d97706" />
            </div>
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              ›
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', lineHeight: 1.2 }}>
            {telemetry.inProgress}
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
            In Progress
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Under review/processing</div>
        </div>

        {/* Resolved */}
        <div
          onClick={() => setStatusFilter('resolved')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '14px 16px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a7f3d0')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="check-circle" size={16} color="#10b981" />
            </div>
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              ›
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
            {telemetry.resolved}
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
            Resolved
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Successfully closed</div>
        </div>

        {/* Action Required */}
        <div
          onClick={() => setStatusFilter('action_required')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '14px 16px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#fed7aa')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#fff7ed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="alert-circle" size={16} color="#ea580c" />
            </div>
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              ›
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ea580c', lineHeight: 1.2 }}>
            {telemetry.actionRequired}
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
            Action Required
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Awaiting your response</div>
        </div>
      </div>

      {/* 3. Quick Actions Section */}
      <div style={{ marginBottom: '22px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '15.5px',
                fontWeight: 700,
                color: 'var(--vyasa-primary, #0f2b48)',
              }}
            >
              Quick Actions
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Common tasks for grievance management.
            </p>
          </div>
        </div>

        {/* 3 Large Action Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Submit a Grievance */}
          <div
            onClick={() => navigate('/modules/atharva-veda/nivaran/submit')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '14px 16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#b2811a';
              e.currentTarget.style.backgroundColor = '#fefdfa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: '#b2811a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '18px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                +
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f2b48' }}>
                  Submit a Grievance
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                  Raise a new university-related concern
                </div>
              </div>
            </div>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>›</span>
          </div>

          {/* My E-Files */}
          <div
            onClick={() => navigate('/modules/atharva-veda/nivaran/e-files')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '14px 16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  flexShrink: 0,
                }}
              >
                <AppIcon name="clipboard" size={18} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f2b48' }}>
                  My E-Files
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                  View your submitted documents
                </div>
              </div>
            </div>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>›</span>
          </div>

          {/* My Student Record */}
          <div
            onClick={() => navigate('/modules/atharva-veda/nivaran/student-records/me')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '14px 16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.backgroundColor = '#f0fdf4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  flexShrink: 0,
                }}
              >
                <AppIcon name="graduation-cap" size={18} color="#059669" />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f2b48' }}>
                  My Student Record
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                  Access your academic information
                </div>
              </div>
            </div>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>›</span>
          </div>
        </div>
      </div>

      {/* 4. My Grievances Section Header & Filter Toolbar */}
      <div id="my-grievances-section" style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--vyasa-primary, #0f2b48)',
              }}
            >
              My Grievances
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              <span>Track the status of your submitted grievances and view updates.</span>
              <span className="sr-only">My Grievance Dossiers</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/modules/atharva-veda/nivaran/submit')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0f2b48',
              border: '1px solid #0b1e33',
              borderRadius: '6px',
              color: '#ffffff',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(15, 43, 72, 0.2)',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#163b5f')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0f2b48')}
          >
            <span>+ New Grievance</span>
          </button>
        </div>

        {/* Unified Search & Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '14px',
            backgroundColor: '#ffffff',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          {/* Search Input */}
          <div
            style={{
              flex: '1 1 260px',
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
              placeholder="Search by tracking ID, title, subject or category..."
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

          {/* Status Filter */}
          <div style={{ width: '140px' }}>
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
              <option value="SUBMITTED">Submitted</option>
              <option value="in_progress">In Progress</option>
              <option value="PENDING_REVIEW">Under Review</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="resolved">Resolved / Closed</option>
              <option value="action_required">Action Required</option>
            </select>
          </div>

          {/* Categories Filter */}
          <div style={{ width: '160px' }}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
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
              <option value="">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sessions Filter */}
          <div style={{ width: '130px' }}>
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
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
              <option value="">All Sessions</option>
              <option value="2026-27">Session: 2026–27</option>
            </select>
          </div>

          {/* Date Range Filter Button */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setDateFilterOpen((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                backgroundColor: dateRange.start || dateRange.end ? '#eff6ff' : '#ffffff',
                border: dateRange.start || dateRange.end ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12.5px',
                color: dateRange.start || dateRange.end ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
              }}
            >
              <AppIcon name="clock" size={14} color={dateRange.start || dateRange.end ? '#2563eb' : '#64748b'} />
              <span>{dateRange.start ? 'Date: Filtered' : 'Date Range'}</span>
            </button>

            {dateFilterOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                  zIndex: 50,
                  width: '240px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Start Date</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>End Date</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDateRange({ start: '', end: '' });
                      setDateFilterOpen(false);
                    }}
                    style={{ fontSize: '11px', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilterOpen(false)}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#0f2b48', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* More Filters / Reset */}
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('');
              setCategoryFilter('');
              setSessionFilter('');
              setDateRange({ start: '', end: '' });
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
            {(searchQuery || statusFilter || categoryFilter || sessionFilter || dateRange.start || dateRange.end) && (
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
      </div>

      {/* 5. Grievances Data Table */}
      {loading ? (
        <LoadingState message="Loading your submitted grievances..." />
      ) : errorMsg ? (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#b91c1c',
            marginBottom: '20px',
            fontSize: '13px',
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
                  <th style={{ padding: '12px 14px' }}>Tracking ID</th>
                  <th style={{ padding: '12px 14px' }}>Title &amp; Subject</th>
                  <th style={{ padding: '12px 14px' }}>Category</th>
                  <th style={{ padding: '12px 14px' }}>Priority</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Assigned Authority</th>
                  <th style={{ padding: '12px 14px' }}>Submitted Date</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrievances.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AppIcon name="file-text" size={20} color="#94a3b8" />
                        </div>
                        <div style={{ fontWeight: 600, color: '#0f2b48', fontSize: '14px' }}>
                          No grievances found
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '360px' }}>
                          {searchQuery || statusFilter || categoryFilter
                            ? 'No grievances match your current search and filter criteria.'
                            : 'You have not submitted any grievances to Atharva Veda / NIVARAN yet.'}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/modules/atharva-veda/nivaran/submit')}
                          style={{
                            marginTop: '8px',
                            padding: '7px 16px',
                            backgroundColor: '#0f2b48',
                            color: '#ffffff',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Submit a Grievance
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedGrievances.map((item) => {
                    const categoryDisplayName = item.final_category_name || item.category_name;
                    const isOverridden = item.final_category_name && item.final_category_name !== item.category_name;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background-color 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafaf9')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      >
                        {/* Tracking ID */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              fontFamily: 'var(--vyasa-font-mono, monospace)',
                              fontWeight: 700,
                              color: 'var(--vyasa-primary, #0f2b48)',
                              fontSize: '12.5px',
                            }}
                          >
                            {item.grievance_id}
                          </span>
                        </td>

                        {/* Title & Subject */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle', maxWidth: '260px' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#0f2b48',
                              fontSize: '13.5px',
                              lineHeight: 1.3,
                            }}
                          >
                            {item.title}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                            {item.subject_name || 'General Discipline'}
                          </div>
                        </td>

                        {/* Category */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2.5px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #dbeafe',
                            }}
                          >
                            {categoryDisplayName}
                          </span>
                          {isOverridden && (
                            <div style={{ fontSize: '10px', color: '#b45309', marginTop: '2px' }}>
                              Updated by Manager
                            </div>
                          )}
                        </td>

                        {/* Priority */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          {getPriorityBadge(item.priority)}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          {getStatusBadge(item.status)}
                        </td>

                        {/* Assigned Authority */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: '12.5px' }}>
                          {item.assigned_authority_name ? (
                            <span style={{ color: '#1e293b', fontWeight: 500 }}>
                              {item.assigned_authority_name}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>
                              Awaiting Initial Review
                            </span>
                          )}
                        </td>

                        {/* Submitted Date */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: '12px', color: '#64748b' }}>
                          {new Date(item.created_at).toLocaleDateString()}
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
                            <Button
                              variant="outline"
                              size="sm"
                              style={{
                                padding: '4px 10px',
                                fontSize: '12px',
                                borderRadius: '6px',
                                borderColor: '#cbd5e1',
                                color: '#0f2b48',
                                fontWeight: 500,
                              }}
                              onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${item.id}`)}
                            >
                              <span>View Details &rarr;</span>
                              <span className="sr-only">View Dossier &rarr;</span>
                            </Button>

                            {/* Row Dropdown Trigger ⋮ */}
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                title="More Actions"
                                aria-label={`Actions for ${item.grievance_id}`}
                                onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
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
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                              >
                                ⋮
                              </button>

                              {openMenuId === item.id && (
                                <div
                                  ref={menuRef}
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '32px',
                                    width: '160px',
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
                                      navigator.clipboard?.writeText(item.grievance_id);
                                      setOpenMenuId(null);
                                      alert(`Copied tracking ID: ${item.grievance_id}`);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '6px 10px',
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
                                    <AppIcon name="clipboard" size={13} color="#64748b" />
                                    <span>Copy Tracking ID</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      navigate(`/modules/atharva-veda/nivaran/grievance/${item.id}`);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '6px 10px',
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
                                    <AppIcon name="file-text" size={13} color="#64748b" />
                                    <span>Full Dossier</span>
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

          {/* Pagination Controls */}
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
            {/* Left Telemetry */}
            <div>
              Showing{' '}
              <strong style={{ color: '#0f2b48' }}>
                {filteredGrievances.length === 0
                  ? 0
                  : pageSize === 0
                  ? 1
                  : (currentPage - 1) * pageSize + 1}
              </strong>
              –
              <strong style={{ color: '#0f2b48' }}>
                {pageSize === 0
                  ? filteredGrievances.length
                  : Math.min(currentPage * pageSize, filteredGrievances.length)}
              </strong>{' '}
              of{' '}
              <strong style={{ color: '#0f2b48' }}>
                {filteredGrievances.length}
              </strong>{' '}
              {filteredGrievances.length === 1 ? 'grievance' : 'grievances'}
            </div>

            {/* Center Page Numbers */}
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

            {/* Right Per Page Dropdown */}
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
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={0}>All</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 6. About NIVARAN & Help & Support Section */}
      <div
        style={{
          marginTop: '20px',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '640px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="scale" size={20} color="#2563eb" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f2b48' }}>
                About NIVARAN
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0d766e' }}>
                AI-Assisted Grievance Redressal for CSJMU
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
              A transparent, efficient and accountable platform for addressing student and researcher grievances
              under the R&amp;D Governance ecosystem.
            </p>
          </div>
        </div>

        {/* Right Help Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#334155',
              cursor: 'pointer',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            <AppIcon name="file-text" size={13} color="#64748b" />
            <span>Grievance Guidelines</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>↗</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFaqModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#334155',
              cursor: 'pointer',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            <AppIcon name="info" size={13} color="#64748b" />
            <span>FAQs</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>↗</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSupportModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#334155',
              cursor: 'pointer',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            <AppIcon name="user" size={13} color="#64748b" />
            <span>Contact Support</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>↗</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: Grievance Guidelines Modal */}
      {isHelpModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsHelpModalOpen(false)}
          title="NIVARAN Grievance Redressal Guidelines"
          footer={
            <Button variant="primary" size="sm" onClick={() => setIsHelpModalOpen(false)}>
              Understood
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: 1.6, color: '#334155' }}>
            <p style={{ margin: 0 }}>
              Under University Statute No. 14, every enrolled Ph.D. scholar and student at CSJMU has the right to transparent,
              statutory dispute resolution through the multi-tier NIVARAN portal.
            </p>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#0f2b48', display: 'block', marginBottom: '6px' }}>Three-Tier Redressal Hierarchy:</strong>
              <ol style={{ margin: 0, paddingLeft: '20px' }}>
                <li><strong>Stage 1 (Discipline / Coursework):</strong> Assistant Dean of the respective subject cluster.</li>
                <li><strong>Stage 2 (Functional / Grants / Fellowship):</strong> Associate Dean of the grievance category cluster.</li>
                <li><strong>Stage 3 (Appellate / Disciplinary):</strong> Dean of Research &amp; Development and Academic Affairs.</li>
              </ol>
            </div>
            <div style={{ padding: '10px 12px', backgroundColor: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '12.5px' }}>
              <strong>Confidentiality Guarantee:</strong> Your submission and attached supporting files are cryptographically
              hashed and visible only to assigned statutory officers and members of hearing committees.
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: FAQs Modal */}
      {isFaqModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsFaqModalOpen(false)}
          title="Frequently Asked Questions (FAQs)"
          footer={
            <Button variant="outline" size="sm" onClick={() => setIsFaqModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#334155' }}>
            <div>
              <strong style={{ color: '#0f2b48' }}>How long does initial review take?</strong>
              <p style={{ margin: '2px 0 0', color: '#64748b' }}>
                Application processing and Manager review occurs within 24 to 48 business hours. You will receive an email notification when an officer is assigned.
              </p>
            </div>
            <div>
              <strong style={{ color: '#0f2b48' }}>Can I upload additional documents later?</strong>
              <p style={{ margin: '2px 0 0', color: '#64748b' }}>
                Yes, open your grievance details and submit requested files through the E-Files upload section.
              </p>
            </div>
            <div>
              <strong style={{ color: '#0f2b48' }}>What if I disagree with the decision?</strong>
              <p style={{ margin: '2px 0 0', color: '#64748b' }}>
                You have 15 days from closure to appeal the outcome to the Dean Executive Council or request committee re-hearing.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: Contact Support Modal */}
      {isSupportModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsSupportModalOpen(false)}
          title="CSJMU Central Grievance Cell Support"
          footer={
            <Button variant="primary" size="sm" onClick={() => setIsSupportModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#334155' }}>
            <p style={{ margin: 0, color: '#64748b' }}>
              For urgent technical or administrative support regarding your grievance:
            </p>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: '#0f2b48' }}>Email: </span>
                <span style={{ color: '#2563eb' }}>grievance-support@csjmu.ac.in</span>
              </div>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: '#0f2b48' }}>Helpline: </span>
                <span>+91 512 258 0044 (Mon–Fri, 9:30 AM – 5:30 PM IST)</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: '#0f2b48' }}>Office: </span>
                <span>Room 104, R&amp;D Governance Block, CSJMU Campus, Kanpur – 208024</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: Scholar Profile Modal */}
      {isProfileModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsProfileModalOpen(false)}
          title="Scholar Profile & Credentials"
          footer={
            <Button variant="primary" size="sm" onClick={() => setIsProfileModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#334155' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Full Name</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f2b48' }}>
                  {displayName || user?.fullName || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Scholar'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Institutional Email</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f2b48' }}>{user?.email}</p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Academic Department</span>
                <p style={{ margin: '2px 0 0', color: '#0f2b48' }}>{user?.department || 'Not specified'}</p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Subject Discipline</span>
                <p style={{ margin: '2px 0 0', color: '#0f2b48' }}>{user?.subject_name || 'General Discipline'}</p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Enrollment Number</span>
                <p style={{ margin: '2px 0 0', fontFamily: 'monospace', color: '#0f2b48' }}>{user?.enrollment_number || 'CSJMU/ENR/2026/042'}</p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Session</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f2b48' }}>2026–27</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </ApplicantLayout>
  );
};
