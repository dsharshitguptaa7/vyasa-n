import React from 'react';
import { Badge, AppIcon } from '@vyasa/ui';

interface SamikshaDiscoveryGridProps {
  totalPublications: number;
  totalBulletins: number;
  totalAuthors: number;
  totalCamProjects: number;
  totalFellows: number;
  onNavigateTab: (tabId: string) => void;
}

export const SamikshaDiscoveryGrid: React.FC<SamikshaDiscoveryGridProps> = ({
  totalPublications,
  totalBulletins,
  totalAuthors,
  totalCamProjects,
  totalFellows,
  onNavigateTab,
}) => {
  const cards = [
    {
      tabId: 'publications',
      title: 'Research Publications',
      subtitle: 'Scopus & Web of Science Indexed',
      badge: totalPublications > 0 ? `${totalPublications} Published` : 'Verified',
      badgeVariant: 'teal' as const,
      icon: 'book-open' as const,
      accentColor: '#0d9488',
      accentBg: '#f0fdfa',
      accentBorder: '#ccfbf1',
      description:
        'Peer-reviewed scholarly papers, review articles, book chapters, and conference proceedings authored by CSJMU faculty.',
      actionText: 'Browse Publications',
    },
    {
      tabId: 'certificates',
      title: 'Certificate Verification',
      subtitle: 'Cryptographic Felicitation Integrity',
      badge: 'SHA-256',
      badgeVariant: 'primary' as const,
      icon: 'shield' as const,
      accentColor: '#d97706',
      accentBg: '#fffbeb',
      accentBorder: '#fef3c7',
      description:
        'Public verification portal for official Research Appreciation and Felicitation Certificates issued by the University R&D Cell.',
      actionText: 'Verify Certificate',
    },
    {
      tabId: 'bulletins',
      title: 'Research Bulletins',
      subtitle: 'Official Institutional Editions',
      badge: totalBulletins > 0 ? `${totalBulletins} Volumes` : 'Archival',
      badgeVariant: 'saffron' as const,
      icon: 'file-text' as const,
      accentColor: '#0284c7',
      accentBg: '#f0f9ff',
      accentBorder: '#e0f2fe',
      description:
        'Bi-annual publications cataloging University research achievements, publication milestones, and verified scholar recognitions.',
      actionText: 'Access Bulletins',
    },
    {
      tabId: 'authors',
      title: 'Researcher Directory',
      subtitle: 'Faculty & Scholar Registry',
      badge: totalAuthors > 0 ? `${totalAuthors} Faculty` : 'Registry',
      badgeVariant: 'teal' as const,
      icon: 'users' as const,
      accentColor: '#0d9488',
      accentBg: '#f0fdfa',
      accentBorder: '#ccfbf1',
      description:
        'Official institutional directory of active university researchers, verified faculty profiles, and Scopus author identifiers.',
      actionText: 'Explore Directory',
    },
    {
      tabId: 'cam-projects',
      title: 'CAM-AI Grants',
      subtitle: 'Applied Mathematics & AI Projects',
      badge: totalCamProjects > 0 ? `${totalCamProjects} Grants` : 'Funded',
      badgeVariant: 'saffron' as const,
      icon: 'layers' as const,
      accentColor: '#0f2b48',
      accentBg: '#f8fafc',
      accentBorder: '#e2e8f0',
      description:
        'Interdisciplinary research initiatives and competitive grants funded under the Centre of Applied Mathematics & Artificial Intelligence.',
      actionText: 'View CAM-AI Projects',
    },
    {
      tabId: 'fellowships',
      title: 'Doctoral Fellowships',
      subtitle: 'National & Institutional Schemes',
      badge: totalFellows > 0 ? `${totalFellows} Scholars` : 'Fellowships',
      badgeVariant: 'teal' as const,
      icon: 'graduation-cap' as const,
      accentColor: '#0284c7',
      accentBg: '#f0f9ff',
      accentBorder: '#e0f2fe',
      description:
        'Institutional and centrally sponsored doctoral fellowship schemes supporting full-time Ph.D. scholars across university departments.',
      actionText: 'View Fellowships',
    },
  ];

  return (
    <section aria-labelledby="samiksha-pillars-heading" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="samiksha-eyebrow gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#d97706',
              }}
            />
            <span>Institutional Capabilities</span>
          </div>
          <h2
            id="samiksha-pillars-heading"
            className="samiksha-section-title"
            style={{ fontSize: 'clamp(22px, 2.5vw, 28px)', color: '#0f2b48', margin: '4px 0 6px 0' }}
          >
            Research Discovery &amp; Recognition Pillars
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, lineHeight: 1.55 }}>
            Six foundational pillars powering academic discovery, verification, publication integrity, and scholar funding at CSJMU.
          </p>
        </div>
      </div>

      <div
        className="samiksha-pillar-responsive-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '20px',
        }}
      >
        {cards.map((c) => (
          <div
            key={c.tabId}
            onClick={() => onNavigateTab(c.tabId)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateTab(c.tabId);
              }
            }}
            className="samiksha-card samiksha-interactive-lift samiksha-pillar-card"
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '24px',
              minHeight: '250px',
              boxSizing: 'border-box',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '11px',
                    background: c.accentBg,
                    border: `1px solid ${c.accentBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <AppIcon name={c.icon} size={22} color={c.accentColor} />
                </div>
                <Badge variant={c.badgeVariant}>{c.badge}</Badge>
              </div>

              <h3
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  color: '#0f2b48',
                  margin: '0 0 4px 0',
                  lineHeight: 1.3,
                }}
              >
                {c.title}
              </h3>
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontWeight: 600,
                  marginBottom: '10px',
                }}
              >
                {c.subtitle}
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: '#475569',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {c.description}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 700,
                color: c.accentColor,
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <span>{c.actionText}</span>
              <span className="samiksha-action-arrow" style={{ transition: 'transform 0.18s ease' }}>
                &rarr;
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
