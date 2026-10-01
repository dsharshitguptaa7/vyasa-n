import React from 'react';
import { PageContainer } from '@vyasa/ui';
import { HeroSection } from './components/HeroSection';
import { VisionSection } from './components/VisionSection';
import { FourDomainsSection } from './components/FourDomainsSection';
import { NivaranOperationalSection } from './components/NivaranOperationalSection';
import { IntegratedEcosystemSection } from './components/IntegratedEcosystemSection';
import { BuiltAtCsjmuSection } from './components/BuiltAtCsjmuSection';
import { ResearchInnovationSection } from './components/ResearchInnovationSection';
import { EntryGatewaySection } from './components/EntryGatewaySection';
import { FinalVisionSection } from './components/FinalVisionSection';
import './LandingPage.css';

interface LandingPageProps {
  onEnterEcosystem?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterEcosystem }) => {
  const handleScrollToVision = () => {
    document.getElementById('vision')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleEnterEcosystem = onEnterEcosystem || (() => {
    document.getElementById('entry-gateways')?.scrollIntoView({ behavior: 'smooth' });
  });

  return (
    <PageContainer>
      {/* 1. Strong Editorial Hero Section */}
      <HeroSection
        onEnterEcosystem={handleEnterEcosystem}
        onExploreVision={handleScrollToVision}
      />

      {/* 2. The Vision Behind VYASA & Development Credit */}
      <VisionSection />

      {/* 3. The Four Domains of VYASA (Vedic Knowledge Architecture) */}
      <FourDomainsSection />

      {/* 4. NIVARAN-AI: The First Operational Domain (Atharva Veda) */}
      <NivaranOperationalSection />

      {/* 5. Why VYASA: From Fragmented Processes to an Integrated Ecosystem */}
      <IntegratedEcosystemSection />

      {/* 6. Built at CSJMU: Provenance & Institutional Context */}
      <BuiltAtCsjmuSection />

      {/* 7. Research Innovation: Evolving Technology Initiative */}
      <ResearchInnovationSection />

      {/* 8. Institutional Access Gateways (Scholar & Authority Access) */}
      <EntryGatewaySection />

      {/* 9. Final Vision Closing Banner */}
      <FinalVisionSection onEnterEcosystem={handleEnterEcosystem} />
    </PageContainer>
  );
};

export default LandingPage;
