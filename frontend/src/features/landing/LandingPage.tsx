import React from 'react';
import { PageContainer } from '@vyasa/ui';
import { HeroSection } from './components/HeroSection';
import { VisionSection } from './components/VisionSection';
import { SignaturePillarsSection } from './components/SignaturePillarsSection';
import { FourDomainsSection } from './components/FourDomainsSection';
import { SamikshaHighlightSection } from './components/SamikshaHighlightSection';
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
    document.getElementById('operational-pillars')?.scrollIntoView({ behavior: 'smooth' });
  });

  return (
    <PageContainer>
      {/* 1. VYASAⁿ MAIN BRANDING & HERO */}
      <HeroSection
        onEnterEcosystem={handleEnterEcosystem}
        onExploreVision={handleScrollToVision}
      />

      {/* 2. THE VISION BEHIND VYASAⁿ (Institutional Purpose & Leadership) */}
      <VisionSection />

      {/* 3. TWO OPERATIONAL PILLARS (SAMIKSHA & NIVARAN) */}
      <SignaturePillarsSection />

      {/* 4. THE FOUR DOMAINS OF VYASAⁿ (Institutional Architecture) */}
      <FourDomainsSection />

      {/* 5. SAMIKSHA (Detailed Branding & Research Services) */}
      <SamikshaHighlightSection />

      {/* 6. NIVARAN (Detailed Branding & Grievance Flow) */}
      <NivaranOperationalSection />

      {/* 7. From Fragmented Processes to an Integrated Ecosystem */}
      <IntegratedEcosystemSection />

      {/* 8. Designed, Developed & Evolved at CSJMU Kanpur */}
      <BuiltAtCsjmuSection />

      {/* 9. One Step Toward Institutional Innovation */}
      <ResearchInnovationSection />

      {/* 10. Institutional Access Gateways (Scholar & Authority Access) */}
      <EntryGatewaySection />

      {/* 11. The Vision Continues */}
      <FinalVisionSection onEnterEcosystem={handleEnterEcosystem} />
    </PageContainer>
  );
};

export default LandingPage;
