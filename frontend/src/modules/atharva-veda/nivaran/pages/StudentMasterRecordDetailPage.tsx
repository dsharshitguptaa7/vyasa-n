import React, { useEffect, useState } from 'react';
import { Badge, Button, LoadingState, AppIcon } from '@vyasa/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { phase6dService } from '../services/phase6dService';
import { StudentMasterRecordDetailResponse } from '../types/phase6d';
import './CaseReview.css';

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
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="nivaran-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
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
            <AppIcon name="alert-circle" size={24} />
          </div>
          <h3 style={{ color: '#b91c1c', margin: '0 0 10px', fontSize: '18px', fontWeight: 600 }}>Access Restricted</h3>
          <p style={{ color: 'var(--vyasa-text-secondary, #64748b)', maxWidth: '520px', margin: '0 auto 24px', fontSize: '13.5px', lineHeight: 1.5 }}>
            Platform Administrators do not automatically inherit case-level grievance or Student Master Record access.
          </p>
          <Button variant="outline" onClick={() => navigate('/admin')}>
            &larr; Return to Admin Panel
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <LoadingState message="Loading official student record..." />
      </div>
    );
  }

  if (errorMsg || !record) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="nivaran-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
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
            <AppIcon name="alert-circle" size={24} />
          </div>
          <h3 style={{ color: '#b91c1c', margin: '0 0 12px', fontSize: '18px', fontWeight: 600 }}>Student Record Unavailable</h3>
          <p style={{ color: 'var(--vyasa-text-secondary, #64748b)', maxWidth: '520px', margin: '0 auto 20px', fontSize: '13.5px' }}>
            {errorMsg || 'Student record was not found or you do not have permission to view it.'}
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            &larr; Go Back
          </Button>
        </div>
      </div>
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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px 20px', boxSizing: 'border-box' }}>
      {/* 0. Clean Institutional Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#64748b',
          marginBottom: '16px',
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
            gap: '5px',
          }}
        >
          <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
          <span>VYASA Dashboard</span>
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <button
          type="button"
          onClick={() => {
            if (isApplicant) {
              navigate('/modules/atharva-veda/nivaran/my-grievances');
            } else {
              navigate('/modules/atharva-veda/nivaran/student-records');
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          NIVARAN
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <span style={{ color: '#64748b', fontWeight: 500 }}>
          {isApplicant ? 'Student Record' : `Dossier: ${record.record_number}`}
        </span>
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
              <AppIcon name="user" size={20} color="var(--vyasa-navy, #1b2a4a)" />
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
                  Official Student Master Record <span className="sr-only">Official Student Master Record Dossier</span>
                </h1>
                <Badge variant="teal">{record.record_number}</Badge>
                <Badge variant="saffron">{record.status}</Badge>
                <Badge variant="teal">{record.subject_name}</Badge>
              </div>

              <p className="nivaran-case-meta">
                <span className="nivaran-case-meta__item">
                  Longitudinal institutional ledger &bull; Chhatrapati Shahu Ji Maharaj University, Kanpur
                </span>
                <span className="nivaran-case-meta__separator">&bull;</span>
                <span className="nivaran-case-meta__item" style={{ color: 'var(--vyasa-navy, #0f2b48)', fontWeight: 600 }}>
                  Scholar: {record.full_name_snapshot}
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
      </div>

      {/* 2. Structured Dossier Card: Scholar Identity & Academic Details */}
      <div className="nivaran-card nivaran-card--gold" style={{ marginBottom: '20px' }}>
        <div className="nivaran-card__header">
          <div className="nivaran-card__header-left">
            <div className="nivaran-card__header-chip nivaran-card__header-chip--gold">
              <AppIcon name="user" size={16} color="var(--vyasa-gold, #b2811a)" />
            </div>
            <div>
              <h3 className="nivaran-card__title">Scholar Identity &amp; Academic Particulars</h3>
              <p className="nivaran-card__subtitle">Official university enrolment and statutory registration records</p>
            </div>
          </div>
        </div>
        <div className="nivaran-card__body">
          <div className="nivaran-particulars-grid">
            <div className="nivaran-field-item">
              <span className="nivaran-field-label">Full Legal Name</span>
              <span className="nivaran-field-value">{record.full_name_snapshot}</span>
            </div>
            <div className="nivaran-field-item">
              <span className="nivaran-field-label">Registered Institutional Email</span>
              <span className="nivaran-field-value">{record.email_snapshot}</span>
            </div>
            {record.mobile_snapshot && (
              <div className="nivaran-field-item">
                <span className="nivaran-field-label">Contact Mobile</span>
                <span className="nivaran-field-value">{record.mobile_snapshot}</span>
              </div>
            )}
            <div className="nivaran-field-item">
              <span className="nivaran-field-label">Registration Number</span>
              <span className="nivaran-field-value">
                <code>{record.registration_number_snapshot || 'N/A'}</code>
              </span>
            </div>
            <div className="nivaran-field-item">
              <span className="nivaran-field-label">Enrollment Number</span>
              <span className="nivaran-field-value">
                <code>{record.enrollment_number_snapshot || 'N/A'}</code>
              </span>
            </div>
            <div className="nivaran-field-item">
              <span className="nivaran-field-label">Designated Subject Discipline</span>
              <span className="nivaran-field-value">{record.subject_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Structured Executive Metric Cards */}
      <div className="nivaran-docket-kpi-grid">
        <div className="nivaran-docket-kpi nivaran-docket-kpi--navy">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Total Recorded Cases</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="clipboard" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value">{totalGrievances}</div>
          <div className="nivaran-docket-kpi__subtext">Lifetime grievance docket</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--amber">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Active / In Progress</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="clock" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#b45309' }}>{inProgressCount + submittedCount}</div>
          <div className="nivaran-docket-kpi__subtext">Under review or inquiry</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--sky">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Resolved Direct Determinations</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="check-circle" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#0284c7' }}>{resolvedCount}</div>
          <div className="nivaran-docket-kpi__subtext">Determinations committed</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--emerald">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Closed &amp; Sealed E-Files</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="shield" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#047857' }}>{closedCount}</div>
          <div className="nivaran-docket-kpi__subtext">{record.efiles.length} Cryptographic dossiers</div>
        </div>
      </div>

      {/* 4. Complete Grievance History */}
      <div className="nivaran-card" style={{ marginBottom: '24px' }}>
        <div className="nivaran-card__header">
          <div className="nivaran-card__header-left">
            <div className="nivaran-card__header-chip">
              <AppIcon name="file-text" size={16} color="var(--vyasa-navy, #0f2b48)" />
            </div>
            <div>
              <h3 className="nivaran-card__title">Longitudinal Grievance History ({record.grievances.length})</h3>
              <p className="nivaran-card__subtitle">Complete historical record of grievances submitted by this scholar</p>
            </div>
          </div>
        </div>
        <div className="nivaran-card__body">
          {record.grievances.length === 0 ? (
            <div className="nivaran-empty-state">
              <p style={{ color: 'var(--vyasa-text-secondary, #64748b)', fontSize: '13px', margin: 0 }}>
                No grievances recorded under this student account.
              </p>
            </div>
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
                    gap: '12px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="nivaran-tracking-pill">{grv.grievance_id}</span>
                      <Badge variant="teal" size="sm">{grv.status}</Badge>
                      <Badge variant="saffron" size="sm">{grv.priority}</Badge>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginTop: '6px' }}>
                      {grv.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary, #64748b)', marginTop: '2px' }}>
                      Category: {grv.category_name} &bull; Registered: {new Date(grv.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      {grv.closed_at && (
                        <span> &bull; Closed: {new Date(grv.closed_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${grv.id}`)}
                    >
                      View Case &rarr;
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Sealed E-Files Dossiers */}
      <div className="nivaran-card nivaran-card--gold">
        <div className="nivaran-card__header">
          <div className="nivaran-card__header-left">
            <div className="nivaran-card__header-chip nivaran-card__header-chip--gold">
              <AppIcon name="shield" size={16} color="var(--vyasa-gold, #b2811a)" />
            </div>
            <div>
              <h3 className="nivaran-card__title">Official Sealed E-Files ({record.efiles.length})</h3>
              <p className="nivaran-card__subtitle">Tamper-evident, cryptographically signed archival records</p>
            </div>
          </div>
        </div>
        <div className="nivaran-card__body">
          {record.efiles.length === 0 ? (
            <div className="nivaran-empty-state">
              <p style={{ color: 'var(--vyasa-text-secondary, #64748b)', fontSize: '13px', margin: 0 }}>
                No sealed E-Files compiled for this student yet.
              </p>
            </div>
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
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="nivaran-tracking-pill">{ef.e_file_number}</span>
                      <Badge variant="teal" size="sm">Digitally Sealed</Badge>
                      <Badge variant="neutral" size="sm">{ef.page_count} Pages</Badge>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e293b', marginTop: '4px' }}>
                      Case Ref: {ef.grievance_ref}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                      SHA-256: {ef.content_hash || 'SHA256:N/A'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={phase6dService.getDownloadUrl(ef.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <Button variant="primary" size="sm" style={{ fontSize: '12px' }}>
                        Download Dossier &darr;
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
