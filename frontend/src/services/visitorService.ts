import { apiClient } from './apiClient';
import { VisitorStats } from '../types/api';

const SESSION_TRACKED_KEY = 'vyasa_landing_visited';

export const visitorService = {
  /**
   * Fetches latest public aggregate visitor statistics without recording a new visit.
   */
  async getVisitorStats(): Promise<VisitorStats> {
    const response = await apiClient.get<VisitorStats>('/public/visitor-stats');
    if (!response.data) {
      throw new Error('Failed to retrieve visitor statistics');
    }
    return response.data;
  },

  /**
   * Records a unique visit for the main VYASA website using first-party anonymous cookie.
   */
  async trackVisit(): Promise<VisitorStats> {
    const response = await apiClient.post<VisitorStats>('/public/visitor-track');
    if (!response.data) {
      throw new Error('Failed to record visitor track');
    }
    return response.data;
  },

  /**
   * Safe intelligent intake:
   * 1. If not yet tracked in the current browser session, calls `trackVisit()` to record the visit.
   * 2. If already tracked in this session (e.g. React StrictMode mount or tab navigation),
   *    fetches latest stats via `getVisitorStats()` to avoid unnecessary duplicate network posts.
   */
  async getOrTrackVisitor(): Promise<VisitorStats> {
    const hasTrackedSession = typeof window !== 'undefined' && sessionStorage.getItem(SESSION_TRACKED_KEY) === 'true';

    try {
      if (!hasTrackedSession) {
        const stats = await this.trackVisit();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SESSION_TRACKED_KEY, 'true');
        }
        return stats;
      } else {
        return await this.getVisitorStats();
      }
    } catch {
      // In case trackVisit fails (e.g. CORS or network interruption), attempt read-only stats fallback
      return await this.getVisitorStats();
    }
  },
};
