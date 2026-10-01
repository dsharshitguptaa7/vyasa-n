import React from 'react';
import { Card, Badge, Button } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';

export const YajurVedaPlaceholder: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card
      variant="gold-accent"
      title="Yajur Veda: Research Administration & Incentives"
      subtitle="Ecosystem Governance Domain — Architectural Reservation"
      headerAction={<Badge variant="saffron">Planned Module</Badge>}
    >
      <div style={{ padding: '12px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 16px', fontSize: '14px' }}>
          Yajur Veda automates research grants administration, institutional funding clearances, incentive disbursement,
          and ethics committee reviews. Full business processes and schemas are scheduled for future development.
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
