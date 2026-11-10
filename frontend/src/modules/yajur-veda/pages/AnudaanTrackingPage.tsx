import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Input, PageContainer } from '@vyasa/ui';
import { anudaanService, ApiError } from '../services/anudaanService';
import { AnudaanTrackingStatusResponse, AnudaanApplicationStatus } from '../types/anudaan';

const STATUS_BADGE_MAP: Record<AnudaanApplicationStatus, { label: string; variant: 'primary' | 'saffron' | 'gold' | 'teal' | 'neutral' }> = {
  DRAFT: { label: 'Draft Intake', variant: 'neutral' },
  SUBMITTED: { label: 'Submitted (Dean Queue)', variant: 'primary' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'teal' },
  NEEDS_CLARIFICATION: { label: 'Clarification Needed', variant: 'saffron' },
  ACCEPTED: { label: 'Dean Recommended', variant: 'primary' },
  REJECTED: { label: 'Rejected', variant: 'neutral' },
  APPROVED_FOR_RELEASE: { label: 'VC Sanctioned', variant: 'gold' },
  RELEASED: { label: 'Released to Accounts', variant: 'teal' },
  PROCESSING: { label: 'Payment Processing', variant: 'teal' },
  CREDITED: { label: 'Incentive Credited', variant: 'primary' },
};

