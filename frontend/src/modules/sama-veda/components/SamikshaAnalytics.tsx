import React, { useState, useMemo } from 'react';
import { AppIcon } from '@vyasa/ui';
import {
  PublicPublication,
  PublicBulletin,
  PublicAuthor,
  PublicCamProject,
  OverviewAnalyticsData,
} from '../services/samaVedaService';

interface SamikshaAnalyticsProps {
  analyticsData?: OverviewAnalyticsData | null;
  publications: PublicPublication[];
  totalPublications: number;
  bulletins: PublicBulletin[];
  authors: PublicAuthor[];
  totalAuthors: number;
  camProjects: PublicCamProject[];
  loading?: boolean;
  onSelectCategory?: (category: string) => void;
  onSelectYear?: (year: string) => void;
  onSelectVolume?: (volume: string) => void;
  onSelectIssue?: (issue: string, volume?: string) => void;
  onSelectBulletin?: (bulletinId: string) => void;
  onSelectAuthorsTab?: () => void;
}

const CANONICAL_CATEGORIES: Record<string, string> = {
  article: 'Article',
  articles: 'Article',
  'journal article': 'Article',
  review: 'Review',
  reviews: 'Review',
  'review article': 'Review',
  'book chapter': 'Book Chapter',
  chapter: 'Book Chapter',
  'conference paper': 'Conference Paper',
  'conference proceedings': 'Conference Paper',
  proceeding: 'Conference Paper',
  proceedings: 'Conference Paper',
  book: 'Book',
  books: 'Book',
};

