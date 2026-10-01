import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { phase6dService } from '../services/phase6dService';
import { StudentMasterRecordDetailResponse } from '../types/phase6d';

export const MyStudentRecordPage: React.FC = () => {
  const navigate = useNavigate();
  const [record, setRecord] = useState<StudentMasterRecordDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecord() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await phase6dService.getMyStudentRecord();
        setRecord(data);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve Student Master Record.');
      } finally {
        setLoading(false);
      }
    }
    loadRecord();
  }, []);

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
              {errorMsg || 'No Student Master Record found. A master record is provisioned when a student grievance is closed and archived.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}>
              &larr; Back to My Grievances
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--vyasa-navy, #0f2b48)' }}>
              Student Master Record
            </h2>
            <Badge variant="teal">{record.record_number}</Badge>
            <Badge variant="neutral">{record.status}</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary, #64748b)' }}>
            Official academic institutional dossier: unified longitudinal grievance ledger and sealed cryptographic E-Files.
          </p>
        </div>

        <Button variant="outline" onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}>
          &larr; My Grievances
        </Button>
      </div>

      {/* Profile Particulars */}
      <Card variant="gold-accent" title="Scholar Identity Snapshot" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', fontSize: '13px' }}>
          <div>
            <span style={{ color: 'var(--vyasa-text-secondary)' }}>Full Name:</span>{' '}
            <strong>{record.full_name_snapshot}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--vyasa-text-secondary)' }}>Email:</span>{' '}
            <strong>{record.email_snapshot}</strong>
          </div>
          {record.mobile_snapshot && (
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Mobile:</span>{' '}
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

      {/* Linked E-Files */}
      <Card variant="default" title={`Archived Digital E-Files (${record.efiles.length})`} style={{ marginBottom: '24px' }}>
        {record.efiles.length === 0 ? (
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '13px', margin: 0 }}>
            No digitally sealed E-Files have been compiled yet. E-Files are generated upon final case closure by the Manager.
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
                    <Badge variant="teal">Sealed</Badge>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{ef.page_count} Pages</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)', marginTop: '4px' }}>
                    Ref: {ef.grievance_ref} &bull; SHA-256:{' '}
                    <code style={{ fontSize: '11px' }}>{ef.content_hash ? ef.content_hash.slice(0, 20) + '...' : 'N/A'}</code>
                  </div>
                </div>

                <a
                  href={phase6dService.getDownloadUrl(ef.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Button variant="outline" style={{ fontSize: '12px' }}>
                    Download Dossier &darr;
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Linked Grievance History */}
      <Card variant="default" title={`Longitudinal Grievance History (${record.grievances.length})`}>
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
                    Category: {grv.category_name} &bull; Registered:{' '}
                    {new Date(grv.created_at).toLocaleDateString()}
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${grv.id}`)}
                  style={{ fontSize: '12px' }}
                >
                  View Case
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
};
