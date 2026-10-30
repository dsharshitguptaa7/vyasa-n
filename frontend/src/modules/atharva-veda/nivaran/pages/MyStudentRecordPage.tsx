import React, { useEffect, useState, useCallback } from 'react';
import { Card, Badge, Button, LoadingState, AppIcon } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { ApplicantLayout } from '../../../../features/applicant';
import { phase6dService } from '../services/phase6dService';
import { StudentMasterRecordDetailResponse } from '../types/phase6d';
import './CaseReview.css';

export const MyStudentRecordPage: React.FC = () => {
  const navigate = useNavigate();
  const [record, setRecord] = useState<StudentMasterRecordDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRecord = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  if (loading && !record) {
    return (
      <ApplicantLayout activeTab="my-student-record">
        <LoadingState message="Loading official student record..." />
      </ApplicantLayout>
    );
  }

  if (errorMsg || !record) {
    return (
      <ApplicantLayout activeTab="my-student-record">
        {/* Stately Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#64748b',
            marginBottom: '18px',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--vyasa-navy, #0f2b48)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
            <span>Dashboard</span>
          </button>
          <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
          <button
            type="button"
            onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--vyasa-navy, #0f2b48)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            NIVARAN Dashboard
          </button>
          <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Student Record</span>
        </nav>

        <Card variant="default">
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AppIcon name="alert-circle" size={24} color="#dc2626" />
            </div>
            <h3 style={{ color: 'var(--vyasa-navy, #0f2b48)', margin: '0 0 10px', fontSize: '18px', fontWeight: 700 }}>
              Student Record Unavailable
            </h3>
            <p style={{ color: 'var(--vyasa-text-secondary)', maxWidth: '520px', margin: '0 auto 20px', fontSize: '13.5px', lineHeight: 1.6 }}>
              {errorMsg || 'No official Student Master Record found yet. Official scholar master dossiers are synced from the CSJMU Academic Registry upon program enrollment and updated through institutional case archives.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button variant="outline" onClick={loadRecord}>
                Retry
              </Button>
              <Button variant="primary" onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}>
                &larr; Back to My Grievances
              </Button>
            </div>
          </div>
        </Card>
      </ApplicantLayout>
    );
  }

  return (
    <ApplicantLayout activeTab="my-student-record">
      {/* Stately Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#64748b',
          marginBottom: '18px',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
          <span>Dashboard</span>
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          NIVARAN Dashboard
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <span style={{ color: '#64748b', fontWeight: 500 }}>Student Record</span>
      </nav>

      {/* 1. Canonical Institutional Header with Watermark */}
      <div className="nivaran-case-header">
        {/* Architectural building watermark */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '160px',
            top: 0,
            bottom: 0,
            width: '260px',
            opacity: 0.04,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <AppIcon name="building" size={200} color="#0f2b48" />
        </div>

        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip" aria-hidden="true">
              <AppIcon name="graduation-cap" size={22} color="var(--vyasa-navy, #1b2a4a)" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--vyasa-gold, #b2811a)',
                  marginBottom: '2px',
                }}
              >
                Chhatrapati Shahu Ji Maharaj University, Kanpur
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading">
                  Student Master Record
                </h1>
                <Badge variant="teal">
                  {record.record_number || (record as any).roll_number || 'SMR-RECORD'}
                </Badge>
                <Badge variant={record.status === 'ACTIVE' ? 'gold' : 'neutral'}>
                  {record.status || 'ACTIVE'}
                </Badge>
              </div>
              <p className="nivaran-case-meta">
                <span className="nivaran-case-meta__item">
                  Your permanent academic record and verified resolution history.
                </span>
                <span className="nivaran-case-meta__separator">&bull;</span>
                <span className="nivaran-case-meta__item">
                  CSJMU Statutory Redressal
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', zIndex: 1 }}>
            {/* Academic Session Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}
              >
                <AppIcon name="clock" size={15} />
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Academic Session
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f2b48', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>2026–27</span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadRecord}
              disabled={loading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
            >
              My Grievances &rarr;
            </Button>
          </div>
        </div>
      </div>

      {/* Structured Executive Metric Cards */}
      <div className="nivaran-docket-kpi-grid">
        <div className="nivaran-docket-kpi nivaran-docket-kpi--navy">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Total Recorded Cases</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="clipboard" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value">{(record.grievances || []).length}</div>
          <div className="nivaran-docket-kpi__subtext">Lifetime grievance docket</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--amber">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Active / In Review</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="clock" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#b45309' }}>
            {(record.grievances || []).filter((g) => ['SUBMITTED', 'PENDING_REVIEW', 'AI_PROCESSING', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_INVESTIGATION', 'AWAITING_INFORMATION'].includes(g.status)).length}
          </div>
          <div className="nivaran-docket-kpi__subtext">Under inquiry</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--sky">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Resolved Determinations</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="check-circle" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#0284c7' }}>
            {(record.grievances || []).filter((g) => g.status === 'RESOLVED').length}
          </div>
          <div className="nivaran-docket-kpi__subtext">Determinations committed</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--emerald">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Sealed E-Files</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="shield" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#047857' }}>
            {(record.efiles || []).length}
          </div>
          <div className="nivaran-docket-kpi__subtext">Cryptographic archives</div>
        </div>
      </div>

      {/* 2. Student Profile Summary */}
      <Card variant="gold-accent" title="Student Profile Summary" style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '18px 24px',
            fontSize: '13.5px',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vyasa-text-secondary, #64748b)', fontWeight: 600, marginBottom: '4px' }}>
              Full Name
            </div>
            <strong style={{ color: 'var(--vyasa-navy, #0f2b48)', fontSize: '14px' }}>
              {record.full_name_snapshot || (record as any).full_name || 'N/A'}
            </strong>
          </div>

          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vyasa-text-secondary, #64748b)', fontWeight: 600, marginBottom: '4px' }}>
              Institutional Email
            </div>
            <strong style={{ color: 'var(--vyasa-navy, #0f2b48)', fontSize: '14px' }}>
              {record.email_snapshot || 'N/A'}
            </strong>
          </div>

          {record.mobile_snapshot && (
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vyasa-text-secondary, #64748b)', fontWeight: 600, marginBottom: '4px' }}>
                Contact Mobile
              </div>
              <strong style={{ color: 'var(--vyasa-navy, #0f2b48)', fontSize: '14px' }}>
                {record.mobile_snapshot}
              </strong>
            </div>
          )}

          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vyasa-text-secondary, #64748b)', fontWeight: 600, marginBottom: '4px' }}>
              Registration Number
            </div>
            <code style={{ fontSize: '13px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', color: '#0f2b48' }}>
              {record.registration_number_snapshot || (record as any).roll_number || 'N/A'}
            </code>
          </div>

          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vyasa-text-secondary, #64748b)', fontWeight: 600, marginBottom: '4px' }}>
              Enrollment Number
            </div>
            <code style={{ fontSize: '13px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', color: '#0f2b48' }}>
              {record.enrollment_number_snapshot || 'N/A'}
            </code>
          </div>

          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vyasa-text-secondary, #64748b)', fontWeight: 600, marginBottom: '4px' }}>
              Academic Subject / Discipline
            </div>
            <strong style={{ color: 'var(--vyasa-navy, #0f2b48)', fontSize: '14px' }}>
              {record.subject_name || (record as any).department || 'N/A'}
            </strong>
          </div>
        </div>
      </Card>

      {/* 3. Linked Archived Digital E-Files */}
      <Card
        variant="default"
        title={`Archived Digital E-Files (${(record.efiles || []).length})`}
        subtitle="Cryptographically sealed case dossiers and official resolution packages"
        style={{ marginBottom: '24px' }}
      >
        {(!record.efiles || record.efiles.length === 0) ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: '#fbfaf7',
              border: '1px dashed #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(212, 160, 23, 0.12)',
                color: '#d4a017',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <AppIcon name="book-open" size={22} color="#d4a017" />
            </div>
            <p style={{ fontWeight: 600, color: 'var(--vyasa-navy, #0f2b48)', margin: '0 0 6px', fontSize: '14px' }}>
              No Digitally Sealed E-Files Yet
            </p>
            <p style={{ color: 'var(--vyasa-text-secondary, #64748b)', fontSize: '13px', margin: 0, maxWidth: '440px', marginInline: 'auto' }}>
              No digitally sealed E-Files have been compiled yet. E-Files are generated automatically upon final case closure by the Manager.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {record.efiles.map((ef) => (
              <div
                key={ef.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(15, 43, 72, 0.04)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <AppIcon name="file-text" size={16} color="var(--vyasa-navy, #0f2b48)" />
                    <strong style={{ color: 'var(--vyasa-navy, #0f2b48)', fontSize: '14px' }}>
                      {ef.e_file_number}
                    </strong>
                    <Badge variant="teal">Sealed</Badge>
                    <span style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      {ef.page_count} Pages
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #64748b)', marginTop: '6px' }}>
                    Grievance Ref: <strong style={{ color: '#334155' }}>{ef.grievance_ref}</strong> &bull; SHA-256:{' '}
                    <code style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {ef.content_hash ? ef.content_hash.slice(0, 24) + '...' : 'N/A'}
                    </code>
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

      {/* 4. Longitudinal Grievance History */}
      <Card
        variant="default"
        title={`Longitudinal Grievance History (${(record.grievances || []).length})`}
        subtitle="Complete chronological record of all redressal petitions filed with CSJMU NIVARAN"
      >
        {(!record.grievances || record.grievances.length === 0) ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: '#fbfaf7',
              border: '1px dashed #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(15, 43, 72, 0.08)',
                color: 'var(--vyasa-navy, #0f2b48)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <AppIcon name="shield" size={22} color="var(--vyasa-navy, #0f2b48)" />
            </div>
            <p style={{ fontWeight: 600, color: 'var(--vyasa-navy, #0f2b48)', margin: '0 0 6px', fontSize: '14px' }}>
              No Grievance History Recorded
            </p>
            <p style={{ color: 'var(--vyasa-text-secondary, #64748b)', fontSize: '13px', margin: 0 }}>
              No grievances recorded under this student account.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {record.grievances.map((grv) => (
              <div
                key={grv.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(15, 43, 72, 0.04)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--vyasa-navy, #0f2b48)', fontSize: '13.5px' }}>{grv.grievance_id}</strong>
                    <Badge variant="neutral">{grv.status}</Badge>
                    <Badge variant="saffron">{grv.priority}</Badge>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginTop: '6px' }}>
                    {grv.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #64748b)', marginTop: '4px' }}>
                    Category: <strong style={{ color: '#475569' }}>{grv.category_name}</strong> &bull; Registered:{' '}
                    {new Date(grv.created_at).toLocaleDateString()}
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${grv.id}`)}
                  style={{ fontSize: '12.5px' }}
                >
                  View Case
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </ApplicantLayout>
  );
};
