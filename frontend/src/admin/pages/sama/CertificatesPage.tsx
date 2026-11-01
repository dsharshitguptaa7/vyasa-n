import React, { useState, useEffect, useCallback } from 'react';
import { AppIcon, Button, Badge, Modal, Input, Select, EmptyState, LoadingState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { useAuth } from '../../../context/AuthContext';
import { samaAdminService } from '../../services/samaAdminService';
import type { CertificateRecord, AuthorRecord, BulletinRecord, PublicationRecord } from '../../types/sama';

export const CertificatesPage: React.FC = () => {
  const { user, isSuperAdmin: authSuperAdmin } = useAuth();
  const isSuperAdmin = authSuperAdmin || Boolean(user?.roles?.includes('super_admin'));

  // State
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'revoked'>('all');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Reference data for modals
  const [authors, setAuthors] = useState<AuthorRecord[]>([]);
  const [bulletins, setBulletins] = useState<BulletinRecord[]>([]);
  const [publications, setPublications] = useState<PublicationRecord[]>([]);

  // Modals state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Issue Form state
  const [issueForm, setIssueForm] = useState({
    certificate_number: '',
    bulletin_id: '',
    author_id: '',
    publication_id: '',
    verification_hash: '',
  });
  const [issueFile, setIssueFile] = useState<File | null>(null);

  // Revoke Form state
  const [revocationReason, setRevocationReason] = useState('');

  // Fetch certificates
  const fetchCertificates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const isRevokedParam =
        statusFilter === 'all' ? undefined : statusFilter === 'revoked';

      const res = await samaAdminService.getCertificates({
        skip: (page - 1) * limit,
        limit,
        search: search.trim() || undefined,
        is_revoked: isRevokedParam,
      });

      setCertificates(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  // Load auxiliary reference data
  const loadReferenceData = async () => {
    try {
      const [authRes, bullRes, pubRes] = await Promise.all([
        samaAdminService.getAuthors({ limit: 100 }),
        samaAdminService.getBulletins({ limit: 100 }),
        samaAdminService.getPublications({ limit: 100 }),
      ]);
      setAuthors(authRes.items);
      setBulletins(bullRes.items);
      setPublications(pubRes.items);
    } catch (err) {
      console.warn('Failed to load auxiliary reference data', err);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  useEffect(() => {
    loadReferenceData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCertificates();
  };

  // Open Issue Modal
  const handleOpenIssue = () => {
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    setIssueForm({
      certificate_number: `CSJMU/RD/${year}/CERT-${rand}`,
      bulletin_id: bulletins[0]?.id || '',
      author_id: authors[0]?.id || '',
      publication_id: '',
      verification_hash: '',
    });
    setIssueFile(null);
    setShowIssueModal(true);
  };

  // Open Revoke Modal
  const handleOpenRevoke = (cert: CertificateRecord) => {
    setSelectedCert(cert);
    setRevocationReason('');
    setShowRevokeModal(true);
  };

  // Submit Issue
  const handleSubmitIssue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!issueForm.certificate_number || !issueForm.bulletin_id || !issueForm.author_id) {
      setError('Please fill in Certificate Number, Bulletin, and Author');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let storagePath = `certificates/${issueForm.certificate_number.replace(/[\/\\]/g, '_')}.pdf`;
      let checksum: string | undefined = undefined;

      if (issueFile) {
        const uploadResult = await samaAdminService.uploadCertificateFile(issueFile);
        storagePath = uploadResult.storage_key;
        checksum = uploadResult.checksum_sha256;
      }

      const created = await samaAdminService.createCertificate({
        certificate_number: issueForm.certificate_number.trim(),
        bulletin_id: issueForm.bulletin_id,
        author_id: issueForm.author_id,
        publication_id: issueForm.publication_id || undefined,
        file_storage_path: storagePath,
        checksum_sha256: checksum,
      });

      setSuccessMessage(`Certificate ${created.certificate_number} issued successfully.`);
      setShowIssueModal(false);
      fetchCertificates();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to issue certificate');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Revocation
  const handleSubmitRevocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCert) return;
    if (revocationReason.trim().length < 5) {
      setError('Revocation reason must be at least 5 characters');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await samaAdminService.revokeCertificate(selectedCert.id, {
        revocation_reason: revocationReason.trim(),
      });

      setSuccessMessage(`Certificate ${selectedCert.certificate_number} revoked.`);
      setShowRevokeModal(false);
      setSelectedCert(null);
      fetchCertificates();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to revoke certificate');
    } finally {
      setSubmitting(false);
    }
  };

  // Download PDF
  const handleDownload = async (cert: CertificateRecord) => {
    try {
      setDownloadingId(cert.id);
      setError(null);
      await samaAdminService.downloadCertificate(
        cert.id,
        `${cert.certificate_number.replace(/[\/\\]/g, '_')}.pdf`
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to download certificate PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AdminLayout activeTab="sama-certificates">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Top Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b2811a' }}>
              SAMIKSHA • Research Felicitation & Honors
            </div>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="check-circle" size={22} color="var(--vyasa-primary, #0f2b48)" />
              Certificates Management
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#64748b' }}>
              Manage research felicitation certificates, institutional hashes, downloads, and Super Admin revocations.
            </p>
          </div>
          <div>
            <Button variant="primary" size="sm" onClick={handleOpenIssue}>
              <AppIcon name="upload" size={14} style={{ marginRight: '6px' }} />
              Issue Certificate
            </Button>
          </div>
        </div>

        {/* Notifications */}
        {error && certificates.length > 0 && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', display: 'flex', alignItems: 'center' }}>
              <AppIcon name="close" size={14} />
            </button>
          </div>
        )}
        {successMessage && (
          <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', display: 'flex', alignItems: 'center' }}>
              <AppIcon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#ffffff',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1 1 300px' }}>
            <Input
              placeholder="Search by certificate # or hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button variant="outline" size="sm" type="submit">
              Search
            </Button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Status:</span>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'valid' | 'revoked');
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Certificates' },
                { value: 'valid', label: 'Valid / Active' },
                { value: 'revoked', label: 'Revoked' },
              ]}
              style={{ minWidth: '150px' }}
            />
          </div>
        </div>

        {/* Certificates Table */}
        {loading ? (
          <LoadingState message="Loading certificate ledger..." />
        ) : error ? (
          <div
            data-testid="certificates-error-state"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              padding: '40px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ color: '#991b1b', fontWeight: 600, fontSize: '16px' }}>
              Failed to load certificates
            </div>
            <div style={{ color: '#64748b', fontSize: '14px', maxWidth: '520px', lineHeight: 1.5 }}>
              {error}
            </div>
            <div style={{ marginTop: '8px' }}>
              <Button variant="primary" size="sm" onClick={fetchCertificates}>
                Retry
              </Button>
            </div>
          </div>
        ) : certificates.length === 0 ? (
          <EmptyState
            title="No Certificates Found"
            description="No certificate records match your query. Issue a new research certificate or adjust your filter."
            action={
              <Button variant="primary" size="sm" onClick={handleOpenIssue}>
                + Issue First Certificate
              </Button>
            }
          />
        ) : (
          <div className="vyasa-table-card" style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid var(--vyasa-border, #e3dcd1)', overflowX: 'auto', boxShadow: '0 2px 6px rgba(15, 43, 72, 0.04)' }}>
            <table className="vyasa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)', borderBottom: '2px solid var(--vyasa-border, #e3dcd1)', color: 'var(--vyasa-primary, #0f2b48)', fontWeight: 600 }}>
                  <th style={{ padding: '12px 16px' }}>Certificate Number</th>
                  <th style={{ padding: '12px 16px' }}>Recipient / Author</th>
                  <th style={{ padding: '12px 16px' }}>Bulletin</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Hash / Verification</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => (
                  <tr key={cert.id} style={{ borderBottom: '1px solid var(--vyasa-border-subtle, #ede7de)' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)' }}>
                        {cert.certificate_number}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Issued: {new Date(cert.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f2b48' }}>
                        {cert.author_name || `Author ID: ${cert.author_id.slice(0, 8)}`}
                      </div>
                      {cert.author_department && (
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{cert.author_department}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {cert.bulletin_title ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#334155' }}>
                            {cert.bulletin_title}
                          </div>
                          {(cert.bulletin_volume != null || cert.bulletin_issue != null) && (
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              Vol. {cert.bulletin_volume} • Issue {cert.bulletin_issue}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {cert.bulletin_id.slice(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {cert.is_revoked ? (
                        <div>
                          <Badge variant="neutral" style={{ color: '#991b1b', backgroundColor: '#fee2e2' }}>
                            Revoked
                          </Badge>
                          {cert.revocation_reason && (
                            <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '3px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cert.revocation_reason}>
                              Reason: {cert.revocation_reason}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="teal">Valid</Badge>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '11.5px', color: '#64748b' }}>
                      <span title={cert.verification_hash || cert.checksum_sha256 || undefined}>
                        {cert.verification_hash ? `${cert.verification_hash.slice(0, 16)}...` : cert.checksum_sha256 ? `${cert.checksum_sha256.slice(0, 16)}...` : 'Verified'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(cert)}
                          disabled={downloadingId === cert.id}
                          title="Download Certificate PDF"
                        >
                          {downloadingId === cert.id ? 'Downloading...' : 'PDF'}
                        </Button>

                        {!cert.is_revoked && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenRevoke(cert)}
                            disabled={!isSuperAdmin}
                            style={{
                              color: isSuperAdmin ? '#b91c1c' : '#94a3b8',
                              borderColor: isSuperAdmin ? '#fca5a5' : '#e2e8f0',
                              cursor: isSuperAdmin ? 'pointer' : 'not-allowed',
                            }}
                            title={
                              isSuperAdmin
                                ? 'Revoke Certificate'
                                : 'Revocation is strictly restricted to Super Administrators'
                            }
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--vyasa-border-subtle, #ede7de)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
              <span>
                Showing {certificates.length} of {totalCount} certificates
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * limit >= totalCount}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Issue Certificate */}
        <Modal
          isOpen={showIssueModal}
          onClose={() => setShowIssueModal(false)}
          title="Issue Felicitation Certificate"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowIssueModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitIssue()}
              >
                {submitting ? 'Issuing...' : 'Confirm Issuance'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmitIssue} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="Certificate Number"
              required
              value={issueForm.certificate_number}
              onChange={(e) =>
                setIssueForm({ ...issueForm, certificate_number: e.target.value })
              }
              placeholder="e.g. CSJMU/RD/2026/V1-I1/001"
              style={{ fontFamily: 'monospace' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <Select
                label="Bulletin Reference"
                required
                value={issueForm.bulletin_id}
                onChange={(e) =>
                  setIssueForm({ ...issueForm, bulletin_id: e.target.value })
                }
                options={[
                  { value: '', label: 'Select Bulletin' },
                  ...bulletins.map((b) => ({
                    value: b.id,
                    label: `${b.title} (Vol ${b.volume} Iss ${b.issue})`,
                  })),
                ]}
              />

              <Select
                label="Recipient Author"
                required
                value={issueForm.author_id}
                onChange={(e) =>
                  setIssueForm({ ...issueForm, author_id: e.target.value })
                }
                options={[
                  { value: '', label: 'Select Author' },
                  ...authors.map((a) => ({
                    value: a.id,
                    label: `${a.name} (${a.department || 'No dept'})`,
                  })),
                ]}
              />
            </div>

            <Select
              label="Associated Publication (Optional)"
              value={issueForm.publication_id}
              onChange={(e) =>
                setIssueForm({ ...issueForm, publication_id: e.target.value })
              }
              options={[
                { value: '', label: 'None / Independent Certificate' },
                ...publications.map((p) => ({
                  value: p.id,
                  label: `${p.title.slice(0, 80)}...`,
                })),
              ]}
            />

            <div className="vyasa-form-group">
              <label className="vyasa-label">
                <span>Upload Certificate PDF (Optional)</span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setIssueFile(e.target.files?.[0] || null)}
                className="vyasa-input"
                style={{ padding: '8px' }}
              />
            </div>
          </form>
        </Modal>

        {/* Modal: Revoke Certificate (Super Admin Only) */}
        <Modal
          isOpen={showRevokeModal && !!selectedCert}
          onClose={() => setShowRevokeModal(false)}
          title="Revoke Certificate"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowRevokeModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={submitting || revocationReason.trim().length < 5}
                style={{ backgroundColor: '#b91c1c', borderColor: '#b91c1c' }}
                onClick={() => handleSubmitRevocation()}
              >
                {submitting ? 'Revoking...' : 'Confirm Revocation'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmitRevocation} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#92400e',
                lineHeight: 1.5,
              }}
            >
              <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>Important Institutional Action:</p>
              Certificate revocation is irreversible. The certificate status will be marked as revoked, any subsequent verification attempts will fail, and an immutable audit entry will be recorded.
            </div>

            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13.5px', color: '#475569' }}>
                Certificate Number: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f2b48' }}>{selectedCert?.certificate_number}</span>
              </p>
              {selectedCert?.author_name && (
                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                  Recipient: {selectedCert.author_name}
                </p>
              )}
            </div>

            <div className="vyasa-form-group">
              <label className="vyasa-label">
                <span>Mandatory Revocation Reason <span style={{ color: 'var(--vyasa-saffron)' }}>*</span></span>
              </label>
              <textarea
                required
                rows={3}
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                placeholder="Provide detailed institutional justification for this revocation..."
                className="vyasa-input"
                style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                Minimum 5 characters required.
              </span>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
};

export default CertificatesPage;
