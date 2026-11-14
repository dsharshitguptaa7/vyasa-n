import React, { useState, useMemo } from 'react';
import { Badge, Button, Input, Select, EmptyState, AppIcon, SectionHeading } from '@vyasa/ui';
import {
  CertificateVerificationResult,
  PublicPublication,
  PublicBulletin,
  PublicAuthor,
  ResearcherDiscoveryData,
  ResearcherAuthChallenge,
  DiscoveredCertificateItem,
  samaVedaService,
} from '../services/samaVedaService';

interface SamikshaFelicitationTabProps {
  // Verification states
  certQuery: string;
  onCertQueryChange: (val: string) => void;
  onVerifyCertificate: (e: React.FormEvent) => void;
  certLoading: boolean;
  certError: string | null;
  certResult: CertificateVerificationResult | null;
  onDownloadCertificate: () => void;
  // Recognition records (publications awarded felicitation in bulletins)
  publications: PublicPublication[];
  totalPublications: number;
  bulletins: PublicBulletin[];
  authors: PublicAuthor[];
}

export const SamikshaFelicitationTab: React.FC<SamikshaFelicitationTabProps> = ({
  certQuery,
  onCertQueryChange,
  onVerifyCertificate,
  certLoading,
  certError,
  certResult,
  onDownloadCertificate,
  publications,
  totalPublications,
  bulletins,
  authors,
}) => {
  // ---------------------------------------------------------------------------
  // SECTION A: Researcher Certificate Discovery States
  // ---------------------------------------------------------------------------
  const [scopusQuery, setScopusQuery] = useState('');
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveryData, setDiscoveryData] = useState<ResearcherDiscoveryData | null>(null);
  const [authChallenge, setAuthChallenge] = useState<ResearcherAuthChallenge | null>(null);

  // OTP Verification States
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [researcherToken, setResearcherToken] = useState<string | null>(null);

  // Category Filter for Discovered Certificates
  const [activeCategory, setActiveCategory] = useState<'RESEARCH_WORK' | 'INCENTIVE'>('RESEARCH_WORK');
  const [downloadingCertId, setDownloadingCertId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Recognition Gallery States (Preserved)
  // ---------------------------------------------------------------------------
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryCategory, setGalleryCategory] = useState('');
  const [gallerySort, setGallerySort] = useState<'newest' | 'oldest'>('newest');
  const [selectedRecord, setSelectedRecord] = useState<PublicPublication | null>(null);

  const filteredGallery = useMemo(() => {
    let result = [...publications];

    if (gallerySearch.trim()) {
      const q = gallerySearch.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.author_display?.toLowerCase().includes(q) ||
          p.source_journal?.toLowerCase().includes(q) ||
          p.doi?.toLowerCase().includes(q)
      );
    }

    if (galleryCategory) {
      result = result.filter((p) => p.category?.toLowerCase() === galleryCategory.toLowerCase());
    }

    result.sort((a, b) => {
      const dateA = new Date(a.published_at || a.created_at).getTime() || 0;
      const dateB = new Date(b.published_at || b.created_at).getTime() || 0;
      return gallerySort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [publications, gallerySearch, galleryCategory, gallerySort]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    publications.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [publications]);

  const verifiedAuthorsCount = authors.filter((a) => a.is_verified).length;

  // ---------------------------------------------------------------------------
  // Researcher Discovery Actions
  // ---------------------------------------------------------------------------
  const handleFindCertificates = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanScopus = scopusQuery.trim();
    if (!cleanScopus) return;

    try {
      setDiscoveryLoading(true);
      setDiscoveryError(null);
      setDiscoveryData(null);
      setAuthChallenge(null);
      setOtpSent(false);
      setOtpError(null);
      setDownloadError(null);

      const res = await samaVedaService.discoverResearcherCertificates(cleanScopus, researcherToken || undefined);

      if (res.data) {
        setDiscoveryData(res.data);
      } else if (res.challenge) {
        setAuthChallenge(res.challenge);
        if (res.challenge.researcher?.masked_email) {
          setMaskedEmail(res.challenge.researcher.masked_email);
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setDiscoveryError(e.message || 'Unable to discover certificates. Please verify your Scopus ID.');
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanScopus = scopusQuery.trim();
    if (!cleanScopus) return;

    try {
      setOtpLoading(true);
      setOtpError(null);
      const res = await samaVedaService.sendResearcherOtp(cleanScopus);
      setOtpSent(true);
      if (res.masked_email) {
        setMaskedEmail(res.masked_email);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setOtpError(e.message || 'Failed to dispatch verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanScopus = scopusQuery.trim();
    const cleanCode = otpCode.trim();
    if (!cleanScopus || !cleanCode) return;

    try {
      setOtpLoading(true);
      setOtpError(null);
      const res = await samaVedaService.verifyResearcherOtp(cleanScopus, cleanCode);
      setResearcherToken(res.researcher_token);

      // Now fetch certificates with validated token
      const certRes = await samaVedaService.discoverResearcherCertificates(cleanScopus, res.researcher_token);
      if (certRes.data) {
        setDiscoveryData(certRes.data);
        setAuthChallenge(null);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setOtpError(e.message || 'Incorrect verification code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleDownloadDiscoveredPdf = async (cert: DiscoveredCertificateItem) => {
    try {
      setDownloadingCertId(cert.id);
      setDownloadError(null);
      const filename = `${cert.certificate_number.replace(/[\/\\]/g, '_')}.pdf`;
      await samaVedaService.downloadCertificate(cert.verification_token || cert.certificate_number, filename);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setDownloadError(e.message || 'Download temporarily unavailable.');
    } finally {
      setDownloadingCertId(null);
    }
  };

  const handleResetDiscovery = () => {
    setScopusQuery('');
    setDiscoveryData(null);
    setAuthChallenge(null);
    setDiscoveryError(null);
    setOtpSent(false);
    setOtpCode('');
    setOtpError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* =================================================================== */}
      {/* 1. Official Institutional Recognition & Centre Header               */}
      {/* =================================================================== */}
      <div
        style={{
          background: 'linear-gradient(135deg, #061325 0%, #0a1f3d 50%, #0d3852 100%)',
          borderRadius: '16px',
          padding: '30px 34px',
          color: '#ffffff',
          boxShadow: '0 8px 30px rgba(6, 19, 37, 0.28)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                background: 'rgba(245, 158, 11, 0.18)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#f59e0b',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '12px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <AppIcon name="shield" size={13} color="#f59e0b" />
              <span>Official Institutional Recognition</span>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.02em', color: '#ffffff' }}>
              Research Recognition &amp; Felicitations
            </h2>
            <div style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Certificate Download &amp; Verification Centre
            </div>
            <p style={{ fontSize: '14px', color: '#cbd5e1', margin: 0, lineHeight: 1.55, maxWidth: '640px' }}>
              Recognising scholarly contributions, research achievements, and academic excellence across all university faculties. Access, download, and cryptographically verify officially issued CSJMU research felicitations, excellence awards, and publication certificates.
            </p>
          </div>

          {/* Institutional Verified Badges */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                textAlign: 'center',
                minWidth: '100px',
              }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b' }}>
                {totalPublications > 0 ? totalPublications : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>Felicitated Works</div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                textAlign: 'center',
                minWidth: '100px',
              }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8' }}>
                {verifiedAuthorsCount > 0 ? verifiedAuthorsCount : authors.length > 0 ? authors.length : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>Recognized Faculty</div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                textAlign: 'center',
                minWidth: '100px',
              }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#2dd4bf' }}>
                {bulletins.length > 0 ? bulletins.length : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>Official Bulletins</div>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION A: DOWNLOAD MY CERTIFICATES (SCOPUS ID DISCOVERY)           */}
      {/* =================================================================== */}
      <div
        id="researcher-certificate-discovery"
        className="samiksha-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          padding: '32px',
          border: '1.5px solid #E2E8F0',
          borderRadius: '16px',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 4px 20px rgba(15, 43, 72, 0.04)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#B2811A',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '6px',
            }}
          >
            <span>📜</span>
            <span>Researcher Credential Self-Service</span>
          </div>
          <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#0F2B48', margin: '0 0 6px 0' }}>
            Download Your Research Certificates
          </h3>
          <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Enter your registered Scopus ID to access your officially issued university certificates.
          </p>
        </div>

        {/* Scopus ID Search Input Form */}
        {!discoveryData && (
          <form
            onSubmit={handleFindCertificates}
            style={{
              display: 'flex',
              gap: '12px',
              background: '#F8FAFC',
              padding: '16px 20px',
              borderRadius: '14px',
              border: '1px solid #E2E8F0',
              maxWidth: '680px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ flex: 1 }}>
              <Input
                placeholder="Enter your registered Scopus ID (e.g. 57218492000)..."
                value={scopusQuery}
                onChange={(e) => setScopusQuery(e.target.value)}
                aria-label="Researcher Scopus ID"
              />
            </div>
            <Button variant="primary" type="submit" disabled={discoveryLoading || !scopusQuery.trim()}>
              {discoveryLoading ? 'Searching Directory...' : 'Find My Certificates'}
            </Button>
          </form>
        )}

        {/* Global Error Banner */}
        {discoveryError && (
          <div
            style={{
              maxWidth: '680px',
              margin: '0 auto',
              width: '100%',
              padding: '14px 18px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              color: '#991B1B',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AppIcon name="alert-circle" size={18} color="#991B1B" />
            <div>
              <strong>Discovery Notice:</strong> {discoveryError}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* ACCESS SECURITY & OTP AUTHENTICATION CHALLENGE BOX                */}
        {/* ================================================================= */}
        {authChallenge && !discoveryData && (
          <div
            style={{
              maxWidth: '680px',
              margin: '0 auto',
              width: '100%',
              background: '#FAF7F0',
              border: '2px solid #B2811A',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(178, 129, 26, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔐</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F2B48' }}>
                  Researcher Identity Verification Required
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  CSJMU Institutional Security Policy (Phase 3)
                </div>
              </div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2B48' }}>
                {authChallenge.researcher.full_name.startsWith('Dr.') || authChallenge.researcher.full_name.startsWith('Prof.')
                  ? authChallenge.researcher.full_name
                  : `Dr. ${authChallenge.researcher.full_name}`}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                {authChallenge.researcher.department || 'Academic Faculty'} • {authChallenge.researcher.institutional_affiliation || 'CSJMU, Kanpur'}
              </div>
              <div style={{ fontSize: '11px', color: '#B2811A', fontWeight: 600, marginTop: '4px' }}>
                Registered Scopus ID: {authChallenge.researcher.scopus_id}
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              To safeguard academic credentials and private incentive records, please verify your identity using your registered institutional email address.
            </p>

            {otpError && (
              <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#991B1B', fontSize: '12.5px', marginBottom: '14px' }}>
                {otpError}
              </div>
            )}

            {!otpSent ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '12.5px', color: '#334155' }}>
                  {maskedEmail ? (
                    <span>
                      Registered Email: <strong>{maskedEmail}</strong>
                    </span>
                  ) : (
                    <span>No institutional email linked. Please sign in via university portal.</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="outline" size="sm" onClick={handleResetDiscovery}>
                    Cancel
                  </Button>
                  {maskedEmail && (
                    <Button variant="primary" size="sm" onClick={handleSendOtp} disabled={otpLoading}>
                      {otpLoading ? 'Sending Code...' : `Send Code to ${maskedEmail}`}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '12.5px', color: '#166534', background: '#DCFCE7', padding: '10px 14px', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                  ✓ A 6-digit verification code has been dispatched to <strong>{maskedEmail}</strong>. Please enter it below.
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Input
                    placeholder="Enter 6-digit verification code..."
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    style={{ letterSpacing: '0.15em', fontSize: '15px', fontWeight: 700 }}
                  />
                  <Button variant="primary" type="submit" disabled={otpLoading || otpCode.trim().length < 4}>
                    {otpLoading ? 'Verifying...' : 'Verify & Access Certificates'}
                  </Button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpLoading}
                    style={{ background: 'none', border: 'none', color: '#B2811A', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDiscovery}
                    style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  >
                    Use Another Scopus ID
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* DISCOVERED CERTIFICATES DISPLAY (TWO CATEGORIES)                  */}
        {/* ================================================================= */}
        {discoveryData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Researcher Profile Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #FAF7F0 0%, #FFFFFF 100%)',
                border: '1.5px solid #B2811A',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '17px', fontWeight: 800, color: '#0F2B48' }}>
                    {discoveryData.researcher.full_name.startsWith('Dr.') || discoveryData.researcher.full_name.startsWith('Prof.')
                      ? discoveryData.researcher.full_name
                      : `Dr. ${discoveryData.researcher.full_name}`}
                  </span>
                  <Badge variant="teal">SAMIKSHA Verified</Badge>
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '3px' }}>
                  {discoveryData.researcher.department || 'Academic Faculty'} • {discoveryData.researcher.institutional_affiliation || 'CSJMU'}
                </div>
                <div style={{ fontSize: '11px', color: '#B2811A', fontWeight: 700, marginTop: '4px' }}>
                  Scopus Author ID: {discoveryData.researcher.scopus_id}
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={handleResetDiscovery}>
                Change Scopus ID
              </Button>
            </div>

            {/* Category Selection Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', gap: '16px' }}>
              <button
                type="button"
                onClick={() => setActiveCategory('RESEARCH_WORK')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeCategory === 'RESEARCH_WORK' ? '3px solid #0F2B48' : '3px solid transparent',
                  padding: '10px 16px',
                  color: activeCategory === 'RESEARCH_WORK' ? '#0F2B48' : '#64748B',
                  fontWeight: activeCategory === 'RESEARCH_WORK' ? 700 : 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '-2px',
                }}
              >
                <span>📚</span>
                <span>Research Work Certificates</span>
                <span style={{ background: activeCategory === 'RESEARCH_WORK' ? '#0F2B48' : '#E2E8F0', color: activeCategory === 'RESEARCH_WORK' ? '#FFFFFF' : '#475569', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  {discoveryData.research_certificates.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('INCENTIVE')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeCategory === 'INCENTIVE' ? '3px solid #B2811A' : '3px solid transparent',
                  padding: '10px 16px',
                  color: activeCategory === 'INCENTIVE' ? '#B2811A' : '#64748B',
                  fontWeight: activeCategory === 'INCENTIVE' ? 700 : 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '-2px',
                }}
              >
                <span>🏆</span>
                <span>Incentive Certificates</span>
                <span style={{ background: activeCategory === 'INCENTIVE' ? '#B2811A' : '#E2E8F0', color: activeCategory === 'INCENTIVE' ? '#FFFFFF' : '#475569', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  {discoveryData.incentive_certificates.length}
                </span>
              </button>
            </div>

            {/* Inline Download Error Banner */}
            {downloadError && (
              <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#991B1B', fontSize: '13px' }}>
                ⚠️ {downloadError}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 1: RESEARCH WORK CERTIFICATES                        */}
            {/* ------------------------------------------------------------- */}
            {activeCategory === 'RESEARCH_WORK' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {discoveryData.research_certificates.length === 0 ? (
                  <EmptyState
                    title="No Research Work Certificates Found"
                    description="No research felicitations or publication recognition certificates have been formally issued for this Scopus ID in SAMIKSHA."
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {discoveryData.research_certificates.map((cert) => {
                      const isValid = cert.status === 'ISSUED' && !cert.is_revoked;
                      return (
                        <div
                          key={cert.id}
                          style={{
                            border: cert.is_revoked ? '1.5px solid #DC2626' : cert.status === 'SUPERSEDED' ? '1.5px solid #8B5CF6' : '1.5px solid #CBD5E1',
                            borderRadius: '12px',
                            padding: '18px',
                            background: '#FFFFFF',
                            boxShadow: '0 2px 8px rgba(15, 43, 72, 0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '14px',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                              <Badge variant={cert.is_revoked ? 'saffron' : cert.status === 'SUPERSEDED' ? 'neutral' : 'teal'}>
                                {cert.is_revoked ? 'REVOKED' : cert.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'VALID & AUTHENTIC'}
                              </Badge>
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                                {cert.issue_date || 'Issued'}
                              </span>
                            </div>

                            <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F2B48', lineHeight: 1.35 }}>
                              {cert.title}
                            </div>
                            <div style={{ fontSize: '11.5px', fontFamily: 'monospace', color: '#B2811A', fontWeight: 700, marginTop: '4px' }}>
                              {cert.certificate_number}
                            </div>

                            {cert.publication_title && (
                              <div style={{ fontSize: '12.5px', color: '#475569', fontStyle: 'italic', marginTop: '8px', lineHeight: 1.4 }}>
                                "{cert.publication_title}"
                              </div>
                            )}

                            {cert.is_revoked && (
                              <div style={{ fontSize: '11.5px', color: '#991B1B', marginTop: '8px', background: '#FEF2F2', padding: '6px 10px', borderRadius: '6px' }}>
                                Reason: {cert.revocation_reason || 'Officially revoked by university.'}
                              </div>
                            )}
                            {cert.status === 'SUPERSEDED' && (
                              <div style={{ fontSize: '11.5px', color: '#5B21B6', marginTop: '8px', background: '#FAF5FF', padding: '6px 10px', borderRadius: '6px' }}>
                                Notice: Superseded by reissued certificate.
                              </div>
                            )}
                          </div>

                          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <a
                              href={cert.verification_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: '12px', color: '#0D766E', fontWeight: 600, textDecoration: 'none' }}
                            >
                              Verify Online &rarr;
                            </a>

                            {isValid ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleDownloadDiscoveredPdf(cert)}
                                disabled={downloadingCertId === cert.id}
                                style={{ backgroundColor: '#B2811A', borderColor: '#B2811A' }}
                              >
                                {downloadingCertId === cert.id ? 'Streaming PDF...' : 'Download PDF ↓'}
                              </Button>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                                Download Disabled
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 2: INCENTIVE CERTIFICATES                            */}
            {/* ------------------------------------------------------------- */}
            {activeCategory === 'INCENTIVE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {discoveryData.incentive_certificates.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {discoveryData.incentive_certificates.map((cert) => (
                      <div
                        key={cert.id}
                        style={{
                          border: '1.5px solid #CBD5E1',
                          borderRadius: '12px',
                          padding: '18px',
                          background: '#FFFFFF',
                          boxShadow: '0 2px 8px rgba(15, 43, 72, 0.04)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '14px',
                        }}
                      >
                        <div>
                          <Badge variant="gold">INCENTIVE AWARD</Badge>
                          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F2B48', marginTop: '8px' }}>
                            {cert.title}
                          </div>
                          <div style={{ fontSize: '11.5px', fontFamily: 'monospace', color: '#B2811A', fontWeight: 700, marginTop: '4px' }}>
                            {cert.certificate_number}
                          </div>
                          {cert.publication_title && (
                            <div style={{ fontSize: '12.5px', color: '#475569', fontStyle: 'italic', marginTop: '8px' }}>
                              "{cert.publication_title}"
                            </div>
                          )}
                        </div>
                        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleDownloadDiscoveredPdf(cert)}
                            disabled={downloadingCertId === cert.id}
                            style={{ backgroundColor: '#B2811A', borderColor: '#B2811A' }}
                          >
                            {downloadingCertId === cert.id ? 'Streaming PDF...' : 'Download PDF ↓'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Honest Institutional Audit Gap Report (No Fake Certificates) */
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1.5px dashed #CBD5E1',
                      borderRadius: '12px',
                      padding: '28px 24px',
                      textAlign: 'center',
                      maxWidth: '640px',
                      margin: '0 auto',
                      width: '100%',
                    }}
                  >
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏛️</div>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0F2B48', margin: '0 0 6px 0' }}>
                      Research Publication Incentive Records Status
                    </h4>
                    <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                      {discoveryData.anudaan_incentives.message}
                    </p>

                    {discoveryData.anudaan_incentives.total_applications > 0 ? (
                      <div style={{ display: 'inline-flex', gap: '16px', background: '#FFFFFF', padding: '10px 18px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          Total Incentive Applications: <strong>{discoveryData.anudaan_incentives.total_applications}</strong>
                        </span>
                        <span style={{ fontSize: '12px', color: '#166534' }}>
                          Approved/Sanctioned: <strong>{discoveryData.anudaan_incentives.approved_count}</strong>
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        No research publication incentive application records on file for this Scopus ID.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* SECTION B: PUBLIC CERTIFICATE VERIFICATION (NUMBER & QR CODE)       */}
      {/* =================================================================== */}
      <div
        id="certificate-verification"
        className="samiksha-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          padding: '32px',
          border: '1.5px solid #E2E8F0',
          borderRadius: '16px',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 4px 20px rgba(15, 43, 72, 0.04)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#0D766E',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '6px',
            }}
          >
            <span>🛡️</span>
            <span>Cryptographic University Verification</span>
          </div>
          <SectionHeading
            align="center"
            eyebrow=""
            title="Verify Felicitation Certificate"
            description="Verify the authenticity of any certificate issued by Chhatrapati Shahu Ji Maharaj University, Kanpur."
          />
        </div>

        {/* Verification Methods Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          {/* Method A: Certificate Number Search */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', marginBottom: '4px' }}>
                Method A: Certificate Number
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                Enter the formal registration serial printed on the lower left of the certificate.
              </div>

              <form onSubmit={onVerifyCertificate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Input
                  placeholder="Enter Certificate Number (e.g. CERTIFICATES FINAL-1, 01-01)..."
                  value={certQuery}
                  onChange={(e) => onCertQueryChange(e.target.value)}
                  aria-label="Certificate Registration Number"
                />
                <Button variant="primary" type="submit" disabled={certLoading || !certQuery.trim()}>
                  {certLoading ? 'Verifying...' : 'Verify Authenticity'}
                </Button>
              </form>
            </div>
          </div>

          {/* Method B: Instant QR Code Scan */}
          <div style={{ background: '#FAF7F0', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', marginBottom: '4px' }}>
                Method B: Instant QR Code Scan
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                Every issued certificate features a secure cryptographic QR seal for instant smartphone verification.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '28px' }}>📱</span>
                <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.4 }}>
                  Scan the QR seal on the physical or PDF certificate with any smartphone camera to open the authentic verification portal.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Error */}
        {certError && (
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              width: '100%',
              padding: '16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#991b1b',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AppIcon name="alert-circle" size={18} color="#991b1b" />
            <div>
              <strong>Verification Result:</strong> {certError}
            </div>
          </div>
        )}

        {/* Verification Result Card */}
        {certResult && (
          <div
            className={`samiksha-cert-box ${certResult.is_revoked ? 'is-revoked' : ''}`}
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              width: '100%',
            }}
          >
            <div className="samiksha-cert-watermark" aria-hidden="true">
              {certResult.is_revoked ? '\u2717' : '\u2713'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                    Certificate Registration Number
                  </div>
                  <Badge variant={certResult.certificate_type === 'INCENTIVE_AWARD' ? 'saffron' : 'teal'}>
                    {certResult.certificate_type === 'INCENTIVE_AWARD' ? 'Incentive Award Certificate' : 'Research Work Certificate'}
                  </Badge>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f2b48', fontFamily: 'monospace', marginTop: '2px' }}>
                  {certResult.certificate_number}
                </div>
              </div>
              <Badge variant={certResult.is_revoked || certResult.status === 'REVOKED' ? 'saffron' : certResult.status === 'SUPERSEDED' ? 'neutral' : 'teal'}>
                {certResult.is_revoked || certResult.status === 'REVOKED' ? 'REVOKED' : certResult.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'VALID & AUTHENTIC'}
              </Badge>
            </div>

            {certResult.is_revoked || certResult.status === 'REVOKED' ? (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  background: '#fef2f2',
                  borderRadius: '10px',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                <strong>Revocation Notice:</strong> This certificate was officially revoked on{' '}
                {certResult.revoked_at ? new Date(certResult.revoked_at).toLocaleDateString() : 'record'}.
                Reason: {certResult.revocation_reason || 'Administrative notice'}.
              </div>
            ) : certResult.status === 'SUPERSEDED' ? (
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px 18px',
                  background: '#faf5ff',
                  borderRadius: '10px',
                  border: '1px solid #ddd6fe',
                  color: '#5b21b6',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                  Notice: Certificate Superseded
                </div>
                <div>
                  This certificate document has been formally superseded by an updated reissuance.
                  {certResult.reissued_reason && ` Reason: ${certResult.reissued_reason}.`}
                </div>
                {certResult.replacement_certificate && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a
                      href={certResult.replacement_certificate.verification_url}
                      style={{
                        color: '#6d28d9',
                        fontWeight: 700,
                        textDecoration: 'underline',
                      }}
                    >
                      View Replacement Certificate ({certResult.replacement_certificate.certificate_number}) &rarr;
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13.5px', color: '#334155', marginTop: '16px' }}>
                {certResult.authors && certResult.authors.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ color: '#0f2b48', minWidth: '150px' }}>Awarded Scholars ({certResult.authors.length}):</strong>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {certResult.authors.map((a, i) => (
                        <span key={i} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                          <strong>{a.author_name}</strong>
                          {a.scopus_id && <span style={{ color: '#b45309', marginLeft: '4px', fontWeight: 600 }}>[Scopus: {a.scopus_id}]</span>}
                          {a.department && <span style={{ color: '#64748b', marginLeft: '4px' }}>({a.department})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : certResult.author ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ color: '#0f2b48', minWidth: '150px' }}>Awarded Researcher:</strong>
                    <span>
                      {certResult.author.full_name} ({certResult.author.department || 'CSJMU'})
                      {certResult.author.scopus_id && <span style={{ color: '#b45309', marginLeft: '6px', fontWeight: 600 }}>[Scopus: {certResult.author.scopus_id}]</span>}
                    </span>
                  </div>
                ) : null}

                {(certResult.research_title || certResult.publication?.title) && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ color: '#0f2b48', minWidth: '150px' }}>Research Work:</strong>
                    <span style={{ fontStyle: 'italic', fontWeight: 600, color: '#0f2b48' }}>
                      "{certResult.research_title || certResult.publication?.title}"
                    </span>
                  </div>
                )}
                {certResult.bulletin && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ color: '#0f2b48', minWidth: '150px' }}>Bulletin Citation:</strong>
                    <span>
                      CSJMU RESEARCH BULLETIN • VOLUME {certResult.bulletin.volume_number} • ISSUE {certResult.bulletin.issue_number} ({certResult.bulletin.publication_period})
                    </span>
                  </div>
                )}
                {certResult.certificate_type === 'INCENTIVE_AWARD' && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginTop: '4px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Incentive Sanction Particulars
                    </div>
                    {certResult.publication_details?.incentive_amount && (
                      <div style={{ fontSize: '13px', color: '#92400e', fontWeight: 700 }}>
                        Sanctioned Amount: ₹ {Number(certResult.publication_details.incentive_amount).toLocaleString('en-IN')}
                      </div>
                    )}
                    {certResult.publication_details?.sanction_order_ref && (
                      <div style={{ fontSize: '12px', color: '#78350f', fontFamily: 'monospace', marginTop: '2px' }}>
                        Sanction Order Ref: {certResult.publication_details.sanction_order_ref}
                      </div>
                    )}
                  </div>
                )}
                {certResult.issued_at && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ color: '#0f2b48', minWidth: '150px' }}>Date of Issuance:</strong>
                    <span>{new Date(certResult.issued_at).toLocaleDateString()}</span>
                  </div>
                )}

                <div
                  style={{
                    wordBreak: 'break-all',
                    fontSize: '11px',
                    color: '#64748b',
                    fontFamily: 'monospace',
                    background: '#f8fafc',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    marginTop: '4px',
                  }}
                >
                  <strong style={{ color: '#0f2b48' }}>SHA-256 Digest:</strong> {certResult.sha256_checksum}
                </div>

                {certResult.is_download_allowed && (
                  <div style={{ paddingTop: '8px' }}>
                    <Button variant="teal" onClick={onDownloadCertificate}>
                      Download Certificate Copy &darr;
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 3. Felicitation Recognition Gallery (Preserved)                     */}
      {/* =================================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="samiksha-eyebrow">
              <AppIcon name="shield" size={13} color="#0d766e" />
              <span>Institutional Honor Roll</span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2b48', margin: 0 }}>
              Recognised Research Contributions Gallery
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Scholarly achievements felicitated by the Directorate of Research and documented in University Bulletins.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '180px' }}>
              <Input
                placeholder="Search gallery..."
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
                aria-label="Search Felicitation Gallery"
              />
            </div>
            {categories.length > 0 && (
              <Select
                value={galleryCategory}
                onChange={(e) => setGalleryCategory(e.target.value)}
                options={[{ label: 'All Categories', value: '' }, ...categories.map((c) => ({ label: c, value: c }))]}
                aria-label="Filter by Research Category"
              />
            )}
            <Select
              value={gallerySort}
              onChange={(e) => setGallerySort(e.target.value as 'newest' | 'oldest')}
              options={[
                { label: 'Newest First', value: 'newest' },
                { label: 'Oldest First', value: 'oldest' },
              ]}
              aria-label="Sort Order"
            />
          </div>
        </div>

        {filteredGallery.length === 0 ? (
          <EmptyState
            title="No Felicitated Publications Found"
            description={
              gallerySearch || galleryCategory
                ? 'No recognized publications matched your current filter criteria.'
                : 'Felicitated research articles published in official University Bulletins will appear here.'
            }
          />
        ) : (
          <div className="samiksha-pub-grid">
            {filteredGallery.map((pub) => (
              <div
                key={pub.id}
                className="samiksha-pub-card"
                onClick={() => setSelectedRecord(pub)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedRecord(pub);
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                  <span className="samiksha-pub-category">{pub.category}</span>
                  {pub.is_featured && <Badge variant="gold">Institutional Spotlight</Badge>}
                </div>

                <h4 className="samiksha-pub-title">{pub.title}</h4>

                <div className="samiksha-pub-authors">{pub.author_display}</div>

                <div className="samiksha-pub-journal">
                  {pub.source_journal}
                  {pub.doi && (
                    <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      DOI: {pub.doi}
                    </span>
                  )}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#0d766e', fontWeight: 600 }}>View Details &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal for Selected Felicitated Publication */}
      {selectedRecord && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 19, 37, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '640px',
              width: '100%',
              padding: '28px 32px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <span className="samiksha-pub-category">
                  Institutional Felicitation Record #{selectedRecord.serial_no} • {selectedRecord.category}
                </span>
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#0f2b48',
                    margin: '8px 0 0 0',
                    lineHeight: 1.35,
                  }}
                >
                  {selectedRecord.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                }}
                aria-label="Close details"
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', color: '#334155' }}>
              <div>
                <strong>Awarded Author(s):</strong> {selectedRecord.author_display}
              </div>
              {selectedRecord.author_links && selectedRecord.author_links.length > 0 && (
                <div>
                  <strong>Institutional Affiliation:</strong>{' '}
                  {selectedRecord.author_links.map((al) => `${al.author_name || 'Scholar'} (${al.department || 'CSJMU'})`).join(', ')}
                </div>
              )}
              <div>
                <strong>Indexed Journal:</strong> {selectedRecord.source_journal}
              </div>
              {selectedRecord.doi && (
                <div>
                  <strong>DOI:</strong>{' '}
                  <a
                    href={`https://doi.org/${selectedRecord.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0d766e', fontWeight: 600 }}
                  >
                    {selectedRecord.doi}
                  </a>
                </div>
              )}
              {selectedRecord.published_at && (
                <div>
                  <strong>Felicitation Date:</strong> {new Date(selectedRecord.published_at).toLocaleDateString()}
                </div>
              )}
              {selectedRecord.abstract && (
                <div style={{ marginTop: '8px' }}>
                  <strong>Abstract:</strong>
                  <p style={{ margin: '6px 0 0 0', lineHeight: 1.6, color: '#64748b' }}>
                    {selectedRecord.abstract}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Verify Certificate Prompt */}
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f2b48' }}>
                  Hold a printed certificate for this research?
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Verify the printed certificate number using the official cryptographic validator above.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRecord(null);
                  const el = document.getElementById('certificate-verification');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Verify in Tool &uarr;
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SamikshaFelicitationTab;
