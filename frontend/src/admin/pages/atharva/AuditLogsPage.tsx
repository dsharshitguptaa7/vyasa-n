import React, { useEffect, useState, useCallback } from 'react';
import { LoadingState, Button, Badge, Modal, Input, Select, AppIcon } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import { AuditLog } from '../../types/atharva';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [moduleFilter, setModuleFilter] = useState<string>('atharva_veda');
  const [actionSearch, setActionSearch] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const limit = 20;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await atharvaAdminService.getAuditLogs({
        module: moduleFilter || undefined,
        action: actionSearch || undefined,
        limit,
        offset: page * limit,
      });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, actionSearch, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminLayout activeTab="audit-logs">

      {/* Official Audit Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          padding: '20px 24px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid var(--vyasa-border, #e3dcd1)',
          boxShadow: 'var(--vyasa-shadow-sm)',
        }}
      >
        <div style={{ maxWidth: '820px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--vyasa-gold, #b2811a)',
              marginBottom: '3px',
            }}
          >
            Activity Log &bull; System History
          </div>
          <h2
            style={{
              margin: '0 0 6px',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--vyasa-primary, #0f2b48)',
              fontFamily: 'var(--vyasa-font-scholarly, serif)',
            }}
          >
            System Activity Logs
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', lineHeight: 1.55 }}>
            Record of administrative actions, authority status changes, cluster assignments, and category routing updates.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Badge variant="teal">Total Records: {total}</Badge>
          <Badge variant="neutral">History: Preserved</Badge>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '20px',
          backgroundColor: '#ffffff',
          padding: '16px 20px',
          borderRadius: '8px',
          border: '1px solid var(--vyasa-border, #e3dcd1)',
          boxShadow: 'var(--vyasa-shadow-sm)',
        }}
      >
        <div style={{ width: '220px' }}>
          <Select
            options={[
              { value: 'atharva_veda', label: 'Atharva Veda (NIVARAN)' },
              { value: 'core', label: 'VYASA Core Subsystem' },
              { value: '', label: 'All Modules' },
            ]}
            value={moduleFilter}
            onChange={(e) => {
              setModuleFilter(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div style={{ flex: '1 1 260px' }}>
          <Input
            placeholder="Search by action name (e.g. update_routing, status)..."
            value={actionSearch}
            onChange={(e) => {
              setActionSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<AppIcon name="settings" size={14} />}
          onClick={fetchLogs}
        >
          Refresh
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState message="Loading governance audit records..." />
      ) : errorMsg ? (
        <div style={{ padding: '24px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#991b1b' }}>
          {errorMsg}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid var(--vyasa-border, #e3dcd1)',
            boxShadow: 'var(--vyasa-shadow-sm)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)',
                    borderBottom: '2px solid var(--vyasa-border, #e3dcd1)',
                    color: 'var(--vyasa-primary, #0f2b48)',
                    fontSize: '11.5px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  <th style={{ padding: '14px 18px', fontWeight: 700, width: '180px' }}>Timestamp</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, width: '130px' }}>Module</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Action</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Target Entity</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Actor</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right', width: '120px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No audit records match the current filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--vyasa-border-subtle, #f1f5f9)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    >
                      <td style={{ padding: '14px 18px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <Badge variant={log.module === 'atharva_veda' ? 'saffron' : 'primary'}>
                          {log.module}
                        </Badge>
                      </td>

                      <td style={{ padding: '14px 18px', fontWeight: 500, color: '#0f172a' }}>
                        <code
                          style={{
                            fontSize: '12px',
                            color: 'var(--vyasa-primary, #0f2b48)',
                            backgroundColor: 'rgba(15, 43, 72, 0.05)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {log.action}
                        </code>
                      </td>

                      <td style={{ padding: '14px 18px', color: '#334155' }}>
                        <span style={{ fontWeight: 600 }}>{log.entity_name}</span>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {log.entity_id}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', color: '#334155' }}>
                        {log.user_email ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{log.user_email}</div>
                            {log.ip_address && (
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>IP: {log.ip_address}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>System / Anonymous</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setSelectedLog(log)}
                        >
                          View Diff
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid var(--vyasa-border-subtle, #f1f5f9)',
              fontSize: '12.5px',
              color: 'var(--vyasa-text-secondary, #64748b)',
            }}
          >
            <span>
              Showing{' '}
              <strong style={{ color: 'var(--vyasa-primary, #0f2b48)' }}>
                {logs.length > 0 ? page * limit + 1 : 0}
              </strong>{' '}
              to{' '}
              <strong style={{ color: 'var(--vyasa-primary, #0f2b48)' }}>
                {Math.min((page + 1) * limit, total)}
              </strong>{' '}
              of <strong style={{ color: 'var(--vyasa-primary, #0f2b48)' }}>{total}</strong> events (Page {page + 1} of {totalPages})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="outline"
                size="sm"
                style={{ padding: '3px 10px', fontSize: '12px' }}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                style={{ padding: '3px 10px', fontSize: '12px' }}
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Details Diff Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title="Event Payload &amp; Mutation Diff"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12.5px',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>Timestamp:</span>{' '}
                <strong>{new Date(selectedLog.created_at).toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Action:</span> <code>{selectedLog.action}</code>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Entity:</span>{' '}
                <strong>
                  {selectedLog.entity_name} ({selectedLog.entity_id})
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Actor:</span>{' '}
                <strong>{selectedLog.user_email || 'System'}</strong>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Event Payload &amp; State Mutation:
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '12px',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  maxHeight: '280px',
                }}
              >
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
