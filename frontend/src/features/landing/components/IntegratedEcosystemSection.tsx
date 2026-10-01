import React from 'react';
import { SectionHeading } from '@vyasa/ui';

export const IntegratedEcosystemSection: React.FC = () => {
  const cards = [
    {
      title: 'RESEARCH',
      desc: 'Supporting a connected research environment.',
    },
    {
      title: 'GOVERNANCE',
      desc: 'Bringing institutional processes into a structured digital framework.',
    },
    {
      title: 'TRANSPARENCY',
      desc: 'Making workflows and institutional actions more traceable.',
    },
    {
      title: 'INTELLIGENCE',
      desc: 'Introducing AI-assisted decision support where it can meaningfully improve institutional processes.',
    },
  ];

  return (
    <section id="why-vyasa" className="vyasa-story-section">
      <SectionHeading
        align="center"
        eyebrow="Institutional Imperative"
        title="From Fragmented Processes to an Integrated Ecosystem"
        description="A structured foundation connecting scholars, authorities, and administrative oversight."
      />

      <div className="vyasa-story-divider" aria-hidden="true" />

      <div className="vyasa-pillars-grid">
        {cards.map((card) => (
          <div key={card.title} className="vyasa-pillar-item">
            <h3 className="vyasa-pillar-title">{card.title}</h3>
            <p className="vyasa-pillar-desc">{card.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default IntegratedEcosystemSection;
