import React, { useState, useEffect } from 'react';
import { Card, Badge, LoadingState, EmptyState, formatDateIST } from '@vyasa/ui';
import { applicantService, ApplicantNotificationItem } from '../services/applicantService';
import { useAuth } from '../../../context/AuthContext';

export const ApplicantNotifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ApplicantNotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const loadNotifs = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const list = await applicantService.getNotifications(user.id);
        if (isMounted) {
          setNotifications(list);
        }
      } catch {
        if (isMounted) {
          setNotifications([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadNotifs();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  if (loading) {
    return <LoadingState message="Loading platform announcements and notifications..." />;
  }

  return (
    <Card
      variant="scholarly"
      title="Platform Notifications"
      subtitle="Ecosystem announcements and account communications"
      headerAction={<Badge variant="teal">{notifications.length} Alerts</Badge>}
    >
      <div style={{ padding: '8px 0' }}>
        {notifications.length === 0 ? (
          <EmptyState
            title="No Active Notifications"
            description="You are fully up to date. There are currently no pending institutional notices or system alerts for your account."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '14px 16px',
                  backgroundColor: n.is_read ? 'transparent' : 'rgba(27, 42, 74, 0.03)',
                  border: '1px solid var(--vyasa-border)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px',
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '15px', color: 'var(--vyasa-navy)', fontWeight: 600 }}>
                    {n.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)', lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)' }}>
                    {formatDateIST(n.created_at)}
                  </span>
                  {!n.is_read && (
                    <div style={{ marginTop: '4px' }}>
                      <Badge variant="saffron">New</Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
