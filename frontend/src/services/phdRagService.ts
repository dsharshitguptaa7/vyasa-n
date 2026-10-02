import { config } from '../config';

export interface CitationItem {
  chunk_id: string;
  doc_type: string;
  document_title: string;
  source_filename: string;
  academic_session?: string;
  page_number?: number;
  slide_number?: number;
  section_heading?: string;
  chunk_text: string;
  relevance_score: number;
  citation_label: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: CitationItem[];
  has_conflict?: boolean;
  is_grounded?: boolean;
  suggested_followups?: string[];
  model_used?: string;
  is_error?: boolean;
}

export interface ChatQueryRequest {
  query: string;
  conversation_history?: Array<{ role: string; content: string }>;
  doc_type_filter?: string;
}

export interface ChatQueryResponse {
  success: boolean;
  query: string;
  answer: string;
  is_grounded: boolean;
  has_conflict: boolean;
  citations: CitationItem[];
  suggested_followups: string[];
  model_used: string;
}

export interface SuggestedQuestionItem {
  category: string;
  question: string;
  primary_source: string;
}

export interface SuggestedQuestionsResponse {
  success: boolean;
  questions: SuggestedQuestionItem[];
}

export interface DocumentInventoryItem {
  filename: string;
  title: string;
  doc_type: string;
  academic_session?: string;
  file_size_bytes: number;
  checksum_sha256: string;
  total_pages_or_slides: number;
  chunk_count: number;
  processing_status: string;
}

export interface PhdStatusResponse {
  success: boolean;
  is_ready: boolean;
  total_documents: number;
  total_chunks: number;
  documents: DocumentInventoryItem[];
}

class PhdRagService {
  private get baseUrl(): string {
    return `${config.apiBaseUrl}/public/phd-admission`;
  }

  async askQuestion(
    query: string,
    history?: Array<{ role: string; content: string }>,
    docTypeFilter?: string
  ): Promise<ChatQueryResponse> {
    const payload: ChatQueryRequest = {
      query,
      conversation_history: history,
      doc_type_filter: docTypeFilter,
    };

    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        errorData.detail || errorData.message || `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return await response.json();
  }

  async getSuggestedQuestions(): Promise<SuggestedQuestionsResponse> {
    const response = await fetch(`${this.baseUrl}/suggested-questions`);
    if (!response.ok) {
      throw new Error('Failed to load suggested questions');
    }
    return await response.json();
  }

  async getStatus(): Promise<PhdStatusResponse> {
    const response = await fetch(`${this.baseUrl}/status`);
    if (!response.ok) {
      throw new Error('Failed to load Ph.D. assistant status');
    }
    return await response.json();
  }
}

export const phdRagService = new PhdRagService();
