import React, { useState } from 'react';
import { PageContainer, Card, Button, Badge } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { grievanceService } from '../services/grievanceService';
import {
  DocumentUploadItem,
  GrievanceDetailResponse,
  TaxonomySubjectItem,
} from '../types/grievance';
import { ApiError } from '../../../../services/apiClient';

export const GrievanceSubmitPage: React.FC = () => {
  const navigate = useNavigate();

  // Mode: manual or OCR
  const [entryMode, setEntryMode] = useState<'manual' | 'ocr'>('manual');
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuccessNotice, setOcrSuccessNotice] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjects, setSubjects] = useState<TaxonomySubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [attachments, setAttachments] = useState<DocumentUploadItem[]>([]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [isDuplicateError, setIsDuplicateError] = useState(false);
  const [submittedCase, setSubmittedCase] = useState<GrievanceDetailResponse | null>(null);

  React.useEffect(() => {
    grievanceService.getTaxonomySubjects().then(setSubjects).catch(() => {});
  }, []);

  const handleOcrFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|pdf)$/i)) {
      setOcrError('Unsupported format. Please upload a PNG, JPG, JPEG, WEBP or PDF document.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setOcrError('File size exceeds the 10MB limit for OCR extraction.');
      return;
    }
    setOcrFile(file);
    setOcrError(null);
    setOcrSuccessNotice(null);
  };

  const handleTriggerOcrExtraction = async () => {
    if (!ocrFile) {
      setOcrError('Please select a handwritten or printed document first.');
      return;
    }

    try {
      setOcrLoading(true);
      setOcrError(null);
      setOcrSuccessNotice(null);

      const result = await grievanceService.extractGrievanceFromOCR(ocrFile);

      if (result.title) setTitle(result.title);
      if (result.description) setDescription(result.description);

      setOcrSuccessNotice(
        result.confidence_note ||
          'Application digitized successfully! Please review and verify the particulars below before submitting.'
      );
    } catch (err: unknown) {
      setOcrError(
        err instanceof Error
          ? err.message
          : 'Failed to extract information from document. You can enter details manually.'
      );
    } finally {
      setOcrLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 5) {
      setErrorMsg('Maximum 5 attachments allowed per grievance.');
      return;
    }

    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.txt', '.csv', '.xlsx', '.xls'];
    const maxBytes = 20 * 1024 * 1024; // 20 MB

    Array.from(files).forEach((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowed.includes(ext)) {
        setErrorMsg(`File format '${ext}' not supported. Allowed: ${allowed.join(', ')}`);
        return;
      }
      if (file.size > maxBytes) {
        setErrorMsg(`File '${file.name}' exceeds the 20MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] || '';
        setAttachments((prev) => {
          if (prev.length >= 5) return prev;
          return [
            ...prev,
            {
              file_name: file.name,
              mime_type: file.type || 'application/octet-stream',
              file_size: file.size,
              content_base64: base64,
              document_type: 'ATTACHMENT',
            },
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 5) {
      setErrorMsg('Grievance title must contain at least 5 characters.');
      return;
    }

    if (!description.trim() || description.trim().length < 20) {
      setErrorMsg('Detailed description must contain at least 20 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setIsQuotaError(false);
      setIsDuplicateError(false);

      const created = await grievanceService.submitGrievance({
        title: title.trim(),
        description: description.trim(),
        subject_id: selectedSubjectId || undefined,
        documents: attachments,
      });

      setSubmittedCase(created);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 429) {
          setIsQuotaError(true);
        } else if (err.statusCode === 409) {
          setIsDuplicateError(true);
        }
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to submit grievance.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      {submittedCase ? (
        <Card
          variant="gold-accent"
          title="Grievance Successfully Registered"
          subtitle={`Tracking Identifier: ${submittedCase.grievance_id}`}
          headerAction={<Badge variant="teal">{submittedCase.status}</Badge>}
        >
          <div style={{ padding: '16px 0', lineHeight: 1.6 }}>
            <div
              style={{
                padding: '16px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                marginBottom: '20px',
              }}
            >
              <h4 style={{ margin: '0 0 8px', color: '#166534', fontSize: '15px' }}>
                &check; Formal Submission Accepted &amp; Queued for Manager Review
              </h4>
              <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#15803d' }}>
                Your grievance has been assigned tracking ID <strong>{submittedCase.grievance_id}</strong>.
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#166534' }}>
                Automated AI classification evaluated your dossier:
                {submittedCase.ai_suggested_category_name && (
                  <span>
                    {' '}Suggested Category: <strong>{submittedCase.ai_suggested_category_name}</strong>
                    {submittedCase.ai_confidence !== undefined && submittedCase.ai_confidence !== null && (
                      <span> ({Math.round(submittedCase.ai_confidence * 100)}% confidence)</span>
                    )}
                  </span>
                )}
                . Academic affiliation was resolved automatically from your student record. A manager will confirm category and dynamically route this case to the accountable authority.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <Button
                variant="primary"
                onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${submittedCase.id}`)}
              >
                View Grievance Dossier &rarr;
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSubmittedCase(null);
                  setTitle('');
                  setDescription('');
                  setAttachments([]);
                  setOcrFile(null);
                  setOcrSuccessNotice(null);
                }}
              >
                Submit Another Grievance
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
              >
                My Grievances
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          variant="gold-accent"
          title="Submit Formal Grievance"
          subtitle="Atharva Veda: Institutional Redressal & Cryptographic Dossier System"
          headerAction={<Badge variant="saffron">CSJMU Governance</Badge>}
        >
          <form onSubmit={handleSubmit} style={{ padding: '8px 0' }}>
            {errorMsg && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: isQuotaError || isDuplicateError ? '#fffbeb' : '#fef2f2',
                  border: `1px solid ${isQuotaError || isDuplicateError ? '#fef08a' : '#fecaca'}`,
                  borderRadius: '6px',
                  color: isQuotaError || isDuplicateError ? '#b45309' : '#b91c1c',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}
              >
                <strong>
                  {isQuotaError
                    ? 'Submission Quota Exceeded (HTTP 429): '
                    : isDuplicateError
                    ? 'Duplicate Grievance Detected (HTTP 409): '
                    : 'Error: '}
                </strong>
                {errorMsg}
                {isQuotaError && (
                  <div style={{ marginTop: '4px', fontSize: '12px' }}>
                    Scholars are restricted to a maximum of 5 submissions per calendar day (Asia/Kolkata).
                  </div>
                )}
                {isDuplicateError && (
                  <div style={{ marginTop: '4px', fontSize: '12px' }}>
                    You already have an active grievance under this category or with highly similar content.
                    Please track your existing case under &quot;My Grievances&quot;.
                  </div>
                )}
              </div>
            )}

            {/* Institutional Intake Information Banner */}
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '12.5px',
                color: '#475569',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '18px' }}>ℹ️</div>
              <div>
                <strong>Automatic Intake &amp; Governance Routing:</strong> Academic affiliation is
                automatically resolved from your student master record. Categorization is performed
                by server-side AI classification and confirmed by the Manager during triage.
              </div>
            </div>

            {/* Entry Mode Toggle (Manual vs AI OCR Digitization) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Entry Method
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEntryMode('manual')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: entryMode === 'manual' ? '2px solid var(--vyasa-primary, #681d28)' : '1px solid #cbd5e1',
                    backgroundColor: entryMode === 'manual' ? '#fdf2f4' : '#ffffff',
                    color: entryMode === 'manual' ? '#681d28' : '#475569',
                    fontWeight: entryMode === 'manual' ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  ✎ Enter Manually
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('ocr')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: entryMode === 'ocr' ? '2px solid var(--vyasa-primary, #681d28)' : '1px solid #cbd5e1',
                    backgroundColor: entryMode === 'ocr' ? '#fdf2f4' : '#ffffff',
                    color: entryMode === 'ocr' ? '#681d28' : '#475569',
                    fontWeight: entryMode === 'ocr' ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  📄 Upload Application (AI Digitization)
                  <span
                    style={{
                      fontSize: '10px',
                      backgroundColor: '#681d28',
                      color: '#ffffff',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
                    AI
                  </span>
                </button>
              </div>
            </div>

            {/* OCR Digitization Box */}
            {entryMode === 'ocr' && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: '#faf5f6',
                  border: '1px dashed #d97706',
                  borderRadius: '6px',
                }}
              >
                <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#92400e' }}>
                  Handwritten / Printed Application Digitization
                </h4>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#78350f' }}>
                  Upload a scanned photo or PDF of your physical application letter. The multimodal OCR service will extract the core issue into the title and narrative below.
                </p>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.pdf"
                    onChange={handleOcrFileSelect}
                    style={{ fontSize: '12.5px' }}
                  />
                  {ocrFile && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleTriggerOcrExtraction}
                      disabled={ocrLoading}
                    >
                      {ocrLoading ? 'Digitizing with Gemini...' : 'Extract Particulars with AI'}
                    </Button>
                  )}
                </div>

                {ocrError && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#b91c1c' }}>
                    &cross; {ocrError}
                  </div>
                )}
                {ocrSuccessNotice && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#15803d' }}>
                    &check; {ocrSuccessNotice}
                  </div>
                )}
              </div>
            )}

            {/* Academic Subject Selection (Optional) */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Academic Subject
                <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b', marginLeft: '6px' }}>
                  (Optional — Auto-detected from your Student Master Record if left unselected)
                </span>
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--vyasa-border)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="">-- Auto-detect from Student Record --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.cluster_name ? `(${s.cluster_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Grievance Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of your grievance or concern"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--vyasa-border)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
                required
                minLength={5}
                maxLength={255}
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Minimum 5 characters. {title.length}/255
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Detailed Description &amp; Statement of Facts *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Provide complete facts, dates, course identifiers, supervisors, or administrators involved..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--vyasa-border)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                required
                minLength={20}
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Minimum 20 characters. Current length: {description.length}
              </span>
            </div>

            {/* Document Attachments */}
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: 'var(--vyasa-bg-muted, #f8f9fa)',
                borderRadius: '6px',
                border: '1px dashed var(--vyasa-border)',
              }}
            >
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                Supporting Evidentiary Documents (Optional)
              </label>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
                Attach relevant notices, emails, grade-cards, or receipts (PDF, PNG, JPG).
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                style={{ fontSize: '13px' }}
              />

              {attachments.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--vyasa-border)',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      <span>
                        <strong>{att.file_name}</strong> ({(att.file_size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/modules/atharva-veda/nivaran')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting & Classifying...' : 'Submit Grievance'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </PageContainer>
  );
};
