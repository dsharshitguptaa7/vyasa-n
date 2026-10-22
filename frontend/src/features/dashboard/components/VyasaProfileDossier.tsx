import React from 'react';
import { Badge, AppIcon, formatDateIST } from '@vyasa/ui';
import { useAuth } from '../../../context/AuthContext';

export interface VyasaProfileDossierProps {
  className?: string;
}

export const VyasaProfileDossier: React.FC<VyasaProfileDossierProps> = ({ className = '' }) => {
  const auth = useAuth();
  const {
    user,
    displayName,
    authorityRole,
    authorityDesignation,
    isDean,
    isAssociateDean,
    isAssistantDean,
    isManager,
    isApplicant,
    isAdmin,
  } = auth;

  const getRoleBadge = () => {
    if (isDean) return { label: authorityDesignation || 'Dean R&D', variant: 'gold' as const };
    if (isAssociateDean) return { label: authorityDesignation || 'Associate Dean', variant: 'teal' as const };
    if (isAssistantDean) return { label: authorityDesignation || 'Assistant Dean', variant: 'teal' as const };
    if (isManager) return { label: 'Triage Manager', variant: 'teal' as const };
    if (isAdmin && !authorityRole) return { label: 'Administrator', variant: 'primary' as const };
    if (isApplicant) return { label: 'Scholar', variant: 'saffron' as const };
    return { label: authorityDesignation || 'Institutional Authority', variant: 'teal' as const };
  };

  const roleBadge = getRoleBadge();

  const getAuthorityTypeLabel = () => {
    if (isDean) return 'Dean of Research & Development (Executive Authority)';
    if (isAssociateDean) return 'Associate Dean (Stage-2 Category Redressal Authority)';
    if (isAssistantDean) return 'Assistant Dean (Stage-1 Subject Redressal Authority)';
    if (isManager) return 'Grievance Redressal Manager (Triage & Validation Authority)';
    if (isAdmin) return 'System Administrator (Institutional Governance)';
    return authorityRole || 'Institutional Authority';
  };

  const getAuthorityDepartmentLabel = () => {
    if (user?.authority_department) return user.authority_department;
    if (user?.department) return user.department;
    if (isDean) return 'Office of the Dean, Research & Development';
    if (isAssociateDean) return 'Office of the Associate Dean, Research & Development';
    if (isAssistantDean) return 'Office of the Assistant Dean, Academic Affairs';
    if (isManager) return 'Central Grievance Redressal Cell';
    return 'Central University Administration';
  };

  const getJurisdictionLabel = () => {
    if (isAssistantDean) {
      if (user?.assigned_cluster_name) {
        return `Subject Cluster: ${user.assigned_cluster_name}${user.assigned_cluster_number ? ` (Cluster ${user.assigned_cluster_number})` : ''}`;
      }
      return 'Subject-Based Redressal Cluster Jurisdiction';
    }
    if (isAssociateDean) {
      if (user?.assigned_cluster_name) {
        return `Grievance Cluster: ${user.assigned_cluster_name}${user.assigned_cluster_number ? ` (Cluster ${user.assigned_cluster_number})` : ''}`;
      }
      return 'Category-Based Escalation Cluster Jurisdiction';
    }
    if (isDean) return 'University-Wide Academic & Research Redressal Jurisdiction';
    if (isManager) return 'University-Wide Central Grievance Ingestion & Triage';
    if (isAdmin) return 'Institutional Administration & Platform Governance';
    return 'CSJMU Institutional Jurisdiction';
  };

  const fullName = displayName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Institutional User');

  return (
    <div id="academic-dossier-section" className={`vyasa-profile-dossier-container ${className}`}>
      <div className="vyasa-dossier-grid">
        {/* Card A: Personal Information */}
        <div data-testid="card-personal-info" className="vyasa-dossier-card">
          <div className="vyasa-dossier-header">
            <div className="vyasa-dossier-header__left">
              <div className="vyasa-dossier-icon-chip" aria-hidden="true">
                <AppIcon name="user" size={17} color="var(--vyasa-navy, #1b2a4a)" />
              </div>
              <div className="vyasa-dossier-title-wrap">
                <h3 className="vyasa-dossier-title">Personal Information</h3>
                <p className="vyasa-dossier-subtitle">Account holder identification and verified contact</p>
              </div>
            </div>
            <div className="vyasa-dossier-badge-wrap">
              <Badge variant="teal" size="sm">Verified Identity</Badge>
            </div>
          </div>

          <div className="vyasa-dossier-body">
            <div className="vyasa-field-group">
              <div className="vyasa-field-label">Full Name</div>
              <div data-testid="profile-full-name" className="vyasa-field-value">{fullName}</div>
            </div>

            <hr className="vyasa-field-divider" />

            <div className="vyasa-field-group">
              <div className="vyasa-field-label">Email Address</div>
              <div data-testid="profile-email" className="vyasa-field-value" style={{ wordBreak: 'break-all' }}>
                {user?.email || '—'}
              </div>
            </div>

            <hr className="vyasa-field-divider" />

            <div className="vyasa-field-group">
              <div className="vyasa-field-label">Phone Number</div>
              <div
                data-testid="profile-phone"
                className={`vyasa-field-value ${!user?.phone ? 'vyasa-field-value--muted' : ''}`}
              >
                {user?.phone || 'Not provided'}
              </div>
            </div>

            {user?.created_at && (
              <>
                <hr className="vyasa-field-divider" />
                <div className="vyasa-field-group">
                  <div className="vyasa-field-label">Registered On</div>
                  <div data-testid="profile-created-at" className="vyasa-field-value" style={{ fontSize: '13.5px', fontWeight: 500 }}>
                    {formatDateIST(user.created_at)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card B: Academic Profile (Scholar) OR Institutional Identity (Authority) */}
        {isApplicant ? (
          <div data-testid="card-academic-profile" className="vyasa-dossier-card vyasa-dossier-card--saffron">
            <div className="vyasa-dossier-header">
              <div className="vyasa-dossier-header__left">
                <div className="vyasa-dossier-icon-chip vyasa-dossier-icon-chip--saffron" aria-hidden="true">
                  <AppIcon name="graduation-cap" size={17} color="var(--vyasa-saffron, #c85602)" />
                </div>
                <div className="vyasa-dossier-title-wrap">
                  <h3 className="vyasa-dossier-title">Academic Profile</h3>
                  <p className="vyasa-dossier-subtitle">Research scholar enrollment and academic records</p>
                </div>
              </div>
              <div className="vyasa-dossier-badge-wrap">
                <Badge variant="saffron" size="sm">Scholar Dossier</Badge>
              </div>
            </div>

            <div className="vyasa-dossier-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px' }}>
                <div className="vyasa-field-group">
                  <div className="vyasa-field-label">Programme</div>
                  <div data-testid="scholar-programme" className="vyasa-field-value">
                    Ph.D. Research Scholar
                  </div>
                </div>
                <div className="vyasa-field-group">
                  <div className="vyasa-field-label">Department</div>
                  <div data-testid="scholar-department" className="vyasa-field-value">
                    {user?.department || 'Not specified'}
                  </div>
                </div>
              </div>

              <hr className="vyasa-field-divider" />

              <div className="vyasa-field-group">
                <div className="vyasa-field-label">Subject / Discipline</div>
                <div data-testid="scholar-subject" className="vyasa-field-value vyasa-field-value--teal">
                  {user?.subject_name || 'Not specified'}
                </div>
              </div>

              <hr className="vyasa-field-divider" />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px' }}>
                <div className="vyasa-field-group">
                  <div className="vyasa-field-label">Enrollment No.</div>
                  <div data-testid="scholar-enrollment" className="vyasa-field-value" style={{ fontSize: '13.5px' }}>
                    {user?.enrollment_number || 'Pending allocation'}
                  </div>
                </div>
                <div className="vyasa-field-group">
                  <div className="vyasa-field-label">Ph.D. Reg. No.</div>
                  <div data-testid="scholar-registration" className="vyasa-field-value" style={{ fontSize: '13.5px' }}>
                    {user?.phd_registration_number || 'Pending allocation'}
                  </div>
                </div>
              </div>

              {user?.scholar_record_number && (
                <>
                  <hr className="vyasa-field-divider" />
                  <div className="vyasa-field-group">
                    <div className="vyasa-field-label">Scholar ID</div>
                    <div data-testid="scholar-record-id" className="vyasa-field-value" style={{ fontSize: '13.5px' }}>
                      {user.scholar_record_number}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div data-testid="card-institutional-identity" className="vyasa-dossier-card">
            <div className="vyasa-dossier-header">
              <div className="vyasa-dossier-header__left">
                <div className="vyasa-dossier-icon-chip" aria-hidden="true">
                  <AppIcon name="building" size={17} color="var(--vyasa-navy, #1b2a4a)" />
                </div>
                <div className="vyasa-dossier-title-wrap">
                  <h3 className="vyasa-dossier-title">Institutional Identity</h3>
                  <p className="vyasa-dossier-subtitle">University governance designation and jurisdiction</p>
                </div>
              </div>
              <div className="vyasa-dossier-badge-wrap">
                <Badge variant={roleBadge.variant} size="sm">{roleBadge.label}</Badge>
              </div>
            </div>

            <div className="vyasa-dossier-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px' }}>
                <div className="vyasa-field-group">
                  <div className="vyasa-field-label">Designation</div>
                  <div data-testid="authority-designation" className="vyasa-field-value">
                    {authorityDesignation || roleBadge.label}
                  </div>
                </div>
                <div className="vyasa-field-group">
                  <div className="vyasa-field-label">Authority Scope</div>
                  <div data-testid="authority-type" className="vyasa-field-value" style={{ fontSize: '13.5px' }}>
                    {getAuthorityTypeLabel()}
                  </div>
                </div>
              </div>

              <hr className="vyasa-field-divider" />

              <div className="vyasa-field-group">
                <div className="vyasa-field-label">Department / Office</div>
                <div data-testid="authority-department" className="vyasa-field-value" style={{ fontSize: '14px' }}>
                  {getAuthorityDepartmentLabel()}
                </div>
              </div>

              <hr className="vyasa-field-divider" />

              <div className="vyasa-field-group">
                <div className="vyasa-field-label">Assigned Cluster / Jurisdiction</div>
                <div data-testid="authority-jurisdiction" className="vyasa-jurisdiction-box">
                  {getJurisdictionLabel()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card C: Account & Access Security */}
        <div id="security-posture-section" data-testid="card-access-security" className="vyasa-dossier-card vyasa-dossier-card--teal">
          <div className="vyasa-dossier-header">
            <div className="vyasa-dossier-header__left">
              <div className="vyasa-dossier-icon-chip vyasa-dossier-icon-chip--teal" aria-hidden="true">
                <AppIcon name="shield" size={17} color="var(--vyasa-teal, #0d9488)" />
              </div>
              <div className="vyasa-dossier-title-wrap">
                <h3 className="vyasa-dossier-title">Account &amp; Access Security</h3>
                <p className="vyasa-dossier-subtitle">Central authentication &amp; authorization posture</p>
              </div>
            </div>
            <div className="vyasa-dossier-badge-wrap">
              <Badge variant="teal" size="sm">Verified</Badge>
            </div>
          </div>

          <div className="vyasa-dossier-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px' }}>
              <div className="vyasa-field-group">
                <div className="vyasa-field-label">Account Status</div>
                <div data-testid="account-status" className="vyasa-status-row">
                  <span
                    className={`vyasa-status-dot ${user?.is_active !== false ? 'vyasa-status-dot--active' : 'vyasa-status-dot--inactive'}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`vyasa-status-text ${user?.is_active !== false ? 'vyasa-status-text--active' : 'vyasa-status-text--inactive'}`}
                  >
                    {user?.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="vyasa-field-group">
                <div className="vyasa-field-label">Identity Verification</div>
                <div data-testid="identity-verification-status" style={{ marginTop: '3px' }}>
                  <Badge variant={user?.is_verified !== false ? 'teal' : 'gold'} size="sm">
                    {user?.is_verified !== false ? 'Verified Institutional Account' : 'Pending Verification'}
                  </Badge>
                </div>
              </div>
            </div>

            <hr className="vyasa-field-divider" />

            <div className="vyasa-field-group">
              <div className="vyasa-field-label">Role / Scope</div>
              <div data-testid="account-role-scope" className="vyasa-field-value" style={{ fontSize: '14px' }}>
                {roleBadge.label} &bull; {isApplicant ? 'Scholar Self-Service Access' : 'Institutional Governance Access'}
              </div>
            </div>

            <hr className="vyasa-field-divider" />

            <div className="vyasa-field-group">
              <div className="vyasa-field-label">Platform Identity Issuer</div>
              <div data-testid="platform-issuer" className="vyasa-field-value" style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary, #475569)', fontWeight: 500 }}>
                CSJMU VYASAᴺ Core &bull; JWT Signed Session
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
