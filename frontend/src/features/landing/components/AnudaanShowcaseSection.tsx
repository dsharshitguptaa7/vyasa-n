import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, AppIcon } from '@vyasa/ui';

export const AnudaanShowcaseSection: React.FC = () => {
  const navigate = useNavigate();

  const workflowSteps = [
    { num: '1', title: 'Applicant Profile', desc: 'Identity & Campus Category Verification', icon: 'user' as const },
    { num: '2', title: 'Publication Details', desc: 'Scopus / WoS DOI & Indexing Intake', icon: 'book-open' as const },
    { num: '3', title: 'Author Attribution', desc: 'First, Corresponding & Co-Author Distribution', icon: 'users' as const },
    { num: '4', title: 'Bank Mapping', desc: 'Secure Encrypted Account Validation', icon: 'shield' as const },
    { num: '5', title: 'Supporting Documents', desc: 'Full-Text PDF & Evidence Management', icon: 'file-text' as const },
    { num: '6', title: 'Institutional Verification', desc: 'Dean R&D & Research Review', icon: 'check-circle' as const },
    { num: '7', title: 'Incentive Processing', desc: 'Sanction Generation & Financial Disbursement', icon: 'award' as const },
  ];

  const eligibilityCategories = [
    {
      title: 'CSJMU Campus Faculty',
      desc: 'Currently serving permanent & contract faculty in university campus departments.',
    },
    {
      title: 'CSJMU Campus Registered Research Scholars',
      desc: 'Registered doctoral candidates with active university campus enrolment.',
    },
    {
      title: 'CSJMU Campus Post-Doctoral Researchers',
      desc: 'Appointed PDF scholars working in campus departments and centers of excellence.',
    },
  ];

  return (
    <section id="anudaan" className="vyasa-story-section vyasa-anudaan-section" aria-label="ANUDAAN Operational System">
      <div className="vyasa-anudaan-banner">
        <div className="vyasa-anudaan-banner__content">
          {/* Left Column: Heading, Institutional Copy, Eligibility & CTAs */}
          <div className="vyasa-anudaan-banner__left">
            {/* Domain Eyebrow */}
            <div className="vyasa-anudaan-eyebrow">
              <span>YAJUR VEDA &bull; OPERATIONAL SYSTEM</span>
              <span className="vyasa-anudaan-eyebrow-sep" aria-hidden="true">&bull;</span>
              <Badge variant="saffron" size="sm">Operational System</Badge>
            </div>

            {/* Title & Subtitle */}
            <div className="vyasa-anudaan-header-block">
              <h2 className="vyasa-anudaan-title">ANUDAAN</h2>
              <div className="vyasa-anudaan-subtitle">
                Research Publication Incentive Management System
              </div>
              <div className="vyasa-anudaan-sub-tagline">
                CSJMU Institutional Research Publication Incentive Workflow
              </div>
            </div>

            {/* Narrative Description */}
            <p className="vyasa-anudaan-desc">
              ANUDAAN is an institutional initiative of Chhatrapati Shahu Ji Maharaj University, Kanpur,
              designed to facilitate research publication incentive applications from eligible CSJMU
              Campus Faculty, Registered Research Scholars and Post-Doctoral Researchers.
            </p>

            <p className="vyasa-anudaan-sub-desc">
              An integrated digital workflow for research publication claims, author attribution, publication
              verification, supporting documentation and institutional incentive processing.
            </p>

            {/* Eligible Categories Callout */}
            <div className="vyasa-anudaan-eligibility-box" aria-label="Eligible applicant categories">
              <div className="vyasa-anudaan-eligibility-header">
                <AppIcon name="shield" size={14} color="var(--vyasa-saffron, #c85602)" />
                <span>Institutional Eligibility Policy (Campus Units Only)</span>
              </div>
              <ul className="vyasa-anudaan-eligibility-list">
                {eligibilityCategories.map((cat, idx) => (
                  <li key={idx} className="vyasa-anudaan-eligibility-item">
                    <span className="vyasa-anudaan-eligibility-dot" aria-hidden="true" />
                    <div>
                      <strong>{cat.title}:</strong> <span>{cat.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Institutional Quality Indicators / Guarantees */}
            <div className="vyasa-anudaan-tags" aria-label="ANUDAAN Core Guarantees">
              <span className="vyasa-anudaan-tag">
                <AppIcon name="book-open" size={13} />
                <span>Scopus &amp; WoS Validated</span>
              </span>
              <span className="vyasa-anudaan-tag">
                <AppIcon name="users" size={13} />
                <span>Direct Author Attribution</span>
              </span>
              <span className="vyasa-anudaan-tag">
                <AppIcon name="shield" size={13} />
                <span>Encrypted Bank Mapping</span>
              </span>
              <span className="vyasa-anudaan-tag">
                <AppIcon name="check-circle" size={13} />
                <span>Transparent Audit Trail</span>
              </span>
            </div>

            {/* Primary Actions */}
            <div className="vyasa-anudaan-action-row">
              <Button
                variant="saffron"
                size="lg"
                onClick={() => navigate('/modules/yajur-veda/anudaan')}
                className="vyasa-anudaan-cta-btn vyasa-anudaan-cta-btn--primary"
                aria-label="Explore ANUDAAN"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span>Explore ANUDAAN</span>
                  <AppIcon name="arrow-right" size={16} />
                </span>
              </Button>

              <button
                type="button"
                onClick={() => navigate('/modules/yajur-veda/anudaan')}
                className="vyasa-anudaan-cta-btn vyasa-anudaan-cta-btn--secondary"
                aria-label="View Eligibility"
              >
                <span>View Eligibility &amp; Guidelines &rarr;</span>
              </button>
            </div>
          </div>

          {/* Right Column: 7-Stage Connected Workflow Visual */}
          <div className="vyasa-anudaan-banner__right">
            <div className="vyasa-anudaan-pipeline" aria-label="ANUDAAN workflow stages">
              <div className="vyasa-anudaan-pipeline__header">
                <span className="vyasa-anudaan-pipeline__title">Incentive Processing Journey</span>
                <span className="vyasa-anudaan-pipeline__badge">7 Connected Stages</span>
              </div>

              {workflowSteps.map((step, idx) => (
                <React.Fragment key={step.num}>
                  <div className="vyasa-anudaan-step">
                    <div className="vyasa-anudaan-step__icon-box">
                      <span className="vyasa-anudaan-step__num">{step.num}</span>
                    </div>
                    <div className="vyasa-anudaan-step__content">
                      <div className="vyasa-anudaan-step__label">{step.title}</div>
                      <div className="vyasa-anudaan-step__sub">{step.desc}</div>
                    </div>
                  </div>
                  {idx < workflowSteps.length - 1 && (
                    <div className="vyasa-anudaan-arrow" aria-hidden="true">
                      <AppIcon name="chevron-down" size={11} color="var(--vyasa-saffron, #c85602)" />
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

export default AnudaanShowcaseSection;
