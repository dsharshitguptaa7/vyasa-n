import { apiClient } from './apiClient';
import { PillarListResponse, PillarMetadata } from '../types/pillar';

export const pillarService = {
  async getPillars(userRoles?: string[]): Promise<PillarMetadata[]> {
    const headers: Record<string, string> = {};
    if (userRoles && userRoles.length > 0) {
      headers['x-user-roles'] = userRoles.join(',');
    }
    const res = await apiClient.get<PillarListResponse>('/pillars', headers);
    return res.data?.pillars || [];
  },

  async getPillarBySlug(slug: string): Promise<PillarMetadata | null> {
    const res = await apiClient.get<PillarMetadata>(`/pillars/${slug}`);
    return res.data || null;
  },
};
