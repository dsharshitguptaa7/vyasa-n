import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, AppIcon } from '@vyasa/ui';

export const NivaranOperationalSection: React.FC = () => {
  const navigate = useNavigate();
  const [isCreditOpen, setIsCreditOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      window.clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsCreditOpen(true);
  };

  const handleMouseLeave = () => {
    leaveTimeoutRef.current = window.setTimeout(() => {
      setIsCreditOpen(false);
    }, 180);
  };

  const handleToggle = () => {
    setIsCreditOpen((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsCreditOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsCreditOpen((prev) => !prev);
    }
  };

  // Close when clicked or tapped outside on touch devices
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsCreditOpen(false);
      }
    };

    if (isCreditOpen) {
      document.addEventListener('mousedown', handleDocumentClick);
      document.addEventListener('touchstart', handleDocumentClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
      if (leaveTimeoutRef.current) {
        window.clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, [isCreditOpen]);

  const workflowSteps = [
    { num: '1', title: 'Scholar', desc: 'Grievance Submission', icon: 'file-text' as const },
    { num: '2', title: 'Initial Review', desc: 'Intake & Security', icon: 'shield' as const },
    { num: '3', title: 'AI-Assisted Processing', desc: 'Category Routing', icon: 'settings' as const },
    { num: '4', title: 'Institutional Review', desc: 'Departmental Review', icon: 'user' as const },
    { num: '5', title: 'Authority Workflow', desc: 'Authority Evaluation', icon: 'users' as const },
    { num: '6', title: 'Resolution / Escalation', desc: 'Action & Closure', icon: 'check-circle' as const },
    { num: '7', title: 'Institutional Record', desc: 'Dossier History', icon: 'file-text' as const },
  ];

  return (
    <section id="nivaran" className="vyasa-story-section" aria-label="NIVARAN Operational Pillar">
      <div className="vyasa-nivaran-banner">
        <div className="vyasa-nivaran-banner__content">
          {/* Left Column: Heading, Narrative, and CTA */}
          <div className="vyasa-nivaran-banner__left">
            {/* Domain Eyebrow */}
            <div className="vyasa-nivaran-eyebrow">
              <span>The First Operational Domain</span>
              <span className="vyasa-nivaran-eyebrow-sep" aria-hidden="true">&bull;</span>
              <Badge variant="gold" size="sm">Atharva Veda</Badge>
            </div>

            {/* Section Heading & Attribution Indicator */}
            <div className="vyasa-nivaran-header-block">
              <div className="vyasa-nivaran-title-row">
                <h2 className="vyasa-nivaran-title">NIVARAN</h2>

                {/* Subtle Info / Credit Indicator Button */}
                <div
                  ref={containerRef}
                  className="vyasa-nivaran-credit-container"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    type="button"
                    className="vyasa-nivaran-credit-btn"
                    aria-label="NIVARAN Design & Development Information"
                    aria-expanded={isCreditOpen}
                    aria-haspopup="dialog"
                    onClick={handleToggle}
                    onKeyDown={handleKeyDown}
                    title="Design & Development Attribution"
                  >
                    <AppIcon name="info" size={15} color="var(--vyasa-gold, #b2811a)" className="vyasa-nivaran-credit-icon" />
                  </button>

                  {/* Accessible Credit Popover */}
                  {isCreditOpen && (
                    <div
                      className="vyasa-nivaran-credit-popover"
                      role="dialog"
                      aria-label="NIVARAN Contributors"
                      data-testid="nivaran-credit-popover"
                    >
                      <div className="vyasa-nivaran-credit-header">
                        <span className="vyasa-nivaran-credit-module">NIVARAN</span>
                        <span className="vyasa-nivaran-credit-badge">Atharva Veda</span>
                      </div>
                      <div className="vyasa-nivaran-credit-label">Design &amp; Development</div>
                      <div className="vyasa-nivaran-credit-contributors">
                        <div className="vyasa-nivaran-credit-name">Harshit Gupta</div>
                      </div>
                      <div className="vyasa-nivaran-credit-meta">
                        M.Sc. Mathematics with AI &amp; Data Science
                        <br />
                        Chhatrapati Shahu Ji Maharaj University, Kanpur
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="vyasa-nivaran-subtitle">
                Institutional Pillar &bull; Grievance Redressal &amp; Well-Being
              </div>
              <div className="vyasa-nivaran-sub-tagline">
                AI-Assisted Grievance Redressal &amp; Monitoring
              </div>
            </div>

            {/* Narrative Description */}
            <p className="vyasa-nivaran-desc">
              NIVARAN is the official grievance redressal service of VYASA, designed to support
              structured grievance submission, initial review, step-by-step progress tracking,
              and transparent resolutions across Chhatrapati Shahu Ji Maharaj University.
            </p>

            {/* Institutional Feature Highlights */}
            <div className="vyasa-nivaran-tags" aria-label="NIVARAN Core Guarantees">
              <span className="vyasa-nivaran-tag">
                <AppIcon name="shield" size={13} />
                <span>Confidential Intake</span>
              </span>
              <span className="vyasa-nivaran-tag">
                <AppIcon name="layers" size={13} />
                <span>Multi-Tier Review</span>
              </span>
              <span className="vyasa-nivaran-tag">
                <AppIcon name="check-circle" size={13} />
                <span>Traceable Record</span>
              </span>
            </div>

            {/* Primary Actions */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Button
                variant="gold"
                size="lg"
                onClick={() => navigate('/modules/atharva-veda/nivaran')}
                className="vyasa-nivaran-cta-btn vyasa-nivaran-cta-btn--primary"
                aria-label="Explore NIVARAN"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span>Explore NIVARAN</span>
                  <AppIcon name="arrow-right" size={16} />
                </span>
              </Button>

              <button
                type="button"
                onClick={() => navigate('/applicant/login')}
                className="vyasa-nivaran-cta-btn vyasa-nivaran-cta-btn--secondary"
              >
                <span>Submit / Track Grievance &rarr;</span>
              </button>
            </div>
          </div>

          {/* Right Column: 7-Step Connected Workflow Visual */}
          <div className="vyasa-nivaran-banner__right">
            <div className="vyasa-workflow-pipeline" aria-label="NIVARAN workflow stages">
              <div className="vyasa-workflow-pipeline__header">
                <span className="vyasa-workflow-pipeline__title">Institutional Resolution Journey</span>
                <span className="vyasa-workflow-pipeline__badge">7 Connected Stages</span>
              </div>

              {workflowSteps.map((step, idx) => (
                <React.Fragment key={step.num}>
                  <div className="vyasa-workflow-step">
                    <div className="vyasa-workflow-step__icon-box">
                      <span className="vyasa-workflow-step__num">{step.num}</span>
                    </div>
                    <div className="vyasa-workflow-step__label">{step.title}</div>
                    <div className="vyasa-workflow-step__sub">{step.desc}</div>
                  </div>
                  {idx < workflowSteps.length - 1 && (
                    <div className="vyasa-workflow-arrow" aria-hidden="true">
                      <AppIcon name="chevron-down" size={11} color="var(--vyasa-gold, #d4a017)" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NivaranOperationalSection;
