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
    return '/atharva-veda/dean/dashboard';
  }
  if (auth.isAssociateDean) {
    return '/atharva-veda/associate-dean/dashboard';
  }
  if (auth.isAssistantDean) {
    return '/atharva-veda/assistant-dean/dashboard';
  }
  if (auth.isManager) {
    return '/atharva-veda/manager/queue';
  }
  if (auth.isAdmin && !auth.authorityRole) {
    return '/admin';
  }
  if (auth.isApplicant) {
    return '/atharva-veda/my-grievances';
  }
  if (auth.isAuthority) {
    return '/authority';
  }
  return '/atharva-veda/my-grievances';
}