export const AnudaanTrackingPage: React.FC = () => {
  const navigate = useNavigate();

  // Search Inputs
  const [appNumber, setAppNumber] = useState('');
  const [trackingSecret, setTrackingSecret] = useState('');

  // Results & Feedback
  const [trackingData, setTrackingData] = useState<AnudaanTrackingStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Rate Limiting Countdown
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;
    const timer = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setTrackingData(null);

    const num = appNumber.trim();
    const sec = trackingSecret.trim();

    if (!num || !sec) {
      setErrorMsg('Both Application Number and Tracking Secret are required.');
      return;
    }

    try {
      setLoading(true);
      const res = await anudaanService.trackApplication({
        application_number: num,
        tracking_secret: sec,
      });

      if (res.success && res.data) {
        setTrackingData(res.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 429) {
          // Parse Retry-After if available in details or default to 60s
          const waitTime = typeof err.details === 'number' ? err.details : 60;
          setRetryAfter(waitTime);
          setErrorMsg(`Rate limit exceeded. Please wait ${waitTime} seconds before retrying.`);
        } else if (err.statusCode === 404) {
          setErrorMsg('Application not found or tracking secret is invalid.');
        } else {
          setErrorMsg(err.message || 'Tracking failed. Please verify credentials.');
        }
      } else {
        setErrorMsg('Network error. Unable to connect to institutional verification service.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div style={{ maxWidth: 840, margin: '0 auto', padding: '32px 16px' }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: 24 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/modules/yajur-veda/anudaan')}
            style={{ marginBottom: 16 }}
          >
            ← Back to ANUDAAN Portal
          </Button>

          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#0B2545',
              fontFamily: 'var(--font-heading, Cinzel, serif)',
              margin: '0 0 8px',
            }}
          >
            Track ANUDAAN Application
          </h1>
          <p style={{ color: '#4A5568', fontSize: '1rem', lineHeight: 1.5, margin: 0 }}>
            Enter your institutional Application Number (e.g. <code>ANU-2026-XXXXX</code>) and confidential Tracking Secret.
          </p>
        </div>

        {/* Input Form Card */}
        <Card style={{ padding: 28, marginBottom: 32 }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: '#FEE2E2',
                border: '1px solid #F87171',
                color: '#B91C1C',
                padding: '12px 16px',
                borderRadius: 6,
                marginBottom: 20,
                fontSize: '0.925rem',
              }}
            >
              {errorMsg}
              {retryAfter !== null && (
                <div style={{ fontWeight: 600, marginTop: 4 }}>
                  Retrying enabled in: {retryAfter}s
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleTrack}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 6 }}>
                  Application Number *
                </label>
                <Input
                  placeholder="ANU-2026-XXXXX"
                  value={appNumber}
                  onChange={(e) => setAppNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 6 }}>
                  Confidential Tracking Secret *
                </label>
                <Input
                  type="password"
                  placeholder="32-character secret"
                  value={trackingSecret}
                  onChange={(e) => setTrackingSecret(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                type="submit"
                disabled={loading || retryAfter !== null}
              >
                {loading ? 'Querying Status...' : 'Query Application Status'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Tracking Result View */}
        {trackingData && (
          <Card style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #E2E8F0', paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Institutional Application
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0B2545', margin: '4px 0 0' }}>
                  {trackingData.application_number}
                </h2>
              </div>
              <Badge variant={STATUS_BADGE_MAP[trackingData.status]?.variant || 'neutral'}>
                {STATUS_BADGE_MAP[trackingData.status]?.label || trackingData.status}
              </Badge>
            </div>

            {/* Application Particulars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24, fontSize: '0.925rem' }}>
              <div>
                <span style={{ color: '#6B7280', display: 'block', fontSize: '0.825rem' }}>Applicant Name</span>
                <strong style={{ color: '#1F2937' }}>{trackingData.applicant_name}</strong>
              </div>
              <div>
                <span style={{ color: '#6B7280', display: 'block', fontSize: '0.825rem' }}>Department</span>
                <span style={{ color: '#1F2937' }}>{trackingData.department_name}</span>
              </div>
              <div>
                <span style={{ color: '#6B7280', display: 'block', fontSize: '0.825rem' }}>Applicant Category</span>
                <span style={{ color: '#1F2937' }}>{trackingData.applicant_category}</span>
              </div>
              <div>
                <span style={{ color: '#6B7280', display: 'block', fontSize: '0.825rem' }}>Submitted At</span>
                <span style={{ color: '#1F2937' }}>
                  {trackingData.submitted_at
                    ? new Date(trackingData.submitted_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Draft Stage'}
                </span>
              </div>
            </div>

            {/* Status Description Banner */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 18px', marginBottom: 24 }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#4A5568', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Lifecycle Progression Status
              </span>
              <p style={{ margin: 0, color: '#1F2937', fontSize: '0.95rem', lineHeight: 1.5 }}>
                {trackingData.status_description}
              </p>
            </div>

            {/* Attached Publications Summary */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0B2545', marginBottom: 12 }}>
                Claimed Publications ({trackingData.publication_count})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {trackingData.publications.map((pub, idx) => (
                  <div
                    key={pub.id || idx}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: 6,
                      padding: '12px 16px',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                      {idx + 1}. {pub.paper_title}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem', color: '#64748B' }}>
                      <span>Journal: <strong>{pub.journal_name}</strong></span>
                      <span>Year: <strong>{pub.publication_year}</strong></span>
                      <span>Indexing: <strong>{pub.indexing_type}</strong></span>
                      <span>Declared Quartile: <strong>{pub.applicant_declared_quartile}</strong></span>
                      {pub.verified_quartile && (
                        <span style={{ color: '#047857' }}>
                          Verified Quartile: <strong>{pub.verified_quartile}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sanction Letter Action for Approved Applications */}
            {['APPROVED_FOR_RELEASE', 'RELEASED', 'PROCESSING', 'CREDITED'].includes(trackingData.status) && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 18,
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <strong style={{ color: '#0B2545', fontSize: '0.95rem', display: 'block' }}>
                    Executive VC Sanction Granted
                  </strong>
                  <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                    An official institutional sanction order is available for this application.
                  </span>
                </div>
                <Button
                  variant="primary"
                  onClick={() =>
                    navigate(`/modules/yajur-veda/anudaan/sanction/${trackingData.application_number}`, {
                      state: { trackingData },
                    })
                  }
                >
                  View Sanction Letter &rarr;
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </PageContainer>
  );
};
