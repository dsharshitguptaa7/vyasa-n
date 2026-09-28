import React from 'react';
import { PageContainer } from '@vyasa/ui';
import { HeroSection } from './components/HeroSection';
import { EntryGatewaySection } from './components/EntryGatewaySection';
import { EcosystemPillarsSection } from './components/EcosystemPillarsSection';
import { MissionValuesSection } from './components/MissionValuesSection';
import { UniversityIdentitySection } from './components/UniversityIdentitySection';

interface LandingPageProps {
  onEnterEcosystem?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterEcosystem }) => {
  const handleExplorePillars = () => {
    const el = document.getElementById('pillars');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleEnterEcosystem = onEnterEcosystem || (() => {
    const el = document.getElementById('entry-gateways');
    el?.scrollIntoView({ behavior: 'smooth' });
  });

  return (
    <PageContainer>
      {/* 1. Public Hero Section */}
      <HeroSection
        onEnterEcosystem={handleEnterEcosystem}
        onExplorePillars={handleExplorePillars}
      />

      {/* 2. Unified Institutional Entry Gateway */}
      <EntryGatewaySection />

      {/* 3. Public Ecosystem Section (Modular Pillars) */}
      <EcosystemPillarsSection />

      {/* 3. VYASA Value & Mission Section */}
      <MissionValuesSection />

      {/* 4. University Identity Section (CSJMU Kanpur) */}
      <UniversityIdentitySection />
    </PageContainer>
  );
};
