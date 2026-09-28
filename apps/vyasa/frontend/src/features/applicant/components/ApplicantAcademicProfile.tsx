import React from 'react';
import { Card, Badge, formatDateIST } from '@vyasa/ui';
import { ApplicantProfileData } from '../types';

interface ApplicantAcademicProfileProps {
  profile: ApplicantProfileData;
}

export const ApplicantAcademicProfile: React.FC<ApplicantAcademicProfileProps> = ({ profile }) => {
  const formattedDate = profile.created_at
    ? formatDateIST(profile.created_at, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Active';

  return (
    <Card
      variant="scholarly"
      title="Academic Record & Credentials"
      subtitle="Institutional research profile registered in CSJMU VYASA Core"
      headerAction={<Badge variant="gold">Verified Record</Badge>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* Full Name */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Full Name
            </span>
            <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
              {profile.full_name}
            </p>
          </div>

          {/* Email */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Institutional Email
            </span>
            <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 500, color: 'var(--vyasa-text-primary)' }}>
              {profile.email}
            </p>
          </div>

          {/* PhD Registration */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              PhD Registration Number
            </span>
            <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
              {profile.phd_registration_number || 'Not Provided (Pre-registration / Enrolled)'}
            </p>
          </div>

          {/* Academic Department */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Academic Department
            </span>
            <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 500, color: 'var(--vyasa-text-primary)' }}>
              {profile.department || 'Not Assigned / General'}
            </p>
          </div>

          {/* Subject Discipline */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Subject Discipline (Taxonomy)
            </span>
            <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
              {profile.subject_name || 'Unassigned'}
            </p>
            {profile.subject_id && (
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--vyasa-text-muted)' }}>
                UUID: {profile.subject_id}
              </span>
            )}
          </div>

          {/* Account Status */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Account Operational Status
            </span>
            <div style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge variant={profile.is_active ? 'teal' : 'saffron'}>
                {profile.is_active ? 'Active Institutional Identity' : 'Deactivated'}
              </Badge>
            </div>
          </div>

          {/* Verification Status */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Scholar Verification Status
            </span>
            <div style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge variant={profile.is_verified ? 'teal' : 'gold'}>
                {profile.is_verified ? 'Verified Doctoral Scholar' : 'Self-Registered (Pending Confirmation)'}
              </Badge>
            </div>
          </div>

          {/* Registration Date */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Registration Timestamp (IST)
            </span>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--vyasa-text-secondary)' }}>
              {formattedDate}
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: '8px',
            padding: '12px 16px',
            borderLeft: '3px solid var(--vyasa-gold, #c49a45)',
            backgroundColor: 'rgba(196, 154, 69, 0.08)',
            fontSize: '12px',
            color: 'var(--vyasa-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <strong>Academic Record Governance:</strong> This academic record is managed by the Chhatrapati Shahu Ji
          Maharaj University Research Administration. If your PhD registration number, subject discipline, or
          department details require administrative correction, please submit a correction request through the official
          university registrar.
        </div>
      </div>
    </Card>
  );
};
