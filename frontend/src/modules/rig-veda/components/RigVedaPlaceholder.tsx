import React from 'react';
import { Card, Badge, Button } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';

export const RigVedaPlaceholder: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card
      variant="scholarly"
      title="Rig Veda: Research & Knowledge Creation"
      subtitle="Ecosystem Governance Domain — Architectural Reservation"
      headerAction={<Badge variant="saffron">Planned Module</Badge>}
    >
      <div style={{ padding: '12px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 16px', fontSize: '14px' }}>
          Rig Veda governs foundational research discovery, doctoral thesis progression, synopsis reviews,
          and knowledge archiving across CSJMU faculties. Business logic, data models, and workflow interfaces
          are scheduled for future phased implementation.
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
