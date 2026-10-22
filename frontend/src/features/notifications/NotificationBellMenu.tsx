import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationBell, AppIcon, formatDateIST } from '@vyasa/ui';
import { notificationService } from '../../services/notificationService';
import { NotificationItem, NotificationSummary } from '../../types/notification';
import { useAuth } from '../../context/AuthContext';
import './Notification.css';

interface NotificationBellMenuProps {
  className?: string;
  size?: number;
}

export const NotificationBellMenu: React.FC<NotificationBellMenuProps> = ({
  className = '',
  size = 18,
}) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [recentItems, setRecentItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Poll / refresh unread badge when authenticated
  const loadSummaryAndRecent = async () => {
    if (!isAuthenticated) return;
    try {
      const sum = await notificationService.getSummary();
      setSummary(sum);
      if (sum.total_count > 0) {
        const notifs = await notificationService.getNotifications({ limit: 5 });
        setRecentItems(notifs.notifications);
      } else {
        setRecentItems([]);
      }
    } catch {
      // Non-fatal if unauthenticated or network error
    }
  };

  useEffect(() => {
    loadSummaryAndRecent();
    const interval = setInterval(loadSummaryAndRecent, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      loadSummaryAndRecent();
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await notificationService.markAsRead(item.id);
        setRecentItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
        setSummary((prev) =>
          prev ? { ...prev, unread_count: Math.max(0, prev.unread_count - 1) } : prev
        );
      } catch {
        // Continue navigation regardless
      }
    }
    setIsOpen(false);
    if (item.action_route) {
      navigate(item.action_route);
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await notificationService.markAllAsRead();
      setRecentItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setSummary((prev) => (prev ? { ...prev, unread_count: 0 } : prev));
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = summary?.unread_count || 0;
  const hasUnread = unreadCount > 0;

  const getPillarLabel = (pillar: string) => {
    if (pillar === 'NIVARAN') return 'VYASA-N | NIVARAN';
    if (pillar === 'VYASA_AI') return 'VYASA-N | VYASA AI';
    if (pillar === 'VYASA_CORE') return 'VYASA-N | CORE';
    return `VYASA-N | ${pillar}`;
  };

  return (
    <div className={`vyasa-bell-wrapper ${className}`} ref={menuRef}>
      <button
        type="button"
        className={`vyasa-bell-trigger ${isOpen ? 'is-active' : ''}`}
        onClick={handleToggle}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Institutional Notifications"
      >
        <NotificationBell size={size} color="currentColor" hasUnread={false} />
        {hasUnread && (
          <span className="vyasa-bell-badge-pill" data-testid="notification-badge-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="vyasa-bell-popover" role="region" aria-label="Notifications Dropdown">
          <div className="vyasa-bell-popover__header">
            <span className="vyasa-bell-popover__header-title">
              Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--vyasa-teal, #0d9488)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="vyasa-bell-popover__list">
            {recentItems.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                <AppIcon name="bell" size={24} color="#94a3b8" />
                <p style={{ marginTop: '8px', marginBottom: 0 }}>No notifications at this time.</p>
              </div>
            ) : (
              recentItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`vyasa-bell-popover__item ${!item.is_read ? 'vyasa-bell-popover__item--unread' : ''}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(item)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: item.source_pillar === 'NIVARAN' ? '#92400e' : '#0369a1',
                      }}
                    >
                      {item.source_display_name || getPillarLabel(item.source_pillar)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {formatDateIST(item.created_at)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!item.is_read && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--vyasa-saffron, #c85602)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: item.is_read ? 500 : 700,
                        color: 'var(--vyasa-navy, #1b2a4a)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      color: '#475569',
                      margin: 0,
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.message}
                  </p>

                  {item.action_required && (
                    <div style={{ marginTop: '2px' }}>
                      <span className="vyasa-notif-action-req-badge" style={{ fontSize: '10px', padding: '1px 5px' }}>
                        Action Required
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="vyasa-bell-popover__footer">
            <button
              type="button"
              className="vyasa-bell-popover__view-all-btn"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
            >
              Open Unified Notification Centre &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
