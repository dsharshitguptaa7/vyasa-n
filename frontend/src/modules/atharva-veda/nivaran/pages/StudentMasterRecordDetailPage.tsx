import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState } from '@vyasa/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { phase6dService } from '../services/phase6dService';
import { StudentMasterRecordDetailResponse } from '../types/phase6d';

export const StudentMasterRecordDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isApplicant, isAuthority, isAdmin } = useAuth();

  const [record, setRecord] = useState<StudentMasterRecordDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecord() {
      try {
        setLoading(true);
        setErrorMsg(null);
        let data: StudentMasterRecordDetailResponse;
        if (id && id !== 'me') {
          data = await phase6dService.getStudentRecordDetail(id);
        } else {
          data = await phase6dService.getMyStudentRecord();
        }
        setRecord(data);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve Student Master Record.');
      } finally {
        setLoading(false);
      }
    }
    loadRecord();
  }, [id]);

  if (isAdmin && !isAuthority && !isApplicant) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <Card variant="default">
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <h3 style={{ color: '#b91c1c', margin: '0 0 10px' }}>Access Restricted</h3>
            <p style={{ color: 'var(--vyasa-text-secondary)', marginBottom: '16px' }}>
              Platform Administrators do not automatically inherit case-level grievance or Student Master Record access.
            </p>
            <Button variant="outline" onClick={() => navigate('/admin')}>
              &larr; Return to Admin Console
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <LoadingState message="Retrieving institutional Student Master Record..." />
      </PageContainer>
    );
  }

  if (errorMsg || !record) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <Card variant="default">
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <h3 style={{ color: '#b91c1c', margin: '0 0 12px' }}>Master Record Unavailable</h3>
            <p style={{ color: 'var(--vyasa-text-secondary)', marginBottom: '20px' }}>
              {errorMsg || 'Student Master Record was not found or falls outside your authorized jurisdiction.'}
            </p>
            <Button variant="outline" onClick={() => navigate(-1)}>
              &larr; Go Back
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  // Grievance counts calculation
  const totalGrievances = record.grievances.length;
  const closedCount = record.grievances.filter((g) => g.status === 'CLOSED').length;
  const resolvedCount = record.grievances.filter((g) => g.status === 'RESOLVED').length;
  const inProgressCount = record.grievances.filter(
    (g) => ['ASSIGNED', 'IN_PROGRESS', 'UNDER_INVESTIGATION', 'AWAITING_INFORMATION'].includes(g.status)
  ).length;
  const submittedCount = record.grievances.filter(
    (g) => ['SUBMITTED', 'PENDING_REVIEW', 'AI_PROCESSING'].includes(g.status)
  ).length;

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--vyasa-navy, #0f2b48)' }}>
              Official Student Master Record Dossier
            </h2>
            <Badge variant="teal">{record.record_number}</Badge>
            <Badge variant="neutral">{record.status}</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Longitudinal institutional ledger &bull; Chhatrapati Shahu Ji Maharaj University, Kanpur
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="outline"
            onClick={() => {
              if (isApplicant) {
                navigate('/modules/atharva-veda/nivaran/my-grievances');
              } else {
                navigate('/modules/atharva-veda/nivaran/student-records');
              }
            }}
          >
            &larr; {isApplicant ? 'My Grievances' : 'Student Records Directory'}
          </Button>
        </div>
      </div>

      {/* Section A: Student Identity & Academic Profile Snapshot */}
      <Card variant="gold-accent" title="Scholar Identity & Academic Details" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', fontSize: '13px' }}>
          <div>
            <span style={{ color: 'var(--vyasa-text-secondary)' }}>Full Legal Name:</span>{' '}
            <strong>{record.full_name_snapshot}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--vyasa-text-secondary)' }}>Registered Email:</span>{' '}
            <strong>{record.email_snapshot}</strong>
          </div>
          {record.mobile_snapshot && (
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Contact Mobile:</span>{' '}
              <strong>{record.mobile_snapshot}</strong>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--vyasa-text-secondary)' }}>Registration Number:</span>{' '}
            <code>{record.registration_number_snapshot || 'N/A'}</code>
          </div>
          <div>
            <span style={{ color: 'var(--vyasa-text-secondary)' }}>Enrollment Number:</span>{' '}
            <code>{record.enrollment_number_snapshot || 'N/A'}</code>
          </div>
          <div>
            <span style={{ color: 'var(--vyasa-text-secondary)' }}>Academic Subject:</span>{' '}
            <strong>{record.subject_name}</strong>
          </div>
        </div>
      </Card>

      {/* Section C: Grievance Summary Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <Card variant="default">
          <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)', fontWeight: 600 }}>TOTAL CASES</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--vyasa-navy)', marginTop: '4px' }}>
            {totalGrievances}
          </div>
        </Card>
        <Card variant="default">
          <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)', fontWeight: 600 }}>SUBMITTED / TRIAGE</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
            {submittedCount}
          </div>
        </Card>
        <Card variant="gold-accent">
          <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)', fontWeight: 600 }}>IN PROGRESS</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
            {inProgressCount}
          </div>
        </Card>
        <Card variant="default">
          <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)', fontWeight: 600 }}>RESOLVED</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0284c7', marginTop: '4px' }}>
            {resolvedCount}
          </div>
        </Card>
        <Card variant="gold-accent">
          <div style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)', fontWeight: 600 }}>CLOSED &amp; SEALED</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
            {closedCount}
          </div>
        </Card>
      </div>

      {/* Section D: Complete Grievance History */}
      <Card variant="default" title={`Longitudinal Grievance History (${record.grievances.length})`} style={{ marginBottom: '24px' }}>
        {record.grievances.length === 0 ? (
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '13px', margin: 0 }}>
            No grievances recorded under this student account.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {record.grievances.map((grv) => (
              <div
                key={grv.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: 'var(--vyasa-navy, #0f2b48)' }}>{grv.grievance_id}</strong>
                    <Badge variant="neutral">{grv.status}</Badge>
                    <Badge variant="saffron">{grv.priority}</Badge>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '4px' }}>
                    {grv.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '2px' }}>
                    Category: {grv.category_name} &bull; Registered: {new Date(grv.created_at).toLocaleDateString()}
                    {grv.closed_at && (
                      <span> &bull; Closed: {new Date(grv.closed_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${grv.id}`)}
                    style={{ fontSize: '12px' }}
                  >
                    View Case
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Section E: Linked Sealed E-Files */}
      <Card variant="default" title={`Archived Digital E-Files (${record.efiles.length})`}>
        {record.efiles.length === 0 ? (
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '13px', margin: 0 }}>
            No digitally sealed E-Files have been compiled yet. E-Files are compiled automatically upon final case closure by the Manager.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {record.efiles.map((ef) => (
              <div
                key={ef.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: 'var(--vyasa-navy, #0f2b48)' }}>{ef.e_file_number}</strong>
                    <Badge variant="teal">Digitally Sealed</Badge>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{ef.page_count} Pages</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
                    Ref: {ef.grievance_ref} &bull; SHA-256:{' '}
                    <code style={{ fontSize: '11.5px' }}>{ef.content_hash ? ef.content_hash.slice(0, 20) + '...' : 'N/A'}</code>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href={phase6dService.getDownloadUrl(ef.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="primary" style={{ fontSize: '12px' }}>
                      Download Dossier &darr;
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${ef.grievance_id}`)}
                    style={{ fontSize: '12px' }}
                  >
                    View Case
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
};
