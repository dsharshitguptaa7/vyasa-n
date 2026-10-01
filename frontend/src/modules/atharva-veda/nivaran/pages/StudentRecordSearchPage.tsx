import React, { useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState, EmptyState } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { phase6dService } from '../services/phase6dService';
import { StudentMasterRecordSummaryItem } from '../types/phase6d';

export const StudentRecordSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<StudentMasterRecordSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      setHasSearched(true);
      const data = await phase6dService.searchStudentRecords(searchTerm.trim(), undefined, 1, 20);
      setResults(data.items);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Directory search failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--vyasa-navy, #0f2b48)' }}>
              Student Master Records Directory
            </h2>
            <Badge variant="teal">Jurisdictional Access</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Authority directory lookup: query by student registration number, enrollment number, or name. Filtered by your jurisdictional subject cluster.
          </p>
        </div>

        <Button variant="outline" onClick={() => navigate('/modules/atharva-veda/nivaran/assistant-dean/dashboard')}>
          &larr; Back to Docket
        </Button>
      </div>

      {/* Search Input Card */}
      <Card variant="gold-accent" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 0, width: '100%' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter Registration No. (e.g. CSJMU-2026-...), Enrollment No., or Scholar Name..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '6px',
                border: '1px solid var(--vyasa-border, #cbd5e1)',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <Button variant="primary" type="submit" disabled={loading || !searchTerm.trim()}>
            {loading ? 'Searching Directory...' : 'Search Records'}
          </Button>
        </form>
      </Card>

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Search Results */}
      {loading ? (
        <LoadingState message="Querying jurisdictional Master Records database..." />
      ) : hasSearched && results.length === 0 ? (
        <EmptyState
          title="No Master Records Found"
          description={`No student master records matched "${searchTerm}" within your authorized jurisdictional cluster.`}
        />
      ) : results.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {results.map((rec) => (
            <Card key={rec.id} variant="default" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--vyasa-navy, #0f2b48)' }}>
                      {rec.record_number}
                    </span>
                    <Badge variant="teal">{rec.subject_name}</Badge>
                    <Badge variant="neutral">{rec.status}</Badge>
                  </div>

                  <h4 style={{ margin: '0 0 6px', fontSize: '16px', color: '#1e293b' }}>
                    {rec.full_name_snapshot}
                  </h4>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--vyasa-text-secondary, #64748b)', flexWrap: 'wrap' }}>
                    <span>
                      Reg No: <code>{rec.registration_number_snapshot || 'N/A'}</code>
                    </span>
                    <span>
                      Email: <strong>{rec.email_snapshot}</strong>
                    </span>
                    <span>
                      Enrollment: <code>{rec.enrollment_number_snapshot || 'N/A'}</code>
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '12px' }}>
                    <span style={{ color: '#0369a1', fontWeight: 600 }}>
                      Total Grievances: {rec.total_grievances}
                    </span>
                    <span style={{ color: '#15803d', fontWeight: 600 }}>
                      Closed: {rec.closed_grievances}
                    </span>
                    <span style={{ color: '#b45309', fontWeight: 600 }}>
                      Sealed E-Files: {rec.total_efiles}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      navigate(`/modules/atharva-veda/nivaran/student-records/${rec.id}`);
                    }}
                    style={{ fontSize: '12px' }}
                  >
                    View Master Record &rarr;
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </PageContainer>
  );
};
