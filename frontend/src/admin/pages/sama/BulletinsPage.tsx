import React, { useEffect, useState } from 'react';
import { LoadingState, Button, Badge, Modal, Input, Select, EmptyState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { samaAdminService } from '../../services/samaAdminService';
import {
  ResearchBulletinItem,
  CreateBulletinPayload,
  UpdateBulletinPayload,
  ContentStatus,
  StorageUploadResult,
} from '../../types/sama';
import { useAuth } from '../../../context/AuthContext';

const STATUS_BADGE_VARIANTS: Record<ContentStatus, 'gold' | 'teal' | 'primary' | 'saffron' | 'neutral'> = {
  draft: 'neutral',
  in_review: 'saffron',
  published: 'teal',
  archived: 'neutral',
};

export const BulletinsPage: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const [bulletins, setBulletins] = useState<ResearchBulletinItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  void totalCount;
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & Upload State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadResult, setUploadResult] = useState<StorageUploadResult | null>(null);

  const [addForm, setAddForm] = useState<CreateBulletinPayload>({
    volume_number: 2,
    issue_number: 1,
    title: '',
    publication_period: '',
    file_path: '',
    file_size_bytes: 0,
    checksum_sha256: '',
    publication_count: 0,
    is_active: true,
    status: 'draft',
  });

  const [editingBulletin, setEditingBulletin] = useState<ResearchBulletinItem | null>(null);
  const [editForm, setEditForm] = useState<UpdateBulletinPayload>({});

  const [statusUpdatingBulletin, setStatusUpdatingBulletin] = useState<ResearchBulletinItem | null>(null);
  const [newStatus, setNewStatus] = useState<ContentStatus>('published');
  const [newIsActive, setNewIsActive] = useState(true);

  const [deletingBulletin, setDeletingBulletin] = useState<ResearchBulletinItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Permissions
  const userRoles = (user?.roles || []).map((r) => r.toLowerCase());
  const canEdit =
    isSuperAdmin ||
    userRoles.includes('super_admin') ||
    userRoles.includes('administrator') ||
    userRoles.includes('sama_content_admin') ||
    userRoles.includes('sama_content_editor');

  const canPublish =
    isSuperAdmin ||
    userRoles.includes('super_admin') ||
    userRoles.includes('administrator') ||
    userRoles.includes('sama_content_admin');

  const fetchBulletins = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await samaAdminService.getBulletins({ limit: 50 });
      setBulletins(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch research bulletins.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBulletins();
  }, []);

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Upload PDF Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Only official PDF files are accepted.');
      return;
    }

    try {
      setUploadingPdf(true);
      const result = await samaAdminService.uploadBulletinFile(file);
      setUploadResult(result);
      setAddForm((prev) => ({
        ...prev,
        file_path: result.storage_key,
        file_size_bytes: result.file_size_bytes,
        checksum_sha256: result.checksum_sha256 || '',
      }));
      showFeedback(`File "${result.filename}" uploaded successfully to secure storage.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to upload bulletin PDF');
    } finally {
      setUploadingPdf(false);
    }
  };

  // Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.title.trim() || !addForm.publication_period.trim()) {
      alert('Please fill in title and publication period.');
      return;
    }
    if (!addForm.file_path.trim()) {
      alert('Please upload a bulletin PDF file or provide a storage path.');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await samaAdminService.createBulletin(addForm);
      setIsAddModalOpen(false);
      setUploadResult(null);
      showFeedback(`Bulletin edition "${created.title}" created successfully as ${created.status}.`);
      setAddForm({
        volume_number: 2,
        issue_number: 1,
        title: '',
        publication_period: '',
        file_path: '',
        file_size_bytes: 0,
        checksum_sha256: '',
        publication_count: 0,
        is_active: true,
        status: 'draft',
      });
      fetchBulletins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create bulletin edition');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Submit
  const openEditModal = (bulletin: ResearchBulletinItem) => {
    setEditingBulletin(bulletin);
    setEditForm({
      volume_number: bulletin.volume_number,
      issue_number: bulletin.issue_number,
      title: bulletin.title,
      publication_period: bulletin.publication_period,
      file_path: bulletin.file_path,
      file_size_bytes: bulletin.file_size_bytes,
      publication_count: bulletin.publication_count,
      is_active: bulletin.is_active,
      status: bulletin.status,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBulletin) return;
    try {
      setIsSubmitting(true);
      const updated = await samaAdminService.updateBulletin(editingBulletin.id, editForm);
      setEditingBulletin(null);
      showFeedback(`Bulletin "${updated.title}" updated.`);
      fetchBulletins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update bulletin');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Update Submit
  const handleStatusUpdateSubmit = async () => {
    if (!statusUpdatingBulletin) return;
    try {
      setIsSubmitting(true);
      const updated = await samaAdminService.updateBulletinStatus(
        statusUpdatingBulletin.id,
        newStatus,
        newIsActive
      );
      setStatusUpdatingBulletin(null);
      showFeedback(`Bulletin "${updated.title}" status updated to ${updated.status}.`);
      fetchBulletins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update bulletin status');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Submit
  const handleDeleteSubmit = async () => {
    if (!deletingBulletin) return;
    try {
      setIsSubmitting(true);
      await samaAdminService.deleteBulletin(deletingBulletin.id);
      showFeedback(`Bulletin "${deletingBulletin.title}" deleted.`);
      setDeletingBulletin(null);
      fetchBulletins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete bulletin');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout activeTab="sama-bulletins">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b2811a' }}>
              SAMIKSHA • Institutional Research Publications
            </div>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)' }}>
              Research Bulletins Catalog
            </h1>
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
              + Add Bulletin Edition
            </Button>
          )}
        </div>

        {/* Feedback Messages */}
        {successMsg && (
          <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '14px' }}>
            {successMsg}
          </div>
        )}
        {errorMsg && bulletins.length > 0 && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{errorMsg}</span>
            <Button variant="outline" size="sm" onClick={fetchBulletins}>
              Retry
            </Button>
          </div>
        )}

        {/* Bulletins Table */}
        {loading ? (
          <LoadingState message="Loading official bulletin editions..." />
        ) : errorMsg ? (
          <div
            data-testid="bulletins-error-state"
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
              Failed to load research bulletins
            </div>
            <div style={{ color: '#64748b', fontSize: '14px', maxWidth: '520px', lineHeight: 1.5 }}>
              {errorMsg}
            </div>
            <div style={{ marginTop: '8px' }}>
              <Button variant="primary" size="sm" onClick={fetchBulletins}>
                Retry
              </Button>
            </div>
          </div>
        ) : bulletins.length === 0 ? (
          <EmptyState
            title="No Research Bulletins Found"
            description="No bulletin editions have been documented yet. Upload your first Volume and Issue edition."
            action={
              canEdit ? (
                <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
                  + Add First Bulletin
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="vyasa-table-card" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid var(--vyasa-border, #e3dcd1)', overflowX: 'auto' }}>
            <table className="vyasa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)', borderBottom: '2px solid var(--vyasa-border, #e3dcd1)', color: 'var(--vyasa-primary, #0f2b48)', fontWeight: 600 }}>
                  <th style={{ padding: '12px 16px' }}>Volume • Issue</th>
                  <th style={{ padding: '12px 16px' }}>Edition Title</th>
                  <th style={{ padding: '12px 16px' }}>Period</th>
                  <th style={{ padding: '12px 16px' }}>Publications</th>
                  <th style={{ padding: '12px 16px' }}>Public Catalog</th>
                  <th style={{ padding: '12px 16px' }}>Lifecycle Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bulletins.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--vyasa-border-subtle, #ede7de)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)' }}>
                      Vol. {b.volume_number} • Issue {b.issue_number}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--vyasa-primary, #0f2b48)', fontWeight: 600 }}>
                      {b.title}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {b.publication_period}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant="neutral">{b.publication_count} Papers</Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={b.is_active ? 'teal' : 'neutral'}>
                        {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={STATUS_BADGE_VARIANTS[b.status || 'draft']}>{(b.status || 'draft').toUpperCase()}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {canPublish && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setStatusUpdatingBulletin(b);
                              setNewStatus(b.status);
                              setNewIsActive(b.is_active);
                            }}
                          >
                            Status
                          </Button>
                        )}
                        {canEdit && (
                          <Button variant="outline" size="sm" onClick={() => openEditModal(b)}>
                            Edit
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => setDeletingBulletin(b)}
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
          </div>
        )}

        {/* 1. Add Bulletin Modal */}
        {isAddModalOpen && (
          <Modal title="Add Research Bulletin Edition" isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Volume Number *</label>
                  <Input
                    type="number"
                    value={String(addForm.volume_number)}
                    onChange={(e) => setAddForm({ ...addForm, volume_number: parseInt(e.target.value, 10) || 1 })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Issue Number *</label>
                  <Input
                    type="number"
                    value={String(addForm.issue_number)}
                    onChange={(e) => setAddForm({ ...addForm, issue_number: parseInt(e.target.value, 10) || 1 })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Official Edition Title *</label>
                <Input
                  placeholder="e.g. Volume 2 • Issue 1"
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Publication Period *</label>
                  <Input
                    placeholder="e.g. January – March 2026"
                    value={addForm.publication_period}
                    onChange={(e) => setAddForm({ ...addForm, publication_period: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Total Papers Count</label>
                  <Input
                    type="number"
                    value={String(addForm.publication_count)}
                    onChange={(e) => setAddForm({ ...addForm, publication_count: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>

              {/* Secure Bulletin PDF Upload Section */}
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '14px', backgroundColor: '#f8fafc' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Upload Bulletin PDF Document *
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploadingPdf}
                  style={{ fontSize: '13px' }}
                />
                {uploadingPdf && <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '6px' }}>Validating & uploading PDF...</div>}
                {uploadResult && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#166534', backgroundColor: '#f0fdf4', padding: '6px 10px', borderRadius: '4px' }}>
                    ✓ <strong>{uploadResult.filename}</strong> verified (SHA-256: {uploadResult.checksum_sha256?.slice(0, 16)}...)
                  </div>
                )}
                {addForm.file_path && !uploadResult && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                    Storage key: <code>{addForm.file_path}</code>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Initial Lifecycle Status</label>
                  <Select
                    value={addForm.status || 'draft'}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value as ContentStatus })}
                    options={[
                      { value: 'draft', label: 'Draft (Default)' },
                      { value: 'in_review', label: 'In Review' },
                      { value: 'published', label: 'Published' },
                    ]}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '22px' }}>
                  <input
                    type="checkbox"
                    id="add-bulletin-active"
                    checked={addForm.is_active || false}
                    onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })}
                  />
                  <label htmlFor="add-bulletin-active" style={{ fontSize: '13px', cursor: 'pointer' }}>
                    Active in Public Catalog
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting || uploadingPdf}>
                  {isSubmitting ? 'Saving...' : 'Create Bulletin'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* 2. Edit Bulletin Modal */}
        {editingBulletin && (
          <Modal title={`Edit Bulletin: ${editingBulletin.title}`} isOpen={Boolean(editingBulletin)} onClose={() => setEditingBulletin(null)}>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Title *</label>
                <Input
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Publication Period</label>
                  <Input
                    value={editForm.publication_period || ''}
                    onChange={(e) => setEditForm({ ...editForm, publication_period: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Papers Count</label>
                  <Input
                    type="number"
                    value={String(editForm.publication_count ?? 0)}
                    onChange={(e) => setEditForm({ ...editForm, publication_count: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="edit-bulletin-active"
                  checked={editForm.is_active || false}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                />
                <label htmlFor="edit-bulletin-active" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  Visible on Public Catalog
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <Button variant="outline" size="sm" type="button" onClick={() => setEditingBulletin(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Update Bulletin'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* 3. Status Transition Modal */}
        {statusUpdatingBulletin && (
          <Modal
            title={`Update Bulletin Status: ${statusUpdatingBulletin.title}`}
            isOpen={Boolean(statusUpdatingBulletin)}
            onClose={() => setStatusUpdatingBulletin(null)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Lifecycle Status</label>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ContentStatus)}
                  options={[
                    { value: 'draft', label: 'Draft — Visible only to administrators' },
                    { value: 'in_review', label: 'In Review — Under editorial audit' },
                    { value: 'published', label: 'Published — Live on public research portal' },
                    { value: 'archived', label: 'Archived — Retired from active catalog' },
                  ]}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="status-active"
                  checked={newIsActive}
                  onChange={(e) => setNewIsActive(e.target.checked)}
                />
                <label htmlFor="status-active" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  Catalog Active Flag (is_active)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <Button variant="outline" size="sm" onClick={() => setStatusUpdatingBulletin(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleStatusUpdateSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Save Status'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* 4. Delete Confirmation Modal */}
        {deletingBulletin && (
          <Modal title="Confirm Delete Bulletin" isOpen={Boolean(deletingBulletin)} onClose={() => setDeletingBulletin(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '14px', color: '#0f172a', margin: 0 }}>
                Are you sure you want to delete bulletin edition <strong>{deletingBulletin.title}</strong>?
              </p>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>
                Warning: Publications referencing this edition will lose their bulletin association.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <Button variant="outline" size="sm" onClick={() => setDeletingBulletin(null)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  onClick={handleDeleteSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Edition'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
};
