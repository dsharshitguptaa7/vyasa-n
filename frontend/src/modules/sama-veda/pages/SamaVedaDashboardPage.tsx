import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AppIcon } from '@vyasa/ui';
import { useAuth } from '../../../context/AuthContext';
import {
  samaVedaService,
  PublicPublication,
  PublicBulletin,
  PublicAuthor,
  PublicCamProject,
  PublicFellowship,
  PublicSpotlight,
  CertificateVerificationResult,
  IssuePublicationCount,
  OverviewAnalyticsData,
} from '../services/samaVedaService';
import { SamikshaHero, MetricItem } from '../components/SamikshaHero';
import { SamikshaAnalytics } from '../components/SamikshaAnalytics';
import { SamikshaDiscoveryGrid } from '../components/SamikshaDiscoveryGrid';
import { SamikshaSpotlightSection } from '../components/SamikshaSpotlightSection';
import { SamikshaErrorBoundary } from '../components/SamikshaErrorBoundary';
import { SamikshaPublicationsTab } from '../components/SamikshaPublicationsTab';
import { SamikshaBulletinsTab } from '../components/SamikshaBulletinsTab';
import { SamikshaResearchersTab } from '../components/SamikshaResearchersTab';
import { SamikshaFelicitationTab } from '../components/SamikshaFelicitationTab';
import { SamikshaCamProjectsTab } from '../components/SamikshaCamProjectsTab';
import { SamikshaFellowshipsTab } from '../components/SamikshaFellowshipsTab';
import '../styles/samiksha.css';

type ActiveTab =
  | 'overview'
  | 'publications'
  | 'bulletins'
  | 'authors'
  | 'certificates'
  | 'cam-projects'
  | 'fellowships';

const VALID_TABS: Record<string, ActiveTab> = {
  overview: 'overview',
  publications: 'publications',
  bulletins: 'bulletins',
  authors: 'authors',
  researchers: 'authors',
  certificates: 'certificates',
  felicitation: 'certificates',
  felicitations: 'certificates',
  recognition: 'certificates',
  'cam-projects': 'cam-projects',
  'cam-ai': 'cam-projects',
  fellowships: 'fellowships',
};

