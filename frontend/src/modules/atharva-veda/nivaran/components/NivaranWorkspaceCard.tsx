import React from 'react';
import { Card, Badge, Button } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';

export const NivaranWorkspaceCard: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    isAuthority,
    isApplicant,
    isAdmin,
    isManager,
    isAssistantDean,
    isAssociateDean,
    isDean,
    authorityRole,
    authorityDesignation,
  } = useAuth();

  return (
    <Card
      variant="gold-accent"
      title="Atharva Veda: NIVARAN-AI"
      subtitle="Institutional Grievance Redressal & Cryptographic Dossier System"
      headerAction={<Badge variant="teal">Modular Monolith</Badge>}
    >
      <div style={{ padding: '12px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 16px', fontSize: '14px' }}>
          NIVARAN-AI operates as the Atharva Veda pillar of the unified VYASA application.
          It enforces CSJMU grievance triage, accountable forwarding, deliberative committee voting,
          and cryptographic dossier archival within this single monolithic portal.
        </p>

        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)',
            borderRadius: '6px',
            border: '1px solid var(--vyasa-border)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--vyasa-navy)' }}>
              Current User Session Context
            </span>
            {isAdmin && !authorityRole && <Badge variant="saffron">Platform Administrator</Badge>}
            {isManager && <Badge variant="teal">Triage Manager</Badge>}
            {isAssistantDean && <Badge variant="teal">Assistant Dean</Badge>}
            {isAssociateDean && <Badge variant="teal">Associate Dean</Badge>}
            {isDean && <Badge variant="teal">Dean of Academic Affairs</Badge>}
            {isAuthority && !authorityRole && !isAdmin && <Badge variant="teal">Institutional Authority</Badge>}
            {isApplicant && <Badge variant="saffron">Doctoral Scholar / Applicant</Badge>}
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
            Authenticated as: <strong>{user?.fullName || user?.email || 'Guest Scholar'}</strong> ({user?.email || 'N/A'})
            {authorityDesignation && <span> &bull; <em>{authorityDesignation}</em></span>}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--vyasa-text-muted)' }}>
            User UUID: <code>{user?.id || 'Session Inactive'}</code> &bull; Internal Single-Sign-On Verified
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Applicant actions */}
          {isApplicant && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/modules/atharva-veda/nivaran/submit')}
              >
                + Submit Grievance
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
              >
                My Grievances
              </Button>
            </>
          )}

          {/* Manager action */}
          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/modules/atharva-veda/nivaran/manager/queue')}
            >
              Manager Triage Queue &rarr;
            </Button>
          )}

          {/* Assistant Dean action */}
          {isAssistantDean && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/modules/atharva-veda/nivaran/assistant-dean/cases')}
            >
              Assigned Cases &rarr;
            </Button>
          )}

          {/* Associate Dean action */}
          {isAssociateDean && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/modules/atharva-veda/nivaran/associate-dean/cases')}
            >
              Cluster Cases &rarr;
            </Button>
          )}

          {/* Dean action */}
          {isDean && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/modules/atharva-veda/nivaran/dean/cases')}
            >
              Executive Cases &rarr;
            </Button>
          )}

          {/* Admin action */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/atharva/authorities')}
            >
              Admin Taxonomy &amp; Authorities &rarr;
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(isAdmin && !authorityRole ? '/admin' : (isAuthority || isApplicant) ? '/dashboard' : '/')}
          >
            &larr; Return to Dashboard
          </Button>
        </div>
      </div>
    </Card>
  );
};
