import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState, EmptyState } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { phase6dService } from '../services/phase6dService';
import { EFileResponse, EFileVerificationResponse } from '../types/phase6d';

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
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve electronic dossiers (E-Files).');
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
      alert(err instanceof Error ? err.message : 'Cryptographic verification failed.');
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

  if (isAdmin && !isAuthority && !isApplicant) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <Card variant="default">
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <h3 style={{ color: '#b91c1c', margin: '0 0 10px' }}>Access Restricted</h3>
            <p style={{ color: 'var(--vyasa-text-secondary)', marginBottom: '16px' }}>
              Platform Administrators do not automatically inherit case-level grievance or E-File dossier access.
              Institutional grievance records are restricted to appointed academic authorities and case owners.
            </p>
            <Button variant="outline" onClick={() => navigate('/admin')}>
              &larr; Return to Admin Console
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--vyasa-navy, #0f2b48)' }}>
              {isApplicant ? 'My Official Sealed E-Files' : 'Institutional Digital E-Files Archive'}
            </h2>
            <Badge variant="teal">{total} Sealed Dossiers</Badge>
            <Badge variant="gold">SHA-256 Tamper-Proof</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            {isApplicant
              ? 'Longitudinal digital record repository: sealed PDF case dossiers generated upon formal institutional closure.'
              : 'Jurisdictional repository of final closure dossiers compiled with cryptographic SHA-256 signatures.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" onClick={() => loadData(page, search)}>
            Refresh Archive
          </Button>
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
                  fontSize: '14px',
                  boxSizing: 'border-box',
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
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {loading ? (
        <LoadingState message="Querying digital E-File archive and verifying cryptographic seals..." />
      ) : efiles.length === 0 ? (
        <EmptyState
          title="No Sealed E-Files Found"
          description={
            isApplicant
              ? 'You do not have any finalized E-Files yet. Official E-Files are compiled automatically upon case closure by the Manager.'
              : 'No sealed E-Files matched the search criteria within your authorized jurisdiction.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {efiles.map((ef) => {
            const vRes = verifications[ef.id];
            const isVerifying = verifyingId === ef.id;
            const isCopied = copiedId === ef.id;
            const downloadUrl = phase6dService.getDownloadUrl(ef.id);

            return (
              <Card key={ef.id} variant="default" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-navy, #0f2b48)' }}>
                        {ef.e_file_number}
                      </span>
                      <Badge variant="teal">Digitally Sealed</Badge>
                      <Badge variant="neutral">{ef.page_count} Pages</Badge>
                      {ef.student_record_number && (
                        <Badge variant="gold">SMR: {ef.student_record_number}</Badge>
                      )}
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                      {ef.grievance_title || `Case: ${ef.grievance_ref}`}
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--vyasa-text-secondary, #64748b)', flexWrap: 'wrap', marginBottom: '12px' }}>
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
                      <span>
                        Applicant: <strong>{ef.applicant_name}</strong>
                      </span>
                      <span>
                        Sealed At:{' '}
                        <strong>
                          {ef.sealed_at ? new Date(ef.sealed_at).toLocaleString() : new Date(ef.created_at).toLocaleString()}
                        </strong>
                      </span>
                      {ef.sealed_by_authority_name && (
                        <span>
                          Sealed By: <strong>{ef.sealed_by_authority_name}</strong>
                        </span>
                      )}
                    </div>

                    {/* SHA-256 Digest Box */}
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginRight: '6px' }}>
                          SHA-256 Seal:
                        </span>
                        <code style={{ wordBreak: 'break-all', fontSize: '11.5px', color: '#0f172a' }}>
                          {ef.content_hash || 'SHA256:N/A'}
                        </code>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyHash(ef.id, ef.content_hash)}
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          {isCopied ? 'Copied!' : 'Copy Hash'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isVerifying}
                          onClick={() => handleVerify(ef.id)}
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          {isVerifying ? 'Verifying...' : 'Verify Seal'}
                        </Button>
                      </div>
                    </div>

                    {/* Verification result pill */}
                    {vRes && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          backgroundColor: vRes.is_valid ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${vRes.is_valid ? '#bbf7d0' : '#fecaca'}`,
                          color: vRes.is_valid ? '#166534' : '#991b1b',
                        }}
                      >
                        {vRes.is_valid ? (
                          <span>
                            ✓ <strong>Integrity Verified:</strong> Exact SHA-256 digest match recorded in university database ({vRes.algorithm}). Zero tampering detected.
                          </span>
                        ) : (
                          <span>
                            ⚠ <strong>Integrity Mismatch:</strong> Expected <code>{vRes.stored_hash}</code>, Got <code>{vRes.calculated_hash}</code>.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <Button variant="primary" style={{ fontSize: '12px' }}>
                        Download Official PDF &darr;
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      style={{ fontSize: '12px' }}
                      onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${ef.grievance_id}`)}
                    >
                      View Case Record
                    </Button>
                  </div>
                </div>
              </Card>
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
    </PageContainer>
  );
};
