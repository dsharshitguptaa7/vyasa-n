import { apiClient } from './apiClient';
import { HealthCheckData } from '../types/api';

export const healthService = {
  async checkHealth(): Promise<HealthCheckData> {
    const res = await apiClient.get<HealthCheckData>('/health');
    if (!res.data) {
      throw new Error('Health check returned empty payload');
    }
    return res.data;
  },
};
