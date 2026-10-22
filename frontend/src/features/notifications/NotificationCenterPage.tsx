import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PageContainer,
  Badge,
  Button,
  AppIcon,
  EmptyState,
  LoadingState,
  formatDateIST,
} from '@vyasa/ui';
import { notificationService } from '../../services/notificationService';
import {
  NotificationItem,
  NotificationSummary,
  PillarMetadata,
  NotificationPreferenceItem,
} from '../../types/notification';
import { useAuth } from '../../context/AuthContext';
import './Notification.css';

type FilterTab = 'ALL' | 'UNREAD' | 'ACTION_REQUIRED';

export const NotificationCenterPage: React.FC = () => {
  const { isAuthenticated, displayName } = useAuth();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [selectedPillar, setSelectedPillar] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [pillars, setPillars] = useState<PillarMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const pageSize = 20;

  // Preferences Modal state
  const [isPrefModalOpen, setIsPrefModalOpen] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<NotificationPreferenceItem[]>([]);
  const [updatingPref, setUpdatingPref] = useState<boolean>(false);

  // Fetch summary and pillars
  const loadMetadata = async () => {
    try {
      const [sumData, pilData] = await Promise.all([
        notificationService.getSummary(),
        notificationService.getPillars(),
      ]);
      setSummary(sumData);
      setPillars(pilData);
    } catch {
      // Non-fatal
    }
  };

  // Fetch notifications according to current filters
  const fetchItems = useCallback(
    async (resetPage: boolean = true) => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      const targetPage = resetPage ? 0 : page;
      if (resetPage) {
        setLoading(true);
        setPage(0);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const isReadFilter =
          activeTab === 'UNREAD' ? false : undefined;
        const actionReqFilter =
          activeTab === 'ACTION_REQUIRED' ? true : undefined;

        const res = await notificationService.getNotifications({
          is_read: isReadFilter,
          action_required: actionReqFilter,
          source_pillar: selectedPillar !== 'ALL' ? selectedPillar : undefined,
          priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
          search: searchQuery.trim() || undefined,
          skip: targetPage * pageSize,
          limit: pageSize,
        });

        if (resetPage) {
          setItems(res.notifications);
        } else {
          setItems((prev) => [...prev, ...res.notifications]);
        }
        setTotalCount(res.count);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load notifications';
        setError(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [isAuthenticated, activeTab, selectedPillar, selectedPriority, searchQuery, page]
  );

  useEffect(() => {
    loadMetadata();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchItems(true);
    }
  }, [isAuthenticated, activeTab, selectedPillar, selectedPriority]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems(true);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    notificationService
      .getNotifications({
        is_read: activeTab === 'UNREAD' ? false : undefined,
        action_required: activeTab === 'ACTION_REQUIRED' ? true : undefined,
        source_pillar: selectedPillar !== 'ALL' ? selectedPillar : undefined,
        priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
        search: searchQuery.trim() || undefined,
        skip: nextPage * pageSize,
        limit: pageSize,
      })
      .then((res) => {
        setItems((prev) => [...prev, ...res.notifications]);
        setTotalCount(res.count);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error loading more');
      });
  };

  const handleToggleRead = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await notificationService.markAsRead(item.id);
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
        );
        loadMetadata();
      } catch {
        // Handle gracefully
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await notificationService.markAllAsRead(selectedPillar !== 'ALL' ? selectedPillar : undefined);
      await Promise.all([loadMetadata(), fetchItems(true)]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
      setLoading(false);
    }
  };

  const handleOpenPreferences = async () => {
    setIsPrefModalOpen(true);
    try {
      const prefs = await notificationService.getPreferences();
      setPreferences(prefs);
    } catch {
      // Non-fatal
    }
  };

  const handleToggleChannelPref = async (pillar: string, channel: 'in_app' | 'email', currentVal: boolean) => {
    try {
      setUpdatingPref(true);
      const updated = await notificationService.updatePreference({
        source_pillar: pillar,
        event_type: '*',
        in_app_enabled: channel === 'in_app' ? !currentVal : true,
        email_enabled: channel === 'email' ? !currentVal : true,
      });
      setPreferences((prev) => {
        const idx = prev.findIndex((p) => p.source_pillar === pillar);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = updated;
          return clone;
        }
        return [...prev, updated];
      });
    } finally {
      setUpdatingPref(false);
    }
  };

  const getPillarDisplayName = (pillarKey: string) => {
    const found = pillars.find((p) => p.pillar_id === pillarKey);
    if (found) return found.display_name;
    if (pillarKey === 'NIVARAN') return 'VYASA-N | NIVARAN';
    if (pillarKey === 'VYASA_AI') return 'VYASA-N | VYASA AI';
    if (pillarKey === 'VYASA_CORE') return 'VYASA-N | CORE';
    return `VYASA-N | ${pillarKey}`;
  };

  const unreadCount = summary?.unread_count || 0;
  const actionReqCount = summary?.action_required_count || 0;
  const hasMore = items.length < totalCount;

  return (
    <PageContainer style={{ padding: '32px 0 80px' }}>
      <div className="vyasa-notif-container">
        {/* 1. Header */}
        <div className="vyasa-notif-header">
          <div className="vyasa-notif-header__title-group">
            <h1>
              <AppIcon name="bell" size={26} color="var(--vyasa-gold, #d4a017)" />
              Unified Notification Centre
            </h1>
            <p className="vyasa-notif-header__subtitle">
              Centralized cross-pillar communications, alerts, and pending action items for {displayName || 'Account'}
            </p>
          </div>

          <div className="vyasa-notif-header__actions">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={loading}
              >
                Mark All Read
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPreferences}
            >
              <AppIcon name="settings" size={14} color="currentColor" />
              Preferences
            </Button>
          </div>
        </div>

        {/* 2. KPI Metrics Strip */}
        <div className="vyasa-notif-kpi-strip">
          <div className="vyasa-notif-kpi-card">
            <span className="vyasa-notif-kpi-card__label">Total Messages</span>
            <span className="vyasa-notif-kpi-card__val">{summary?.total_count || 0}</span>
          </div>
          <div className="vyasa-notif-kpi-card vyasa-notif-kpi-card--unread">
            <span className="vyasa-notif-kpi-card__label">Unread Items</span>
            <span className="vyasa-notif-kpi-card__val">{unreadCount}</span>
          </div>
          <div className="vyasa-notif-kpi-card vyasa-notif-kpi-card--action">
            <span className="vyasa-notif-kpi-card__label">Action Required</span>
            <span className="vyasa-notif-kpi-card__val">{actionReqCount}</span>
          </div>
          <div className="vyasa-notif-kpi-card">
            <span className="vyasa-notif-kpi-card__label">Active Pillars</span>
            <span className="vyasa-notif-kpi-card__val">{pillars.length || 3} Connected</span>
          </div>
        </div>

        {/* 3. Filter Bar */}
        <div className="vyasa-notif-filter-bar">
          <div className="vyasa-notif-tabs-row">
            {/* Main Tabs */}
            <div className="vyasa-notif-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'ALL'}
                className={`vyasa-notif-tab ${activeTab === 'ALL' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('ALL')}
              >
                <span>All Notifications</span>
                <span className="vyasa-notif-tab__badge">{summary?.total_count || 0}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'UNREAD'}
                className={`vyasa-notif-tab ${activeTab === 'UNREAD' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('UNREAD')}
              >
                <span>Unread</span>
                <span className="vyasa-notif-tab__badge">{unreadCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'ACTION_REQUIRED'}
                className={`vyasa-notif-tab vyasa-notif-tab--action ${activeTab === 'ACTION_REQUIRED' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('ACTION_REQUIRED')}
              >
                <span>Action Required</span>
                <span className="vyasa-notif-tab__badge">{actionReqCount}</span>
              </button>
            </div>

            {/* Keyword Search */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search title, case ID..."
                className="vyasa-notif-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button variant="outline" size="sm" type="submit">
                Search
              </Button>
            </form>
          </div>

          {/* Subfilters: Pillar & Priority */}
          <div className="vyasa-notif-subfilters">
            <div className="vyasa-notif-filter-group">
              <label htmlFor="pillar-select">Pillar / Subsystem:</label>
              <select
                id="pillar-select"
                className="vyasa-notif-filter-select"
                value={selectedPillar}
                onChange={(e) => setSelectedPillar(e.target.value)}
              >
                <option value="ALL">All Registered Pillars</option>
                {pillars.map((p) => (
                  <option key={p.pillar_id} value={p.pillar_id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="vyasa-notif-filter-group">
              <label htmlFor="priority-select">Priority:</label>
              <select
                id="priority-select"
                className="vyasa-notif-filter-select"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. Notification List */}
        {loading ? (
          <LoadingState message="Synchronizing ecosystem notifications..." />
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <p style={{ color: '#dc2626', fontWeight: 600 }}>{error}</p>
            <Button variant="primary" size="sm" onClick={() => fetchItems(true)}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No Notifications Found"
            description={
              activeTab === 'UNREAD'
                ? 'You have caught up with all institutional updates.'
                : activeTab === 'ACTION_REQUIRED'
                ? 'No immediate items require your intervention.'
                : 'No platform notifications match the active criteria.'
            }
            action={
              (activeTab !== 'ALL' || selectedPillar !== 'ALL' || selectedPriority !== 'ALL' || searchQuery) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveTab('ALL');
                    setSelectedPillar('ALL');
                    setSelectedPriority('ALL');
                    setSearchQuery('');
                  }}
                >
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="vyasa-notif-list" role="feed" aria-label="Notification feed">
            {items.map((item) => {
              const pillarClass =
                item.source_pillar === 'NIVARAN'
                  ? 'vyasa-notif-pillar-tag--nivaran'
                  : item.source_pillar === 'VYASA_AI'
                  ? 'vyasa-notif-pillar-tag--vyasa-ai'
                  : '';

              return (
                <article
                  key={item.id}
                  className={`vyasa-notif-item ${!item.is_read ? 'vyasa-notif-item--unread' : ''} ${
                    item.action_required && !item.is_read ? 'vyasa-notif-item--action' : ''
                  }`}
                >
                  <div className="vyasa-notif-item__top">
                    <div className="vyasa-notif-item__chips">
                      <span className={`vyasa-notif-pillar-tag ${pillarClass}`}>
                        {item.source_display_name || getPillarDisplayName(item.source_pillar)}
                      </span>
                      <span className={`vyasa-notif-priority-badge vyasa-notif-priority--${item.priority}`}>
                        {item.priority}
                      </span>
                      {item.action_required && (
                        <span className="vyasa-notif-action-req-badge">
                          <AppIcon name="alert-circle" size={12} color="#ffffff" />
                          Action Required
                        </span>
                      )}
                      {!item.is_read && (
                        <Badge variant="saffron" size="sm">
                          New
                        </Badge>
                      )}
                    </div>

                    <span className="vyasa-notif-item__time">
                      {formatDateIST(item.created_at)}
                    </span>
                  </div>

                  <div className="vyasa-notif-item__body">
                    <h3 className="vyasa-notif-item__title">{item.title}</h3>
                    <p className="vyasa-notif-item__message">{item.message}</p>
                  </div>

                  <div className="vyasa-notif-item__footer">
                    <div>
                      {item.action_route && (
                        <button
                          type="button"
                          className="vyasa-notif-item__route-btn"
                          onClick={() => {
                            handleToggleRead(item);
                            navigate(item.action_route!);
                          }}
                        >
                          <span>Open Destination</span>
                          <AppIcon name="arrow-right" size={14} color="currentColor" />
                        </button>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        className="vyasa-notif-item__toggle-btn"
                        onClick={() => handleToggleRead(item)}
                      >
                        {item.is_read ? 'Marked as Read' : 'Mark as Read'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading More...' : `Load More (${totalCount - items.length} remaining)`}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 5. Notification Preferences Modal */}
        {isPrefModalOpen && (
          <div className="vyasa-pref-backdrop" onClick={() => setIsPrefModalOpen(false)}>
            <div className="vyasa-pref-modal" onClick={(e) => e.stopPropagation()}>
              <div className="vyasa-pref-modal__header">
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-navy, #1b2a4a)' }}>
                  Notification Delivery Preferences
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPrefModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <AppIcon name="close" size={18} color="#64748b" />
                </button>
              </div>

              <div className="vyasa-pref-modal__body">
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Configure your preferred delivery channels for each connected governance pillar:
                </p>

                {pillars.map((p) => {
                  const pref = preferences.find((prefItem) => prefItem.source_pillar === p.pillar_id);
                  const inAppOn = pref ? pref.in_app_enabled : true;
                  const emailOn = pref ? pref.email_enabled : true;

                  return (
                    <div
                      key={p.pillar_id}
                      style={{
                        padding: '12px 14px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: '#f8fafc',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', marginBottom: '8px' }}>
                        {p.display_name}
                      </div>

                      <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={inAppOn}
                            disabled={updatingPref}
                            onChange={() => handleToggleChannelPref(p.pillar_id, 'in_app', inAppOn)}
                          />
                          In-App Inbox
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={emailOn}
                            disabled={updatingPref}
                            onChange={() => handleToggleChannelPref(p.pillar_id, 'email', emailOn)}
                          />
                          Institutional Email
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                <Button variant="primary" size="sm" onClick={() => setIsPrefModalOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};
