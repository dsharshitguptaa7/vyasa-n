import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  StatusBadge,
  STATUS_MAP,
  formatStatusLabel,
  getStatusVariant,
  TableCard,
  ErrorState,
} from '@vyasa/ui';
import { WorkflowActionModal } from '../components/common/WorkflowActionModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ResolveGrievanceModal } from '../modules/atharva-veda/nivaran/components/ResolveGrievanceModal';
import { ForwardToDeanModal } from '../modules/atharva-veda/nivaran/components/ForwardToDeanModal';
import { formatUserFacingError, formatActorLabel } from '../utils/language';

describe('Phase 3: Shared Component & Modal Standardization Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* -------------------------------------------------------------------------
   * 1. StatusBadge & Centralized Status Mapping
   * ----------------------------------------------------------------------- */
  describe('1. StatusBadge & Centralized Status Mapping', () => {
    it('correctly maps canonical workflow enum keys to user-facing labels', () => {
      expect(formatStatusLabel('SUBMITTED')).toBe('Submitted');
      expect(formatStatusLabel('PENDING_REVIEW')).toBe('Under Review');
      expect(formatStatusLabel('AWAITING_INFORMATION')).toBe('Action Required');
      expect(formatStatusLabel('AWAITING_INFO')).toBe('Action Required');
      expect(formatStatusLabel('IN_PROGRESS')).toBe('In Progress');
      expect(formatStatusLabel('ESCALATED')).toBe('Escalated');
      expect(formatStatusLabel('RESOLVED')).toBe('Resolved');
      expect(formatStatusLabel('CLOSED')).toBe('Closed');
      expect(formatStatusLabel('REJECTED')).toBe('Rejected');
      expect(formatStatusLabel('APPROVED')).toBe('Approved');
      expect(formatStatusLabel('SANCTIONED')).toBe('Sanctioned');
      expect(formatStatusLabel('DISBURSED')).toBe('Disbursed');
      expect(formatStatusLabel('PUBLISHED')).toBe('Published');
      expect(formatStatusLabel('REVOKED')).toBe('Revoked');
      expect(formatStatusLabel('SEALED')).toBe('Digitally Sealed');
    });

    it('assigns semantic visual variants to statuses', () => {
      expect(getStatusVariant('RESOLVED')).toBe('success');
      expect(getStatusVariant('APPROVED')).toBe('success');
      expect(getStatusVariant('REJECTED')).toBe('danger');
      expect(getStatusVariant('REVOKED')).toBe('danger');
      expect(getStatusVariant('PENDING_REVIEW')).toBe('warning');
      expect(getStatusVariant('AWAITING_INFORMATION')).toBe('warning');
      expect(getStatusVariant('SUBMITTED')).toBe('info');
      expect(getStatusVariant('CLOSED')).toBe('neutral');
    });

    it('safely handles unknown and edge-case status values without crashes or raw identifiers', () => {
      expect(formatStatusLabel('CUSTOM_SYSTEM_EVENT')).toBe('Custom System Event');
      expect(getStatusVariant('CUSTOM_SYSTEM_EVENT')).toBe('neutral');

      expect(formatStatusLabel(null)).toBe('Unknown');
      expect(formatStatusLabel(undefined)).toBe('Unknown');
      expect(formatStatusLabel('')).toBe('Unknown');
      expect(formatStatusLabel({} as any)).toBe('Unknown');
      expect(getStatusVariant(null)).toBe('neutral');
    });

    it('renders StatusBadge component with correct label and variant classes', () => {
      const { rerender } = render(<StatusBadge status="PENDING_REVIEW" />);
      let badge = screen.getByText('Under Review');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('.vyasa-badge')).toHaveClass('vyasa-badge--warning');

      rerender(<StatusBadge status="RESOLVED" />);
      badge = screen.getByText('Resolved');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('.vyasa-badge')).toHaveClass('vyasa-badge--success');

      rerender(<StatusBadge status={null} fallbackLabel="Not Evaluated" />);
      expect(screen.getByText('Not Evaluated')).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------
   * 2. WorkflowActionModal Foundation
   * ----------------------------------------------------------------------- */
  describe('2. WorkflowActionModal Foundation', () => {
    it('renders modal title, alert box, character count validation, and handles submission', () => {
      const handleClose = vi.fn();
      const handleSubmit = vi.fn();
      let fieldValue = '';

      const { rerender } = render(
        <WorkflowActionModal
          isOpen={true}
          onClose={handleClose}
          title="Formal Determination"
          subtitle="Stage 2 Review"
          description="Please specify the official regulatory determination."
          alert={{
            type: 'warning',
            message: 'All decisions are permanently recorded in the institutional audit log.',
          }}
          field={{
            label: 'Justification *',
            value: fieldValue,
            onChange: (v) => {
              fieldValue = v;
            },
            minChars: 10,
            required: true,
          }}
          primaryAction={{
            label: 'Execute Determination',
            onClick: handleSubmit,
          }}
        />
      );

      expect(screen.getByText('Formal Determination')).toBeInTheDocument();
      expect(screen.getByText('Stage 2 Review')).toBeInTheDocument();
      expect(screen.getByText(/All decisions are permanently recorded/)).toBeInTheDocument();
      expect(screen.getByText(/0 \/ 10 min characters/)).toBeInTheDocument();

      // Submit should be disabled when under minChars
      const submitBtn = screen.getByRole('button', { name: 'Execute Determination' });
      expect(submitBtn).toBeDisabled();

      // Re-render with valid text
      rerender(
        <WorkflowActionModal
          isOpen={true}
          onClose={handleClose}
          title="Formal Determination"
          field={{
            label: 'Justification *',
            value: 'Valid institutional justification meeting minimum requirements',
            onChange: vi.fn(),
            minChars: 10,
            required: true,
          }}
          primaryAction={{
            label: 'Execute Determination',
            onClick: handleSubmit,
          }}
        />
      );

      const activeSubmitBtn = screen.getByRole('button', { name: 'Execute Determination' });
      expect(activeSubmitBtn).not.toBeDisabled();
      fireEvent.click(activeSubmitBtn);
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
  });

  /* -------------------------------------------------------------------------
   * 3. Migrated NIVARAN Workflow Modals
   * ----------------------------------------------------------------------- */
  describe('3. Migrated NIVARAN Workflow Modals', () => {
    it('ResolveGrievanceModal validates minimum 3 characters and dispatches payload', async () => {
      const handleSubmit = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <ResolveGrievanceModal
          isOpen={true}
          onClose={handleClose}
          onSubmit={handleSubmit}
          grievanceId="GRV-2026-9001"
        />
      );

      expect(screen.getByText(/Direct Resolution • GRV-2026-9001/i)).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/Record the official resolution determination/i);
      const submitBtn = screen.getByRole('button', { name: 'Commit Formal Resolution' });

      // Initially disabled
      expect(submitBtn).toBeDisabled();

      // Type 2 chars (still invalid)
      fireEvent.change(textarea, { target: { value: 'OK' } });
      expect(submitBtn).toBeDisabled();

      // Type 10 chars (valid)
      fireEvent.change(textarea, { target: { value: 'Resolved satisfactorily after RAC verification.' } });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);
      expect(handleSubmit).toHaveBeenCalledWith({
        resolution_notes: 'Resolved satisfactorily after RAC verification.',
      });
    });

    it('ForwardToDeanModal renders destination card and submits escalation rationale', async () => {
      const handleSubmit = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <ForwardToDeanModal
          isOpen={true}
          onClose={handleClose}
          onSubmit={handleSubmit}
          grievanceId="GRV-2026-8802"
          targetDean={{
            id: 'dean-1',
            name: 'Prof. Namita Tiwari',
            role: 'Dean R&D',
            email: 'dean.rnd@csjmu.ac.in',
          }}
        />
      );

      expect(screen.getByText(/Escalate Grievance to Dean R&D/i)).toBeInTheDocument();
      expect(screen.getByText('Prof. Namita Tiwari')).toBeInTheDocument();
      expect(screen.getByText(/dean.rnd@csjmu.ac.in/i)).toBeInTheDocument();

      const reasonInput = screen.getByLabelText(/Institutional Escalation Justification/i);
      const submitBtn = screen.getByRole('button', { name: /Confirm Escalation to Dean/i });

      expect(submitBtn).toBeDisabled();

      fireEvent.change(reasonInput, { target: { value: 'Requires executive decision from Dean R&D.' } });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);
      expect(handleSubmit).toHaveBeenCalledWith({
        reason: 'Requires executive decision from Dean R&D.',
        remarks: undefined,
      });
    });
  });

  /* -------------------------------------------------------------------------
   * 4. ConfirmDialog for Destructive / High-Consequence Actions
   * ----------------------------------------------------------------------- */
  describe('4. ConfirmDialog Standardization', () => {
    it('renders dialog, affected record details, and handles confirm action', () => {
      const handleConfirm = vi.fn();
      const handleClose = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title="Revoke Research Certificate"
          affectedRecord={{
            title: 'Certificate #CERT-2026-0042',
            subtitle: 'Issued to Dr. Rajesh Verma (Physics)',
          }}
          message="Are you sure you want to revoke this research certificate? This action will immediately invalidate public QR verification."
          confirmLabel="Confirm Revocation"
          variant="danger"
          isIrreversible={true}
        />
      );

      expect(screen.getByText('Revoke Research Certificate')).toBeInTheDocument();
      expect(screen.getByText('Certificate #CERT-2026-0042')).toBeInTheDocument();
      expect(screen.getByText('Issued to Dr. Rajesh Verma (Physics)')).toBeInTheDocument();
      expect(screen.getByText(/Irreversible Action:/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: 'Confirm Revocation' });
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it('enforces explicit typed confirmation when requiredConfirmationText is set', () => {
      const handleConfirm = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={handleConfirm}
          title="Delete Authority Assignment"
          requiredConfirmationText="DELETE"
          confirmLabel="Permanently Delete"
        />
      );

      const confirmBtn = screen.getByRole('button', { name: 'Permanently Delete' });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByPlaceholderText('Type "DELETE"');
      fireEvent.change(input, { target: { value: 'DEL' } });
      expect(confirmBtn).toBeDisabled();

      fireEvent.change(input, { target: { value: 'DELETE' } });
      expect(confirmBtn).not.toBeDisabled();

      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });
  });

  /* -------------------------------------------------------------------------
   * 5. ErrorState & EmptyState Feedback Components
   * ----------------------------------------------------------------------- */
  describe('5. ErrorState & Feedback Standards', () => {
    it('renders human-readable ErrorState with retry button and hidden diagnostic details', () => {
      const handleRetry = vi.fn();

      render(
        <ErrorState
          title="Docket Loading Interrupted"
          message="Could not retrieve the requested docket cases."
          error={new Error('PostgreSQL deadlock at connection #48')}
          onRetry={handleRetry}
          retryLabel="Reload Docket"
        />
      );

      expect(screen.getByText('Docket Loading Interrupted')).toBeInTheDocument();
      expect(screen.getByText('Could not retrieve the requested docket cases.')).toBeInTheDocument();

      // Technical exception trace should NOT be visible by default
      expect(screen.queryByText(/PostgreSQL deadlock/)).not.toBeInTheDocument();

      // Clicking diagnostic button reveals details safely
      const diagnosticBtn = screen.getByRole('button', { name: 'Show Diagnostic Details' });
      fireEvent.click(diagnosticBtn);
      expect(screen.getByText(/PostgreSQL deadlock/)).toBeInTheDocument();

      // Retry button calls callback
      const retryBtn = screen.getByRole('button', { name: 'Reload Docket' });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  /* -------------------------------------------------------------------------
   * 6. TableCard Presentation Component
   * ----------------------------------------------------------------------- */
  describe('6. TableCard Presentation Component', () => {
    it('renders table content with title and responsive container', () => {
      render(
        <TableCard
          title="Institutional Case Docket"
          subtitle="Total Active: 12"
          headerActions={<button type="button">Export CSV</button>}
          footer={<div>Showing 1 to 10 of 12 records</div>}
        >
          <table className="vyasa-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>GRV-001</td>
                <td>Under Review</td>
              </tr>
            </tbody>
          </table>
        </TableCard>
      );

      expect(screen.getByText('Institutional Case Docket')).toBeInTheDocument();
      expect(screen.getByText('Total Active: 12')).toBeInTheDocument();
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
      expect(screen.getByText('GRV-001')).toBeInTheDocument();
      expect(screen.getByText('Showing 1 to 10 of 12 records')).toBeInTheDocument();
    });

    it('renders EmptyState within TableCard when isEmpty is true', () => {
      render(
        <TableCard
          title="Jurisdictional Cases"
          isEmpty={true}
          emptyTitle="No Assigned Grievances"
          emptyDescription="There are currently no cases pending your review."
        />
      );

      expect(screen.getByText('No Assigned Grievances')).toBeInTheDocument();
      expect(screen.getByText('There are currently no cases pending your review.')).toBeInTheDocument();
    });

    it('renders loading state without layout collapse when loading is true', () => {
      render(
        <TableCard
          title="Docket"
          loading={true}
          loadingMessage="Fetching authoritative cases..."
        />
      );

      expect(screen.getByText('Fetching authoritative cases...')).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------
   * 7. User-Facing Language & Error Normalization
   * ----------------------------------------------------------------------- */
  describe('7. User-Facing Language Normalization', () => {
    it('formats raw HTTP exceptions into clean, dignified English', () => {
      expect(formatUserFacingError(new Error('Request failed with status code 422: Unprocessable Entity'))).toBe(
        'Please check the required form fields and try again.'
      );
      expect(formatUserFacingError(new Error('Request failed with status code 401'))).toBe(
        'Your session has expired. Please log in again to continue.'
      );
      expect(formatUserFacingError(new Error('Request failed with status code 403'))).toBe(
        'You do not have jurisdictional permission to perform this action.'
      );
      expect(formatUserFacingError(new Error('Request failed with status code 404'))).toBe(
        'The requested record could not be found.'
      );
      expect(formatUserFacingError(new Error('500 Internal Server Error'))).toBe(
        'The university server encountered a temporary issue. Please try again shortly.'
      );
      expect(formatUserFacingError(new Error('Network Error'))).toBe(
        'Network connection issue. Please verify your internet connection and try again.'
      );
    });

    it('translates internal actor identifiers into institutional human labels', () => {
      expect(formatActorLabel('SYSTEM')).toBe('Automated System');
      expect(formatActorLabel('USER')).toBe('Scholar / Applicant');
      expect(formatActorLabel('MANAGER')).toBe('Grievance Manager');
      expect(formatActorLabel('ASSISTANT_DEAN')).toBe('Assistant Dean');
      expect(formatActorLabel('ASSOCIATE_DEAN')).toBe('Associate Dean');
      expect(formatActorLabel('DEAN')).toBe('Dean R&D');
      expect(formatActorLabel('VICE_CHANCELLOR')).toBe('Vice Chancellor');
    });
  });
});
