import { IconName } from '@vyasa/ui';
import { getNivaranDestination } from '../utils/personaRouting';

export interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  icon: IconName;
  badge?: string;
  badgeVariant?: 'primary' | 'teal' | 'gold' | 'saffron' | 'danger' | 'neutral';
  action?: string;
  subitems?: {
    id: string;
    label: string;
    path: string;
    action?: string;
  }[];
}

export interface NavSectionConfig {
  id: string;
  title: string;
  badge?: string;
  items: NavItemConfig[];
}

export interface PersonaNavigationOptions {
  activeTab?: string;
  onAddAuthority?: () => void;
}

/**
 * Returns canonical Platform items (Dashboard & Profile) tailored by persona.
 */
export function getPlatformNavItems(auth: any): NavItemConfig[] {
  const user = auth?.user;
  const userRoles = (user?.roles || []).map((r: string) => r.toLowerCase());
  const isAdministrator =
    auth?.isSuperAdmin ||
    auth?.isAdmin ||
    userRoles.includes('super_admin') ||
    userRoles.includes('administrator');

  return [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: isAdministrator ? '/admin' : '/dashboard',
      icon: 'layout-dashboard',
    },
    {
      id: 'profile',
      label: 'My Profile',
      path: '/profile',
      icon: 'user',
    },
  ];
}

/**
 * Returns canonical Atharva Veda (NIVARAN) menu items based on user's authorized role.
 */
