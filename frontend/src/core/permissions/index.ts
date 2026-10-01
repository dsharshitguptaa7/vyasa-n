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
} as const;

export type VyasaPermission = (typeof VYASA_PERMISSIONS)[keyof typeof VYASA_PERMISSIONS];
