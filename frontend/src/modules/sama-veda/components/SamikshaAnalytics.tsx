import React, { useState, useMemo } from 'react';
import { AppIcon } from '@vyasa/ui';
import {
  PublicPublication,
  PublicBulletin,
  PublicAuthor,
  PublicCamProject,
} from '../services/samaVedaService';

interface SamikshaAnalyticsProps {
  publications: PublicPublication[];
  totalPublications: number;
  bulletins: PublicBulletin[];
  authors: PublicAuthor[];
  totalAuthors: number;
  camProjects: PublicCamProject[];
  loading?: boolean;
  onSelectCategory?: (category: string) => void;
  onSelectYear?: (year: string) => void;
  onSelectBulletin?: (bulletinId: string) => void;
  onSelectAuthorsTab?: () => void;
}

export const SamikshaAnalytics: React.FC<SamikshaAnalyticsProps> = ({
  publications,
  totalPublications,
  bulletins,
  authors,
  totalAuthors,
  camProjects,
  loading = false,
  onSelectCategory,
  onSelectYear,
  onSelectBulletin,
  onSelectAuthorsTab,
}) => {
  // Chart 1: Publication Trends by Year
  const trendData = useMemo(() => {
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
      year: yr,
      count: yearCounts[yr],
    }));
  }, [publications]);

  // Chart 2: Output Distribution by Category
  const categoryData = useMemo(() => {
    if (!publications || publications.length === 0) return [];

    const counts: Record<string, number> = {};
    for (const pub of publications) {
      const cat = pub.category?.trim() || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [publications]);

  // Chart 3: Recognition & Verification Breakdown
  const recognitionData = useMemo(() => {
    const verifiedAuthorsCount = authors.filter((a) => a.is_verified).length;
    const provisionalAuthorsCount = Math.max(0, authors.length - verifiedAuthorsCount);
    const withDoiCount = publications.filter((p) => Boolean(p.doi)).length;
    const directCitationCount = Math.max(0, publications.length - withDoiCount);

    const slices = [];
    if (verifiedAuthorsCount > 0) {
      slices.push({
        key: 'verified_faculty',
        label: 'Verified Faculty',
        count: verifiedAuthorsCount,
        color: '#0d766e', // Teal
      });
    }
    if (provisionalAuthorsCount > 0) {
      slices.push({
        key: 'provisional_faculty',
        label: 'Provisional Scholars',
        count: provisionalAuthorsCount,
        color: '#64748b', // Slate
      });
    }
    if (withDoiCount > 0) {
      slices.push({
        key: 'doi_indexed',
        label: 'Scopus / DOI Indexed',
        count: withDoiCount,
        color: '#b2811a', // Gold
      });
    }
    if (directCitationCount > 0) {
      slices.push({
        key: 'journal_works',
        label: 'Peer-Reviewed Works',
        count: directCitationCount,
        color: '#0284c7', // Sky blue
      });
    }
    if (camProjects && camProjects.length > 0) {
      slices.push({
        key: 'cam_grants',
        label: 'CAM-AI Innovation Grants',
        count: camProjects.length,
        color: '#8b5cf6', // Purple
      });
    }

    return slices;
  }, [authors, publications, camProjects]);

  // Chart 4: Bulletin Publishing Volumes
  const bulletinData = useMemo(() => {
    if (!bulletins || bulletins.length === 0) return [];
    return [...bulletins]
      .sort((a, b) => a.volume_number - b.volume_number || a.issue_number - b.issue_number)
      .map((b) => ({
        id: b.id,
        label: `Vol ${b.volume_number} Iss ${b.issue_number}`,
        title: b.title,
        period: b.publication_period,
        count: b.publication_count || 0,
        fileSizeMb: Math.round(b.file_size_bytes / (1024 * 1024)),
      }));
  }, [bulletins]);

  // Tooltip & Hover states
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [hoveredRecogKey, setHoveredRecogKey] = useState<string | null>(null);
  const [hoveredBulletinId, setHoveredBulletinId] = useState<string | null>(null);

  // SVG Trend Chart Dimensions
  const svgWidth = 520;
  const svgHeight = 200;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const maxTrend = Math.max(1, ...trendData.map((d) => d.count));
  const stepX = trendData.length > 1 ? chartW / (trendData.length - 1) : chartW / 2;

  const points = trendData.map((d, i) => {
    const x = trendData.length > 1 ? padLeft + i * stepX : padLeft + chartW / 2;
    const y = padTop + chartH - (d.count / maxTrend) * chartH;
    return { x, y, ...d };
  });

  let trendLinePath = '';
  let trendAreaPath = '';
  if (points.length > 0) {
    trendLinePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      trendLinePath += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    const baselineY = padTop + chartH;
    trendAreaPath = `${trendLinePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  }

  // Max for Category Chart
  const maxCatCount = Math.max(1, ...categoryData.map((c) => c.count));

  // Donut Chart Math
  const totalRecognitionItems = recognitionData.reduce((acc, s) => acc + s.count, 0);
  const donutSize = 160;
  const donutCenter = donutSize / 2;
  const donutRadius = 64;
  const donutInnerRadius = 42;

  let cumulativeAngle = 0;
  const donutArcs = recognitionData.map((slice) => {
    const sliceAngle = totalRecognitionItems > 0 ? (slice.count / totalRecognitionItems) * 360 : 0;
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
      percentage: totalRecognitionItems > 0 ? Math.round((slice.count / totalRecognitionItems) * 100) : 0,
    };
  });

  // Max for Bulletin Volumes
  const maxBulletinCount = Math.max(1, ...bulletinData.map((b) => b.count));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px 28px',
        boxShadow: '0 4px 16px rgba(15, 43, 72, 0.04)',
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '16px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#0d766e',
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
            }}
          >
            <AppIcon name="bar-chart" size={13} color="#0d766e" />
            <span>Research Intelligence &amp; Analytics</span>
          </div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#0f2b48',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
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
            }}
          />
          <span>Telemetry derived from verified CSJMU institutional records</span>
        </div>
      </div>

      {/* Grid of 4 Interactive Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {/* CHART 1: Research Publication Trends */}
        <div
          style={{
            background: '#fcfaf7',
            border: '1px solid #ede8e1',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f2b48', margin: 0 }}>
                1. Publication Growth Trends
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>By Year</span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              Scholarly works verified and cataloged across academic years. Click a year to filter archive.
            </p>
          </div>

          {trendData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8', fontSize: '12.5px' }}>
              {loading ? 'Compiling publication timeline...' : 'No historical publication year records available.'}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{ width: '100%', height: 'auto', overflow: 'visible' }}
                aria-label="Research Publication Trends Chart"
              >
                <defs>
                  <linearGradient id="samikshaTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d766e" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0d766e" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Gridlines */}
                {[0, 0.5, 1].map((ratio, i) => {
                  const y = padTop + chartH * (1 - ratio);
                  const labelVal = Math.round(maxTrend * ratio);
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
                        {labelVal}
                      </text>
                    </g>
                  );
                })}

                {/* Area and Line */}
                {trendAreaPath && <path d={trendAreaPath} fill="url(#samikshaTrendGradient)" />}
                {trendLinePath && (
                  <path
                    d={trendLinePath}
                    fill="none"
                    stroke="#0d766e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data Points */}
                {points.map((p, i) => {
                  const isHovered = hoveredTrendIdx === i;
                  return (
                    <g key={i}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 6 : 4}
                        fill={isHovered ? '#b2811a' : '#0d766e'}
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2.5 : 1.5}
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={() => setHoveredTrendIdx(i)}
                        onMouseLeave={() => setHoveredTrendIdx(null)}
                        onClick={() => onSelectYear && onSelectYear(p.year)}
                      />
                      <text
                        x={p.x}
                        y={padTop + chartH + 18}
                        fontSize="11"
                        fontWeight={isHovered ? '700' : '500'}
                        fill={isHovered ? '#0f2b48' : '#64748b'}
                        textAnchor="middle"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => onSelectYear && onSelectYear(p.year)}
                      >
                        {p.year}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Hover Tooltip Box */}
              {hoveredTrendIdx !== null && points[hoveredTrendIdx] && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '10px',
                    background: '#0f2b48',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#f59e0b' }}>Year {points[hoveredTrendIdx].year}</div>
                  <div>
                    {points[hoveredTrendIdx].count} Publications (
                    {totalPublications > 0
                      ? Math.round((points[hoveredTrendIdx].count / totalPublications) * 100)
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
          style={{
            background: '#fcfaf7',
            border: '1px solid #ede8e1',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f2b48', margin: 0 }}>
                2. Output by Research Category
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Categorical</span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              Distribution across articles, reviews, chapters, and papers. Click a bar to filter catalog.
            </p>
          </div>

          {categoryData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8', fontSize: '12.5px' }}>
              {loading ? 'Evaluating research categories...' : 'No category records currently available.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {categoryData.map((cat) => {
                const isHovered = hoveredCat === cat.name;
                const pct = totalPublications > 0 ? Math.round((cat.count / totalPublications) * 100) : 0;
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
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: isHovered ? 'rgba(13, 118, 110, 0.08)' : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                    title={`Filter publications by ${cat.name}`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        marginBottom: '4px',
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
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          background: isHovered ? '#b2811a' : '#0d766e',
                          borderRadius: '4px',
                          transition: 'width 0.4s ease, background-color 0.15s ease',
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
          style={{
            background: '#fcfaf7',
            border: '1px solid #ede8e1',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f2b48', margin: 0 }}>
                3. Recognition &amp; Verification
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Authenticity</span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              Breakdown of {totalAuthors > 0 ? `${totalAuthors} researchers, ` : ''}verified faculty authors, DOI-registered works, and grants.
            </p>
          </div>

          {recognitionData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8', fontSize: '12.5px' }}>
              {loading ? 'Evaluating recognition telemetry...' : 'No verified recognition records available.'}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {/* Donut SVG */}
              <div style={{ position: 'relative', width: `${donutSize}px`, height: `${donutSize}px` }}>
                <svg
                  viewBox={`0 0 ${donutSize} ${donutSize}`}
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  aria-label="Recognition Donut Chart"
                >
                  {donutArcs.map((arc) => {
                    const isHovered = hoveredRecogKey === arc.key;
                    return (
                      <path
                        key={arc.key}
                        d={arc.pathData}
                        fill={arc.color}
                        stroke="#ffffff"
                        strokeWidth="2"
                        opacity={isHovered ? 1 : 0.9}
                        style={{
                          cursor: 'pointer',
                          transition: 'opacity 0.15s ease, transform 0.15s ease',
                          transformOrigin: `${donutCenter}px ${donutCenter}px`,
                          transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                        }}
                        onMouseEnter={() => setHoveredRecogKey(arc.key)}
                        onMouseLeave={() => setHoveredRecogKey(null)}
                      />
                    );
                  })}
                </svg>

                {/* Donut Center Label */}
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
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f2b48', lineHeight: 1 }}>
                    {totalRecognitionItems}
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Records
                  </div>
                </div>
              </div>

              {/* Legends */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', flex: 1 }}>
                {donutArcs.map((arc) => {
                  const isHovered = hoveredRecogKey === arc.key;
                  return (
                    <div
                      key={arc.key}
                      onMouseEnter={() => setHoveredRecogKey(arc.key)}
                      onMouseLeave={() => setHoveredRecogKey(null)}
                      onClick={() => {
                        if (arc.key.includes('faculty') && onSelectAuthorsTab) {
                          onSelectAuthorsTab();
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11.5px',
                        color: isHovered ? '#0f2b48' : '#475569',
                        fontWeight: isHovered ? 700 : 500,
                        padding: '2px 4px',
                        borderRadius: '4px',
                        background: isHovered ? 'rgba(0,0,0,0.04)' : 'transparent',
                        cursor: arc.key.includes('faculty') ? 'pointer' : 'default',
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
                      <span style={{ fontWeight: 700 }}>{arc.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* CHART 4: Bulletin Publishing Volumes */}
        <div
          style={{
            background: '#fcfaf7',
            border: '1px solid #ede8e1',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f2b48', margin: 0 }}>
                4. Research Bulletin Volumes
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Archival</span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.4 }}>
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
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: isHovered ? 'rgba(13, 118, 110, 0.08)' : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                    title={`View ${b.title} (${b.period})`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        marginBottom: '4px',
                        color: isHovered ? '#0f2b48' : '#334155',
                        fontWeight: isHovered ? 700 : 600,
                      }}
                    >
                      <span>
                        {b.label} &bull; {b.period}
                      </span>
                      <span>{b.count} works ({b.fileSizeMb} MB)</span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        background: '#e2e8f0',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          background: isHovered ? '#0d766e' : '#b2811a',
                          borderRadius: '4px',
                          transition: 'width 0.4s ease, background-color 0.15s ease',
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
