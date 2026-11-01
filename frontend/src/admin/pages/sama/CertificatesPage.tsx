import React, { useState, useEffect, useCallback } from 'react';
import { AppIcon, Button } from '@vyasa/ui';
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
    setIssueForm({
      certificate_number: `CSJMU/RD/${new Date().getFullYear()}/V1-I1/${Math.floor(100 + Math.random() * 900)}`,
      bulletin_id: bulletins[0]?.id || '',
      author_id: authors[0]?.id || '',
      publication_id: '',
      verification_hash: '',
    });
    setIssueFile(null);
    setShowIssueModal(true);
  };

  // Submit Issue
  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
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

  // Open Revoke Modal
  const handleOpenRevoke = (cert: CertificateRecord) => {
    if (!isSuperAdmin) {
      setError('Only Super Administrators are permitted to revoke certificates.');
      return;
    }
    setSelectedCert(cert);
    setRevocationReason('');
    setShowRevokeModal(true);
  };

  // Submit Revocation
  const handleSubmitRevocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCert) return;
    if (revocationReason.trim().length < 5) {
      setError('A formal revocation reason with at least 5 characters is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await samaAdminService.revokeCertificate(selectedCert.id, {
        revocation_reason: revocationReason.trim(),
      });

      setSuccessMessage(`Certificate ${selectedCert.certificate_number} has been revoked.`);
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

  // Handle Download
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
      <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AppIcon name="check-circle" className="text-blue-600" />
            Certificates Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage research felicitation certificates, institutional hashes, downloads, and Super Admin revocations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenIssue}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <AppIcon name="upload" className="w-4 h-4" />
            Issue Certificate
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && certificates.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300 flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-500 hover:text-green-700">
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-96">
          <div className="relative flex-1">
            <AppIcon
              name="search"
              className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by certificate # or hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'valid' | 'revoked');
              setPage(1);
            }}
            className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Certificates</option>
            <option value="valid">Valid / Active</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-600 rounded-full mb-2"></div>
            <p className="text-sm">Loading certificate ledger...</p>
          </div>
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
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <AppIcon name="check-circle" className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-base font-medium text-gray-700 dark:text-gray-300">No certificates found</p>
            <p className="text-xs text-gray-400 mt-1">
              Issue a certificate or refine your filter query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3">Certificate Number</th>
                  <th className="px-6 py-3">Recipient / Author</th>
                  <th className="px-6 py-3">Bulletin</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Hash / Verification</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                    <td className="px-6 py-4 font-mono font-medium text-gray-900 dark:text-white">
                      {cert.certificate_number}
                      <div className="text-xs font-sans text-gray-400">
                        Issued: {new Date(cert.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {cert.author_name || 'Author ID: ' + cert.author_id.slice(0, 8)}
                      </div>
                      {cert.author_department && (
                        <div className="text-xs text-gray-400">{cert.author_department}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cert.bulletin_title ? (
                        <div>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {cert.bulletin_title}
                          </div>
                          {(cert.bulletin_volume != null || cert.bulletin_issue != null) && (
                            <div className="text-xs text-gray-400">
                              Vol. {cert.bulletin_volume} Issue {cert.bulletin_issue}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-mono">
                          {cert.bulletin_id.slice(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cert.is_revoked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                          Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                          Valid
                        </span>
                      )}
                      {cert.is_revoked && cert.revocation_reason && (
                        <div className="text-xs text-red-500 dark:text-red-400 mt-1 max-w-xs truncate" title={cert.revocation_reason}>
                          Reason: {cert.revocation_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                      <span title={cert.verification_hash || cert.checksum_sha256 || undefined}>
                        {cert.verification_hash ? `${cert.verification_hash.slice(0, 16)}...` : cert.checksum_sha256 ? `${cert.checksum_sha256.slice(0, 16)}...` : 'Verified'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleDownload(cert)}
                        disabled={downloadingId === cert.id}
                        className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition disabled:opacity-50"
                        title="Download Certificate PDF"
                      >
                        {downloadingId === cert.id ? 'Downloading...' : 'PDF'}
                      </button>

                      {!cert.is_revoked && (
                        <button
                          onClick={() => handleOpenRevoke(cert)}
                          disabled={!isSuperAdmin}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded transition ${
                            isSuperAdmin
                              ? 'text-red-600 hover:text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30'
                              : 'text-gray-400 border border-gray-200 dark:border-gray-800 cursor-not-allowed opacity-60'
                          }`}
                          title={
                            isSuperAdmin
                              ? 'Revoke Certificate'
                              : 'Revocation is strictly restricted to Super Administrators'
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Showing {certificates.length} of {totalCount} certificates
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded disabled:opacity-50 transition"
            >
              Previous
            </button>
            <span className="px-2 py-1">Page {page}</span>
            <button
              disabled={page * limit >= totalCount}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded disabled:opacity-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Issue Certificate */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-xl w-full border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Issue Felicitation Certificate
              </h2>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <AppIcon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitIssue} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Certificate Number *
                </label>
                <input
                  type="text"
                  required
                  value={issueForm.certificate_number}
                  onChange={(e) =>
                    setIssueForm({ ...issueForm, certificate_number: e.target.value })
                  }
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="e.g. CSJMU/RD/2026/V1-I1/001"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Bulletin Reference *
                  </label>
                  <select
                    required
                    value={issueForm.bulletin_id}
                    onChange={(e) =>
                      setIssueForm({ ...issueForm, bulletin_id: e.target.value })
                    }
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Bulletin</option>
                    {bulletins.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} (Vol {b.volume} Iss {b.issue})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Recipient Author *
                  </label>
                  <select
                    required
                    value={issueForm.author_id}
                    onChange={(e) =>
                      setIssueForm({ ...issueForm, author_id: e.target.value })
                    }
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Author</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.department || 'No dept'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Associated Publication (Optional)
                </label>
                <select
                  value={issueForm.publication_id}
                  onChange={(e) =>
                    setIssueForm({ ...issueForm, publication_id: e.target.value })
                  }
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None / Independent Certificate</option>
                  {publications.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title.slice(0, 80)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Upload Certificate PDF (Optional)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setIssueFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/40 dark:file:text-blue-300 hover:file:bg-blue-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Issuing...' : 'Confirm Issuance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Revoke Certificate (Super Admin Only) */}
      {showRevokeModal && selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-2">
                <AppIcon name="shield" className="text-red-600" />
                <h2 className="text-lg font-bold text-red-700 dark:text-red-300">
                  Revoke Certificate
                </h2>
              </div>
              <button
                onClick={() => setShowRevokeModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <AppIcon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRevocation} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                <p className="font-semibold mb-1">Important Institutional Action:</p>
                Certificate revocation is irreversible. The certificate status will be marked as revoked, any subsequent verification attempts will fail, and an immutable audit entry will be recorded.
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Certificate Number: <span className="font-mono text-gray-900 dark:text-white">{selectedCert.certificate_number}</span>
                </p>
                {selectedCert.author_name && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Recipient: {selectedCert.author_name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Mandatory Revocation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  placeholder="Provide detailed institutional justification for this revocation..."
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum 5 characters required.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || revocationReason.trim().length < 5}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
};

export default CertificatesPage;
