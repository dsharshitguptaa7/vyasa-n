import React, { useEffect, useState, useCallback } from 'react';
import { healthService } from '../../../services';
import { HealthCheckData } from '../../../types';
import { Card, Badge, Button, LoadingState, formatTimeIST } from '@vyasa/ui';

export const SystemStatusCard: React.FC = () => {
  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await healthService.checkHealth();
      setHealth(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to connect to Core Backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    healthService
      .checkHealth()
      .then((data) => {
        if (isMounted) {
          setHealth(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to connect to Core Backend');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Card
      variant="gold-accent"
      title="VYASA Core Telemetry &amp; Health"
      subtitle="Live backend diagnostic endpoint (GET /api/health)"
      headerAction={
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHealthData}
          title="Refresh Core Health"
        >
          &#x21bb; Refresh
        </Button>
      }
    >
      {loading ? (
        <LoadingState message="Checking connection to VYASA Core service..." size="sm" />
      ) : error ? (
        <div style={{ padding: '16px', backgroundColor: 'var(--vyasa-danger-light)', borderRadius: 'var(--vyasa-radius-sm)', border: '1px solid var(--vyasa-danger-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <strong style={{ color: 'var(--vyasa-danger)', fontSize: '14px' }}>
              Core Backend Unreachable
            </strong>
            <Badge variant="neutral" size="sm">
              Offline
            </Badge>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', margin: 0 }}>
            Ensure the Express backend is running on <code>http://localhost:5000</code>.
          </p>
        </div>
      ) : health ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--vyasa-success)',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--vyasa-primary)' }}>
                {health.service}
              </span>
            </div>
            <Badge variant="teal" size="sm">
              {health.status.toUpperCase()}
            </Badge>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
            }}
          >
            <div style={{ backgroundColor: 'var(--vyasa-surface-warm)', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--vyasa-border-subtle)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--vyasa-text-muted)' }}>Version</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vyasa-text)', marginTop: '2px' }}>{health.version}</div>
            </div>
            <div style={{ backgroundColor: 'var(--vyasa-surface-warm)', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--vyasa-border-subtle)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--vyasa-text-muted)' }}>Environment</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vyasa-text)', marginTop: '2px' }}>{health.environment}</div>
            </div>
            <div style={{ backgroundColor: 'var(--vyasa-surface-warm)', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--vyasa-border-subtle)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--vyasa-text-muted)' }}>Uptime</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vyasa-text)', marginTop: '2px' }}>{health.uptimeSeconds}s</div>
            </div>
            <div style={{ backgroundColor: 'var(--vyasa-surface-warm)', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--vyasa-border-subtle)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--vyasa-text-muted)' }}>Checked At (IST)</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vyasa-text)', marginTop: '2px' }}>
                {formatTimeIST(health.timestamp)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
};
