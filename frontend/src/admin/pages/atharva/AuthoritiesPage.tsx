import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer, LoadingState, Button, Badge, Modal, Input, Select } from '@vyasa/ui';
import { AdminNav } from '../../components/AdminNav';
import { atharvaAdminService } from '../../services/atharvaAdminService';
import { Authority, NivaranRole } from '../../types/atharva';

export const AuthoritiesPage: React.FC = () => {
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Status toggle modal state
  const [pendingAuthority, setPendingAuthority] = useState<Authority | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAuthorities = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await atharvaAdminService.getAuthorities();
      setAuthorities(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch authorities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthorities();
  }, []);

  const filteredAuthorities = useMemo(() => {
    return authorities.filter((auth) => {
      if (roleFilter && auth.role !== roleFilter) return false;
      if (statusFilter === 'active' && !auth.is_active) return false;
      if (statusFilter === 'inactive' && auth.is_active) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = auth.name_snapshot.toLowerCase().includes(q);
        const matchesEmail = auth.email_snapshot.toLowerCase().includes(q);
        const matchesDesig = auth.designation?.toLowerCase().includes(q) ?? false;
        const matchesDept = auth.department?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesEmail && !matchesDesig && !matchesDept) return false;
      }
      return true;
    });
  }, [authorities, roleFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = authorities.length;
    const active = authorities.filter((a) => a.is_active).length;
    const roleCounts: Record<string, number> = {};
    authorities.forEach((a) => {
      roleCounts[a.role] = (roleCounts[a.role] || 0) + 1;
    });
    return { total, active, roleCounts };
  }, [authorities]);

  const handleConfirmToggle = async () => {
    if (!pendingAuthority) return;
    try {
      setIsUpdating(true);
      const newStatus = !pendingAuthority.is_active;
      const updated = await atharvaAdminService.updateAuthorityStatus(pendingAuthority.id, newStatus);
      setAuthorities((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a))
      );
      setPendingAuthority(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update authority status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleBadgeVariant = (role: NivaranRole): 'primary' | 'saffron' | 'gold' | 'teal' | 'neutral' => {
    switch (role) {
      case 'DEAN':
        return 'saffron';
      case 'ASSOCIATE_DEAN':
        return 'teal';
      case 'ASSISTANT_DEAN':
        return 'gold';
      case 'MANAGER':
        return 'primary';
      default:
        return 'neutral';
    }
  };

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <AdminNav />

      {/* Dynamic Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Total Authorities</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '22px', color: '#0f172a' }}>{stats.total}</h3>
        </div>
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Active Authorities</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '22px', color: '#059669' }}>{stats.active}</h3>
        </div>
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Deans</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '22px', color: '#b45309' }}>{stats.roleCounts['DEAN'] || 0}</h3>
        </div>
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Associate Deans</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '22px', color: '#0d9488' }}>{stats.roleCounts['ASSOCIATE_DEAN'] || 0}</h3>
        </div>
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Assistant Deans</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '22px', color: '#2563eb' }}>{stats.roleCounts['ASSISTANT_DEAN'] || 0}</h3>
        </div>
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Managers</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '22px', color: '#475569' }}>{stats.roleCounts['MANAGER'] || 0}</h3>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
        <div style={{ flex: '1 1 240px' }}>
          <Input
            placeholder="Search authority by name, email, designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ width: '180px' }}>
          <Select
            options={[
              { value: '', label: 'All Roles' },
              { value: 'DEAN', label: 'Dean' },
              { value: 'ASSOCIATE_DEAN', label: 'Associate Dean' },
              { value: 'ASSISTANT_DEAN', label: 'Assistant Dean' },
              { value: 'MANAGER', label: 'Manager' },
              { value: 'GUEST_MEMBER', label: 'Guest Member' },
            ]}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          />
        </div>
        <div style={{ width: '150px' }}>
          <Select
            options={[
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchAuthorities}>
          Refresh
        </Button>
      </div>

      {/* Authorities Table */}
      {loading ? (
        <LoadingState message="Loading institutional authority records..." />
      ) : errorMsg ? (
        <div style={{ padding: '24px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#991b1b' }}>
          {errorMsg}
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Authority Name &amp; Contact</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>System Role</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Designation &amp; Department</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAuthorities.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No institutional authorities matched the specified filters.
                  </td>
                </tr>
              ) : (
                filteredAuthorities.map((auth) => (
                  <tr key={auth.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{auth.name_snapshot}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{auth.email_snapshot}</div>
                      {auth.phone_snapshot && (
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{auth.phone_snapshot}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={getRoleBadgeVariant(auth.role)}>{auth.role}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ color: '#334155' }}>{auth.designation || '—'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{auth.department || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: auth.is_active ? '#059669' : '#dc2626',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: auth.is_active ? '#10b981' : '#ef4444',
                          }}
                        />
                        {auth.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Button
                        variant={auth.is_active ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => setPendingAuthority(auth)}
                      >
                        {auth.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      {pendingAuthority && (
        <Modal
          isOpen={true}
          onClose={() => setPendingAuthority(null)}
          title={pendingAuthority.is_active ? 'Deactivate Authority' : 'Activate Authority'}
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setPendingAuthority(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                variant={pendingAuthority.is_active ? 'outline' : 'primary'}
                size="sm"
                onClick={handleConfirmToggle}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : pendingAuthority.is_active ? 'Confirm Deactivation' : 'Confirm Activation'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>
              Are you sure you want to {pendingAuthority.is_active ? 'deactivate' : 'activate'}{' '}
              <strong>{pendingAuthority.name_snapshot}</strong> ({pendingAuthority.role})?
            </p>
            {pendingAuthority.is_active && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '6px',
                  color: '#92400e',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                <strong>Warning:</strong> If this officer is currently assigned as an Assistant Dean or
                Associate Dean to active clusters, future grievance routing to those clusters will fail
                validation until a new active officer is re-mapped.
              </div>
            )}
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              This administrative action is logged to the Core audit trail with timestamp and administrator identity.
            </p>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
