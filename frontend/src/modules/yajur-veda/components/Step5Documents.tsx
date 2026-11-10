import React, { useState } from 'react';
import { Card, Button, Badge, Modal } from '@vyasa/ui';
import {
  AnudaanApplicationDetailOut,
  AnudaanPublicationOut,
  AnudaanDocumentOut,
} from '../types/anudaan';
import { anudaanService, ApiError } from '../services/anudaanService';

export interface Step5DocumentsProps {
  application: AnudaanApplicationDetailOut;
  onRefreshApplication: (updatedApp: AnudaanApplicationDetailOut) => void;
  onBack: () => void;
  onComplete?: () => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB strict limit

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

export const Step5Documents: React.FC<Step5DocumentsProps> = ({
  application,
  onRefreshApplication,
  onBack,
  onComplete,
}) => {
  const publications = application.publications || [];
  const allDocuments = application.documents || [];

  // Active Upload State per Publication (key: publicationId)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [uploadingPubId, setUploadingPubId] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<AnudaanDocumentOut | null>(null);

  // Messages
  const [serverError, setServerError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Helper to find document attached to a publication
  const getPublicationDocument = (pubId: string): AnudaanDocumentOut | null => {
    return (
      allDocuments.find(
        (d) => d.document_type === 'PUBLISHED_PAPER' && d.publication_id === pubId
      ) || null
    );
  };

  // Helper to find bank proof document
  const bankProofDoc =
    allDocuments.find(
      (d) => d.document_type === 'CANCELLED_CHEQUE' || d.document_type === 'PASSBOOK'
    ) || null;

  const handleFileSelect = (pubId: string, file: File | null) => {
    setServerError(null);
    setSuccessNotice(null);

    if (!file) {
      setSelectedFiles((prev) => ({ ...prev, [pubId]: null }));
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setServerError(`Invalid format for ${file.name}. Only PDF documents (.pdf) are permitted.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setServerError(`File ${file.name} exceeds the 10 MB limit (${formatSize(file.size)}).`);
      return;
    }

    setSelectedFiles((prev) => ({ ...prev, [pubId]: file }));
  };

  const handleUploadManuscript = async (pub: AnudaanPublicationOut) => {
    const file = selectedFiles[pub.id];
    if (!file) return;

    try {
      setUploadingPubId(pub.id);
      setServerError(null);
      setSuccessNotice(null);

      const res = await anudaanService.uploadDocument(
        application.id,
        file,
        'PUBLISHED_PAPER',
        { publicationId: pub.id }
      );

      if (res.success && res.data) {
        setSelectedFiles((prev) => ({ ...prev, [pub.id]: null }));
        setSuccessNotice(`Manuscript uploaded successfully for: ${pub.paper_title}`);

        // Refresh application state
        const refreshed = await anudaanService.getDraft(application.id);
        if (refreshed.success && refreshed.data) {
          onRefreshApplication(refreshed.data);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Failed to upload manuscript. Please check connection and try again.');
      }
    } finally {
      setUploadingPubId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;

    try {
      setServerError(null);
      await anudaanService.deleteDocument(deletingDoc.id);
      setDeletingDoc(null);
      setSuccessNotice('Manuscript document removed.');

      const refreshed = await anudaanService.getDraft(application.id);
      if (refreshed.success && refreshed.data) {
        onRefreshApplication(refreshed.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Failed to delete document.');
      }
    }
  };

  // Check if every publication has its published paper attached
  const allPapersUploaded =
    publications.length > 0 &&
    publications.every((pub) => getPublicationDocument(pub.id) !== null);

  return (
    <Card style={{ padding: 32 }}>
      {/* Step Header */}
      <div style={{ marginBottom: 24, borderBottom: '1px solid #E2E8F0', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 5 of 5
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0B2545', margin: '4px 0 0' }}>
              Supporting Document Management
            </h2>
          </div>
          <Badge variant={allPapersUploaded ? 'teal' : 'neutral'}>
            {allPapersUploaded ? '✓ All Manuscripts Attached' : 'Manuscripts Pending'}
          </Badge>
        </div>
      </div>

      {/* Guidelines Notice */}
      <div
        style={{
          backgroundColor: '#F8FAFC',
          borderLeft: '4px solid #0B2545',
          borderRadius: 4,
          padding: '14px 18px',
          marginBottom: 28,
        }}
      >
        <div style={{ fontWeight: 600, color: '#0B2545', fontSize: '0.9rem', marginBottom: 4 }}>
          📄 Published Paper PDF Upload Specifications
        </div>
        <p style={{ margin: 0, color: '#4A5568', fontSize: '0.875rem', lineHeight: 1.5 }}>
          Please upload the <strong>final published version</strong> (or publisher offprint PDF) for each claimed research paper.
          Documents must be in <strong>PDF format only</strong> and must not exceed <strong>10 MB per file</strong>.
        </p>
      </div>

      {serverError && (
        <div
          style={{
            backgroundColor: '#FEE2E2',
            border: '1px solid #F87171',
            color: '#B91C1C',
            padding: '12px 16px',
            borderRadius: 6,
            marginBottom: 24,
            fontSize: '0.925rem',
          }}
        >
          {serverError}
        </div>
      )}

      {successNotice && (
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            color: '#166534',
            padding: '12px 16px',
            borderRadius: 6,
            marginBottom: 24,
            fontSize: '0.925rem',
          }}
        >
          ✓ {successNotice}
        </div>
      )}

      {/* Per-Publication Upload Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
        {publications.map((pub, idx) => {
          const doc = getPublicationDocument(pub.id);
          const isUploading = uploadingPubId === pub.id;
          const selectedFile = selectedFiles[pub.id] || null;

          return (
            <div
              key={pub.id}
              style={{
                border: doc ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '20px 24px',
                backgroundColor: doc ? '#F0FDF4' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Badge variant="primary">Publication #{idx + 1}</Badge>
                    <Badge variant="neutral">{pub.document_type}</Badge>
                    {doc ? (
                      <Badge variant="teal">✓ Manuscript Attached</Badge>
                    ) : (
                      <Badge variant="saffron">⚠️ Missing PDF</Badge>
                    )}
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0B2545', margin: '4px 0 2px' }}>
                    {pub.paper_title}
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                    {pub.journal_name} ({pub.publication_year}) • DOI: <code>{pub.doi || 'N/A'}</code>
                  </div>
                </div>
              </div>

              {/* Uploaded Document Info OR Upload Control */}
              {doc ? (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 6,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>📑</span>
                    <div>
                      <strong style={{ color: '#1E293B', fontSize: '0.9rem', display: 'block' }}>
                        {doc.original_filename}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        Size: {formatSize(doc.file_size_bytes)} • Attached:{' '}
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setDeletingDoc(doc)}
                  >
                    Remove PDF
                  </Button>
                </div>
              ) : (
                <div style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 6, border: '1px dashed #CBD5E1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#475569', marginBottom: 4 }}>
                        Select Manuscript PDF (Max 10 MB) *
                      </label>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        aria-label={`Manuscript PDF for ${pub.paper_title}`}
                        onChange={(e) => handleFileSelect(pub.id, e.target.files?.[0] || null)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '0.85rem',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      disabled={!selectedFile || isUploading}
                      onClick={() => handleUploadManuscript(pub)}
                      style={{ marginTop: 20 }}
                    >
                      {isUploading ? 'Uploading PDF...' : 'Upload Manuscript'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bank Proof Summary Card (From Step 2) */}
      <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 20, marginBottom: 28 }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#4A5568', marginBottom: 8 }}>
          🏦 Applicant Bank Verification Proof (From Step 2)
        </h4>
        {bankProofDoc ? (
          <div style={{ fontSize: '0.85rem', color: '#047857' }}>
            ✓ {bankProofDoc.original_filename} ({bankProofDoc.document_type}) uploaded.
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
            No cancelled cheque or passbook proof uploaded in Step 2.
          </div>
        )}
      </div>

      {/* Navigation Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
        <Button variant="outline" type="button" onClick={onBack}>
          ← Back to Author Attribution
        </Button>

        <Button
          variant="primary"
          type="button"
          disabled={!allPapersUploaded}
          onClick={onComplete}
        >
          {allPapersUploaded
            ? 'Complete Supporting Documents Intake →'
            : 'Upload All Manuscript PDFs to Complete'}
        </Button>
      </div>

      {/* CONFIRM DELETE DOCUMENT MODAL */}
      <Modal
        isOpen={deletingDoc !== null}
        onClose={() => setDeletingDoc(null)}
        title="Confirm Manuscript Document Removal"
      >
        <div style={{ padding: '8px 4px' }}>
          <p style={{ color: '#1E293B', fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 16px' }}>
            Are you sure you want to remove the manuscript PDF <strong>{deletingDoc?.original_filename}</strong>?
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" type="button" onClick={() => setDeletingDoc(null)}>
              Keep Document
            </Button>
            <Button variant="outline" type="button" onClick={handleConfirmDelete}>
              Confirm Remove
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};
