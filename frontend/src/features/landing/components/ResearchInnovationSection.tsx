import React from 'react';
import { SectionHeading } from '@vyasa/ui';

export const ResearchInnovationSection: React.FC = () => {
  return (
    <section id="innovation" data-alias="research" className="vyasa-story-section">
      <SectionHeading
        align="center"
        eyebrow="Evolution &amp; Progress"
        title="One Step Toward Institutional Innovation"
        description="An evolving institutional technology initiative built with academic care and scientific rigor."
      />

      <div className="vyasa-story-divider" aria-hidden="true" />

      <div className="vyasa-innovation-box">
        <p className="vyasa-innovation-text">
          <strong>VYASAᴺ is not presented as a finished destination.</strong>
        </p>
        <p className="vyasa-innovation-text">
          It is an evolving institutional technology initiative&mdash;built incrementally through
          research, experimentation, development and continuous improvement.
        </p>
        <p className="vyasa-innovation-text" style={{ marginBottom: 0 }}>
          Each implemented component is a step toward a more connected Research &amp; Development
          ecosystem.
        </p>
      </div>
    </section>
  );
};

export default ResearchInnovationSection;
