import React, { useState, useEffect, useCallback } from 'react';
import { Button, Modal } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { anudaanAdminService } from '../../services/anudaanAdminService';
import type {
  AnudaanPublicImpactStats,
  AnudaanSanctionEntryOut,
  AnudaanApplicationLookupItem,
} from '../../types/anudaan';

export const AnudaanSanctionRegisterPage: React.FC = () => {
  // Filters state
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedQuartile, setSelectedQuartile] = useState<string>('ALL');
  const [selectedVisibility, setSelectedVisibility] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Stats state
  const [stats, setStats] = useState<AnudaanPublicImpactStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Sanctions list state
  const [sanctions, setSanctions] = useState<AnudaanSanctionEntryOut[]>([]);
  const [totalSanctionedSum, setTotalSanctionedSum] = useState<number | string>(0);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AnudaanSanctionEntryOut | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<AnudaanSanctionEntryOut | null>(null);

  // Application lookup state (for prefilling from submitted applications)
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<AnudaanApplicationLookupItem[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Form states
  const [formResearcher, setFormResearcher] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDoi, setFormDoi] = useState('');
  const [formQuartile, setFormQuartile] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [formAmount, setFormAmount] = useState('');
  const [formAcademicYear, setFormAcademicYear] = useState('2025-2026');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formRemarks, setFormRemarks] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formAppId, setFormAppId] = useState<string | null>(null);
  const [formAuthorId, setFormAuthorId] = useState<string | null>(null);

  // Feedback & Action Loading
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await anudaanAdminService.getImpactStats(selectedYear === 'ALL' ? undefined : selectedYear);
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedYear]);

  // Fetch sanctions list
  const fetchSanctions = useCallback(async () => {
    try {
      setLoading(true);
      const isPubParam =
        selectedVisibility === 'PUBLISHED' ? true : selectedVisibility === 'UNPUBLISHED' ? false : undefined;
      const data = await anudaanAdminService.getSanctions({
        academic_year: selectedYear === 'ALL' ? undefined : selectedYear,
        quartile: selectedQuartile === 'ALL' ? undefined : selectedQuartile,
        is_published: isPubParam,
        search: searchTerm.trim() || undefined,
        limit: 100,
      });
      setSanctions(data.items);
      setTotalSanctionedSum(data.total_sanctioned_inr);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load sanctions.' });
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedQuartile, selectedVisibility, searchTerm]);

  useEffect(() => {
    fetchStats();
    fetchSanctions();
  }, [fetchStats, fetchSanctions]);

  // Application lookup search
  const handleLookupSearch = async () => {
    if (!lookupQuery.trim()) return;
    try {
      setLookupLoading(true);
      const results = await anudaanAdminService.lookupApplications(lookupQuery.trim());
      setLookupResults(results);
    } catch (err: any) {
      console.error('Lookup failed', err);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSelectLookup = (item: AnudaanApplicationLookupItem) => {
    setFormAppId(item.application_id);
    setFormResearcher(item.applicant_name);
    setFormDept(item.department_name);
    if (item.publication_title) setFormTitle(item.publication_title);
    if (item.publication_doi) setFormDoi(item.publication_doi);
    if (item.quartile && ['Q1', 'Q2', 'Q3', 'Q4'].includes(item.quartile)) {
      setFormQuartile(item.quartile as 'Q1' | 'Q2' | 'Q3' | 'Q4');
    }
    if (item.authors && item.authors.length > 0) {
      const payable = item.authors.find((a) => a.is_payable) || item.authors[0];
      setFormAuthorId(payable.author_id);
    }
    setLookupResults([]);
    setLookupQuery('');
  };

  const resetForm = () => {
    setEditingEntry(null);
    setFormResearcher('');
    setFormDept('');
    setFormTitle('');
    setFormDoi('');
    setFormQuartile('Q1');
    setFormAmount('');
    setFormAcademicYear('2025-2026');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormRemarks('');
    setFormIsPublished(true);
    setFormAppId(null);
    setFormAuthorId(null);
    setLookupResults([]);
    setLookupQuery('');
  };

  const openAddModal = () => {
    resetForm();
    setIsAddEditModalOpen(true);
  };

  const openEditModal = (entry: AnudaanSanctionEntryOut) => {
    setEditingEntry(entry);
    setFormResearcher(entry.researcher_name);
    setFormDept(entry.department_name);
    setFormTitle(entry.publication_title);
    setFormDoi(entry.publication_doi || '');
    setFormQuartile(entry.quartile as 'Q1' | 'Q2' | 'Q3' | 'Q4');
    setFormAmount(String(entry.sanctioned_amount));
    setFormAcademicYear(entry.academic_year);
    setFormDate(entry.sanction_date);
    setFormRemarks(entry.remarks || '');
    setFormIsPublished(entry.is_published);
    setFormAppId(entry.application_id || null);
    setFormAuthorId(entry.author_id || null);
    setIsAddEditModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formResearcher.trim() || !formDept.trim() || !formTitle.trim()) {
      setFeedback({ type: 'error', message: 'Please provide researcher name, department, and publication title.' });
      return;
    }
    const parsedAmount = Number(formAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setFeedback({ type: 'error', message: 'Sanctioned amount must be a non-negative number.' });
      return;
    }

    try {
      setActionLoading(true);
      if (editingEntry) {
        await anudaanAdminService.updateSanction(editingEntry.id, {
          researcher_name: formResearcher.trim(),
          department_name: formDept.trim(),
          publication_title: formTitle.trim(),
          publication_doi: formDoi.trim() || null,
          quartile: formQuartile,
          sanctioned_amount: parsedAmount,
          academic_year: formAcademicYear,
          sanction_date: formDate,
          remarks: formRemarks.trim() || null,
          is_published: formIsPublished,
          application_id: formAppId,
          author_id: formAuthorId,
        });
        setFeedback({ type: 'success', message: 'Sanction entry updated successfully.' });
      } else {
        await anudaanAdminService.createSanction({
          researcher_name: formResearcher.trim(),
          department_name: formDept.trim(),
          publication_title: formTitle.trim(),
          publication_doi: formDoi.trim() || null,
          quartile: formQuartile,
          sanctioned_amount: parsedAmount,
          academic_year: formAcademicYear,
          sanction_date: formDate,
          remarks: formRemarks.trim() || null,
          is_published: formIsPublished,
          application_id: formAppId,
          author_id: formAuthorId,
        });
        setFeedback({ type: 'success', message: 'Sanction entry created successfully.' });
      }

      setIsAddEditModalOpen(false);
      resetForm();
      fetchSanctions();
      fetchStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Operation failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePublish = async (entry: AnudaanSanctionEntryOut) => {
    try {
      setActionLoading(true);
      await anudaanAdminService.toggleSanctionPublish(entry.id, !entry.is_published);
      setFeedback({
        type: 'success',
        message: `Sanction entry ${!entry.is_published ? 'published to portal' : 'unpublished'}.`,
      });
      fetchSanctions();
      fetchStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle publication status.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEntry) return;
    try {
      setActionLoading(true);
      await anudaanAdminService.deleteSanction(deletingEntry.id);
      setFeedback({ type: 'success', message: 'Sanction entry deleted successfully.' });
      setIsDeleteModalOpen(false);
      setDeletingEntry(null);
      fetchSanctions();
      fetchStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete entry.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0B2545', margin: 0 }}>
                Incentive Sanction Register
              </h1>
              <span
                style={{
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                }}
              >
                Yajur Veda
              </span>
            </div>
            <p style={{ color: '#64748B', margin: '6px 0 0', fontSize: '0.95rem' }}>
              Official institutional publication incentive sanctions awarded by Chhatrapati Shahu Ji Maharaj University.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={openAddModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#0B2545',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Sanction Entry
          </Button>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              border: `1px solid ${feedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
              color: feedback.type === 'success' ? '#065F46' : '#991B1B',
            }}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Institutional Summary KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Sanction Entries
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0B2545', marginTop: 4 }}>
              {statsLoading ? '...' : stats?.total_sanction_entries ?? sanctions.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>Recorded university sanctions</div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Sanctioned (INR)
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#065F46', marginTop: 4 }}>
              ₹ {statsLoading ? '...' : Number(stats?.total_incentive_sanctioned_inr ?? totalSanctionedSum).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>Statutory incentive commitments</div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Researchers Recognised
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1E40AF', marginTop: 4 }}>
              {statsLoading ? '...' : stats?.total_researchers_recognised ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>Distinct university scholars</div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Quartile Distribution
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                <span
                  key={q}
                  style={{
                    backgroundColor: q === 'Q1' ? '#ECFDF5' : q === 'Q2' ? '#EFF6FF' : q === 'Q3' ? '#FEF3C7' : '#F1F5F9',
                    color: q === 'Q1' ? '#047857' : q === 'Q2' ? '#1D4ED8' : q === 'Q3' ? '#B45309' : '#475569',
                    border: `1px solid ${q === 'Q1' ? '#A7F3D0' : q === 'Q2' ? '#BFDBFE' : q === 'Q3' ? '#FDE68A' : '#CBD5E1'}`,
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {q}: {stats?.quartile_breakdown?.[q] ?? 0}
                </span>
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 8 }}>Indexed journal tiers</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: 16,
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            marginBottom: 20,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Search box */}
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search researcher, title, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="2"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#64748B', marginRight: 6, fontWeight: 600 }}>Quartile:</span>
              <select
                value={selectedQuartile}
                onChange={(e) => setSelectedQuartile(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              >
                <option value="ALL">All Quartiles</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', color: '#64748B', marginRight: 6, fontWeight: 600 }}>Period:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              >
                <option value="ALL">All Academic Years</option>
                <option value="2026-2027">2026-2027</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2024-2025">2024-2025</option>
              </select>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', color: '#64748B', marginRight: 6, fontWeight: 600 }}>Status:</span>
              <select
                value={selectedVisibility}
                onChange={(e) => setSelectedVisibility(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              >
                <option value="ALL">All Records</option>
                <option value="PUBLISHED">Published Only</option>
                <option value="UNPUBLISHED">Unpublished (Draft)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sanction Register Table */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>Loading sanction entries...</div>
          ) : sanctions.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0B2545', margin: 0 }}>No Sanction Entries Found</h3>
              <p style={{ fontSize: '0.9rem', color: '#94A3B8', marginTop: 4 }}>
                No records match your selected filter criteria. Use "+ Add Sanction Entry" to create a new record.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Researcher &amp; Dept</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Publication Title</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Quartile</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Sanctioned (INR)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Period &amp; Date</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Public Visibility</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sanctions.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0B2545' }}>{s.researcher_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>{s.department_name}</div>
                        {s.application_number && (
                          <div style={{ fontSize: '0.7rem', color: '#0284C7', marginTop: 2 }}>
                            Linked App: {s.application_number}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', maxWidth: 320 }}>
                        <div style={{ color: '#1E293B', fontWeight: 500, lineHeight: 1.4 }}>{s.publication_title}</div>
                        {s.publication_doi && (
                          <div style={{ fontSize: '0.75rem', color: '#2563EB', marginTop: 4 }}>DOI: {s.publication_doi}</div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              s.quartile === 'Q1' ? '#ECFDF5' : s.quartile === 'Q2' ? '#EFF6FF' : s.quartile === 'Q3' ? '#FEF3C7' : '#F1F5F9',
                            color:
                              s.quartile === 'Q1' ? '#047857' : s.quartile === 'Q2' ? '#1D4ED8' : s.quartile === 'Q3' ? '#B45309' : '#475569',
                          }}
                        >
                          {s.quartile}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        ₹ {Number(s.sanctioned_amount).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                        <div>{s.academic_year}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 2 }}>{s.sanction_date}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: s.is_published ? '#ECFDF5' : '#F1F5F9',
                            color: s.is_published ? '#065F46' : '#64748B',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: s.is_published ? '#10B981' : '#94A3B8',
                            }}
                          />
                          {s.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button
                            onClick={() => openEditModal(s)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#334155',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleTogglePublish(s)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: `1px solid ${s.is_published ? '#FCD34D' : '#A7F3D0'}`,
                              backgroundColor: s.is_published ? '#FFFBEB' : '#ECFDF5',
                              color: s.is_published ? '#92400E' : '#065F46',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {s.is_published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            onClick={() => {
                              setDeletingEntry(s);
                              setIsDeleteModalOpen(true);
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid #FECACA',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT SANCTION ENTRY MODAL */}
      {/* ========================================================================= */}
      {isAddEditModalOpen && (
        <Modal
          isOpen={isAddEditModalOpen}
          onClose={() => setIsAddEditModalOpen(false)}
          title={editingEntry ? 'Edit Incentive Sanction Entry' : 'Record University Incentive Sanction'}
        >
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Autofill lookup section (Only for Add Entry) */}
            {!editingEntry && (
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px dashed #CBD5E1',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Pre-fill from Existing ANUDAAN Application (Optional)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Search applicant name, number, or department..."
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLookupSearch}
                    disabled={lookupLoading}
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                  >
                    {lookupLoading ? 'Searching...' : 'Find'}
                  </Button>
                </div>

                {lookupResults.length > 0 && (
                  <div style={{ marginTop: 10, maxHeight: 150, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 6, backgroundColor: '#FFFFFF' }}>
                    {lookupResults.map((item) => (
                      <div
                        key={item.application_id}
                        onClick={() => handleSelectLookup(item)}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#0B2545' }}>
                          {item.applicant_name} ({item.application_number})
                        </div>
                        <div style={{ color: '#64748B' }}>{item.department_name} • {item.publication_title || 'No title'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Researcher Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Researcher Name *
              </label>
              <input
                type="text"
                required
                value={formResearcher}
                onChange={(e) => setFormResearcher(e.target.value)}
                placeholder="e.g. Dr. Ramesh Sharma"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
              />
            </div>

            {/* Department */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Department / School *
              </label>
              <input
                type="text"
                required
                value={formDept}
                onChange={(e) => setFormDept(e.target.value)}
                placeholder="e.g. Department of Physical Sciences"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
              />
            </div>

            {/* Publication Title */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Publication Title *
              </label>
              <textarea
                required
                rows={2}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Scalable Graphene Synthesis for Optoelectronic Applications"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
              />
            </div>

            {/* Row: DOI & Quartile */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Publication DOI (Optional)
                </label>
                <input
                  type="text"
                  value={formDoi}
                  onChange={(e) => setFormDoi(e.target.value)}
                  placeholder="e.g. 10.1038/s41586-026-00123-x"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Quartile *
                </label>
                <select
                  value={formQuartile}
                  onChange={(e) => setFormQuartile(e.target.value as 'Q1' | 'Q2' | 'Q3' | 'Q4')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                >
                  <option value="Q1">Q1 (Highest Impact)</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
              </div>
            </div>

            {/* Row: Sanctioned Amount & Academic Year */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Sanctioned Amount (INR) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Academic Year *
                </label>
                <select
                  value={formAcademicYear}
                  onChange={(e) => setFormAcademicYear(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                >
                  <option value="2026-2027">2026-2027</option>
                  <option value="2025-2026">2025-2026</option>
                  <option value="2024-2025">2024-2025</option>
                </select>
              </div>
            </div>

            {/* Row: Sanction Date & Remarks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Sanction Date *
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Remarks / Order No. (Optional)
                </label>
                <input
                  type="text"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="e.g. Order CSJMU/RES/2026/042"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            {/* Visibility Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                id="is_published_chk"
                checked={formIsPublished}
                onChange={(e) => setFormIsPublished(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="is_published_chk" style={{ fontSize: '0.875rem', color: '#1E293B', fontWeight: 500 }}>
                Publish on public Institutional Incentive Showcase
              </label>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <Button type="button" variant="outline" onClick={() => setIsAddEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : editingEntry ? 'Save Changes' : 'Record Sanction'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && deletingEntry && (
        <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion">
          <div>
            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete the incentive sanction entry for{' '}
              <strong>{deletingEntry.researcher_name}</strong> for the publication{' '}
              <em>"{deletingEntry.publication_title}"</em> (₹ {Number(deletingEntry.sanctioned_amount).toLocaleString('en-IN')})?
            </p>
            <p style={{ color: '#DC2626', fontSize: '0.85rem', fontWeight: 600 }}>
              This action cannot be undone and will be logged in the system audit trail.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <Button type="button" variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
                style={{ backgroundColor: '#DC2626', borderColor: '#DC2626', color: '#FFFFFF' }}
              >
                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
export default AnudaanSanctionRegisterPage;
