import { apiClient } from './apiClient';

export interface ScholarCitation {
  citation_id: string;
  document_title: string;
  domain: string;
  domain_label: string;
  document_type: string;
  academic_session?: string | null;
  issuing_authority?: string | null;
  section_heading?: string | null;
  page_number?: number | null;
  chunk_index: number;
  relevance_score: number;
  citation_label: string;
}

export interface AssistantChatResponseData {
  conversation_id: string;
  query: string;
  answer: string;
  evidence_status: 'sufficient' | 'insufficient' | 'conflicting_sources' | 'generation_failed';
  citations: ScholarCitation[];
  domains_searched: string[];
  has_conflict: boolean;
  is_grounded: boolean;
  model_used: string;
  timestamp: string;
  claim_validation_status?: 'verified' | 'flagged';
  unsupported_claims?: string[];
}

export interface AssistantChatPayload {
  query: string;
  conversation_id?: string | null;
  domains?: string[];
  academic_session?: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

export interface ScopeDomainItem {
  domain: string;
  label: string;
  description: string;
}

export interface AssistantScopeData {
  available_domains: ScopeDomainItem[];
  default_model: string;
}

class KnowledgeAssistantService {
  private readonly basePath = '/v1/assistant';

  async askQuestion(payload: AssistantChatPayload): Promise<AssistantChatResponseData> {
    const res = await apiClient.post<AssistantChatResponseData>(`${this.basePath}/chat`, payload);
    if (!res.data) {
      throw new Error(res.message || 'No response data received from assistant.');
    }
    return res.data;
  }

  async getScope(): Promise<AssistantScopeData> {
    const res = await apiClient.get<AssistantScopeData>(`${this.basePath}/scope`);
    if (!res.data) {
      throw new Error(res.message || 'Failed to retrieve assistant scope.');
    }
    return res.data;
  }

  async clearConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/conversations/${encodeURIComponent(conversationId)}`);
  }
}

export const knowledgeAssistantService = new KnowledgeAssistantService();
