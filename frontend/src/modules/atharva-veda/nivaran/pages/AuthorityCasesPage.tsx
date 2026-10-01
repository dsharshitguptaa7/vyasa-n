import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState, EmptyState } from '@vyasa/ui';
import { useNavigate, useLocation } from 'react-router-dom';
import { grievanceService } from '../services/grievanceService';
import { GrievanceSummaryItem } from '../types/grievance';
import { useAuth } from '../../../../context/AuthContext';

interface AuthorityCasesPageProps {
  forcedScope?: 'ASSISTANT_DEAN' | 'ASSOCIATE_DEAN' | 'DEAN';
}

export const AuthorityCasesPage: React.FC<AuthorityCasesPageProps> = ({ forcedScope }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authorityRole, authorityDesignation } = useAuth();
  const [cases, setCases] = useState<GrievanceSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Determine scope from prop, path, or authority role
  const scope =
    forcedScope ||
    (location.pathname.includes('assistant-dean')
      ? 'ASSISTANT_DEAN'
      : location.pathname.includes('associate-dean')
      ? 'ASSOCIATE_DEAN'
      : location.pathname.includes('dean')
      ? 'DEAN'
      : (authorityRole as 'ASSISTANT_DEAN' | 'ASSOCIATE_DEAN' | 'DEAN') || 'ASSISTANT_DEAN');

  const scopeConfig = {
    ASSISTANT_DEAN: {
      title: 'Assistant Dean Jurisdictional Cases',
      subtitle: 'Doctoral grievances scoped to your appointed Academic Subject Cluster jurisdiction.',
      badge: 'Subject Cluster Scope',
      fetcher: () => grievanceService.getAssistantDeanCases(),
    },
    ASSOCIATE_DEAN: {
      title: 'Associate Dean Cluster Cases',
      subtitle: 'Institutional grievances scoped to your appointed Grievance Cluster jurisdiction.',
      badge: 'Grievance Cluster Scope',
      fetcher: () => grievanceService.getAssociateDeanCases(),
    },
    DEAN: {
      title: 'Dean of Academic Affairs Executive Queue',
      subtitle: 'Executive oversight and high-level grievances requiring Dean ratification.',
      badge: 'Executive University Scope',
      fetcher: () => grievanceService.getDeanCases(),
    },
  }[scope] || {
    title: 'Jurisdictional Authority Cases',
    subtitle: 'Cases scoped to your institutional role and jurisdiction.',
    badge: 'Authority Scope',
    fetcher: () => grievanceService.getAssistantDeanCases(),
  };

  const loadCases = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await scopeConfig.fetcher();
      setCases(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve scoped cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [scope]);

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--vyasa-navy)' }}>
              {scopeConfig.title}
            </h2>
            <Badge variant="teal">{cases.length} Cases</Badge>
            <Badge variant="saffron">{scopeConfig.badge}</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
            {scopeConfig.subtitle}
            {authorityDesignation && (
              <span> &bull; Official Appointment: <strong>{authorityDesignation}</strong></span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" size="sm" onClick={loadCases}>
            Refresh Cases
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            marginBottom: '20px',
            fontSize: '13px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading jurisdictional cases from Atharva Veda ledger..." />
      ) : cases.length === 0 ? (
        <EmptyState
          title="No Active Cases in Jurisdiction"
          description="There are currently no active grievances assigned or routed within your authority jurisdiction."
        />
      ) : (
        <Card variant="default">
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '2px solid var(--vyasa-border)',
                    backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)',
                    color: 'var(--vyasa-navy)',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Tracking #</th>
                  <th style={{ padding: '12px 16px' }}>Title &amp; Subject</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Priority</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Submitted</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--vyasa-border)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--vyasa-navy)' }}>
                        {item.grievance_id || item.id}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-text-primary)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)' }}>
                        Subject: {item.subject_name || 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>
                        {item.final_category_name || item.category_name || 'Triage Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge
                        variant={
                          item.priority === 'URGENT' || item.priority === 'HIGH'
                            ? 'saffron'
                            : 'teal'
                        }
                        size="sm"
                      >
                        {item.priority}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant="teal" size="sm">
                        {item.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--vyasa-text-secondary)', fontSize: '12px' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (scope === 'ASSISTANT_DEAN') {
                            navigate(`/modules/atharva-veda/nivaran/assistant-dean/grievance/${item.id}`);
                          } else if (scope === 'ASSOCIATE_DEAN') {
                            navigate(`/modules/atharva-veda/nivaran/associate-dean/grievance/${item.id}`);
                          } else {
                            navigate(`/modules/atharva-veda/nivaran/grievance/${item.id}`);
                          }
                        }}
                      >
                        View Dossier &rarr;
                      </Button>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageContainer>
  );
};
