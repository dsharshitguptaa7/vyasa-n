import React, { useEffect, useState, useCallback } from 'react';
import { PageContainer, LoadingState, Button, Badge, Modal, Input, Select } from '@vyasa/ui';
import { AdminNav } from '../../components/AdminNav';
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

  const totalPages = Math.ceil(total / limit);

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <AdminNav />

      {/* Header Info */}
      <div style={{ marginBottom: '24px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>
              Institutional Governance Audit Log Explorer
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
              Immutable record of administrative actions, authority status toggles, cluster re-assignments,
              and category routing changes. Every modification is captured with the acting officer&apos;s identity,
              IP address, and precise state diff.
            </p>
          </div>
          <Badge variant="teal">Total Records: {total}</Badge>
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
          backgroundColor: '#fff',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ width: '200px' }}>
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
        <div style={{ flex: '1 1 240px' }}>
          <Input
            placeholder="Search by action name (e.g. update_routing, status)..."
            value={actionSearch}
            onChange={(e) => {
              setActionSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs}>
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
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '180px' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, width: '130px' }}>Module</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Action</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Target Entity</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Actor</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right', width: '120px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No audit records match the current filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={log.module === 'atharva_veda' ? 'saffron' : 'primary'}>
                        {log.module}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#0f172a' }}>
                      <code>{log.action}</code>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>
                      <span style={{ fontWeight: 600 }}>{log.entity_name}</span>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {log.entity_id}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>
                      {log.user_email ? (
                        <div>
                          <div>{log.user_email}</div>
                          {log.ip_address && (
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>IP: {log.ip_address}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>System / Anonymous</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Button variant="outline" size="sm" onClick={() => setSelectedLog(log)}>
                        View Diff
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {logs.length > 0 ? page * limit + 1 : 0} to{' '}
              {Math.min((page + 1) * limit, total)} of {total} events
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                &larr; Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page + 1 >= totalPages}
              >
                Next &rarr;
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log Event: ${selectedLog.action}`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Entity</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedLog.entity_name}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Entity ID</span>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#0f172a' }}>
                  {selectedLog.entity_id}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Acting Officer</span>
                <div style={{ color: '#0f172a' }}>{selectedLog.user_email || 'System'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Timestamp &amp; IP</span>
                <div style={{ color: '#0f172a' }}>
                  {new Date(selectedLog.created_at).toISOString()} ({selectedLog.ip_address || 'local'})
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Event Payload &amp; Mutation Diff
              </span>
              <pre
                style={{
                  backgroundColor: '#0f172a',
                  color: '#38bdf8',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  overflowX: 'auto',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
