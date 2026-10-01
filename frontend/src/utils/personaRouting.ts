export interface PersonaAuthContext {
  isAuthenticated: boolean;
  isAdmin?: boolean;
  isManager?: boolean;
  isAssistantDean?: boolean;
  isAssociateDean?: boolean;
  isDean?: boolean;
  isApplicant?: boolean;
  isAuthority?: boolean;
  authorityRole?: string | null;
}

/**
 * Determines the direct NIVARAN destination for the authenticated persona,
 * eliminating unnecessary intermediate landing or selection screens.
 */
export function getNivaranDestination(auth: PersonaAuthContext): string {
  if (!auth.isAuthenticated) {
    return '/applicant/login';
  }
  if (auth.isDean) {
    return '/modules/atharva-veda/nivaran/dean/dashboard';
  }
  if (auth.isAssociateDean) {
    return '/modules/atharva-veda/nivaran/associate-dean/dashboard';
  }
  if (auth.isAssistantDean) {
    return '/modules/atharva-veda/nivaran/assistant-dean/dashboard';
  }
  if (auth.isManager) {
    return '/modules/atharva-veda/nivaran/manager/queue';
  }
  if (auth.isAdmin && !auth.authorityRole) {
    return '/admin';
  }
  if (auth.isApplicant) {
    return '/modules/atharva-veda/nivaran/my-grievances';
  }
  if (auth.isAuthority) {
    return '/authority';
  }
  return '/modules/atharva-veda/nivaran/my-grievances';
}
