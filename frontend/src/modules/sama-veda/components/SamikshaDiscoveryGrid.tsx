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
      description:
        'Peer-reviewed scholarly papers, review articles, book chapters, and conference proceedings authored by CSJMU faculty.',
      actionText: 'Browse Publications \u2192',
    },
    {
      tabId: 'certificates',
      title: 'Certificate Verification',
      subtitle: 'Cryptographic Felicitation Integrity',
      badge: 'SHA-256',
      badgeVariant: 'primary' as const,
      icon: 'shield' as const,
      accentColor: '#f59e0b',
      description:
        'Public verification portal for official Research Appreciation and Felicitation Certificates issued by the University R&D Cell.',
      actionText: 'Verify Certificate \u2192',
    },
    {
      tabId: 'bulletins',
      title: 'Research Bulletins',
      subtitle: 'Official Institutional Editions',
      badge: totalBulletins > 0 ? `${totalBulletins} Volumes` : 'Archival',
      badgeVariant: 'saffron' as const,
      icon: 'file-text' as const,
      accentColor: '#0284c7',
      description:
        'Bi-annual publications cataloging University research achievements, publication milestones, and verified scholar recognitions.',
      actionText: 'Access Bulletins \u2192',
    },
    {
      tabId: 'authors',
      title: 'Researcher Directory',
      subtitle: 'Faculty & Scholar Registry',
      badge: totalAuthors > 0 ? `${totalAuthors} Faculty` : 'Registry',
      badgeVariant: 'teal' as const,
      icon: 'users' as const,
      accentColor: '#0d9488',
      description:
        'Official institutional directory of active university researchers, verified faculty profiles, and Scopus author identifiers.',
      actionText: 'Explore Directory \u2192',
    },
    {
      tabId: 'cam-projects',
      title: 'CAM-AI Grants',
      subtitle: 'Applied Mathematics & AI Projects',
      badge: totalCamProjects > 0 ? `${totalCamProjects} Grants` : 'Funded',
      badgeVariant: 'saffron' as const,
      icon: 'layers' as const,
      accentColor: '#8b5cf6',
      description:
        'Interdisciplinary research initiatives and competitive grants funded under the Centre of Applied Mathematics & Artificial Intelligence.',
      actionText: 'View CAM-AI Projects \u2192',
    },
    {
      tabId: 'fellowships',
      title: 'Doctoral Fellowships',
      subtitle: 'National & Institutional Schemes',
      badge: totalFellows > 0 ? `${totalFellows} Scholars` : 'Fellowships',
      badgeVariant: 'teal' as const,
      icon: 'graduation-cap' as const,
      accentColor: '#06b6d4',
      description:
        'Institutional and centrally sponsored doctoral fellowship schemes supporting full-time Ph.D. scholars across university departments.',
      actionText: 'View Fellowships \u2192',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="samiksha-eyebrow gold">
            Institutional Capabilities
          </div>
          <h2 className="samiksha-section-title">
            Research Discovery &amp; Recognition Pillars
          </h2>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
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
            className="samiksha-card samiksha-interactive-lift"
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '24px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: `${c.accentColor}18`,
                    border: `1px solid ${c.accentColor}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name={c.icon} size={20} color={c.accentColor} />
                </div>
                <Badge variant={c.badgeVariant}>{c.badge}</Badge>
              </div>

              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f2b48', margin: '0 0 4px 0' }}>
                {c.title}
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '10px' }}>
                {c.subtitle}
              </div>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.55 }}>
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
                paddingTop: '10px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <span>{c.actionText}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
