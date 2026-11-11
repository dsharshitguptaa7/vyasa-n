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
          Three Operational Pillars. One Unified Ecosystem.
        </h2>
        <p className="vyasa-signature-pillars__desc">
          Direct institutional gateways to the university&apos;s active research recognition, grievance redressal, and research administration platforms.
        </p>
      </div>

      <div className="vyasa-signature-pillars__grid">
        {/* Pillar 1 — SAMA VEDA: SAMIKSHA */}
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
              <div className="vyasa-pillar-card__brand-text">
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
            <div className="vyasa-pillar-card__secondary-wrap">
              <a
                href="/modules/sama-veda"
                className="vyasa-pillar-card__secondary-link vyasa-pillar-card__secondary-link--samiksha"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/modules/sama-veda');
                }}
              >
                <span>Portal: SAMIKSHA</span>
                <AppIcon name="arrow-right" size={12} className="vyasa-pillar-card__secondary-arrow" />
              </a>
            </div>
          </div>
        </div>

        {/* Pillar 2 — ATHARVA VEDA: NIVARAN */}
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
              <div className="vyasa-pillar-card__brand-text">
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
            <div className="vyasa-pillar-card__secondary-wrap">
              <a
                href="/modules/atharva-veda/nivaran"
                className="vyasa-pillar-card__secondary-link vyasa-pillar-card__secondary-link--nivaran"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/modules/atharva-veda/nivaran');
                }}
              >
                <span>Portal: NIVARAN</span>
                <AppIcon name="arrow-right" size={12} className="vyasa-pillar-card__secondary-arrow" />
              </a>
            </div>
          </div>
        </div>

        {/* Pillar 3 — YAJUR VEDA: ANUDAAN */}
        <div
          className="vyasa-pillar-card vyasa-pillar-card--anudaan"
          data-testid="service-card-anudaan"
        >
          <div className="vyasa-pillar-card__top">
            <div className="vyasa-pillar-card__meta-bar">
              <span className="vyasa-pillar-card__domain vyasa-pillar-card__domain--anudaan">
                YAJUR VEDA
              </span>
              <Badge variant="saffron" size="sm">Operational Domain</Badge>
            </div>

            <div className="vyasa-pillar-card__brand">
              <div
                className="vyasa-pillar-card__icon-box vyasa-pillar-card__icon-box--anudaan"
                aria-hidden="true"
              >
                <AppIcon name="building" size={24} color="var(--vyasa-saffron, #c85602)" />
              </div>
              <div className="vyasa-pillar-card__brand-text">
                <div
                  className="vyasa-pillar-card__name"
                  role="heading"
                  aria-level={3}
                  aria-label="ANUDAAN — Research Administration & Incentives"
                >
                  ANUDAAN
                </div>
                <div className="vyasa-pillar-card__pillar vyasa-pillar-card__pillar--anudaan">
                  <span>Pillar &bull; Research Administration &amp; Incentives</span>
                </div>
              </div>
            </div>

            <p className="vyasa-pillar-card__desc">
              An institutional initiative for eligible CSJMU Campus Faculty, Registered Research
              Scholars and Post-Doctoral Researchers to submit research publication incentive claims.
            </p>

            <div className="vyasa-pillar-card__tags">
              <span className="vyasa-pillar-chip vyasa-pillar-chip--anudaan">
                <AppIcon name="file-text" size={13} color="var(--vyasa-saffron, #c85602)" />
                Publication Claims
              </span>
              <span className="vyasa-pillar-chip vyasa-pillar-chip--anudaan">
                <AppIcon name="users" size={13} color="var(--vyasa-saffron, #c85602)" />
                Author Attribution
              </span>
              <span className="vyasa-pillar-chip vyasa-pillar-chip--anudaan">
                <AppIcon name="shield" size={13} color="var(--vyasa-saffron, #c85602)" />
                Bank Verification
              </span>
              <span className="vyasa-pillar-chip vyasa-pillar-chip--anudaan">
                <AppIcon name="check-circle" size={13} color="var(--vyasa-saffron, #c85602)" />
                Incentive Disbursement
              </span>
            </div>
          </div>

          <div className="vyasa-pillar-card__bottom">
            <Button
              variant="saffron"
              size="md"
              className="vyasa-pillar-card__cta"
              onClick={() => navigate('/modules/yajur-veda/anudaan')}
              aria-label="Explore ANUDAAN"
            >
              <span className="vyasa-pillar-card__cta-inner">
                <span>Explore ANUDAAN</span>
                <AppIcon name="arrow-right" size={16} className="vyasa-pillar-card__cta-arrow" />
              </span>
            </Button>
            <div className="vyasa-pillar-card__secondary-wrap">
              <a
                href="/modules/yajur-veda/anudaan"
                className="vyasa-pillar-card__secondary-link vyasa-pillar-card__secondary-link--anudaan"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/modules/yajur-veda/anudaan');
                }}
              >
                <span>Portal: ANUDAAN</span>
                <AppIcon name="arrow-right" size={12} className="vyasa-pillar-card__secondary-arrow" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SignaturePillarsSection;
