from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ConversationTurn(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., max_length=2000, description="Message text")


class ChatQueryRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=2,
        max_length=1000,
        description="Prospective or admitted scholar's question regarding Ph.D. admissions, rules, or coursework.",
        examples=["What are the eligibility criteria for Ph.D. admission?"],
    )
    conversation_history: Optional[List[ConversationTurn]] = Field(
        default=None,
        max_length=5,
        description="Recent conversation context (up to 5 turns).",
    )
    doc_type_filter: Optional[str] = Field(
        default=None,
        description="Optional filter: 'brochure' | 'ordinance' | 'coursework_ppt'",
    )


class CitationItem(BaseModel):
    chunk_id: str
    doc_type: str
    document_title: str
    source_filename: str
    academic_session: Optional[str] = None
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    section_heading: Optional[str] = None
    chunk_text: str
    relevance_score: float
    citation_label: str


class ChatQueryResponse(BaseModel):
    success: bool = True
    query: str
    answer: str
    is_grounded: bool
    has_conflict: bool
    citations: List[CitationItem]
    suggested_followups: List[str]
    model_used: str


class DocumentInventoryItem(BaseModel):
    filename: str
    title: str
    doc_type: str
    academic_session: Optional[str] = None
    file_size_bytes: int
    checksum_sha256: str
    total_pages_or_slides: int
    chunk_count: int
    processing_status: str


class PhdStatusResponse(BaseModel):
    success: bool = True
    is_ready: bool
    total_documents: int
    total_chunks: int
    documents: List[DocumentInventoryItem]
    supported_doc_types: List[str] = ["brochure", "ordinance", "coursework_ppt"]


class SuggestedQuestionItem(BaseModel):
    category: str
    question: str
    primary_source: str


class SuggestedQuestionsResponse(BaseModel):
    success: bool = True
    questions: List[SuggestedQuestionItem]
