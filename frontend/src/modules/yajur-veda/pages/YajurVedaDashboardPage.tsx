import React from 'react';
import { PageContainer } from '@vyasa/ui';
import { YajurVedaPlaceholder } from '../components/YajurVedaPlaceholder';

export const YajurVedaDashboardPage: React.FC = () => {
  return (
    <PageContainer style={{ padding: '60px 0' }}>
      <YajurVedaPlaceholder />
    </PageContainer>
  );
};
