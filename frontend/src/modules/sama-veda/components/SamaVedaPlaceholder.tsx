import React from 'react';
import { Card, Badge, Button } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';

export const SamaVedaPlaceholder: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card
      variant="scholarly"
      title="Sama Veda: Research Recognition & Communication"
      subtitle="Ecosystem Governance Domain — Architectural Reservation"
      headerAction={<Badge variant="saffron">Planned Module</Badge>}
    >
      <div style={{ padding: '12px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 16px', fontSize: '14px' }}>
          Sama Veda powers university research metrics, faculty citations, scholar recognition, symposium management,
          and public research dissemination for CSJMU. Business domain models will be introduced in subsequent phases.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            &larr; Return to Ecosystem Home
          </Button>
        </div>
      </div>
    </Card>
  );
};
