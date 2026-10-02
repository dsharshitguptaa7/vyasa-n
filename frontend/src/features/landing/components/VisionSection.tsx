import React from 'react';
import { SectionHeading } from '@vyasa/ui';
import { CSJMU_INSTITUTION } from '@vyasa/ui/branding';

export const VisionSection: React.FC = () => {
  return (
    <section id="vision" className="vyasa-story-section">
      <SectionHeading
        align="center"
        eyebrow="Institutional Purpose"
        title="The Vision Behind VYASA"
        description="Transforming the way Research & Development is supported, governed and experienced."
      />

      <div className="vyasa-story-divider" aria-hidden="true" />

      <div className="vyasa-vision-container">
        {/* Main Institutional Narrative */}
        <div className="vyasa-vision-narrative">
          <p>
            <strong>VYASA</strong> is a vision for transforming the way Research &amp; Development is
            supported, governed and experienced at {CSJMU_INSTITUTION.nameEnglish}.
          </p>
          <p>
            The ecosystem brings research administration, institutional governance, scholar services
            and AI-assisted systems into a unified digital framework.
          </p>
          <p>
            Conceived under the vision of <strong>Prof. Namita Tiwari</strong>, Dean, Research &amp;
            Development, the initiative represents a step toward making institutional R&amp;D processes
            smoother, more transparent, accountable and responsive.
          </p>
        </div>
      </div>
    </section>
  );
};

export default VisionSection;
