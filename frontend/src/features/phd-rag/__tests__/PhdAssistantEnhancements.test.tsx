import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PhdAssistantPage } from '../PhdAssistantPage';
import { phdRagService } from '../../../services/phdRagService';

vi.mock('../../../services/phdRagService', () => ({
  phdRagService: {
    getSuggestedQuestions: vi.fn(),
    getStatus: vi.fn(),
    askQuestion: vi.fn(),
  },
}));

describe('PhdAssistantPage Premium Enhancements Suite', () => {
  let originalClipboard: any;
  let originalSpeechSynthesis: any;
  let originalSpeechRecognition: any;
  let originalWebkitSpeechRecognition: any;
  let originalUtterance: any;

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
      ],
    });

    vi.mocked(phdRagService.getStatus).mockResolvedValue({
      success: true,
      is_ready: true,
      total_documents: 3,
      total_chunks: 149,
      documents: [],
    });

    // Save originals
    originalClipboard = navigator.clipboard;
    originalSpeechSynthesis = (window as any).speechSynthesis;
    originalSpeechRecognition = (window as any).SpeechRecognition;
    originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition;
    originalUtterance = (window as any).SpeechSynthesisUtterance;

    // Default mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });

    // Default mock speech synthesis
    (window as any).speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    };

    class MockUtterance {
      text: string;
      rate: number = 1;
      pitch: number = 1;
      onstart: any = null;
      onpause: any = null;
      onresume: any = null;
      onend: any = null;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    (window as any).SpeechSynthesisUtterance = MockUtterance;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    (window as any).speechSynthesis = originalSpeechSynthesis;
    (window as any).SpeechRecognition = originalSpeechRecognition;
    (window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition;
    (window as any).SpeechSynthesisUtterance = originalUtterance;
  });

  it('1. Thinking state starts immediately after question submission', async () => {
    let resolveAsk: any;
    vi.mocked(phdRagService.askQuestion).mockReturnValue(
      new Promise((resolve) => {
        resolveAsk = resolve;
      })
    );

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'What is the admission criteria?' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    // Verify thinking live region and indicator appear
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('VYASA is preparing your answer...')).toBeInTheDocument();
    expect(
      screen.getByText('Searching authoritative passages and synthesizing source-grounded response...')
    ).toBeInTheDocument();

    // Clean up promise
    await act(async () => {
      resolveAsk({
        success: true,
        query: 'What is the admission criteria?',
        answer: 'Admission requires a Masters degree with at least 55% marks.',
        is_grounded: true,
        has_conflict: false,
        citations: [],
        suggested_followups: [],
        model_used: 'gemini-3.1-flash-lite',
      });
    });
  });

  it('2. Thinking state ends after a successful response', async () => {
    vi.mocked(phdRagService.askQuestion).mockResolvedValue({
      success: true,
      query: 'What is the passing CGPA?',
      answer: 'The minimum passing grade in course work is CGPA 6.0.',
      is_grounded: true,
      has_conflict: false,
      citations: [],
      suggested_followups: [],
      model_used: 'gemini-3.1-flash-lite',
    });

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'What is the passing CGPA?' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/The minimum passing grade in course work is CGPA 6.0/i)).toBeInTheDocument();
    });

    // Thinking state indicator is gone
    expect(screen.queryByText('VYASA is preparing your answer...')).toBeNull();
  });

  it('3. Thinking state ends after an API error', async () => {
    vi.mocked(phdRagService.askQuestion).mockRejectedValue(new Error('Gateway timeout'));

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'Will it fail?' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Error: Gateway timeout/i)).toBeInTheDocument();
    });

    // Thinking state indicator is gone
    expect(screen.queryByText('VYASA is preparing your answer...')).toBeNull();
  });

  it('4. Duplicate submission is prevented while request is in progress', async () => {
    let resolveAsk: any;
    vi.mocked(phdRagService.askQuestion).mockReturnValue(
      new Promise((resolve) => {
        resolveAsk = resolve;
      })
    );

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'Question 1' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    expect(phdRagService.askQuestion).toHaveBeenCalledTimes(1);

    // During loading: input is disabled, button is disabled
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: /Searching.../i })).toBeDisabled();

    // Attempting another submission does not call askQuestion again
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(phdRagService.askQuestion).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAsk({
        success: true,
        query: 'Question 1',
        answer: 'Answer 1',
        is_grounded: true,
        has_conflict: false,
        citations: [],
        suggested_followups: [],
        model_used: 'gemini',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Answer 1')).toBeInTheDocument();
    });
  });

  it('5. Actual citations and source links remain intact', async () => {
    vi.mocked(phdRagService.askQuestion).mockResolvedValue({
      success: true,
      query: 'Ordinance provisions',
      answer: 'See ordinance details below.',
      is_grounded: true,
      has_conflict: false,
      citations: [
        {
          chunk_id: 'ordinance-chunk-42',
          doc_type: 'ordinance',
          document_title: 'CSJMU Ph.D. Ordinance 2024-25',
          source_filename: 'Ph.D. Ordinance CSJMU FINAL 2024-25.docx',
          page_number: 14,
          chunk_text: 'Clause 7.2: Allocation of Research Supervisors...',
          relevance_score: 0.98,
          citation_label: 'CSJMU Ph.D. Ordinance (2024-25), Clause 7.2',
        },
      ],
      suggested_followups: ['How is co-supervisor allotted?'],
      model_used: 'gemini-3.1-flash-lite',
    });

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'Ordinance provisions' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/CSJMU Ph.D. Ordinance \(2024-25\), Clause 7.2/i)
      ).toBeInTheDocument();
    });

    // Expand citation
    const viewBtn = screen.getByText(/▼ View passage/i);
    fireEvent.click(viewBtn);

    expect(
      screen.getByText(/Clause 7.2: Allocation of Research Supervisors.../i)
    ).toBeInTheDocument();

    // Verify follow-up chip
    expect(screen.getByText(/How is co-supervisor allotted\? →/i)).toBeInTheDocument();
  });

  it('6. Copy-answer action copies text to clipboard and provides visual feedback', async () => {
    vi.mocked(phdRagService.askQuestion).mockResolvedValue({
      success: true,
      query: 'Copy test query',
      answer: 'Copyable answer text for researchers.',
      is_grounded: true,
      has_conflict: false,
      citations: [],
      suggested_followups: [],
      model_used: 'gemini',
    });

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'Copy test query' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Question/i }));

    await waitFor(() => {
      expect(screen.getByText('Copyable answer text for researchers.')).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: 'Copy answer to clipboard' });
    expect(copyBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copyable answer text for researchers.');
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('7. Voice controls render unsupported fallback when SpeechRecognition is not available', () => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;

    render(<PhdAssistantPage />);

    const voiceBtn = screen.getByRole('button', {
      name: 'Voice input not supported in this browser',
    });
    expect(voiceBtn).toBeDisabled();
  });

  it('8.1 Voice controls handle a single spoken sentence', () => {
    const mockStart = vi.fn().mockImplementation(function (this: any) {
      if (this.onstart) this.onstart();
    });
    const mockStop = vi.fn().mockImplementation(function (this: any) {
      if (this.onend) this.onend();
    });
    const mockAbort = vi.fn();

    const MockRecognition = vi.fn().mockImplementation(function (this: any) {
      this.start = mockStart;
      this.stop = mockStop;
      this.abort = mockAbort;
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    });

    (window as any).SpeechRecognition = MockRecognition;

    render(<PhdAssistantPage />);

    const micBtn = screen.getByRole('button', {
      name: 'Voice input: Speak your question',
    });
    fireEvent.click(micBtn);
    expect(mockStart).toHaveBeenCalled();

    const recognitionInstance = MockRecognition.mock.instances[0];
    act(() => {
      recognitionInstance.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: 'What is the eligibility for Ph.D. admissions?' }], {
            isFinal: true,
          }),
        ],
      });
    });

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i) as HTMLInputElement;
    expect(input.value).toBe('What is the eligibility for Ph.D. admissions?');
  });

  it('8.2 Multiple recognition events for the same sentence do not duplicate text', () => {
    const MockRecognition = vi.fn().mockImplementation(function (this: any) {
      this.start = vi.fn().mockImplementation(() => {
        if (this.onstart) this.onstart();
      });
      this.stop = vi.fn();
      this.abort = vi.fn();
    });

    (window as any).SpeechRecognition = MockRecognition;

    render(<PhdAssistantPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Voice input: Speak your question' }));

    const recognitionInstance = MockRecognition.mock.instances[0];

    // Event 1: partial sentence
    act(() => {
      recognitionInstance.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'Course' }], { isFinal: false })],
      });
    });

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i) as HTMLInputElement;
    expect(input.value).toBe('Course');

    // Event 2: updated partial sentence
    act(() => {
      recognitionInstance.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'Coursework' }], { isFinal: false })],
      });
    });
    expect(input.value).toBe('Coursework');

    // Event 3: finalized full sentence
    act(() => {
      recognitionInstance.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'Coursework duration and credits' }], { isFinal: true })],
      });
    });
    expect(input.value).toBe('Coursework duration and credits');
    expect(input.value).not.toContain('Course Coursework');
  });

  it('8.3 Interim results are cleanly replaced by final results', () => {
    const MockRecognition = vi.fn().mockImplementation(function (this: any) {
      this.start = vi.fn().mockImplementation(() => {
        if (this.onstart) this.onstart();
      });
      this.stop = vi.fn();
      this.abort = vi.fn();
    });

    (window as any).SpeechRecognition = MockRecognition;

    render(<PhdAssistantPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Voice input: Speak your question' }));
    const instance = MockRecognition.mock.instances[0];

    // Interim event
    act(() => {
      instance.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'How many cred' }], { isFinal: false })],
      });
    });

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i) as HTMLInputElement;
    expect(input.value).toBe('How many cred');

    // Final event
    act(() => {
      instance.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'How many credits are required for Ph.D.?' }], { isFinal: true })],
      });
    });

    expect(input.value).toBe('How many credits are required for Ph.D.?');
  });

  it('8.4 Multiple spoken phrases separated by pauses retain previous speech without duplicating', () => {
    const MockRecognition = vi.fn().mockImplementation(function (this: any) {
      this.start = vi.fn().mockImplementation(() => {
        if (this.onstart) this.onstart();
      });
      this.stop = vi.fn();
      this.abort = vi.fn();
    });

    (window as any).SpeechRecognition = MockRecognition;

    render(<PhdAssistantPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Voice input: Speak your question' }));
    const instance = MockRecognition.mock.instances[0];

    // Phrase 1 becomes final
    act(() => {
      instance.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'Doctoral coursework credits.' }], { isFinal: true })],
      });
    });

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i) as HTMLInputElement;
    expect(input.value).toBe('Doctoral coursework credits.');

    // Phrase 2 spoken after a pause (interim)
    act(() => {
      instance.onresult({
        resultIndex: 1,
        results: [
          Object.assign([{ transcript: 'Doctoral coursework credits.' }], { isFinal: true }),
          Object.assign([{ transcript: 'And supervisor allocation' }], { isFinal: false }),
        ],
      });
    });

    expect(input.value).toBe('Doctoral coursework credits. And supervisor allocation');

    // Phrase 2 finalizes
    act(() => {
      instance.onresult({
        resultIndex: 1,
        results: [
          Object.assign([{ transcript: 'Doctoral coursework credits.' }], { isFinal: true }),
          Object.assign([{ transcript: 'and supervisor allocation.' }], { isFinal: true }),
        ],
      });
    });

    expect(input.value).toBe('Doctoral coursework credits. and supervisor allocation.');
  });

  it('8.5 Preserves text that the user typed before starting voice input', () => {
    const MockRecognition = vi.fn().mockImplementation(function (this: any) {
      this.start = vi.fn().mockImplementation(() => {
        if (this.onstart) this.onstart();
      });
      this.stop = vi.fn();
      this.abort = vi.fn();
    });

    (window as any).SpeechRecognition = MockRecognition;

    render(<PhdAssistantPage />);

    // User types pre-existing text
    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'CSJMU Ph.D. Regulations:' } });
    expect(input.value).toBe('CSJMU Ph.D. Regulations:');

    // User clicks mic and speaks
    fireEvent.click(screen.getByRole('button', { name: 'Voice input: Speak your question' }));
    const instance = MockRecognition.mock.instances[0];

    act(() => {
      instance.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'What is the supervisor quota?' }], { isFinal: true })],
      });
    });

    expect(input.value).toBe('CSJMU Ph.D. Regulations: What is the supervisor quota?');
  });

  it('8.6 Speech recognition ending and restarting appends new speech without repeating prior session', () => {
    const MockRecognition = vi.fn().mockImplementation(function (this: any) {
      this.start = vi.fn().mockImplementation(() => {
        if (this.onstart) this.onstart();
      });
      this.stop = vi.fn().mockImplementation(() => {
        if (this.onend) this.onend();
      });
      this.abort = vi.fn();
    });

    (window as any).SpeechRecognition = MockRecognition;

    render(<PhdAssistantPage />);

    // Session 1: User speaks first phrase
    const micBtn = screen.getByRole('button', { name: 'Voice input: Speak your question' });
    fireEvent.click(micBtn);

    const instance1 = MockRecognition.mock.instances[0];
    act(() => {
      instance1.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'First question about fees.' }], { isFinal: true })],
      });
    });

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i) as HTMLInputElement;
    expect(input.value).toBe('First question about fees.');

    // End session 1
    act(() => {
      if (instance1.onend) instance1.onend();
    });

    // Session 2: User clicks mic again to speak second phrase
    fireEvent.click(micBtn);
    const instance2 = MockRecognition.mock.instances[1];

    act(() => {
      instance2.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'Second question about dates.' }], { isFinal: true })],
      });
    });

    expect(input.value).toBe('First question about fees. Second question about dates.');
  });

  it('9. Text-to-speech player controls and speaking-state transitions', async () => {
    const mockSpeak = vi.fn();
    const mockCancel = vi.fn();
    const mockPause = vi.fn();
    const mockResume = vi.fn();

    (window as any).speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: mockPause,
      resume: mockResume,
    };

    vi.mocked(phdRagService.askQuestion).mockResolvedValue({
      success: true,
      query: 'Speak query',
      answer: 'Course work requires 12 credits.',
      is_grounded: true,
      has_conflict: false,
      citations: [],
      suggested_followups: [],
      model_used: 'gemini',
    });

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'Speak query' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Question/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Listen to answer' })).toBeInTheDocument();
    });

    const listenBtn = screen.getByRole('button', { name: 'Listen to answer' });
    fireEvent.click(listenBtn);

    expect(mockSpeak).toHaveBeenCalled();

    // Trigger onstart callback on the passed utterance
    const utterance = mockSpeak.mock.calls[0][0];
    act(() => {
      if (utterance.onstart) utterance.onstart();
    });

    // Pause button appears
    const pauseBtn = screen.getByRole('button', { name: 'Pause reading' });
    expect(pauseBtn).toBeInTheDocument();

    fireEvent.click(pauseBtn);
    expect(mockPause).toHaveBeenCalled();

    // Resume button appears
    const resumeBtn = screen.getByRole('button', { name: 'Resume reading' });
    expect(resumeBtn).toBeInTheDocument();

    fireEvent.click(resumeBtn);
    expect(mockResume).toHaveBeenCalled();

    // Stop button cancels playback
    const stopBtn = screen.getByRole('button', { name: 'Stop reading' });
    fireEvent.click(stopBtn);
    expect(mockCancel).toHaveBeenCalled();
  });

  it('10. Confirms prefers-reduced-motion CSS support for accessibility', async () => {
    // Read the CSS stylesheet to verify reduced motion media query is present
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = path.resolve(__dirname, '../PhdAssistant.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cssContent).toContain('animation: none !important');
  });

  it('11. Branding: Response footer displays "✓ Source Grounded • VYASA AI Assistant" and never "Gemini" or model IDs', async () => {
    vi.mocked(phdRagService.askQuestion).mockResolvedValue({
      success: true,
      query: 'What is the coursework duration?',
      answer: 'The coursework duration is one semester.',
      is_grounded: true,
      has_conflict: false,
      citations: [
        {
          chunk_id: 'c-1',
          doc_type: 'coursework_ppt',
          document_title: 'Course Work Orientation',
          source_filename: 'PhD Orientation 2026-27 Coursework.pptx',
          slide_number: 3,
          chunk_text: 'Coursework shall be completed within one semester.',
          relevance_score: 0.92,
          citation_label: 'Ph.D. Course Work Orientation, Slide 3',
        },
      ],
      suggested_followups: [],
      // Backend returns raw internal model identifier in metadata
      model_used: 'gemini-3.1-flash-lite',
    });

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'What is the coursework duration?' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Must display clean VYASA AI Assistant institutional branding
      expect(screen.getByText(/✓ Source Grounded • VYASA AI Assistant/i)).toBeInTheDocument();
    });

    // Verify Gemini branding and raw model names are completely absent from visible DOM
    expect(screen.queryByText(/gemini/i)).toBeNull();
    expect(screen.queryByText(/gemini-3\.1-flash-lite/i)).toBeNull();
    expect(screen.queryByText(/google/i)).toBeNull();
  });

  it('12. Branding: Truthful ungrounded responses display "ℹ Informational • VYASA AI Assistant"', async () => {
    vi.mocked(phdRagService.askQuestion).mockResolvedValue({
      success: true,
      query: 'Who is the vice chancellor?',
      answer: 'Prof. Vinay Kumar Pathak is the Vice Chancellor of CSJMU.',
      is_grounded: false,
      has_conflict: false,
      citations: [],
      suggested_followups: [],
      model_used: 'gemini-3.1-flash-lite',
    });

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'Who is the vice chancellor?' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Must display Informational and NOT claim Source Grounded
      expect(screen.getByText(/ℹ Informational • VYASA AI Assistant/i)).toBeInTheDocument();
      expect(screen.queryByText(/✓ Source Grounded/i)).toBeNull();
    });

    // Never expose Gemini or model identifier
    expect(screen.queryByText(/gemini/i)).toBeNull();
    expect(screen.queryByText(/gemini-3\.1-flash-lite/i)).toBeNull();
  });

  it('13. Branding: Raw provider error details are sanitized and do not leak Gemini model names', async () => {
    vi.mocked(phdRagService.askQuestion).mockRejectedValue(
      new Error('Gemini API quota exceeded: gemini-3.1-flash-lite rate limit')
    );

    render(<PhdAssistantPage />);

    const input = screen.getByPlaceholderText(/Ask anything about CSJMU Ph.D./i);
    fireEvent.change(input, { target: { value: 'Trigger raw error' } });

    const submitBtn = screen.getByRole('button', { name: /Ask Question/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // User sees sanitized message rather than raw internal provider error
      expect(
        screen.getByText(/Error: The AI Assistant service encountered a temporary processing error/i)
      ).toBeInTheDocument();
    });

    // Zero Gemini branding in error message
    expect(screen.queryByText(/gemini/i)).toBeNull();
    expect(screen.queryByText(/flash-lite/i)).toBeNull();
  });
});
