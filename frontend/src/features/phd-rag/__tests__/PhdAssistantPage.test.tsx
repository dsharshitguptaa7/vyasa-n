import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhdAssistantPage } from '../PhdAssistantPage';
import { phdRagService } from '../../../services/phdRagService';

vi.mock('../../../services/phdRagService', () => ({
  phdRagService: {
    getSuggestedQuestions: vi.fn(),
    getStatus: vi.fn(),
    askQuestion: vi.fn(),
  },
}));

describe('PhdAssistantPage UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(phdRagService.getSuggestedQuestions).mockResolvedValue({
      success: true,
      questions: [
        {
          category: 'Course Work',
          question: 'How many credits are required for Ph.D. course work?',
          primary_source: 'Course Work PPT (2026-27)',
        },
        {
          category: 'Admission & Fees',
          question: 'What is the Ph.D. application fee?',
          primary_source: 'Admission Brochure (2026-27)',
        },
      ],
    });

    vi.mocked(phdRagService.getStatus).mockResolvedValue({
      success: true,
      is_ready: true,
      total_documents: 3,
      total_chunks: 149,
      documents: [
        {
          filename: 'phd-brochure-2627.pdf',
          title: 'Ph.D. Admission Brochure',
          doc_type: 'brochure',
          academic_session: '2026-27',
          file_size_bytes: 19000000,
          checksum_sha256: 'abc',
          total_pages_or_slides: 16,
          chunk_count: 37,
          processing_status: 'COMPLETED',
        },
      ],
    });
  });

  it('1. Renders canonical VYASA Assistant branding, institutional identity, and verified knowledge tags', async () => {
    render(<PhdAssistantPage />);

    expect(screen.getByText('VYASA Assistant')).toBeInTheDocument();
    expect(screen.getByText('Chhatrapati Shahu Ji Maharaj University, Kanpur')).toBeInTheDocument();
    expect(screen.getByText('Research & Development Assistant')).toBeInTheDocument();
    expect(screen.getAllByText(/Your AI guide to research, doctoral studies, and academic regulations at CSJMU/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Doctoral Studies')).toBeInTheDocument();
    expect(screen.getByText('Academic Regulations')).toBeInTheDocument();
    expect(screen.getByText('Admissions (2026-27)')).toBeInTheDocument();
    expect(screen.getByText('Public • No Login')).toBeInTheDocument();

    // Verify official VYASA Assistant logo is rendered in header and central welcome section
    const logos = screen.getAllByAltText('VYASA Assistant Logo');
    expect(logos.length).toBe(2);
    logos.forEach((logo) => {
      expect(logo).toHaveStyle({ objectFit: 'contain' });
    });
    expect(screen.queryByText('🏛️')).toBeNull();

    // Verify document source filter tabs are completely removed
    expect(screen.queryByRole('button', { name: /All Sources/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Admission Brochure/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ph.D. Ordinance/i })).toBeNull();
  });

  it('2. Loads status and displays authoritative source count', async () => {
    render(<PhdAssistantPage />);

    await waitFor(() => {
      expect(screen.getByText(/3 Authoritative University Documents/i)).toBeInTheDocument();
    });
  });

  it('3. Renders suggested questions and populates chat upon click', async () => {
    vi.mocked(phdRagService.askQuestion).mockResolvedValue({
      success: true,
      query: 'How many credits are required for Ph.D. course work?',
      answer: 'Course work requires 12 credits across five components.',
      is_grounded: true,
      has_conflict: false,
      citations: [
        {
          chunk_id: 'chunk-1',
          doc_type: 'coursework_ppt',
          document_title: 'Course Work Orientation',
          source_filename: 'PhD Orientation 2026-27 Coursework.pptx',
          slide_number: 2,
          chunk_text: '12 credits, five components: Research Methodology 3 credits...',
          relevance_score: 0.95,
          citation_label: 'Ph.D. Course Work Orientation (2026-27), Slide 2',
        },
      ],
      suggested_followups: ['What is the passing CGPA?'],
      model_used: 'gemini-3.1-flash-lite',
    });

    render(<PhdAssistantPage />);

    await waitFor(() => {
      expect(
        screen.getByText('How many credits are required for Ph.D. course work?')
      ).toBeInTheDocument();
    });

    const chip = screen.getByText('How many credits are required for Ph.D. course work?');
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText(/Course work requires 12 credits/i)).toBeInTheDocument();
      expect(screen.getByText(/Ph.D. Course Work Orientation \(2026-27\), Slide 2/i)).toBeInTheDocument();
    });
  });

  it('4. Expands citation card to view exact extracted source passage', async () => {
    vi.mocked(phdRagService.askQuestion).mockResolvedValue({
      success: true,
      query: 'How many credits?',
      answer: '12 credits are required.',
      is_grounded: true,
      has_conflict: false,
      citations: [
        {
          chunk_id: 'chunk-1',
          doc_type: 'coursework_ppt',
          document_title: 'Course Work Orientation',
          source_filename: 'PhD Orientation 2026-27 Coursework.pptx',
          slide_number: 2,
          chunk_text: 'Exact source text: 12 credits across 5 components.',
          relevance_score: 0.95,
          citation_label: 'Ph.D. Course Work Orientation, Slide 2',
        },
      ],
      suggested_followups: [],
      model_used: 'gemini-3.1-flash-lite',
    });

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'How many credits?' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/▼ View passage/i)).toBeInTheDocument();
    });

    const expandBtn = screen.getByText(/▼ View passage/i);
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByText(/Exact source text: 12 credits across 5 components/i)).toBeInTheDocument();
    });
  });

  it('5. Displays discrepancy warning banner when has_conflict is true', async () => {
    vi.mocked(phdRagService.askQuestion).mockResolvedValue({
      success: true,
      query: 'Credits discrepancy',
      answer: 'Course Work PPT specifies 12 credits, whereas Ordinance 2024-25 mentions 16 credits.',
      is_grounded: true,
      has_conflict: true,
      citations: [],
      suggested_followups: [],
      model_used: 'gemini-3.1-flash-lite',
    });

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'Credits discrepancy' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Discrepancy Detected Between Authoritative Sources/i)).toBeInTheDocument();
    });
  });

  it('6. Handles error state and renders retry option', async () => {
    vi.mocked(phdRagService.askQuestion).mockRejectedValueOnce(new Error('Network connection timeout'));

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'What is fee?' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Error: Network connection timeout/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Last Question/i })).toBeInTheDocument();
    });
  });
});
