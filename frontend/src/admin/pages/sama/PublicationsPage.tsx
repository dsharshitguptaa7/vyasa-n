import React, { useEffect, useState } from 'react';
import { LoadingState, Button, Badge, Modal, Input, Select, EmptyState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { samaAdminService } from '../../services/samaAdminService';
import {
  ResearchPublicationItem,
  ResearchBulletinItem,
  CreatePublicationPayload,
  UpdatePublicationPayload,
  ContentStatus,
} from '../../types/sama';
import { useAuth } from '../../../context/AuthContext';

const STATUS_BADGE_VARIANTS: Record<ContentStatus, 'gold' | 'teal' | 'primary' | 'saffron' | 'neutral'> = {
  draft: 'neutral',
  in_review: 'saffron',
  published: 'teal',
  archived: 'neutral',
};

const CATEGORIES = [
  'Article',
  'Review',
  'Conference Paper',
  'Book Chapter',
  'Book',
  'Short Survey',
  'Editorial',
  'Letter',
];

export const PublicationsPage: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const [publications, setPublications] = useState<ResearchPublicationItem[]>([]);
  const [bulletins, setBulletins] = useState<ResearchBulletinItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<CreatePublicationPayload>({
    bulletin_id: '',
    serial_no: 1,
    slug: '',
    title: '',
    source_journal: '',
    category: 'Article',
    doi: '',
    author_display: '',
    authors_complete: true,
    status: 'draft',
    abstract: '',
    external_url: '',
    is_featured: false,
  });

  const [editingPub, setEditingPub] = useState<ResearchPublicationItem | null>(null);
  const [editForm, setEditForm] = useState<UpdatePublicationPayload>({});

  const [deletingPub, setDeletingPub] = useState<ResearchPublicationItem | null>(null);
  const [statusUpdatingPub, setStatusUpdatingPub] = useState<ResearchPublicationItem | null>(null);
  const [newStatus, setNewStatus] = useState<ContentStatus>('published');
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

  const fetchPublications = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const skip = (currentPage - 1) * pageSize;
      const res = await samaAdminService.getPublications({
        skip,
        limit: pageSize,
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      });
      setPublications(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch publications');
    } finally {
      setLoading(false);
    }
  };

  const fetchBulletins = async () => {
    try {
      const res = await samaAdminService.getBulletins({ limit: 100 });
      setBulletins(res.items);
      if (res.items.length > 0 && !addForm.bulletin_id) {
        setAddForm((prev) => ({ ...prev, bulletin_id: res.items[0].id }));
      }
    } catch {
      // Non-blocking fallback
    }
  };

  useEffect(() => {
    fetchBulletins();
  }, []);

  useEffect(() => {
    fetchPublications();
  }, [currentPage, statusFilter, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPublications();
  };

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Add flow
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.title.trim() || !addForm.slug.trim() || !addForm.source_journal.trim()) {
      alert('Please fill in title, slug, and source journal.');
      return;
    }
    if (!addForm.bulletin_id.trim()) {
      alert('Please select a valid Bulletin Edition.');
      return;
    }
    try {
      setIsSubmitting(true);
      const created = await samaAdminService.createPublication(addForm);
      setIsAddModalOpen(false);
      showFeedback(`Publication "${created.title.slice(0, 30)}..." created successfully as ${created.status}.`);
      setAddForm({
        bulletin_id: bulletins[0]?.id || '',
        serial_no: 1,
        slug: '',
        title: '',
        source_journal: '',
        category: 'Article',
        doi: '',
        author_display: '',
        authors_complete: true,
        status: 'draft',
        abstract: '',
        external_url: '',
        is_featured: false,
      });
      fetchPublications();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create publication');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit flow
  const openEditModal = (pub: ResearchPublicationItem) => {
    setEditingPub(pub);
    setEditForm({
      bulletin_id: pub.bulletin_id,
      serial_no: pub.serial_no,
      slug: pub.slug,
      title: pub.title,
      source_journal: pub.source_journal,
      category: pub.category,
      doi: pub.doi || '',
      author_display: pub.author_display,
      authors_complete: pub.authors_complete,
      status: pub.status,
      abstract: pub.abstract || '',
      external_url: pub.external_url || '',
      is_featured: pub.is_featured,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPub) return;
    try {
      setIsSubmitting(true);
      const updated = await samaAdminService.updatePublication(editingPub.id, editForm);
      setEditingPub(null);
      showFeedback(`Publication "${updated.title.slice(0, 30)}..." updated successfully.`);
      fetchPublications();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update publication');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status transition flow
  const handleStatusUpdateSubmit = async () => {
    if (!statusUpdatingPub) return;
    try {
      setIsSubmitting(true);
      const updated = await samaAdminService.updatePublicationStatus(statusUpdatingPub.id, newStatus);
      setStatusUpdatingPub(null);
      showFeedback(`Status for "${updated.slug}" updated to "${updated.status}".`);
      fetchPublications();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete flow
  const handleDeleteSubmit = async () => {
    if (!deletingPub) return;
    try {
      setIsSubmitting(true);
      await samaAdminService.deletePublication(deletingPub.id);
      showFeedback(`Publication "${deletingPub.slug}" deleted permanently.`);
      setDeletingPub(null);
      fetchPublications();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete publication');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <AdminLayout activeTab="sama-publications">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b2811a' }}>
              SAMIKSHA • Scholarly Works Repository
            </div>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)' }}>
              Research Publications Ledger
            </h1>
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
              + Add Publication
            </Button>
          )}
        </div>

        {/* Feedback Notifications */}
        {successMsg && (
          <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '14px' }}>
            {successMsg}
          </div>
        )}
        {errorMsg && publications.length > 0 && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{errorMsg}</span>
            <Button variant="outline" size="sm" onClick={fetchPublications}>
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
              placeholder="Search by title, DOI, author, or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button variant="outline" size="sm" type="submit">
              Search
            </Button>
          </form>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'in_review', label: 'In Review' },
                { value: 'published', label: 'Published' },
                { value: 'archived', label: 'Archived' },
              ]}
              style={{ minWidth: '130px' }}
            />

            <Select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Categories' },
                ...CATEGORIES.map((cat) => ({ value: cat, label: cat })),
              ]}
              style={{ minWidth: '140px' }}
            />

            {(searchQuery || statusFilter || categoryFilter) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('');
                  setCategoryFilter('');
                  setCurrentPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Publications Data Table */}
        {loading ? (
          <LoadingState message="Loading publications catalog..." />
        ) : errorMsg ? (
          <div
            data-testid="publications-error-state"
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
              Failed to load publications catalog
            </div>
            <div style={{ color: '#64748b', fontSize: '14px', maxWidth: '520px', lineHeight: 1.5 }}>
              {errorMsg}
            </div>
            <div style={{ marginTop: '8px' }}>
              <Button variant="primary" size="sm" onClick={fetchPublications}>
                Retry
              </Button>
            </div>
          </div>
        ) : publications.length === 0 ? (
          <EmptyState
            title="No Research Publications Found"
            description="No publications match your current filters. Add a new publication or refine your search."
            action={
              canEdit ? (
                <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
                  + Add First Publication
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="vyasa-table-card" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid var(--vyasa-border, #e3dcd1)', overflowX: 'auto' }}>
            <table className="vyasa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)', borderBottom: '2px solid var(--vyasa-border, #e3dcd1)', color: 'var(--vyasa-primary, #0f2b48)', fontWeight: 600 }}>
                  <th style={{ padding: '12px 16px' }}>Slug / Serial</th>
                  <th style={{ padding: '12px 16px' }}>Title & Source Journal</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Author Citation</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {publications.map((pub) => (
                  <tr key={pub.id} style={{ borderBottom: '1px solid var(--vyasa-border-subtle, #ede7de)' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)' }}>{pub.slug}</span>
                      <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)' }}>#{pub.serial_no}</div>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '380px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '2px', lineHeight: 1.4 }}>
                        {pub.title}
                        {pub.is_featured && (
                          <Badge variant="saffron" style={{ marginLeft: '6px', fontSize: '10px' }}>
                            Featured
                          </Badge>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {pub.source_journal} {pub.doi && `• DOI: ${pub.doi}`}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <Badge variant="neutral">{pub.category}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '240px', fontSize: '12.5px', color: '#334155' }}>
                      {pub.author_display}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <Badge variant={STATUS_BADGE_VARIANTS[pub.status || 'draft']}>{(pub.status || 'draft').toUpperCase()}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {canPublish && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setStatusUpdatingPub(pub);
                              setNewStatus(pub.status);
                            }}
                          >
                            Status
                          </Button>
                        )}
                        {canEdit && (
                          <Button variant="outline" size="sm" onClick={() => openEditModal(pub)}>
                            Edit
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => setDeletingPub(pub)}
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

        {/* 1. Add Publication Modal */}
        {isAddModalOpen && (
          <Modal title="Add Research Publication" isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Research Bulletin Edition *
                </label>
                <Select
                  value={addForm.bulletin_id}
                  onChange={(e) => setAddForm({ ...addForm, bulletin_id: e.target.value })}
                  options={bulletins.map((b) => ({
                    value: b.id,
                    label: `${b.title} (${b.publication_period})`,
                  }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Serial No *</label>
                  <Input
                    type="number"
                    value={String(addForm.serial_no)}
                    onChange={(e) => setAddForm({ ...addForm, serial_no: parseInt(e.target.value, 10) || 1 })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Slug Identifier *</label>
                  <Input
                    placeholder="e.g. v2-i1-r048"
                    value={addForm.slug}
                    onChange={(e) => setAddForm({ ...addForm, slug: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Title *</label>
                <Input
                  placeholder="Complete scholarly article title"
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Source Journal *</label>
                  <Input
                    placeholder="Journal or conference name"
                    value={addForm.source_journal}
                    onChange={(e) => setAddForm({ ...addForm, source_journal: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Category *</label>
                  <Select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Author Citation *</label>
                <Input
                  placeholder="e.g. Kumar C.S., Sharma N., Patel R."
                  value={addForm.author_display}
                  onChange={(e) => setAddForm({ ...addForm, author_display: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>DOI</label>
                  <Input
                    placeholder="10.1016/j.physletb.2026.01.002"
                    value={addForm.doi || ''}
                    onChange={(e) => setAddForm({ ...addForm, doi: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Lifecycle Status</label>
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
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Abstract / Summary</label>
                <textarea
                  style={{ width: '100%', minHeight: '70px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  placeholder="Abstract text or publication executive summary..."
                  value={addForm.abstract || ''}
                  onChange={(e) => setAddForm({ ...addForm, abstract: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="add-featured"
                  checked={addForm.is_featured || false}
                  onChange={(e) => setAddForm({ ...addForm, is_featured: e.target.checked })}
                />
                <label htmlFor="add-featured" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  Feature this publication on research showcase landing views
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Create Publication'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* 2. Edit Publication Modal */}
        {editingPub && (
          <Modal title={`Edit Publication (${editingPub.slug})`} isOpen={Boolean(editingPub)} onClose={() => setEditingPub(null)}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Source Journal *</label>
                  <Input
                    value={editForm.source_journal || ''}
                    onChange={(e) => setEditForm({ ...editForm, source_journal: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Category *</label>
                  <Select
                    value={editForm.category || 'Article'}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Author Citation *</label>
                <Input
                  value={editForm.author_display || ''}
                  onChange={(e) => setEditForm({ ...editForm, author_display: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>DOI</label>
                  <Input
                    value={editForm.doi || ''}
                    onChange={(e) => setEditForm({ ...editForm, doi: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Slug</label>
                  <Input
                    value={editForm.slug || ''}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Abstract</label>
                <textarea
                  style={{ width: '100%', minHeight: '70px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  value={editForm.abstract || ''}
                  onChange={(e) => setEditForm({ ...editForm, abstract: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="edit-featured"
                  checked={editForm.is_featured || false}
                  onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })}
                />
                <label htmlFor="edit-featured" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  Feature this publication on research showcase landing views
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <Button variant="outline" size="sm" type="button" onClick={() => setEditingPub(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Update Publication'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* 3. Status Transition Modal */}
        {statusUpdatingPub && (
          <Modal
            title={`Update Publication Status: ${statusUpdatingPub.slug}`}
            isOpen={Boolean(statusUpdatingPub)}
            onClose={() => setStatusUpdatingPub(null)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13.5px', color: '#475569', margin: 0 }}>
                Current lifecycle status for <strong>{statusUpdatingPub.title}</strong> is{' '}
                <Badge variant={STATUS_BADGE_VARIANTS[statusUpdatingPub.status]}>
                  {statusUpdatingPub.status.toUpperCase()}
                </Badge>
                . Select target state:
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  New Lifecycle Status *
                </label>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <Button variant="outline" size="sm" onClick={() => setStatusUpdatingPub(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleStatusUpdateSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Confirm Status Update'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* 4. Delete Confirmation Modal */}
        {deletingPub && (
          <Modal
            title="Confirm Deletion"
            isOpen={Boolean(deletingPub)}
            onClose={() => setDeletingPub(null)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '14px', color: '#0f172a', margin: 0 }}>
                Are you sure you want to permanently delete publication{' '}
                <strong>{deletingPub.slug}</strong> — <em>"{deletingPub.title}"</em>?
              </p>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>
                Warning: This will remove all associated author link citations and cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <Button variant="outline" size="sm" onClick={() => setDeletingPub(null)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  onClick={handleDeleteSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Permanently'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
};
