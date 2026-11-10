import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppIcon, Button, Badge } from '@vyasa/ui';
import { PublicShell } from '../../../components/layout';
import { samaVedaService, CertificateVerificationResult } from '../services/samaVedaService';

export const PublicCertificateVerificationPage: React.FC = () => {
  const { token, certificateNumber } = useParams<{ token?: string; certificateNumber?: string }>();
  const navigate = useNavigate();

  const queryToken = token || certificateNumber || '';
  const [result, setResult] = useState<CertificateVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);

  useEffect(() => {
    if (!queryToken) {
      setError('No certificate identification token provided.');
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await samaVedaService.verifyCertificate(queryToken);
        setResult(data);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
        setError(
          e.response?.data?.message ||
            e.response?.data?.detail ||
            'Unable to verify certificate authenticity. Please ensure the verification URL or QR code is correct.'
        );
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [queryToken]);

  const handleDownload = async () => {
    if (!result) return;
    try {
      setDownloading(true);
      await samaVedaService.downloadCertificate(
        result.certificate_number,
        `${result.certificate_number.replace(/[\/\\]/g, '_')}.pdf`
      );
    } catch (err: unknown) {
      const e = err as { message?: string };
      alert(e.message || 'Failed to download certificate.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopySha = () => {
    if (!result?.sha256_checksum) return;
    navigator.clipboard.writeText(result.sha256_checksum);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 3000);
  };

  const isRevoked = result?.is_revoked || result?.status === 'REVOKED';
  const isSuperseded = result?.status === 'SUPERSEDED';

  return (
    <PublicShell currentTab="samiksha" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/applicant/login')}>
      <div style={{ maxWidth: '880px', margin: '40px auto', padding: '0 20px' }}>
        {/* Verification Status Card */}
        <div
          style={{
            background: '#FFFFFF',
            border: isRevoked
              ? '2px solid #DC2626'
              : isSuperseded
              ? '2px solid #8B5CF6'
              : '2px solid #B2811A',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Header Banner */}
          <div
            style={{
              background: isRevoked
                ? '#991B1B'
                : isSuperseded
                ? '#6D28D9'
                : 'linear-gradient(135deg, #0F2B48 0%, #1E3A8A 60%, #6B1D2F 100%)',
              color: '#FFFFFF',
              padding: '24px 30px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D4AF37' }}>
              CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 4px 0' }}>
              Official Digital Certificate Verification Portal
            </h1>
            <p style={{ fontSize: '13px', color: '#E2E8F0', margin: 0 }}>
              SAMIKSHA • Research & Innovation Felicitation Ledger
            </p>
          </div>

          <div style={{ padding: '32px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748B' }}>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>Verifying cryptographic signature...</div>
                <div style={{ fontSize: '13px', marginTop: '6px' }}>Validating certificate hash with university ledger</div>
              </div>
            ) : error || !result ? (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ color: '#DC2626', marginBottom: '12px' }}>
                  <AppIcon name="close" size={48} color="#DC2626" />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#991B1B', margin: '0 0 8px 0' }}>
                  Certificate Verification Failed
                </h2>
                <p style={{ color: '#64748B', maxWidth: '540px', margin: '0 auto 20px auto', fontSize: '14px' }}>
                  {error || 'The requested certificate could not be located in the official SAMIKSHA ledger.'}
                </p>
                <Button variant="outline" onClick={() => navigate('/modules/sama-veda')}>
                  Return to SAMIKSHA
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Official Stamp Banner */}
                <div
                  style={{
                    background: isRevoked
                      ? '#FEF2F2'
                      : isSuperseded
                      ? '#F5F3FF'
                      : '#F0FDF4',
                    border: isRevoked
                      ? '1px solid #FECACA'
                      : isSuperseded
                      ? '1px solid #DDD6FE'
                      : '1px solid #BBF7D0',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: isRevoked ? '#DC2626' : isSuperseded ? '#8B5CF6' : '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFF',
                      }}
                    >
                      <AppIcon name={isRevoked ? 'close' : 'check'} size={26} color="#FFFFFF" />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '17px',
                          fontWeight: 700,
                          color: isRevoked ? '#991B1B' : isSuperseded ? '#6D28D9' : '#166534',
                        }}
                      >
                        {isRevoked
                          ? 'CERTIFICATE REVOKED'
                          : isSuperseded
                          ? 'CERTIFICATE SUPERSEDED'
                          : 'AUTHENTIC & VALID UNIVERSITY CERTIFICATE'}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
                        Certificate Number: <strong>{result.certificate_number}</strong>
                      </div>
                    </div>
                  </div>

                  {result.is_download_allowed && (
                    <Button
                      variant="primary"
                      onClick={handleDownload}
                      disabled={downloading}
                      style={{ backgroundColor: '#B2811A', borderColor: '#B2811A' }}
                    >
                      <span style={{ marginRight: '6px' }}>&darr;</span>
                      {downloading ? 'Downloading...' : 'Download Official PDF'}
                    </Button>
                  )}
                </div>

                {/* Revocation Warning Box */}
                {isRevoked && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '16px', color: '#991B1B' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                      Permanent Invalidation Audit Notice
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      This certificate was officially revoked on{' '}
                      <strong>{result.revoked_at ? new Date(result.revoked_at).toLocaleDateString() : 'N/A'}</strong>.
                    </div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>
                      <strong>Official Justification:</strong> {result.revocation_reason || 'Administrative action'}
                    </div>
                  </div>
                )}

                {/* Certificate Core Details */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#B2811A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Certificate Title
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F2B48', marginTop: '4px' }}>
                      {result.title || 'Certificate of Appreciation & Research Excellence'}
                    </div>
                  </div>

                  {result.research_title && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        Research Paper / Publication Contribution
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginTop: '4px', fontStyle: 'italic' }}>
                        "{result.research_title}"
                      </div>
                    </div>
                  )}

                  {/* Multi-Author Grid */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Meritorious Recipient Scholars ({result.authors?.length || 1})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                      {result.authors && result.authors.length > 0 ? (
                        result.authors.map((auth, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              padding: '12px 16px',
                            }}
                          >
                            <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F2B48' }}>
                              {auth.academic_title ? `${auth.academic_title} ` : ''}{auth.author_name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                              {auth.department || 'Chhatrapati Shahu Ji Maharaj University, Kanpur'}
                            </div>
                            {auth.scopus_id && (
                              <div style={{ marginTop: '6px' }}>
                                <Badge variant="gold">Scopus ID: {auth.scopus_id}</Badge>
                              </div>
                            )}
                          </div>
                        ))
                      ) : result.author ? (
                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 16px' }}>
                          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F2B48' }}>
                            {result.author.full_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                            {result.author.department || 'Chhatrapati Shahu Ji Maharaj University, Kanpur'}
                          </div>
                          {result.author.scopus_id && (
                            <div style={{ marginTop: '6px' }}>
                              <Badge variant="gold">Scopus ID: {result.author.scopus_id}</Badge>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Dual Signing Authorities */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Authorized Institutional Signatures
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                          Authority 1: Verified & Sealed
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2B48', marginTop: '4px' }}>
                          Prof. (Dr.) Rajesh Kumar
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>
                          Dean – Research & Development
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                          CSJM University, Kanpur
                        </div>
                      </div>

                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                          Authority 2: Verified & Sealed
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2B48', marginTop: '4px' }}>
                          Prof. Vinay Kumar Pathak
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>
                          Vice Chancellor
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                          CSJM University, Kanpur
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic SHA-256 Checksum */}
                  <div style={{ background: '#F1F5F9', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        Tamper-Evident Document SHA-256 Checksum:
                      </div>
                      <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0F2B48', wordBreak: 'break-all', marginTop: '2px' }}>
                        {result.sha256_checksum}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopySha}>
                      {copiedSha ? 'Copied' : 'Copy Hash'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
};

export default PublicCertificateVerificationPage;
