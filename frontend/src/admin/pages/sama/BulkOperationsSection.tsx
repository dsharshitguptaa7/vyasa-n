import React, { useState, useEffect, useCallback } from 'react';
import { AppIcon, Button, Modal, LoadingState, EmptyState } from '@vyasa/ui';
import { samaAdminService } from '../../services/samaAdminService';
import type {
  BulkCertificateUploadPayload,
  BulkCertificatePreviewResponse,
  BulkCertificateGenerateRequest,
  BatchSummaryItem,
  BatchDetailResponse,
  CertificateResolutionMapping,
} from '../../types/sama';

interface BulkOperationsSectionProps {
  isSuperAdmin: boolean;
  onRefreshStats?: () => void;
}

const SAMPLE_PUBLICATION_JSON = {
  batch: {
    batch_name: "CSJMU RD Samiksha Bulletin Batch Oct 2026",
    certificate_type: "RESEARCH_PUBLICATION",
    issue_date: "2026-10-15",
    bulletin: {
      volume: 2,
      issue: 10,
      period: "October 2026"
    }
  },
  certificates: [
    {
      research_title: "Deep Learning for High-Throughput Biomarker Discovery in Precision Oncology",
      authors: [
        {
          researcher: {
            scopus_id: "57200112233",
            full_name: "Dr. Ananya Sharma",
            department: "Department of Biotechnology"
          },
          certificate_title: "Dr.",
          author_role: "First Author"
        }
      ],
      research_contribution_statement: "Recognized for landmark high-impact Q1 publication in Nature Biotechnology.",
      publication_details: {
        journal: "Nature Biotechnology",
        issn: "1546-1696",
        doi: "10.1038/s41587-026-00123-x"
      }
    }
  ]
};

const SAMPLE_INCENTIVE_JSON = {
  batch: {
    batch_name: "CSJMU RD Research Incentive Batch Q3 2026",
    certificate_type: "INCENTIVE_AWARD",
    issue_date: "2026-10-20"
  },
  certificates: [
    {
      research_title: "Quantum Error Correction with Surface Codes in Superconducting Qubits",
      authors: [
        {
          researcher: {
            scopus_id: "58199223344",
            full_name: "Prof. Rajesh Kumar Verma",
            department: "Department of Physics"
          },
          certificate_title: "Prof.",
          author_role: "Lead Investigator"
        }
      ],
      incentive_details: {
        quartile: "Q1",
        incentive_amount: 50000,
        sanction_order_ref: "CSJMU/RD/INC/2026/042"
      }
    }
  ]
};

