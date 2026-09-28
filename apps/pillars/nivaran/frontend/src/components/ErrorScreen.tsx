import React from 'react';
import { Card, Badge, Button } from '@vyasa/ui';
import { CsjmuLogo } from '@vyasa/ui/branding';
import { AuthorityErrorState } from '../types/authority';

interface ErrorScreenProps {
  error: AuthorityErrorState;
  onRetry?: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, onRetry }) => {
  const getErrorContent = () => {
    switch (error.code) {
      case 'MISSING_TOKEN':
        return {
          title: 'Missing VYASA Session Token',
          subtitle: 'Institutional Authentication Required',
          badge: <Badge variant="neutral">Authentication Required</Badge>,
          lead: 'NIVARAN operates as an autonomous domain pillar and requires a cryptographically verified institutional identity issued by VYASA Core.',
          recommendation:
            'Please access NIVARAN by navigating to the VYASA Authority Console and clicking "Open NIVARAN".',
          vyasaUrl: 'http://localhost:5173/authority',
        };
      case 'INVALID_TOKEN':
        return {
          title: 'Session Expired or Invalid',
          subtitle: 'Cryptographic Token Verification Failed',
          badge: <Badge variant="saffron">HTTP 401 Unauthorized</Badge>,
          lead: 'The institutional token presented could not be validated by VYASA Core Identity Authority.',
          recommendation:
            'Your session may have expired or the token signature is invalid. Please sign in again to VYASA Core.',
          vyasaUrl: 'http://localhost:5173/login',
        };
      case 'VYASA_UNREACHABLE':
        return {
          title: 'VYASA Identity Authority Unreachable',
          subtitle: 'Decoupled Service Verification Unavailable',
          badge: <Badge variant="saffron">Service Unavailable</Badge>,
          lead: 'NIVARAN successfully reached its backend, but the backend was unable to communicate with VYASA Core (http://localhost:8000/api/auth/verify).',
          recommendation:
            'Please verify that VYASA Core backend is operational and accessible to NIVARAN.',
          vyasaUrl: 'http://localhost:5173',
        };
      case 'UNMAPPED_AUTHORITY':
        return {
          title: 'Unmapped Institutional Authority',
          subtitle: 'Domain Role Assignment Not Found',
          badge: <Badge variant="teal">HTTP 403 Forbidden</Badge>,
          lead: 'Your VYASA Core identity was verified, but no matching domain authority profile was found in nivaran_authorities.',
          recommendation:
            'NIVARAN maintains independent domain role assignments (Manager, Dean, Assistant Dean). Please contact the University Grievance Cell administrator.',
          vyasaUrl: 'http://localhost:5173/authority',
        };
      case 'FORBIDDEN_ROLE':
        return {
          title: 'Institutional Access Forbidden',
          subtitle: 'Authority Role Required',
          badge: <Badge variant="neutral">HTTP 403 Forbidden</Badge>,
          lead: 'Your VYASA account does not hold the generic institutional "authority" role.',
          recommendation:
            'Applicant accounts and unprivileged accounts are forbidden from accessing the NIVARAN Authority Redressal Console.',
          vyasaUrl: 'http://localhost:5173',
        };
      case 'NETWORK_ERROR':
      default:
        return {
          title: 'Gateway Communication Error',
          subtitle: 'NIVARAN Backend Offline',
          badge: <Badge variant="neutral">Network Error</Badge>,
          lead: 'Unable to connect to the NIVARAN backend gateway at http://localhost:8001.',
          recommendation:
            'Please verify that the NIVARAN backend service is running on port 8001.',
          vyasaUrl: 'http://localhost:5173/authority',
        };
    }
  };

  const content = getErrorContent();

  const handleReturnToVyasa = () => {
    window.location.href = content.vyasaUrl;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--vyasa-ivory, #FAF8F5)',
      }}
    >
      <div style={{ maxWidth: '640px', width: '100%' }}>
        {/* Header Emblem */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <CsjmuLogo size={64} />
          <h2
            style={{
              fontFamily: 'var(--vyasa-font-display, Georgia, serif)',
              color: 'var(--vyasa-navy, #1B2A4A)',
              fontSize: '22px',
              margin: '12px 0 4px',
            }}
          >
            Chhatrapati Shahu Ji Maharaj University
          </h2>
          <p style={{ color: 'var(--vyasa-text-muted, #64748B)', fontSize: '13px', margin: 0 }}>
            NIVARAN Grievance Redressal Pillar &bull; Security &amp; Identity Gateway
          </p>
        </div>

        <Card
          variant="scholarly"
          title={content.title}
          subtitle={content.subtitle}
          headerAction={content.badge}
        >
          <div style={{ padding: '8px 0', lineHeight: 1.6 }}>
            <p style={{ color: 'var(--vyasa-text, #1E293B)', fontSize: '15px', marginBottom: '14px' }}>
              {content.lead}
            </p>

            <div
              style={{
                backgroundColor: 'rgba(27, 42, 74, 0.04)',
                borderLeft: '4px solid var(--vyasa-navy, #1B2A4A)',
                borderRadius: '0 6px 6px 0',
                padding: '12px 16px',
                fontSize: '13px',
                color: 'var(--vyasa-text-secondary, #475569)',
                marginBottom: '18px',
              }}
            >
              <strong>Guidance:</strong> {content.recommendation}
            </div>

            {error.detail && (
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  color: 'var(--vyasa-text-muted, #64748B)',
                  wordBreak: 'break-all',
                  marginBottom: '20px',
                }}
              >
                Detail: {error.detail}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry Verification
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={handleReturnToVyasa}>
                Return to VYASA Console
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
