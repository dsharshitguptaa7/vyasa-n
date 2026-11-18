import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Badge, AppIcon } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { knowledgeAdminService } from '../../services/knowledgeAdminService';
import {
  KNOWLEDGE_DOMAINS,
  DOCUMENT_TYPES,
  KnowledgeDomain,
  DocumentType,
} from '../../types/knowledge';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const UploadDocumentPage: React.FC = () => {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<KnowledgeDomain>('doctoral-studies');
  const [documentType, setDocumentType] = useState<DocumentType>('policy');
  const [subdomain, setSubdomain] = useState('');
  const [academicSession, setAcademicSession] = useState('2026-27');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [description, setDescription] = useState('');

  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ documentId: string; versionId: string } | null>(null);

  const handleFileChange = (selected: File | null) => {
    setErrorMsg(null);
    if (!selected) {
      setFile(null);
      return;
    }

    const ext = '.' + selected.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setErrorMsg(`Invalid file type "${ext}". Supported formats: PDF (.pdf), Word (.docx), PowerPoint (.pptx), Plain text (.txt).`);
      return;
    }

    if (selected.size === 0) {
      setErrorMsg('Cannot upload an empty (0 bytes) file.');
      return;
    }

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`File exceeds maximum allowed upload size (50MB). Actual size: ${(selected.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }

    setFile(selected);
    if (!title) {
      const cleanTitle = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Please select a valid document file to upload.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Document title is mandatory.');
      return;
    }

    try {
      setUploading(true);
      setErrorMsg(null);

      const res = await knowledgeAdminService.uploadDocument({
        file,
        title: title.trim(),
        domain,
        document_type: documentType,
        description: description.trim() || undefined,
        subdomain: subdomain.trim() || undefined,
        academic_session: academicSession.trim() || undefined,
        issuing_authority: issuingAuthority.trim() || undefined,
        effective_from: effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined,
        effective_until: effectiveUntil ? new Date(effectiveUntil).toISOString() : undefined,
      });

      setSuccessResult({
        documentId: res.id,
        versionId: res.current_version_id || (res.current_version ? res.current_version.id : ''),
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload document to Knowledge Centre.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminLayout activeTab="knowledge-centre">
      <div className="space-y-6 p-6 max-w-4xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <span onClick={() => navigate('/admin/knowledge-centre')} className="cursor-pointer hover:underline">
            Knowledge Centre
          </span>
          <span>/</span>
          <span onClick={() => navigate('/admin/knowledge-centre/documents')} className="cursor-pointer hover:underline">
            Documents
          </span>
          <span>/</span>
          <span>Upload</span>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            Upload Authoritative Document
            <Badge variant="teal" size="sm">Spaces Object Storage</Badge>
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Documents are securely stored under domain prefixes with SHA-256 checksums and immutable version keys. Text extraction and embedding runs automatically in the background.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AppIcon name="alert-circle" size={20} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold underline">Dismiss</button>
          </div>
        )}

        {successResult ? (
          <Card className="p-8 text-center border-green-200 dark:border-green-900 bg-green-50/20 dark:bg-green-950/10 space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 flex items-center justify-center mx-auto">
              <AppIcon name="check-circle" size={28} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Document Uploaded Successfully!</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
              The file has been persisted to private object storage. Text parsing and vector embedding have been dispatched in the background. The document is queued for SADMIN approval.
            </p>
            <div className="pt-4 flex justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSuccessResult(null);
                  setFile(null);
                  setTitle('');
                }}
              >
                Upload Another Document
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/admin/knowledge-centre/documents/${successResult.documentId}`)}
              >
                Inspect Chunks & Details
              </Button>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Dropzone */}
            <Card className="p-6 border-dashed border-2 border-gray-300 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/10">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="text-center py-6 cursor-pointer"
                onClick={() => document.getElementById('knowledge-file-input')?.click()}
              >
                <input
                  id="knowledge-file-input"
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
                />
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <AppIcon name="upload" size={24} />
                </div>
                {file ? (
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center justify-center gap-2">
                      <AppIcon name="file-text" size={16} className="text-primary" />
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'document'}
                    </div>
                    <span className="text-xs text-primary underline mt-2 inline-block">Click to replace file</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      Drag & drop your document here, or <span className="text-primary underline">browse</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Supports PDF, DOCX, PPTX, and TXT files up to 50MB
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Document Metadata Form */}
            <Card className="p-6 border border-gray-200 dark:border-gray-800 space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-800 pb-2">
                Document Metadata & Taxonomy
              </h2>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSJMU Ph.D. Ordinance 2026-27 (NEP Compliant)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Domain & Document Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Knowledge Domain <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as KnowledgeDomain)}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {KNOWLEDGE_DOMAINS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    Storage prefix: <span className="font-mono text-primary">vyasa-knowledge/{domain}/</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Document Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subdomain & Academic Session */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Subdomain / Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Coursework Guidelines, RAC Guidelines"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Academic Session
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2026-27"
                    value={academicSession}
                    onChange={(e) => setAcademicSession(e.target.value)}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Issuing Authority & Validity Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Issuing Authority
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Academic Council, Executive Council"
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Effective From
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Effective Until
                  </label>
                  <input
                    type="date"
                    value={effectiveUntil}
                    onChange={(e) => setEffectiveUntil(e.target.value)}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Document Description & Context
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of statutory provisions, target departments, and relevance to AI question answering..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </Card>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => navigate('/admin/knowledge-centre/documents')}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={uploading || !file || !title.trim()}
                className="flex items-center gap-2"
              >
                <AppIcon name="upload" size={16} />
                {uploading ? 'Uploading to Spaces...' : 'Upload & Extract Passages'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};