export const BulkOperationsSection: React.FC<BulkOperationsSectionProps> = ({
  onRefreshStats,
}) => {
  const [subTab, setSubTab] = useState<'publication' | 'incentive' | 'batches'>('batches');

  // JSON editor state
  const [jsonText, setJsonText] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Preview state
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<BulkCertificatePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Author resolution state: certIdx -> authorIdx -> resolvedAuthorId
  const [selectedResolutions, setSelectedResolutions] = useState<Record<number, Record<number, string>>>({});

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Batches list & detail state
  const [batches, setBatches] = useState<BatchSummaryItem[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [activeBatchDetail, setActiveBatchDetail] = useState<BatchDetailResponse | null>(null);

  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalTargetBatch, setApprovalTargetBatch] = useState<BatchSummaryItem | null>(null);
  const [approvalAuthority, setApprovalAuthority] = useState<'DEAN_RD' | 'VICE_CHANCELLOR'>('DEAN_RD');
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalOpSuccess, setApprovalOpSuccess] = useState<string | null>(null);
  const [approvalOpError, setApprovalOpError] = useState<string | null>(null);

  // ZIP download state
  const [downloadingZipBatchId, setDownloadingZipBatchId] = useState<string | null>(null);

  // Load batches list
  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    setBatchesError(null);
    try {
      const resp = await samaAdminService.listCertificateBatches({ skip: 0, limit: 100 });
      setBatches(resp.items || []);
    } catch (err: any) {
      setBatchesError(err?.message || 'Failed to load certificate batches.');
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'batches') {
      loadBatches();
    }
  }, [subTab, loadBatches]);

  const handleLoadSample = (type: 'publication' | 'incentive') => {
    const sample = type === 'publication' ? SAMPLE_PUBLICATION_JSON : SAMPLE_INCENTIVE_JSON;
    setJsonText(JSON.stringify(sample, null, 2));
    setParseError(null);
    setPreviewData(null);
    setPreviewError(null);
    setGenerateSuccess(null);
    setGenerateError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonText(text);
      setParseError(null);
      setPreviewData(null);
      setPreviewError(null);
    };
    reader.onerror = () => setParseError('Failed to read selected file.');
    reader.readAsText(file);
  };

  const handleRunPreview = async () => {
    setParseError(null);
    setPreviewError(null);
    setPreviewData(null);
    setGenerateSuccess(null);
    setGenerateError(null);

    let parsedPayload: BulkCertificateUploadPayload;
    try {
      parsedPayload = JSON.parse(jsonText);
    } catch (err: any) {
      setParseError(`Invalid JSON format: ${err.message}`);
      return;
    }

    if (!parsedPayload.batch || !parsedPayload.certificates) {
      setParseError("JSON structure must contain 'batch' metadata and 'certificates' array.");
      return;
    }

    setIsPreviewing(true);
    try {
      const resp = await samaAdminService.previewBulkCertificates(parsedPayload);
      setPreviewData(resp);
      // Initialize automatic resolution defaults
      const resMap: Record<number, Record<number, string>> = {};
      resp.certificates.forEach((cert, cIdx) => {
        cert.authors.forEach((auth, aIdx) => {
          if (auth.status === 'MATCHED' && auth.matched_author_id) {
            if (!resMap[cIdx]) resMap[cIdx] = {};
            resMap[cIdx][aIdx] = auth.matched_author_id;
          }
        });
      });
      setSelectedResolutions(resMap);
    } catch (err: any) {
      setPreviewError(err?.message || 'Failed to validate bulk certificate JSON.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConfirmGeneration = async () => {
    if (!previewData) return;
    let parsedPayload: BulkCertificateUploadPayload;
    try {
      parsedPayload = JSON.parse(jsonText);
    } catch {
      return;
    }

    setIsGenerating(true);
    setGenerateSuccess(null);
    setGenerateError(null);

    // Build resolutions mapping
    const resolutionMappings: CertificateResolutionMapping[] = [];
    Object.entries(selectedResolutions).forEach(([cIdxStr, authMap]) => {
      const cIdx = parseInt(cIdxStr, 10);
      const authList = Object.entries(authMap).map(([aIdxStr, resId]) => ({
        author_index: parseInt(aIdxStr, 10),
        resolved_author_id: resId || null,
      }));
      resolutionMappings.push({
        certificate_index: cIdx,
        authors: authList,
      });
    });

    const generateReq: BulkCertificateGenerateRequest = {
      batch: parsedPayload.batch,
      certificates: parsedPayload.certificates,
      resolutions: resolutionMappings,
    };

    try {
      const resp = await samaAdminService.confirmBulkCertificates(generateReq);
      setGenerateSuccess(
        `Batch '${resp.batch_name}' generated successfully! ${resp.created_count} certificates created in PENDING_DEAN_APPROVAL status (Batch ID: ${resp.batch_id}).`
      );
      setPreviewData(null);
      setJsonText('');
      if (onRefreshStats) onRefreshStats();
      loadBatches();
    } catch (err: any) {
      setGenerateError(err?.message || 'Failed to generate bulk certificates.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenApprovalModal = (
    batch: BatchSummaryItem,
    authority: 'DEAN_RD' | 'VICE_CHANCELLOR'
  ) => {
    setApprovalTargetBatch(batch);
    setApprovalAuthority(authority);
    setApprovalAction('APPROVE');
    setApprovalRemarks('');
    setApprovalOpSuccess(null);
    setApprovalOpError(null);
    setShowApprovalModal(true);
  };

  const handleSubmitBulkApproval = async () => {
    if (!approvalTargetBatch) return;
    if (approvalAction === 'REJECT' && !approvalRemarks.trim()) {
      setApprovalOpError('Institutional remarks are strictly mandatory when rejecting a batch.');
      return;
    }

    setIsSubmittingApproval(true);
    setApprovalOpError(null);
    setApprovalOpSuccess(null);

    try {
      // First fetch certificates for this batch to get their IDs
      const detail = await samaAdminService.getCertificateBatchDetail(approvalTargetBatch.batch_id);
      const eligibleCerts = detail.certificates.filter((c: any) => {
        if (approvalAuthority === 'DEAN_RD') {
          return c.status === 'PENDING_DEAN_APPROVAL' || c.status === 'DRAFT';
        }
        return c.status === 'PENDING_VC_APPROVAL';
      });

      if (eligibleCerts.length === 0) {
        setApprovalOpError(
          `No certificates in this batch are currently eligible for ${
            approvalAuthority === 'DEAN_RD' ? 'Dean – R&D' : 'Vice Chancellor'
          } approval.`
        );
        setIsSubmittingApproval(false);
        return;
      }

      const certIds = eligibleCerts.map((c: any) => c.id);
      const resp = await samaAdminService.bulkApproveCertificates(
        certIds,
        approvalAction,
        approvalAuthority,
        approvalRemarks.trim() || undefined
      );

      setApprovalOpSuccess(
        `Bulk ${approvalAction.toLowerCase()} completed for ${resp.success_count} certificates (${resp.failure_count} failures).`
      );
      loadBatches();
      if (onRefreshStats) onRefreshStats();
      setTimeout(() => {
        setShowApprovalModal(false);
      }, 1500);
    } catch (err: any) {
      setApprovalOpError(err?.message || 'Failed to process bulk approval.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleDownloadBatchZip = async (batchId: string, batchName: string) => {
    setDownloadingZipBatchId(batchId);
    try {
      await samaAdminService.downloadBatchZip(batchId, `${batchName.replace(/\s+/g, '_')}.zip`);
    } catch (err: any) {
      alert(err?.message || 'Failed to download batch ZIP.');
    } finally {
      setDownloadingZipBatchId(null);
    }
  };

  const handleViewBatchDetails = async (batchId: string) => {
    try {
      const detail = await samaAdminService.getCertificateBatchDetail(batchId);
      setActiveBatchDetail(detail);
    } catch (err: any) {
      alert(err?.message || 'Failed to load batch details.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '10px',
        }}
      >
        <button
          onClick={() => {
            setSubTab('batches');
            setPreviewData(null);
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: subTab === 'batches' ? '#0F2B48' : '#F1F5F9',
            color: subTab === 'batches' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AppIcon name="file-text" size={15} />
          Batch History & Dual Approvals ({batches.length})
        </button>
        <button
          onClick={() => {
            setSubTab('publication');
            handleLoadSample('publication');
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: subTab === 'publication' ? '#0F2B48' : '#F1F5F9',
            color: subTab === 'publication' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AppIcon name="edit" size={15} />
          Publication Batch Upload (Format A)
        </button>
        <button
          onClick={() => {
            setSubTab('incentive');
            handleLoadSample('incentive');
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: subTab === 'incentive' ? '#0F2B48' : '#F1F5F9',
            color: subTab === 'incentive' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AppIcon name="shield" size={15} />
          Incentive Batch Upload (Format B)
        </button>
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {generateSuccess && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '8px',
            color: '#166534',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AppIcon name="check" size={18} color="#166534" />
          <span>{generateSuccess}</span>
        </div>
      )}

      {generateError && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            color: '#991B1B',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AppIcon name="close" size={18} color="#991B1B" />
          <span>{generateError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: BATCHES & DUAL APPROVAL HISTORY                                */}
      {/* ========================================================================= */}
      {subTab === 'batches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0F2B48', fontWeight: 700 }}>
                Certificate Batches & Dual Approval Pipelines
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                Track uploaded batches, run Dean – R&D and Vice Chancellor bulk approvals, and export certified PDF archives.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadBatches} disabled={batchesLoading}>
              <AppIcon name="clock" size={14} style={{ marginRight: '6px' }} />
              Refresh Batches
            </Button>
          </div>

          {batchesLoading ? (
            <LoadingState message="Loading certificate batches..." />
          ) : batchesError ? (
            <div style={{ padding: '20px', backgroundColor: '#FEF2F2', color: '#991B1B', borderRadius: '8px' }}>
              {batchesError}
            </div>
          ) : batches.length === 0 ? (
            <EmptyState
              title="No Certificate Batches Found"
              description="No bulk batches have been generated yet. Use the 'Publication Batch Upload' or 'Incentive Batch Upload' tabs to generate your first batch."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
              {batches.map((b) => (
                <div
                  key={b.batch_id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: b.certificate_type === 'INCENTIVE_AWARD' ? '#EFF6FF' : '#FDF4FF',
                          color: b.certificate_type === 'INCENTIVE_AWARD' ? '#1E40AF' : '#86198F',
                        }}
                      >
                        {b.certificate_type === 'INCENTIVE_AWARD' ? 'INCENTIVE AWARD' : 'RESEARCH PUBLICATION'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(b.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#0F2B48', fontWeight: 600 }}>
                      {b.batch_name}
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                      ID: {b.batch_id.slice(0, 16)}...
                    </span>

                    {/* Status metric badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #CBD5E1',
                          color: '#334155',
                          fontWeight: 600,
                        }}
                      >
                        Total: {b.total_certificates}
                      </span>
                      {b.pending_dean_count > 0 && (
                        <span
                          style={{
                            fontSize: '12px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#FEF3C7',
                            border: '1px solid #FDE68A',
                            color: '#92400E',
                            fontWeight: 600,
                          }}
                        >
                          Dean Queue: {b.pending_dean_count}
                        </span>
                      )}
                      {b.pending_vc_count > 0 && (
                        <span
                          style={{
                            fontSize: '12px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#DBEAFE',
                            border: '1px solid #BFDBFE',
                            color: '#1E40AF',
                            fontWeight: 600,
                          }}
                        >
                          VC Queue: {b.pending_vc_count}
                        </span>
                      )}
                      {b.issued_count > 0 && (
                        <span
                          style={{
                            fontSize: '12px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#DCFCE7',
                            border: '1px solid #BBF7D0',
                            color: '#166534',
                            fontWeight: 600,
                          }}
                        >
                          Issued: {b.issued_count}
                        </span>
                      )}
                      {b.scheduled_count > 0 && (
                        <span
                          style={{
                            fontSize: '12px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#EDE9FE',
                            border: '1px solid #DDD6FE',
                            color: '#5B21B6',
                            fontWeight: 600,
                          }}
                        >
                          Scheduled: {b.scheduled_count}
                        </span>
                      )}
                      {b.rejected_count > 0 && (
                        <span
                          style={{
                            fontSize: '12px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#FEE2E2',
                            border: '1px solid #FECACA',
                            color: '#991B1B',
                            fontWeight: 600,
                          }}
                        >
                          Rejected: {b.rejected_count}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Batch Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      borderTop: '1px solid #F1F5F9',
                      paddingTop: '12px',
                    }}
                  >
                    <button
                      onClick={() => handleViewBatchDetails(b.batch_id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#334155',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      View Ledger
                    </button>

                    {b.pending_dean_count > 0 && (
                      <button
                        onClick={() => handleOpenApprovalModal(b, 'DEAN_RD')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#B2811A',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Dean Review ({b.pending_dean_count})
                      </button>
                    )}

                    {b.pending_vc_count > 0 && (
                      <button
                        onClick={() => handleOpenApprovalModal(b, 'VICE_CHANCELLOR')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#0F2B48',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        VC Review & Seal ({b.pending_vc_count})
                      </button>
                    )}

                    <button
                      onClick={() => handleDownloadBatchZip(b.batch_id, b.batch_name)}
                      disabled={downloadingZipBatchId === b.batch_id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#F8FAFC',
                        color: '#0F2B48',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <AppIcon name="chevron-down" size={13} />
                      {downloadingZipBatchId === b.batch_id ? 'Archiving...' : 'Download ZIP'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: PUBLICATION & INCENTIVE WIZARD UPLOAD                          */}
      {/* ========================================================================= */}
      {(subTab === 'publication' || subTab === 'incentive') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0F2B48', fontWeight: 700 }}>
                  {subTab === 'publication'
                    ? 'Bulk Research Publication Certificate Upload (Format A)'
                    : 'Bulk Research Incentive Award Certificate Upload (Format B)'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                  Upload JSON file or edit payload directly. Authors are automatically matched against the SAMIKSHA Researcher Repository.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLoadSample(subTab)}
                >
                  Reload Sample Template
                </Button>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#F1F5F9',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid #CBD5E1',
                  }}
                >
                  <AppIcon name="file-text" size={14} style={{ marginRight: '6px' }} />
                  Upload JSON File
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            {/* JSON Code Area */}
            <div>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder="Paste or upload certificate JSON payload here..."
                rows={14}
                style={{
                  width: '100%',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  padding: '14px',
                  borderRadius: '6px',
                  border: parseError ? '1px solid #EF4444' : '1px solid #CBD5E1',
                  backgroundColor: '#0F172A',
                  color: '#F8FAFC',
                  boxSizing: 'border-box',
                }}
              />
              {parseError && (
                <div style={{ marginTop: '8px', color: '#DC2626', fontSize: '13px' }}>
                  {parseError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button
                variant="primary"
                onClick={handleRunPreview}
                disabled={!jsonText.trim() || isPreviewing}
              >
                {isPreviewing ? 'Validating & Matching Authors...' : 'Validate & Preview Batch'}
              </Button>
            </div>
          </div>

          {previewError && (
            <div
              style={{
                padding: '16px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#991B1B',
                fontSize: '14px',
              }}
            >
              {previewError}
            </div>
          )}

          {/* PREVIEW & AUTHOR MATCHING RESULTS */}
          {previewData && (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#0F2B48', fontWeight: 700 }}>
                    Batch Preview: {previewData.batch.batch_name}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                    Type: <strong>{previewData.batch.certificate_type}</strong> • Issue Date: <strong>{previewData.batch.issue_date}</strong>
                    {previewData.batch.bulletin && (
                      <> • Vol {previewData.batch.bulletin.volume} Issue {previewData.batch.bulletin.issue} ({previewData.batch.bulletin.period})</>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#DCFCE7',
                      color: '#166534',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    Valid: {previewData.valid_certificates_count} / {previewData.total_certificates}
                  </span>
                  {previewData.invalid_certificates_count > 0 && (
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      Invalid: {previewData.invalid_certificates_count}
                    </span>
                  )}
                </div>
              </div>

              {/* Author Repository Matching Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  backgroundColor: '#F8FAFC',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Total Authors</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F2B48' }}>
                    {previewData.total_authors}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#166534' }}>Repository Matched</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#166534' }}>
                    {previewData.matched_authors_count}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#B45309' }}>Ambiguous (Needs Choice)</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#B45309' }}>
                    {previewData.ambiguous_authors_count}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#475569' }}>Unmatched / New Scholars</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#475569' }}>
                    {previewData.not_found_authors_count}
                  </div>
                </div>
              </div>

              {/* Per-certificate preview list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#0F2B48' }}>
                  Certificate Records ({previewData.certificates.length})
                </h4>
                {previewData.certificates.map((cert) => (
                  <div
                    key={cert.index}
                    style={{
                      border: cert.is_valid ? '1px solid #E2E8F0' : '1px solid #FECACA',
                      backgroundColor: cert.is_valid ? '#FFFFFF' : '#FFF5F5',
                      borderRadius: '6px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#B2811A' }}>
                          Item #{cert.index + 1}
                        </span>
                        <h5 style={{ margin: '4px 0 0', fontSize: '15px', color: '#0F2B48', fontWeight: 600 }}>
                          {cert.research_title}
                        </h5>
                      </div>
                      {!cert.is_valid && (
                        <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
                          {cert.validation_errors.join(', ')}
                        </span>
                      )}
                    </div>

                    {/* Authors List & Matching Pill */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        Authors & Repository Linking:
                      </span>
                      {cert.authors.map((auth, aIdx) => (
                        <div
                          key={aIdx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#F8FAFC',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            fontSize: '13px',
                          }}
                        >
                          <div>
                            <strong>
                              {auth.certificate_title ? `${auth.certificate_title} ` : ''}
                              {auth.input_full_name}
                            </strong>
                            {auth.input_department && (
                              <span style={{ color: '#64748B', marginLeft: '8px' }}>
                                ({auth.input_department})
                              </span>
                            )}
                            {auth.author_role && (
                              <span style={{ color: '#0284C7', marginLeft: '8px', fontWeight: 500 }}>
                                • {auth.author_role}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {auth.status === 'MATCHED' && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#DCFCE7',
                                  color: '#166534',
                                  fontWeight: 600,
                                }}
                              >
                                MATCHED ({auth.matched_by})
                              </span>
                            )}
                            {auth.status === 'NOT_FOUND' && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#475569',
                                  fontWeight: 600,
                                }}
                              >
                                UNLINKED / NEW SCHOLAR
                              </span>
                            )}
                            {auth.status === 'AMBIGUOUS' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: '#FEF3C7',
                                    color: '#B45309',
                                    fontWeight: 600,
                                  }}
                                >
                                  AMBIGUOUS
                                </span>
                                <select
                                  value={selectedResolutions[cert.index]?.[aIdx] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedResolutions((prev) => ({
                                      ...prev,
                                      [cert.index]: {
                                        ...(prev[cert.index] || {}),
                                        [aIdx]: val,
                                      },
                                    }));
                                  }}
                                  style={{
                                    fontSize: '12px',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #CBD5E1',
                                  }}
                                >
                                  <option value="">Select candidate profile...</option>
                                  {auth.candidates.map((cand) => (
                                    <option key={cand.id} value={cand.id}>
                                      {cand.full_name} ({cand.department || 'No dept'} / {cand.scopus_id || 'No Scopus'})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid #E2E8F0',
                  paddingTop: '16px',
                }}
              >
                <Button variant="outline" onClick={() => setPreviewData(null)}>
                  Cancel / Re-edit JSON
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmGeneration}
                  disabled={isGenerating || previewData.valid_certificates_count === 0}
                >
                  {isGenerating
                    ? 'Creating Certificates in PENDING_DEAN_APPROVAL...'
                    : `Confirm & Generate Batch (${previewData.valid_certificates_count} Certificates)`}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: BULK APPROVAL (DEAN / VC)                                        */}
      {/* ========================================================================= */}
      {showApprovalModal && approvalTargetBatch && (
        <Modal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          title={`Bulk Authority Review: ${approvalTargetBatch.batch_name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#F8FAFC',
                padding: '12px 16px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                fontSize: '13px',
              }}
            >
              <div>Authority Role: <strong>{approvalAuthority === 'DEAN_RD' ? 'Dean – Research & Development' : 'Vice Chancellor'}</strong></div>
              <div>Batch ID: <code>{approvalTargetBatch.batch_id}</code></div>
              <div>Eligible Certificates in Queue: <strong>
                {approvalAuthority === 'DEAN_RD' ? approvalTargetBatch.pending_dean_count : approvalTargetBatch.pending_vc_count}
              </strong></div>
            </div>

            {approvalAuthority === 'VICE_CHANCELLOR' && (
              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #BFDBFE',
                  fontSize: '12px',
                  color: '#1E40AF',
                }}
              >
                <strong>Cryptographic Sealing Notice:</strong> Vice Chancellor bulk approval is the terminal authority action. Approving will cryptographically seal each certificate with active signatory visual assets, render production vector PDFs, generate unique SHA-256 hashes, embed verification QR codes, and transition them to ISSUED (or SCHEDULED).
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Action
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setApprovalAction('APPROVE')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: approvalAction === 'APPROVE' ? '2px solid #166534' : '1px solid #CBD5E1',
                    backgroundColor: approvalAction === 'APPROVE' ? '#DCFCE7' : '#FFFFFF',
                    color: approvalAction === 'APPROVE' ? '#166534' : '#334155',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Approve Batch
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalAction('REJECT')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: approvalAction === 'REJECT' ? '2px solid #991B1B' : '1px solid #CBD5E1',
                    backgroundColor: approvalAction === 'REJECT' ? '#FEE2E2' : '#FFFFFF',
                    color: approvalAction === 'REJECT' ? '#991B1B' : '#334155',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reject Batch
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Institutional Review Remarks {approvalAction === 'REJECT' && <span style={{ color: '#DC2626' }}>* (Mandatory for Rejection)</span>}
              </label>
              <textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder={approvalAction === 'REJECT' ? 'Specify institutional reason for rejecting this batch...' : 'Optional institutional endorsement notes...'}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {approvalOpError && (
              <div style={{ color: '#DC2626', fontSize: '13px' }}>
                {approvalOpError}
              </div>
            )}

            {approvalOpSuccess && (
              <div style={{ color: '#166534', fontSize: '13px', fontWeight: 600 }}>
                {approvalOpSuccess}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button variant="outline" onClick={() => setShowApprovalModal(false)} disabled={isSubmittingApproval}>
                Cancel
              </Button>
              <Button
                variant={approvalAction === 'APPROVE' ? 'primary' : 'outline'}
                onClick={handleSubmitBulkApproval}
                disabled={isSubmittingApproval || (approvalAction === 'REJECT' && !approvalRemarks.trim())}
              >
                {isSubmittingApproval ? 'Processing Authority Review...' : `Confirm Bulk ${approvalAction}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BATCH DETAIL LEDGER MODAL                                        */}
      {/* ========================================================================= */}
      {activeBatchDetail && (
        <Modal
          isOpen={Boolean(activeBatchDetail)}
          onClose={() => setActiveBatchDetail(null)}
          title={`Batch Manifest: ${activeBatchDetail.batch_name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Total Records: <strong>{activeBatchDetail.total_certificates}</strong></span>
              <span>Type: <strong>{activeBatchDetail.certificate_type}</strong></span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(activeBatchDetail.status_counts).map(([st, cnt]) => (
                <span
                  key={st}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#F1F5F9',
                    color: '#334155',
                    fontWeight: 600,
                  }}
                >
                  {st}: {cnt}
                </span>
              ))}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Certificate No</th>
                  <th style={{ padding: '8px' }}>Research Title</th>
                  <th style={{ padding: '8px' }}>Primary Recipient</th>
                  <th style={{ padding: '8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeBatchDetail.certificates.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px', fontFamily: 'monospace' }}>{c.certificate_number}</td>
                    <td style={{ padding: '8px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.research_title}
                    </td>
                    <td style={{ padding: '8px' }}>{c.primary_author}</td>
                    <td style={{ padding: '8px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor:
                            c.status === 'ISSUED'
                              ? '#DCFCE7'
                              : c.status === 'SCHEDULED'
                              ? '#EDE9FE'
                              : c.status === 'PENDING_VC_APPROVAL'
                              ? '#DBEAFE'
                              : c.status === 'PENDING_DEAN_APPROVAL'
                              ? '#FEF3C7'
                              : '#FEE2E2',
                          color:
                            c.status === 'ISSUED'
                              ? '#166534'
                              : c.status === 'SCHEDULED'
                              ? '#5B21B6'
                              : c.status === 'PENDING_VC_APPROVAL'
                              ? '#1E40AF'
                              : c.status === 'PENDING_DEAN_APPROVAL'
                              ? '#92400E'
                              : '#991B1B',
                        }}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
};
