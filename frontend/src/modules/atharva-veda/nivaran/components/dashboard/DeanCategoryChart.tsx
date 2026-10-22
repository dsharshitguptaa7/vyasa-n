import React, { useState } from 'react';
import { CategoryAnalyticsItem } from '../../types/deanDashboard';

interface DeanCategoryChartProps {
  categories: CategoryAnalyticsItem[];
  selectedCategoryId?: string;
  onSelectCategory: (categoryId: string) => void;
}

export const DeanCategoryChart: React.FC<DeanCategoryChartProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!categories || categories.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: '13px' }}>
        No category distribution data available.
      </div>
    );
  }

  // Sorted by total_count descending
  const sorted = [...categories].sort((a, b) => (b.total_count || 0) - (a.total_count || 0));
  const displayed = showAll ? sorted : sorted.slice(0, 6);
  const maxTotal = Math.max(1, ...sorted.map((c) => c.total_count || 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
        <span>
          Ranking by Total Grievance Volume ({sorted.length} categories)
        </span>
        {sorted.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0369a1',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '11px',
              padding: '2px 6px',
            }}
          >
            {showAll ? 'Show Top 6' : `Show All (${sorted.length})`}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displayed.map((cat) => {
          const isSelected = selectedCategoryId === cat.category_id;
          const isHovered = hoveredId === cat.category_id;
          const totalWidth = ((cat.total_count || 0) / maxTotal) * 100;
          const activeRatio = cat.total_count > 0 ? ((cat.active_count || 0) / cat.total_count) * 100 : 0;
          const resolvedRatio = cat.total_count > 0 ? ((cat.resolved_count || 0) / cat.total_count) * 100 : 0;

          return (
            <div
              key={cat.category_id}
              data-testid={`category-bar-${cat.category_id}`}
              onMouseEnter={() => setHoveredId(cat.category_id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelectCategory(cat.category_id)}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: isSelected ? '#e0f2fe' : isHovered ? '#f8fafc' : 'transparent',
                border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              title={`Click to filter ledger by "${cat.category_name}"`}
            >
              {/* Category label row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>
                    {cat.category_name}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      backgroundColor: cat.routing_type === 'FIXED_AUTHORITY' ? '#fef3c7' : '#f1f5f9',
                      color: cat.routing_type === 'FIXED_AUTHORITY' ? '#92400e' : '#475569',
                      fontWeight: 600,
                    }}
                  >
                    {cat.routing_type.replace('_', ' ')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
                  <span style={{ color: '#0369a1', fontWeight: 600 }}>{cat.percentage}% share</span>
                  <span style={{ color: '#475569', fontWeight: 700 }}>{cat.total_count} total</span>
                  <span style={{ color: '#64748b' }}>Avg: {cat.avg_age_display}</span>
                </div>
              </div>

              {/* Stacked Proportional Bar */}
              <div
                style={{
                  height: '8px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  width: `${Math.max(10, totalWidth)}%`,
                  display: 'flex',
                  transition: 'width 0.3s ease',
                }}
              >
                {/* Active portion */}
                <div
                  style={{
                    width: `${activeRatio}%`,
                    backgroundColor: '#f59e0b',
                    height: '100%',
                  }}
                  title={`Active: ${cat.active_count}`}
                />
                {/* Resolved portion */}
                <div
                  style={{
                    width: `${resolvedRatio}%`,
                    backgroundColor: '#10b981',
                    height: '100%',
                  }}
                  title={`Resolved: ${cat.resolved_count}`}
                />
              </div>

              {/* Hover breakdown hint */}
              {isHovered && (
                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '10px',
                    color: '#64748b',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  <span style={{ color: '#b45309', fontWeight: 600 }}>● {cat.active_count} Active</span>
                  <span style={{ color: '#047857', fontWeight: 600 }}>● {cat.resolved_count} Resolved</span>
                  <span>Click to drill down into records</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bar Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: '#64748b', justifyContent: 'flex-end' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '2px' }} />
          Active Cases
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '2px' }} />
          Resolved Cases
        </span>
      </div>
    </div>
  );
};