function normalizeCategoryName(raw?: string | null): string {
  if (!raw || !raw.trim()) return 'Uncategorized';
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (CANONICAL_CATEGORIES[cleaned]) {
    return CANONICAL_CATEGORIES[cleaned];
  }
  return cleaned
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface TrendDimensionItem {
  key: string;
  label: string;
  count: number;
  year?: string;
  volume?: number;
  issue?: number;
  title?: string;
  period?: string;
  bulletinId?: string;
}

function getTopRoundedRectPath(x: number, y: number, w: number, h: number, r: number = 4): string {
  if (h <= 0 || w <= 0) return '';
  const radius = Math.min(r, w / 2, h);
  return `M ${x} ${y + h} L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius} L ${x + w} ${y + h} Z`;
}

export const SamikshaAnalytics: React.FC<SamikshaAnalyticsProps> = ({
  analyticsData,
  publications,
  totalPublications,
  bulletins,
  authors,
  totalAuthors,
  camProjects,
  loading = false,
  onSelectCategory,
  onSelectYear,
  onSelectVolume,
  onSelectIssue,
  onSelectBulletin,
  onSelectAuthorsTab,
}) => {
  // Authoritative total eligible publications
  const effectiveTotalPubs = analyticsData?.summary.total_publications ?? (totalPublications > 0 ? totalPublications : publications.length);

  // Authoritative total researchers and verification counts
  const effectiveTotalAuthors = analyticsData?.summary.total_researchers ?? (totalAuthors > 0 ? totalAuthors : authors.length);
  const effectiveVerifiedFaculty = analyticsData?.summary.verified_faculty ?? authors.filter((a) => a.is_verified).length;
  const effectiveProvisionalScholars = analyticsData?.summary.provisional_scholars ?? Math.max(0, effectiveTotalAuthors - effectiveVerifiedFaculty);

  // Chart 1: Dynamic Filter State (Year, Volume, Issue)
  const [trendFilter, setTrendFilter] = useState<'year' | 'volume' | 'issue'>('year');

  // Chart 1: Dimension 1 - Year Trends Data
  const yearData = useMemo<TrendDimensionItem[]>(() => {
    if (analyticsData?.yearly_trends && analyticsData.yearly_trends.length > 0) {
      return analyticsData.yearly_trends.map((yt) => ({
        key: yt.year,
        label: yt.year,
        count: yt.count,
        year: yt.year,
      }));
    }
    if (!publications || publications.length === 0) return [];

    const yearCounts: Record<string, number> = {};
    for (const pub of publications) {
      const dateStr = pub.published_at || pub.created_at;
      if (dateStr) {
        try {
          const yr = new Date(dateStr).getFullYear();
          if (!isNaN(yr) && yr > 1990 && yr < 2100) {
            yearCounts[String(yr)] = (yearCounts[String(yr)] || 0) + 1;
          }
        } catch {
          // ignore unparseable
        }
      }
    }

    const sortedYears = Object.keys(yearCounts).sort();
    return sortedYears.map((yr) => ({
      key: yr,
      label: yr,
      count: yearCounts[yr],
      year: yr,
    }));
  }, [analyticsData, publications]);

  // Chart 1: Dimension 2 - Volume Distribution Data
  const volumeData = useMemo<TrendDimensionItem[]>(() => {
    // Priority 1: Authoritative analytics bulletin volumes
    if (analyticsData?.bulletin_volumes && analyticsData.bulletin_volumes.length > 0) {
      const volMap = new Map<number, number>();
      for (const b of analyticsData.bulletin_volumes) {
        if (b.volume_number != null) {
          volMap.set(b.volume_number, (volMap.get(b.volume_number) || 0) + (b.actual_publication_count || 0));
        }
      }
      return Array.from(volMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([vol, count]) => ({
          key: `vol-${vol}`,
          label: `Vol ${vol}`,
          count,
          volume: vol,
        }));
    }

    // Priority 2: Client fallback via publications records
    if (publications && publications.length > 0) {
      const bulletinVolMap = new Map(bulletins.map((b) => [b.id, b.volume_number]));
      const volMap = new Map<number, number>();
      for (const pub of publications) {
        const vol = pub.volume_number ?? (pub.bulletin_id ? bulletinVolMap.get(pub.bulletin_id) : null);
        if (vol != null) {
          volMap.set(vol, (volMap.get(vol) || 0) + 1);
        }
      }
      if (volMap.size > 0) {
        return Array.from(volMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([vol, count]) => ({
            key: `vol-${vol}`,
            label: `Vol ${vol}`,
            count,
            volume: vol,
          }));
      }
    }

    // Priority 3: Fallback via bulletins metadata
    if (bulletins && bulletins.length > 0) {
      const volMap = new Map<number, number>();
      for (const b of bulletins) {
        if (b.volume_number != null) {
          volMap.set(b.volume_number, (volMap.get(b.volume_number) || 0) + (b.publication_count || 0));
        }
      }
      return Array.from(volMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([vol, count]) => ({
          key: `vol-${vol}`,
          label: `Vol ${vol}`,
          count,
          volume: vol,
        }));
    }

    return [];
  }, [analyticsData, publications, bulletins]);

  // Chart 1: Dimension 3 - Issue Distribution Data (Grouped by Volume + Issue to prevent collision)
  const issueData = useMemo<TrendDimensionItem[]>(() => {
    // Priority 1: Authoritative analytics bulletin volumes
    if (analyticsData?.bulletin_volumes && analyticsData.bulletin_volumes.length > 0) {
      return [...analyticsData.bulletin_volumes]
        .sort((a, b) => a.volume_number - b.volume_number || a.issue_number - b.issue_number)
        .map((b) => ({
          key: b.id || `v${b.volume_number}_i${b.issue_number}`,
          label: b.label || `Vol ${b.volume_number} Iss ${b.issue_number}`,
          count: b.actual_publication_count || 0,
          volume: b.volume_number,
          issue: b.issue_number,
          title: b.title,
          period: b.period,
          bulletinId: b.id,
        }));
    }

    // Priority 2: Client fallback via publications records
    if (publications && publications.length > 0) {
      const bulletinMap = new Map(bulletins.map((b) => [b.id, b]));
      const issueMap = new Map<
        string,
        {
          label: string;
          count: number;
          volume: number;
          issue: number;
          bulletinId?: string;
          title?: string;
          period?: string;
        }
      >();

      for (const pub of publications) {
        const b = pub.bulletin_id ? bulletinMap.get(pub.bulletin_id) : undefined;
        const vol = pub.volume_number ?? b?.volume_number;
        const iss = pub.issue_number ?? b?.issue_number;
        if (iss != null) {
          const key = b?.id || (vol != null ? `v${vol}_i${iss}` : `i${iss}`);
          const label = b?.title ? `Vol ${vol} Iss ${iss}` : vol != null ? `Vol ${vol} Iss ${iss}` : `Issue ${iss}`;
          const existing = issueMap.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            issueMap.set(key, {
              label,
              count: 1,
              volume: vol ?? 1,
              issue: iss,
              bulletinId: b?.id,
              title: b?.title,
              period: b?.publication_period,
            });
          }
        }
      }

      if (issueMap.size > 0) {
        return Array.from(issueMap.entries())
          .sort((a, b) => a[1].volume - b[1].volume || a[1].issue - b[1].issue)
          .map(([key, item]) => ({
            key,
            label: item.label,
            count: item.count,
            volume: item.volume,
            issue: item.issue,
            bulletinId: item.bulletinId,
            title: item.title,
            period: item.period,
          }));
      }
    }

    // Priority 3: Fallback via bulletins metadata
    if (bulletins && bulletins.length > 0) {
      return [...bulletins]
        .sort((a, b) => a.volume_number - b.volume_number || a.issue_number - b.issue_number)
        .map((b) => ({
          key: b.id,
          label: `Vol ${b.volume_number} Iss ${b.issue_number}`,
          count: b.publication_count || 0,
          volume: b.volume_number,
          issue: b.issue_number,
          title: b.title,
          period: b.publication_period,
          bulletinId: b.id,
        }));
    }

    return [];
  }, [analyticsData, publications, bulletins]);

  // Authoritative dataset currently active based on selected filter
  const currentTrendData = useMemo(() => {
    switch (trendFilter) {
      case 'volume':
        return volumeData;
      case 'issue':
        return issueData;
      case 'year':
      default:
        return yearData;
    }
  }, [trendFilter, yearData, volumeData, issueData]);

  const filterDescription = useMemo(() => {
    switch (trendFilter) {
      case 'volume':
        return 'Authoritative distribution of verified scholarly works compiled across published bulletin volumes.';
      case 'issue':
        return 'Authoritative distribution of verified scholarly works aggregated by distinct bulletin issues.';
      case 'year':
      default:
        return 'Authoritative annual distribution of verified scholarly works cataloged in the institutional repository.';
    }
  }, [trendFilter]);

  // Chart 2: Output Distribution by Category (Normalized & Reconciled)
  const categoryData = useMemo(() => {
    if (analyticsData?.category_distribution && analyticsData.category_distribution.length > 0) {
      return analyticsData.category_distribution;
    }
    if (!publications || publications.length === 0) return [];

    const counts: Record<string, number> = {};
    for (const pub of publications) {
      const cat = normalizeCategoryName(pub.category);
      counts[cat] = (counts[cat] || 0) + 1;
    }

    const totalEligible = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalEligible > 0 ? Math.round((count / totalEligible) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [analyticsData, publications]);

  // Chart 3: Researcher Verification & Authenticity Breakdown (Strictly Researcher Entities)
  const researcherSlices = useMemo(() => {
    const slices = [];
    if (effectiveVerifiedFaculty > 0) {
      slices.push({
        key: 'verified_faculty',
        label: 'Verified Faculty',
        count: effectiveVerifiedFaculty,
        color: '#0d9488', // Electric Teal
      });
    }
    if (effectiveProvisionalScholars > 0) {
      slices.push({
        key: 'provisional_faculty',
        label: 'Provisional Scholars',
        count: effectiveProvisionalScholars,
        color: '#64748b', // Slate
      });
    }
    return slices;
  }, [effectiveVerifiedFaculty, effectiveProvisionalScholars]);

  // Distinct Output & Grant Metrics (Kept strictly as independent entities)
  const indexingMetrics = useMemo(() => {
    const doiCount = analyticsData?.indexing_metrics.doi_indexed ?? publications.filter((p) => Boolean(p.doi)).length;
    const directCount =
      analyticsData?.indexing_metrics.direct_peer_reviewed ?? Math.max(0, (effectiveTotalPubs || publications.length) - doiCount);
    const grantsCount = analyticsData?.summary.cam_grants ?? (camProjects ? camProjects.length : 0);

    return {
      doiCount,
      directCount,
      grantsCount,
    };
  }, [analyticsData, publications, effectiveTotalPubs, camProjects]);

  // Chart 4: Bulletin Publishing Volumes (Live database publication associations)
  const bulletinData = useMemo(() => {
    if (analyticsData?.bulletin_volumes && analyticsData.bulletin_volumes.length > 0) {
      return analyticsData.bulletin_volumes.map((b) => ({
        id: b.id,
        label: b.label,
        title: b.title,
        period: b.period,
        count: b.actual_publication_count,
        archivalCount: b.archival_count,
        fileSizeMb: Math.round((b.file_size_bytes || 0) / (1024 * 1024)),
      }));
    }
    if (!bulletins || bulletins.length === 0) return [];
    return [...bulletins]
      .sort((a, b) => a.volume_number - b.volume_number || a.issue_number - b.issue_number)
      .map((b) => ({
        id: b.id,
        label: `Vol ${b.volume_number} Iss ${b.issue_number}`,
        title: b.title,
        period: b.publication_period,
        count: b.publication_count || 0,
        archivalCount: b.publication_count || 0,
        fileSizeMb: Math.round(b.file_size_bytes / (1024 * 1024)),
      }));
  }, [analyticsData, bulletins]);

  // Tooltip & Hover states
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [hoveredRecogKey, setHoveredRecogKey] = useState<string | null>(null);
  const [hoveredBulletinId, setHoveredBulletinId] = useState<string | null>(null);

  // SVG Trend Chart Dimensions
  const svgWidth = 520;
  const svgHeight = 210;
  const padLeft = 44;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 38;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const maxTrend = Math.max(1, ...currentTrendData.map((d) => d.count));
  const yMax = maxTrend === 1 ? 2 : maxTrend;

  const yTicks = useMemo(() => {
    if (yMax <= 2) {
      return yMax === 1 ? [0, 1] : [0, 1, 2];
    }
    const mid = Math.round(yMax / 2);
    return Array.from(new Set([0, mid, yMax])).sort((a, b) => a - b);
  }, [yMax]);

  // Points for Line Chart (Year)
  const yearPoints = useMemo(() => {
    if (yearData.length === 0) return [];
    if (yearData.length === 1) {
      return [
        {
          ...yearData[0],
          x: padLeft + chartW / 2,
          y: padTop + chartH - (yearData[0].count / yMax) * chartH,
        },
      ];
    }
    const stepX = chartW / (yearData.length - 1);
    return yearData.map((d, i) => ({
      ...d,
      x: padLeft + i * stepX,
      y: padTop + chartH - (d.count / yMax) * chartH,
    }));
  }, [yearData, chartW, chartH, yMax, padLeft, padTop]);

  let trendLinePath = '';
  let trendAreaPath = '';
  if (yearPoints.length > 1) {
    trendLinePath = `M ${yearPoints[0].x} ${yearPoints[0].y}`;
    for (let i = 0; i < yearPoints.length - 1; i++) {
      const p0 = yearPoints[i];
      const p1 = yearPoints[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      trendLinePath += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    const baselineY = padTop + chartH;
    trendAreaPath = `${trendLinePath} L ${yearPoints[yearPoints.length - 1].x} ${baselineY} L ${yearPoints[0].x} ${baselineY} Z`;
  }

  // Bars for Volume & Issue
  const barItems = useMemo(() => {
    const data = trendFilter === 'volume' ? volumeData : issueData;
    if (data.length === 0) return [];
    const N = data.length;
    const maxBarW = trendFilter === 'volume' ? 52 : 44;
    const slotW = chartW / N;
    const barWidth = N === 1 ? maxBarW : Math.min(maxBarW, Math.max(16, slotW * 0.58));

    return data.map((d, i) => {
      const x = N === 1 ? padLeft + (chartW - barWidth) / 2 : padLeft + i * slotW + (slotW - barWidth) / 2;
      const barH = d.count > 0 ? Math.max(5, (d.count / yMax) * chartH) : 0;
      const y = padTop + chartH - barH;
      const path = getTopRoundedRectPath(x, y, barWidth, barH, 4);
      return {
        ...d,
        x,
        y,
        barWidth,
        barHeight: barH,
        centerX: x + barWidth / 2,
        path,
      };
    });
  }, [trendFilter, volumeData, issueData, chartW, chartH, yMax, padLeft, padTop]);

  // Max for Category Chart
  const maxCatCount = Math.max(1, ...categoryData.map((c) => c.count));

  // Donut Chart Math (Researcher Registry Only)
  const donutSize = 160;
  const donutCenter = donutSize / 2;
  const donutRadius = 66;
  const donutInnerRadius = 42;

  let cumulativeAngle = 0;
  const donutArcs = researcherSlices.map((slice) => {
    const sliceAngle = effectiveTotalAuthors > 0 ? (slice.count / effectiveTotalAuthors) * 360 : 0;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sliceAngle;
    cumulativeAngle += sliceAngle;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = donutCenter + donutRadius * Math.cos(startRad);
    const y1 = donutCenter + donutRadius * Math.sin(startRad);
    const x2 = donutCenter + donutRadius * Math.cos(endRad);
    const y2 = donutCenter + donutRadius * Math.sin(endRad);

    const x3 = donutCenter + donutInnerRadius * Math.cos(endRad);
    const y3 = donutCenter + donutInnerRadius * Math.sin(endRad);
    const x4 = donutCenter + donutInnerRadius * Math.cos(startRad);
    const y4 = donutCenter + donutInnerRadius * Math.sin(startRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;

    const pathData =
      sliceAngle >= 359.9
        ? `M ${donutCenter} ${donutCenter - donutRadius} A ${donutRadius} ${donutRadius} 0 1 0 ${donutCenter} ${
            donutCenter + donutRadius
          } A ${donutRadius} ${donutRadius} 0 1 0 ${donutCenter} ${
            donutCenter - donutRadius
          } M ${donutCenter} ${donutCenter - donutInnerRadius} A ${donutInnerRadius} ${donutInnerRadius} 0 1 1 ${donutCenter} ${
            donutCenter + donutInnerRadius
          } A ${donutInnerRadius} ${donutInnerRadius} 0 1 1 ${donutCenter} ${donutCenter - donutInnerRadius} Z`
        : `M ${x1} ${y1} A ${donutRadius} ${donutRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${donutInnerRadius} ${donutInnerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return {
      ...slice,
      pathData,
      sliceAngle,
      percentage: effectiveTotalAuthors > 0 ? Math.round((slice.count / effectiveTotalAuthors) * 100) : 0,
    };
  });

  // Max for Bulletin Volumes
  const maxBulletinCount = Math.max(1, ...bulletinData.map((b) => b.count));

  return (
    <div className="samiksha-card" style={{ padding: '26px 28px' }}>
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '18px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div className="samiksha-eyebrow">
            <AppIcon name="bar-chart" size={13} color="#0d766e" />
            <span>Research Intelligence &amp; Analytics</span>
          </div>
          <h2 className="samiksha-section-title">
            Scholarly Output &amp; Recognition Metrics
          </h2>
        </div>
        <div style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px #10b981',
            }}
          />
          <span>Authoritative telemetry dynamically reconciled with CSJMU database</span>
        </div>
      </div>

      {/* Grid of 4 Interactive Charts */}
      <div
        className="samiksha-analytics-responsive-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '24px',
        }}
      >
        {/* CHART 1: Research Publication Trends with Dynamic Dimension Filter */}
        <div
          className="samiksha-analytics-card"
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 10px rgba(15, 43, 72, 0.03)',
            minHeight: '440px',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f2b48', margin: 0 }}>
                  1. Publication Growth Trends
                </h3>
                <span
                  className={`samiksha-pill-badge ${
                    trendFilter === 'year' ? 'cyan' : trendFilter === 'volume' ? 'teal' : 'navy'
                  }`}
                  style={{ padding: '2px 8px', fontSize: '10.5px' }}
                >
                  {trendFilter === 'year' ? 'By Year' : trendFilter === 'volume' ? 'By Volume' : 'By Issue'}
                </span>
              </div>

              {/* Compact Segmented Control (Year / Volume / Issue) */}
              <div
                role="group"
                aria-label="Filter publication trends by dimension"
                className="samiksha-segmented-control"
              >
                {(['year', 'volume', 'issue'] as const).map((dim) => {
                  const isActive = trendFilter === dim;
                  const label = dim === 'year' ? 'Year' : dim === 'volume' ? 'Volume' : 'Issue';
                  return (
                    <button
                      key={dim}
                      type="button"
                      onClick={() => {
                        setTrendFilter(dim);
                        setHoveredTrendIdx(null);
                      }}
                      aria-pressed={isActive}
                      className={`samiksha-segmented-btn ${isActive ? 'is-active' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.45 }}>
              {filterDescription}
            </p>
          </div>

          {currentTrendData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8', fontSize: '12.5px' }}>
              {loading
                ? `Compiling ${trendFilter === 'year' ? 'publication timeline' : trendFilter === 'volume' ? 'volume distribution' : 'issue distribution'}...`
                : trendFilter === 'year'
                ? 'No historical publication year records available.'
                : trendFilter === 'volume'
                ? 'No volume publication records available.'
                : 'No issue publication records available.'}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{ width: '100%', height: 'auto', overflow: 'visible' }}
                aria-label={`Research Publication Trends by ${
                  trendFilter === 'year' ? 'Year' : trendFilter === 'volume' ? 'Volume' : 'Issue'
                }`}
              >
                <defs>
                  <linearGradient id="samikshaTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="samikshaBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                  <linearGradient id="samikshaBarHoverGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Gridlines */}
                {yTicks.map((val, i) => {
                  const y = padTop + chartH - (val / yMax) * chartH;
                  return (
                    <g key={i}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={padLeft + chartW}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text
                        x={padLeft - 8}
                        y={y + 3}
                        fontSize="10"
                        fill="#94a3b8"
                        textAnchor="end"
                        fontFamily="system-ui, sans-serif"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* 1. YEAR LINE CHART */}
                {trendFilter === 'year' && (
                  <>
                    {/* Area and Line for multi-point */}
                    {yearPoints.length > 1 && trendAreaPath && (
                      <path d={trendAreaPath} fill="url(#samikshaTrendGradient)" />
                    )}
                    {yearPoints.length > 1 && trendLinePath && (
                      <path
                        d={trendLinePath}
                        fill="none"
                        stroke="#0d9488"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Single Point Guideline, Halo and Callout */}
                    {yearPoints.length === 1 && (
                      <g>
                        <line
                          x1={padLeft}
                          y1={yearPoints[0].y}
                          x2={padLeft + chartW}
                          y2={yearPoints[0].y}
                          stroke="#14b8a6"
                          strokeOpacity={0.25}
                          strokeDasharray="4 4"
                          strokeWidth={1}
                        />
                        <line
                          x1={yearPoints[0].x}
                          y1={yearPoints[0].y}
                          x2={yearPoints[0].x}
                          y2={padTop + chartH}
                          stroke="#cbd5e1"
                          strokeDasharray="3 3"
                          strokeWidth={1}
                        />
                        <circle
                          cx={yearPoints[0].x}
                          cy={yearPoints[0].y}
                          r={16}
                          fill="#14b8a6"
                          fillOpacity={0.16}
                        />
                        <g style={{ pointerEvents: 'none' }}>
                          <rect
                            x={yearPoints[0].x - 48}
                            y={yearPoints[0].y - 28}
                            width={96}
                            height={20}
                            rx={5}
                            fill="#0a1f3d"
                          />
                          <text
                            x={yearPoints[0].x}
                            y={yearPoints[0].y - 14}
                            fontSize="10.5"
                            fontWeight="700"
                            fill="#f59e0b"
                            textAnchor="middle"
                          >
                            {yearPoints[0].count} {yearPoints[0].count === 1 ? 'Publication' : 'Publications'}
                          </text>
                        </g>
                      </g>
                    )}

                    {/* Data Points */}
                    {yearPoints.map((p, i) => {
                      const isHovered = hoveredTrendIdx === i;
                      return (
                        <g key={p.key || i}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? 6.5 : 4.5}
                            fill={isHovered ? '#f59e0b' : '#0d9488'}
                            stroke="#ffffff"
                            strokeWidth={isHovered ? 2.5 : 1.5}
                            style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                            onMouseEnter={() => setHoveredTrendIdx(i)}
                            onMouseLeave={() => setHoveredTrendIdx(null)}
                            onClick={() => onSelectYear && p.year && onSelectYear(p.year)}
                          />
                          <text
                            x={p.x}
                            y={padTop + chartH + 18}
                            fontSize="11"
                            fontWeight={isHovered ? '700' : '500'}
                            fill={isHovered ? '#0f2b48' : '#64748b'}
                            textAnchor="middle"
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => onSelectYear && p.year && onSelectYear(p.year)}
                          >
                            {p.year}
                          </text>
                        </g>
                      );
                    })}
                  </>
                )}

                {/* 2. VOLUME / ISSUE BAR CHARTS */}
                {trendFilter !== 'year' && (
                  <g>
                    {barItems.map((bar, i) => {
                      const isHovered = hoveredTrendIdx === i;
                      return (
                        <g
                          key={bar.key || i}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredTrendIdx(i)}
                          onMouseLeave={() => setHoveredTrendIdx(null)}
                          onClick={() => {
                            if (trendFilter === 'volume') {
                              if (onSelectVolume && bar.volume != null) {
                                onSelectVolume(String(bar.volume));
                              }
                            } else {
                              if (onSelectIssue && bar.issue != null) {
                                onSelectIssue(String(bar.issue), bar.volume != null ? String(bar.volume) : undefined);
                              }
                              if (onSelectBulletin && bar.bulletinId) {
                                onSelectBulletin(bar.bulletinId);
                              }
                            }
                          }}
                        >
                          {/* Value callout above bar */}
                          {bar.count > 0 && (isHovered || barItems.length <= 5) && (
                            <text
                              x={bar.centerX}
                              y={bar.y - 6}
                              fontSize="10.5"
                              fontWeight="700"
                              fill={isHovered ? '#0f2b48' : '#0d766e'}
                              textAnchor="middle"
                              style={{ userSelect: 'none' }}
                            >
                              {bar.count}
                            </text>
                          )}

                          {/* Bar Path */}
                          {bar.barHeight > 0 ? (
                            <path
                              d={bar.path}
                              fill={isHovered ? 'url(#samikshaBarHoverGradient)' : 'url(#samikshaBarGradient)'}
                              style={{
                                transition: 'fill 0.15s ease, opacity 0.15s ease',
                                filter: isHovered ? 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.4))' : 'none',
                              }}
                            />
                          ) : (
                            <line
                              x1={bar.x}
                              y1={padTop + chartH}
                              x2={bar.x + bar.barWidth}
                              y2={padTop + chartH}
                              stroke="#cbd5e1"
                              strokeWidth={2}
                            />
                          )}

                          {/* X-axis Label */}
                          <text
                            x={bar.centerX}
                            y={padTop + chartH + 18}
                            fontSize={barItems.length > 5 ? '9.5' : '10.5'}
                            fontWeight={isHovered ? '700' : '500'}
                            fill={isHovered ? '#0f2b48' : '#64748b'}
                            textAnchor="middle"
                            style={{ userSelect: 'none' }}
                          >
                            {bar.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}
              </svg>

              {/* Hover Tooltip Box */}
              {hoveredTrendIdx !== null && currentTrendData[hoveredTrendIdx] && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '10px',
                    background: '#0a1f3d',
                    color: '#ffffff',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                    pointerEvents: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    zIndex: 10,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#f59e0b' }}>
                    {trendFilter === 'year'
                      ? `Year ${currentTrendData[hoveredTrendIdx].year}`
                      : trendFilter === 'volume'
                      ? `Volume ${currentTrendData[hoveredTrendIdx].volume}`
                      : currentTrendData[hoveredTrendIdx].title || currentTrendData[hoveredTrendIdx].label}
                  </div>
                  {trendFilter === 'issue' && currentTrendData[hoveredTrendIdx].period && (
                    <div style={{ fontSize: '10.5px', color: '#cbd5e1', marginBottom: '2px' }}>
                      {currentTrendData[hoveredTrendIdx].period}
                    </div>
                  )}
                  <div>
                    {currentTrendData[hoveredTrendIdx].count} Publications (
                    {effectiveTotalPubs > 0
                      ? Math.round((currentTrendData[hoveredTrendIdx].count / effectiveTotalPubs) * 100)
                      : 100}
                    %)
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CHART 2: Output Distribution by Category */}
        <div
          className="samiksha-analytics-card"
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 10px rgba(15, 43, 72, 0.03)',
            minHeight: '440px',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f2b48', margin: 0 }}>
                2. Output by Research Category
              </h3>
              <span className="samiksha-pill-badge teal" style={{ padding: '2px 8px', fontSize: '10.5px' }}>Categorical</span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.45 }}>
              Authoritative categorization across {effectiveTotalPubs} published works. Click any bar to inspect.
            </p>
          </div>

          {categoryData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8', fontSize: '12.5px' }}>
              {loading ? 'Evaluating research categories...' : 'No category records currently available.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categoryData.map((cat) => {
                const isHovered = hoveredCat === cat.name;
                const pct =
                  cat.percentage !== undefined
                    ? Math.round(cat.percentage)
                    : effectiveTotalPubs > 0
                    ? Math.round((cat.count / effectiveTotalPubs) * 100)
                    : 0;
                const barWidth = Math.max(6, (cat.count / maxCatCount) * 100);

                return (
                  <div
                    key={cat.name}
                    onMouseEnter={() => setHoveredCat(cat.name)}
                    onMouseLeave={() => setHoveredCat(null)}
                    onClick={() => onSelectCategory && onSelectCategory(cat.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectCategory && onSelectCategory(cat.name);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: isHovered ? 'rgba(20, 184, 166, 0.1)' : 'transparent',
                      transition: 'all 0.15s ease',
                      border: isHovered ? '1px solid rgba(20, 184, 166, 0.3)' : '1px solid transparent',
                    }}
                    title={`Filter publications by ${cat.name}`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12.5px',
                        marginBottom: '5px',
                        color: isHovered ? '#0f2b48' : '#334155',
                        fontWeight: isHovered ? 700 : 600,
                      }}
                    >
                      <span>{cat.name}</span>
                      <span>
                        {cat.count} ({pct}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        background: '#e2e8f0',
                        borderRadius: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          background: isHovered
                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                            : 'linear-gradient(90deg, #0d9488, #06b6d4)',
                          borderRadius: '6px',
                          transition: 'width 0.4s ease, background 0.15s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CHART 3: Recognition & Verification Overview */}
        <div
          className="samiksha-analytics-card"
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 10px rgba(15, 43, 72, 0.03)',
            minHeight: '440px',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f2b48', margin: 0 }}>
                3. Recognition &amp; Verification
              </h3>
              <span className="samiksha-pill-badge amber" style={{ padding: '2px 8px', fontSize: '10.5px' }}>Authenticity</span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.45 }}>
              Authoritative verification status of {effectiveTotalAuthors} researchers and indexed academic works.
            </p>
          </div>

          {effectiveTotalAuthors === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8', fontSize: '12.5px' }}>
              {loading ? 'Evaluating recognition telemetry...' : 'No verified recognition records available.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                {/* Donut SVG for Researcher Verification */}
                <div style={{ position: 'relative', width: `${donutSize}px`, height: `${donutSize}px` }}>
                  <svg
                    viewBox={`0 0 ${donutSize} ${donutSize}`}
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                    aria-label="Researcher Verification Donut Chart"
                  >
                    {donutArcs.map((arc) => {
                      const isHovered = hoveredRecogKey === arc.key;
                      return (
                        <path
                          key={arc.key}
                          d={arc.pathData}
                          fill={arc.color}
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          opacity={isHovered ? 1 : 0.9}
                          style={{
                            cursor: 'pointer',
                            transition: 'opacity 0.15s ease, transform 0.15s ease',
                            transformOrigin: `${donutCenter}px ${donutCenter}px`,
                            transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                          }}
                          onMouseEnter={() => setHoveredRecogKey(arc.key)}
                          onMouseLeave={() => setHoveredRecogKey(null)}
                          onClick={() => {
                            if (onSelectAuthorsTab) onSelectAuthorsTab();
                          }}
                        />
                      );
                    })}
                  </svg>

                  {/* Donut Center Label (Explicitly Researchers, Never "Records") */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f2b48', lineHeight: 1 }}>
                      {effectiveTotalAuthors}
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
                      Researchers
                    </div>
                  </div>
                </div>

                {/* Legends for Researcher Verification */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', flex: 1 }}>
                  {donutArcs.map((arc) => {
                    const isHovered = hoveredRecogKey === arc.key;
                    return (
                      <div
                        key={arc.key}
                        onMouseEnter={() => setHoveredRecogKey(arc.key)}
                        onMouseLeave={() => setHoveredRecogKey(null)}
                        onClick={() => {
                          if (onSelectAuthorsTab) onSelectAuthorsTab();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '11.5px',
                          color: isHovered ? '#0f2b48' : '#475569',
                          fontWeight: isHovered ? 700 : 500,
                          padding: '4px 6px',
                          borderRadius: '6px',
                          background: isHovered ? 'rgba(15, 43, 72, 0.05)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: arc.color,
                            }}
                          />
                          <span>{arc.label}</span>
                        </div>
                        <span style={{ fontWeight: 700 }}>
                          {arc.count} ({arc.percentage}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Distinct Output & Grants Metrics Strip (Separated Entity Counts) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '8px',
                  paddingTop: '10px',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Scopus / DOI Indexed</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f2b48' }}>
                    {indexingMetrics.doiCount}{' '}
                    <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#94a3b8' }}>works</span>
                  </div>
                </div>
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Peer-Reviewed Direct</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f2b48' }}>
                    {indexingMetrics.directCount}{' '}
                    <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#94a3b8' }}>works</span>
                  </div>
                </div>
                {indexingMetrics.grantsCount > 0 && (
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#64748b' }}>CAM-AI Grants</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#8b5cf6' }}>
                      {indexingMetrics.grantsCount}{' '}
                      <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#94a3b8' }}>awards</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CHART 4: Bulletin Publishing Volumes */}
        <div
          className="samiksha-analytics-card"
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 10px rgba(15, 43, 72, 0.03)',
            minHeight: '440px',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f2b48', margin: 0 }}>
                4. Research Bulletin Volumes
              </h3>
              <span className="samiksha-pill-badge navy" style={{ padding: '2px 8px', fontSize: '10.5px' }}>Archival</span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.45 }}>
              Publications compiled per published institutional bulletin issue. Click to inspect bulletin.
            </p>
          </div>

          {bulletinData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8', fontSize: '12.5px' }}>
              {loading ? 'Retrieving bulletin records...' : 'No published research bulletins recorded.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bulletinData.map((b) => {
                const isHovered = hoveredBulletinId === b.id;
                const barWidth = Math.max(8, (b.count / maxBulletinCount) * 100);

                return (
                  <div
                    key={b.id}
                    onMouseEnter={() => setHoveredBulletinId(b.id)}
                    onMouseLeave={() => setHoveredBulletinId(null)}
                    onClick={() => onSelectBulletin && onSelectBulletin(b.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectBulletin && onSelectBulletin(b.id);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: isHovered ? 'rgba(20, 184, 166, 0.1)' : 'transparent',
                      transition: 'all 0.15s ease',
                      border: isHovered ? '1px solid rgba(20, 184, 166, 0.3)' : '1px solid transparent',
                    }}
                    title={`View ${b.title} (${b.period})`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12.5px',
                        marginBottom: '5px',
                        color: isHovered ? '#0f2b48' : '#334155',
                        fontWeight: isHovered ? 700 : 600,
                      }}
                    >
                      <span>
                        {b.label} &bull; {b.period}
                      </span>
                      <span>
                        {b.count} works{' '}
                        {b.archivalCount && b.archivalCount !== b.count ? (
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                            ({b.archivalCount} print index)
                          </span>
                        ) : null}{' '}
                        ({b.fileSizeMb} MB)
                      </span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        background: '#e2e8f0',
                        borderRadius: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          background: isHovered
                            ? 'linear-gradient(90deg, #0d9488, #14b8a6)'
                            : 'linear-gradient(90deg, #f59e0b, #d97706)',
                          borderRadius: '6px',
                          transition: 'width 0.4s ease, background 0.15s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
