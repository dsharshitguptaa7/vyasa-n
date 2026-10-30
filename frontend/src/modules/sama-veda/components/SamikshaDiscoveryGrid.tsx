import React from 'react';
import { Badge, Button, AppIcon } from '@vyasa/ui';

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
      description:
        'Peer-reviewed scholarly papers, review articles, book chapters, and conference proceedings authored by CSJMU faculty.',
      actionText: 'Browse Publications &rarr;',
    },
    {
      tabId: 'certificates',
      title: 'Certificate Verification',
      subtitle: 'Cryptographic Felicitation Integrity',
      badge: 'SHA-256',
      badgeVariant: 'primary' as const,
      icon: 'shield' as const,
      description:
        'Public verification portal for official Research Appreciation and Felicitation Certificates issued by the University R&D Cell.',
      actionText: 'Verify Certificate &rarr;',
    },
    {
      tabId: 'bulletins',
      title: 'Research Bulletins',
      subtitle: 'Official Institutional Editions',
      badge: totalBulletins > 0 ? `${totalBulletins} Volumes` : 'Archival',
      badgeVariant: 'saffron' as const,
      icon: 'file-text' as const,
      description:
        'Bi-annual publications cataloging University research achievements, publication milestones, and verified scholar recognitions.',
      actionText: 'Access Bulletins &rarr;',
    },
    {
      tabId: 'authors',
      title: 'Researcher Directory',
      subtitle: 'Faculty & Scholar Registry',
      badge: totalAuthors > 0 ? `${totalAuthors} Faculty` : 'Registry',
      badgeVariant: 'teal' as const,
      icon: 'users' as const,
      description:
        'Official institutional directory of active university researchers, verified faculty profiles, and Scopus author identifiers.',
      actionText: 'Explore Directory &rarr;',
    },
    {
      tabId: 'cam-projects',
      title: 'CAM-AI Grants',
      subtitle: 'Applied Mathematics & AI Projects',
      badge: totalCamProjects > 0 ? `${totalCamProjects} Grants` : 'Funded',
      badgeVariant: 'saffron' as const,
      icon: 'layers' as const,
      description:
        'Interdisciplinary research initiatives and competitive grants funded under the Centre of Applied Mathematics & Artificial Intelligence.',
      actionText: 'View CAM-AI Projects &rarr;',
    },
    {
      tabId: 'fellowships',
      title: 'Doctoral Fellowships',
      subtitle: 'National & Institutional Schemes',
      badge: totalFellows > 0 ? `${totalFellows} Scholars` : 'Fellowships',
      badgeVariant: 'teal' as const,
      icon: 'graduation-cap' as const,
      description:
        'Institutional and centrally sponsored doctoral fellowship schemes supporting full-time Ph.D. scholars across university departments.',
      actionText: 'View Fellowships &rarr;',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#b2811a',
              letterSpacing: '0.08em',
              marginBottom: '4px',
            }}
          >
            Institutional Capabilities
          </div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#0f2b48',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
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
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '22px',
              boxShadow: '0 2px 8px rgba(15, 43, 72, 0.04)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--vyasa-teal-light, #f0fdfa)',
                      border: '1px solid var(--vyasa-teal-border, #99f6e4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--vyasa-teal, #0d766e)',
                    }}
                  >
                    <AppIcon name={c.icon} size={18} color="var(--vyasa-teal, #0d766e)" />
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#0f2b48',
                        margin: 0,
                      }}
                    >
                      {c.title}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                      {c.subtitle}
                    </div>
                  </div>
                </div>
                <Badge variant={c.badgeVariant}>{c.badge}</Badge>
              </div>

              <p
                style={{
                  fontSize: '13px',
                  color: '#64748b',
                  lineHeight: 1.6,
                  margin: '12px 0 16px 0',
                }}
              >
                {c.description}
              </p>
            </div>

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab(c.tabId)}
                aria-label={`Open ${c.title}`}
              >
                <span dangerouslySetInnerHTML={{ __html: c.actionText }} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
