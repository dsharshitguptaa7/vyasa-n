import React from 'react';
import { PageContainer } from '@vyasa/ui';
import { SamaVedaPlaceholder } from '../components/SamaVedaPlaceholder';

export const SamaVedaDashboardPage: React.FC = () => {
  return (
    <PageContainer style={{ padding: '60px 0' }}>
      <SamaVedaPlaceholder />
    </PageContainer>
  );
};
