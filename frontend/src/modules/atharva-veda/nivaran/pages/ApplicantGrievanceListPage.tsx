import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState, EmptyState } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { grievanceService } from '../services/grievanceService';
import { GrievanceSummaryItem } from '../types/grievance';

export const ApplicantGrievanceListPage: React.FC = () => {
  const navigate = useNavigate();
  const [grievances, setGrievances] = useState<GrievanceSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadGrievances() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await grievanceService.getMyGrievances();
        setGrievances(data);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load grievances.');
      } finally {
        setLoading(false);
      }
    }
    loadGrievances();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'AI_PROCESSING':
        return <Badge variant="gold">{status}</Badge>;
      case 'PENDING_REVIEW':
        return <Badge variant="saffron">Pending Review</Badge>;
      case 'ASSIGNED':
      case 'UNDER_INVESTIGATION':
        return <Badge variant="teal">{status.replace('_', ' ')}</Badge>;
      case 'RESOLVED':
      case 'CLOSED':
        return <Badge variant="teal">{status}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '12px' }}>URGENT</span>;
      case 'HIGH':
        return <span style={{ color: '#ea580c', fontWeight: 600, fontSize: '12px' }}>HIGH</span>;
      default:
        return <span style={{ color: 'var(--vyasa-text-secondary)', fontSize: '12px' }}>{priority}</span>;
    }
  };

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '20px', color: 'var(--vyasa-navy)' }}>
            My Grievance Dossiers
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
            Track the status, accountable authority, and review trajectory of your filed grievances.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate('/atharva-veda/nivaran/submit')}
        >
          + Submit New Grievance
        </Button>
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
        <LoadingState message="Loading your submitted grievances..." />
      ) : grievances.length === 0 ? (
        <Card variant="default">
          <EmptyState
            title="No Grievances Filed"
            description="You have not submitted any grievances to Atharva Veda / NIVARAN yet."
            action={
              <Button
                variant="primary"
                onClick={() => navigate('/modules/atharva-veda/nivaran/submit')}
              >
                Submit Your First Grievance
              </Button>
            }
          />
        </Card>
      ) : (
        <Card variant="default">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--vyasa-border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Tracking ID</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Title &amp; Subject</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Priority</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Assigned Authority</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Submitted Date</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {grievances.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: '1px solid var(--vyasa-border)', transition: 'background-color 0.15s' }}
                  >
                    <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
                      <code>{item.grievance_id}</code>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: 600, color: '#1f2937' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
                        {item.subject_name}
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div>{item.final_category_name || item.category_name}</div>
                      {item.final_category_name && item.final_category_name !== item.category_name && (
                        <div style={{ fontSize: '11px', color: '#b45309' }}>Overridden by Manager</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {getPriorityBadge(item.priority)}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {getStatusBadge(item.status)}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '12px' }}>
                      {item.assigned_authority_name || (
                        <span style={{ color: 'var(--vyasa-text-secondary)', fontStyle: 'italic' }}>
                          Awaiting Triage
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${item.id}`)}
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
