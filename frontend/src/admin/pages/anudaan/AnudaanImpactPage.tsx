import React, { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Input } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { anudaanAdminService } from '../../services/anudaanAdminService';
import type {
  AnudaanPublicImpactStats,
  AnudaanDisbursementOut,
} from '../../types/anudaan';

export const AnudaanImpactPage: React.FC = () => {

  // Selected academic year filter
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  // Stats state
  const [stats, setStats] = useState<AnudaanPublicImpactStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Disbursements state
  const [disbursements, setDisbursements] = useState<AnudaanDisbursementOut[]>([]);
  const [totalDisbursedSum, setTotalDisbursedSum] = useState<number | string>(0);
  const [disbLoading, setDisbLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [activeDisbursement, setActiveDisbursement] = useState<AnudaanDisbursementOut | null>(null);

  // Form states
  const [formAppId, setFormAppId] = useState('');
  const [formRef, setFormRef] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAcademicYear, setFormAcademicYear] = useState('2025-2026');
  const [formMethod, setFormMethod] = useState('NEFT');
  const [formNotes, setFormNotes] = useState('');

  // Verification & Reversal inputs
  const [verifyNotes, setVerifyNotes] = useState('');
  const [reversalReason, setReversalReason] = useState('');

  // General feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await anudaanAdminService.getImpactStats(selectedYear === 'ALL' ? undefined : selectedYear);
      setStats(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load impact stats.' });
    } finally {
      setStatsLoading(false);
    }
  }, [selectedYear]);

  // Load disbursements
  const fetchDisbursements = useCallback(async () => {
    try {
      setDisbLoading(true);
      const data = await anudaanAdminService.getDisbursements({
        academic_year: selectedYear === 'ALL' ? undefined : selectedYear,
        verification_status: statusFilter || undefined,
        limit: 100,
      });
      setDisbursements(data.items);
      setTotalDisbursedSum(data.total_amount_inr);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load disbursements.' });
    } finally {
      setDisbLoading(false);
    }
  }, [selectedYear, statusFilter]);

  useEffect(() => {
    fetchStats();
    fetchDisbursements();
  }, [fetchStats, fetchDisbursements]);

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAppId.trim() || !formRef.trim() || !formAmount || Number(formAmount) <= 0) {
      setFeedback({ type: 'error', message: 'Please provide valid Application ID, Reference, and Amount.' });
      return;
    }

    try {
      setActionLoading(true);
      await anudaanAdminService.recordDisbursement({
        application_id: formAppId.trim(),
        disbursement_reference: formRef.trim(),
        amount: Number(formAmount),
        disbursement_date: formDate,
        academic_year: formAcademicYear,
        payment_method: formMethod,
        notes: formNotes.trim() || null,
      });

      setFeedback({ type: 'success', message: 'Disbursement recorded in RECORDED state successfully.' });
      setIsRecordModalOpen(false);
      // Reset form
      setFormAppId('');
      setFormRef('');
      setFormAmount('');
      setFormNotes('');
      fetchStats();
      fetchDisbursements();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to record disbursement.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifySubmit = async () => {
    if (!activeDisbursement) return;
    try {
      setActionLoading(true);
      await anudaanAdminService.verifyDisbursement(activeDisbursement.id, verifyNotes);
      setFeedback({ type: 'success', message: `Disbursement ${activeDisbursement.disbursement_reference} verified.` });
      setIsVerifyModalOpen(false);
      setActiveDisbursement(null);
      setVerifyNotes('');
      fetchStats();
      fetchDisbursements();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to verify transaction.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverseSubmit = async () => {
    if (!activeDisbursement) return;
    if (!reversalReason.trim()) {
      setFeedback({ type: 'error', message: 'Mandatory justification is required for reversal.' });
      return;
    }
    try {
      setActionLoading(true);
      await anudaanAdminService.reverseDisbursement(activeDisbursement.id, reversalReason.trim());
      setFeedback({ type: 'success', message: `Disbursement ${activeDisbursement.disbursement_reference} marked as reversed.` });
      setIsReverseModalOpen(false);
      setActiveDisbursement(null);
      setReversalReason('');
      fetchStats();
      fetchDisbursements();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reverse transaction.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout activeTab="anudaan-impact">
      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header with Academic Year Filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0B2545', margin: '0 0 6px' }}>
              Institutional Incentive Impact & Disbursements
            </h1>
            <p style={{ color: '#4A5568', margin: 0, fontSize: '0.95rem' }}>
              Audited incentive metrics, claims lifecycle overview, and controlled bank disbursement ledger.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: '#4A5568', fontWeight: 500 }}>Academic Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                backgroundColor: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#0B2545',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Periods (Consolidated)</option>
              {(stats?.academic_years_available || ['2026-2027', '2025-2026']).map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={() => setIsRecordModalOpen(true)}>
              + Record Bank Disbursement
            </Button>
          </div>
        </div>

        {/* Global Feedback Banner */}
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

        {/* 6 Core Impact Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {/* Card 1: Claims Received */}
          <div style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Claims Received
            </span>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0B2545', marginTop: 4 }}>
              {statsLoading ? '...' : stats?.total_claims_received || 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Excludes draft submissions</span>
          </div>

          {/* Card 2: Claims Approved */}
          <div style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.8rem', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Claims Approved
            </span>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#047857', marginTop: 4 }}>
              {statsLoading ? '...' : stats?.claims_approved || 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Accepted & release approved</span>
          </div>

          {/* Card 3: Claims Under Review */}
          <div style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.8rem', color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Under Review
            </span>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#D97706', marginTop: 4 }}>
              {statsLoading ? '...' : stats?.claims_under_review || 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Dean / Authority pipeline</span>
          </div>

          {/* Card 4: Claims Rejected */}
          <div style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.8rem', color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Claims Rejected
            </span>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#DC2626', marginTop: 4 }}>
              {statsLoading ? '...' : stats?.claims_rejected || 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Declined after evaluation</span>
          </div>

          {/* Card 5: Researchers Benefited */}
          <div style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.8rem', color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Researchers Benefited
            </span>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#2563EB', marginTop: 4 }}>
              {statsLoading ? '...' : stats?.researchers_benefited || 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Unique payable researchers</span>
          </div>

          {/* Card 6: Actual Incentive Disbursed */}
          <div style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.8rem', color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Amount Disbursed (Verified)
            </span>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#B45309', marginTop: 4 }}>
              ₹ {statsLoading ? '...' : Number(stats?.total_incentive_disbursed_inr || 0).toLocaleString('en-IN')}
            </div>
            <span style={{ fontSize: '0.75rem', color: stats?.disbursement_status === 'VERIFIED' ? '#047857' : '#D97706', fontWeight: 600 }}>
              {stats?.disbursement_status === 'VERIFIED' ? '✓ Reconciled Bank Ledger' : '⚠ Awaiting Bank Statements'}
            </span>
          </div>
        </div>

        {/* Section: Controlled Financial Disbursements Ledger */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #E2E8F0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0B2545', margin: '0 0 4px' }}>
                Bank Incentive Disbursement Ledger <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#64748B' }}>(Filtered Total: ₹{Number(totalDisbursedSum).toLocaleString('en-IN')})</span>
              </h2>
              <p style={{ color: '#64748B', fontSize: '0.875rem', margin: 0 }}>
                Traceable institutional financial payouts. Status must be <strong>VERIFIED</strong> to count in public totals.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
              >
                <option value="">All Verification States</option>
                <option value="RECORDED">RECORDED (Pending Proof)</option>
                <option value="VERIFIED">VERIFIED (Audited)</option>
                <option value="REVERSED">REVERSED</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {disbLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>Loading disbursement ledger...</div>
          ) : disbursements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏦</div>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0B2545' }}>No Disbursements Recorded Yet</div>
              <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
                Record confirmed bank transfers with official UTR numbers to build verified institutional statistics.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '12px 14px' }}>UTR / Reference</th>
                    <th style={{ padding: '12px 14px' }}>Application</th>
                    <th style={{ padding: '12px 14px' }}>Applicant / Payee</th>
                    <th style={{ padding: '12px 14px' }}>Amount (INR)</th>
                    <th style={{ padding: '12px 14px' }}>Transfer Date</th>
                    <th style={{ padding: '12px 14px' }}>Period</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {disbursements.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0F172A' }}>
                        {d.disbursement_reference}
                        {d.reversal_reason && (
                          <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: 2 }}>
                            Reversal: {d.reversal_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#2563EB' }}>
                        {d.application_number}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#334155' }}>
                        <div>{d.applicant_name}</div>
                        {d.author_name && (
                          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Payee: {d.author_name}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0B2545' }}>
                        ₹ {Number(d.amount).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {d.disbursement_date}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {d.academic_year}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              d.verification_status === 'VERIFIED'
                                ? '#DEF7EC'
                                : d.verification_status === 'REVERSED'
                                ? '#FDE8E8'
                                : '#FEF3C7',
                            color:
                              d.verification_status === 'VERIFIED'
                                ? '#03543F'
                                : d.verification_status === 'REVERSED'
                                ? '#9B1C1C'
                                : '#92400E',
                          }}
                        >
                          {d.verification_status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {d.verification_status === 'RECORDED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setActiveDisbursement(d);
                                setIsVerifyModalOpen(true);
                              }}
                            >
                              Verify
                            </Button>
                          )}
                          {d.verification_status !== 'REVERSED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              style={{ color: '#DC2626' }}
                              onClick={() => {
                                setActiveDisbursement(d);
                                setIsReverseModalOpen(true);
                              }}
                            >
                              Reverse
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
        </div>
      </div>

      {/* Record Disbursement Modal */}
      {isRecordModalOpen && (
        <Modal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          title="Record Bank Incentive Disbursement"
        >
          <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Application UUID *
              </label>
              <Input
                value={formAppId}
                onChange={(e) => setFormAppId(e.target.value)}
                placeholder="e.g. b8f4a132-7f28-4ad0-b8d9-9524ec174152"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Bank UTR / Transaction Reference *
              </label>
              <Input
                value={formRef}
                onChange={(e) => setFormRef(e.target.value)}
                placeholder="e.g. UTR-SBIN20260220-89104"
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Amount in INR (₹) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="e.g. 25000.00"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Payment Method
                </label>
                <select
                  value={formMethod}
                  onChange={(e) => setFormMethod(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                >
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="PFMS">PFMS</option>
                  <option value="TREASURY">State Treasury Transfer</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Disbursement Date *
                </label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Academic Year *
                </label>
                <Input
                  value={formAcademicYear}
                  onChange={(e) => setFormAcademicYear(e.target.value)}
                  placeholder="e.g. 2025-2026"
                  required
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Internal Audit Remarks
              </label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Sanction letter reference VC/RES/2026/042"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <Button variant="outline" type="button" onClick={() => setIsRecordModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={actionLoading}>
                {actionLoading ? 'Recording...' : 'Record Transaction'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Verify Modal */}
      {isVerifyModalOpen && activeDisbursement && (
        <Modal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          title="Verify Bank Disbursement"
        >
          <div>
            <p style={{ color: '#475569', fontSize: '0.925rem', marginBottom: 16 }}>
              Confirm that reference <strong>{activeDisbursement.disbursement_reference}</strong> for{' '}
              <strong>₹ {Number(activeDisbursement.amount).toLocaleString('en-IN')}</strong> has been reconciled
              against official university bank statements.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Verification Note (Optional)
              </label>
              <Input
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="e.g. Reconciled with SBI passbook / monthly statement page 4"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button variant="outline" onClick={() => setIsVerifyModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleVerifySubmit} disabled={actionLoading}>
                {actionLoading ? 'Verifying...' : 'Confirm Verification'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reverse Modal */}
      {isReverseModalOpen && activeDisbursement && (
        <Modal
          isOpen={isReverseModalOpen}
          onClose={() => setIsReverseModalOpen(false)}
          title="Reverse Disbursement Transaction"
        >
          <div>
            <p style={{ color: '#DC2626', fontSize: '0.925rem', marginBottom: 16 }}>
              Warning: Reversing transaction <strong>{activeDisbursement.disbursement_reference}</strong> will
              immediately exclude this amount from all public institutional totals.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Mandatory Reversal Justification *
              </label>
              <Input
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Payment bounced / wrong account / recalled by accounts"
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button variant="outline" onClick={() => setIsReverseModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="ghost" style={{ backgroundColor: '#DC2626', color: '#ffffff' }} onClick={handleReverseSubmit} disabled={actionLoading}>
                {actionLoading ? 'Reversing...' : 'Execute Reversal'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
