import React, { useState, useEffect, useCallback } from 'react';
import { Button, Modal } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { anudaanAdminService } from '../../services/anudaanAdminService';
import type { AnudaanFelicitationCycleOut } from '../../types/anudaan';

export const AnudaanFelicitationPage: React.FC = () => {
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedArchive, setSelectedArchive] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Cycles list state
  const [cycles, setCycles] = useState<AnudaanFelicitationCycleOut[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<AnudaanFelicitationCycleOut | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingCycle, setDeletingCycle] = useState<AnudaanFelicitationCycleOut | null>(null);

  // Form states
  const [formVolume, setFormVolume] = useState<number>(2);
  const [formIssue, setFormIssue] = useState<number>(1);
  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<'UPCOMING' | 'COMPLETED'>('UPCOMING');
  const [formDate, setFormDate] = useState('');
  const [formYear, setFormYear] = useState('2025-2026');
  const [formDesc, setFormDesc] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formIsArchived, setFormIsArchived] = useState(false);

  // Feedback & Action Loading
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch cycles list
  const fetchCycles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await anudaanAdminService.getFelicitationCycles({
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        academic_year: selectedYear === 'ALL' ? undefined : selectedYear,
        is_archived: selectedArchive === 'active' ? false : selectedArchive === 'archived' ? true : undefined,
        search: searchTerm.trim() || undefined,
        limit: 100,
      });
      setCycles(res.items);
    } catch (err: any) {
      console.error('Failed to load felicitation cycles:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load felicitation cycles' });
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedYear, selectedArchive, searchTerm]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  // Derived KPI metrics
  const totalCycles = cycles.length;
  const completedCyclesCount = cycles.filter((c) => c.status === 'COMPLETED').length;
  const upcomingCyclesCount = cycles.filter((c) => c.status === 'UPCOMING').length;
  const totalSanctionsInCycles = cycles.reduce((acc, c) => acc + (Number(c.total_sanctioned_amount) || 0), 0);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingCycle(null);
    const maxVol = cycles.length > 0 ? Math.max(...cycles.map((c) => c.volume_number)) : 2;
    const sameVolCycles = cycles.filter((c) => c.volume_number === maxVol);
    const nextIssue = sameVolCycles.length > 0 ? Math.max(...sameVolCycles.map((c) => c.issue_number)) + 1 : 1;

    setFormVolume(maxVol);
    setFormIssue(nextIssue);
    setFormTitle('');
    setFormStatus('UPCOMING');
    setFormDate('');
    setFormYear('2025-2026');
    setFormDesc('');
    setFormIsPublished(true);
    setFormIsArchived(false);
    setIsAddEditModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (c: AnudaanFelicitationCycleOut) => {
    setEditingCycle(c);
    setFormVolume(c.volume_number);
    setFormIssue(c.issue_number);
    setFormTitle(c.display_title || '');
    setFormStatus(c.status as 'UPCOMING' | 'COMPLETED');
    setFormDate(c.felicitation_date || '');
    setFormYear(c.academic_year || '2025-2026');
    setFormDesc(c.description || '');
    setFormIsPublished(c.is_published);
    setFormIsArchived(c.is_archived);
    setIsAddEditModalOpen(true);
  };

  // Submit Add / Edit Form
  const handleSaveCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVolume || formVolume < 1 || !formIssue || formIssue < 1) {
      setFeedback({ type: 'error', message: 'Volume and Issue numbers must be positive integers.' });
      return;
    }

    try {
      setActionLoading(true);
      if (editingCycle) {
        await anudaanAdminService.updateFelicitationCycle(editingCycle.id, {
          volume_number: formVolume,
          issue_number: formIssue,
          display_title: formTitle.trim() || null,
          status: formStatus,
          felicitation_date: formDate || null,
          academic_year: formYear.trim() || null,
          description: formDesc.trim() || null,
          is_published: formIsPublished,
          is_archived: formIsArchived,
        });
        setFeedback({ type: 'success', message: `Volume ${formVolume}, Issue ${formIssue} updated successfully.` });
      } else {
        await anudaanAdminService.createFelicitationCycle({
          volume_number: formVolume,
          issue_number: formIssue,
          display_title: formTitle.trim() || null,
          status: formStatus,
          felicitation_date: formDate || null,
          academic_year: formYear.trim() || null,
          description: formDesc.trim() || null,
          is_published: formIsPublished,
          is_archived: formIsArchived,
        });
        setFeedback({ type: 'success', message: `Volume ${formVolume}, Issue ${formIssue} created successfully.` });
      }
      setIsAddEditModalOpen(false);
      fetchCycles();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Operation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Publication
  const handleTogglePublish = async (c: AnudaanFelicitationCycleOut) => {
    try {
      setActionLoading(true);
      await anudaanAdminService.toggleFelicitationPublish(c.id, !c.is_published);
      setFeedback({
        type: 'success',
        message: `Volume ${c.volume_number}, Issue ${c.issue_number} ${!c.is_published ? 'published' : 'unpublished'}.`,
      });
      fetchCycles();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle publication' });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Archive
  const handleToggleArchive = async (c: AnudaanFelicitationCycleOut) => {
    try {
      setActionLoading(true);
      await anudaanAdminService.toggleFelicitationArchive(c.id, !c.is_archived);
      setFeedback({
        type: 'success',
        message: `Volume ${c.volume_number}, Issue ${c.issue_number} ${!c.is_archived ? 'archived' : 'restored'}.`,
      });
      fetchCycles();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle archive status' });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete cycle
  const handleDeleteConfirm = async () => {
    if (!deletingCycle) return;
    try {
      setActionLoading(true);
      await anudaanAdminService.deleteFelicitationCycle(deletingCycle.id);
      setFeedback({
        type: 'success',
        message: `Volume ${deletingCycle.volume_number}, Issue ${deletingCycle.issue_number} deleted successfully.`,
      });
      setIsDeleteModalOpen(false);
      setDeletingCycle(null);
      fetchCycles();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete cycle' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div style={{ padding: '24px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0B2545', margin: 0 }}>
                Felicitation & Recognition Cycles
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  padding: '2px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                }}
              >
                Yajur Veda
              </span>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: 4, marginBottom: 0 }}>
              Curate institutional incentive distribution volumes, ceremony issues, and researcher felicitation cycles.
            </p>
          </div>
          <Button variant="primary" onClick={handleOpenCreateModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>+ Add Felicitation Cycle</span>
          </Button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: feedback.type === 'success' ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${feedback.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
              color: feedback.type === 'success' ? '#166534' : '#991B1B',
              fontSize: '0.875rem',
            }}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
            >
              &times;
            </button>
          </div>
        )}

        {/* KPI Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ backgroundColor: '#FFF', borderRadius: 8, padding: 18, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              TOTAL RECOGNITION CYCLES
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0B2545', marginTop: 4 }}>
              {totalCycles}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Recorded institutional volumes</span>
          </div>

          <div style={{ backgroundColor: '#FFF', borderRadius: 8, padding: 18, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
              COMPLETED CEREMONIES
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#15803D', marginTop: 4 }}>
              {completedCyclesCount}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#86EFAC' }}>Sanctioned & felicitated</span>
          </div>

          <div style={{ backgroundColor: '#FFF', borderRadius: 8, padding: 18, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
              UPCOMING CEREMONIES
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#B45309', marginTop: 4 }}>
              {upcomingCyclesCount}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#FCD34D' }}>Scheduled milestone events</span>
          </div>

          <div style={{ backgroundColor: '#FFF', borderRadius: 8, padding: 18, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
              SANCTIONS IN CYCLES (INR)
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#047857', marginTop: 4 }}>
              ₹ {Number(totalSanctionsInCycles).toLocaleString('en-IN')}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#6EE7B7' }}>Official institutional awards</span>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div
          style={{
            backgroundColor: '#FFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              type="text"
              placeholder="Search volume, title, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #CBD5E1',
                borderRadius: 6,
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="UPCOMING">Upcoming</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Academic Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Academic Years</option>
              <option value="2025-2026">2025-2026</option>
              <option value="2026-2027">2026-2027</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>View:</span>
            <select
              value={selectedArchive}
              onChange={(e) => setSelectedArchive(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            >
              <option value="active">Active Cycles</option>
              <option value="archived">Archived Cycles</option>
              <option value="ALL">All Records</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ backgroundColor: '#FFF', borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading felicitation cycles...</div>
          ) : cycles.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
              No felicitation cycles found matching the filters.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Volume & Issue</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Ceremonial Title & Description</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Felicitation Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Linked Sanctions</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Total Sanctioned</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Public Visibility</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0B2545' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Volume {c.volume_number} — Issue {c.issue_number}</span>
                        {c.is_archived && (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, backgroundColor: '#E2E8F0', color: '#475569' }}>
                            Archived
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>
                        {c.academic_year || 'Academic Year Unspecified'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', maxWidth: 300 }}>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>
                        {c.display_title || 'General Publication Sanction Felicitation'}
                      </div>
                      {c.description && (
                        <div style={{ fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.description}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 4,
                          backgroundColor: c.status === 'COMPLETED' ? '#DCFCE7' : '#FEF3C7',
                          color: c.status === 'COMPLETED' ? '#166534' : '#92400E',
                        }}
                      >
                        {c.status === 'COMPLETED' ? 'Completed' : 'Upcoming'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem' }}>
                      {c.felicitation_date || 'TBD / Scheduled'}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0B2545' }}>
                      {c.sanction_count} records
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                      ₹ {Number(c.total_sanctioned_amount).toLocaleString('en-IN')}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontWeight: 600,
                          backgroundColor: c.is_published ? '#ECFDF5' : '#F1F5F9',
                          color: c.is_published ? '#059669' : '#64748B',
                        }}
                      >
                        {c.is_published ? '● Published' : '○ Hidden'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePublish(c)}
                          disabled={actionLoading}
                        >
                          {c.is_published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleArchive(c)}
                          disabled={actionLoading}
                        >
                          {c.is_archived ? 'Restore' : 'Archive'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(c)}
                          disabled={actionLoading}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeletingCycle(c);
                            setIsDeleteModalOpen(true);
                          }}
                          disabled={actionLoading}
                          style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isAddEditModalOpen && (
        <Modal
          isOpen={isAddEditModalOpen}
          onClose={() => setIsAddEditModalOpen(false)}
          title={editingCycle ? 'Edit Felicitation Cycle' : 'Create Felicitation / Recognition Cycle'}
        >
          <form onSubmit={handleSaveCycle} style={{ padding: '10px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                  Volume Number <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formVolume}
                  onChange={(e) => setFormVolume(parseInt(e.target.value) || 1)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                  Issue Number <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formIssue}
                  onChange={(e) => setFormIssue(parseInt(e.target.value) || 1)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 6 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                Ceremonial Display Title <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Annual Research Convocation Felicitation 2026"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 6 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                  Ceremony Status <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'UPCOMING' | 'COMPLETED')}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 6 }}
                >
                  <option value="UPCOMING">Upcoming (Scheduled Recognition)</option>
                  <option value="COMPLETED">Completed (Sanctions Felicitated)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                  Felicitation Date <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 6 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                Academic Year <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 2025-2026"
                value={formYear}
                onChange={(e) => setFormYear(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 6 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                Description / Institutional Notes <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Provide details about the felicitation event, dignitaries, or scope of research awards recognized..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 6 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={formIsPublished}
                  onChange={(e) => setFormIsPublished(e.target.checked)}
                />
                <span>Visible in Public Showcase</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={formIsArchived}
                  onChange={(e) => setFormIsArchived(e.target.checked)}
                />
                <span>Mark as Archived Cycle</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid #E2E8F0' }}>
              <Button variant="outline" type="button" onClick={() => setIsAddEditModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : editingCycle ? 'Update Cycle' : 'Create Cycle'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingCycle && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Confirm Delete Felicitation Cycle"
        >
          <div style={{ padding: '10px 0' }}>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>Volume {deletingCycle.volume_number}, Issue {deletingCycle.issue_number}</strong>?
            </p>
            {deletingCycle.sanction_count > 0 && (
              <div
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  padding: 12,
                  borderRadius: 6,
                  color: '#92400E',
                  fontSize: '0.85rem',
                  marginBottom: 16,
                }}
              >
                ⚠️ <strong>Note:</strong> This cycle has <strong>{deletingCycle.sanction_count}</strong> linked sanction records. Deleting this cycle will safely decouple the sanction entries without deleting historical data.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
                style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};

export default AnudaanFelicitationPage;
