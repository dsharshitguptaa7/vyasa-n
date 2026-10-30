import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, AppIcon, Badge } from '@vyasa/ui';

export const SignaturePillarsSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section id="operational-pillars" className="vyasa-signature-pillars" aria-label="Operational Pillars">
      <div className="vyasa-signature-pillars__header">
        <div className="vyasa-signature-pillars__eyebrow">
          <span>Operational Services</span>
          <span className="vyasa-signature-pillars__eyebrow-sep" aria-hidden="true">&bull;</span>
          <span>Core Governance Pillars</span>
        </div>
        <h2 className="vyasa-signature-pillars__title">
          Two Operational Pillars. One Unified Ecosystem.
        </h2>
        <p className="vyasa-signature-pillars__desc">
          Direct institutional gateways to the university&apos;s active research recognition and grievance redressal platforms.
        </p>
      </div>

      <div className="vyasa-signature-pillars__grid">
        {/* Left Operational Card: SAMIKSHA */}
        <div
          className="vyasa-pillar-card vyasa-pillar-card--samiksha"
          data-testid="service-card-samiksha"
        >
          <div className="vyasa-pillar-card__top">
            <div className="vyasa-pillar-card__meta-bar">
              <span className="vyasa-pillar-card__domain vyasa-pillar-card__domain--samiksha">
                SAMA VEDA
              </span>
              <Badge variant="teal" size="sm">Operational Pillar</Badge>
            </div>

            <div className="vyasa-pillar-card__brand">
              <div
                className="vyasa-pillar-card__icon-box vyasa-pillar-card__icon-box--samiksha"
                aria-hidden="true"
              >
                <AppIcon name="book-open" size={24} color="var(--vyasa-teal, #0d766e)" />
              </div>
              <div>
                <div
                  className="vyasa-pillar-card__name"
                  role="heading"
                  aria-level={3}
                  aria-label="SAMIKSHA — Research Recognition"
                >
                  SAMIKSHA
                </div>
                <div className="vyasa-pillar-card__pillar vyasa-pillar-card__pillar--samiksha">
                  <span>Pillar &bull; Research Recognition &amp; Communication</span>
                </div>
              </div>
            </div>

            <p className="vyasa-pillar-card__desc">
              Explore the university&apos;s research recognition and communication ecosystem, including
              research publications, bulletins, academic achievements, and related research initiatives.
            </p>

            <div className="vyasa-pillar-card__tags">
              <span className="vyasa-pillar-chip vyasa-pillar-chip--samiksha">
                <AppIcon name="file-text" size={13} color="var(--vyasa-teal, #0d766e)" />
                Publications Repository
              </span>
              <span className="vyasa-pillar-chip vyasa-pillar-chip--samiksha">
                <AppIcon name="clipboard" size={13} color="var(--vyasa-teal, #0d766e)" />
                Research Bulletins
              </span>
              <span className="vyasa-pillar-chip vyasa-pillar-chip--samiksha">
                <AppIcon name="users" size={13} color="var(--vyasa-teal, #0d766e)" />
                Faculty Directory
              </span>
              <span className="vyasa-pillar-chip vyasa-pillar-chip--samiksha">
                <AppIcon name="shield" size={13} color="var(--vyasa-teal, #0d766e)" />
                Certificate Verification
              </span>
            </div>
          </div>

          <div className="vyasa-pillar-card__bottom">
            <Button
              variant="teal"
              size="md"
              className="vyasa-pillar-card__cta"
              onClick={() => navigate('/modules/sama-veda')}
              aria-label="Explore SAMIKSHA"
            >
              <span className="vyasa-pillar-card__cta-inner">
                <span>Explore SAMIKSHA</span>
                <AppIcon name="arrow-right" size={16} className="vyasa-pillar-card__cta-arrow" />
              </span>
            </Button>
          </div>
        </div>

        {/* Right Operational Card: NIVARAN */}
        <div
          className="vyasa-pillar-card vyasa-pillar-card--nivaran"
          data-testid="service-card-nivaran"
        >
          <div className="vyasa-pillar-card__top">
            <div className="vyasa-pillar-card__meta-bar">
              <span className="vyasa-pillar-card__domain vyasa-pillar-card__domain--nivaran">
                ATHARVA VEDA
              </span>
              <Badge variant="gold" size="sm">Operational Pillar</Badge>
            </div>

            <div className="vyasa-pillar-card__brand">
              <div
                className="vyasa-pillar-card__icon-box vyasa-pillar-card__icon-box--nivaran"
                aria-hidden="true"
              >
                <AppIcon name="shield" size={24} color="var(--vyasa-gold, #b2811a)" />
              </div>
              <div>
                <div
                  className="vyasa-pillar-card__name"
                  role="heading"
                  aria-level={3}
                  aria-label="NIVARAN — Grievance Redressal"
                >
                  NIVARAN
                </div>
                <div className="vyasa-pillar-card__pillar vyasa-pillar-card__pillar--nivaran">
                  <span>Pillar &bull; Grievance Redressal &amp; Institutional Well-Being</span>
                </div>
              </div>
            </div>

            <p className="vyasa-pillar-card__desc">
              Access the university&apos;s grievance redressal service to submit concerns, track
              case progress, and follow the institutional resolution process.
            </p>

            <div className="vyasa-pillar-card__tags">
              <span className="vyasa-pillar-chip vyasa-pillar-chip--nivaran">
                <AppIcon name="file-text" size={13} color="var(--vyasa-gold, #b2811a)" />
                Grievance Submission
              </span>
              <span className="vyasa-pillar-chip vyasa-pillar-chip--nivaran">
                <AppIcon name="scale" size={13} color="var(--vyasa-gold, #b2811a)" />
                Multi-Tier Review
              </span>
              <span className="vyasa-pillar-chip vyasa-pillar-chip--nivaran">
                <AppIcon name="clock" size={13} color="var(--vyasa-gold, #b2811a)" />
                Status Tracking
              </span>
              <span className="vyasa-pillar-chip vyasa-pillar-chip--nivaran">
                <AppIcon name="check-circle" size={13} color="var(--vyasa-gold, #b2811a)" />
                Transparent Resolution
              </span>
            </div>
          </div>

          <div className="vyasa-pillar-card__bottom">
            <Button
              variant="gold"
              size="md"
              className="vyasa-pillar-card__cta"
              onClick={() => navigate('/modules/atharva-veda/nivaran')}
              aria-label="Explore NIVARAN"
            >
              <span className="vyasa-pillar-card__cta-inner">
                <span>Explore NIVARAN</span>
                <AppIcon name="arrow-right" size={16} className="vyasa-pillar-card__cta-arrow" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SignaturePillarsSection;
