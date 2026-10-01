import React, { useState } from 'react';
import { Card, Badge, Button } from '@vyasa/ui';
import { phase6dService } from '../services/phase6dService';
import { EFileResponse, EFileVerificationResponse } from '../types/phase6d';

interface ClosedCaseEFileCardProps {
  efile?: EFileResponse | null;
  grievanceId: string;
}

export const ClosedCaseEFileCard: React.FC<ClosedCaseEFileCardProps> = ({
  efile: initialEFile,
  grievanceId,
}) => {
  const [efile, setEfile] = useState<EFileResponse | null>(initialEFile || null);
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<EFileVerificationResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If initialEFile was not provided, fetch e-file by my efiles or id
  React.useEffect(() => {
    let isMounted = true;
    if (initialEFile) {
      setEfile(initialEFile);
      return;
    }

    async function fetchEFile() {
      try {
        setLoading(true);
        const myEFiles = await phase6dService.getMyEFiles();
        if (isMounted) {
          const match = myEFiles.find((ef) => ef.grievance_id === grievanceId);
          if (match) {
            setEfile(match);
          }
        }
      } catch {
        // Ignored
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchEFile();
    return () => {
      isMounted = false;
    };
  }, [initialEFile, grievanceId]);

  const handleVerify = async () => {
    if (!efile) return;
    try {
      setVerifying(true);
      setErrorMsg(null);
      const res = await phase6dService.verifyEFile(efile.id);
      setVerificationResult(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Cryptographic verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyHash = () => {
    if (!efile?.content_hash) return;
    navigator.clipboard.writeText(efile.content_hash);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (loading) {
    return (
      <Card variant="gold-accent" title="Official Sealed Institutional E-File" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          Locating cryptographic E-File archive...
        </div>
      </Card>
    );
  }

  if (!efile) {
    return (
      <Card variant="gold-accent" title="Official Sealed Institutional E-File" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          This grievance is officially closed. Digital E-File generation is archived in the Master Records.
        </div>
      </Card>
    );
  }

  const downloadUrl = phase6dService.getDownloadUrl(efile.id);

  return (
    <Card variant="gold-accent" title="Official Sealed Institutional E-File" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-navy, #0f2b48)' }}>
              {efile.e_file_number}
            </span>
            <Badge variant="teal">Digitally Sealed</Badge>
            <Badge variant="neutral">{efile.page_count} Pages</Badge>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
            Sealed on {efile.sealed_at ? new Date(efile.sealed_at).toLocaleString() : new Date(efile.created_at).toLocaleString()}
          </div>
        </div>

        {/* SHA-256 Hash Display */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            fontFamily: 'monospace',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>
              SHA-256 Tamper-Proof Cryptographic Hash
            </div>
            <div style={{ fontSize: '12px', color: '#0f172a', wordBreak: 'break-all' }}>
              {efile.content_hash || 'SHA256:NOT_AVAILABLE'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" onClick={handleCopyHash} style={{ fontSize: '12px', padding: '4px 10px' }}>
              {copySuccess ? 'Copied!' : 'Copy Hash'}
            </Button>
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={verifying}
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              {verifying ? 'Verifying...' : 'Verify Seal'}
            </Button>
          </div>
        </div>

        {/* Verification Result Banner */}
        {verificationResult && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: verificationResult.is_valid ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${verificationResult.is_valid ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: '6px',
              fontSize: '13px',
              color: verificationResult.is_valid ? '#166534' : '#991b1b',
            }}
          >
            {verificationResult.is_valid ? (
              <div>
                <strong>Cryptographic Integrity Verified:</strong> The generated PDF file matches the exact SHA-256 digest recorded in the institutional database ({verificationResult.algorithm}). Zero tampering detected.
              </div>
            ) : (
              <div>
                <strong>Warning:</strong> Cryptographic seal mismatch! Expected: <code>{verificationResult.stored_hash}</code>, Got: <code>{verificationResult.calculated_hash}</code>.
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              borderRadius: '6px',
              border: '1px solid #fecaca',
              fontSize: '13px',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* SMR linkage reference */}
        {efile.student_record_number && (
          <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
            Associated with Student Master Record:{' '}
            <strong>{efile.student_record_number}</strong>
          </div>
        )}

        {/* Download Action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Button variant="primary">
              Download Official E-File PDF &darr;
            </Button>
          </a>
        </div>
      </div>
    </Card>
  );
};
