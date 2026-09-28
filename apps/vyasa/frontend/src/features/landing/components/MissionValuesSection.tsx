import React from 'react';
import { Card, SectionHeading, Badge } from '@vyasa/ui';

export const MissionValuesSection: React.FC = () => {
  return (
    <section id="values" style={{ margin: '64px 0' }}>
      <SectionHeading
        align="center"
        eyebrow="Institutional Mission"
        title="The Four Cornerstones of VYASA"
        description="VYASA is built around four fundamental pillars that combine university tradition with contemporary artificial intelligence."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '24px',
        }}
      >
        <Card
          variant="scholarly"
          title="Academic Knowledge"
          subtitle="Scholarly Repository &amp; Inquiry"
          headerAction={<Badge variant="primary">Foundational</Badge>}
        >
          <p style={{ color: 'var(--vyasa-text-secondary, #4b5565)', fontSize: '14px', lineHeight: 1.6 }}>
            Curating and preserving structured university learning assets, academic curricula, and
            scholarly repositories into a cohesive, accessible institutional knowledge base.
          </p>
        </Card>

        <Card
          variant="gold-accent"
          title="Scholarly Research"
          subtitle="Advancement of Scientific Inquiry"
          headerAction={<Badge variant="gold">Research</Badge>}
        >
          <p style={{ color: 'var(--vyasa-text-secondary, #4b5565)', fontSize: '14px', lineHeight: 1.6 }}>
            Facilitating doctoral milestones, faculty research programs, interdisciplinary research
            grants, and high-impact publications with structured academic tracking.
          </p>
        </Card>

        <Card
          variant="scholarly"
          title="Institutional Governance"
          subtitle="Accountability &amp; Integrity"
          headerAction={<Badge variant="primary">Governance</Badge>}
        >
          <p style={{ color: 'var(--vyasa-text-secondary, #4b5565)', fontSize: '14px', lineHeight: 1.6 }}>
            Enforcing multi-tiered role-based authority, policy compliance, and transparent university
            workflows to ensure administrative integrity and institutional trust.
          </p>
        </Card>

        <Card
          variant="default"
          title="AI-Assisted Intelligence"
          subtitle="Cognitive Workflow Augmentation"
          headerAction={<Badge variant="teal">AI Co-pilot</Badge>}
        >
          <p style={{ color: 'var(--vyasa-text-secondary, #4b5565)', fontSize: '14px', lineHeight: 1.6 }}>
            Empowering scholars and administrators with contextual AI assistants that synthesize
            voluminous documentation, accelerate review pipelines, and assist decision-making.
          </p>
        </Card>
      </div>
    </section>
  );
};
