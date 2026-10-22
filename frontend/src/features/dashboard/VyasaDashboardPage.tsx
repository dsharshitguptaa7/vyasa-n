import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, AppIcon, CsjmuLogo, Modal } from '@vyasa/ui';
import { useAuth } from '../../context/AuthContext';
import { getActiveServices, VyasaService } from '../../services/serviceRegistry';
import { getNivaranDestination } from '../../utils/personaRouting';
import { grievanceService } from '../../modules/atharva-veda/nivaran/services/grievanceService';
import { GrievanceSummaryItem } from '../../modules/atharva-veda/nivaran/types/grievance';
import { VyasaPortalLayout } from './components/VyasaPortalLayout';
import './Dashboard.css';

export const VyasaDashboardPage: React.FC = () => {
  const auth = useAuth();
  const {
    user,
    displayName,
    authorityRole,
    authorityDesignation,
    isDean,
    isAssociateDean,
    isAssistantDean,
    isManager,
    isApplicant,
    isAdmin,
  } = auth;
  const navigate = useNavigate();
  const activeServices = getActiveServices();

  const [grievances, setGrievances] = useState<GrievanceSummaryItem[]>([]);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Load live grievances for authenticated applicant only to check if attention is required
  useEffect(() => {
    let isMounted = true;
    if (isApplicant) {
      grievanceService
        .getMyGrievances()
        .then((data) => {
          if (isMounted) setGrievances(data || []);
        })
        .catch(() => {
          if (isMounted) setGrievances([]);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isApplicant]);

  // Derived count for compact action-required banner
  const telemetry = useMemo(() => {
    const actionRequired = grievances.filter((g) =>
      ['CLARIFICATION_REQUESTED', 'FEEDBACK_REQUIRED', 'REOPENED', 'APPEALED'].includes(g.status)
    ).length;

    return { actionRequired };
  }, [grievances]);

  const getRoleBadge = () => {
    if (isDean) return { label: authorityDesignation || 'Dean R&D', variant: 'gold' as const };
    if (isAssociateDean) return { label: authorityDesignation || 'Associate Dean', variant: 'teal' as const };
    if (isAssistantDean) return { label: authorityDesignation || 'Assistant Dean', variant: 'teal' as const };
    if (isManager) return { label: 'Triage Manager', variant: 'teal' as const };
    if (isAdmin && !authorityRole) return { label: 'Administrator', variant: 'primary' as const };
    if (isApplicant) return { label: 'Scholar', variant: 'saffron' as const };
    return { label: authorityDesignation || 'Institutional Authority', variant: 'teal' as const };
  };

  const roleBadge = getRoleBadge();

  const handleOpenService = (service: VyasaService | { id: string; route?: string }) => {
    if (service.id === 'nivaran') {
      const destination = getNivaranDestination(auth);
      navigate(destination);
    } else if (service.route) {
      navigate(service.route);
    }
  };

  const fullName = displayName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Institutional User');

  const userAffiliation = isApplicant
    ? (user?.department ? `${user.department} • Research Scholar` : 'Ph.D. Research Scholar')
    : (authorityDesignation || (isDean ? 'Dean of Research & Development' : isAssociateDean ? 'Associate Dean' : isAssistantDean ? 'Assistant Dean' : isManager ? 'Grievance Redressal Cell' : 'Institutional Authority'));

  return (
    <VyasaPortalLayout
      activeItem="dashboard"
      onSelectProfile={() => navigate('/profile')}
      onSelectHelp={() => setIsHelpModalOpen(true)}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* 1. Institutional Welcome & Persona Header */}
        <div
          data-testid="dashboard-welcome-banner"
          style={{
            position: 'relative',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '18px 22px',
            marginBottom: '16px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(15, 43, 72, 0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Architectural building watermark */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '160px',
              top: 0,
              bottom: 0,
              width: '280px',
              opacity: 0.04,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppIcon name="building" size={200} color="#0f2b48" />
          </div>

          {/* Left Side: CSJMU Crest & Institutional Greeting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1 }}>
            <div
              style={{
                padding: '6px',
                backgroundColor: '#ffffff',
                border: '1.5px solid var(--vyasa-gold-border, #ecdfba)',
                borderRadius: '50%',
                boxShadow: '0 2px 6px rgba(178, 129, 26, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CsjmuLogo size={44} />
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--vyasa-gold, #b2811a)',
                  marginBottom: '2px',
                }}
              >
                Chhatrapati Shahu Ji Maharaj University, Kanpur
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1
                  data-testid="dashboard-welcome-heading"
                  style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--vyasa-primary, #0f2b48)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.25,
                    fontFamily: 'var(--vyasa-font-sans)',
                  }}
                >
                  Welcome, {fullName}
                </h1>
                <Badge variant={roleBadge.variant} size="sm">
                  {roleBadge.label}
                </Badge>
                <Badge variant="teal" size="sm">
                  Verified Identity
                </Badge>
              </div>

              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Your personalized academic and research governance portal under the VYASA-N unified ecosystem.
              </p>
            </div>
          </div>

          {/* Right Side: Academic Session 2026-27 Badge */}
          <div
            style={{
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <AppIcon name="clock" size={16} />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Academic Session
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f2b48', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>2026–27</span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Compact Identity Summary */}
        <div
          data-testid="compact-identity-summary"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Account Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="user" size={15} color="#b2811a" />
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Account Holder
                </span>
                <span
                  data-testid="profile-full-name"
                  style={{ fontSize: '13px', fontWeight: 600, color: '#0f2b48' }}
                >
                  {fullName}
                </span>
              </div>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="mail" size={15} color="#2563eb" />
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Institutional Email
                </span>
                <span
                  data-testid="profile-email"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}
                >
                  {user?.email || '—'}
                </span>
              </div>
            </div>

            {/* Phone */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="phone" size={15} color="#0d9488" />
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Contact Phone
                </span>
                <span
                  data-testid="profile-phone"
                  className={!user?.phone ? 'vyasa-field-value--muted' : ''}
                  style={{ fontSize: '13px', fontWeight: 500, color: !user?.phone ? '#94a3b8' : '#334155' }}
                >
                  {user?.phone || 'Not provided'}
                </span>
              </div>
            </div>

            {/* Affiliation / Department */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="building" size={15} color="#64748b" />
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Scope / Affiliation
                </span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                  {userAffiliation}
                </span>
              </div>
            </div>
          </div>

          {/* Direct CTA to My Profile */}
          <button
            type="button"
            data-testid="view-full-profile-btn"
            onClick={() => navigate('/profile')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--vyasa-primary, #0f2b48)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
              e.currentTarget.style.borderColor = '#93c5fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <span>View Full Profile</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>

        {/* 3. Attention Banner (Only displayed when applicant has grievances requiring urgent action) */}
        {isApplicant && telemetry.actionRequired > 0 && (
          <div
            data-testid="grievance-attention-banner"
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '12px 18px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AppIcon name="alert-circle" size={17} color="#d97706" />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#92400e' }}>
                  Action Required in NIVARAN-AI
                </div>
                <div style={{ fontSize: '12.5px', color: '#b45309', marginTop: '1px' }}>
                  You have {telemetry.actionRequired} submitted grievance{telemetry.actionRequired > 1 ? 's' : ''} awaiting clarification, appeal response, or applicant feedback.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
              style={{
                padding: '6px 14px',
                backgroundColor: '#b45309',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>View in NIVARAN-AI</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        )}

        {/* 4. Ecosystem Level Overview (Retains top-level ecosystem indicator; no grievance metrics) */}
        <div
          data-testid="ecosystem-services-indicator"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '14px 20px',
            marginBottom: '24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                flexShrink: 0,
              }}
            >
              <AppIcon name="scale" size={18} color="#2563eb" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Active Ecosystem Services
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f2b48' }}>
                {activeServices.length} Active <span style={{ fontSize: '12px', fontWeight: 500, color: '#0d9488' }}>(NIVARAN-AI Redressal)</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
                flexShrink: 0,
              }}
            >
              <AppIcon name="building" size={18} color="#059669" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Institutional Architecture
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f2b48' }}>
                CSJMU Core <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>• Atharva Veda Domain</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#fefce8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ca8a04',
                flexShrink: 0,
              }}
            >
              <AppIcon name="shield" size={18} color="#ca8a04" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Session Security Posture
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f2b48' }}>
                Verified <span style={{ fontSize: '12px', fontWeight: 500, color: '#10b981' }}>• TLS &amp; JWT Authenticated</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Clean, Focused Service Launcher */}
        <div style={{ marginBottom: '32px' }} data-testid="available-services-section">
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-primary, #0f2b48)' }}>
              Ecosystem Service Launcher
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Launch authorized institutional services and dispute redressal systems under VYASA-N.
            </p>
          </div>

          {/* Primary Active Service: NIVARAN-AI */}
          <div
            data-testid="service-card-nivaran"
            onClick={() => handleOpenService({ id: 'nivaran' })}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1.5px solid var(--vyasa-gold, #d4a017)',
              padding: '20px 24px',
              boxShadow: '0 2px 8px rgba(212, 160, 23, 0.08)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(212, 160, 23, 0.16)')}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(212, 160, 23, 0.08)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: '#fefce8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ca8a04',
                  flexShrink: 0,
                  border: '1px solid #fef08a',
                }}
              >
                <AppIcon name="scale" size={24} color="#b2811a" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f2b48' }}>
                    NIVARAN-AI
                  </span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0',
                      textTransform: 'uppercase',
                    }}
                  >
                    Active Service
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155', marginTop: '2px' }}>
                  AI-Assisted Grievance Redressal &amp; Dispute Resolution
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Automated initial review, multi-tier authority support, and transparent resolution workflows.
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="open-service-btn-nivaran"
              aria-label="Open NIVARAN-AI"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenService({ id: 'nivaran' });
              }}
              style={{
                border: 'none',
                background: 'var(--vyasa-primary, #0f2b48)',
                color: '#ffffff',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                padding: '9px 18px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e3a5f')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0f2b48')}
            >
              <span>Open NIVARAN-AI</span>
              <span aria-hidden="true">&rsaquo;</span>
            </button>
          </div>

          {/* Subtle Roadmap Indicator (Quietly indicated without taking visual precedence) */}
          <div
            data-testid="services-roadmap-notice"
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              backgroundColor: '#fafbfc',
              borderRadius: '6px',
              border: '1px dashed #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            <AppIcon name="clock" size={14} color="#94a3b8" />
            <span>
              <strong>Scheduled Governance Domains in Roadmap:</strong> Rig Veda (PRAMAAN Research), Yajur Veda (ANUDAN Grants), Sama Veda (SAMIKSHA Academic Audit).
            </span>
          </div>
        </div>

        {/* 6. Technical Telemetry (Restricted strictly to Administrator role; removed for regular users) */}
        {isAdmin && (
          <div data-testid="card-telemetry" className="vyasa-dossier-card vyasa-dossier-card--gold vyasa-telemetry-strip" style={{ marginBottom: '24px' }}>
            <div className="vyasa-dossier-header">
              <div className="vyasa-dossier-header__left">
                <div className="vyasa-dossier-icon-chip vyasa-dossier-icon-chip--gold" aria-hidden="true">
                  <AppIcon name="bar-chart" size={17} color="var(--vyasa-gold-hover, #a16207)" />
                </div>
                <div className="vyasa-dossier-title-wrap">
                  <h3 className="vyasa-dossier-title">Institutional Status (Admin View)</h3>
                  <p className="vyasa-dossier-subtitle">Central ecosystem status and connectivity</p>
                </div>
              </div>
              <div className="vyasa-dossier-badge-wrap">
                <Badge variant="gold" size="sm">Admin Panel</Badge>
              </div>
            </div>

            <div className="vyasa-dossier-body">
              <div className="vyasa-telemetry-grid">
                <div className="vyasa-telemetry-item">
                  <div className="vyasa-telemetry-item__label">Active Services</div>
                  <div className="vyasa-telemetry-item__val">{activeServices.length} Active</div>
                  <div className="vyasa-telemetry-item__note vyasa-telemetry-item__note--teal">NIVARAN-AI Resolution</div>
                </div>

                <div className="vyasa-telemetry-item">
                  <div className="vyasa-telemetry-item__label">Ecosystem Health</div>
                  <div className="vyasa-telemetry-item__val vyasa-telemetry-item__val--success">Working</div>
                  <div className="vyasa-telemetry-item__note">All systems online &bull; Up to date</div>
                </div>

                <div className="vyasa-telemetry-item">
                  <div className="vyasa-telemetry-item__label">Security Posture</div>
                  <div className="vyasa-telemetry-item__val">Verified</div>
                  <div className="vyasa-telemetry-item__note">JWT Authenticated &bull; TLS Encrypted</div>
                </div>

                <div className="vyasa-telemetry-item">
                  <div className="vyasa-telemetry-item__label">Governance Framework</div>
                  <div className="vyasa-telemetry-item__val">CSJMU Core</div>
                  <div className="vyasa-telemetry-item__note">Four Vedic Knowledge Domains</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guidelines Modal */}
      {isHelpModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsHelpModalOpen(false)}
          title="VYASA-N Institutional Guidelines & Help"
          footer={
            <Button variant="primary" size="sm" onClick={() => setIsHelpModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#334155' }}>
            <div>
              <strong style={{ color: '#0f2b48' }}>VYASA-N Unified Academic Portal</strong>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                VYASA-N integrates scholarly research governance, automated grievance redressal (NIVARAN-AI), and academic registries into a single institutional portal.
              </p>
            </div>
            <div>
              <strong style={{ color: '#0f2b48' }}>How to access NIVARAN-AI Redressal?</strong>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                Select NIVARAN-AI under the Services sidebar or click the Open NIVARAN-AI action on the dashboard Service Launcher.
              </p>
            </div>
            <div>
              <strong style={{ color: '#0f2b48' }}>How to view and manage my credentials?</strong>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                Click &ldquo;View Full Profile&rdquo; on the dashboard or &ldquo;My Profile&rdquo; in the sidebar navigation to view your official academic record and verification status.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </VyasaPortalLayout>
  );
};
