import React, { useState } from 'react';
import { Badge, Button, LoadingState, EmptyState, AppIcon } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { phase6dService } from '../services/phase6dService';
import { StudentMasterRecordSummaryItem } from '../types/phase6d';
import './CaseReview.css';

export const StudentRecordSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, displayName, authorityDesignation } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<StudentMasterRecordSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const authorityFullName = displayName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Appointed Authority');

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
          onClick={() => navigate('/modules/atharva-veda/nivaran/assistant-dean/dashboard')}
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
        <span style={{ color: '#64748b', fontWeight: 500 }}>Student Master Records</span>
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
              <AppIcon name="search" size={20} color="var(--vyasa-navy, #1b2a4a)" />
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
                  Student Master Records Directory
                </h1>
                <Badge variant="teal">Jurisdictional Access</Badge>
                <Badge variant="saffron">Permanent Academic Dossiers</Badge>
              </div>

              <p className="nivaran-case-meta">
                <span className="nivaran-case-meta__item">
                  Authority directory lookup: query by student registration number, enrollment number, or name. Filtered by your jurisdictional subject cluster.
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
              onClick={() => navigate('/modules/atharva-veda/nivaran/assistant-dean/dashboard')}
            >
              &larr; Back to Docket
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Authority Identity & Jurisdiction Summary Strip */}
      <div
        data-testid="authority-identity-summary"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          {/* Account Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="user" size={15} color="#b2811a" />
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Appointed Authority
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f2b48' }}>
                {authorityFullName}
              </span>
            </div>
          </div>

          {/* Institutional Email */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="mail" size={15} color="#2563eb" />
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Official Email
              </span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                {user?.email || '—'}
              </span>
            </div>
          </div>

          {/* Jurisdiction Scope */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="scale" size={15} color="#0d9488" />
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Jurisdiction Scope
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f2b48' }}>
                {authorityDesignation || 'Designated Subject Cluster Directory'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/e-files')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--vyasa-primary, #0f2b48)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#eff6ff';
            e.currentTarget.style.borderColor = '#93c5fd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
        >
          <span>Digital E-Files Archive</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>

      {/* 3. Structured Executive Metric Cards */}
      <div className="nivaran-docket-kpi-grid">
        <div className="nivaran-docket-kpi nivaran-docket-kpi--navy">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Directory Jurisdiction</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="shield" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ fontSize: '17px', lineHeight: 1.25 }}>Cluster Scoped</div>
          <div className="nivaran-docket-kpi__subtext">Authorized subject disciplines</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--sky">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Query Parameters</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="search" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ fontSize: '17px', lineHeight: 1.25, color: '#0284c7' }}>Reg / Enr / Name</div>
          <div className="nivaran-docket-kpi__subtext">Instant master record lookup</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--emerald">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Dossier Integrity</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="check-circle" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ fontSize: '17px', lineHeight: 1.25, color: '#047857' }}>Permanent SMR</div>
          <div className="nivaran-docket-kpi__subtext">Longitudinal academic ledger</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--amber">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Records In Query</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="file-text" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#b45309' }}>
            {hasSearched ? results.length : '—'}
          </div>
          <div className="nivaran-docket-kpi__subtext">Matched scholar dossiers</div>
        </div>
      </div>

      {/* 4. Refined Docket Search Toolbar */}
      <div className="nivaran-docket-toolbar">
        <form onSubmit={handleSearch} className="nivaran-docket-search-wrap" style={{ width: '100%' }}>
          <span className="nivaran-docket-search-icon">
            <AppIcon name="search" size={14} />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter Registration No. (e.g. CSJMU-2026-...), Enrollment No., or Scholar Name..."
            className="nivaran-docket-search-input"
            style={{ flex: 1, width: '100%', maxWidth: '520px' }}
          />
          <Button
            size="sm"
            variant="primary"
            type="submit"
            disabled={loading || !searchTerm.trim()}
            style={{ marginLeft: '8px' }}
          >
            {loading ? 'Searching Directory...' : 'Search Records'}
          </Button>
          {searchTerm && (
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => {
                setSearchTerm('');
                setResults([]);
                setHasSearched(false);
              }}
              style={{ marginLeft: '6px' }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AppIcon name="alert-circle" size={16} color="#b91c1c" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 5. Results Section */}
      {loading ? (
        <LoadingState message="Querying jurisdictional Master Records database..." />
      ) : hasSearched && results.length === 0 ? (
        <EmptyState
          title="No Master Records Found"
          description={`No student master records matched "${searchTerm}" within your authorized jurisdictional cluster.`}
        />
      ) : results.length > 0 ? (
        <div className="nivaran-docket-table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="nivaran-docket-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Record #</th>
                  <th>Scholar Particulars</th>
                  <th style={{ width: '180px' }}>Subject Discipline</th>
                  <th style={{ width: '110px' }}>Status</th>
                  <th style={{ width: '220px' }}>Dossier Grievances &amp; E-Files</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((rec) => (
                  <tr key={rec.id} className="nivaran-docket-row">
                    {/* Record Number Pill */}
                    <td className="nivaran-docket-cell">
                      <span className="nivaran-tracking-pill">
                        {rec.record_number}
                      </span>
                    </td>

                    {/* Scholar Particulars */}
                    <td className="nivaran-docket-cell">
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-navy, #0f2b48)', fontSize: '14px' }}>
                        {rec.full_name_snapshot}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span>Email: <strong style={{ color: '#334155' }}>{rec.email_snapshot}</strong></span>
                        {rec.registration_number_snapshot && (
                          <span>Reg: <code>{rec.registration_number_snapshot}</code></span>
                        )}
                        {rec.enrollment_number_snapshot && (
                          <span>Enr: <code>{rec.enrollment_number_snapshot}</code></span>
                        )}
                      </div>
                    </td>

                    {/* Subject Discipline */}
                    <td className="nivaran-docket-cell">
                      <span className="nivaran-category-chip" title={rec.subject_name}>
                        {rec.subject_name}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="nivaran-docket-cell">
                      <Badge variant="teal" size="sm">
                        {rec.status}
                      </Badge>
                    </td>

                    {/* Metrics Summary */}
                    <td className="nivaran-docket-cell">
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>
                          Total: {rec.total_grievances}
                        </span>
                        <span style={{ padding: '2px 7px', borderRadius: '4px', backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: 600 }}>
                          Closed: {rec.closed_grievances}
                        </span>
                        <span style={{ padding: '2px 7px', borderRadius: '4px', backgroundColor: '#fdf8ee', color: '#b45309', fontWeight: 600 }}>
                          Sealed: {rec.total_efiles}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="nivaran-docket-cell" style={{ textAlign: 'right' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/modules/atharva-veda/nivaran/student-records/${rec.id}`)}
                      >
                        View Master Record &rarr;
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div
          className="nivaran-card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'linear-gradient(180deg, #ffffff 0%, #fbfaf7 100%)',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              backgroundColor: 'rgba(212, 160, 23, 0.12)',
              border: '1px solid rgba(212, 160, 23, 0.25)',
              color: '#d4a017',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <AppIcon name="search" size={26} color="#d4a017" />
          </div>
          <h3
            style={{
              color: 'var(--vyasa-navy, #0f2b48)',
              margin: '0 0 8px',
              fontSize: '17px',
              fontWeight: 700,
              fontFamily: 'var(--vyasa-font-scholarly, Georgia, serif)',
            }}
          >
            Ready to Search Student Master Records
          </h3>
          <p
            style={{
              color: 'var(--vyasa-text-secondary, #64748b)',
              maxWidth: '480px',
              margin: '0 auto',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            Enter a student registration number (e.g. <code>CSJMU-2026-...</code>), enrollment number, or scholar name above to inspect their official university dossier.
          </p>
        </div>
      )}
    </div>
  );
};
