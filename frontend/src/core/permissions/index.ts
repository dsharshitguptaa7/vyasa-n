export const VYASA_PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  ROLES_MANAGE: 'roles:manage',
  MODULES_MANAGE: 'modules:manage',
  AUDIT_READ: 'audit:read',
  ATHARVA_TRIAGE: 'atharva:triage',
  ATHARVA_SUBMIT: 'atharva:submit',
  ATHARVA_VOTE: 'atharva:vote',
  ATHARVA_SIGN: 'atharva:sign',
  SAMA_READ: 'sama:read',
  SAMA_CONTENT_EDIT: 'sama:content:edit',
  SAMA_CONTENT_PUBLISH: 'sama:content:publish',
  SAMA_AUTHOR_VERIFY: 'sama:author:verify',
  SAMA_CERTIFICATE_MANAGE: 'sama:certificate:manage',
  SAMA_CERTIFICATE_REVOKE: 'sama:certificate:revoke',
  SAMA_CONTENT_IMPORT: 'sama:content:import',
} as const;

export type VyasaPermission = (typeof VYASA_PERMISSIONS)[keyof typeof VYASA_PERMISSIONS];
