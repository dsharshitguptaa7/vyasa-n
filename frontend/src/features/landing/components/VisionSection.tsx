import React from 'react';
import { SectionHeading } from '@vyasa/ui';
import chancellorImg from '@assets/images/chancellor.jpeg';
import vcImg from '@assets/images/vc-sir-csjmu.jpg';
import deanImg from '@assets/images/dr-namita.jpg';

interface VisionLeader {
  role: string;
  name: string;
  designation: string;
  image: string;
  alt: string;
  description: string;
}

const VISION_LEADERS: VisionLeader[] = [
  {
    role: 'INSPIRATION',
    name: 'Smt. Anandiben Patel',
    designation: "Hon'ble Governor of Uttar Pradesh & Chancellor",
    image: chancellorImg,
    alt: 'Smt. Anandiben Patel, Hon’ble Governor of Uttar Pradesh and Chancellor of CSJMU',
    description:
      'Her call at AI Manthan 2.0 for the responsible use of Artificial Intelligence in education, research and governance inspires VYASA.',
  },
  {
    role: 'LEADERSHIP',
    name: 'Prof. Vinay Kumar Pathak',
    designation: "Hon'ble Vice Chancellor",
    image: vcImg,
    alt: 'Prof. Vinay Kumar Pathak, Hon’ble Vice Chancellor of CSJMU',
    description:
      'His leadership, directions and constant support turned the vision into a working ecosystem.',
  },
  {
    role: 'VISION',
    name: 'Prof. Namita Tiwari',
    designation: 'Dean, Research & Development',
    image: deanImg,
    alt: 'Prof. Namita Tiwari, Dean of Research & Development at CSJMU',
    description:
      'Conceived VYASA to make R&D processes smoother, more transparent, accountable and responsive.',
  },
];

export const VisionSection: React.FC = () => {
  return (
    <section id="vision" className="vyasa-story-section">
      <SectionHeading
        align="center"
        eyebrow="INSTITUTIONAL PURPOSE"
        title="The Vision Behind VYASAᴺ"
        description="Transforming the way Research & Development is supported, governed and experienced."
      />

      <div className="vyasa-story-divider" aria-hidden="true" />

      <div className="vyasa-vision-container">
        {/* Main Institutional Narrative */}
        <div className="vyasa-vision-narrative">
          <p className="vyasa-vision-inspiration">
            Named after the sage who organised the knowledge of an entire civilisation, VYASA brings
            the same spirit of order, clarity and purpose to research at Chhatrapati Shahu Ji
            Maharaj University, Kanpur.
          </p>
          <p className="vyasa-vision-description">
            VYASAᴺ is the unified digital ecosystem for research at Chhatrapati Shahu Ji Maharaj
            University, Kanpur. It brings research administration, institutional governance, scholar
            services and AI-assisted systems onto one platform.
          </p>
        </div>

        {/* Three-Card Dignitary Vision Layout */}
        <div className="vyasa-vision-grid" data-testid="vision-leaders-grid">
          {VISION_LEADERS.map((leader) => (
            <div key={leader.role} className="vyasa-vision-card">
              <div className="vyasa-vision-card__image-container">
                <img
                  src={leader.image}
                  alt={leader.alt}
                  className="vyasa-vision-card__photo"
                  loading="lazy"
                />
              </div>

              <div className="vyasa-vision-card__content">
                <div className="vyasa-vision-card__role">{leader.role}</div>
                <h3 className="vyasa-vision-card__name">{leader.name}</h3>
                <div className="vyasa-vision-card__designation">{leader.designation}</div>
                <p className="vyasa-vision-card__desc">{leader.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Tagline */}
        <div className="vyasa-vision-tagline" data-testid="vision-tagline">
          Less paperwork. More discovery.
        </div>
      </div>
    </section>
  );
};

export default VisionSection;

