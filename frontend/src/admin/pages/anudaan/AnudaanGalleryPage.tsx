import React, { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Input } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { anudaanAdminService } from '../../services/anudaanAdminService';
import type { AnudaanGalleryItemOut } from '../../types/anudaan';

export const AnudaanGalleryPage: React.FC = () => {
  const [items, setItems] = useState<AnudaanGalleryItemOut[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [academicYearFilter, setAcademicYearFilter] = useState('ALL');

  // Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<AnudaanGalleryItemOut | null>(null);

  // Create/Edit form states
  const [formTitle, setFormTitle] = useState('');
  const [formEventName, setFormEventName] = useState('');
  const [formEventDate, setFormEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAcademicYear, setFormAcademicYear] = useState('2025-2026');
  const [formDescription, setFormDescription] = useState('');
  const [formResearcherName, setFormResearcherName] = useState('');
  const [formResearcherDesignation, setFormResearcherDesignation] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formHasConsent, setFormHasConsent] = useState(true);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formIsPublished, setFormIsPublished] = useState(false);
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);

  // Photo upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadIsCover, setUploadIsCover] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchGallery = useCallback(async () => {
    try {
      setLoading(true);
      const data = await anudaanAdminService.getGalleryItems({
        academic_year: academicYearFilter === 'ALL' ? undefined : academicYearFilter,
        limit: 100,
      });
      setItems(data.items);
      setTotalCount(data.total);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load gallery items.' });
    } finally {
      setLoading(false);
    }
  }, [academicYearFilter]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const openCreateModal = () => {
    setFormTitle('');
    setFormEventName('');
    setFormEventDate(new Date().toISOString().split('T')[0]);
    setFormAcademicYear('2025-2026');
    setFormDescription('');
    setFormResearcherName('');
    setFormResearcherDesignation('');
    setFormDepartment('');
    setFormHasConsent(true);
    setFormIsFeatured(false);
    setFormIsPublished(false);
    setFormDisplayOrder(0);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (item: AnudaanGalleryItemOut) => {
    setActiveItem(item);
    setFormTitle(item.title);
    setFormEventName(item.event_name);
    setFormEventDate(item.event_date);
    setFormAcademicYear(item.academic_year);
    setFormDescription(item.description);
    setFormResearcherName(item.researcher_name || '');
    setFormResearcherDesignation(item.researcher_designation || '');
    setFormDepartment(item.department_name || '');
    setFormHasConsent(item.has_consent);
    setFormIsFeatured(item.is_featured);
    setFormIsPublished(item.is_published);
    setFormDisplayOrder(item.display_order);
    setIsEditModalOpen(true);
  };

  const openPhotoModal = (item: AnudaanGalleryItemOut) => {
    setActiveItem(item);
    setUploadFile(null);
    setUploadCaption('');
    setUploadIsCover(false);
    setIsPhotoModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await anudaanAdminService.createGalleryItem({
        title: formTitle.trim(),
        event_name: formEventName.trim(),
        event_date: formEventDate,
        academic_year: formAcademicYear.trim(),
        description: formDescription.trim(),
        researcher_name: formResearcherName.trim() || undefined,
        researcher_designation: formResearcherDesignation.trim() || undefined,
        department_name: formDepartment.trim() || undefined,
        has_consent: formHasConsent,
        is_featured: formIsFeatured,
        is_published: formIsPublished,
        display_order: Number(formDisplayOrder),
      });

      setFeedback({ type: 'success', message: 'Gallery entry created successfully.' });
      setIsCreateModalOpen(false);
      fetchGallery();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create gallery item.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    try {
      setActionLoading(true);
      await anudaanAdminService.updateGalleryItem(activeItem.id, {
        title: formTitle.trim(),
        event_name: formEventName.trim(),
        event_date: formEventDate,
        academic_year: formAcademicYear.trim(),
        description: formDescription.trim(),
        researcher_name: formResearcherName.trim() || undefined,
        researcher_designation: formResearcherDesignation.trim() || undefined,
        department_name: formDepartment.trim() || undefined,
        has_consent: formHasConsent,
        is_featured: formIsFeatured,
        is_published: formIsPublished,
        display_order: Number(formDisplayOrder),
      });

      setFeedback({ type: 'success', message: 'Gallery entry updated successfully.' });
      setIsEditModalOpen(false);
      fetchGallery();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update gallery item.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this recognition gallery entry and all its photos?')) return;
    try {
      await anudaanAdminService.deleteGalleryItem(itemId);
      setFeedback({ type: 'success', message: 'Gallery entry deleted.' });
      fetchGallery();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete gallery item.' });
    }
  };

  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !uploadFile) return;

    try {
      setUploadLoading(true);
      await anudaanAdminService.uploadGalleryImage(
        activeItem.id,
        uploadFile,
        uploadCaption.trim() || undefined,
        uploadIsCover,
        0
      );

      setFeedback({ type: 'success', message: 'Photograph uploaded successfully.' });
      setUploadFile(null);
      setUploadCaption('');
      // Refresh active item
      const updatedItem = await anudaanAdminService.getGalleryItem(activeItem.id);
      setActiveItem(updatedItem);
      fetchGallery();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to upload photo.' });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRemovePhoto = async (imageId: string) => {
    if (!activeItem) return;
    try {
      await anudaanAdminService.removeGalleryImage(imageId);
      setFeedback({ type: 'success', message: 'Photograph removed.' });
      const updatedItem = await anudaanAdminService.getGalleryItem(activeItem.id);
      setActiveItem(updatedItem);
      fetchGallery();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete photo.' });
    }
  };

  const handleSetCover = async (imageId: string) => {
    if (!activeItem) return;
    try {
      await anudaanAdminService.setCoverImage(activeItem.id, imageId);
      setFeedback({ type: 'success', message: 'Cover image updated.' });
      const updatedItem = await anudaanAdminService.getGalleryItem(activeItem.id);
      setActiveItem(updatedItem);
      fetchGallery();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update cover photo.' });
    }
  };

  return (
    <AdminLayout activeTab="anudaan-gallery">
      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0B2545', margin: '0 0 6px' }}>
              Researcher Recognition & Ceremony Gallery CMS <span style={{ fontSize: '1rem', fontWeight: 500, color: '#718096' }}>({totalCount} records)</span>
            </h1>
            <p style={{ color: '#4A5568', margin: 0, fontSize: '0.95rem' }}>
              Manage official distribution ceremonies, researcher milestone spotlights, and authorized ceremony photography.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#0B2545',
              }}
            >
              <option value="ALL">All Academic Years</option>
              <option value="2026-2027">2026-2027</option>
              <option value="2025-2026">2025-2026</option>
            </select>
            <Button variant="primary" size="sm" onClick={openCreateModal}>
              + Create Recognition Entry
            </Button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 6,
              marginBottom: 20,
              backgroundColor: feedback.type === 'success' ? '#DEF7EC' : '#FDE8E8',
              color: feedback.type === 'success' ? '#03543F' : '#9B1C1C',
              border: `1px solid ${feedback.type === 'success' ? '#84E1BC' : '#F8B4B4'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Gallery Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>Loading gallery entries...</div>
        ) : items.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #E2E8F0', padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📸</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0B2545', marginBottom: 6 }}>
              No Gallery Entries Published Yet
            </h3>
            <p style={{ color: '#64748B', maxWidth: 480, margin: '0 auto 20px', fontSize: '0.925rem' }}>
              Create an entry to highlight Vice Chancellor felicitation ceremonies, incentive distribution events, and outstanding research milestones.
            </p>
            <Button variant="primary" onClick={openCreateModal}>
              + Create First Entry
            </Button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {items.map((item) => {
              const coverImg = item.images.find((img) => img.is_cover) || item.images[0];
              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Image Thumbnail */}
                  <div
                    style={{
                      height: 180,
                      backgroundColor: '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {coverImg ? (
                      <img
                        src={anudaanAdminService.getImageUrl(coverImg.id)}
                        alt={coverImg.caption || item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>No Photograph Uploaded</span>
                    )}
                    <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                      {item.is_featured && (
                        <span style={{ backgroundColor: '#B45309', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                          ★ Featured
                        </span>
                      )}
                      <span
                        style={{
                          backgroundColor: item.is_published ? '#059669' : '#64748B',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {item.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B', marginBottom: 6 }}>
                        <span>{item.event_name}</span>
                        <span>{item.event_date} ({item.academic_year})</span>
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0B2545', margin: '0 0 8px', lineHeight: 1.4 }}>
                        {item.title}
                      </h3>
                      <p style={{ color: '#475569', fontSize: '0.85rem', margin: '0 0 12px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.description}
                      </p>
                      {item.researcher_name && (
                        <div style={{ fontSize: '0.8rem', color: '#334155', backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: 4, marginBottom: 12 }}>
                          <strong>Researcher:</strong> {item.researcher_name}{' '}
                          {item.researcher_designation ? `(${item.researcher_designation})` : ''}
                          <div style={{ marginTop: 2 }}>
                            <span style={{ color: item.has_consent ? '#059669' : '#DC2626', fontWeight: 600, fontSize: '0.75rem' }}>
                              {item.has_consent ? '✓ Consent Verified' : '⚠ Consent Withheld'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        {item.images.length} {item.images.length === 1 ? 'photo' : 'photos'}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button variant="outline" size="sm" onClick={() => openPhotoModal(item)}>
                          Photos ({item.images.length})
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditModal(item)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" style={{ color: '#DC2626' }} onClick={() => handleDeleteItem(item.id)}>
                          ✕
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Entry Modal */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={isCreateModalOpen || isEditModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
          }}
          title={isCreateModalOpen ? 'Create Recognition Gallery Entry' : 'Edit Recognition Gallery Entry'}
        >
          <form onSubmit={isCreateModalOpen ? handleCreateSubmit : handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Entry Headline / Title *
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Vice Chancellor Felicitates Dr. Sharma for High-Impact Publication"
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Event / Ceremony Name *
                </label>
                <Input
                  value={formEventName}
                  onChange={(e) => setFormEventName(e.target.value)}
                  placeholder="e.g. Annual Research Incentive Distribution 2026"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Event Date *
                </label>
                <Input
                  type="date"
                  value={formEventDate}
                  onChange={(e) => setFormEventDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Academic Year *
                </label>
                <Input
                  value={formAcademicYear}
                  onChange={(e) => setFormAcademicYear(e.target.value)}
                  placeholder="e.g. 2025-2026"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Display Order
                </label>
                <Input
                  type="number"
                  value={String(formDisplayOrder)}
                  onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Description / Summary *
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Institutional description of the ceremony, research paper impact, and incentive recognition."
                rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Researcher Name (Optional)
                </label>
                <Input
                  value={formResearcherName}
                  onChange={(e) => setFormResearcherName(e.target.value)}
                  placeholder="e.g. Prof. Rajesh Sharma"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Designation (Optional)
                </label>
                <Input
                  value={formResearcherDesignation}
                  onChange={(e) => setFormResearcherDesignation(e.target.value)}
                  placeholder="e.g. Professor of Physics"
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Department / School (Optional)
              </label>
              <Input
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                placeholder="e.g. School of Basic Sciences"
              />
            </div>

            {/* Checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#1E293B', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formHasConsent}
                  onChange={(e) => setFormHasConsent(e.target.checked)}
                />
                <span>Researcher Consent Verified (Required for public photograph display)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#1E293B', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formIsFeatured}
                  onChange={(e) => setFormIsFeatured(e.target.checked)}
                />
                <span>Feature in top highlight carousel</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#1E293B', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formIsPublished}
                  onChange={(e) => setFormIsPublished(e.target.checked)}
                />
                <span>Publish immediately to public ANUDAAN portal</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : isCreateModalOpen ? 'Create Entry' : 'Update Entry'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Photo Management Modal */}
      {isPhotoModalOpen && activeItem && (
        <Modal
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          title={`Photographs: ${activeItem.title}`}
        >
          <div>
            {/* Upload New Photo Form */}
            <form onSubmit={handlePhotoUpload} style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 6, marginBottom: 20 }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0B2545', margin: '0 0 10px' }}>
                + Upload Ceremony Photograph
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  required
                  style={{ fontSize: '0.85rem' }}
                />
                <Input
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Photo caption or credit (optional)"
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={uploadIsCover}
                    onChange={(e) => setUploadIsCover(e.target.checked)}
                  />
                  <span>Set as primary cover image for this entry</span>
                </label>
                <div style={{ textAlign: 'right' }}>
                  <Button variant="primary" size="sm" type="submit" disabled={uploadLoading || !uploadFile}>
                    {uploadLoading ? 'Uploading...' : 'Upload Image'}
                  </Button>
                </div>
              </div>
            </form>

            {/* Photos List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0B2545', margin: 0 }}>
                Existing Photos ({activeItem.images.length})
              </h4>
              {activeItem.images.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: '0.875rem' }}>
                  No photos uploaded for this ceremony yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {activeItem.images.map((img) => (
                    <div
                      key={img.id}
                      style={{
                        border: img.is_cover ? '2px solid #B45309' : '1px solid #E2E8F0',
                        borderRadius: 6,
                        overflow: 'hidden',
                        position: 'relative',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <img
                        src={anudaanAdminService.getImageUrl(img.id)}
                        alt={img.caption || 'Ceremony photograph'}
                        style={{ width: '100%', height: 100, objectFit: 'cover' }}
                      />
                      <div style={{ padding: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {img.caption || img.original_filename}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          {!img.is_cover ? (
                            <button
                              type="button"
                              onClick={() => handleSetCover(img.id)}
                              style={{ fontSize: '0.7rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              Make Cover
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#B45309', fontWeight: 700 }}>Cover</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(img.id)}
                            style={{ fontSize: '0.7rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <Button variant="outline" onClick={() => setIsPhotoModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
