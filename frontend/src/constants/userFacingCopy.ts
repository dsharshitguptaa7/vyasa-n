/**
 * Centralized User-Facing Copy, Brand Names & Plain English Vocabulary
 * Standardizes terminology across the VYASA-N ecosystem:
 * - Public landing, login, and registration pages
 * - Applicant Dashboard and Profile
 * - NIVARAN Grievance Resolution portal
 * - Authority and Administrative dashboards
 * - VYASA AI Assistant
 */

export const BRAND_NAMES = {
  assistant: 'VYASA AI Assistant',
  institution: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
  shortInstitution: 'CSJMU',
} as const;

export const PLAIN_TERMS = {
  // Grievance resolution & review
  triage: 'Initial Review',
  triageVerb: 'Review',
  triageQueue: 'Initial Review Queue',
  lifecycleStatusHistory: 'Status History',
  immutableAuditTrail: 'Activity History',
  auditTrail: 'Activity History',
  auditLedger: 'Activity Log',
  dossier: 'Grievance Details',
  academicDossier: 'Academic Record',
  institutionalRedressal: 'Grievance Resolution',
  governanceConsole: 'Administration Panel',
  taxonomy: 'Categories',
  jurisdiction: 'Area of Responsibility',
  automatedIntake: 'Automatic Submission Processing',
  classification: 'Category Selection',
  routingEngine: 'Automatic Assignment',
  fallbackQueue: 'Unassigned Grievances',
  escalation: 'Send to Higher Authority',
  resolutionWorkflow: 'Steps to Resolve',
  pendingAction: 'Action Required',
  identityProvisioning: 'Account Setup',
  roleBasedAccess: 'Access Permissions',
  telemetry: 'System Status',
  operational: 'Working',
  synchronized: 'Up to Date',
  reassignment: 'Change Assigned Authority',
  archived: 'Past Records',

  // Common Action Labels
  actions: {
    submitGrievance: 'Submit a Grievance',
    viewDetails: 'View Grievance Details',
    checkStatus: 'Check Application Status',
    viewUpdates: 'View Previous Updates',
    uploadDocuments: 'Upload Supporting Documents',
    replyToUniversity: 'Reply to the University',
    changeAuthority: 'Change Assigned Authority',
    viewStatus: 'View System Status',
    reviewCategories: 'Review Categories',
    viewActions: 'View Previous Actions',
  },

  // Friendly Error Messages
  errors: {
    invalidCredentials: "We couldn't sign you in. Please check your email and password.",
    networkError: 'Unable to connect to the server. Please check your internet connection.',
    accessDenied: 'You do not have permission to access this page or record.',
    notFound: "We couldn't find that page or record.",
    uploadFailed: "This file couldn't be uploaded. Check the file type and size, then try again.",
    unexpected: 'An unexpected error occurred. Please try again.',
    formInvalid: 'Some information is missing or incorrect. Please review the form.',
  },
} as const;
