import { config } from '../../../config';
import { authService, AuthError } from '../../../services/authService';
import { ApplicantProfileData } from '../types';

export interface ApplicantNotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const applicantService = {
  async getProfile(): Promise<ApplicantProfileData> {
    const token = authService.getToken();
    if (!token) {
      throw new AuthError('Authentication required to access applicant profile.', 401);
    }

    const url = `${config.apiBaseUrl}/applicant/profile`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthError('Session expired. Please sign in again.', 401);
        }
        if (response.status === 403) {
          throw new AuthError('Access restricted to applicant accounts only.', 403);
        }
        throw new AuthError(
          data?.message || data?.detail || 'Failed to load applicant profile.',
          response.status
        );
      }

      return data as ApplicantProfileData;
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        throw err;
      }
      throw new AuthError('Unable to connect to VYASA applicant service.');
    }
  },

  async getNotifications(userId?: string): Promise<ApplicantNotificationItem[]> {
    const token = authService.getToken();
    if (!token) return [];

    const url = userId
      ? `${config.apiBaseUrl}/notifications?user_id=${userId}`
      : `${config.apiBaseUrl}/notifications`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) return [];

      return data?.data?.notifications || [];
    } catch {
      return [];
    }
  },
};
