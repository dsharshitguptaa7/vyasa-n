import { apiClient } from './apiClient';
import {
  NotificationItem,
  NotificationListResponse,
  NotificationSummary,
  NotificationPreferenceItem,
  PillarMetadata,
} from '../types/notification';

export interface NotificationQueryParams {
  is_read?: boolean;
  source_pillar?: string;
  priority?: string;
  action_required?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}

export const notificationService = {
  /**
   * Retrieves user notifications with multi-dimensional filtering.
   */
  async getNotifications(params: NotificationQueryParams = {}): Promise<NotificationListResponse> {
    const query = new URLSearchParams();
    if (params.is_read !== undefined) query.append('is_read', String(params.is_read));
    if (params.source_pillar && params.source_pillar !== 'ALL') {
      query.append('source_pillar', params.source_pillar);
    }
    if (params.priority && params.priority !== 'ALL') {
      query.append('priority', params.priority);
    }
    if (params.action_required !== undefined) {
      query.append('action_required', String(params.action_required));
    }
    if (params.search) query.append('search', params.search);
    if (params.skip !== undefined) query.append('skip', String(params.skip));
    if (params.limit !== undefined) query.append('limit', String(params.limit));

    const qs = query.toString();
    const endpoint = `/notifications${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<NotificationListResponse>(endpoint);
    return res.data!;
  },

  /**
   * Retrieves summary counts and unread badges across pillars.
   */
  async getSummary(): Promise<NotificationSummary> {
    const res = await apiClient.get<NotificationSummary>('/notifications/summary');
    return res.data!;
  },

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(notificationId: string): Promise<NotificationItem> {
    const res = await apiClient.patch<NotificationItem>(`/notifications/${notificationId}/read`);
    return res.data!;
  },

  /**
   * Marks all notifications as read for current user, optionally scoped to a pillar.
   */
  async markAllAsRead(sourcePillar?: string): Promise<number> {
    const query = sourcePillar && sourcePillar !== 'ALL' ? `?source_pillar=${sourcePillar}` : '';
    const res = await apiClient.post<{ updated_count: number }>(`/notifications/mark-all-read${query}`);
    return res.data?.updated_count ?? 0;
  },

  /**
   * Discovers all registered pillars and their notification capabilities.
   */
  async getPillars(): Promise<PillarMetadata[]> {
    const res = await apiClient.get<PillarMetadata[]>('/notifications/pillars');
    return res.data || [];
  },

  /**
   * Retrieves current user notification preferences.
   */
  async getPreferences(): Promise<NotificationPreferenceItem[]> {
    const res = await apiClient.get<NotificationPreferenceItem[]>('/notifications/preferences');
    return res.data || [];
  },

  /**
   * Updates user notification preference for a pillar/event channel.
   */
  async updatePreference(pref: {
    source_pillar: string;
    event_type: string;
    in_app_enabled: boolean;
    email_enabled: boolean;
  }): Promise<NotificationPreferenceItem> {
    const res = await apiClient.put<NotificationPreferenceItem>('/notifications/preferences', pref);
    return res.data!;
  },
};
