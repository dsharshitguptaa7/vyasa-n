import React, { useState } from 'react';
import { Badge } from '@vyasa/ui';
import { ExecutiveActivityFeedItem } from '../../types/deanDashboard';

interface DeanActivityFeedProps {
  activities: ExecutiveActivityFeedItem[];
  onSelectCase?: (trackingId: string) => void;
}

export const DeanActivityFeed: React.FC<DeanActivityFeedProps> = ({
  activities,
  onSelectCase,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  if (!activities || activities.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: '13px' }}>
        No recent activity recorded.
      </div>
    );
  }

  // Filter activities
  const filtered = activities.filter((act) => {
    if (filterType !== 'ALL' && act.event_type !== filterType) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        act.tracking_id.toLowerCase().includes(q) ||
        act.title.toLowerCase().includes(q) ||
        act.actor_name.toLowerCase().includes(q) ||
        act.description.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Search & Filter pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '4px' }}>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'ESCALATED', label: 'Escalations' },
            { id: 'RESOLVED', label: 'Resolutions' },
            { id: 'ASSIGNED', label: 'Assignments' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setFilterType(pill.id)}
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                backgroundColor: filterType === pill.id ? '#ffffff' : 'transparent',
                color: filterType === pill.id ? 'var(--vyasa-navy)' : '#64748b',
                boxShadow: filterType === pill.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter activity..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '3px 8px',
            fontSize: '11px',
            borderRadius: '4px',
            border: '1px solid #cbd5e1',
            width: '130px',
          }}
        />
      </div>

      {/* Activity List Stream */}
      <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: '12px' }}>
            No matching events found.
          </div>
        ) : (
          filtered.map((act) => (
            <div
              key={act.id}
              onClick={() => onSelectCase && onSelectCase(act.tracking_id)}
              style={{
                padding: '8px 10px',
                backgroundColor: '#ffffff',
                border: '1px solid #f1f5f9',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: onSelectCase ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <strong style={{ color: 'var(--vyasa-navy)', fontSize: '12px' }}>{act.tracking_id}</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>{act.timestamp_display}</span>
              </div>
              <div style={{ color: '#334155', lineHeight: 1.4, marginBottom: '4px' }}>
                {act.description}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b' }}>
                <span>Actor: <strong>{act.actor_name}</strong></span>
                <Badge variant={act.actor_role === 'DEAN' ? 'saffron' : 'teal'}>{act.actor_role}</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
