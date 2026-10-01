/**
 * VYASA Institutional Services Registry
 * Central registry determining active vs inactive ecosystem services.
 * Aligns with backend ModuleRegistry module_key and status architecture.
 */

export interface VyasaService {
  id: string;
  moduleKey: string;
  pillarKey: string;
  name: string;
  shortName: string;
  subtitle: string;
  description: string;
  pillar: string;
  category: string;
  badge: string;
  badgeVariant: 'gold' | 'teal' | 'primary' | 'saffron';
  isActive: boolean;
  route: string;
  icon: string;
}

export const VYASA_SERVICES: VyasaService[] = [
  {
    id: 'nivaran',
    moduleKey: 'atharva_veda_nivaran',
    pillarKey: 'atharva_veda',
    name: 'NIVARAN-AI',
    shortName: 'NIVARAN',
    subtitle: 'AI-Assisted Grievance Redressal',
    description: 'CSJMU central grievance redressal, multi-tier authority triage, and institutional dispute resolution ecosystem.',
    pillar: 'Atharva Veda',
    category: 'Grievance Redressal Ecosystem',
    badge: 'Active Service',
    badgeVariant: 'teal',
    isActive: true,
    route: '/modules/atharva-veda/nivaran',
    icon: 'shield',
  },
  {
    id: 'rig-veda',
    moduleKey: 'rig_veda',
    pillarKey: 'rig_veda',
    name: 'Rig Veda',
    shortName: 'PRAMAAN',
    subtitle: 'Research Publications & Ethics',
    description: 'Scholarly publications registry, plagiarism verification, and citation indexing.',
    pillar: 'Rig Veda',
    category: 'Research Governance',
    badge: 'Scheduled',
    badgeVariant: 'primary',
    isActive: false,
    route: '/modules/rig-veda',
    icon: 'book-open',
  },
  {
    id: 'sama-veda',
    moduleKey: 'sama_veda',
    pillarKey: 'sama_veda',
    name: 'Sama Veda',
    shortName: 'SAMIKSHA',
    subtitle: 'Curriculum & Academic Audit',
    description: 'Academic syllabus audit, teaching metrics, and accreditation telemetry.',
    pillar: 'Sama Veda',
    category: 'Academic Audit',
    badge: 'Scheduled',
    badgeVariant: 'primary',
    isActive: false,
    route: '/modules/sama-veda',
    icon: 'scale',
  },
  {
    id: 'yajur-veda',
    moduleKey: 'yajur_veda',
    pillarKey: 'yajur_veda',
    name: 'Yajur Veda',
    shortName: 'ANUDAN',
    subtitle: 'Grants & Fellowship Governance',
    description: 'Research grant allocation, fellowship disbursement, and expenditure tracking.',
    pillar: 'Yajur Veda',
    category: 'Grant Allocation',
    badge: 'Scheduled',
    badgeVariant: 'primary',
    isActive: false,
    route: '/modules/yajur-veda',
    icon: 'building',
  },
];

/**
 * Returns only actively available services to be exposed in user-facing UI.
 * Inactive future services are strictly filtered out.
 */
export function getActiveServices(): VyasaService[] {
  return VYASA_SERVICES.filter((s) => s.isActive);
}