export const SamaVedaDashboardPage: React.FC = () => {
  const { tab: urlTab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  let isAuthenticated = false;
  try {
    const auth = useAuth();
    isAuthenticated = !!auth?.isAuthenticated;
  } catch {
    // safe fallback in isolated test environments
  }

  const resolveTab = (): ActiveTab => {
    if (urlTab && VALID_TABS[urlTab.toLowerCase()]) {
      return VALID_TABS[urlTab.toLowerCase()];
    }
    const hash = location.hash.replace('#', '').toLowerCase();
    if (hash && VALID_TABS[hash]) {
      return VALID_TABS[hash];
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>(resolveTab);

  useEffect(() => {
    const nextTab = resolveTab();
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [urlTab, location.hash]);

  const handleTabChange = (newTab: ActiveTab) => {
    setActiveTab(newTab);
    const targetRoute = newTab === 'overview' ? '/modules/sama-veda' : `/modules/sama-veda/${newTab}`;
    if (location.pathname !== targetRoute) {
      navigate(targetRoute);
    }
  };

  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  // Automatically scroll active tab into view when selected or on deep-link navigation
  useEffect(() => {
    if (activeTabRef.current && typeof activeTabRef.current.scrollIntoView === 'function') {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeTab]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authoritative Overview Analytics
  const [analyticsData, setAnalyticsData] = useState<OverviewAnalyticsData | null>(null);
  const [authorVerifiedCount, setAuthorVerifiedCount] = useState<number | null>(null);

  // Core Data States
  const [publications, setPublications] = useState<PublicPublication[]>([]);
  const [totalPublications, setTotalPublications] = useState(0);
  const [publicationsUnavailable, setPublicationsUnavailable] = useState(false);

  const [bulletins, setBulletins] = useState<PublicBulletin[]>([]);
  const [bulletinsUnavailable, setBulletinsUnavailable] = useState(false);

  const [authors, setAuthors] = useState<PublicAuthor[]>([]);
  const [totalAuthors, setTotalAuthors] = useState(0);
  const [authorsUnavailable, setAuthorsUnavailable] = useState(false);

  const [camProjects, setCamProjects] = useState<PublicCamProject[]>([]);
  const [camProjectsUnavailable, setCamProjectsUnavailable] = useState(false);

  const [fellowships, setFellowships] = useState<PublicFellowship[]>([]);
  const [fellowshipsUnavailable, setFellowshipsUnavailable] = useState(false);

  const [spotlights, setSpotlights] = useState<PublicSpotlight[]>([]);

  // Filter & Search States
  const [pubSearch, setPubSearch] = useState('');
  const [pubCategory, setPubCategory] = useState('');
  const [pubYear, setPubYear] = useState('');
  const [pubVolume, setPubVolume] = useState('');
  const [pubIssue, setPubIssue] = useState('');
  const [pubIssueCounts, setPubIssueCounts] = useState<IssuePublicationCount[]>([]);
  const [authorSearch, setAuthorSearch] = useState('');

  // Certificate Verification state
  const [certQuery, setCertQuery] = useState('');
  const [certResult, setCertResult] = useState<CertificateVerificationResult | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  // Initial comprehensive data synchronization
  useEffect(() => {
    let isMounted = true;
    const loadOverviewData = async () => {
      try {
        setLoading(true);
        const [bullResult, camResult, felResult, spotResult, pubResult, authResult, analyticsResult] = await Promise.allSettled([
          samaVedaService.getBulletins({ limit: 50 }),
          samaVedaService.getCamProjects(),
          samaVedaService.getFellowships(),
          samaVedaService.getSpotlights(),
          samaVedaService.getPublications({ limit: 100 }),
          samaVedaService.getAuthors({ limit: 100 }),
          samaVedaService.getOverviewAnalytics(),
        ]);

        if (!isMounted) return;

        const failedSections: string[] = [];

        // 0. Authoritative Analytics Overview
        let authoritativeAnalytics: OverviewAnalyticsData | null = null;
        if (analyticsResult.status === 'fulfilled' && analyticsResult.value) {
          authoritativeAnalytics = analyticsResult.value;
          setAnalyticsData(analyticsResult.value);
          if (analyticsResult.value.summary) {
            setTotalPublications(analyticsResult.value.summary.total_publications);
            setTotalAuthors(analyticsResult.value.summary.total_researchers);
            setAuthorVerifiedCount(analyticsResult.value.summary.verified_faculty);
          }
        }

        // 1. Bulletins
        if (bullResult.status === 'fulfilled') {
          setBulletins(bullResult.value?.items || []);
          setBulletinsUnavailable(false);
        } else {
          setBulletins([]);
          setBulletinsUnavailable(true);
          failedSections.push('Bulletins');
        }

        // 2. CAM-AI Projects
        if (camResult.status === 'fulfilled') {
          setCamProjects(camResult.value?.items || []);
          setCamProjectsUnavailable(false);
        } else {
          setCamProjects([]);
          setCamProjectsUnavailable(true);
          failedSections.push('CAM-AI Projects');
        }

        // 3. Fellowship Schemes
        if (felResult.status === 'fulfilled') {
          setFellowships(felResult.value?.items || []);
          setFellowshipsUnavailable(false);
        } else {
          setFellowships([]);
          setFellowshipsUnavailable(true);
          failedSections.push('Fellowship Schemes');
        }

        // 4. Spotlights
        if (spotResult.status === 'fulfilled') {
          setSpotlights(spotResult.value?.items || []);
        } else {
          setSpotlights([]);
          failedSections.push('Researcher Spotlights');
        }

        // 5. Publications
        if (pubResult.status === 'fulfilled') {
          setPublications(pubResult.value?.items || []);
          if (!authoritativeAnalytics?.summary?.total_publications && !analyticsData?.summary?.total_publications) {
            setTotalPublications(pubResult.value?.total || pubResult.value?.items?.length || 0);
          }
          if (pubResult.value?.issue_counts && pubResult.value.issue_counts.length > 0) {
            setPubIssueCounts(pubResult.value.issue_counts);
          }
          setPublicationsUnavailable(false);
        } else {
          setPublications([]);
          if (!authoritativeAnalytics?.summary?.total_publications && !analyticsData?.summary?.total_publications) {
            setTotalPublications(0);
          }
          setPublicationsUnavailable(true);
        }

        // 6. Authors
        if (authResult.status === 'fulfilled') {
          setAuthors(authResult.value?.items || []);
          if (authResult.value?.global_total) {
            setTotalAuthors(authResult.value.global_total);
          } else if (authResult.value?.total && !authoritativeAnalytics?.summary?.total_researchers && !analyticsData?.summary?.total_researchers) {
            setTotalAuthors(authResult.value.total);
          }
          if (authResult.value?.global_verified_count !== undefined) {
            setAuthorVerifiedCount(authResult.value.global_verified_count);
          } else if (authResult.value?.verified_count !== undefined) {
            setAuthorVerifiedCount(authResult.value.verified_count);
          }
          setAuthorsUnavailable(false);
        } else {
          setAuthors([]);
          if (!authoritativeAnalytics?.summary?.total_researchers && !analyticsData?.summary?.total_researchers) {
            setTotalAuthors(0);
          }
          setAuthorsUnavailable(true);
        }

        // Graceful error status
        if (failedSections.length >= 4) {
          setErrorMsg('Public research records are currently initializing or unavailable.');
        } else if (failedSections.length > 0) {
          setErrorMsg(`Notice: Data for ${failedSections.join(', ')} could not be loaded at this time.`);
        } else {
          setErrorMsg(null);
        }
      } catch {
        if (isMounted) {
          setErrorMsg('Public research records could not be retrieved at this time.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOverviewData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch publications on tab switch or filter change
  useEffect(() => {
    if (activeTab === 'publications') {
      let isMounted = true;
      const fetchPubs = async () => {
        try {
          setLoading(true);
          const res = await samaVedaService.getPublications({
            search: pubSearch || undefined,
            category: pubCategory || undefined,
            year: pubYear || undefined,
            volume_number: pubVolume ? parseInt(pubVolume, 10) : undefined,
            issue_number: pubIssue ? parseInt(pubIssue, 10) : undefined,
            limit: 50,
          });
          if (isMounted) {
            setPublications(res?.items || []);
            setTotalPublications(res?.total || 0);
            if (res?.issue_counts && res.issue_counts.length > 0) {
              setPubIssueCounts(res.issue_counts);
            }
          }
        } catch {
          if (isMounted) {
            setPublications([]);
            setTotalPublications(0);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };
      fetchPubs();
      return () => {
        isMounted = false;
      };
    }
  }, [activeTab, pubSearch, pubCategory, pubYear, pubVolume, pubIssue]);

  // Fetch authors on tab switch or search
  useEffect(() => {
    if (activeTab === 'authors') {
      let isMounted = true;
      const fetchAuths = async () => {
        try {
          setLoading(true);
          const res = await samaVedaService.getAuthors({
            search: authorSearch || undefined,
            limit: 50,
          });
          if (isMounted) {
            setAuthors(res?.items || []);
            if (res?.global_total) {
              setTotalAuthors(res.global_total);
            } else if (res?.total && !analyticsData?.summary?.total_researchers) {
              setTotalAuthors(res.total);
            }
            if (res?.global_verified_count !== undefined) {
              setAuthorVerifiedCount(res.global_verified_count);
            } else if (res?.verified_count !== undefined) {
              setAuthorVerifiedCount(res.verified_count);
            }
          }
        } catch {
          if (isMounted) {
            setAuthors([]);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };
      fetchAuths();
      return () => {
        isMounted = false;
      };
    }
  }, [activeTab, authorSearch, analyticsData]);

  const handleVerifyCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certQuery.trim()) return;
    try {
      setCertLoading(true);
      setCertError(null);
      setCertResult(null);
      const res = await samaVedaService.verifyCertificate(certQuery.trim());
      setCertResult(res);
    } catch (err: any) {
      setCertError(err.message || 'Certificate verification failed or certificate not found.');
    } finally {
      setCertLoading(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!certResult) return;
    try {
      await samaVedaService.downloadCertificate(
        certResult.certificate_number,
        `Certificate-${certResult.certificate_number}`
      );
    } catch (err: any) {
      setCertError(err.message || 'Download failed.');
    }
  };

  const [downloadingBulletinId, setDownloadingBulletinId] = useState<string | null>(null);

  const handleDownloadBulletin = async (b: PublicBulletin) => {
    try {
      setDownloadingBulletinId(b.id);
      await samaVedaService.downloadBulletin(b.id, `CSJMU-Bulletin-Vol${b.volume_number}-Issue${b.issue_number}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download bulletin.');
    } finally {
      setDownloadingBulletinId(null);
    }
  };

  const totalScholars = useMemo(() => {
    return fellowships.reduce((acc, f) => acc + (f.active_scholars_count || 0), 0);
  }, [fellowships]);

  // Derived Real Metrics for Hero
  const heroMetrics: MetricItem[] = useMemo(() => {
    return [
      {
        label: 'Publications',
        value: analyticsData?.summary?.total_publications ?? (totalPublications > 0 ? totalPublications : publications.length > 0 ? publications.length : 0),
        loading,
        unavailable: publicationsUnavailable,
        tabKey: 'publications',
      },
      {
        label: 'Faculty Researchers',
        value: analyticsData?.summary?.total_researchers ?? (totalAuthors > 0 ? totalAuthors : authors.length > 0 ? authors.length : 0),
        loading,
        unavailable: authorsUnavailable,
        tabKey: 'authors',
      },
      {
        label: 'Research Bulletins',
        value: analyticsData?.summary?.total_bulletins ?? bulletins.length,
        loading,
        unavailable: bulletinsUnavailable,
        tabKey: 'bulletins',
      },
      {
        label: 'Active Fellows',
        value: analyticsData?.summary?.active_fellows ?? (totalScholars > 0 ? totalScholars : null),
        loading,
        unavailable: fellowshipsUnavailable,
        tabKey: 'fellowships',
      },
      {
        label: 'CAM-AI Grants',
        value: analyticsData?.summary?.cam_grants ?? camProjects.length,
        loading,
        unavailable: camProjectsUnavailable,
        tabKey: 'cam-projects',
      },
      {
        label: 'Tamper-Evident SHA-256',
        value: 'Verified',
        tabKey: 'certificates',
      },
    ].filter((m) => !m.unavailable);
  }, [
    analyticsData,
    totalPublications,
    publications.length,
    totalAuthors,
    authors.length,
    bulletins.length,
    totalScholars,
    camProjects.length,
    loading,
    publicationsUnavailable,
    authorsUnavailable,
    bulletinsUnavailable,
    fellowshipsUnavailable,
    camProjectsUnavailable,
  ]);

  // Tab Navigation List (strictly preserving all 7 canonical tabs & exact labels)
  const tabsList = [
    { id: 'overview', label: 'Overview', icon: 'grid' as const },
    { id: 'publications', label: 'Publications Archive', icon: 'book-open' as const },
    { id: 'bulletins', label: 'Research Bulletins', icon: 'file-text' as const },
    { id: 'authors', label: 'Researcher Directory', icon: 'users' as const },
    { id: 'certificates', label: 'Certificate Verification', icon: 'shield' as const },
    { id: 'cam-projects', label: 'CAM-AI Projects', icon: 'layers' as const },
    { id: 'fellowships', label: 'Fellowship Schemes', icon: 'graduation-cap' as const },
  ];

  return (
    <SamikshaErrorBoundary title="SAMIKSHA Research Portal">
      <div className="samiksha-root-container">
      {/* 0. Clean Institutional Breadcrumb for Authenticated Workspaces */}
      {isAuthenticated && (
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#64748b',
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
              gap: '6px',
            }}
          >
            <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
            <span>VYASA Dashboard</span>
          </button>
          <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--vyasa-navy, #0f2b48)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            SAMIKSHA Research
          </button>
          {activeTab !== 'overview' && (
            <>
              <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
              <span style={{ color: '#64748b', fontWeight: 500 }}>
                {tabsList.find((t) => t.id === activeTab)?.label || 'Research Section'}
              </span>
            </>
          )}
        </nav>
      )}

      {/* 1. SAMIKSHA Premium Hero Section */}
      <SamikshaHero
        metrics={heroMetrics}
        onSelectTab={handleTabChange}
        onExploreResearch={() => handleTabChange('publications')}
        onExploreFelicitations={() => handleTabChange('certificates')}
      />

      {/* 2. Global Synchronization & Error Alerts */}
      {loading && (
        <div
          style={{
            fontSize: '12.5px',
            color: '#0d766e',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f0fdfa',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid #99f6e4',
            boxShadow: '0 2px 6px rgba(13, 118, 110, 0.05)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#0d766e',
              boxShadow: '0 0 6px #0d766e',
            }}
          />
          <span>Synchronizing research records...</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            color: '#b45309',
            fontSize: '13px',
            boxShadow: '0 2px 6px rgba(180, 83, 9, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="alert-circle" size={16} color="#b45309" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#b45309',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '18px',
              lineHeight: 1,
              padding: '0 4px',
            }}
            aria-label="Dismiss alert"
          >
            &times;
          </button>
        </div>
      )}

      {/* 3. Navigation Tabs Bar */}
      <nav
        aria-label="SAMIKSHA Sections"
        className="samiksha-nav-bar"
      >
        {tabsList.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : undefined}
              type="button"
              onClick={() => handleTabChange(tab.id as ActiveTab)}
              aria-current={isActive ? 'page' : undefined}
              className={`samiksha-nav-btn ${isActive ? 'is-active' : ''}`}
            >
              <AppIcon
                name={tab.icon}
                size={15}
                color={isActive ? '#0d766e' : '#64748b'}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 4. Tab Contents */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
          {/* 1. Curated Academic Researcher Spotlights & Storytelling */}
          <SamikshaErrorBoundary title="Researcher Spotlights" isolate>
            <SamikshaSpotlightSection
              spotlights={spotlights}
              authors={authors}
              onNavigateToDirectory={(researcherName) => {
                if (researcherName) {
                  setAuthorSearch(researcherName);
                }
                handleTabChange('authors');
              }}
            />
          </SamikshaErrorBoundary>

          {/* Interactive Research Analytics Dashboard */}
          <SamikshaErrorBoundary title="Research Intelligence & Analytics" isolate>
            <SamikshaAnalytics
              analyticsData={analyticsData}
              publications={publications}
              totalPublications={analyticsData?.summary?.total_publications ?? totalPublications}
              bulletins={bulletins}
              authors={authors}
              totalAuthors={analyticsData?.summary?.total_researchers ?? totalAuthors}
              camProjects={camProjects}
              loading={loading}
              onSelectCategory={(cat) => {
                setPubCategory(cat);
                handleTabChange('publications');
              }}
              onSelectYear={(yr) => {
                setPubYear(yr);
                handleTabChange('publications');
              }}
              onSelectVolume={(vol) => {
                setPubVolume(vol);
                handleTabChange('publications');
              }}
              onSelectIssue={(iss, vol) => {
                if (vol) setPubVolume(vol);
                setPubIssue(iss);
                handleTabChange('publications');
              }}
              onSelectBulletin={() => {
                handleTabChange('bulletins');
              }}
              onSelectAuthorsTab={() => {
                handleTabChange('authors');
              }}
            />
          </SamikshaErrorBoundary>

          {/* Research Discovery Pillars Grid */}
          <SamikshaErrorBoundary title="Research Discovery Pillars" isolate>
            <SamikshaDiscoveryGrid
              totalPublications={analyticsData?.summary?.total_publications ?? totalPublications}
              totalBulletins={analyticsData?.summary?.total_bulletins ?? bulletins.length}
              totalAuthors={analyticsData?.summary?.total_researchers ?? totalAuthors}
              totalCamProjects={analyticsData?.summary?.cam_grants ?? camProjects.length}
              totalFellows={analyticsData?.summary?.active_fellows ?? totalScholars}
              onNavigateTab={(tabKey) => handleTabChange(tabKey as ActiveTab)}
            />
          </SamikshaErrorBoundary>
        </div>
      )}

      {/* TAB 2: PUBLICATIONS ARCHIVE */}
      {activeTab === 'publications' && (
        <SamikshaErrorBoundary title="Publications Archive">
          <SamikshaPublicationsTab
            publications={publications}
            totalPublications={totalPublications}
            pubSearch={pubSearch}
            onPubSearchChange={setPubSearch}
            pubCategory={pubCategory}
            onPubCategoryChange={setPubCategory}
            selectedYear={pubYear}
            onSelectedYearChange={setPubYear}
            bulletins={bulletins}
            issueCounts={pubIssueCounts}
            selectedVolume={pubVolume}
            onSelectedVolumeChange={setPubVolume}
            selectedIssue={pubIssue}
            onSelectedIssueChange={setPubIssue}
          />
        </SamikshaErrorBoundary>
      )}

      {/* TAB 3: RESEARCH BULLETINS */}
      {activeTab === 'bulletins' && (
        <SamikshaErrorBoundary title="Research Bulletins">
          <SamikshaBulletinsTab
            bulletins={bulletins}
            onDownloadBulletin={handleDownloadBulletin}
            downloadingId={downloadingBulletinId}
            publications={publications}
          />
        </SamikshaErrorBoundary>
      )}

      {/* TAB 4: RESEARCHER DIRECTORY */}
      {activeTab === 'authors' && (
        <SamikshaErrorBoundary title="Researcher Directory">
          <SamikshaResearchersTab
            authors={authors}
            totalAuthors={analyticsData?.summary?.total_researchers ?? totalAuthors}
            authoritativeVerifiedCount={analyticsData?.summary?.verified_faculty ?? authorVerifiedCount ?? undefined}
            authoritativeTotalCount={analyticsData?.summary?.total_researchers ?? totalAuthors}
            authorSearch={authorSearch}
            onAuthorSearchChange={setAuthorSearch}
            publications={publications}
            onSelectAuthorPublications={(authorName) => {
              setPubSearch(authorName);
              handleTabChange('publications');
            }}
            onSelectAuthorCertificates={(authorName) => {
              setCertQuery(authorName);
              handleTabChange('certificates');
            }}
          />
        </SamikshaErrorBoundary>
      )}

      {/* TAB 5: CERTIFICATE VERIFICATION & FELICITATION */}
      {activeTab === 'certificates' && (
        <SamikshaErrorBoundary title="Certificate Verification & Felicitation">
          <SamikshaFelicitationTab
            certQuery={certQuery}
            onCertQueryChange={setCertQuery}
            onVerifyCertificate={handleVerifyCertificate}
            certLoading={certLoading}
            certError={certError}
            certResult={certResult}
            onDownloadCertificate={handleDownloadCertificate}
            publications={publications}
            totalPublications={totalPublications}
            bulletins={bulletins}
            authors={authors}
          />
        </SamikshaErrorBoundary>
      )}

      {/* TAB 6: CAM-AI PROJECTS */}
      {activeTab === 'cam-projects' && (
        <SamikshaErrorBoundary title="CAM-AI Projects">
          <SamikshaCamProjectsTab camProjects={camProjects} />
        </SamikshaErrorBoundary>
      )}

      {/* TAB 7: FELLOWSHIP SCHEMES */}
      {activeTab === 'fellowships' && (
        <SamikshaErrorBoundary title="Fellowship Schemes">
          <SamikshaFellowshipsTab fellowships={fellowships} />
        </SamikshaErrorBoundary>
      )}
      </div>
    </SamikshaErrorBoundary>
  );
};
