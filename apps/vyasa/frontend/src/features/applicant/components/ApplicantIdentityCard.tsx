import React from 'react';
import { Card, Badge } from '@vyasa/ui';
import { ApplicantProfileData } from '../types';

interface ApplicantIdentityCardProps {
  profile: ApplicantProfileData;
}

export const ApplicantIdentityCard: React.FC<ApplicantIdentityCardProps> = ({ profile }) => {
  return (
    <Card
      variant="scholarly"
      title="Scholar Identity"
      subtitle="Canonical institutional profile stored in VYASA Core"
      headerAction={<Badge variant="saffron">Applicant</Badge>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', padding: '12px 0 4px' }}>
        {/* Full Name */}
        <div>
          <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Full Legal Name
          </span>
          <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
            {profile.full_name || `${profile.first_name} ${profile.last_name}`.trim()}
          </p>
        </div>

        {/* Institutional Email */}
        <div>
          <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Email Address
          </span>
          <p style={{ margin: '4px 0 0', fontSize: '15px', color: 'var(--vyasa-text-primary)' }}>
            {profile.email}
          </p>
        </div>

        {/* PhD Registration */}
        <div>
          <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Doctoral Registration No.
          </span>
          <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
            {profile.phd_registration_number || (
              <span style={{ color: 'var(--vyasa-text-muted)', fontStyle: 'italic', fontWeight: 400 }}>
                Not Provided (Optional)
              </span>
            )}
          </p>
        </div>

        {/* Academic Discipline / Subject */}
        <div>
          <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Subject Discipline
          </span>
          <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
            {profile.subject_name || (
              <span style={{ color: 'var(--vyasa-text-muted)', fontStyle: 'italic', fontWeight: 400 }}>
                General Research
              </span>
            )}
          </p>
        </div>

        {/* Department */}
        <div>
          <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Academic Department
          </span>
          <p style={{ margin: '4px 0 0', fontSize: '15px', color: 'var(--vyasa-text-primary)' }}>
            {profile.department || (
              <span style={{ color: 'var(--vyasa-text-muted)', fontStyle: 'italic' }}>
                Unspecified
              </span>
            )}
          </p>
        </div>

        {/* Contact Phone if available */}
        {profile.phone && (
          <div>
            <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Contact Phone
            </span>
            <p style={{ margin: '4px 0 0', fontSize: '15px', color: 'var(--vyasa-text-primary)' }}>
              {profile.phone}
            </p>
          </div>
        )}

        {/* VYASA User UUID */}
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            VYASA Core Identity UUID
          </span>
          <p
            style={{
              margin: '4px 0 0',
              fontFamily: 'monospace',
              fontSize: '13px',
              backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)',
              padding: '6px 10px',
              borderRadius: '4px',
              display: 'inline-block',
              border: '1px solid var(--vyasa-border)',
              color: 'var(--vyasa-text-secondary)',
            }}
          >
            {profile.user_id}
          </p>
        </div>
      </div>
    </Card>
  );
};
