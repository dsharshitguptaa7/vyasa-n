import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  StatusBadge,
  TableCard,
  ErrorState,
  formatStatusLabel,
  getStatusVariant,
} from '@vyasa/ui';
import {
  formatUserFacingError,
  formatActorLabel,
  formatCurrency,
  formatFileSize,
  formatSafeText,
  formatAuthorsList,
} from '../utils/language';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { AnudaanStepper } from '../modules/yajur-veda/components/AnudaanStepper';

describe('Phase 4: Application-Wide Content, Formatting & Responsive Polish Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* -------------------------------------------------------------------------
   * 1. User-Facing Language Standardization
   * ----------------------------------------------------------------------- */
  describe('1. User-Facing Language Standardization', () => {
    it('converts raw technical workflow enum strings to dignified English', () => {
      expect(formatStatusLabel('PENDING_REVIEW')).toBe('Under Review');
      expect(formatStatusLabel('AWAITING_INFORMATION')).toBe('Action Required');
      expect(formatStatusLabel('AWAITING_INFO')).toBe('Action Required');
      expect(formatStatusLabel('SUBMITTED')).toBe('Submitted');
      expect(formatStatusLabel('IN_PROGRESS')).toBe('In Progress');
      expect(formatStatusLabel('ESCALATED')).toBe('Escalated');
      expect(formatStatusLabel('APPROVED')).toBe('Approved');
      expect(formatStatusLabel('REJECTED')).toBe('Rejected');
      expect(formatStatusLabel('RESOLVED')).toBe('Resolved');
      expect(formatStatusLabel('CLOSED')).toBe('Closed');
      expect(formatStatusLabel('SANCTIONED')).toBe('Sanctioned');
      expect(formatStatusLabel('DISBURSED')).toBe('Disbursed');
      expect(formatStatusLabel('PUBLISHED')).toBe('Published');
      expect(formatStatusLabel('REVOKED')).toBe('Revoked');
      expect(formatStatusLabel('SEALED')).toBe('Digitally Sealed');
    });

    it('translates HTTP status codes and technical errors into actionable guidance', () => {
      expect(
        formatUserFacingError(new Error('Request failed with status code 422 (Unprocessable Entity)'))
      ).toBe('Please check the required form fields and try again.');

      expect(
        formatUserFacingError(new Error('AxiosError: Request failed with status code 401 Unauthorized'))
      ).toBe('Your session has expired. Please log in again to continue.');

      expect(
        formatUserFacingError(new Error('403 Forbidden: Missing required authority scope'))
      ).toBe('You do not have jurisdictional permission to perform this action.');

      expect(
        formatUserFacingError(new Error('404 Not Found'))
      ).toBe('The requested record could not be found.');

      expect(
        formatUserFacingError(new Error('500 Internal Server Error in PostgreSQL query'))
      ).toBe('The university server encountered a temporary issue. Please try again shortly.');

      expect(
        formatUserFacingError(new Error('TypeError: Failed to fetch (Network Error)'))
      ).toBe('Network connection issue. Please verify your internet connection and try again.');
    });

    it('shields users from raw stack traces and [object Object] leaks', () => {
      expect(formatUserFacingError('[object Object]')).toBe(
        'An unexpected error occurred while processing this request.'
      );
      expect(formatUserFacingError(null)).toBe('An unexpected issue occurred. Please try again.');
      expect(formatUserFacingError(undefined)).toBe('An unexpected issue occurred. Please try again.');
    });

    it('translates internal actor identifiers into institutional user-facing labels', () => {
      expect(formatActorLabel('SYSTEM')).toBe('Automated System');
      expect(formatActorLabel('AI')).toBe('Automated System');
      expect(formatActorLabel('USER')).toBe('Scholar / Applicant');
      expect(formatActorLabel('APPLICANT')).toBe('Scholar / Applicant');
      expect(formatActorLabel('MANAGER')).toBe('Grievance Manager');
      expect(formatActorLabel('ASSISTANT_DEAN')).toBe('Assistant Dean');
      expect(formatActorLabel('ASSOCIATE_DEAN')).toBe('Associate Dean');
      expect(formatActorLabel('DEAN')).toBe('Dean R&D');
      expect(formatActorLabel('VICE_CHANCELLOR')).toBe('Vice Chancellor');
      expect(formatActorLabel(null)).toBe('Participant');
    });
  });

  /* -------------------------------------------------------------------------
   * 2. Data Formatting and Display Safety
   * ----------------------------------------------------------------------- */
  describe('2. Data Formatting & Display Safety', () => {
    it('formats monetary amounts into Indian Rupee format safely', () => {
      const formatted = formatCurrency(50000);
      expect(formatted).toMatch(/₹\s*50,000/);

      const large = formatCurrency(1250000);
      expect(large).toMatch(/₹\s*12,50,000/);

      expect(formatCurrency(null)).toBe('₹0');
      expect(formatCurrency(undefined)).toBe('₹0');
      expect(formatCurrency(NaN)).toBe('₹0');
      expect(formatCurrency('invalid_num', 'Not applicable')).toBe('Not applicable');
    });

    it('formats file sizes into human-readable data units and shields raw byte counts', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(2097152)).toBe('2.0 MB');
      expect(formatFileSize(1073741824)).toBe('1.0 GB');

      expect(formatFileSize(null)).toBe('Not available');
      expect(formatFileSize(undefined)).toBe('Not available');
      expect(formatFileSize(-100)).toBe('Not available');
    });

    it('safely guards dynamic text from null, undefined, and [object Object]', () => {
      expect(formatSafeText('Valid Title')).toBe('Valid Title');
      expect(formatSafeText(null)).toBe('Not provided');
      expect(formatSafeText(undefined)).toBe('Not provided');
      expect(formatSafeText('   ')).toBe('Not provided');
      expect(formatSafeText('[object Object]')).toBe('Not provided');
      expect(formatSafeText(NaN)).toBe('Not provided');
      expect(formatSafeText(null, 'Awaiting update')).toBe('Awaiting update');
    });

    it('formats multi-author lists with clean overflow indicators', () => {
      expect(formatAuthorsList(['Dr. Aditi Sharma', 'Prof. Ramesh Verma'])).toBe(
        'Dr. Aditi Sharma, Prof. Ramesh Verma'
      );
      expect(
        formatAuthorsList(['Dr. A. Sharma', 'Prof. R. Verma', 'Dr. S. Gupta', 'Dr. M. Singh'], 2)
      ).toBe('Dr. A. Sharma, Prof. R. Verma +2 more');

      expect(formatAuthorsList('Dr. A. Sharma, Prof. R. Verma, Dr. S. Gupta', 2)).toBe(
        'Dr. A. Sharma, Prof. R. Verma +1 more'
      );
      expect(formatAuthorsList(null)).toBe('Authors not listed');
      expect(formatAuthorsList([])).toBe('Authors not listed');
    });
  });

  /* -------------------------------------------------------------------------
   * 3. Form UX, Feedback & Notification Behavior
   * ----------------------------------------------------------------------- */
  describe('3. Form UX & Feedback Standards', () => {
    it('prevents accidental duplicate submission and handles loading state in ConfirmDialog', async () => {
      const handleConfirm = vi.fn().mockReturnValue(new Promise(() => {}));

      const { rerender } = render(
        <ConfirmDialog
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={handleConfirm}
          title="Revoke Certificate"
          confirmLabel="Confirm Revocation"
          loading={false}
        />
      );

      const confirmBtn = screen.getByRole('button', { name: 'Confirm Revocation' });
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledTimes(1);

      // Re-render in loading state
      rerender(
        <ConfirmDialog
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={handleConfirm}
          title="Revoke Certificate"
          confirmLabel="Confirm Revocation"
          loading={true}
        />
      );

      const disabledBtn = screen.getByRole('button', { name: 'Processing...' });
      expect(disabledBtn).toBeDisabled();
      fireEvent.click(disabledBtn);
      // Confirm should not have been called a second time
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it('renders ErrorState with clear institutional heading and retry capability', () => {
      const handleRetry = vi.fn();
      render(
        <ErrorState
          title="Grievance Dossier Unavailable"
          message="Unable to load the evidentiary records for this case."
          onRetry={handleRetry}
          retryLabel="Retry Loading"
          showBack={true}
        />
      );

      expect(screen.getByText('Grievance Dossier Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/Unable to load the evidentiary records/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: 'Retry Loading' });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  /* -------------------------------------------------------------------------
   * 4. Responsive Design & Layout Polish
   * ----------------------------------------------------------------------- */
  describe('4. Responsive Design & Layout Polish', () => {
    it('renders AnudaanStepper with horizontal overflow protection for mobile viewports', () => {
      const { container } = render(
        <AnudaanStepper
          currentStep={2}
          completedSteps={[1]}
        />
      );

      const ol = container.querySelector('.anudaan-stepper-list');
      expect(ol).toBeInTheDocument();
      expect(ol).toHaveStyle({ overflowX: 'auto' });
    });

    it('renders TableCard with responsive overflow container', () => {
      const { container } = render(
        <TableCard title="Authoritative Ledger">
          <table>
            <tbody>
              <tr>
                <td>Data</td>
              </tr>
            </tbody>
          </table>
        </TableCard>
      );

      const card = container.querySelector('.vyasa-table-card');
      expect(card).toBeInTheDocument();
      expect(screen.getByText('Authoritative Ledger')).toBeInTheDocument();
      expect(screen.getByText('Data')).toBeInTheDocument();
    });
  });
});
