import React from 'react';
import { Card, SectionHeading } from '@vyasa/ui';

export const ArchitecturePrinciples: React.FC = () => {
  return (
    <section id="principles" style={{ margin: '48px 0' }}>
      <SectionHeading
        eyebrow="Architectural Integrity"
        title="Decoupled Core Principles"
        description="The foundational rules governing VYASA Core and all integrating governance pillars."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        <Card variant="scholarly" title="1. Strict Core Isolation" subtitle="Zero Upstream Coupling">
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            VYASA Core is independent of all pillars. Adding, removing, or modifying an individual
            pillar never requires modifications to the core business logic.
          </p>
        </Card>

        <Card variant="gold-accent" title="2. Explicit Contracts" subtitle="Strongly Typed Interfaces">
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            Subsystems communicate exclusively via formal registry specifications and API schemas,
            eliminating hidden runtime dependencies.
          </p>
        </Card>

        <Card variant="saffron-accent" title="3. Indian Character" subtitle="Scholarly & Institutional">
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            Rooted in academic dignity and cultural identity with deep scholarly blue, refined saffron,
            and ivory aesthetics supporting full Devanagari fidelity.
          </p>
        </Card>

        <Card variant="default" title="4. AI Workflow Assistance" subtitle="Intelligent Acceleration">
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            AI integrates as an assistive layer across research synthesis, application evaluation,
            and governance without overriding institutional accountability.
          </p>
        </Card>
      </div>
    </section>
  );
};
