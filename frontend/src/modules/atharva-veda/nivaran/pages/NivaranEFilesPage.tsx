import React, { useEffect, useState, useMemo } from 'react';
import { Badge, Button, LoadingState, AppIcon } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { ApplicantLayout } from '../../../../features/applicant';
import { WorkspaceShell } from '../../../../components/layout/WorkspaceShell';
import { useAuth } from '../../../../context/AuthContext';
import { phase6dService } from '../services/phase6dService';
import { EFileResponse, EFileVerificationResponse } from '../types/phase6d';
import './CaseReview.css';

export const NivaranEFilesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, displayName, authorityDesignation, isApplicant, isAuthority, isDean, isAssociateDean, isAssistantDean, isManager, isAdmin } = useAuth();

  const [efiles, setEfiles] = useState<EFileResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Verification state keyed by efile ID
  const [verifications, setVerifications] = useState<Record<string, EFileVerificationResponse | undefined>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async (targetPage: number = page, searchStr: string = search) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      if (isApplicant) {
        const data = await phase6dService.getMyEFiles();
        setEfiles(data);
        setTotal(data.length);
        setTotalPages(1);
      } else if (isAuthority || isDean || isAssociateDean || isAssistantDean || isManager) {
        const res = await phase6dService.listAuthorityEFiles(searchStr.trim() || undefined, targetPage, pageSize);
        setEfiles(res.items);
        setTotal(res.total);
        setTotalPages(res.total_pages || 1);
      } else {
        setEfiles([]);
        setTotal(0);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve electronic case files (E-Files).');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(page, search);
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData(1, search);
  };

  const handleVerify = async (efileId: string) => {
    try {
      setVerifyingId(efileId);
      const res = await phase6dService.verifyEFile(efileId);
      setVerifications((prev) => ({ ...prev, [efileId]: res }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'File verification check failed.');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleCopyHash = (efileId: string, hash?: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedId(efileId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const authorityFullName = displayName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Appointed Authority');

  // KPI Calculations
  const verifiedCount = useMemo(() => {
    return Object.values(verifications).filter((v) => v?.is_valid).length;
  }, [verifications]);

  const totalPagesCount = useMemo(() => {
    return efiles.reduce((acc, curr) => acc + (curr.page_count || 1), 0);
  }, [efiles]);

  const ContentWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (isApplicant) {
      return (
        <ApplicantLayout activeTab="my-efiles">
          <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
            {/* 0. Clean Institutional Breadcrumb */}
            <nav
              aria-label="Breadcrumb"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#64748b',
                marginBottom: '16px',
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
                  gap: '5px',
                }}
              >
                <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
                <span>VYASA Dashboard</span>
              </button>
              <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
              <button
                type="button"
                onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--vyasa-navy, #0f2b48)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                NIVARAN
              </button>
              <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
              <span style={{ color: '#64748b', fontWeight: 500 }}>My Sealed E-Files</span>
            </nav>
            {children}
          </div>
        </ApplicantLayout>
      );
    }
    return (
      <WorkspaceShell currentTab="governance">
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px 20px', boxSizing: 'border-box' }}>
          {/* 0. Clean Institutional Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#64748b',
              marginBottom: '16px',
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
                gap: '5px',
              }}
            >
              <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
              <span>VYASA Dashboard</span>
            </button>
            <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
            <button
              type="button"
              onClick={() => navigate('/modules/atharva-veda/nivaran/assistant-dean/dashboard')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--vyasa-navy, #0f2b48)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              NIVARAN
            </button>
            <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
            <span style={{ color: '#64748b', fontWeight: 500 }}>E-Files Archive</span>
          </nav>
          {children}
        </div>
      </WorkspaceShell>
    );
  };

  if (isAdmin && !isAuthority && !isApplicant) {
    return (
      <WorkspaceShell currentTab="governance">
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
          <div className="nivaran-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AppIcon name="alert-circle" size={24} />
            </div>
            <h3 style={{ color: '#b91c1c', margin: '0 0 10px', fontSize: '18px', fontWeight: 600 }}>
              Access Restricted
            </h3>
            <p style={{ color: 'var(--vyasa-text-secondary, #64748b)', maxWidth: '520px', margin: '0 auto 24px', fontSize: '13.5px', lineHeight: 1.5 }}>
              Administrators do not have direct access to private grievance files.
              These records are restricted to assigned authorities and applicants.
              <span className="sr-only">Platform Administrators do not automatically inherit case-level grievance or E-File dossier access.</span>
            </p>
            <Button variant="outline" onClick={() => navigate('/admin')}>
              &larr; Return to Admin Panel
            </Button>
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <ContentWrapper>
      {/* 1. Canonical Institutional Header with Watermark */}
      <div className="nivaran-case-header">
        {/* Architectural building watermark */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '160px',
            top: 0,
            bottom: 0,
            width: '260px',
            opacity: 0.04,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <AppIcon name="building" size={200} color="#0f2b48" />
        </div>

        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip" aria-hidden="true">
              <AppIcon name="shield" size={20} color="var(--vyasa-navy, #1b2a4a)" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--vyasa-gold, #b2811a)',
                  marginBottom: '2px',
                }}
              >
                Chhatrapati Shahu Ji Maharaj University, Kanpur
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading">
                  {isApplicant ? 'My Official Sealed E-Files' : 'Institutional Digital E-Files Archive'}
                </h1>
                <Badge variant="teal">
                  {total} Sealed Records
                  <span className="sr-only"> {total} Sealed Dossiers</span>
                </Badge>
                <Badge variant="saffron">Tamper-Proof Record</Badge>
                {!isApplicant && <Badge variant="teal">Cryptographic Archive</Badge>}
              </div>

              <p className="nivaran-case-meta">
                <span className="nivaran-case-meta__item">
                  {isApplicant
                    ? 'Digital case files and certificates created after formal resolution.'
                    : 'Archive of resolved case files with digital verification signatures.'}
                </span>
                <span className="nivaran-case-meta__separator">&bull;</span>
                <span className="nivaran-case-meta__item">
                  CSJMU Statutory Redressal
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', zIndex: 1 }}>
            {/* Academic Session Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}
              >
                <AppIcon name="clock" size={15} />
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Academic Session
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f2b48', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>2026–27</span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(page, search)}
              disabled={loading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh Archive
            </Button>
            {isApplicant && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
              >
                My Grievances &rarr;
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Authority Identity & Jurisdiction Summary Strip (For Authority users) */}
      {!isApplicant && (
        <div
          data-testid="authority-identity-summary"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Account Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="user" size={15} color="#b2811a" />
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Appointed Authority
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f2b48' }}>
                  {authorityFullName}
                </span>
              </div>
            </div>

            {/* Institutional Email */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="mail" size={15} color="#2563eb" />
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Official Email
                </span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                  {user?.email || '—'}
                </span>
              </div>
            </div>

            {/* Jurisdiction Scope */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="scale" size={15} color="#0d9488" />
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Jurisdiction Scope
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f2b48' }}>
                  {authorityDesignation || 'Institutional Digital Dossier Archive'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/modules/atharva-veda/nivaran/student-records')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--vyasa-primary, #0f2b48)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
              e.currentTarget.style.borderColor = '#93c5fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <span>Student Master Records</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}

      {/* 3. Structured Executive Metric Cards */}
      <div className="nivaran-docket-kpi-grid">
        <div className="nivaran-docket-kpi nivaran-docket-kpi--navy">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Total Sealed Records</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="shield" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value">{total}</div>
          <div className="nivaran-docket-kpi__subtext">Official digitized dossiers</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--emerald">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Verified In Session</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="check-circle" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#047857' }}>{verifiedCount}</div>
          <div className="nivaran-docket-kpi__subtext">Cryptographic hash validated</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--sky">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Total Archival Pages</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="layers" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#0284c7' }}>{totalPagesCount}</div>
          <div className="nivaran-docket-kpi__subtext">Certified document pages</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--amber">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Tamper-Proof Seal</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="file-text" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#b45309' }}>SHA-256</div>
          <div className="nivaran-docket-kpi__subtext">Immutable digital digest</div>
        </div>
      </div>

      {/* 4. Authority Search & Filter Toolbar */}
      {!isApplicant && (
        <div className="nivaran-docket-toolbar">
          <form onSubmit={handleSearchSubmit} className="nivaran-docket-search-wrap" style={{ width: '100%' }}>
            <span className="nivaran-docket-search-icon">
              <AppIcon name="search" size={14} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by E-File number (NVR/EF/...), Tracking ID, Title, or Student..."
              className="nivaran-docket-search-input"
              style={{ flex: 1, width: '100%', maxWidth: '480px' }}
            />
            <Button size="sm" variant="primary" type="submit" disabled={loading} style={{ marginLeft: '8px' }}>
              {loading ? 'Searching...' : 'Search Dossiers'}
            </Button>
            {search && (
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                  loadData(1, '');
                }}
                style={{ marginLeft: '6px' }}
              >
                Clear
              </Button>
            )}
          </form>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AppIcon name="alert-circle" size={16} color="#b91c1c" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <LoadingState message="Querying digital E-File archive and verifying cryptographic seals..." />
      ) : efiles.length === 0 ? (
        <div
          className="nivaran-card"
          style={{
            padding: '52px 24px',
            textAlign: 'center',
            background: 'linear-gradient(180deg, #ffffff 0%, #fbfaf7 100%)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              backgroundColor: 'rgba(212, 160, 23, 0.12)',
              border: '1px solid rgba(212, 160, 23, 0.25)',
              color: '#d4a017',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}
          >
            <AppIcon name="book-open" size={28} color="#d4a017" />
          </div>
          <h3
            style={{
              color: 'var(--vyasa-navy, #0f2b48)',
              margin: '0 0 10px',
              fontSize: '18px',
              fontWeight: 700,
              fontFamily: 'var(--vyasa-font-scholarly, Georgia, serif)',
            }}
          >
            No Sealed E-Files Found
          </h3>
          <p
            style={{
              color: 'var(--vyasa-text-secondary, #64748b)',
              maxWidth: '520px',
              margin: '0 auto 24px',
              fontSize: '13.5px',
              lineHeight: 1.6,
            }}
          >
            {isApplicant
              ? 'You do not have any finalized E-Files yet. Official E-Files are compiled automatically upon case closure by the Manager.'
              : 'No sealed E-Files matched the search criteria within your authorized jurisdiction.'}
          </p>
          {isApplicant && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <Button
                variant="primary"
                onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
                style={{ fontSize: '13px' }}
              >
                View Active Grievances &rarr;
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {efiles.map((ef) => {
            const vRes = verifications[ef.id];
            const isVerifying = verifyingId === ef.id;
            const isCopied = copiedId === ef.id;
            const downloadUrl = phase6dService.getDownloadUrl(ef.id);

            return (
              <div key={ef.id} className="nivaran-card nivaran-card--gold">
                <div className="nivaran-card__body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span className="nivaran-tracking-pill" style={{ fontSize: '13px', padding: '3px 9px' }}>
                          {ef.e_file_number}
                        </span>
                        <Badge variant="teal">Digitally Sealed</Badge>
                        <Badge variant="neutral">{ef.page_count} Pages</Badge>
                        {ef.student_record_number && (
                          <Badge variant="gold">SMR: {ef.student_record_number}</Badge>
                        )}
                      </div>

                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-navy, #0f2b48)', margin: '0 0 10px', lineHeight: 1.4 }}>
                        {ef.grievance_title || `Case: ${ef.grievance_ref}`}
                      </h3>

                      <div style={{ display: 'flex', gap: '14px', fontSize: '12.5px', color: 'var(--vyasa-text-secondary, #64748b)', flexWrap: 'wrap', marginBottom: '14px' }}>
                        <span>
                          Grievance Ref:{' '}
                          <button
                            type="button"
                            onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${ef.grievance_id}`)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#0284c7',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontWeight: 600,
                            }}
                          >
                            {ef.grievance_ref}
                          </button>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Applicant: <strong style={{ color: '#1e293b' }}>{ef.applicant_name}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Sealed At:{' '}
                          <strong style={{ color: '#1e293b' }}>
                            {ef.sealed_at ? new Date(ef.sealed_at).toLocaleString() : new Date(ef.created_at).toLocaleString()}
                          </strong>
                        </span>
                        {ef.sealed_by_authority_name && (
                          <>
                            <span>&bull;</span>
                            <span>
                              Sealed By: <strong style={{ color: '#1e293b' }}>{ef.sealed_by_authority_name}</strong>
                            </span>
                          </>
                        )}
                      </div>

                      {/* SHA-256 Digest Box */}
                      <div
                        style={{
                          padding: '12px 14px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '3px' }}>
                            SHA-256 Cryptographic Seal:
                          </span>
                          <code style={{ wordBreak: 'break-all', fontSize: '11.5px', color: '#0f172a', fontFamily: 'monospace' }}>
                            {ef.content_hash || 'SHA256:N/A'}
                          </code>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyHash(ef.id, ef.content_hash)}
                            style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          >
                            {isCopied ? 'Copied!' : 'Copy Hash'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isVerifying}
                            onClick={() => handleVerify(ef.id)}
                            style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          >
                            {isVerifying ? 'Verifying...' : 'Verify Seal'}
                          </Button>
                        </div>
                      </div>

                      {/* Verification result pill */}
                      {vRes && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            backgroundColor: vRes.is_valid ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${vRes.is_valid ? '#bbf7d0' : '#fecaca'}`,
                            borderLeft: `4px solid ${vRes.is_valid ? '#16a34a' : '#dc2626'}`,
                            color: vRes.is_valid ? '#166534' : '#991b1b',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                          }}
                        >
                          <AppIcon name={vRes.is_valid ? 'check-circle' : 'alert-circle'} size={16} />
                          <div>
                            {vRes.is_valid ? (
                              <span>
                                <strong>Integrity Verified:</strong> Exact SHA-256 digest match recorded in university database ({vRes.algorithm}). Zero tampering detected.
                              </span>
                            ) : (
                              <span>
                                <strong>Integrity Mismatch:</strong> Expected <code>{vRes.stored_hash}</code>, Got <code>{vRes.calculated_hash}</code>.
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', alignSelf: 'center' }}>
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none' }}
                      >
                        <Button variant="primary" size="sm" style={{ fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>Download Official PDF</span>
                          <span>&darr;</span>
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        style={{ fontSize: '12.5px' }}
                        onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${ef.grievance_id}`)}
                      >
                        View Case Record &rarr;
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Stately Pagination Footnote */}
          {!isApplicant && totalPages > 1 && (
            <div className="nivaran-docket-pagination">
              <span>
                Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total sealed dossiers)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  &larr; Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next &rarr;
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </ContentWrapper>
  );
};
