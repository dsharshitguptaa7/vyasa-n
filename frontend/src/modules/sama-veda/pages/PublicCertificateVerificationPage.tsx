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
  const [downloadError, setDownloadError] = useState<string | null>(null);
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
      setDownloadError(null);
      // Use verification_token or certificate_number
      const tokenOrNumber = result.verification_token || result.certificate_number;
      await samaVedaService.downloadCertificate(
        tokenOrNumber,
        `${result.certificate_number.replace(/[\/\\]/g, '_')}.pdf`
      );
    } catch (err: unknown) {
      const e = err as { message?: string };
      setDownloadError(e.message || 'Download temporarily unavailable. Please try again.');
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

                  {result.is_download_allowed ? (
                    <Button
                      variant="primary"
                      onClick={handleDownload}
                      disabled={downloading}
                      style={{
                        backgroundColor: '#B2811A',
                        borderColor: '#B2811A',
                        fontWeight: 600,
                        padding: '10px 20px',
                        boxShadow: '0 2px 8px rgba(178, 129, 26, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <AppIcon name="file-text" size={16} color="#FFFFFF" />
                      <span>{downloading ? 'Downloading...' : 'Download Certificate PDF'}</span>
                    </Button>
                  ) : isSuperseded && result.replacement_certificate ? (
                    <Button
                      variant="primary"
                      onClick={() => navigate(result.replacement_certificate!.verification_url)}
                      style={{
                        backgroundColor: '#6D28D9',
                        borderColor: '#6D28D9',
                        fontWeight: 600,
                        padding: '10px 18px',
                        boxShadow: '0 2px 8px rgba(109, 40, 217, 0.25)',
                      }}
                    >
                      <span>Verify Replacement Certificate &rarr;</span>
                    </Button>
                  ) : null}
                </div>

                {/* Inline Download Error Banner */}
                {downloadError && (
                  <div
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      color: '#991B1B',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>⚠️</span>
                    <span>{downloadError}</span>
                  </div>
                )}

                {/* Revocation Warning Box */}
                {isRevoked && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '18px 20px', color: '#991B1B' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🚫</span>
                      <span>Official Certificate Invalidation Notice</span>
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                      This certificate has been officially <strong>REVOKED</strong> by Chhatrapati Shahu Ji Maharaj University, Kanpur.
                      It is no longer authentic, valid, or recognized for academic or professional credentials.
                    </div>
                    <div style={{ fontSize: '13px', marginTop: '6px' }}>
                      <strong>Revocation Date:</strong> {result.revoked_at ? new Date(result.revoked_at).toLocaleDateString() : 'N/A'}
                    </div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>
                      <strong>Audited Institutional Reason:</strong> {result.revocation_reason || 'Administrative action'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '8px', fontWeight: 600 }}>
                      Certificate PDF downloads are permanently disabled for revoked credentials.
                    </div>
                  </div>
                )}

                {/* Superseded Advisory Box */}
                {isSuperseded && (
                  <div
                    style={{
                      background: '#FAF5FF',
                      border: '1.5px solid #DDD6FE',
                      borderRadius: '10px',
                      padding: '18px 20px',
                      color: '#5B21B6',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>🔄</span>
                      <span style={{ fontWeight: 700, fontSize: '15px' }}>
                        Certificate Superseded Notice
                      </span>
                      <Badge variant="neutral">Not Currently Valid</Badge>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#4C1D95' }}>
                      This certificate document has been formally superseded by an updated institutional reissuance.
                      {result.reissued_reason && (
                        <span> Official Reason: <strong>{result.reissued_reason}</strong>.</span>
                      )}
                      {' '}It should no longer be cited or presented as the currently effective certificate.
                    </p>
                    {result.replacement_certificate && (
                      <div
                        style={{
                          marginTop: '8px',
                          paddingTop: '12px',
                          borderTop: '1px solid #E9D5FF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Official Replacement Document:
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F2B48', fontFamily: 'monospace', marginTop: '2px' }}>
                            {result.replacement_certificate.certificate_number}
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(result.replacement_certificate!.verification_url)}
                          style={{
                            backgroundColor: '#6D28D9',
                            borderColor: '#6D28D9',
                            fontWeight: 600,
                          }}
                        >
                          View &amp; Verify Replacement Certificate &rarr;
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Certificate Core Details */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#B2811A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Certificate Title
                      </div>
                      <Badge variant={result.certificate_type === 'INCENTIVE_AWARD' ? 'gold' : 'teal'}>
                        {result.certificate_type === 'INCENTIVE_AWARD'
                          ? 'Incentive Award Certificate'
                          : 'Research Work Certificate'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F2B48', marginTop: '4px' }}>
                      {result.title || (result.certificate_type === 'INCENTIVE_AWARD' ? 'Certificate of Research Publication Incentive Award' : 'Certificate of Appreciation & Research Excellence')}
                    </div>
                  </div>

                  {/* Official Bulletin Edition Citation */}
                  {result.bulletin && (
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Official Research Bulletin Citation
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2B48', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>CSJMU RESEARCH BULLETIN</span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span style={{ color: '#B2811A' }}>VOLUME {result.bulletin.volume_number}</span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span style={{ color: '#B2811A' }}>ISSUE {result.bulletin.issue_number}</span>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>({result.bulletin.publication_period})</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        {result.bulletin.title}
                      </div>
                    </div>
                  )}

                  {/* Incentive Award Sanction Particulars */}
                  {result.certificate_type === 'INCENTIVE_AWARD' && (
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '14px 16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Incentive Sanction Particulars
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                        {result.publication_details?.incentive_amount && (
                          <div>
                            <div style={{ fontSize: '11px', color: '#78350F', fontWeight: 600 }}>Sanctioned Incentive Amount:</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#92400E', marginTop: '2px' }}>
                              ₹ {Number(result.publication_details.incentive_amount).toLocaleString('en-IN')}
                            </div>
                          </div>
                        )}
                        {result.publication_details?.sanction_order_ref && (
                          <div>
                            <div style={{ fontSize: '11px', color: '#78350F', fontWeight: 600 }}>Sanction Order Reference:</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', fontFamily: 'monospace', marginTop: '2px' }}>
                              {result.publication_details.sanction_order_ref}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#92400E', marginTop: '8px', fontStyle: 'italic' }}>
                        Awarded under the Governing Institutional Regulations for the Promotion of High-Impact Research & Academic Publications.
                      </div>
                    </div>
                  )}

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
                              {auth.academic_title &&
                              !auth.author_name.toLowerCase().startsWith(auth.academic_title.toLowerCase())
                                ? `${auth.academic_title} ${auth.author_name}`
                                : auth.author_name}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      {result.approvals && result.approvals.length > 0 ? (
                        result.approvals.map((ap, idx) => (
                          <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                              {ap.authority_type === 'VICE_CHANCELLOR' ? 'Vice Chancellor' : 'Dean – R&D'}: Verified & Sealed
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2B48', marginTop: '4px' }}>
                              {ap.signatory_name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>
                              {ap.designation}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                              CSJM University, Kanpur
                            </div>
                          </div>
                        ))
                      ) : (
                        <>
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
                        </>
                      )}
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
