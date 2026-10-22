import React, { useState, useRef } from 'react';
import { Card, Button, Badge, AppIcon } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { ApplicantLayout } from '../../../../features/applicant';
import { grievanceService } from '../services/grievanceService';
import {
  DocumentUploadItem,
  GrievanceDetailResponse,
  TaxonomySubjectItem,
} from '../types/grievance';
import { ApiError } from '../../../../services/apiClient';
import './CaseReview.css';

const formatFileSize = (bytes?: number | null): string => {
  if (bytes === undefined || bytes === null || isNaN(Number(bytes)) || Number(bytes) <= 0) {
    return '0 KB';
  }
  const kb = Number(bytes) / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${kb.toFixed(1)} KB`;
};

export const GrievanceSubmitPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [isDragging, setIsDragging] = useState(false);

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

  const processFiles = (files: FileList | File[]) => {
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = '';
    }
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
    <ApplicantLayout activeTab="submit-grievance">
      {/* 1. Stately Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#64748b',
          marginBottom: '18px',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
          <span>Dashboard</span>
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          NIVARAN-AI
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <span style={{ color: '#64748b', fontWeight: 500 }}>Submit Grievance</span>
      </nav>

      {/* 2. Stately Page Header */}
      <div className="nivaran-case-header">
        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip" aria-hidden="true">
              <AppIcon name="edit" size={20} color="var(--vyasa-navy, #1b2a4a)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading">
                  Submit a Grievance
                  <span className="sr-only">Submit Formal Grievance</span>
                </h1>
                <Badge variant="saffron">CSJMU Governance</Badge>
              </div>

              <p className="nivaran-case-meta" style={{ marginTop: '6px' }}>
                <span className="nivaran-case-meta__item">
                  NIVARAN-AI &bull; AI-Assisted Grievance Redressal
                </span>
                <span className="nivaran-case-meta__separator">&bull;</span>
                <span className="nivaran-case-meta__item">
                  Chhatrapati Shahu Ji Maharaj University, Kanpur
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
              style={{ fontSize: '13px' }}
            >
              My Grievances
            </Button>
          </div>
        </div>
      </div>

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
                padding: '20px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderLeft: '4px solid #16a34a',
                borderRadius: '8px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#166534',
                    flexShrink: 0,
                  }}
                >
                  <AppIcon name="check-circle" size={18} color="#166534" />
                </div>
                <h4 style={{ margin: 0, color: '#166534', fontSize: '16px', fontWeight: 700 }}>
                  Formal Submission Accepted &amp; Queued for Manager Review
                </h4>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#15803d' }}>
                Your grievance has been assigned tracking ID{' '}
                <span className="nivaran-tracking-pill" style={{ fontSize: '13px' }}>
                  {submittedCase.grievance_id}
                </span>
                .
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#166534', lineHeight: 1.6 }}>
                Automated AI classification evaluated your submission:
                {submittedCase.ai_suggested_category_name && (
                  <span>
                    {' '}Suggested Category: <strong>{submittedCase.ai_suggested_category_name}</strong>
                    {submittedCase.ai_confidence !== undefined && submittedCase.ai_confidence !== null && (
                      <span> ({Math.round(submittedCase.ai_confidence * 100)}% confidence)</span>
                    )}
                  </span>
                )}
                . Academic affiliation was resolved automatically from your student record. A University manager will confirm the category and assign this case to the responsible authority.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
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
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Grievance Application Form</span>
            </div>
          }
          subtitle="Provide complete facts and supporting documents for prompt institutional redressal"
          headerAction={<Badge variant="teal">Official Intake</Badge>}
        >
          <form onSubmit={handleSubmit} style={{ padding: '8px 0' }}>
            {errorMsg && (
              <div
                style={{
                  padding: '14px 18px',
                  backgroundColor: isQuotaError || isDuplicateError ? '#fffbeb' : '#fef2f2',
                  border: `1px solid ${isQuotaError || isDuplicateError ? '#fef08a' : '#fecaca'}`,
                  borderLeft: `4px solid ${isQuotaError || isDuplicateError ? '#d97706' : '#dc2626'}`,
                  borderRadius: '6px',
                  color: isQuotaError || isDuplicateError ? '#b45309' : '#b91c1c',
                  marginBottom: '20px',
                  fontSize: '13px',
                  lineHeight: 1.5,
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
                  <div style={{ marginTop: '6px', fontSize: '12.5px' }}>
                    Scholars are restricted to a maximum of 5 submissions per calendar day (Asia/Kolkata).
                  </div>
                )}
                {isDuplicateError && (
                  <div style={{ marginTop: '6px', fontSize: '12.5px' }}>
                    You already have an active grievance under this category or with highly similar content.
                    Please track your existing case under &quot;My Grievances&quot;.
                  </div>
                )}
              </div>
            )}

            {/* Refined Institutional Intake Notice Banner */}
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #0284c7',
                borderRadius: '8px',
                marginBottom: '24px',
                fontSize: '13px',
                lineHeight: 1.55,
                color: '#334155',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                <AppIcon name="info" size={16} color="#0284c7" />
              </div>
              <div>
                <strong style={{ color: '#0f2b48' }}>Automatic Intake &amp; Governance Routing:</strong>{' '}
                Academic affiliation is automatically verified from your Student Master Record. AI classification provides an initial category recommendation, which will be verified and confirmed by University authorities during initial review.
              </div>
            </div>

            {/* SECTION 1: Grievance Details */}
            <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--vyasa-navy, #0f2b48)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  1
                </div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-navy, #0f2b48)' }}>
                  Grievance Details
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', paddingLeft: '34px' }}>
                Provide the primary particulars of your grievance. You can type directly or digitize a physical letter using AI OCR.
              </p>
            </div>

            {/* Entry Mode Toggle (Manual vs AI OCR Digitization) */}
            <div style={{ marginBottom: '22px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: '#475569',
                  marginBottom: '8px',
                }}
              >
                Entry Method
              </label>
              <div
                style={{
                  display: 'inline-flex',
                  background: 'rgba(27, 42, 74, 0.04)',
                  padding: '4px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => setEntryMode('manual')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: entryMode === 'manual' ? '1px solid rgba(15, 43, 72, 0.2)' : '1px solid transparent',
                    backgroundColor: entryMode === 'manual' ? '#ffffff' : 'transparent',
                    color: entryMode === 'manual' ? 'var(--vyasa-navy, #0f2b48)' : '#64748b',
                    fontWeight: entryMode === 'manual' ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: entryMode === 'manual' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <AppIcon name="edit" size={15} color={entryMode === 'manual' ? 'var(--vyasa-navy, #0f2b48)' : '#64748b'} />
                  <span>Enter Manually</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('ocr')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: entryMode === 'ocr' ? '1px solid rgba(15, 43, 72, 0.2)' : '1px solid transparent',
                    backgroundColor: entryMode === 'ocr' ? '#ffffff' : 'transparent',
                    color: entryMode === 'ocr' ? 'var(--vyasa-navy, #0f2b48)' : '#64748b',
                    fontWeight: entryMode === 'ocr' ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: entryMode === 'ocr' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <AppIcon name="upload" size={15} color={entryMode === 'ocr' ? 'var(--vyasa-navy, #0f2b48)' : '#64748b'} />
                  <span>Upload Application (AI Digitization)</span>
                  <Badge variant="saffron" style={{ fontSize: '10px', padding: '1px 5px' }}>
                    AI
                  </Badge>
                </button>
              </div>
            </div>

            {/* OCR Digitization Panel */}
            {entryMode === 'ocr' && (
              <div
                style={{
                  marginBottom: '24px',
                  padding: '20px',
                  backgroundColor: '#fffdf5',
                  border: '1px solid #fef3c7',
                  borderLeft: '4px solid #d97706',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <AppIcon name="file-text" size={18} color="#92400e" />
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#92400e', fontWeight: 700 }}>
                    Physical Application Digitization
                  </h4>
                </div>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#78350f', lineHeight: 1.5 }}>
                  Upload a scanned photo or PDF of your physical application letter. The multimodal OCR service will extract the core particulars into the title and description below for your review.
                </p>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    ref={ocrFileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.pdf"
                    onChange={handleOcrFileSelect}
                    style={{ fontSize: '13px', color: '#1e293b' }}
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
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#b91c1c',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AppIcon name="alert-circle" size={16} color="#b91c1c" />
                    <span>{ocrError}</span>
                  </div>
                )}
                {ocrSuccessNotice && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AppIcon name="check-circle" size={16} color="#15803d" />
                    <span>{ocrSuccessNotice}</span>
                  </div>
                )}
              </div>
            )}

            {/* Academic Subject Selection (Optional) */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: '#475569',
                  }}
                >
                  Academic Department / Subject
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Auto-detected from student record if unselected
                </span>
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
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

            {/* Grievance Title */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: '#475569',
                  }}
                >
                  Grievance Title <span style={{ color: '#b91c1c' }}>*</span>
                </label>
                <span style={{ fontSize: '12px', color: title.length >= 5 ? '#15803d' : '#64748b' }}>
                  {title.length} / 255 characters
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of your grievance or concern"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  boxSizing: 'border-box',
                  color: '#1e293b',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                required
                minLength={5}
                maxLength={255}
              />
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                Minimum 5 characters. Be clear and specific.
              </div>
            </div>

            {/* Detailed Statement of Facts */}
            <div style={{ marginBottom: '26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: '#475569',
                  }}
                >
                  Detailed Statement of Facts <span style={{ color: '#b91c1c' }}>*</span>
                </label>
                <span style={{ fontSize: '12px', color: description.length >= 20 ? '#15803d' : '#64748b' }}>
                  {description.length} characters (min 20)
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                placeholder="Provide complete facts, dates, course identifiers, supervisors, or administrators involved..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  lineHeight: 1.6,
                  color: '#1e293b',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                required
                minLength={20}
              />
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                Describe what happened, any previous steps taken, and the specific relief requested.
              </div>
            </div>

            {/* SECTION 2: Supporting Documents */}
            <div style={{ marginTop: '32px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--vyasa-navy, #0f2b48)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  2
                </div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--vyasa-navy, #0f2b48)' }}>
                  Supporting Documents
                </h4>
                <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 400 }}>(Optional)</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', paddingLeft: '34px' }}>
                Attach relevant notices, emails, grade-cards, or receipts to substantiate your grievance. Maximum 5 attachments.
              </p>
            </div>

            {/* Refined Theme-Matched Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) {
                  processFiles(e.dataTransfer.files);
                }
              }}
              style={{
                border: isDragging ? '2px dashed var(--vyasa-navy, #0f2b48)' : '2px dashed #cbd5e1',
                backgroundColor: isDragging ? '#eff6ff' : '#f8fafc',
                borderRadius: '8px',
                padding: '28px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                marginBottom: '16px',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.csv,.xlsx,.xls"
              />
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(15, 43, 72, 0.06)',
                  color: 'var(--vyasa-navy, #0f2b48)',
                  marginBottom: '10px',
                }}
              >
                <AppIcon name="upload" size={22} color="var(--vyasa-navy, #0f2b48)" />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vyasa-navy, #0f2b48)', marginBottom: '4px' }}>
                Click to browse or drag and drop supporting files here
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                PDF, PNG, JPG, JPEG, DOC, DOCX, TXT, CSV, XLSX (Max 20 MB each &bull; up to 5 files)
              </div>
            </div>

            {/* Selected Files List */}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Attached Evidentiary Files ({attachments.length} of 5)</span>
                </div>
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '13px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(15, 43, 72, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--vyasa-navy, #0f2b48)',
                          flexShrink: 0,
                        }}
                      >
                        <AppIcon name="file-text" size={16} color="var(--vyasa-navy, #0f2b48)" />
                      </div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong style={{ color: '#1e293b' }}>{att.file_name}</strong>{' '}
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          ({formatFileSize(att.file_size)})
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(idx);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '12.5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      <AppIcon name="close" size={14} color="#dc2626" />
                      <span>Remove</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* SECTION 3: Actions */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                paddingTop: '20px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
                disabled={submitting}
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
    </ApplicantLayout>
  );
};
