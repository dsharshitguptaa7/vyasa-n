import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AnudaanPortalPage } from '../pages/AnudaanPortalPage';
import { AnudaanTrackingPage } from '../pages/AnudaanTrackingPage';
import { anudaanService } from '../services/anudaanService';
import { ApiError } from '../../../services/apiClient';
import { saveDraftSession, clearDraftSession } from '../services/anudaanSession';

describe('ANUDAAN Portal & Tracking Entry Pages', () => {
  beforeEach(() => {
    clearDraftSession();
    vi.restoreAllMocks();
  });

  describe('AnudaanPortalPage', () => {
    it('1. Renders portal masthead, scheme overview, and primary action cards', () => {
      render(
        <BrowserRouter>
          <AnudaanPortalPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/ANUDAAN Research Incentive Portal/i)).toBeInTheDocument();
      expect(screen.getByText(/2nd Pillar • Yajur Veda • Research Governance/i)).toBeInTheDocument();
      expect(screen.getByText(/Start New Application/i)).toBeInTheDocument();
      expect(screen.getByText(/Resume Application/i)).toBeInTheDocument();
      expect(screen.getByText(/Track Status/i)).toBeInTheDocument();
    });

    it('2. Opens Start New Application modal and triggers draft creation', async () => {
      const createSpy = vi.spyOn(anudaanService, 'createDraft').mockResolvedValueOnce({
        success: true,
        message: 'Created',
        data: {
          application_id: 'new-app-uuid-1',
          application_number: 'ANU-2026-N1E2W',
          tracking_secret: 'secret-32-chars-long-test-token!',
          status: 'DRAFT',
          applicant_category: 'FACULTY_CAMPUS',
          full_name: 'Dr. Jane Doe',
          institutional_id: 'FAC123',
          department_name: 'Biotechnology',
          created_at: '2026-11-08T18:00:00Z',
          message: 'Draft created',
        },
      });

      render(
        <BrowserRouter>
          <AnudaanPortalPage />
        </BrowserRouter>
      );

      // Open start modal
      fireEvent.click(screen.getByRole('button', { name: /Start New Application/i }));

      expect(screen.getByText(/Start New ANUDAAN Application/i)).toBeInTheDocument();

      // Fill in required fields
      fireEvent.change(screen.getByPlaceholderText(/Prof\. \/ Dr\. \/ Scholar Name/i), {
        target: { value: 'Dr. Jane Doe' },
      });
      fireEvent.change(screen.getByPlaceholderText(/EMP1234 or CSJMU-PHD-202X/i), {
        target: { value: 'FAC123' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Assistant Professor, Research Scholar\.\.\./i), {
        target: { value: 'Professor' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Department of Computer Science\.\.\./i), {
        target: { value: 'Biotechnology' },
      });
      fireEvent.change(screen.getByPlaceholderText(/10-digit mobile number/i), {
        target: { value: '9876543210' },
      });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Create Application Draft/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled();
        expect(screen.getByText(/ANU-2026-N1E2W/i)).toBeInTheDocument();
        expect(screen.getByText(/secret-32-chars-long-test-token!/i)).toBeInTheDocument();
      });
    });

    it('3. Displays active draft banner when session is stored', () => {
      saveDraftSession({
        applicationId: 'app-active-1',
        applicationNumber: 'ANU-2026-ACTIVE',
        draftKey: 'active-key-12345',
      });

      render(
        <BrowserRouter>
          <AnudaanPortalPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/Active Draft Session Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/ANU-2026-ACTIVE/i)).toBeInTheDocument();

      // Clear session button
      fireEvent.click(screen.getByRole('button', { name: /Clear Session/i }));
      expect(screen.queryByText(/Active Draft Session Detected/i)).not.toBeInTheDocument();
    });
  });

  describe('AnudaanTrackingPage', () => {
    it('4. Renders tracking form and queries application status', async () => {
      const trackSpy = vi.spyOn(anudaanService, 'trackApplication').mockResolvedValueOnce({
        success: true,
        message: 'OK',
        data: {
          application_number: 'ANU-2026-88888',
          status: 'UNDER_REVIEW',
          applicant_name: 'Dr. Research Scholar',
          applicant_category: 'SCHOLAR_CAMPUS',
          department_name: 'Physics',
          submitted_at: '2026-11-08T10:00:00Z',
          publication_count: 1,
          publications: [
            {
              id: 'pub-1',
              paper_title: 'Advancements in Nano-materials for Solar Energy',
              journal_name: 'Solar Energy Materials',
              publication_year: 2026,
              applicant_declared_quartile: 'Q1',
              verified_quartile: 'Q1',
              indexing_type: 'SCOPUS_AND_WOS',
              document_type: 'ARTICLE',
            },
          ],
          last_updated: '2026-11-08T18:00:00Z',
          status_description: 'Under evaluation by Research Review Committee',
        },
      });

      render(
        <BrowserRouter>
          <AnudaanTrackingPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/Track ANUDAAN Application/i)).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText(/ANU-2026-XXXXX/i), {
        target: { value: 'ANU-2026-88888' },
      });
      fireEvent.change(screen.getByPlaceholderText(/32-character secret/i), {
        target: { value: 'valid-32-character-secret-token' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Query Application Status/i }));

      await waitFor(() => {
        expect(trackSpy).toHaveBeenCalledWith({
          application_number: 'ANU-2026-88888',
          tracking_secret: 'valid-32-character-secret-token',
        });
        expect(screen.getByText('ANU-2026-88888')).toBeInTheDocument();
        expect(screen.getByText(/Dr\. Research Scholar/i)).toBeInTheDocument();
        expect(screen.getByText(/Advancements in Nano-materials for Solar Energy/i)).toBeInTheDocument();
      });
    });

    it('5. Handles HTTP 404 anti-enumeration error uniformly', async () => {
      vi.spyOn(anudaanService, 'trackApplication').mockRejectedValueOnce(
        new ApiError('Application not found or tracking secret is invalid.', 404, 'HTTP_404')
      );

      render(
        <BrowserRouter>
          <AnudaanTrackingPage />
        </BrowserRouter>
      );

      fireEvent.change(screen.getByPlaceholderText(/ANU-2026-XXXXX/i), {
        target: { value: 'ANU-2026-00000' },
      });
      fireEvent.change(screen.getByPlaceholderText(/32-character secret/i), {
        target: { value: 'invalid-secret' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Query Application Status/i }));

      await waitFor(() => {
        expect(screen.getByText(/Application not found or tracking secret is invalid\./i)).toBeInTheDocument();
      });
    });

    it('6. Handles HTTP 429 rate limit with countdown feedback', async () => {
      vi.spyOn(anudaanService, 'trackApplication').mockRejectedValueOnce(
        new ApiError('Rate limit exceeded', 429, 'HTTP_429', 45)
      );

      render(
        <BrowserRouter>
          <AnudaanTrackingPage />
        </BrowserRouter>
      );

      fireEvent.change(screen.getByPlaceholderText(/ANU-2026-XXXXX/i), {
        target: { value: 'ANU-2026-RATE' },
      });
      fireEvent.change(screen.getByPlaceholderText(/32-character secret/i), {
        target: { value: 'secret' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Query Application Status/i }));

      await waitFor(() => {
        expect(screen.getByText(/Rate limit exceeded\. Please wait 45 seconds before retrying\./i)).toBeInTheDocument();
        expect(screen.getByText(/Retrying enabled in: 45s/i)).toBeInTheDocument();
      });
    });
  });
});
