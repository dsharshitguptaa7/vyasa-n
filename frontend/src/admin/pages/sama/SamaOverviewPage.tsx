import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingState, Button, Card, Badge, AppIcon } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { samaAdminService } from '../../services/samaAdminService';
import { SamaOverviewStats } from '../../types/sama';
import { useAuth } from '../../../context/AuthContext';

export const SamaOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<SamaOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await samaAdminService.getOverviewStats();
      setStats(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load SAMIKSHA metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const canEdit =
    isSuperAdmin ||
    (user?.roles || []).some((r) =>
      ['super_admin', 'administrator', 'sama_content_admin', 'sama_content_editor'].includes(r.toLowerCase())
    );
  void canEdit;

  return (
    <AdminLayout activeTab="sama-overview">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Institutional Notice Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            padding: '16px 20px',
            backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)',
            border: '1px solid var(--vyasa-border, #e3dcd1)',
            borderLeft: '4px solid #b2811a',
            borderRadius: '6px',
            boxShadow: 'var(--vyasa-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="book-open" size={18} color="#b2811a" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#b2811a',
                }}
              >
                <span>SAMIKSHA (Sama Veda) • Central Research Recognition &amp; Communication</span>
                <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)' }}>
                  Sama Veda • Central Research Recognition & Communication
                </span>
              </div>
              <h1
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '19px',
                  fontWeight: 700,
                  color: 'var(--vyasa-primary, #0f2b48)',
                }}
              >
                Content Management Console
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Badge variant="saffron">Pilot CMS</Badge>
            <Badge variant="neutral">{user?.email || 'Administrator'}</Badge>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#991b1b',
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{errorMsg}</span>
            <Button variant="outline" size="sm" onClick={fetchStats}>
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <LoadingState message="Loading research repository metrics..." />
        ) : (
          <>
            {/* Live KPI Metric Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Card 1: Publications */}
              <div
                onClick={() => navigate('/admin/sama/publications')}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Publications</span>
                  <AppIcon name="file-text" size={18} color="#2563eb" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>
                  {stats?.totalPublications ?? 0}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>
                    {stats?.publishedPublications ?? 0} Published
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>•</span>
                  <span style={{ fontSize: '12px', color: '#ea580c', fontWeight: 500 }}>
                    {stats?.draftPublications ?? 0} Draft
                  </span>
                </div>
              </div>

              {/* Card 2: Authors */}
              <div
                onClick={() => navigate('/admin/sama/authors')}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Faculty Authors</span>
                  <AppIcon name="users" size={18} color="#0d9488" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>
                  {stats?.totalAuthors ?? 0}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#0d9488', fontWeight: 500 }}>
                    {stats?.verifiedAuthors ?? 0} Verified Scopus
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>•</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {(stats?.totalAuthors ?? 0) - (stats?.verifiedAuthors ?? 0)} Provisional
                  </span>
                </div>
              </div>

              {/* Card 3: Bulletins */}
              <div
                onClick={() => navigate('/admin/sama/bulletins')}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Research Bulletins</span>
                  <AppIcon name="layers" size={18} color="#7c3aed" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>
                  {stats?.totalBulletins ?? 0}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 500 }}>
                    {stats?.activeBulletins ?? 0} Active Catalogs
                  </span>
                </div>
              </div>

              {/* Card 4: Certificates */}
              <div
                onClick={() => navigate('/admin/sama/certificates')}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Felicitation Certs</span>
                  <AppIcon name="check-circle" size={18} color="#d97706" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>
                  {stats?.totalCertificates ?? 0}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>
                    {(stats?.totalCertificates ?? 0) - (stats?.revokedCertificates ?? 0)} Active
                  </span>
                  {(stats?.revokedCertificates ?? 0) > 0 && (
                    <>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>•</span>
                      <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>
                        {stats?.revokedCertificates} Revoked
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Card 5: CAM-AI Projects */}
              <div
                onClick={() => navigate('/admin/sama/cam-projects')}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>CAM-AI Schemes</span>
                  <AppIcon name="grid" size={18} color="#0284c7" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>
                  {stats?.totalCamProjects ?? 0}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                  Interdisciplinary AI Grants
                </div>
              </div>

              {/* Card 6: Spotlights */}
              <div
                onClick={() => navigate('/admin/sama/spotlights')}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Researcher Spotlights</span>
                  <AppIcon name="settings" size={18} color="#c026d3" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>
                  {stats?.totalSpotlights ?? 0}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                  Showcase media & interviews
                </div>
              </div>
            </div>

            {/* Quick Action Navigation Deck */}
            <Card
              variant="scholarly"
              title="Content Management Modules"
              subtitle="Select a research domain to manage records, curation lifecycles, and verification"
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                  marginTop: '12px',
                }}
              >
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a' }}>
                      Research Publications
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                      Manage articles, reviews, conference papers, and book chapters. Transition content across draft, review, and published lifecycles.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/sama/publications')}>
                    Open Publications Ledger
                  </Button>
                </div>

                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a' }}>
                      Authors & Scopus Curation
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                      Review provisional faculty identities, resolve Scopus ID anomalies, and officially verify institutional authors.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/sama/authors')}>
                    Open Authors Registry
                  </Button>
                </div>

                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a' }}>
                      Official Research Bulletins
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                      Manage Volume/Issue editions, upload verified PDF catalogs with SHA-256 integrity, and configure public visibility.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/sama/bulletins')}>
                    Manage Bulletins Catalog
                  </Button>
                </div>

                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a' }}>
                      Felicitation Certificates
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                      Issue appreciation certificates, upload verified certificate PDFs, download documents, and execute Super Admin revocations.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/sama/certificates')}>
                    Manage Certificates
                  </Button>
                </div>

                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a' }}>
                      CAM-AI Research Grants
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                      Track Major & Minor scale AI projects, sanction funding amounts in INR, and document interdisciplinary investigators.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/sama/cam-projects')}>
                    Open CAM-AI Schemes
                  </Button>
                </div>

                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a' }}>
                      Media & Spotlights
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                      Publish researcher spotlights, interview clips, photography assets, and manage homepage carousel display ordering.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/sama/spotlights')}>
                    Open Spotlights Manager
                  </Button>
                </div>
              </div>
            </Card>

            {/* Governance Architecture Notice */}
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <AppIcon name="shield" size={16} color="#475569" />
              </div>
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                <strong>Institutional Security & Compliance Notice:</strong> All administrative additions, edits,
                status changes, and certificate operations performed in this console are recorded immutably in the
                VYASA platform audit logs. Certificate revocation requires Super Admin authorization and a mandatory
                audit justification. Public research endpoints exclusively expose records with status{' '}
                <code style={{ backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>published</code>.
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};
