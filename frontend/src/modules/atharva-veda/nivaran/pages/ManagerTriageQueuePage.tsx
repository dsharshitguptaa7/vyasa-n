import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState, EmptyState } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { grievanceService } from '../services/grievanceService';
import { GrievanceSummaryItem } from '../types/grievance';

export const ManagerTriageQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<GrievanceSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_REVIEW');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchQueue = async (filter?: string) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await grievanceService.getManagerTriageQueue(filter);
      setQueue(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch manager triage queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(statusFilter);
  }, [statusFilter]);

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--vyasa-navy)' }}>
              Manager Triage Command Center
            </h2>
            <Badge variant="teal">{queue.length} Cases</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
            Review AI classifications, ratify or override categories, and dynamically route cases to accountable authorities.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>Filter Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--vyasa-border)',
              fontSize: '13px',
              backgroundColor: '#fff',
            }}
          >
            <option value="PENDING_REVIEW">Pending Review (Action Required)</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="UNDER_INVESTIGATION">Under Investigation</option>
            <option value="REOPENED">Reopened</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => fetchQueue(statusFilter)}>
            Refresh
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
        <LoadingState message="Retrieving triage queue..." />
      ) : queue.length === 0 ? (
        <Card variant="default">
          <EmptyState
            title="Triage Queue Clear"
            description={`No grievances currently in '${statusFilter}' status awaiting triage.`}
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
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Submitted</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Triage Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
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
                        <div style={{ fontSize: '11px', color: '#b45309' }}>Overridden</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <Badge variant={item.priority === 'URGENT' ? 'saffron' : 'neutral'}>
                        {item.priority}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <Badge variant="teal">{item.status}</Badge>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/modules/atharva-veda/nivaran/manager/review/${item.id}`)}
                      >
                        Triage &amp; Assign &rarr;
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