export function getNivaranNavItems(auth: any): NavItemConfig[] {
  const user = auth?.user;
  const userRoles = (user?.roles || []).map((r: string) => r.toLowerCase());
  const isSuperAdmin = !!auth?.isSuperAdmin;
  const isAdmin = !!auth?.isAdmin;
  const isAdministrator =
    isSuperAdmin || isAdmin || userRoles.includes('super_admin') || userRoles.includes('administrator');
  const isManager = !!auth?.isManager;
  const isAssistantDean = !!auth?.isAssistantDean;
  const isAssociateDean = !!auth?.isAssociateDean;
  const isDean = !!auth?.isDean;
  const isAuthority = !!auth?.isAuthority;
  const nivaranDestination = getNivaranDestination(auth || { isAuthenticated: true, isApplicant: true });

  // 1. Central Administrator / Super Admin
  if (isAdministrator) {
    return [
      {
        id: 'authorities',
        label: 'Authorities Management',
        path: '/admin/atharva/authorities',
        icon: 'users',
        subitems: [
          { id: 'all-authorities', label: 'All Authorities', path: '/admin/atharva/authorities' },
          { id: 'add-authority', label: 'Add Authority', path: '/admin/atharva/authorities', action: 'add-authority' },
          { id: 'bulk-upload', label: 'Import / Bulk Upload', path: '/admin/atharva/authorities' },
          { id: 'role-assignments', label: 'Role Assignments', path: '/admin/atharva/authorities' },
          { id: 'assignment-history', label: 'Assignment History', path: '/admin/atharva/audit-logs' },
        ],
      },
      {
        id: 'categories',
        label: 'Grievance Categories',
        path: '/admin/atharva/categories',
        icon: 'grid',
      },
      {
        id: 'subject-clusters',
        label: 'Subject Clusters',
        path: '/admin/atharva/subject-clusters',
        icon: 'layers',
      },
      {
        id: 'subjects',
        label: 'Subjects',
        path: '/admin/atharva/subjects',
        icon: 'book-open',
      },
      {
        id: 'grievance-clusters',
        label: 'Grievance Clusters',
        path: '/admin/atharva/grievance-clusters',
        icon: 'shield',
      },
      {
        id: 'audit-logs',
        label: 'Audit Explorer',
        path: '/admin/atharva/audit-logs',
        icon: 'file-text',
      },
      {
        id: 'my-efiles',
        label: 'My E-Files',
        path: '/atharva-veda/e-files',
        icon: 'layers',
      },
    ];
  }

  // 2. Grievance Manager (Triage & Closure)
  if (isManager) {
    return [
      {
        id: 'manager-queue',
        label: 'Case Triage Queue',
        path: '/atharva-veda/manager/queue',
        icon: 'clipboard',
      },
      {
        id: 'closure-queue',
        label: 'Closure Review',
        path: '/atharva-veda/manager/closure-queue',
        icon: 'check-circle',
      },
      {
        id: 'my-efiles',
        label: 'My E-Files',
        path: '/atharva-veda/e-files',
        icon: 'layers',
      },
      {
        id: 'student-records',
        label: 'Student Records',
        path: '/atharva-veda/student-records',
        icon: 'search',
      },
      {
        id: 'committees',
        label: 'Committees Workspace',
        path: '/atharva-veda/committees',
        icon: 'users',
      },
    ];
  }

  // 3. Assistant Dean Desk
  if (isAssistantDean) {
    return [
      {
        id: 'assigned-cases',
        label: 'Assigned Cases',
        path: '/atharva-veda/assistant-dean/dashboard',
        icon: 'clipboard',
      },
      {
        id: 'my-efiles',
        label: 'My E-Files',
        path: '/atharva-veda/e-files',
        icon: 'layers',
      },
      {
        id: 'student-records',
        label: 'Student Records',
        path: '/atharva-veda/student-records',
        icon: 'search',
      },
      {
        id: 'committees',
        label: 'Committees Workspace',
        path: '/atharva-veda/committees',
        icon: 'users',
      },
    ];
  }

  // 4. Associate Dean Desk
  if (isAssociateDean) {
    return [
      {
        id: 'jurisdiction-cases',
        label: 'Jurisdictional Cases',
        path: '/atharva-veda/associate-dean/dashboard',
        icon: 'clipboard',
      },
      {
        id: 'my-efiles',
        label: 'My E-Files',
        path: '/atharva-veda/e-files',
        icon: 'layers',
      },
      {
        id: 'student-records',
        label: 'Student Records',
        path: '/atharva-veda/student-records',
        icon: 'search',
      },
      {
        id: 'committees',
        label: 'Committees Workspace',
        path: '/atharva-veda/committees',
        icon: 'users',
      },
    ];
  }

  // 5. Dean / Vice Chancellor Executive Command Center
  if (isDean || userRoles.includes('vice_chancellor') || userRoles.includes('vc')) {
    return [
      {
        id: 'executive-review',
        label: 'Executive Command Center',
        path: '/atharva-veda/dean/dashboard',
        icon: 'clipboard',
      },
      {
        id: 'my-efiles',
        label: 'My E-Files',
        path: '/atharva-veda/e-files',
        icon: 'layers',
      },
      {
        id: 'student-records',
        label: 'Student Records',
        path: '/atharva-veda/student-records',
        icon: 'search',
      },
      {
        id: 'committees',
        label: 'Committees Workspace',
        path: '/atharva-veda/committees',
        icon: 'users',
      },
    ];
  }

  // 6. Generic Institutional Authority
  if (isAuthority) {
    return [
      {
        id: 'authority-cases',
        label: 'Authority Cases',
        path: nivaranDestination,
        icon: 'clipboard',
      },
      {
        id: 'my-efiles',
        label: 'My E-Files',
        path: '/atharva-veda/e-files',
        icon: 'layers',
      },
      {
        id: 'student-records',
        label: 'Student Records',
        path: '/atharva-veda/student-records',
        icon: 'search',
      },
      {
        id: 'committees',
        label: 'Committees Workspace',
        path: '/atharva-veda/committees',
        icon: 'users',
      },
    ];
  }

  // 7. Default Scholar / Applicant Navigation
  return [
    {
      id: 'submit-grievance',
      label: 'Submit Grievance',
      path: '/atharva-veda/submit',
      icon: 'file-text',
    },
    {
      id: 'my-grievances',
      label: 'My Grievances',
      path: '/atharva-veda/my-grievances',
      icon: 'clipboard',
    },
    {
      id: 'my-efiles',
      label: 'My E-Files',
      path: '/atharva-veda/e-files',
      icon: 'layers',
    },
    {
      id: 'my-student-record',
      label: 'My Student Record',
      path: '/atharva-veda/student-records/me',
      icon: 'graduation-cap',
    },
  ];
}

/**
 * Returns canonical Yajur Veda (ANUDAAN) navigation items.
 */
export function getAnudaanNavItems(_auth?: any): NavItemConfig[] {
  return [
    {
      id: 'anudaan-portal',
      label: 'Incentive Portal',
      path: '/modules/yajur-veda/anudaan',
      icon: 'building',
    },
    {
      id: 'anudaan-apply',
      label: 'Apply for Incentive',
      path: '/modules/yajur-veda/anudaan/apply',
      icon: 'file-text',
    },
    {
      id: 'anudaan-track',
      label: 'Track Application',
      path: '/modules/yajur-veda/anudaan/track',
      icon: 'search',
    },
  ];
}

/**
 * Returns canonical Sama Veda (SAMIKSHA) navigation items.
 */
