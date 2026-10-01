export interface ModuleRegistryItem {
  id: string;
  pillarKey: string;
  name: string;
  vedaDomain: string;
  description: string | null;
  status: 'active' | 'maintenance' | 'beta' | 'disabled';
  isEnabled: boolean;
  version: string | null;
  internalRoutePrefix?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalRoles: number;
  totalPermissions: number;
  activeModules: number;
}
