export interface ModuleNavItem {
  key: string;
  name: string;
  path: string;
  vedaDomain: 'rig-veda' | 'yajur-veda' | 'sama-veda' | 'atharva-veda' | 'admin';
  description: string;
  requiredRoles?: string[];
  isEnabled: boolean;
}

export const VEDA_MODULE_NAV: ModuleNavItem[] = [
  {
    key: 'rig-veda',
    name: 'Rig Veda',
    path: '/modules/rig-veda',
    vedaDomain: 'rig-veda',
    description: 'Research & Knowledge Creation',
    isEnabled: false,
  },
  {
    key: 'yajur-veda',
    name: 'Yajur Veda',
    path: '/modules/yajur-veda',
    vedaDomain: 'yajur-veda',
    description: 'Research Administration & Incentives',
    isEnabled: false,
  },
  {
    key: 'sama-veda',
    name: 'Sama Veda',
    path: '/modules/sama-veda',
    vedaDomain: 'sama-veda',
    description: 'Research Recognition & Communication',
    isEnabled: false,
  },
  {
    key: 'atharva-veda',
    name: 'Atharva Veda (NIVARAN)',
    path: '/modules/atharva-veda/nivaran',
    vedaDomain: 'atharva-veda',
    description: 'Grievance Redressal & Institutional Well-Being',
    isEnabled: true,
  },
];
