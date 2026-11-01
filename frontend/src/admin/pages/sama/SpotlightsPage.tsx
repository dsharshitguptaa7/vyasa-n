import React, { useState, useEffect, useCallback } from 'react';
import { AppIcon, Button } from '@vyasa/ui';
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

  // Authors reference data
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

  const loadAuthors = async () => {
    try {
      const res = await samaAdminService.getAuthors({ limit: 100 });
      setAuthors(res.items);
    } catch (err) {
      console.warn('Failed to load authors for spotlight selection', err);
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
      display_order: spotlights.length,
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
      media_type: spotlight.media_type,
      media_url: spotlight.media_url || '',
      video_embed_url: spotlight.video_embed_url || '',
      display_order: spotlight.display_order,
      is_active: spotlight.is_active,
      author_id: spotlight.author_id || '',
    });
    setShowAddEditModal(true);
  };

  // Save Spotlight
  const handleSaveSpotlight = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setError(null);
      await samaAdminService.updateSpotlight(spotlight.id, {
        is_active: !spotlight.is_active,
      });
      fetchSpotlights();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || 'Failed to toggle status');
    }
  };

  // Delete Spotlight
  const handleDeleteConfirm = async () => {
    if (!spotlightToDelete) return;
    try {
      setSubmitting(true);
      setError(null);
      await samaAdminService.deleteSpotlight(spotlightToDelete.id);
      setSuccessMessage('Spotlight removed successfully.');
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
        return <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Video</span>;
      case 'interview':
        return <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Interview</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Photo / Feature</span>;
    }
  };

  return (
    <AdminLayout activeTab="sama-spotlights">
      <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AppIcon name="settings" className="text-blue-600" />
            Researcher Spotlights Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Curate prominent faculty achievements, featured media showcases, interviews, and public research spotlights.
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <AppIcon name="upload" className="w-4 h-4" />
            New Spotlight
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && spotlights.length > 0 && (
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

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Media Type:</label>
            <select
              value={mediaTypeFilter}
              onChange={(e) => {
                setMediaTypeFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Media</option>
              <option value="photo">Photo / Feature</option>
              <option value="video">Video</option>
              <option value="interview">Interview</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Visibility:</label>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value as 'all' | 'active' | 'inactive');
                setPage(1);
              }}
              className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Visibility</option>
              <option value="active">Active Only</option>
              <option value="inactive">Hidden / Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Spotlights Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-600 rounded-full mb-2"></div>
            <p className="text-sm">Loading spotlights...</p>
          </div>
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
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <AppIcon name="settings" className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-base font-medium text-gray-700 dark:text-gray-300">No spotlights found</p>
            <p className="text-xs text-gray-400 mt-1">Create a spotlight to showcase university researchers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3">Order</th>
                  <th className="px-6 py-3">Headline & Summary</th>
                  <th className="px-6 py-3">Media</th>
                  <th className="px-6 py-3">Featured Author</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {spotlights.map((spot) => (
                  <tr key={spot.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                    <td className="px-6 py-4 font-mono font-bold text-gray-500 dark:text-gray-400">
                      #{spot.display_order}
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <div className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                        {spot.headline}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {spot.summary}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getMediaTypeBadge(spot.media_type)}
                      {spot.media_url && (
                        <div className="text-xs text-blue-500 truncate max-w-xs mt-1">
                          <a href={spot.media_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            View Media
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {spot.author_name || (spot.author_id ? `ID: ${spot.author_id.slice(0, 8)}...` : 'General / Institution')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(spot)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${
                          spot.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {spot.is_active ? 'Active' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(spot)}
                        className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSpotlightToDelete(spot);
                          setShowDeleteModal(true);
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                      >
                        Delete
                      </button>
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
            Showing {spotlights.length} of {totalCount} spotlights
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

      {/* Modal: Add / Edit Spotlight */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-xl w-full border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingSpotlight ? 'Edit Spotlight' : 'Create Researcher Spotlight'}
              </h2>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <AppIcon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpotlight} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Headline *
                </label>
                <input
                  type="text"
                  required
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  placeholder="e.g. Breakthrough in Nanotechnology: Dr. Sharma Secures Patent"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Detailed narrative summary highlighting key achievements and institutional impact..."
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Media Type *
                  </label>
                  <select
                    value={formData.media_type}
                    onChange={(e) => setFormData({ ...formData, media_type: e.target.value as 'photo' | 'video' | 'interview' })}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="photo">Photo / Feature</option>
                    <option value="video">Video Showcase</option>
                    <option value="interview">Researcher Interview</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Featured Author (Optional)
                  </label>
                  <select
                    value={formData.author_id}
                    onChange={(e) => setFormData({ ...formData, author_id: e.target.value })}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None / Institution-wide</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.department || 'No dept'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Media URL / Image Path
                  </label>
                  <input
                    type="url"
                    value={formData.media_url}
                    onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                    placeholder="https://... or /storage/..."
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Video Embed URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.video_embed_url}
                    onChange={(e) => setFormData({ ...formData, video_embed_url: e.target.value })}
                    placeholder="https://www.youtube.com/embed/..."
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                    Display Order (Priority)
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 0 })}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Visible in Public Showcase
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingSpotlight ? 'Update Spotlight' : 'Publish Spotlight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {showDeleteModal && spotlightToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Delete Spotlight</h2>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to delete this spotlight?
              </p>
              <p className="font-semibold text-gray-900 dark:text-white text-sm bg-gray-50 dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                {spotlightToDelete.headline}
              </p>
              <p className="text-xs text-red-500">
                This action cannot be undone. The feature will be removed from the public portal.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSpotlightToDelete(null);
                }}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
};

export default SpotlightsPage;
