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
    { num: '1', title: 'Scholar', desc: 'Case Intake' },
    { num: '2', title: 'NIVARAN-AI', desc: 'Gateway' },
    { num: '3', title: 'AI-Assisted Processing', desc: 'Classification & OCR' },
    { num: '4', title: 'Institutional Review', desc: 'Manager Triage' },
    { num: '5', title: 'Authority Workflow', desc: 'Multi-Tier Actions' },
    { num: '6', title: 'Resolution / Escalation', desc: 'Action Closure' },
    { num: '7', title: 'Institutional Record', desc: 'Audit History' },
  ];

  return (
    <section id="nivaran" className="vyasa-story-section">
      <div className="vyasa-nivaran-banner">
        {/* Domain Eyebrow */}
        <div className="vyasa-nivaran-eyebrow">
          <span>The First Operational Domain</span>
          <span>&bull;</span>
          <Badge variant="teal" size="sm">Atharva Veda</Badge>
        </div>

        {/* Section Heading & Subtle Attribution Indicator */}
        <div className="vyasa-nivaran-header-block">
          <div className="vyasa-nivaran-title-row">
            <h2 className="vyasa-nivaran-title">NIVARAN-AI</h2>

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
                aria-label="NIVARAN-AI Design & Development Information"
                aria-expanded={isCreditOpen}
                aria-haspopup="dialog"
                onClick={handleToggle}
                onKeyDown={handleKeyDown}
                title="Design & Development Attribution"
              >
                <AppIcon name="info" size={15} color="var(--vyasa-gold, #b2811a)" className="vyasa-nivaran-credit-icon" />
              </button>

              {/* Accessible Credit Popover / Tooltip */}
              {isCreditOpen && (
                <div
                  className="vyasa-nivaran-credit-popover"
                  role="dialog"
                  aria-label="NIVARAN-AI Contributors"
                  data-testid="nivaran-credit-popover"
                >
                  <div className="vyasa-nivaran-credit-header">
                    <span className="vyasa-nivaran-credit-module">NIVARAN-AI</span>
                    <span className="vyasa-nivaran-credit-badge">Atharva Veda</span>
                  </div>
                  <div className="vyasa-nivaran-credit-label">Design &amp; Development</div>
                  <div className="vyasa-nivaran-credit-contributors">
                    <div className="vyasa-nivaran-credit-name">Harshit Gupta</div>
                    <div className="vyasa-nivaran-credit-name">Manali Yadav</div>
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
            AI-Assisted Grievance Redressal &amp; Monitoring
          </div>
        </div>

        {/* Narrative Description */}
        <p className="vyasa-nivaran-desc">
          NIVARAN-AI is the operational Atharva Veda domain of VYASAᴺ, designed to support smart,
          AI-assisted grievance redressal, institutional review, workflow monitoring and transparent
          resolution processes within the Research &amp; Development ecosystem.
        </p>

        {/* Simple Visual Workflow */}
        <div className="vyasa-workflow-pipeline" aria-label="NIVARAN workflow stages">
          {workflowSteps.map((step, idx) => (
            <React.Fragment key={step.num}>
              <div className="vyasa-workflow-step">
                <div className="vyasa-workflow-step__num">{step.num}</div>
                <div className="vyasa-workflow-step__label">{step.title}</div>
              </div>
              {idx < workflowSteps.length - 1 && (
                <div className="vyasa-workflow-arrow" aria-hidden="true">
                  <AppIcon name="arrow-right" size={14} color="var(--vyasa-gold, #d4a017)" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Primary CTA */}
        <div>
          <Button
            variant="saffron"
            size="lg"
            onClick={() => navigate('/modules/atharva-veda/nivaran')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span>Explore NIVARAN-AI</span>
              <AppIcon name="arrow-right" size={16} />
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default NivaranOperationalSection;
