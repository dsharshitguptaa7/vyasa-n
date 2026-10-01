import React from 'react';
import { Navigate } from 'react-router-dom';
import { PageContainer, LoadingState } from '@vyasa/ui';
import { useAuth } from '../../../../context/AuthContext';
import { getNivaranDestination } from '../../../../utils';

export const NivaranWorkspacePage: React.FC = () => {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <PageContainer style={{ padding: '60px 0', textAlign: 'center' }}>
        <LoadingState message="Connecting to NIVARAN-AI workspace..." />
      </PageContainer>
    );
  }

  const destination = getNivaranDestination(auth);
  return <Navigate to={destination} replace />;
};
