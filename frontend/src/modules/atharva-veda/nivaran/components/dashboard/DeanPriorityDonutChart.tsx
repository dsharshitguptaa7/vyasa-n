import React, { useState } from 'react';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DeanPriorityDonutChartProps {
  priorityCounts: Record<string, number>;
  onSelectPriority?: (priority: string) => void;
  selectedPriority?: string;
  totalCases?: number;
}

export const DeanPriorityDonutChart: React.FC<DeanPriorityDonutChartProps> = ({
  priorityCounts,
  onSelectPriority,
  selectedPriority,
  totalCases,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const colorMap: Record<string, string> = {
    CRITICAL: '#e11d48', // rose-600
    URGENT: '#ea580c',   // orange-600
    HIGH: '#f59e0b',     // amber-500
    MEDIUM: '#0284c7',   // sky-600
    LOW: '#10b981',      // emerald-500
  };

  const slices: DonutSlice[] = Object.entries(priorityCounts || {})
    .filter(([_, val]) => val > 0)
    .map(([key, val]) => ({
      key,
      label: key,
      value: val,
      color: colorMap[key] || '#64748b',
    }));

  const total = totalCases || slices.reduce((acc, s) => acc + s.value, 0);

  if (total === 0 || slices.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: '13px' }}>
        No priority distribution data recorded.
      </div>
    );
  }

  // Trigonometric arc calculations for SVG Donut
  const size = 180;
  const radius = 70;
  const innerRadius = 45;
  const center = size / 2;

  let cumulativeAngle = 0;
  const arcs = slices.map((slice) => {
    const angle = (slice.value / total) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    // Convert angles to radians
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const x1Inner = center + innerRadius * Math.cos(startRad);
    const y1Inner = center + innerRadius * Math.sin(startRad);
    const x2Inner = center + innerRadius * Math.cos(endRad);
    const y2Inner = center + innerRadius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    // SVG path definition for donut arc
    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x2Inner} ${y2Inner}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1Inner} ${y1Inner}`,
      'Z',
    ].join(' ');

    const percentage = ((slice.value / total) * 100).toFixed(1);

    return {
      ...slice,
      pathData,
      percentage,
    };
  });

  const activeSlice = slices.find((s) => s.key === (hoveredKey || selectedPriority));
  const activePercent = activeSlice ? ((activeSlice.value / total) * 100).toFixed(1) : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      {/* SVG Donut */}
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          {arcs.map((arc) => {
            const isHovered = hoveredKey === arc.key;
            const isSelected = selectedPriority === arc.key;
            return (
              <path
                key={arc.key}
                d={arc.pathData}
                fill={arc.color}
                opacity={isHovered || isSelected ? 1 : 0.85}
                stroke="#ffffff"
                strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
                style={{
                  cursor: onSelectPriority ? 'pointer' : 'default',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                  transformOrigin: `${center}px ${center}px`,
                  transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                }}
                onMouseEnter={() => setHoveredKey(arc.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => onSelectPriority && onSelectPriority(arc.key === selectedPriority ? 'ALL' : arc.key)}
              >
                <title>{`${arc.label}: ${arc.value} cases (${arc.percentage}%)`}</title>
              </path>
            );
          })}

          {/* Center text in donut hole */}
          <text
            x={center}
            y={center - 6}
            textAnchor="middle"
            style={{
              fontSize: activeSlice ? '11px' : '10px',
              fontWeight: 700,
              fill: activeSlice ? activeSlice.color : '#64748b',
              textTransform: 'uppercase',
            }}
          >
            {activeSlice ? activeSlice.label : 'TOTAL'}
          </text>
          <text
            x={center}
            y={center + 14}
            textAnchor="middle"
            style={{
              fontSize: '18px',
              fontWeight: 800,
              fill: 'var(--vyasa-navy)',
            }}
          >
            {activeSlice ? activeSlice.value : total}
          </text>
          {activePercent && (
            <text
              x={center}
              y={center + 28}
              textAnchor="middle"
              style={{
                fontSize: '9px',
                fontWeight: 600,
                fill: '#64748b',
              }}
            >
              {activePercent}% share
            </text>
          )}
        </svg>
      </div>

      {/* Legend list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '140px' }}>
        {arcs.map((arc) => {
          const isSelected = selectedPriority === arc.key;
          const isHovered = hoveredKey === arc.key;
          return (
            <div
              key={arc.key}
              data-testid={`priority-donut-${arc.key}`}
              onMouseEnter={() => setHoveredKey(arc.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => onSelectPriority && onSelectPriority(arc.key === selectedPriority ? 'ALL' : arc.key)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: onSelectPriority ? 'pointer' : 'default',
                backgroundColor: isSelected ? '#e0f2fe' : isHovered ? '#f8fafc' : 'transparent',
                border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: arc.color }} />
                <span style={{ fontSize: '12px', fontWeight: isSelected || isHovered ? 700 : 500, color: '#334155' }}>
                  {arc.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                <span style={{ fontWeight: 700, color: 'var(--vyasa-navy)' }}>{arc.value}</span>
                <span style={{ color: '#64748b' }}>({arc.percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
