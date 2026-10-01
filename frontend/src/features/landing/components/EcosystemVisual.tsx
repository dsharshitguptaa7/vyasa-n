import React from 'react';
import { Card, Badge, SectionHeading } from '@vyasa/ui';

export const EcosystemVisual: React.FC = () => {
  return (
    <section className="vyasa-ecosystem-visual" id="ecosystem-architecture">
      <SectionHeading
        align="center"
        eyebrow="Ecosystem Blueprint"
        title="Unified Architecture &amp; Modular Pillars"
        description="VYASA connects academic knowledge, institutional governance, and artificial intelligence into a decoupled core architecture."
      />

      <div className="vyasa-ecosystem-grid">
        <Card
          variant="scholarly"
          title="Academic Knowledge &amp; Research"
          subtitle="Scholarly Rigor &amp; Inquiry"
          headerAction={<Badge variant="primary">Foundational</Badge>}
        >
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            Structured knowledge models and research methodologies that form the intellectual
            backbone of the ecosystem, supporting rigorous academic workflows.
          </p>
        </Card>

        <Card
          variant="gold-accent"
          title="Institutional Governance"
          subtitle="Policy, Trust &amp; Integrity"
          headerAction={<Badge variant="gold">Governance</Badge>}
        >
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            Centralized role-based authority, policy enforcement, and auditability that ensure
            transparency and accountability across public and institutional operations.
          </p>
        </Card>

        <Card
          variant="default"
          title="AI-Assisted Intelligence"
          subtitle="Augmented Analysis &amp; Workflows"
          headerAction={<Badge variant="teal">AI Co-pilot</Badge>}
        >
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            Contextual assistance and computational models that expedite evaluation, synthesize
            scholarly material, and guide institutional decision-making.
          </p>
        </Card>
      </div>

      <div className="vyasa-ecosystem-pillar-track">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-primary)' }}>
            Future Modular Digital Pillars
          </span>
          <Badge variant="saffron" size="sm">Interface-Bound</Badge>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', maxWidth: '640px', margin: '0 auto' }}>
          Pillars attach to VYASA Core strictly via defined registry contracts. Subsystems operate
          independently without modifying or destabilizing the core platform.
        </p>

        <div className="vyasa-ecosystem-pillar-track__tags">
          <Badge variant="neutral">Pillar 1 (Pending Registry)</Badge>
          <Badge variant="neutral">Pillar 2 (Pending Registry)</Badge>
          <Badge variant="neutral">Pillar 3 (Pending Registry)</Badge>
          <Badge variant="saffron">NIVARAN (Future Integration)</Badge>
        </div>
      </div>
    </section>
  );
};
