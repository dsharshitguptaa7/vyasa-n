import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState, AppIcon } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { ApplicantLayout } from '../../../../features/applicant';
import { useAuth } from '../../../../context/AuthContext';
import { phase6dService } from '../services/phase6dService';
import { EFileResponse, EFileVerificationResponse } from '../types/phase6d';
import './CaseReview.css';

export const NivaranEFilesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isApplicant, isAuthority, isDean, isAssociateDean, isAssistantDean, isManager, isAdmin } = useAuth();

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

  const ContentWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (isApplicant) {
      return (
        <ApplicantLayout activeTab="my-efiles">
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
              NIVARAN-AI Dashboard
            </button>
            <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
            <span style={{ color: '#64748b', fontWeight: 500 }}>My Sealed E-Files</span>
          </nav>
          {children}
        </ApplicantLayout>
      );
    }
    return <PageContainer style={{ padding: '32px 0 60px' }}>{children}</PageContainer>;
  };

  if (isAdmin && !isAuthority && !isApplicant) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
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
      </PageContainer>
    );
  }

  return (
    <ContentWrapper>
      {/* 1. Stately Case Review Header */}
      <div className="nivaran-case-header">
        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip" aria-hidden="true">
              <AppIcon name="shield" size={20} color="var(--vyasa-navy, #1b2a4a)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading">
                  {isApplicant ? 'My Official Sealed E-Files' : 'Institutional Digital E-Files Archive'}
                </h1>
                <Badge variant="teal">
                  {total} Sealed Records
                  <span className="sr-only"> {total} Sealed Dossiers</span>
                </Badge>
                <Badge variant="gold">Tamper-Proof Record</Badge>
              </div>
              <p className="nivaran-case-meta" style={{ marginTop: '6px' }}>
                <span className="nivaran-case-meta__item">
                  {isApplicant
                    ? 'Digital case files and certificates created after formal resolution.'
                    : 'Archive of resolved case files with digital verification signatures.'}
                </span>
                <span className="nivaran-case-meta__separator">&bull;</span>
                <span className="nivaran-case-meta__item">
                  Chhatrapati Shahu Ji Maharaj University, Kanpur
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              onClick={() => loadData(page, search)}
              disabled={loading}
              style={{ fontSize: '13px' }}
            >
              Refresh
            </Button>
            {isApplicant && (
              <Button
                variant="outline"
                onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
                style={{ fontSize: '13px' }}
              >
                My Grievances
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Authority Search Input */}
      {!isApplicant && (
        <Card variant="gold-accent" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0, width: '100%' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by E-File number (NVR/EF/...), Tracking ID, Title, or Student..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--vyasa-border, #cbd5e1)',
                  fontSize: '13.5px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Searching...' : 'Search Dossiers'}
            </Button>
            {search && (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                  loadData(1, '');
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </Card>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            borderLeft: '4px solid #dc2626',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AppIcon name="alert-circle" size={18} color="#b91c1c" />
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

                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--vyasa-navy, #0f2b48)', margin: '0 0 10px', lineHeight: 1.4 }}>
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
                        <Button variant="primary" style={{ fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>Download Official PDF</span>
                          <span>&darr;</span>
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        style={{ fontSize: '12.5px' }}
                        onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${ef.grievance_id}`)}
                      >
                        View Case Record
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination for Authority Search */}
      {!isApplicant && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &larr; Previous
          </Button>
          <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next &rarr;
          </Button>
        </div>
      )}
    </ContentWrapper>
  );
};
