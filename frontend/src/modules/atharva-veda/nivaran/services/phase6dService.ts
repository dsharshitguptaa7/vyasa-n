import { apiClient } from '../../../../services/apiClient';
import {
  ClosureQueueResponse,
  EFileResponse,
  EFileVerificationResponse,
  FinalizeClosureRequest,
  FinalizeClosureResponse,
  GrievanceFeedbackCreate,
  GrievanceFeedbackResponse,
  PaginatedStudentRecordsResponse,
  PublicFeedbackSummary,
  StudentMasterRecordDetailResponse,
} from '../types/phase6d';

const BASE_PREFIX = '/modules/atharva-veda/nivaran';

export const phase6dService = {
  // 1. Applicant Feedback
  async submitFeedback(
    grievanceId: string,
    payload: GrievanceFeedbackCreate
  ): Promise<GrievanceFeedbackResponse> {
    const res = await apiClient.post<GrievanceFeedbackResponse>(
      `${BASE_PREFIX}/grievances/${encodeURIComponent(grievanceId)}/feedback`,
      payload
    );
    return res.data!;
  },

  async getFeedback(grievanceId: string): Promise<GrievanceFeedbackResponse | null> {
    try {
      const res = await apiClient.get<GrievanceFeedbackResponse>(
        `${BASE_PREFIX}/grievances/${encodeURIComponent(grievanceId)}/feedback`
      );
      return res.data || null;
    } catch {
      return null;
    }
  },

  async getPublicFeedbackSummary(): Promise<PublicFeedbackSummary> {
    const res = await apiClient.get<PublicFeedbackSummary>(`${BASE_PREFIX}/public/feedback-summary`);
    return res.data!;
  },

  // 2. Manager Closure
  async getClosureQueue(page: number = 1, pageSize: number = 15): Promise<ClosureQueueResponse> {
    const res = await apiClient.get<ClosureQueueResponse>(
      `${BASE_PREFIX}/manager/closure-queue?page=${page}&page_size=${pageSize}`
    );
    return res.data!;
  },

  async getClosureDetail(grievanceId: string): Promise<any> {
    const res = await apiClient.get<any>(
      `${BASE_PREFIX}/manager/grievances/${encodeURIComponent(grievanceId)}/closure-detail`
    );
    return res.data!;
  },

  async finalizeClosure(
    grievanceId: string,
    payload: FinalizeClosureRequest
  ): Promise<FinalizeClosureResponse> {
    const res = await apiClient.post<FinalizeClosureResponse>(
      `${BASE_PREFIX}/manager/grievances/${encodeURIComponent(grievanceId)}/finalize-closure`,
      payload
    );
    return res.data!;
  },

  // 3. Digital E-Files
  async getMyEFiles(): Promise<EFileResponse[]> {
    const res = await apiClient.get<EFileResponse[]>(`${BASE_PREFIX}/e-files/my`);
    return res.data || [];
  },

  async listAuthorityEFiles(
    search?: string,
    page: number = 1,
    pageSize: number = 15
  ): Promise<{ items: EFileResponse[]; total: number; page: number; page_size: number; total_pages: number }> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', String(page));
    params.append('page_size', String(pageSize));
    const res = await apiClient.get<{ items: EFileResponse[]; total: number; page: number; page_size: number; total_pages: number }>(
      `${BASE_PREFIX}/e-files?${params.toString()}`
    );
    return res.data!;
  },

  async getEFileDetail(efileId: string): Promise<EFileResponse> {
    const res = await apiClient.get<EFileResponse>(
      `${BASE_PREFIX}/e-files/${encodeURIComponent(efileId)}`
    );
    return res.data!;
  },

  async verifyEFile(efileId: string): Promise<EFileVerificationResponse> {
    const res = await apiClient.get<EFileVerificationResponse>(
      `${BASE_PREFIX}/e-files/${encodeURIComponent(efileId)}/verify`
    );
    return res.data!;
  },

  getDownloadUrl(efileId: string): string {
    return `/api${BASE_PREFIX}/e-files/${encodeURIComponent(efileId)}/download`;
  },

  // 4. Student Master Records
  async getMyStudentRecord(): Promise<StudentMasterRecordDetailResponse> {
    const res = await apiClient.get<StudentMasterRecordDetailResponse>(
      `${BASE_PREFIX}/student-records/me`
    );
    return res.data!;
  },

  async searchStudentRecords(
    query?: string,
    registrationNumber?: string,
    page: number = 1,
    pageSize: number = 15
  ): Promise<PaginatedStudentRecordsResponse> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (registrationNumber) params.append('registration_number', registrationNumber);
    params.append('page', String(page));
    params.append('page_size', String(pageSize));

    const res = await apiClient.get<PaginatedStudentRecordsResponse>(
      `${BASE_PREFIX}/student-records/search?${params.toString()}`
    );
    return res.data!;
  },

  async getStudentRecordDetail(recordId: string): Promise<StudentMasterRecordDetailResponse> {
    const res = await apiClient.get<StudentMasterRecordDetailResponse>(
      `${BASE_PREFIX}/student-records/${encodeURIComponent(recordId)}`
    );
    return res.data!;
  },
};
