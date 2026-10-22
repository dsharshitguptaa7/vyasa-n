import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, AppIcon, SectionHeading, Modal } from '@vyasa/ui';
import { VyasaPortalLayout } from './components/VyasaPortalLayout';
import { VyasaProfileDossier } from './components/VyasaProfileDossier';
import './Dashboard.css';

export const VyasaProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  return (
    <VyasaPortalLayout
      activeItem="profile"
      onSelectProfile={() => {}}
      onSelectHelp={() => setIsHelpModalOpen(true)}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Navigation & Breadcrumb Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              data-testid="profile-back-to-dashboard-btn"
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--vyasa-primary, #0f2b48)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <AppIcon name="arrow-left" size={14} color="var(--vyasa-primary, #0f2b48)" />
              <span>Back to Dashboard</span>
            </button>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>/</span>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              Institutional Profile
            </span>
          </div>
        </div>

        {/* Section Heading */}
        <div style={{ marginBottom: '24px' }}>
          <SectionHeading
            eyebrow="Official Academic Dossier"
            title="My Institutional Profile &amp; Verified Records"
            description="Verified credentials, enrollment data, and institutional jurisdiction records issued by Chhatrapati Shahu Ji Maharaj University, Kanpur."
          />
        </div>

        {/* Full Profile Dossier Cards */}
        <VyasaProfileDossier />
      </div>

      {/* Guidelines / Help Modal */}
      {isHelpModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsHelpModalOpen(false)}
          title="Institutional User Records &amp; Verification"
          footer={
            <Button variant="primary" size="sm" onClick={() => setIsHelpModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#334155' }}>
            <div>
              <strong style={{ color: '#0f2b48' }}>Identity &amp; Profile Verification</strong>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                Your institutional records are securely synchronized with the CSJMU Central Database.
                For discrepancies in departmental assignments or scholar enrollment IDs, contact the Registrar or Research Section.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </VyasaPortalLayout>
  );
};
