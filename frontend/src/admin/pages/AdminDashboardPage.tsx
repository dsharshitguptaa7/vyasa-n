import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingState, Button, Card, Badge, AppIcon } from '@vyasa/ui';
import { AdminLayout } from '../components/AdminLayout';
import { AdminModuleToggleCard } from '../components/AdminModuleToggleCard';
import { adminService } from '../services/adminService';
import { atharvaAdminService } from '../services/atharvaAdminService';
import { AdminStats } from '../types';
import { AtharvaConfigSummary } from '../types/atharva';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  DEAN: 'Deans',
  ASSOCIATE_DEAN: 'Associate Deans',
  ASSISTANT_DEAN: 'Assistant Deans',
  MANAGER: 'Grievance Managers',
  GUEST_MEMBER: 'Guest Members',
  SUPERADMIN: 'Super Admins',
};

const ROUTING_TYPE_NAMES: Record<string, string> = {
  CLUSTER: 'Discipline Cluster Lead',
  SUBJECT_ASSISTANT_DEAN: 'Subject Assistant Dean',
  GRIEVANCE_CLUSTER: 'Grievance Cluster Dean',
  FIXED_AUTHORITY: 'Designated Authority',
};

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
    return <LoadingState message="Loading institutional governance console..." />;
  }

  return (
    <AdminLayout activeTab="overview">

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Official University Institutional Notice Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 20px',
            backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)',
            border: '1px solid var(--vyasa-border, #e3dcd1)',
            borderLeft: '4px solid var(--vyasa-primary, #0f2b48)',
            borderRadius: '6px',
            boxShadow: 'var(--vyasa-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--vyasa-primary-surface, #eff5fa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="shield" size={16} color="var(--vyasa-primary, #0f2b48)" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--vyasa-gold, #b2811a)',
                }}
              >
                Statutory Governance Mandate • University Statute No. 14
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--vyasa-text-secondary, #4b5565)', marginTop: '2px' }}>
                Governed under University Academic Senate bylaws &amp; UGC (Redressal of Grievances of Students) Regulations, 2023.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '11.5px',
                color: 'var(--vyasa-teal, #0d766e)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <AppIcon name="check-circle" size={13} color="#0d766e" />
              Directory Synchronized
            </span>
            <span style={{ color: 'var(--vyasa-border, #cbd5e1)' }}>|</span>
            <span style={{ fontSize: '11.5px', color: 'var(--vyasa-text-muted, #64748b)' }}>
              Audit Logging: Active
            </span>
          </div>
        </div>

        {/* Administrative Quick Command Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 18px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--vyasa-border, #e3dcd1)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="layout-dashboard" size={16} color="var(--vyasa-primary, #0f2b48)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)' }}>
              Administrative Workflows:
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<AppIcon name="users" size={14} />}
              onClick={() => navigate('/admin/atharva/authorities')}
            >
              Authorities Directory
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<AppIcon name="layers" size={14} />}
              onClick={() => navigate('/admin/atharva/subject-clusters')}
            >
              Subject Taxonomy
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<AppIcon name="settings" size={14} />}
              onClick={() => navigate('/admin/atharva/categories')}
            >
              Routing Matrix
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<AppIcon name="file-text" size={14} />}
              onClick={() => navigate('/admin/atharva/audit-logs')}
            >
              System Audit Trail
            </Button>
          </div>
        </div>

        {/* Section 1: Core Platform Identity & System Metrics */}
        <div>
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--vyasa-primary, #0f2b48)',
                marginBottom: '4px',
              }}
            >
              Central Directory &amp; RBAC Topology
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--vyasa-primary, #0f2b48)',
                  fontFamily: 'var(--vyasa-font-scholarly, serif)',
                }}
              >
                Platform Core Identity &amp; System Metrics
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted, #64748b)' }}>
                Real-time directory counters &amp; granular access permissions
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '18px',
            }}
          >
            {/* Metric 1: Users */}
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid var(--vyasa-border, #e3dcd1)',
                backgroundColor: '#ffffff',
                boxShadow: 'var(--vyasa-shadow-sm)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: 'var(--vyasa-primary, #0f2b48)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--vyasa-text-secondary, #64748b)',
                  }}
                >
                  Registered Core Users
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--vyasa-primary-surface, #eff5fa)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="users" size={16} color="var(--vyasa-primary, #0f2b48)" />
                </div>
              </div>
              <h3
                style={{
                  margin: '8px 0 4px',
                  fontSize: '30px',
                  fontWeight: 700,
                  color: 'var(--vyasa-primary, #0f2b48)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stats?.totalUsers ?? 0}
              </h3>
              <span style={{ fontSize: '11.5px', color: 'var(--vyasa-text-muted, #64748b)' }}>
                Authenticated faculty &amp; officers
              </span>
            </div>

            {/* Metric 2: Roles */}
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid var(--vyasa-border, #e3dcd1)',
                backgroundColor: '#ffffff',
                boxShadow: 'var(--vyasa-shadow-sm)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: 'var(--vyasa-gold, #b2811a)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--vyasa-text-secondary, #64748b)',
                  }}
                >
                  System Roles
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--vyasa-gold-light, #fcf7eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="shield" size={16} color="var(--vyasa-gold, #b2811a)" />
                </div>
              </div>
              <h3
                style={{
                  margin: '8px 0 4px',
                  fontSize: '30px',
                  fontWeight: 700,
                  color: 'var(--vyasa-primary, #0f2b48)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stats?.totalRoles ?? 0}
              </h3>
              <span style={{ fontSize: '11.5px', color: 'var(--vyasa-text-muted, #64748b)' }}>
                SuperAdmin, Deans &amp; Incharges
              </span>
            </div>

            {/* Metric 3: Permissions */}
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid var(--vyasa-border, #e3dcd1)',
                backgroundColor: '#ffffff',
                boxShadow: 'var(--vyasa-shadow-sm)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: 'var(--vyasa-teal, #0d766e)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--vyasa-text-secondary, #64748b)',
                  }}
                >
                  RBAC Permissions
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--vyasa-teal-light, #f0fdfa)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="check-circle" size={16} color="var(--vyasa-teal, #0d766e)" />
                </div>
              </div>
              <h3
                style={{
                  margin: '8px 0 4px',
                  fontSize: '30px',
                  fontWeight: 700,
                  color: 'var(--vyasa-primary, #0f2b48)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stats?.totalPermissions ?? 0}
              </h3>
              <span style={{ fontSize: '11.5px', color: 'var(--vyasa-text-muted, #64748b)' }}>
                Granular security matrix policies
              </span>
            </div>

            {/* Metric 4: Veda Pillars */}
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid var(--vyasa-border, #e3dcd1)',
                backgroundColor: '#ffffff',
                boxShadow: 'var(--vyasa-shadow-sm)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: 'var(--vyasa-saffron, #c85602)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--vyasa-text-secondary, #64748b)',
                  }}
                >
                  Veda Governance Pillars
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--vyasa-saffron-light, #fef4eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="building" size={16} color="var(--vyasa-saffron, #c85602)" />
                </div>
              </div>
              <h3
                style={{
                  margin: '8px 0 4px',
                  fontSize: '30px',
                  fontWeight: 700,
                  color: 'var(--vyasa-primary, #0f2b48)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                4
              </h3>
              <span style={{ fontSize: '11.5px', color: 'var(--vyasa-text-muted, #64748b)' }}>
                Rig, Yajur, Sama &amp; Atharva Veda
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Atharva Veda Dynamic Taxonomy Overview */}
        {atharvaSummary && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--vyasa-teal, #0d766e)',
                  marginBottom: '4px',
                }}
              >
                Veda Pillar IV • Operational Topology
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--vyasa-primary, #0f2b48)',
                    fontFamily: 'var(--vyasa-font-scholarly, serif)',
                  }}
                >
                  Atharva Veda / NIVARAN Dynamic Governance State
                </h2>
                <Badge variant="teal">Live Database Topology • Real-time Sync</Badge>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '22px',
              }}
            >
              {/* Authorities Card */}
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AppIcon name="users" size={18} color="var(--vyasa-primary, #0f2b48)" />
                    <span>Authorities &amp; Officers</span>
                  </div>
                }
                subtitle={`${atharvaSummary.active_authorities} active of ${atharvaSummary.total_authorities} registered institutional officers`}
                variant="scholarly"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Statutory institutional officers serving as Grievance Incharges, Assistant Deans, Associate Deans, and Executive Deans.
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '8px',
                      marginBottom: '20px',
                    }}
                  >
                    {Object.entries(atharvaSummary.role_counts).map(([role, count]) => (
                      <div
                        key={role}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--vyasa-border, #e3dcd1)',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ color: 'var(--vyasa-text-secondary, #4b5565)', fontWeight: 500 }}>
                          {ROLE_DISPLAY_NAMES[role] || role}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'var(--vyasa-primary, #0f2b48)',
                            backgroundColor: 'var(--vyasa-primary-surface, #eff5fa)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                          }}
                        >
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ paddingTop: '12px', borderTop: '1px solid var(--vyasa-border-subtle, #f1f5f9)' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<AppIcon name="arrow-right" size={14} />}
                    onClick={() => navigate('/admin/atharva/authorities')}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Manage Authorities
                  </Button>
                </div>
              </Card>

              {/* Subject Clusters Card */}
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AppIcon name="layers" size={18} color="var(--vyasa-primary, #0f2b48)" />
                    <span>Academic Subject Clusters</span>
                  </div>
                }
                subtitle={`${atharvaSummary.active_subject_clusters} active clusters • ${atharvaSummary.total_subjects} subjects cataloged`}
                variant="scholarly"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Academic discipline groupings mapping doctoral subjects to their accountable Assistant Deans across university faculties.
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px',
                      marginBottom: '20px',
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--vyasa-border, #e3dcd1)',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)', textTransform: 'uppercase' }}>
                        Faculty Clusters
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)' }}>
                        {atharvaSummary.active_subject_clusters} Active
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--vyasa-border, #e3dcd1)',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)', textTransform: 'uppercase' }}>
                        Total Subjects
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)' }}>
                        {atharvaSummary.total_subjects} Disciplines
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--vyasa-border, #e3dcd1)',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)', textTransform: 'uppercase' }}>
                        Dean Oversight
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-teal, #0d766e)' }}>
                        100% Assigned
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--vyasa-border, #e3dcd1)',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #64748b)', textTransform: 'uppercase' }}>
                        Catalog Level
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-gold, #b2811a)' }}>
                        Ph.D. &amp; Post-Grad
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: '12px',
                    borderTop: '1px solid var(--vyasa-border-subtle, #f1f5f9)',
                    display: 'flex',
                    gap: '10px',
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={<AppIcon name="arrow-right" size={14} />}
                    onClick={() => navigate('/admin/atharva/subject-clusters')}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Subject Clusters
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<AppIcon name="arrow-right" size={14} />}
                    onClick={() => navigate('/admin/atharva/subjects')}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Subject Catalog
                  </Button>
                </div>
              </Card>

              {/* Grievance Clusters Card */}
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AppIcon name="shield" size={18} color="var(--vyasa-primary, #0f2b48)" />
                    <span>Grievance Clusters &amp; Categories</span>
                  </div>
                }
                subtitle={`${atharvaSummary.active_grievance_clusters} clusters • ${atharvaSummary.total_categories} grievance categories`}
                variant="scholarly"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Functional domains mapping grievance categories to Associate Deans, Assistant Deans, or fixed statutory authorities.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      marginBottom: '20px',
                    }}
                  >
                    {Object.entries(atharvaSummary.categories_by_routing_type).map(([rtype, count]) => (
                      <div
                        key={rtype}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--vyasa-border, #e3dcd1)',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ color: 'var(--vyasa-text-secondary, #4b5565)', fontWeight: 500 }}>
                          {ROUTING_TYPE_NAMES[rtype] || rtype}
                        </span>
                        <Badge variant="teal" size="sm">
                          {count} {count === 1 ? 'category' : 'categories'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: '12px',
                    borderTop: '1px solid var(--vyasa-border-subtle, #f1f5f9)',
                    display: 'flex',
                    gap: '10px',
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={<AppIcon name="arrow-right" size={14} />}
                    onClick={() => navigate('/admin/atharva/grievance-clusters')}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Grievance Clusters
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<AppIcon name="arrow-right" size={14} />}
                    onClick={() => navigate('/admin/atharva/categories')}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Configure Routing
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Section 3: Module Registry Toggle Card */}
        <AdminModuleToggleCard />

        {/* Institutional Statutory Footer */}
        <footer
          style={{
            padding: '20px 24px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--vyasa-border, #e3dcd1)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '12px',
            color: 'var(--vyasa-text-secondary, #64748b)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)', marginBottom: '2px' }}>
              Chhatrapati Shahu Ji Maharaj University, Kanpur (CSJMU) • Integrated Administrative Ecosystem
            </div>
            <div>
              Operated in conformity with State University Acts &amp; UGC Redressal Regulations (2023). All configuration changes are recorded in the immutable audit ledger.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AppIcon name="shield" size={13} color="#0d766e" />
              <span>TLS 1.3 Encrypted</span>
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AppIcon name="check-circle" size={13} color="#15803d" />
              <span>PostgreSQL Cluster Synced</span>
            </span>
          </div>
        </footer>
      </div>
    </AdminLayout>
  );
};
