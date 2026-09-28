import React from 'react';
import { InstitutionalFooter } from '@vyasa/ui/branding';

interface FooterProps {
  onSelectTab?: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return <InstitutionalFooter onSelectTab={onSelectTab} />;
};
