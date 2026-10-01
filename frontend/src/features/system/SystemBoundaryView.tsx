import React from 'react';
import { PageContainer, Card, Badge, SectionHeading, Button } from '@vyasa/ui';
import { SystemStatusCard } from '../landing/components/SystemStatusCard';

interface SystemBoundaryViewProps {
  onReturnHome: () => void;
}

/**
 * Conceptual boundary for internal system administration, architecture docs, and live diagnostics.
 * Isolated from the public university landing page.
 */
export const SystemBoundaryView: React.FC<SystemBoundaryViewProps> = ({ onReturnHome }) => {
  return (
    <PageContainer style={{ padding: '48px 0' }}>
      <div style={{ marginBottom: '24px' }}>
        <Button variant="outline" size="sm" onClick={onReturnHome}>
          &larr; Return to Public Ecosystem Overview
        </Button>
      </div>

      <SectionHeading
        eyebrow="Internal &amp; Admin Domain (/system)"
        title="Ecosystem Telemetry &amp; Diagnostics"
        description="Technical architecture monitoring, Core health endpoints, and pillar registry diagnostics."
      />

      <div style={{ maxWidth: '840px', margin: '0 auto 36px' }}>
        <SystemStatusCard />
      </div>

      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        <Card
          variant="scholarly"
          title="Architecture &amp; Subsystem Contracts (/docs)"
          subtitle="Developer &amp; Integration Specification"
          headerAction={<Badge variant="gold">Specification</Badge>}
        >
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
            External functional pillars (such as Pillar 1, Pillar 2, Pillar 3, and NIVARAN) attach
            to VYASA Core using decoupled registry interfaces. Core business logic remains strictly
            isolated from pillar-specific schemas.
          </p>
          <div style={{ fontSize: '12px', color: 'var(--vyasa-text-muted)' }}>
            Designated for internal authority administrators and ecosystem developers.
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};
