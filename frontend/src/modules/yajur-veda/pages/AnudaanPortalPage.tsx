import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Input, Select, PageContainer } from '@vyasa/ui';
import { anudaanService } from '../services/anudaanService';
import {
  getDraftSession,
  saveDraftSession,
  clearDraftSession,
  AnudaanSessionCredentials,
} from '../services/anudaanSession';
import {
  AnudaanApplicantCategory,
  AnudaanDraftCreationResponse,
  AnudaanPublicImpactStats,
  AnudaanGalleryItemOut,
  AnudaanPublicConfigOut,
  AnudaanPublicSanctionOut,
} from '../types/anudaan';
import './AnudaanPortalPage.css';

export const AnudaanPortalPage: React.FC = () => {
  const navigate = useNavigate();

  // Active Session State
  const [activeSession, setActiveSession] = useState<AnudaanSessionCredentials | null>(null);

  // Modal Dialog States
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);

  // New Application Form State
  const [applicantCategory, setApplicantCategory] = useState<AnudaanApplicantCategory>('FACULTY_CAMPUS');
  const [fullName, setFullName] = useState('');
  const [institutionalId, setInstitutionalId] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [scopusAuthorId, setScopusAuthorId] = useState('');
  const [scopusProfileUrl, setScopusProfileUrl] = useState('');

  // Draft Creation Output
  const [createdDraft, setCreatedDraft] = useState<AnudaanDraftCreationResponse | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Resume Form State
  const [resumeAppId, setResumeAppId] = useState('');
  const [resumeSecret, setResumeSecret] = useState('');
  const [resumeSuccessMsg, setResumeSuccessMsg] = useState<string | null>(null);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // =========================================================================
  // Section B & C: Public Display Config, Impact Stats & Gallery
  // =========================================================================
  const [publicConfig, setPublicConfig] = useState<AnudaanPublicConfigOut>({
    impact_section_enabled: true,
    gallery_section_enabled: true,
    active_academic_year: null,
    custom_banner_note: null,
  });

  // Impact Dashboard State
  const [impactStats, setImpactStats] = useState<AnudaanPublicImpactStats | null>(null);
  const [impactLoading, setImpactLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');

  // Recognition Gallery State
  const [galleryItems, setGalleryItems] = useState<AnudaanGalleryItemOut[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryYear, setGalleryYear] = useState<string>('ALL');

  // Public Sanctions Register State
  const [publicSanctions, setPublicSanctions] = useState<AnudaanPublicSanctionOut[]>([]);
  const [sanctionsLoading, setSanctionsLoading] = useState(true);
  const [sanctionQuartile, setSanctionQuartile] = useState<string>('ALL');

  // Lightbox State
  const [activeLightboxItem, setActiveLightboxItem] = useState<AnudaanGalleryItemOut | null>(null);
  const [lightboxActiveIndex, setLightboxActiveIndex] = useState(0);

  // Fetch Public Configuration
  useEffect(() => {
    setActiveSession(getDraftSession());

    anudaanService.getPublicConfig()
      .then((res) => {
        if (res.success && res.data) {
          setPublicConfig(res.data);
          if (res.data.active_academic_year) {
            setSelectedYear(res.data.active_academic_year);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load ANUDAAN public display configuration, using defaults.', err);
      });
  }, []);

  // Fetch Impact Stats
  const fetchImpactStats = useCallback(async () => {
    try {
      setImpactLoading(true);
      const res = await anudaanService.getPublicImpactStats(selectedYear === 'ALL' ? undefined : selectedYear);
      if (res.success && res.data) {
        setImpactStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load institutional impact stats:', err);
    } finally {
      setImpactLoading(false);
    }
  }, [selectedYear]);

  // Fetch Recognition Gallery
  const fetchGallery = useCallback(async () => {
    try {
      setGalleryLoading(true);
      const res = await anudaanService.getPublicGallery({
        academic_year: galleryYear === 'ALL' ? undefined : galleryYear,
        limit: 20,
      });
      if (res.success && res.data) {
        setGalleryItems(res.data.items);
      }
    } catch (err) {
      console.error('Failed to load recognition gallery:', err);
    } finally {
      setGalleryLoading(false);
    }
  }, [galleryYear]);

  // Fetch Public Sanctions Register
  const fetchPublicSanctions = useCallback(async () => {
    try {
      setSanctionsLoading(true);
      const res = await anudaanService.getPublicSanctions({
        academic_year: selectedYear === 'ALL' ? undefined : selectedYear,
        quartile: sanctionQuartile === 'ALL' ? undefined : sanctionQuartile,
        limit: 50,
      });
      if (res.success && res.data) {
        setPublicSanctions(res.data.items);
      }
    } catch (err) {
      console.error('Failed to load public sanctions register:', err);
    } finally {
      setSanctionsLoading(false);
    }
  }, [selectedYear, sanctionQuartile]);

  useEffect(() => {
    if (publicConfig.impact_section_enabled) {
      fetchImpactStats();
      fetchPublicSanctions();
    }
  }, [fetchImpactStats, fetchPublicSanctions, publicConfig.impact_section_enabled]);

  useEffect(() => {
    if (publicConfig.gallery_section_enabled) {
      fetchGallery();
    }
  }, [fetchGallery, publicConfig.gallery_section_enabled]);

  // Handlers for Section A (Claims)
  const handleStartNewApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !institutionalId.trim() || !designation.trim() || !departmentName.trim() || !mobileNumber.trim()) {
      setErrorMsg('Please complete all mandatory profile fields (*).');
      return;
    }

    try {
      setLoading(true);
      const res = await anudaanService.createDraft({
        applicant_category: applicantCategory,
        full_name: fullName.trim(),
        institutional_id: institutionalId.trim(),
        designation: designation.trim(),
        department_name: departmentName.trim(),
        supervisor_name: applicantCategory !== 'FACULTY_CAMPUS' ? (supervisorName.trim() || null) : null,
        mobile_number: mobileNumber.trim(),
        scopus_author_id: scopusAuthorId.trim() || null,
        scopus_profile_url: scopusProfileUrl.trim() || null,
      });

      if (res.success && res.data) {
        setCreatedDraft(res.data);
        saveDraftSession({
          applicationId: res.data.application_id,
          applicationNumber: res.data.application_number,
          draftKey: res.data.tracking_secret,
        });
      } else {
        setErrorMsg(res.message || 'Failed to initialize draft application.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while initializing draft.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdDraft) return;
    const text = `CSJMU ANUDAAN APPLICATION CREDENTIALS\nApplication Number: ${createdDraft.application_number}\nTracking Secret: ${createdDraft.tracking_secret}\nApplication ID: ${createdDraft.application_id}`;
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 3000);
  };

  const handleResumeApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResumeSuccessMsg(null);

    if (!resumeAppId.trim() || !resumeSecret.trim()) {
      setErrorMsg('Please provide both your Application ID and Tracking Secret.');
      return;
    }

    try {
      setLoading(true);
      const res = await anudaanService.getDraft(resumeAppId.trim(), resumeSecret.trim());
      if (res.success && res.data) {
        saveDraftSession({
          applicationId: res.data.id,
          applicationNumber: res.data.application_number,
          draftKey: resumeSecret.trim(),
        });
        setActiveSession(getDraftSession());
        setResumeSuccessMsg(`Draft ${res.data.application_number} verified! Launching wizard...`);
        setTimeout(() => {
          setIsResumeModalOpen(false);
          navigate('/modules/yajur-veda/anudaan/apply');
        }, 1200);
      } else {
        setErrorMsg('Invalid Application ID or Tracking Secret combination.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not verify credentials. Please check your tracking secret.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    clearDraftSession();
    setActiveSession(null);
  };

  const scrollToGuidelines = () => {
    const el = document.getElementById('anudaan-guidelines');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Featured gallery item (first published item) vs supporting items
  const featuredGalleryItem = galleryItems.length > 0 ? galleryItems[0] : null;
  const supportingGalleryItems = galleryItems.length > 1 ? galleryItems.slice(1) : [];

  return (
    <PageContainer>
      <div className="anudaan-portal-container">
        {/* ================================================================= */}
        {/* 1. HERO — ANUDAAN INSTITUTIONAL IDENTITY */}
        {/* ================================================================= */}
        <div className="anudaan-hero">
          <div className="anudaan-hero__inner">
            <div className="anudaan-hero__eyebrow">
              <span>2nd Pillar • Yajur Veda • Research Governance &amp; Incentives</span>
            </div>

            <div className="anudaan-hero__identity">
              <h1 className="anudaan-hero__system-name">
                ANUDAAN
              </h1>
              <div className="anudaan-hero__system-sub">
                Research Publication Incentive Management System • ANUDAAN Research Incentive Portal
              </div>
            </div>

            <div className="anudaan-hero__headline">
              &ldquo;Recognising Research. Rewarding Excellence.&rdquo;
            </div>

            <p className="anudaan-hero__copy">
              An institutional initiative of Chhatrapati Shahu Ji Maharaj University, Kanpur,
              dedicated to recognising and encouraging high-impact scholarly contributions
              published in peer-reviewed journals indexed in Scopus and Web of Science.
            </p>

            <div className="anudaan-hero__actions">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setCreatedDraft(null);
                  setErrorMsg(null);
                  setIsStartModalOpen(true);
                }}
              >
                Apply for Incentive →
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/modules/yajur-veda/anudaan/track')}
              >
                Track Application
              </Button>
            </div>

            <div className="anudaan-hero__sub-action">
              Already started an application?{' '}
              <button
                type="button"
                className="anudaan-hero__sub-action-link"
                onClick={() => {
                  setErrorMsg(null);
                  setResumeSuccessMsg(null);
                  setIsResumeModalOpen(true);
                }}
              >
                Resume Existing Application
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* ACTIVE DRAFT SESSION BANNER (if present in sessionStorage) */}
        {/* ================================================================= */}
        {activeSession && (
          <div className="anudaan-active-session-banner">
            <div className="anudaan-active-session-info">
              <div className="anudaan-active-session-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div>
                <strong style={{ color: '#92400E', fontSize: '0.95rem' }}>Active Draft Session Detected:</strong>{' '}
                <span style={{ color: '#78350F', fontWeight: 600 }}>{activeSession.applicationNumber}</span>
                <div style={{ fontSize: '0.8rem', color: '#92400E' }}>
                  Your draft key is active in this browser tab.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/modules/yajur-veda/anudaan/apply')}
              >
                Resume Active Draft →
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSession}
              >
                Clear Session
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION A: INCENTIVE CLAIMS & TRACKING */}
        {/* ================================================================= */}
        <div style={{ marginBottom: 56 }}>
          <div className="anudaan-section-header">
            <div className="anudaan-section-title-wrap">
              <div className="anudaan-section-badge-icon anudaan-section-badge-icon--claims">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div>
                <h2 className="anudaan-section-title">
                  Section A: Incentive Claims &amp; Tracking
                </h2>
                <p className="anudaan-section-subtitle">
                  Initiate a new publication incentive claim, retrieve saved drafts, or query real-time processing status.
                </p>
              </div>
            </div>
          </div>

          <div className="anudaan-claims-grid">
            {/* Card 1: Primary New Incentive Claim */}
            <div className="anudaan-action-card anudaan-action-card--primary">
              <span className="anudaan-action-card__badge-top">Primary Intake</span>
              <div>
                <div className="anudaan-action-card__icon-box anudaan-action-card__icon-box--gold">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <h3 className="anudaan-action-card__title">
                  New Incentive Claim
                </h3>
                <p className="anudaan-action-card__desc">
                  Initiate a formal research publication incentive claim for articles or reviews published on or after January 1, 2026.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setCreatedDraft(null);
                  setErrorMsg(null);
                  setIsStartModalOpen(true);
                }}
                style={{ width: '100%' }}
              >
                Start New Application
              </Button>
            </div>

            {/* Card 2: Resume Draft */}
            <div className="anudaan-action-card">
              <div>
                <div className="anudaan-action-card__icon-box anudaan-action-card__icon-box--blue">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                </div>
                <h3 className="anudaan-action-card__title">
                  Resume Application
                </h3>
                <p className="anudaan-action-card__desc">
                  Continue a previously saved draft using your institutional Application ID and confidential Tracking Secret.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setErrorMsg(null);
                  setResumeSuccessMsg(null);
                  setIsResumeModalOpen(true);
                }}
                style={{ width: '100%' }}
              >
                Resume Draft
              </Button>
            </div>

            {/* Card 3: Track Status */}
            <div className="anudaan-action-card">
              <div>
                <div className="anudaan-action-card__icon-box anudaan-action-card__icon-box--teal">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3 className="anudaan-action-card__title">
                  Track Application
                </h3>
                <p className="anudaan-action-card__desc">
                  Check evaluation progress, administrative review stages, and approval status in real time.
                </p>
              </div>
              <Button
                variant="teal"
                onClick={() => navigate('/modules/yajur-veda/anudaan/track')}
                style={{ width: '100%' }}
              >
                Track Status
              </Button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECTION B: INSTITUTIONAL INCENTIVE SANCTION REGISTER */}
        {/* ================================================================= */}
        {publicConfig.impact_section_enabled && (
          <div className="anudaan-impact-section" id="section-b">
            <div className="anudaan-section-header">
              <div className="anudaan-section-title-wrap">
                <div className="anudaan-section-badge-icon anudaan-section-badge-icon--impact">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <div>
                  <h2 className="anudaan-section-title">
                    Section B: Institutional Incentive Sanction Register
                  </h2>
                  <p className="anudaan-section-subtitle">
                    Official research publication incentive sanctions awarded across university departments.
                  </p>
                </div>
              </div>

              {/* Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Academic Year:</span>
                <select
                  className="anudaan-filter-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  <option value="ALL">All Periods (Consolidated)</option>
                  {(impactStats?.academic_years_available || ['2026-2027', '2025-2026']).map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Statutory Institutional Note */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderLeft: '4px solid #0B2545',
                borderRadius: 8,
                padding: '12px 18px',
                marginBottom: 20,
                fontSize: '0.85rem',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B2545" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                <strong>Institutional Note:</strong> Figures represent institutional incentive sanctions and do not independently confirm bank payment or credit.
              </span>
            </div>

            {/* Custom Advisory Banner if configured */}
            {publicConfig.custom_banner_note && (
              <div
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  borderLeft: '4px solid #B45309',
                  borderRadius: 8,
                  padding: '12px 18px',
                  marginBottom: 20,
                  fontSize: '0.875rem',
                  color: '#92400E',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>{publicConfig.custom_banner_note}</span>
              </div>
            )}

            {/* Stats Cards Grid */}
            <div className="anudaan-impact-grid">
              {/* Stat 1: Researchers Recognised */}
              <div className="anudaan-stat-card">
                <div>
                  <div className="anudaan-stat-card__label" style={{ color: '#2563EB' }}>
                    <span>Researchers Recognised</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="anudaan-stat-card__value" style={{ color: '#1E40AF' }}>
                    {impactLoading ? '...' : impactStats?.total_researchers_recognised ?? 0}
                  </div>
                </div>
                <div className="anudaan-stat-card__foot">Distinct university scholars</div>
              </div>

              {/* Stat 2: Total Incentive Amount Sanctioned */}
              <div className="anudaan-stat-card anudaan-stat-card--disbursed">
                <div>
                  <div className="anudaan-stat-card__label" style={{ color: '#047857' }}>
                    <span>Amount Sanctioned</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                  <div className="anudaan-stat-card__value anudaan-stat-card__value--approved">
                    ₹ {impactLoading ? '...' : Number(impactStats?.total_incentive_sanctioned_inr ?? 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="anudaan-stat-card__foot">
                  <span className="anudaan-stat-card__badge anudaan-stat-card__badge--verified">
                    ✓ Official University Sanctions
                  </span>
                </div>
              </div>

              {/* Stat 3: Total Sanction Entries */}
              <div className="anudaan-stat-card">
                <div>
                  <div className="anudaan-stat-card__label" style={{ color: '#475569' }}>
                    <span>Sanction Entries</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    </svg>
                  </div>
                  <div className="anudaan-stat-card__value">
                    {impactLoading ? '...' : impactStats?.total_sanction_entries ?? 0}
                  </div>
                </div>
                <div className="anudaan-stat-card__foot">Published award records</div>
              </div>

              {/* Stat 4: Quartile Distribution */}
              <div className="anudaan-stat-card">
                <div>
                  <div className="anudaan-stat-card__label" style={{ color: '#B45309' }}>
                    <span>Quartile Tiers</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                      <span
                        key={q}
                        style={{
                          backgroundColor: q === 'Q1' ? '#ECFDF5' : q === 'Q2' ? '#EFF6FF' : q === 'Q3' ? '#FEF3C7' : '#F1F5F9',
                          color: q === 'Q1' ? '#047857' : q === 'Q2' ? '#1D4ED8' : q === 'Q3' ? '#B45309' : '#475569',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}
                      >
                        {q}: {impactStats?.quartile_breakdown?.[q] ?? 0}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="anudaan-stat-card__foot">Scopus &amp; WoS tiers</div>
              </div>
            </div>

            {/* Public Sanctions Register Table */}
            <div style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0B2545', margin: 0 }}>
                    Published Sanctions Register
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: 2 }}>
                    Public directory of officially sanctioned research incentive awards.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Filter by Quartile:</span>
                  <select
                    className="anudaan-filter-select"
                    value={sanctionQuartile}
                    onChange={(e) => setSanctionQuartile(e.target.value)}
                  >
                    <option value="ALL">All Quartiles</option>
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                {sanctionsLoading ? (
                  <div style={{ padding: '36px 0', textAlign: 'center', color: '#64748B' }}>
                    Loading sanctions register...
                  </div>
                ) : publicSanctions.length === 0 ? (
                  <div style={{ padding: '36px 0', textAlign: 'center', color: '#64748B' }}>
                    No published incentive sanctions found for this selection.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Researcher</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Department</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Publication Title</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Quartile</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Sanctioned (INR)</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Academic Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {publicSanctions.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0B2545' }}>
                              {entry.researcher_name}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#475569' }}>
                              {entry.department_name}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#1E293B', maxWidth: 360, lineHeight: 1.4 }}>
                              {entry.publication_title}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  backgroundColor:
                                    entry.quartile === 'Q1' ? '#ECFDF5' : entry.quartile === 'Q2' ? '#EFF6FF' : entry.quartile === 'Q3' ? '#FEF3C7' : '#F1F5F9',
                                  color:
                                    entry.quartile === 'Q1' ? '#047857' : entry.quartile === 'Q2' ? '#1D4ED8' : entry.quartile === 'Q3' ? '#B45309' : '#475569',
                                }}
                              >
                                {entry.quartile}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                              ₹ {Number(entry.sanctioned_amount).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>
                              {entry.academic_year}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION C: RESEARCHER RECOGNITION & CEREMONY GALLERY */}
        {/* ================================================================= */}
        {publicConfig.gallery_section_enabled && (
          <div className="anudaan-gallery-section">
            <div className="anudaan-section-header">
              <div className="anudaan-section-title-wrap">
                <div className="anudaan-section-badge-icon anudaan-section-badge-icon--gallery">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <div>
                  <h2 className="anudaan-section-title">
                    Section C: Researcher Recognition &amp; Distribution Gallery
                  </h2>
                  <div style={{ fontFamily: 'var(--font-heading, "Cinzel", serif)', fontSize: '1.15rem', color: '#B45309', fontWeight: 600, marginTop: 2 }}>
                    Celebrating Research Excellence
                  </div>
                  <p className="anudaan-section-subtitle">
                    Recognising the scholars and research contributions advancing institutional excellence.
                  </p>
                </div>
              </div>

              {/* Year Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Academic Year:</span>
                <select
                  className="anudaan-filter-select"
                  value={galleryYear}
                  onChange={(e) => setGalleryYear(e.target.value)}
                >
                  <option value="ALL">All Academic Years</option>
                  <option value="2026-2027">2026-2027</option>
                  <option value="2025-2026">2025-2026</option>
                </select>
              </div>
            </div>

            {/* Gallery Content */}
            {galleryLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
                Loading recognition gallery...
              </div>
            ) : galleryItems.length === 0 ? (
              /* Premium Institutional Empty State */
              <div className="anudaan-empty-gallery">
                <div className="anudaan-empty-gallery__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0B2545', margin: '0 0 8px' }}>
                  Research Recognition Archive
                </h3>
                <p style={{ color: '#64748B', maxWidth: 540, margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Official photographs and proceedings from university research incentive distribution ceremonies
                  will be published here following institutional release.
                </p>
              </div>
            ) : (
              <div>
                {/* 1. Featured Ceremony Card */}
                {featuredGalleryItem && (
                  <div className="anudaan-featured-gallery-card">
                    {/* Featured Image */}
                    <div
                      className="anudaan-featured-img-wrap"
                      onClick={() => {
                        if (featuredGalleryItem.images.length > 0) {
                          setActiveLightboxItem(featuredGalleryItem);
                          setLightboxActiveIndex(0);
                        }
                      }}
                    >
                      {featuredGalleryItem.images.length > 0 ? (
                        <img
                          src={anudaanService.getGalleryImageUrl(
                            featuredGalleryItem.images.find((img) => img.is_cover)?.id || featuredGalleryItem.images[0].id
                          )}
                          alt={featuredGalleryItem.images[0].caption || featuredGalleryItem.title}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>
                          Official Ceremony Photograph
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
                        <span style={{ backgroundColor: '#B45309', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>
                          ★ Featured Ceremony
                        </span>
                        {featuredGalleryItem.images.length > 0 && (
                          <span style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>
                            📷 {featuredGalleryItem.images.length} Photos
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Featured Text Content */}
                    <div className="anudaan-featured-content">
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#B45309', fontWeight: 600, marginBottom: 8 }}>
                          <span>{featuredGalleryItem.event_name}</span>
                          <span>{featuredGalleryItem.event_date} ({featuredGalleryItem.academic_year})</span>
                        </div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0B2545', margin: '0 0 12px', lineHeight: 1.35 }}>
                          {featuredGalleryItem.title}
                        </h3>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 20px' }}>
                          {featuredGalleryItem.description}
                        </p>
                      </div>

                      {featuredGalleryItem.researcher_name && (
                        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: 8, marginTop: 'auto' }}>
                          <div style={{ fontSize: '0.8rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                            Awarded Scholar
                          </div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0B2545', marginTop: 2 }}>
                            {featuredGalleryItem.researcher_name}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                            {featuredGalleryItem.researcher_designation || ''}{' '}
                            {featuredGalleryItem.department_name ? `• ${featuredGalleryItem.department_name}` : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Supporting Gallery Grid */}
                {supportingGalleryItems.length > 0 && (
                  <div className="anudaan-gallery-grid">
                    {supportingGalleryItems.map((item) => {
                      const coverImg = item.images.find((img) => img.is_cover) || item.images[0];
                      return (
                        <div key={item.id} className="anudaan-gallery-card">
                          <div
                            className="anudaan-gallery-thumb"
                            onClick={() => {
                              if (item.images.length > 0) {
                                setActiveLightboxItem(item);
                                setLightboxActiveIndex(0);
                              }
                            }}
                          >
                            {coverImg ? (
                              <img
                                src={anudaanService.getGalleryImageUrl(coverImg.id)}
                                alt={coverImg.caption || item.title}
                              />
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Ceremony Record</span>
                            )}
                            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                              {item.images.length > 0 && (
                                <span style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: 4 }}>
                                  📷 {item.images.length}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748B', marginBottom: 8 }}>
                                <span>{item.event_name}</span>
                                <span>{item.event_date}</span>
                              </div>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0B2545', margin: '0 0 8px', lineHeight: 1.4 }}>
                                {item.title}
                              </h3>
                              <p style={{ color: '#475569', fontSize: '0.875rem', margin: '0 0 16px', lineHeight: 1.5 }}>
                                {item.description}
                              </p>
                            </div>

                            {item.researcher_name && (
                              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1E293B' }}>
                                  {item.researcher_name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                  {item.researcher_designation || ''}{' '}
                                  {item.department_name ? `• ${item.department_name}` : ''}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 6. ELIGIBILITY & PUBLICATION GUIDELINES */}
        {/* ================================================================= */}
        <div id="anudaan-guidelines" className="anudaan-guidelines-section">
          <div className="anudaan-section-header">
            <div className="anudaan-section-title-wrap">
              <div className="anudaan-section-badge-icon anudaan-section-badge-icon--guidelines">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h2 className="anudaan-section-title">
                  Institutional Eligibility &amp; Governance
                </h2>
                <p className="anudaan-section-subtitle">
                  Approved policy criteria governing applicant categories, author roles, and publication indexing.
                </p>
              </div>
            </div>
          </div>

          <div className="anudaan-guidelines-grid">
            {/* Card 1: Applicant Eligibility */}
            <div className="anudaan-guideline-card">
              <div className="anudaan-guideline-card__head">
                <div className="anudaan-guideline-icon anudaan-guideline-icon--gold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0B2545', margin: 0 }}>
                  Institutional Eligibility Criteria
                </h3>
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#047857' }}>
                  Eligible Roles (Campus Community)
                </span>
              </div>

              <ul className="anudaan-guideline-list">
                <li className="anudaan-guideline-item">
                  <div className="anudaan-guideline-icon anudaan-guideline-icon--check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong>Currently Serving CSJMU Campus Faculty:</strong> Regular full-time professors, associate professors, and assistant professors appointed to university departments.
                  </div>
                </li>
                <li className="anudaan-guideline-item">
                  <div className="anudaan-guideline-icon anudaan-guideline-icon--check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong>Registered Research Scholars:</strong> Full-time or part-time Ph.D. scholars currently enrolled with active university registration numbers.
                  </div>
                </li>
                <li className="anudaan-guideline-item">
                  <div className="anudaan-guideline-icon anudaan-guideline-icon--check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong>Campus Post-Doctoral Researchers:</strong> Recognized post-docs, PDF fellows, and national research associates conducting research on campus.
                  </div>
                </li>
              </ul>

              <div className="anudaan-exclusion-box">
                <strong style={{ color: '#991B1B' }}>Exclusion Policy:</strong> Affiliated college faculty, retired personnel, alumni, and external honorary collaborators are non-payable under the university campus incentive budget.
              </div>
            </div>

            {/* Card 2: Publication Requirements */}
            <div className="anudaan-guideline-card">
              <div className="anudaan-guideline-card__head">
                <div className="anudaan-guideline-icon anudaan-guideline-icon--gold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0B2545', margin: 0 }}>
                  Publication Eligibility Requirements
                </h3>
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#B45309' }}>
                  Mandatory Validation Standards
                </span>
              </div>

              <ul className="anudaan-guideline-list">
                <li className="anudaan-guideline-item">
                  <div className="anudaan-guideline-icon anudaan-guideline-icon--check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong>Effective Publication Date:</strong> Must be published on or after <strong>January 1, 2026</strong>.
                  </div>
                </li>
                <li className="anudaan-guideline-item">
                  <div className="anudaan-guideline-icon anudaan-guideline-icon--check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong>Document Classification:</strong> Restricted exclusively to peer-reviewed <strong>Original Article</strong> or critical <strong>Review Paper</strong>.
                  </div>
                </li>
                <li className="anudaan-guideline-item">
                  <div className="anudaan-guideline-icon anudaan-guideline-icon--check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong>Indexing Standard:</strong> Indexed in <strong>Scopus</strong> and/or <strong>Web of Science (WoS)</strong>.
                  </div>
                </li>
                <li className="anudaan-guideline-item">
                  <div className="anudaan-guideline-icon anudaan-guideline-icon--check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong>Institutional Affiliation:</strong> Explicit affiliation with <em>Chhatrapati Shahu Ji Maharaj University, Kanpur</em>.
                  </div>
                </li>
                <li className="anudaan-guideline-item">
                  <div className="anudaan-guideline-icon anudaan-guideline-icon--check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong>Publication Status:</strong> Only fully <strong>PUBLISHED</strong> papers with final issue/volume or DOI assigned. In-press or accepted manuscripts must await final issue publication.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 7. FINAL APPLICATION CTA BANNER */}
        {/* ================================================================= */}
        <div className="anudaan-final-cta">
          <div className="anudaan-final-cta__content">
            <h2 className="anudaan-final-cta__title">
              Empowering Scholarly Discovery at CSJMU
            </h2>
            <p className="anudaan-final-cta__text">
              Have you published peer-reviewed research meeting the university incentive criteria?
              Submit your incentive claim now or consult the scheme guidelines.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setCreatedDraft(null);
                  setErrorMsg(null);
                  setIsStartModalOpen(true);
                }}
              >
                Apply for Incentive →
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={scrollToGuidelines}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.3)', color: '#FFFFFF' }}
              >
                Review Policy Guidelines
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL: LIGHTBOX IMAGE VIEWER */}
      {/* ================================================================= */}
      {activeLightboxItem && (
        <Modal
          isOpen={Boolean(activeLightboxItem)}
          onClose={() => setActiveLightboxItem(null)}
          title={activeLightboxItem.title}
        >
          <div>
            {activeLightboxItem.images.length > 0 ? (
              <div>
                <div style={{ backgroundColor: '#000000', borderRadius: 8, overflow: 'hidden', height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={anudaanService.getGalleryImageUrl(activeLightboxItem.images[lightboxActiveIndex].id)}
                    alt={activeLightboxItem.images[lightboxActiveIndex].caption || 'Ceremony photo'}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
                {activeLightboxItem.images[lightboxActiveIndex].caption && (
                  <div style={{ padding: '10px 0', fontSize: '0.875rem', color: '#475569', fontStyle: 'italic', textAlign: 'center' }}>
                    {activeLightboxItem.images[lightboxActiveIndex].caption}
                  </div>
                )}
                {/* Thumbnails row */}
                {activeLightboxItem.images.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 6 }}>
                    {activeLightboxItem.images.map((img, idx) => (
                      <img
                        key={img.id}
                        src={anudaanService.getGalleryImageUrl(img.id)}
                        alt="thumb"
                        onClick={() => setLightboxActiveIndex(idx)}
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: 'cover',
                          borderRadius: 4,
                          cursor: 'pointer',
                          border: idx === lightboxActiveIndex ? '2px solid #2563EB' : '1px solid #CBD5E1',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            <div style={{ marginTop: 16, borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
              <div style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: 4 }}>
                {activeLightboxItem.event_name} • {activeLightboxItem.event_date} ({activeLightboxItem.academic_year})
              </div>
              <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                {activeLightboxItem.description}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ================================================================= */}
      {/* MODAL 1: Start New Application */}
      {/* ================================================================= */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title={createdDraft ? 'Application Draft Initialized' : 'Start New ANUDAAN Application'}
      >
        <div style={{ padding: '8px 4px' }}>
          {errorMsg && (
            <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #F87171', color: '#B91C1C', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.9rem' }}>
              {errorMsg}
            </div>
          )}

          {createdDraft ? (
            <div>
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: 18, marginBottom: 20 }}>
                <p style={{ margin: '0 0 12px', color: '#166534', fontWeight: 600 }}>
                  ✓ Draft created successfully! Please save your confidential credentials below:
                </p>
                <div style={{ fontFamily: 'monospace', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 6, border: '1px solid #DCFCE7' }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: '#6B7280' }}>Application Number:</span>{' '}
                    <strong style={{ color: '#0B2545' }}>{createdDraft.application_number}</strong>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: '#6B7280' }}>Tracking Secret:</span>{' '}
                    <strong style={{ color: '#B45309' }}>{createdDraft.tracking_secret}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6B7280' }}>Application ID:</span>{' '}
                    <span style={{ color: '#374151', fontSize: '0.85rem' }}>{createdDraft.application_id}</span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: 20 }}>
                ⚠️ <strong>Important:</strong> Your Tracking Secret serves as your confidential draft key and is required to track or resume your application. Credentials are saved in your current browser tab.
              </p>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button variant="outline" onClick={handleCopyCredentials}>
                  {copiedSecret ? '✓ Copied!' : 'Copy Credentials'}
                </Button>
                <Button variant="primary" onClick={() => navigate('/modules/yajur-veda/anudaan/apply')}>
                  Proceed to Wizard →
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleStartNewApplication}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                  Applicant Category *
                </label>
                <Select
                  value={applicantCategory}
                  onChange={(e) => setApplicantCategory(e.target.value as AnudaanApplicantCategory)}
                  options={[
                    { value: 'FACULTY_CAMPUS', label: 'CSJMU Campus Faculty' },
                    { value: 'SCHOLAR_CAMPUS', label: 'CSJMU Registered Research Scholar' },
                    { value: 'POSTDOC_CAMPUS', label: 'CSJMU Post-Doctoral Researcher' },
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Full Name *
                  </label>
                  <Input
                    placeholder="Prof. / Dr. / Scholar Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Employee / Registration ID *
                  </label>
                  <Input
                    placeholder="EMP1234 or CSJMU-PHD-202X"
                    value={institutionalId}
                    onChange={(e) => setInstitutionalId(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Designation *
                  </label>
                  <Input
                    placeholder="Assistant Professor, Research Scholar..."
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Department / School *
                  </label>
                  <Input
                    placeholder="Department of Computer Science..."
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {applicantCategory !== 'FACULTY_CAMPUS' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Supervisor / Mentor Name *
                  </label>
                  <Input
                    placeholder="Full name of research supervisor"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                  Mobile Number *
                </label>
                <Input
                  placeholder="10-digit mobile number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Scopus Author ID (Optional)
                  </label>
                  <Input
                    placeholder="e.g. 57200000000"
                    value={scopusAuthorId}
                    onChange={(e) => setScopusAuthorId(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Scopus Profile URL (Optional)
                  </label>
                  <Input
                    placeholder="https://www.scopus.com/authid/..."
                    value={scopusProfileUrl}
                    onChange={(e) => setScopusProfileUrl(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button variant="outline" type="button" onClick={() => setIsStartModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? 'Initializing...' : 'Create Application Draft'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL 2: Resume Draft */}
      {/* ================================================================= */}
      <Modal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        title="Resume Existing Application"
      >
        <div style={{ padding: '8px 4px' }}>
          {errorMsg && (
            <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #F87171', color: '#B91C1C', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.9rem' }}>
              {errorMsg}
            </div>
          )}

          {resumeSuccessMsg && (
            <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', padding: '12px 16px', borderRadius: 6, marginBottom: 16, fontSize: '0.9rem' }}>
              <div style={{ marginBottom: 8 }}>✓ {resumeSuccessMsg}</div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/modules/yajur-veda/anudaan/apply')}
              >
                Launch Application Wizard →
              </Button>
            </div>
          )}

          <form onSubmit={handleResumeApplication}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                Application ID (UUID) *
              </label>
              <Input
                placeholder="e.g. 01d12825-9dda-4775-aa02-..."
                value={resumeAppId}
                onChange={(e) => setResumeAppId(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                Confidential Tracking Secret *
              </label>
              <Input
                type="password"
                placeholder="32-character secret issued at creation"
                value={resumeSecret}
                onChange={(e) => setResumeSecret(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="outline" type="button" onClick={() => setIsResumeModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Resume'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </PageContainer>
  );
};
