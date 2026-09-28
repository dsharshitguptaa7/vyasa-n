import React, { useEffect, useState } from 'react';
import { pillarService } from '../../../services';
import { PillarMetadata } from '../../../types';
import { Card, Badge, SectionHeading } from '@vyasa/ui';

interface ConceptualPillarItem {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  badgeLabel: string;
  badgeVariant: 'primary' | 'saffron' | 'gold' | 'teal' | 'neutral';
  status: 'active' | 'scheduled' | 'development';
}

const DEFAULT_ECOSYSTEM_PILLARS: ConceptualPillarItem[] = [
  {
    id: 'pillar-1',
    name: 'Pillar 1',
    subtitle: 'Modular Ecosystem Subsystem',
    description:
      'Foundational academic subsystem designed to interface with core governance services through standardized institutional contracts.',
    badgeLabel: 'Scheduled',
    badgeVariant: 'gold',
    status: 'scheduled',
  },
  {
    id: 'pillar-2',
    name: 'Pillar 2',
    subtitle: 'Modular Ecosystem Subsystem',
    description:
      'Dedicated research and scholarship subsystem establishing independent workflows with ecosystem-wide single sign-on and verification.',
    badgeLabel: 'Scheduled',
    badgeVariant: 'gold',
    status: 'scheduled',
  },
  {
    id: 'pillar-3',
    name: 'Pillar 3',
    subtitle: 'Modular Ecosystem Subsystem',
    description:
      'Institutional operations and evaluation subsystem integrating with central policy repositories and administrative registries.',
    badgeLabel: 'Scheduled',
    badgeVariant: 'gold',
    status: 'scheduled',
  },
  {
    id: 'nivaran',
    name: 'NIVARAN',
    subtitle: 'AI-Assisted Grievance Redressal',
    description:
      'Intelligent university grievance redressal and resolution platform, featuring AI-assisted ticket triage, transparent escalations, and automated tracking.',
    badgeLabel: 'In Development',
    badgeVariant: 'saffron',
    status: 'development',
  },
];

export const EcosystemPillarsSection: React.FC = () => {
  const [registeredPillars, setRegisteredPillars] = useState<PillarMetadata[]>([]);

  useEffect(() => {
    let isMounted = true;

    pillarService
      .getPillars()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setRegisteredPillars(data);
        }
      })
      .catch(() => {
        // Silent graceful fallback to conceptual framework on network absence
        if (isMounted) {
          setRegisteredPillars([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Merge registered pillars with the conceptual ecosystem structure
  const displayItems = DEFAULT_ECOSYSTEM_PILLARS.map((defaultItem) => {
    const liveMatch = registeredPillars.find(
      (p) => p.slug === defaultItem.id || p.id === defaultItem.id
    );

    if (liveMatch) {
      return {
        id: liveMatch.id,
        name: liveMatch.name,
        subtitle: liveMatch.slug.toUpperCase(),
        description: liveMatch.description,
        badgeLabel: liveMatch.enabled ? 'Active Subsystem' : 'Maintenance',
        badgeVariant: (liveMatch.enabled ? 'teal' : 'neutral') as ConceptualPillarItem['badgeVariant'],
        status: (liveMatch.enabled ? 'active' : 'scheduled') as ConceptualPillarItem['status'],
      };
    }

    return defaultItem;
  });

  // Append any newly registered pillars that are not part of the initial four
  const additionalRegistered = registeredPillars
    .filter((p) => !DEFAULT_ECOSYSTEM_PILLARS.some((d) => d.id === p.id || d.id === p.slug))
    .map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: p.slug.toUpperCase(),
      description: p.description,
      badgeLabel: p.enabled ? 'Active Subsystem' : 'Maintenance',
      badgeVariant: (p.enabled ? 'teal' : 'neutral') as ConceptualPillarItem['badgeVariant'],
      status: (p.enabled ? 'active' : 'scheduled') as ConceptualPillarItem['status'],
    }));

  const allPillars = [...displayItems, ...additionalRegistered];

  return (
    <section id="pillars" style={{ margin: '64px 0' }}>
      <SectionHeading
        align="center"
        eyebrow="Ecosystem Architecture"
        title="Modular University Pillars"
        description="VYASA operates as an extensible governance backbone. Dedicated functional pillars integrate through decoupled contracts, ensuring university operations remain scalable and resilient."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '24px',
        }}
      >
        {allPillars.map((item) => (
          <Card
            key={item.id}
            variant={item.id === 'nivaran' ? 'saffron-accent' : 'scholarly'}
            title={item.name}
            subtitle={item.subtitle}
            headerAction={<Badge variant={item.badgeVariant}>{item.badgeLabel}</Badge>}
          >
            <p
              style={{
                color: 'var(--vyasa-text-secondary, #4b5565)',
                fontSize: '14px',
                lineHeight: 1.6,
                marginBottom: '16px',
                minHeight: '70px',
              }}
            >
              {item.description}
            </p>

            <div
              style={{
                paddingTop: '12px',
                borderTop: '1px solid var(--vyasa-border-subtle, #ede7de)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--vyasa-text-muted, #6b7280)',
              }}
            >
              <span>Modular Unit</span>
              <span style={{ fontWeight: 600, color: 'var(--vyasa-primary, #0f2b48)' }}>
                CSJMU Ecosystem
              </span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};
