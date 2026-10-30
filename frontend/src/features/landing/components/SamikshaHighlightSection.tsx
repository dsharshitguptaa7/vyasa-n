import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, AppIcon, Badge } from '@vyasa/ui';

export const SamikshaHighlightSection: React.FC = () => {
  const navigate = useNavigate();

  const highlightItems = [
    {
      id: 'publications',
      title: 'Scholarly Publications',
      subtitle: 'Scopus & Peer-Reviewed Repository',
      description:
        'Explore verified research papers, citations, and scholarly contributions authored by faculty members and doctoral researchers across disciplines.',
      icon: 'book-open' as const,
      route: '/modules/sama-veda/publications',
      actionLabel: 'View Publications',
    },
    {
      id: 'bulletins',
      title: 'Research Bulletins',
      subtitle: 'Official University Periodicals',
      description:
        'Access university research bulletins, thematic publication digests, academic releases, and periodic research progress documentation.',
      icon: 'file-text' as const,
      route: '/modules/sama-veda/bulletins',
      actionLabel: 'Browse Bulletins',
    },
    {
      id: 'authors',
      title: 'Faculty & Scholar Directory',
      subtitle: 'Verified Academic Profiles',
      description:
        'Discover researcher profiles with verified department affiliations, Scopus metrics, publication records, and collaborative academic dossiers.',
      icon: 'users' as const,
      route: '/modules/sama-veda/authors',
      actionLabel: 'Explore Directory',
    },
    {
      id: 'certificates',
      title: 'Certificate Verification',
      subtitle: 'Tamper-Evident Validation',
      description:
        'Verify digital felicitation certificates and academic achievement commendations issued through the university’s research recognition framework.',
      icon: 'shield' as const,
      route: '/modules/sama-veda/certificates',
      actionLabel: 'Verify Certificate',
    },
    {
      id: 'cam-projects',
      title: 'Research Initiatives & Showcases',
      subtitle: 'Collaborative Innovation',
      description:
        'Examine interdisciplinary research projects, CAM-AI innovation showcases, and institutional research initiatives advancing knowledge discovery.',
      icon: 'graduation-cap' as const,
      route: '/modules/sama-veda/cam-projects',
      actionLabel: 'View Initiatives',
    },
    {
      id: 'fellowships',
      title: 'Fellowship Schemes',
      subtitle: 'Doctoral Grants & Fellowships',
      description:
        'Track active doctoral scholar fellowships, state research grants, and university-sponsored schemes supporting academic excellence.',
      icon: 'clipboard' as const,
      route: '/modules/sama-veda/fellowships',
      actionLabel: 'Explore Fellowships',
    },
  ];

  return (
    <section id="samiksha" className="vyasa-story-section vyasa-samiksha-section" aria-label="SAMIKSHA Research Highlights">
      <div className="vyasa-samiksha-banner">
        <div className="vyasa-samiksha-banner__header">
          <div className="vyasa-samiksha-eyebrow">
            <span>Sama Veda</span>
            <span className="vyasa-samiksha-eyebrow-sep" aria-hidden="true">&bull;</span>
            <Badge variant="teal" size="sm">Operational Pillar</Badge>
          </div>

          <div className="vyasa-samiksha-header-row">
            <div>
              <div
                className="vyasa-samiksha-title"
                role="heading"
                aria-level={2}
                aria-label="SAMIKSHA — Research Recognition Platform"
              >
                SAMIKSHA
              </div>
              <div className="vyasa-samiksha-subtitle">
                Institutional Pillar &bull; Research Recognition &amp; Communication
              </div>
            </div>

            <Button
              variant="teal"
              size="md"
              onClick={() => navigate('/modules/sama-veda')}
              className="vyasa-samiksha-header-cta"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span>Explore Full SAMIKSHA Portal</span>
                <AppIcon name="arrow-right" size={16} />
              </span>
            </Button>
          </div>

          <p className="vyasa-samiksha-desc">
            SAMIKSHA is the official research recognition and academic communication platform of VYASA.
            It consolidates university publications, institutional bulletins, researcher directories, and verified
            academic commendations into an integrated digital repository at Chhatrapati Shahu Ji Maharaj University.
          </p>

          {/* Institutional Quality Indicators */}
          <div className="vyasa-samiksha-tags" aria-label="SAMIKSHA Research Standards">
            <span className="vyasa-samiksha-tag">
              <AppIcon name="book-open" size={13} />
              <span>Scopus &amp; WoS Indexed</span>
            </span>
            <span className="vyasa-samiksha-tag">
              <AppIcon name="shield" size={13} />
              <span>Tamper-Evident SHA-256</span>
            </span>
            <span className="vyasa-samiksha-tag">
              <AppIcon name="users" size={13} />
              <span>Verified Scholar Profiles</span>
            </span>
          </div>
        </div>

        {/* 6 Feature Cards in a Balanced 3x2 Grid */}
        <div className="vyasa-samiksha-grid">
          {highlightItems.map((item) => (
            <div key={item.id} className="vyasa-samiksha-card">
              <div className="vyasa-samiksha-card__icon-box" aria-hidden="true">
                <AppIcon name={item.icon} size={20} color="var(--vyasa-teal, #0d766e)" />
              </div>
              <h3 className="vyasa-samiksha-card__title">{item.title}</h3>
              <div className="vyasa-samiksha-card__sub">{item.subtitle}</div>
              <p className="vyasa-samiksha-card__desc">{item.description}</p>
              <button
                type="button"
                className="vyasa-samiksha-card__link"
                onClick={() => navigate(item.route)}
                aria-label={`${item.actionLabel} in SAMIKSHA`}
              >
                <span>{item.actionLabel}</span>
                <AppIcon name="arrow-right" size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SamikshaHighlightSection;
