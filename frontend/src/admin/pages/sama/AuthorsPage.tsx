import React, { useEffect, useState } from 'react';
import { LoadingState, Button, Badge, Modal, Input, Select, EmptyState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { samaAdminService } from '../../services/samaAdminService';
import { ResearchAuthorItem, CreateAuthorPayload, UpdateAuthorPayload, AuthorVerificationPayload } from '../../types/sama';
import { useAuth } from '../../../context/AuthContext';

export const AuthorsPage: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const [authors, setAuthors] = useState<ResearchAuthorItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<CreateAuthorPayload>({
    full_name: '',
    scopus_id: '',
    department: '',
    institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
    is_verified: false,
    verification_notes: '',
  });

  const [editingAuthor, setEditingAuthor] = useState<ResearchAuthorItem | null>(null);
  const [editForm, setEditForm] = useState<UpdateAuthorPayload>({});

  const [verifyingAuthor, setVerifyingAuthor] = useState<ResearchAuthorItem | null>(null);
  const [verifyForm, setVerifyForm] = useState<AuthorVerificationPayload>({
    is_verified: true,
    scopus_id: '',
    verification_notes: '',
  });

  const [deletingAuthor, setDeletingAuthor] = useState<ResearchAuthorItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Permissions
  const userRoles = (user?.roles || []).map((r) => r.toLowerCase());
  const canEdit =
    isSuperAdmin ||
    userRoles.includes('super_admin') ||
    userRoles.includes('administrator') ||
    userRoles.includes('sama_content_admin') ||
    userRoles.includes('sama_content_editor');

  const canVerify =
    isSuperAdmin ||
    userRoles.includes('super_admin') ||
    userRoles.includes('administrator') ||
    userRoles.includes('sama_content_admin');

  const fetchAuthors = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const skip = (currentPage - 1) * pageSize;
      const isVerified = verificationFilter === '' ? undefined : verificationFilter === 'true';
      const res = await samaAdminService.getAuthors({
        skip,
        limit: pageSize,
        search: searchQuery || undefined,
        is_verified: isVerified,
      });
      setAuthors(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch authors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, [currentPage, verificationFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAuthors();
  };

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Add flow
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.full_name.trim()) {
      alert('Author full name is required.');
      return;
    }
    try {
      setIsSubmitting(true);
      const created = await samaAdminService.createAuthor(addForm);
      setIsAddModalOpen(false);
      showFeedback(`Author "${created.full_name}" registered successfully.`);
      setAddForm({
        full_name: '',
        scopus_id: '',
        department: '',
        institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
        is_verified: false,
        verification_notes: '',
      });
      fetchAuthors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create author');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit flow
  const openEditModal = (author: ResearchAuthorItem) => {
    setEditingAuthor(author);
    setEditForm({
      full_name: author.full_name,
      scopus_id: author.scopus_id || '',
      department: author.department || '',
      institutional_affiliation: author.institutional_affiliation,
      verification_notes: author.verification_notes || '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAuthor) return;
    try {
      setIsSubmitting(true);
      const updated = await samaAdminService.updateAuthor(editingAuthor.id, editForm);
      setEditingAuthor(null);
      showFeedback(`Author "${updated.full_name}" updated successfully.`);
      fetchAuthors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update author');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify Scopus flow
  const openVerifyModal = (author: ResearchAuthorItem) => {
    setVerifyingAuthor(author);
    setVerifyForm({
      is_verified: !author.is_verified,
      scopus_id: author.scopus_id || '',
      verification_notes: author.verification_notes || '',
    });
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingAuthor) return;
    try {
      setIsSubmitting(true);
      const updated = await samaAdminService.verifyAuthor(verifyingAuthor.id, verifyForm);
      setVerifyingAuthor(null);
      showFeedback(
        `Author "${updated.full_name}" identity updated to ${
          updated.is_verified ? 'VERIFIED' : 'PROVISIONAL'
        }.`
      );
      fetchAuthors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to verify author');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete flow
  const handleDeleteSubmit = async () => {
    if (!deletingAuthor) return;
    try {
      setIsSubmitting(true);
      await samaAdminService.deleteAuthor(deletingAuthor.id);
      showFeedback(`Author "${deletingAuthor.full_name}" deleted.`);
      setDeletingAuthor(null);
      fetchAuthors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete author');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <AdminLayout activeTab="sama-authors">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b2811a' }}>
              SAMIKSHA • Faculty & Scholar Directory
            </div>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)' }}>
              Authors & Scopus Identity Review
            </h1>
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
              + Register Author
            </Button>
          )}
        </div>

        {/* Feedback Notifications */}
        {successMsg && (
          <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '14px' }}>
            {successMsg}
          </div>
        )}
        {errorMsg && authors.length > 0 && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{errorMsg}</span>
            <Button variant="outline" size="sm" onClick={fetchAuthors}>
              Retry
            </Button>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#ffffff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1 1 300px' }}>
            <Input
              placeholder="Search by author name, department, or Scopus ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button variant="outline" size="sm" type="submit">
              Search
            </Button>
          </form>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Select
              value={verificationFilter}
              onChange={(e) => {
                setVerificationFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Identity States' },
                { value: 'true', label: 'Verified Scopus Only' },
                { value: 'false', label: 'Provisional Only' },
              ]}
              style={{ minWidth: '160px' }}
            />

            {(searchQuery || verificationFilter) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setVerificationFilter('');
                  setCurrentPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Authors Table */}
        {loading ? (
          <LoadingState message="Loading authors index..." />
        ) : errorMsg ? (
          <div
            data-testid="authors-error-state"
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
              Failed to load authors index
            </div>
            <div style={{ color: '#64748b', fontSize: '14px', maxWidth: '520px', lineHeight: 1.5 }}>
              {errorMsg}
            </div>
            <div style={{ marginTop: '8px' }}>
              <Button variant="primary" size="sm" onClick={fetchAuthors}>
                Retry
              </Button>
            </div>
          </div>
        ) : authors.length === 0 ? (
          <EmptyState
            title="No Research Authors Found"
            description="No author profiles match your current search criteria."
            action={
              canEdit ? (
                <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
                  + Register First Author
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="vyasa-table-card" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid var(--vyasa-border, #e3dcd1)', overflowX: 'auto' }}>
            <table className="vyasa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)', borderBottom: '2px solid var(--vyasa-border, #e3dcd1)', color: 'var(--vyasa-primary, #0f2b48)', fontWeight: 600 }}>
                  <th style={{ padding: '12px 16px' }}>Researcher Name</th>
                  <th style={{ padding: '12px 16px' }}>Scopus Identifier</th>
                  <th style={{ padding: '12px 16px' }}>Department</th>
                  <th style={{ padding: '12px 16px' }}>Identity Status</th>
                  <th style={{ padding: '12px 16px' }}>Curation Notes</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {authors.map((author) => (
                  <tr key={author.id} style={{ borderBottom: '1px solid var(--vyasa-border-subtle, #ede7de)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)' }}>{author.full_name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--vyasa-text-muted, #64748b)' }}>{author.institutional_affiliation}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12.5px' }}>
                      {author.scopus_id ? (
                        <a
                          href={`https://www.scopus.com/authid/detail.uri?authorId=${author.scopus_id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#2563eb', textDecoration: 'none' }}
                        >
                          {author.scopus_id} ↗
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>
                      {author.department || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {author.is_verified ? (
                        <Badge variant="teal">VERIFIED</Badge>
                      ) : (
                        <Badge variant="saffron">PROVISIONAL</Badge>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '220px', fontSize: '12px', color: '#64748b' }}>
                      {author.verification_notes || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {canVerify && (
                          <Button variant="outline" size="sm" onClick={() => openVerifyModal(author)}>
                            {author.is_verified ? 'Review' : 'Verify'}
                          </Button>
                        )}
                        {canEdit && (
                          <Button variant="outline" size="sm" onClick={() => openEditModal(author)}>
                            Edit
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => setDeletingAuthor(author)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                fontSize: '13px',
                color: '#64748b',
              }}
            >
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, totalCount)} of {totalCount} records
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 600 }}>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 1. Register Author Modal */}
        {isAddModalOpen && (
          <Modal title="Register Researcher Author" isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Full Name *
                </label>
                <Input
                  placeholder="e.g. Dr. Chandra Shekhar Kumar"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Scopus ID
                </label>
                <Input
                  placeholder="e.g. 59650228300 (Optional, can be linked later)"
                  value={addForm.scopus_id || ''}
                  onChange={(e) => setAddForm({ ...addForm, scopus_id: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Department / School
                </label>
                <Input
                  placeholder="e.g. School of Basic Sciences, Physics"
                  value={addForm.department || ''}
                  onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Institutional Affiliation *
                </label>
                <Input
                  value={addForm.institutional_affiliation}
                  onChange={(e) => setAddForm({ ...addForm, institutional_affiliation: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Initial Curation Notes
                </label>
                <textarea
                  style={{ width: '100%', minHeight: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  placeholder="Notes on profile origin, department roster, or provisional Scopus match..."
                  value={addForm.verification_notes || ''}
                  onChange={(e) => setAddForm({ ...addForm, verification_notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Registering...' : 'Register Author'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* 2. Edit Author Modal */}
        {editingAuthor && (
          <Modal title={`Edit Author: ${editingAuthor.full_name}`} isOpen={Boolean(editingAuthor)} onClose={() => setEditingAuthor(null)}>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Full Name *</label>
                <Input
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Scopus ID</label>
                <Input
                  value={editForm.scopus_id || ''}
                  onChange={(e) => setEditForm({ ...editForm, scopus_id: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Department</label>
                <Input
                  value={editForm.department || ''}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Institutional Affiliation</label>
                <Input
                  value={editForm.institutional_affiliation || ''}
                  onChange={(e) => setEditForm({ ...editForm, institutional_affiliation: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Curation Notes</label>
                <textarea
                  style={{ width: '100%', minHeight: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  value={editForm.verification_notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, verification_notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <Button variant="outline" size="sm" type="button" onClick={() => setEditingAuthor(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Update Author'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* 3. Scopus Review & Verify Modal */}
        {verifyingAuthor && (
          <Modal
            title={`Scopus Identity Review: ${verifyingAuthor.full_name}`}
            isOpen={Boolean(verifyingAuthor)}
            onClose={() => setVerifyingAuthor(null)}
          >
            <form onSubmit={handleVerifySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                <div><strong>Current Identity:</strong> {verifyingAuthor.full_name}</div>
                <div><strong>Department:</strong> {verifyingAuthor.department || 'Unassigned'}</div>
                <div><strong>Status:</strong> {verifyingAuthor.is_verified ? 'Verified Institutional Author' : 'Provisional Record'}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Confirmed Scopus Identifier
                </label>
                <Input
                  placeholder="e.g. 59650228300"
                  value={verifyForm.scopus_id || ''}
                  onChange={(e) => setVerifyForm({ ...verifyForm, scopus_id: e.target.value })}
                />
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Ensure this Scopus ID maps officially to CSJMU university author records.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0' }}>
                <input
                  type="checkbox"
                  id="verify-checkbox"
                  checked={verifyForm.is_verified}
                  onChange={(e) => setVerifyForm({ ...verifyForm, is_verified: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="verify-checkbox" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: '#0f172a' }}>
                  Officially Confirm & Verify Author Identity
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Audit Trail Verification Rationale *
                </label>
                <textarea
                  style={{ width: '100%', minHeight: '75px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  placeholder="Document source of confirmation (e.g. Scopus author profile verified via CSJMU R&D Cell portal registry)..."
                  value={verifyForm.verification_notes || ''}
                  onChange={(e) => setVerifyForm({ ...verifyForm, verification_notes: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <Button variant="outline" size="sm" type="button" onClick={() => setVerifyingAuthor(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Save Verification State'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* 4. Delete Author Confirmation Modal */}
        {deletingAuthor && (
          <Modal title="Confirm Delete Author" isOpen={Boolean(deletingAuthor)} onClose={() => setDeletingAuthor(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '14px', color: '#0f172a', margin: 0 }}>
                Are you sure you want to delete author <strong>{deletingAuthor.full_name}</strong>?
              </p>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>
                This will remove author affiliations from publications and certificates.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <Button variant="outline" size="sm" onClick={() => setDeletingAuthor(null)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  onClick={handleDeleteSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Author'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
};
