import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Badge, Input, PageContainer, AppIcon } from '@vyasa/ui';
import { WorkspaceShell } from '../../../components/layout/WorkspaceShell';
import { anudaanService, ApiError } from '../services/anudaanService';
import { AnudaanTrackingStatusResponse } from '../types/anudaan';

export const AnudaanSanctionLetterPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Try to load pre-existing tracking data passed via location state
  const stateData = (location.state as { trackingData?: AnudaanTrackingStatusResponse })?.trackingData;
  const [trackingData, setTrackingData] = useState<AnudaanTrackingStatusResponse | null>(stateData || null);

  // Manual query fallback state if accessed via direct URL
  const [trackingSecret, setTrackingSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // If not in state, attempt query if secret exists in URL search params ?secret=...
    if (!trackingData && id) {
      const searchParams = new URLSearchParams(location.search);
      const secretFromQuery = searchParams.get('secret');
      if (secretFromQuery) {
        setLoading(true);
        anudaanService
          .trackApplication({
            application_number: id,
            tracking_secret: secretFromQuery,
          })
          .then((res) => {
            if (res.success && res.data) {
              setTrackingData(res.data);
            }
          })
          .catch((err) => {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve sanction order.');
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [id, location.search, trackingData]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !trackingSecret.trim()) {
      setErrorMsg('Please provide your confidential tracking secret.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await anudaanService.trackApplication({
        application_number: id.trim(),
        tracking_secret: trackingSecret.trim(),
      });
      if (res.success && res.data) {
        setTrackingData(res.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setErrorMsg('Application reference not found or tracking secret is invalid.');
        } else {
          setErrorMsg(err.message || 'Verification failed. Please check credentials.');
        }
      } else {
        setErrorMsg('Network error. Unable to connect to verification authority.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!id) {
    return (
      <WorkspaceShell currentTab="pillars">
        <PageContainer>
          <div style={{ maxWidth: 840, margin: '40px auto', padding: '0 16px' }}>
            <Card style={{ padding: 32, textAlign: 'center' }}>
              <AppIcon name="alert-circle" size={48} color="#DC2626" />
              <h2 style={{ fontSize: '1.4rem', color: '#1F2937', marginTop: 16 }}>
                Invalid Sanction Order Reference
              </h2>
              <p style={{ color: '#4B5563', marginBottom: 24 }}>
                No application or sanction reference was specified. Please return to the ANUDAAN Tracking portal.
              </p>
              <Button variant="primary" onClick={() => navigate('/modules/yajur-veda/anudaan/track')}>
                Return to Tracking Portal
              </Button>
            </Card>
          </div>
        </PageContainer>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell currentTab="pillars">
      <PageContainer>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 60px' }}>
          {/* 1. Stately Breadcrumb Navigation */}
          <nav
            aria-label="Breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#64748b',
              marginBottom: '20px',
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
              onClick={() => navigate('/modules/yajur-veda')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--vyasa-navy, #0f2b48)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Yajur Veda
            </button>
            <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
            <button
              type="button"
              onClick={() => navigate('/modules/yajur-veda/anudaan')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--vyasa-navy, #0f2b48)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ANUDAAN
            </button>
            <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
            <button
              type="button"
              onClick={() => navigate('/modules/yajur-veda/anudaan/track')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--vyasa-navy, #0f2b48)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Application Tracking
            </button>
            <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Sanction Order #{id}</span>
          </nav>

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/modules/yajur-veda/anudaan/track')}
            >
              &larr; Back to Tracking
            </Button>
            {trackingData && (
              <Button
                variant="primary"
                size="sm"
                onClick={handlePrint}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <AppIcon name="file-text" size={14} /> Print / Save PDF
              </Button>
            )}
          </div>

          {/* Lookup Card if no tracking data yet */}
          {!trackingData && (
            <Card style={{ padding: 28, marginBottom: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <AppIcon name="shield" size={40} color="#0B2545" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0B2545', margin: '12px 0 6px' }}>
                  Verify Credentials to View Sanction Order
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.9rem', maxWidth: 500, margin: '0 auto' }}>
                  Application Reference: <strong>{id}</strong>. Enter the confidential 32-character tracking secret issued upon submission to authenticate and reveal this institutional sanction order.
                </p>
              </div>

              {errorMsg && (
                <div
                  style={{
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #F87171',
                    color: '#B91C1C',
                    padding: '10px 14px',
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: '0.9rem',
                    textAlign: 'center',
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLookup} style={{ maxWidth: 440, margin: '0 auto' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: 6 }}>
                    Tracking Secret *
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter 32-character tracking secret"
                    value={trackingSecret}
                    onChange={(e) => setTrackingSecret(e.target.value)}
                    required
                  />
                </div>
                <Button variant="primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Authenticating Order...' : 'Authenticate & View Sanction Order'}
                </Button>
              </form>
            </Card>
          )}

          {/* Official CSJMU Sanction Letter Document View */}
          {trackingData && (
            <div
              className="anudaan-sanction-letter-print"
              style={{
                backgroundColor: '#ffffff',
                border: '2px solid #0B2545',
                borderRadius: 8,
                padding: '48px 40px',
                boxShadow: '0 4px 16px rgba(11, 37, 69, 0.08)',
                color: '#1A202C',
                position: 'relative',
              }}
            >
              {/* Official Seal Watermark */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.03,
                  pointerEvents: 'none',
                }}
              >
                <AppIcon name="shield" size={360} color="#0B2545" />
              </div>

              {/* Letterhead */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0B2545', paddingBottom: 20, marginBottom: 28 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: '#B2811A', textTransform: 'uppercase', marginBottom: 4 }}>
                  Chhatrapati Shahu Ji Maharaj University, Kanpur
                </div>
                <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0B2545', margin: '4px 0', fontFamily: 'serif' }}>
                  OFFICE OF THE DEAN OF RESEARCH &amp; DEVELOPMENT
                </h1>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#4A5568' }}>
                  Kalyanpur, Kanpur, Uttar Pradesh 208024 &bull; Web: www.csjmu.ac.in &bull; Email: dean.rnd@csjmu.ac.in
                </p>
                <div style={{ marginTop: 12, display: 'inline-block', backgroundColor: '#0B2545', color: '#ffffff', padding: '4px 16px', borderRadius: 4, fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.08em' }}>
                  EXECUTIVE SANCTION ORDER &bull; ANUDAAN SCHEME
                </div>
              </div>

              {/* Order Reference & Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24, fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: '#718096', display: 'block', fontSize: '0.8rem' }}>Order Reference:</span>
                  <strong style={{ color: '#0B2545', fontSize: '0.95rem' }}>
                    CSJMU/R&amp;D/ANUDAAN/{new Date().getFullYear()}/{trackingData.application_number}
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#718096', display: 'block', fontSize: '0.8rem' }}>Date of Sanction:</span>
                  <strong style={{ color: '#1A202C' }}>
                    {trackingData.submitted_at
                      ? new Date(trackingData.submitted_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      : new Date().toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                  </strong>
                </div>
              </div>

              {/* Beneficiary Details Box */}
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '16px 20px', marginBottom: 24, fontSize: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>Beneficiary Principal Author</span>
                    <strong style={{ color: '#0B2545' }}>{trackingData.applicant_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>Department</span>
                    <span style={{ color: '#1A202C' }}>{trackingData.department_name}</span>
                  </div>
                  <div>
                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>Category</span>
                    <span style={{ color: '#1A202C' }}>{trackingData.applicant_category}</span>
                  </div>
                  <div>
                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>Sanction Status</span>
                    <Badge variant="gold">VC Sanctioned &bull; Active</Badge>
                  </div>
                </div>
              </div>

              {/* Subject Statement */}
              <div style={{ marginBottom: 20, fontSize: '0.95rem', lineHeight: 1.6 }}>
                <strong>Subject:</strong> Administrative and financial sanction of research cash incentive under the university Research Publication Incentive Management Scheme (ANUDAAN V1.1) for indexed scholarly contributions.
              </div>

              {/* Preamble */}
              <p style={{ fontSize: '0.925rem', lineHeight: 1.6, color: '#2D3748', marginBottom: 24, textAlign: 'justify' }}>
                Under the authority vested by the Executive Council and with the administrative sanction of the Hon&apos;ble Vice Chancellor, financial grant approval is hereby accorded to <strong>{trackingData.applicant_name}</strong>, {trackingData.department_name}, for the publication(s) itemized below, having satisfied all statutory affiliation, indexing, and non-duplication criteria:
              </p>

              {/* Table of Publications */}
              <div style={{ marginBottom: 28, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0B2545', color: '#ffffff', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', border: '1px solid #0B2545' }}>#</th>
                      <th style={{ padding: '10px 12px', border: '1px solid #0B2545' }}>Publication Title</th>
                      <th style={{ padding: '10px 12px', border: '1px solid #0B2545' }}>Journal Name</th>
                      <th style={{ padding: '10px 12px', border: '1px solid #0B2545' }}>Indexing</th>
                      <th style={{ padding: '10px 12px', border: '1px solid #0B2545', textAlign: 'center' }}>Quartile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackingData.publications.map((pub, idx) => (
                      <tr key={pub.id || idx} style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                        <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0', color: '#1E293B' }}>
                          <strong>{pub.paper_title}</strong>
                        </td>
                        <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0', color: '#4A5568' }}>{pub.journal_name}</td>
                        <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0', color: '#4A5568' }}>{pub.indexing_type}</td>
                        <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#047857' }}>
                            {pub.verified_quartile || pub.applicant_declared_quartile}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sanction Clauses */}
              <div style={{ fontSize: '0.85rem', color: '#4A5568', lineHeight: 1.5, marginBottom: 36, borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
                <strong>Statutory Terms of Sanction:</strong>
                <ol style={{ paddingLeft: 20, margin: '8px 0 0' }}>
                  <li>The disbursed incentive is payable directly to the designated verified bank account of the beneficiary author.</li>
                  <li>In the event of publication retraction or ethical transgression, the complete sanctioned sum is subject to institutional recovery.</li>
                  <li>This order is digitally logged into the permanent university research blockchain ledger.</li>
                </ol>
              </div>

              {/* Endorsement & Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 40, paddingTop: 20, borderTop: '1px solid #CBD5E1' }}>
                <div style={{ textAlign: 'left', fontSize: '0.825rem', color: '#718096' }}>
                  <div>Digital Digest: <code>{trackingData.application_number.replace(/-/g, '').toLowerCase()}...sanctioned</code></div>
                  <div>Verified System Timestamp: {new Date().toISOString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0B2545' }}>
                    Prof. (Dr.) Sudhir Kumar
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#4A5568' }}>
                    Dean of Research &amp; Development
                  </div>
                  <div style={{ fontSize: '0.775rem', color: '#718096' }}>
                    For and on behalf of the Vice Chancellor, CSJMU
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </WorkspaceShell>
  );
};
