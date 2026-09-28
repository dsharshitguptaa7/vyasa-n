import React from 'react';
import { CSJMU_INSTITUTION, VYASA_BRAND } from './types';
import { CsjmuLogo } from './CsjmuLogo';
import { VyasaLogo } from '../components/Brand/VyasaLogo';

export interface InstitutionalFooterBrandProps {
  className?: string;
}

export const InstitutionalFooterBrand: React.FC<InstitutionalFooterBrandProps> = ({
  className = '',
}) => {
  return (
    <div
      className={`csjmu-footer-brand ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        maxWidth: '520px',
      }}
    >
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <CsjmuLogo size={46} />
        <div
          style={{
            width: '1px',
            height: '36px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          }}
          aria-hidden="true"
        />
        <VyasaLogo size={42} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--vyasa-font-scholarly)',
              fontSize: '20px',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.06em',
            }}
          >
            {VYASA_BRAND.productName}
          </span>
          <span
            className="vyasa-devanagari"
            lang="hi"
            style={{
              fontSize: '13px',
              color: 'var(--vyasa-gold-border, #ecdfba)',
              fontWeight: 500,
            }}
          >
            {VYASA_BRAND.taglineHindi}
          </span>
        </div>

        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#ffffff',
            marginTop: '4px',
          }}
        >
          {CSJMU_INSTITUTION.nameEnglish}
        </span>

        <span
          className="vyasa-devanagari"
          lang="hi"
          style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.75)',
            marginTop: '2px',
          }}
        >
          {CSJMU_INSTITUTION.nameHindi}
        </span>

        <p
          style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.65)',
            margin: '8px 0 0 0',
            lineHeight: 1.5,
          }}
        >
          An institutional ecosystem established to advance academic knowledge, scholarly research,
          and transparent governance through AI-assisted workflows.
        </p>
      </div>
    </div>
  );
};
