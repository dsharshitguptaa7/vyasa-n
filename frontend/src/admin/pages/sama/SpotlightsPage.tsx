import React, { useState, useEffect, useCallback } from 'react';
import { AppIcon, Button, Badge, Modal, Input, Select, EmptyState, LoadingState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { samaAdminService } from '../../services/samaAdminService';
import type { SpotlightRecord, AuthorRecord, CreateSpotlightPayload } from '../../types/sama';

export const SpotlightsPage: React.FC = () => {
  // State
  const [spotlights, setSpotlights] = useState<SpotlightRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Auxiliary data
  const [authors, setAuthors] = useState<AuthorRecord[]>([]);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSpotlight, setEditingSpotlight] = useState<SpotlightRecord | null>(null);
  const [spotlightToDelete, setSpotlightToDelete] = useState<SpotlightRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    headline: '',
    summary: '',
    media_type: 'photo' as 'photo' | 'video' | 'interview',
    media_url: '',
    video_embed_url: '',
    display_order: 0,
    is_active: true,
    author_id: '',
  });

  // Fetch spotlights
  const fetchSpotlights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const isActiveParam =
        activeFilter === 'all' ? undefined : activeFilter === 'active';

      const res = await samaAdminService.getSpotlights({
        skip: (page - 1) * limit,
        limit,
        media_type: mediaTypeFilter === 'all' ? undefined : mediaTypeFilter,
        is_active: isActiveParam,
      });

      setSpotlights(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to load spotlights');
    } finally {
      setLoading(false);
    }
  }, [page, mediaTypeFilter, activeFilter]);

  // Load authors for selection
  const loadAuthors = async () => {
    try {
      const res = await samaAdminService.getAuthors({ limit: 100 });
      setAuthors(res.items);
    } catch (err) {
      console.warn('Failed to load authors for spotlight modal', err);
    }
  };

  useEffect(() => {
    fetchSpotlights();
  }, [fetchSpotlights]);

  useEffect(() => {
    loadAuthors();
  }, []);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingSpotlight(null);
    setFormData({
      headline: '',
      summary: '',
      media_type: 'photo',
      media_url: '',
      video_embed_url: '',
      display_order: spotlights.length + 1,
      is_active: true,
      author_id: '',
    });
    setShowAddEditModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (spotlight: SpotlightRecord) => {
    setEditingSpotlight(spotlight);
    setFormData({
      headline: spotlight.headline,
      summary: spotlight.summary,
      media_type: (spotlight.media_type as 'photo' | 'video' | 'interview') || 'photo',
      media_url: spotlight.media_url || '',
      video_embed_url: spotlight.video_embed_url || '',
      display_order: spotlight.display_order,
      is_active: spotlight.is_active,
      author_id: spotlight.author_id || '',
    });
    setShowAddEditModal(true);
  };

  // Save Spotlight
  const handleSaveSpotlight = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.headline.trim() || !formData.summary.trim()) {
      setError('Headline and Summary are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: CreateSpotlightPayload = {
        headline: formData.headline.trim(),
        summary: formData.summary.trim(),
        media_type: formData.media_type,
        media_url: formData.media_url.trim() || '',
        video_embed_url: formData.video_embed_url.trim() || undefined,
        display_order: Number(formData.display_order),
        is_active: formData.is_active,
        author_id: formData.author_id || undefined,
      };

      if (editingSpotlight) {
        await samaAdminService.updateSpotlight(editingSpotlight.id, payload);
        setSuccessMessage('Spotlight updated successfully.');
      } else {
        await samaAdminService.createSpotlight(payload);
        setSuccessMessage('Spotlight published successfully.');
      }

      setShowAddEditModal(false);
      fetchSpotlights();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to save spotlight');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Active quick action
  const handleToggleActive = async (spotlight: SpotlightRecord) => {
    try {
      const updatedStatus = !spotlight.is_active;
      await samaAdminService.updateSpotlight(spotlight.id, { is_active: updatedStatus });
      setSuccessMessage(
        `Spotlight "${spotlight.headline.slice(0, 30)}..." marked ${
          updatedStatus ? 'Active' : 'Hidden'
        }.`
      );
      fetchSpotlights();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to update spotlight status');
    }
  };

  // Delete Spotlight
  const handleDeleteConfirm = async () => {
    if (!spotlightToDelete) return;
    try {
      setSubmitting(true);
      setError(null);
      await samaAdminService.deleteSpotlight(spotlightToDelete.id);
      setSuccessMessage('Spotlight deleted successfully.');
      setShowDeleteModal(false);
      setSpotlightToDelete(null);
      fetchSpotlights();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to delete spotlight');
    } finally {
      setSubmitting(false);
    }
  };

  const getMediaTypeBadge = (type: string) => {
    switch (type) {
      case 'video':
        return <Badge variant="saffron">Video</Badge>;
      case 'interview':
        return <Badge variant="teal">Interview</Badge>;
      default:
        return <Badge variant="primary">Photo / Feature</Badge>;
    }
  };

  return (
    <AdminLayout activeTab="sama-spotlights">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Top Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b2811a' }}>
              SAMIKSHA • Faculty Highlights & Media
            </div>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="settings" size={22} color="var(--vyasa-primary, #0f2b48)" />
              Researcher Spotlights Management
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#64748b' }}>
              Curate prominent faculty achievements, featured media showcases, interviews, and public research spotlights.
            </p>
          </div>
          <div>
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              <AppIcon name="upload" size={14} style={{ marginRight: '6px' }} />
              New Spotlight
            </Button>
          </div>
        </div>

        {/* Notifications */}
        {error && spotlights.length > 0 && (
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

        {/* Filters */}
        <div
          style={{
            display: 'flex',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Media Type:</span>
            <Select
              value={mediaTypeFilter}
              onChange={(e) => {
                setMediaTypeFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Media' },
                { value: 'photo', label: 'Photo / Feature' },
                { value: 'video', label: 'Video' },
                { value: 'interview', label: 'Interview' },
              ]}
              style={{ minWidth: '150px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Visibility:</span>
            <Select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value as 'all' | 'active' | 'inactive');
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Visibility' },
                { value: 'active', label: 'Active Only' },
                { value: 'inactive', label: 'Hidden / Inactive' },
              ]}
              style={{ minWidth: '150px' }}
            />
          </div>
        </div>

        {/* Spotlights Table */}
        {loading ? (
          <LoadingState message="Loading spotlights..." />
        ) : error ? (
          <div
            data-testid="spotlights-error-state"
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
              Failed to load researcher spotlights
            </div>
            <div style={{ color: '#64748b', fontSize: '14px', maxWidth: '520px', lineHeight: 1.5 }}>
              {error}
            </div>
            <div style={{ marginTop: '8px' }}>
              <Button variant="primary" size="sm" onClick={fetchSpotlights}>
                Retry
              </Button>
            </div>
          </div>
        ) : spotlights.length === 0 ? (
          <EmptyState
            title="No Researcher Spotlights Found"
            description="No spotlight showcases match your filters. Publish a faculty showcase or clear your filters."
            action={
              <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                + Create First Spotlight
              </Button>
            }
          />
        ) : (
          <div className="vyasa-table-card" style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid var(--vyasa-border, #e3dcd1)', overflowX: 'auto', boxShadow: '0 2px 6px rgba(15, 43, 72, 0.04)' }}>
            <table className="vyasa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)', borderBottom: '2px solid var(--vyasa-border, #e3dcd1)', color: 'var(--vyasa-primary, #0f2b48)', fontWeight: 600 }}>
                  <th style={{ padding: '12px 16px' }}>Headline & Summary</th>
                  <th style={{ padding: '12px 16px' }}>Media Type</th>
                  <th style={{ padding: '12px 16px' }}>Author / Affiliate</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {spotlights.map((spot) => (
                  <tr key={spot.id} style={{ borderBottom: '1px solid var(--vyasa-border-subtle, #ede7de)' }}>
                    <td style={{ padding: '12px 16px', maxWidth: '380px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)', lineHeight: 1.4 }}>
                        {spot.headline}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {spot.summary}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {getMediaTypeBadge(spot.media_type)}
                      {spot.media_url && (
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                          <a href={spot.media_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--vyasa-primary, #0f2b48)', textDecoration: 'underline' }}>
                            View Media
                          </a>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#334155' }}>
                        {spot.author_name || (spot.author_id ? `ID: ${spot.author_id.slice(0, 8)}...` : 'General / Institution')}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(spot)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                        title="Click to toggle status"
                      >
                        <Badge variant={spot.is_active ? 'teal' : 'neutral'}>
                          {spot.is_active ? 'Active' : 'Hidden'}
                        </Badge>
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(spot)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                          onClick={() => {
                            setSpotlightToDelete(spot);
                            setShowDeleteModal(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--vyasa-border-subtle, #ede7de)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
              <span>
                Showing {spotlights.length} of {totalCount} spotlights
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

        {/* Modal: Add / Edit Spotlight */}
        <Modal
          isOpen={showAddEditModal}
          onClose={() => setShowAddEditModal(false)}
          title={editingSpotlight ? 'Edit Spotlight' : 'Create Researcher Spotlight'}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowAddEditModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={submitting}
                onClick={() => handleSaveSpotlight()}
              >
                {submitting ? 'Saving...' : editingSpotlight ? 'Update Spotlight' : 'Publish Spotlight'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveSpotlight} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="Headline"
              required
              value={formData.headline}
              onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
              placeholder="e.g. Breakthrough in Nanotechnology: Dr. Sharma Secures Patent"
            />

            <div className="vyasa-form-group">
              <label className="vyasa-label">
                <span>Summary <span style={{ color: 'var(--vyasa-saffron)' }}>*</span></span>
              </label>
              <textarea
                required
                rows={3}
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="Detailed narrative summary highlighting key achievements and institutional impact..."
                className="vyasa-input"
                style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <Select
                label="Media Type"
                required
                value={formData.media_type}
                onChange={(e) => setFormData({ ...formData, media_type: e.target.value as 'photo' | 'video' | 'interview' })}
                options={[
                  { value: 'photo', label: 'Photo / Feature' },
                  { value: 'video', label: 'Video Showcase' },
                  { value: 'interview', label: 'Researcher Interview' },
                ]}
              />

              <Select
                label="Featured Author (Optional)"
                value={formData.author_id}
                onChange={(e) => setFormData({ ...formData, author_id: e.target.value })}
                options={[
                  { value: '', label: 'None / Institution-wide' },
                  ...authors.map((a) => ({
                    value: a.id,
                    label: `${a.name} (${a.department || 'No dept'})`,
                  })),
                ]}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <Input
                label="Media URL / Image Path"
                type="url"
                value={formData.media_url}
                onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                placeholder="https://... or /storage/..."
              />

              <Input
                label="Video Embed URL (Optional)"
                type="url"
                value={formData.video_embed_url}
                onChange={(e) => setFormData({ ...formData, video_embed_url: e.target.value })}
                placeholder="https://www.youtube.com/embed/..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <Input
                label="Display Order (Priority)"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 0 })}
              />

              <div style={{ display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>Visible in Public Showcase</span>
                </label>
              </div>
            </div>
          </form>
        </Modal>

        {/* Modal: Delete Confirmation */}
        <Modal
          isOpen={showDeleteModal && !!spotlightToDelete}
          onClose={() => {
            setShowDeleteModal(false);
            setSpotlightToDelete(null);
          }}
          title="Delete Spotlight"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSpotlightToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={submitting}
                style={{ backgroundColor: '#b91c1c', borderColor: '#b91c1c' }}
                onClick={handleDeleteConfirm}
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
              Are you sure you want to delete this spotlight?
            </p>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontWeight: 600,
                color: '#0f2b48',
              }}
            >
              {spotlightToDelete?.headline}
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#dc2626' }}>
              This action cannot be undone. The feature will be removed from the public portal.
            </p>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};

export default SpotlightsPage;
