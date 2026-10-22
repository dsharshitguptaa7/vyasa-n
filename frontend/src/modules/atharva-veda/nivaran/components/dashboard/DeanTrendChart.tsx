import React, { useState } from 'react';
import { TimeTrendPoint } from '../../types/deanDashboard';

interface DeanTrendChartProps {
  data: TimeTrendPoint[];
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string | null;
}

export const DeanTrendChart: React.FC<DeanTrendChartProps> = ({
  data,
  onSelectDate,
  selectedDate,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showSubmitted, setShowSubmitted] = useState(true);
  const [showResolved, setShowResolved] = useState(true);
  const [showEscalated, setShowEscalated] = useState(true);

  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13px' }}>
        No trend records available for the selected timeframe.
      </div>
    );
  }

  // Calculate maximum values
  const rawMax = Math.max(
    1,
    ...data.map((d) => {
      let m = 0;
      if (showSubmitted) m = Math.max(m, d.submitted_count || 0);
      if (showResolved) m = Math.max(m, d.resolved_count || 0);
      if (showEscalated) m = Math.max(m, d.escalated_count || 0);
      return m;
    })
  );

  // Friendly round maximum for Y-axis (e.g. 509 -> 550 or 600)
  const yAxisMax = Math.ceil(rawMax * 1.08);
  const yAxisMid = Math.round(yAxisMax / 2);

  // SVG dimensions (pure responsive viewBox, no horizontal scrollbar)
  const svgWidth = 660;
  const svgHeight = 220;
  const paddingLeft = 42;
  const paddingRight = 18;
  const paddingTop = 20;
  const paddingBottom = 34;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const numPoints = data.length;
  const stepX = chartWidth / numPoints;

  // Adaptive scaling so high spikes (e.g. 509) don't reduce small counts (e.g. 2-10) to 0-pixel invisibles
  const scaleY = (val: number): number => {
    if (!val || val <= 0) return 0;
    // Power scale exponent (0.7) preserves visual hierarchy while keeping small values distinct
    const normalized = Math.min(1, val / yAxisMax);
    const scaled = Math.pow(normalized, 0.7);
    return Math.max(4, scaled * chartHeight);
  };

  const getYPos = (val: number): number => {
    return paddingTop + chartHeight - scaleY(val);
  };

  const getXPos = (idx: number): number => {
    return paddingLeft + idx * stepX + stepX / 2;
  };

  // Total summary counts
  const totalSub = data.reduce((acc, d) => acc + (d.submitted_count || 0), 0);
  const totalRes = data.reduce((acc, d) => acc + (d.resolved_count || 0), 0);
  const totalEsc = data.reduce((acc, d) => acc + (d.escalated_count || 0), 0);

  // Build smooth Area / Line paths
  const buildSmoothPath = (getValue: (d: TimeTrendPoint) => number): { linePath: string; areaPath: string } => {
    if (data.length === 0) return { linePath: '', areaPath: '' };

    const points = data.map((d, idx) => ({
      x: getXPos(idx),
      y: getYPos(getValue(d)),
    }));

    // SVG path with bezier curves
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      linePath += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const baselineY = paddingTop + chartHeight;
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

    return { linePath, areaPath };
  };

  const subPaths = showSubmitted ? buildSmoothPath((d) => d.submitted_count || 0) : null;
  const resPaths = showResolved ? buildSmoothPath((d) => d.resolved_count || 0) : null;
  const escPaths = showEscalated ? buildSmoothPath((d) => d.escalated_count || 0) : null;

  const barWidth = Math.min(10, Math.max(4, stepX * 0.22));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {/* Executive Summary Bar & Series Toggles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '6px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        {/* Period Totals (Preserves test assertions for "10 Submitted", "5 Resolved", "1 Escalated") */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px' }}>
          <span style={{ color: '#475569', fontWeight: 600 }}>Period Totals:</span>
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: '#eff6ff',
              borderRadius: '4px',
              color: '#1d4ed8',
              fontWeight: 700,
            }}
          >
            {totalSub} Submitted
          </span>
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: '#ecfdf5',
              borderRadius: '4px',
              color: '#047857',
              fontWeight: 700,
            }}
          >
            {totalRes} Resolved
          </span>
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: '#faf5ff',
              borderRadius: '4px',
              color: '#6b21a8',
              fontWeight: 700,
            }}
          >
            {totalEsc} Escalated
          </span>
        </div>

        {/* Interactive Toggle Pills (Preserves test button regex /Submitted \(10\)/i) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowSubmitted(!showSubmitted)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: showSubmitted ? '1px solid #93c5fd' : '1px dashed #cbd5e1',
              backgroundColor: showSubmitted ? '#eff6ff' : '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              color: showSubmitted ? '#1d4ed8' : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: showSubmitted ? '0 1px 2px rgba(37,99,235,0.08)' : 'none',
            }}
            title="Toggle Submitted Trajectory"
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: showSubmitted ? '#2563eb' : '#cbd5e1',
              }}
            />
            Submitted ({totalSub})
          </button>

          <button
            type="button"
            onClick={() => setShowResolved(!showResolved)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: showResolved ? '1px solid #a7f3d0' : '1px dashed #cbd5e1',
              backgroundColor: showResolved ? '#ecfdf5' : '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              color: showResolved ? '#047857' : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: showResolved ? '0 1px 2px rgba(16,185,129,0.08)' : 'none',
            }}
            title="Toggle Resolved Trajectory"
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: showResolved ? '#10b981' : '#cbd5e1',
              }}
            />
            Resolved ({totalRes})
          </button>

          <button
            type="button"
            onClick={() => setShowEscalated(!showEscalated)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: showEscalated ? '1px solid #e9d5ff' : '1px dashed #cbd5e1',
              backgroundColor: showEscalated ? '#faf5ff' : '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              color: showEscalated ? '#6b21a8' : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: showEscalated ? '0 1px 2px rgba(168,85,247,0.08)' : 'none',
            }}
            title="Toggle Escalated Trajectory"
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: showEscalated ? '#a855f7' : '#cbd5e1',
              }}
            />
            Escalated ({totalEsc})
          </button>
        </div>
      </div>

      {/* Responsive SVG Chart Canvas (NO horizontal scrollbar) */}
      <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          role="img"
          aria-label="Intake Velocity and Resolution Trends chart"
        >
          <defs>
            {/* Area Gradients */}
            <linearGradient id="submittedAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
              <stop offset="80%" stopColor="#3b82f6" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="resolvedAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="80%" stopColor="#10b981" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="escalatedAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
              <stop offset="80%" stopColor="#a855f7" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </linearGradient>

            {/* Column Bar Gradients */}
            <linearGradient id="subBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="resBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="escBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines & Y-Axis labels */}
          {/* Top Line */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft + chartWidth}
            y2={paddingTop}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text
            x={paddingLeft - 8}
            y={paddingTop + 4}
            textAnchor="end"
            fontSize="10"
            fontWeight="600"
            fill="#94a3b8"
          >
            {yAxisMax}
          </text>

          {/* Mid Line */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight / 2}
            x2={paddingLeft + chartWidth}
            y2={paddingTop + chartHeight / 2}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text
            x={paddingLeft - 8}
            y={paddingTop + chartHeight / 2 + 3}
            textAnchor="end"
            fontSize="10"
            fontWeight="500"
            fill="#94a3b8"
          >
            {yAxisMid}
          </text>

          {/* Base Axis Line */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={paddingLeft + chartWidth}
            y2={paddingTop + chartHeight}
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
          <text
            x={paddingLeft - 8}
            y={paddingTop + chartHeight + 3}
            textAnchor="end"
            fontSize="10"
            fontWeight="600"
            fill="#94a3b8"
          >
            0
          </text>

          {/* Area Fills under curves */}
          {subPaths && (
            <path d={subPaths.areaPath} fill="url(#submittedAreaGrad)" />
          )}
          {resPaths && (
            <path d={resPaths.areaPath} fill="url(#resolvedAreaGrad)" />
          )}
          {escPaths && (
            <path d={escPaths.areaPath} fill="url(#escalatedAreaGrad)" />
          )}

          {/* Clustered Columns per day */}
          {data.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            const isSelected = selectedDate === pt.date;
            const centerX = getXPos(idx);

            const subH = showSubmitted ? scaleY(pt.submitted_count || 0) : 0;
            const resH = showResolved ? scaleY(pt.resolved_count || 0) : 0;
            const escH = showEscalated ? scaleY(pt.escalated_count || 0) : 0;

            const baseY = paddingTop + chartHeight;

            // X offsets for 3 grouped bars
            const activeCount = (showSubmitted ? 1 : 0) + (showResolved ? 1 : 0) + (showEscalated ? 1 : 0);
            const totalGroupWidth = activeCount * barWidth + (activeCount - 1) * 2;
            let currentX = centerX - totalGroupWidth / 2;

            return (
              <g key={idx}>
                {/* Full-height Day Hover Column */}
                <rect
                  x={paddingLeft + idx * stepX}
                  y={paddingTop}
                  width={stepX}
                  height={chartHeight + paddingBottom}
                  fill={isHovered ? 'rgba(241, 245, 249, 0.7)' : isSelected ? 'rgba(224, 242, 254, 0.5)' : 'transparent'}
                  style={{ cursor: onSelectDate ? 'pointer' : 'default', transition: 'fill 0.15s ease' }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onSelectDate && onSelectDate(pt.date)}
                />

                {/* Vertical guide line on hover */}
                {isHovered && (
                  <line
                    x1={centerX}
                    y1={paddingTop}
                    x2={centerX}
                    y2={baseY}
                    stroke="#0284c7"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                    pointerEvents="none"
                  />
                )}

                {/* Submitted Bar */}
                {showSubmitted && (
                  <>
                    <rect
                      x={currentX}
                      y={baseY - subH}
                      width={barWidth}
                      height={subH}
                      rx="3"
                      fill="url(#subBarGrad)"
                      opacity={isHovered ? 1 : 0.88}
                      pointerEvents="none"
                    />
                    <span style={{ display: 'none' }}>{((currentX += barWidth + 2), '')}</span>
                  </>
                )}

                {/* Resolved Bar */}
                {showResolved && (
                  <>
                    <rect
                      x={currentX}
                      y={baseY - resH}
                      width={barWidth}
                      height={resH}
                      rx="3"
                      fill="url(#resBarGrad)"
                      opacity={isHovered ? 1 : 0.88}
                      pointerEvents="none"
                    />
                    <span style={{ display: 'none' }}>{((currentX += barWidth + 2), '')}</span>
                  </>
                )}

                {/* Escalated Bar */}
                {showEscalated && (
                  <rect
                    x={currentX}
                    y={baseY - escH}
                    width={barWidth}
                    height={escH}
                    rx="3"
                    fill="url(#escBarGrad)"
                    opacity={isHovered ? 1 : 0.88}
                    pointerEvents="none"
                  />
                )}

                {/* X-Axis Date Label */}
                <text
                  x={centerX}
                  y={baseY + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isHovered || isSelected ? '700' : '500'}
                  fill={isHovered || isSelected ? 'var(--vyasa-navy)' : '#64748b'}
                  pointerEvents="none"
                >
                  {pt.period}
                </text>
              </g>
            );
          })}

          {/* Smooth Trend Spline Lines */}
          {subPaths && (
            <path
              d={subPaths.linePath}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}
          {resPaths && (
            <path
              d={resPaths.linePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}
          {escPaths && (
            <path
              d={escPaths.linePath}
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* Active Data Dots on Hover */}
          {hoveredIdx !== null && data[hoveredIdx] && (
            <g pointerEvents="none">
              {showSubmitted && (
                <circle
                  cx={getXPos(hoveredIdx)}
                  cy={getYPos(data[hoveredIdx].submitted_count || 0)}
                  r="4.5"
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
              {showResolved && (
                <circle
                  cx={getXPos(hoveredIdx)}
                  cy={getYPos(data[hoveredIdx].resolved_count || 0)}
                  r="4.5"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
              {showEscalated && (
                <circle
                  cx={getXPos(hoveredIdx)}
                  cy={getYPos(data[hoveredIdx].escalated_count || 0)}
                  r="4.5"
                  fill="#a855f7"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>

        {/* Floating Tooltip Box */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: `${Math.min(78, Math.max(22, (hoveredIdx / (data.length - 1)) * 100))}%`,
              transform: 'translateX(-50%)',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '9px 13px',
              borderRadius: '7px',
              fontSize: '11px',
              zIndex: 30,
              boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
              pointerEvents: 'none',
              minWidth: '150px',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: '11.5px',
                borderBottom: '1px solid rgba(255,255,255,0.18)',
                paddingBottom: '4px',
                marginBottom: '5px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{data[hoveredIdx].period}</span>
              <span style={{ color: '#94a3b8', fontSize: '10px' }}>{data[hoveredIdx].date}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', lineHeight: 1.4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: '#93c5fd' }}>
                <span>● Submitted:</span>
                <strong style={{ color: '#ffffff' }}>{data[hoveredIdx].submitted_count || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: '#a7f3d0' }}>
                <span>● Resolved:</span>
                <strong style={{ color: '#ffffff' }}>{data[hoveredIdx].resolved_count || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: '#e9d5ff' }}>
                <span>● Escalated:</span>
                <strong style={{ color: '#ffffff' }}>{data[hoveredIdx].escalated_count || 0}</strong>
              </div>
              {data[hoveredIdx].active_backlog !== undefined && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px',
                    color: '#fef08a',
                    paddingTop: '3px',
                    borderTop: '1px dashed rgba(255,255,255,0.15)',
                    marginTop: '2px',
                  }}
                >
                  <span>Active Backlog:</span>
                  <strong>{data[hoveredIdx].active_backlog}</strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