export function getSamikshaNavItems(auth: any): NavItemConfig[] {
  const user = auth?.user;
  const userRoles = (user?.roles || []).map((r: string) => r.toLowerCase());
  const isSuperAdmin = !!auth?.isSuperAdmin;
  const isAdmin = !!auth?.isAdmin;
  const isAdministrator =
    isSuperAdmin || isAdmin || userRoles.includes('super_admin') || userRoles.includes('administrator');
  const isSamaAdmin = isAdministrator || userRoles.includes('sama_content_admin');
  const isSamaEditor = isSamaAdmin || userRoles.includes('sama_content_editor');

  const items: NavItemConfig[] = [
    {
      id: 'publications',
      label: 'Research Publications',
      path: '/modules/sama-veda/publications',
      icon: 'file-text',
    },
    {
      id: 'bulletins',
      label: 'Research Bulletins',
      path: '/modules/sama-veda/bulletins',
      icon: 'bell',
    },
    {
      id: 'researchers',
      label: 'Researcher Directory',
      path: '/modules/sama-veda/researchers',
      icon: 'users',
    },
    {
      id: 'certificates',
      label: 'Certificate Verification',
      path: '/modules/sama-veda/certificates',
      icon: 'check-circle',
    },
    {
      id: 'cam-projects',
      label: 'CAM-AI Projects',
      path: '/modules/sama-veda/cam-projects',
      icon: 'grid',
    },
    {
      id: 'fellowships',
      label: 'Fellowship Schemes',
      path: '/modules/sama-veda/fellowships',
      icon: 'graduation-cap',
    },
  ];

  if (isSamaEditor) {
    items.push({
      id: 'sama-cms',
      label: 'SAMIKSHA CMS',
      path: '/admin/sama',
      icon: 'edit',
    });
  }

  if (isSamaAdmin) {
    items.push({
      id: 'sama-import',
      label: 'Data Ingestion',
      path: '/admin/sama/import',
      icon: 'layers',
    });
  }

  return items;
}

/**
 * Returns Veda Governance & Research Portals.
 */
export function getVedaPortalsNavItems(): NavItemConfig[] {
  return [
    {
      id: 'atharva-veda',
      label: 'Atharva Veda (NIVARAN)',
      path: '/atharva-veda/workspace',
      icon: 'shield',
    },
    {
      id: 'sama-veda',
      label: 'Sama Veda (SAMIKSHA)',
      path: '/modules/sama-veda',
      icon: 'book-open',
    },
    {
      id: 'yajur-veda',
      label: 'Yajur Veda (ANUDAAN)',
      path: '/modules/yajur-veda/anudaan',
      icon: 'scale',
    },
    {
      id: 'rig-veda',
      label: 'Rig Veda (PRAMAAN)',
      path: '/modules/rig-veda',
      icon: 'file-text',
    },
  ];
}

/**
 * Returns Utilities navigation items (Notifications, Settings, Guidelines).
 */
export function getUtilitiesNavItems(auth: any): NavItemConfig[] {
  const user = auth?.user;
  const userRoles = (user?.roles || []).map((r: string) => r.toLowerCase());
  const isAdministrator =
    auth?.isSuperAdmin ||
    auth?.isAdmin ||
    userRoles.includes('super_admin') ||
    userRoles.includes('administrator');

  return [
    {
      id: 'notifications',
      label: 'Notifications',
      path: '/notifications',
      icon: 'bell',
    },
    {
      id: 'settings',
      label: 'Settings',
      path: isAdministrator ? '/admin' : '/profile',
      icon: 'settings',
    },
    {
      id: 'help',
      label: 'Guidelines & Help',
      path: '/phd-admission',
      icon: 'info',
    },
  ];
}

/**
 * Returns canonical role dashboard destination so breadcrumbs and headers never link
 * to a generic unprivileged dashboard when an authoritative desk is expected.
 */
export function getRoleDashboardDestination(auth: any): string {
  if (!auth?.isAuthenticated) {
    return '/';
  }
  const userRoles = ((auth?.user?.roles as string[]) || []).map((r) => r.toLowerCase());
  if (auth?.isSuperAdmin || auth?.isAdmin || userRoles.includes('super_admin') || userRoles.includes('administrator')) {
    return '/admin';
  }
  if (auth?.isDean || userRoles.includes('vice_chancellor') || userRoles.includes('vc')) {
    return '/atharva-veda/dean/dashboard';
  }
  if (auth?.isAssociateDean) {
    return '/atharva-veda/associate-dean/dashboard';
  }
  if (auth?.isAssistantDean) {
    return '/atharva-veda/assistant-dean/dashboard';
  }
  if (auth?.isManager) {
    return '/atharva-veda/manager/queue';
  }
  if (auth?.isApplicant) {
    return '/applicant/dashboard';
  }
  if (auth?.isAuthority) {
    return '/authority';
  }
  return '/dashboard';
}
