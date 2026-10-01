import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, LoadingState, Button, Card, Badge } from '@vyasa/ui';
import { AdminNav } from '../components/AdminNav';
import { AdminModuleToggleCard } from '../components/AdminModuleToggleCard';
import { adminService } from '../services/adminService';
import { atharvaAdminService } from '../services/atharvaAdminService';
import { AdminStats } from '../types';
import { AtharvaConfigSummary } from '../types/atharva';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [atharvaSummary, setAtharvaSummary] = useState<AtharvaConfigSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      adminService.getAdminStats(),
      atharvaAdminService.getSummary().catch(() => null),
    ])
      .then(([statsData, atharvaData]) => {
        if (isMounted) {
          setStats(statsData);
          setAtharvaSummary(atharvaData);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <LoadingState message="Loading administrative governance console..." />;
  }

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <AdminNav />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Core Ecosystem Stats */}
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: '#334155' }}>Platform Core Identity &amp; System Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Registered Core Users</span>
              <h2 style={{ margin: '4px 0 0', fontSize: '24px', color: '#0f172a' }}>{stats?.totalUsers ?? 0}</h2>
            </div>
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>System Roles</span>
              <h2 style={{ margin: '4px 0 0', fontSize: '24px', color: '#0f172a' }}>{stats?.totalRoles ?? 0}</h2>
            </div>
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>RBAC Permissions</span>
              <h2 style={{ margin: '4px 0 0', fontSize: '24px', color: '#0f172a' }}>{stats?.totalPermissions ?? 0}</h2>
            </div>
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Veda Governance Pillars</span>
              <h2 style={{ margin: '4px 0 0', fontSize: '24px', color: '#0f172a' }}>4</h2>
            </div>
          </div>
        </div>

        {/* Atharva Veda Dynamic Taxonomy Overview */}
        {atharvaSummary && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155' }}>
                Atharva Veda / NIVARAN Dynamic Governance State
              </h3>
              <Badge variant="teal">Live Database Topology</Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Authorities Card */}
              <Card
                title="Authorities & Officers"
                subtitle={`${atharvaSummary.active_authorities} active of ${atharvaSummary.total_authorities} registered`}
                variant="default"
              >
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
                  Institutional officers serving as Grievance Incharges, Assistant Deans, Associate Deans, and Deans.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {Object.entries(atharvaSummary.role_counts).map(([role, count]) => (
                    <Badge key={role} variant="neutral">
                      {role}: {count}
                    </Badge>
                  ))}
                </div>
                <Button variant="primary" size="sm" onClick={() => navigate('/admin/atharva/authorities')}>
                  Manage Authorities &rarr;
                </Button>
              </Card>

              {/* Subject Clusters Card */}
              <Card
                title="Academic Subject Clusters"
                subtitle={`${atharvaSummary.active_subject_clusters} active clusters &bull; ${atharvaSummary.total_subjects} subjects`}
                variant="default"
              >
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
                  Discipline groupings mapping doctoral subjects to their accountable Assistant Deans.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/atharva/subject-clusters')}>
                    Subject Clusters &rarr;
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/atharva/subjects')}>
                    Subject Catalog &rarr;
                  </Button>
                </div>
              </Card>

              {/* Grievance Clusters Card */}
              <Card
                title="Grievance Clusters & Categories"
                subtitle={`${atharvaSummary.active_grievance_clusters} clusters &bull; ${atharvaSummary.total_categories} categories`}
                variant="default"
              >
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
                  Functional domains mapping grievance categories to Associate Deans or fixed authorities.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {Object.entries(atharvaSummary.categories_by_routing_type).map(([rtype, count]) => (
                    <Badge key={rtype} variant="teal">
                      {rtype}: {count}
                    </Badge>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/atharva/grievance-clusters')}>
                    Grievance Clusters &rarr;
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => navigate('/admin/atharva/categories')}>
                    Configure Routing &rarr;
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Module Registry Toggle Card */}
        <AdminModuleToggleCard />
      </div>
    </PageContainer>
  );
};
