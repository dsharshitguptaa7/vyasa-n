import React from 'react';
import { PageContainer } from '@vyasa/ui';
import { RigVedaPlaceholder } from '../components/RigVedaPlaceholder';

export const RigVedaDashboardPage: React.FC = () => {
  return (
    <PageContainer style={{ padding: '60px 0' }}>
      <RigVedaPlaceholder />
    </PageContainer>
  );
};
