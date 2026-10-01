import { apiClient } from '../../services/apiClient';
import { ModuleRegistryItem, AdminStats } from '../types';

export const adminService = {
  async getModules(): Promise<ModuleRegistryItem[]> {
    const res = await apiClient.get<{ pillars: ModuleRegistryItem[] }>('/pillars');
    return res.data?.pillars || [];
  },

  async getAdminStats(): Promise<AdminStats> {
    try {
      const [usersRes, rolesRes, permsRes, modulesRes] = await Promise.all([
        apiClient.get<{ total?: number; users?: unknown[] }>('/users'),
        apiClient.get<{ roles?: unknown[] }>('/roles'),
        apiClient.get<{ permissions?: unknown[] }>('/permissions'),
        apiClient.get<{ pillars?: unknown[] }>('/pillars'),
      ]);

      const usersCount = (usersRes.data?.users || []).length;
      const rolesCount = (rolesRes.data?.roles || []).length;
      const permsCount = (permsRes.data?.permissions || []).length;
      const modulesCount = (modulesRes.data?.pillars || []).length;

      return {
        totalUsers: usersCount,
        totalRoles: rolesCount,
        totalPermissions: permsCount,
        activeModules: modulesCount,
      };
    } catch {
      return {
        totalUsers: 0,
        totalRoles: 0,
        totalPermissions: 0,
        activeModules: 0,
      };
    }
  },
};
