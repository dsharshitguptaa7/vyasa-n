import React, { useEffect, useState } from 'react';
import { Button, Badge, Modal, Select, EmptyState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { samaAdminService } from '../../services/samaAdminService';
import { useAuth } from '../../../context/AuthContext';
import {
  ImportBatchRecord,
  ImportPreviewResult,
  ImportExecuteResult,
} from '../../types/sama';

interface FieldSpec {
  name: string;
  type: string;
  required: boolean;
  aliases?: string[];
  description: string;
  example: string;
}

interface EntityGuide {
  title: string;
  description: string;
  expectedHeaders: string[];
  fields: FieldSpec[];
  rules: string[];
  sampleData: Record<string, any>[];
  csvHeaders: string[];
}

const ENTITY_GUIDES: Record<string, EntityGuide> = {
  publications: {
    title: 'Research Publications Ledger',
    description: 'Scholarly papers, articles, conference proceedings, and book chapters published by faculty & scholars.',
    expectedHeaders: ['title', 'slug', 'source_journal', 'category', 'serial_no', 'doi', 'author_display', 'abstract', 'external_url'],
    csvHeaders: ['title', 'slug', 'source_journal', 'category', 'serial_no', 'doi', 'author_display', 'abstract', 'external_url'],
    fields: [
      { name: 'title', type: 'String', required: true, aliases: [], description: 'Complete research publication title.', example: 'Machine Learning Framework for Plant Disease Detection' },
      { name: 'slug', type: 'String', required: false, aliases: ['id'], description: 'Stable alphanumeric slug (e.g., v2-i1-r001). Auto-assigned if empty.', example: 'csjmu-cs-2026-001' },
      { name: 'source_journal', type: 'String', required: false, aliases: ['source', 'journal'], description: 'Publishing journal, conference, or publisher name.', example: 'Nature Scientific Reports' },
      { name: 'category', type: 'String', required: false, aliases: ['type'], description: 'Article, Review, Conference Paper, Book Chapter, Book, Short Survey, Editorial, Letter. (Default: Article)', example: 'Article' },
      { name: 'serial_no', type: 'Integer', required: false, aliases: [], description: 'Sequential number within the publication volume.', example: '1' },
      { name: 'doi', type: 'String', required: false, aliases: [], description: 'Standard Digital Object Identifier (DOI).', example: '10.1038/s41598-026-12345-x' },
      { name: 'author_display', type: 'String', required: false, aliases: ['authors'], description: 'Author citation string or JSON list of authors.', example: 'Dr. Namita Gupta, Dr. A. K. Sharma' },
      { name: 'abstract', type: 'String', required: false, aliases: [], description: 'Brief abstract summary of research findings.', example: 'This paper presents an edge-deployed deep convolutional model...' },
      { name: 'external_url', type: 'String', required: false, aliases: [], description: 'Canonical landing page URL or open-access repository link.', example: 'https://doi.org/10.1038/s41598-026-12345-x' },
    ],
    rules: [
      'Field "title" is mandatory. Any row missing a title will fail validation.',
      'Deduplication: The backend matches against existing records by "slug" or exact "title". Matches are flagged as SKIP (already exists).',
      'Slug Conflict: If an uploaded slug matches an existing publication with a different title, the row is marked as REVIEW for manual reconciliation.',
      'Safety policy: All successfully imported publications are safely initialized in non-public "draft" status.',
    ],
    sampleData: [
      {
        title: 'Machine Learning Framework for Early Stage Plant Disease Detection',
        slug: 'csjmu-cs-2026-001',
        source_journal: 'Nature Scientific Reports',
        category: 'Article',
        serial_no: 1,
        doi: '10.1038/s41598-026-12345-x',
        author_display: 'Dr. Namita Gupta, Dr. A. K. Sharma',
        abstract: 'This paper proposes a lightweight vision transformer architecture for mobile crop inspection.',
        external_url: 'https://doi.org/10.1038/s41598-026-12345-x',
      },
      {
        title: 'Synthesis of Novel Nanocatalysts for Green Hydrogen Generation',
        slug: 'csjmu-ch-2026-002',
        source_journal: 'Journal of Materials Chemistry A',
        category: 'Article',
        serial_no: 2,
        doi: '10.1039/D6TA00123A',
        author_display: 'Dr. Rajesh Verma, Prof. Sunita Devi',
        abstract: 'High-surface-area transition metal phosphide catalysts synthesized via solvothermal route.',
        external_url: 'https://doi.org/10.1039/D6TA00123A',
      },
    ],
  },
  authors: {
    title: 'Authors & Scopus Identities',
    description: 'Faculty members, scholars, and collaborators affiliated with CSJMU or co-authoring publications.',
    expectedHeaders: ['name', 'scopus_id', 'department', 'institutional_affiliation'],
    csvHeaders: ['name', 'scopus_id', 'department', 'institutional_affiliation'],
    fields: [
      { name: 'name', type: 'String', required: true, aliases: ['full_name'], description: 'Full academic or scholar name.', example: 'Dr. Namita Gupta' },
      { name: 'scopus_id', type: 'String', required: false, aliases: ['id'], description: 'Official Elsevier Scopus Author Identifier.', example: '57218940100' },
      { name: 'department', type: 'String', required: false, aliases: [], description: 'University academic department or school.', example: 'Department of Computer Science & Engineering' },
      { name: 'institutional_affiliation', type: 'String', required: false, aliases: [], description: 'Affiliation name (defaults to CSJMU Kanpur).', example: 'Chhatrapati Shahu Ji Maharaj University, Kanpur' },
    ],
    rules: [
      'Field "name" or "full_name" is strictly required.',
      'If Scopus ID matches an author with the same name, the row is flagged as SKIP (already cataloged).',
      'If author exists by name without a Scopus ID, the action is marked as UPDATE to attach the Scopus identity.',
      'Imported authors are marked as "is_verified=False" (provisional) pending formal R&D review.',
    ],
    sampleData: [
      {
        name: 'Dr. Namita Gupta',
        scopus_id: '57218940100',
        department: 'Department of Computer Science & Engineering',
        institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
      },
      {
        name: 'Dr. Rajesh Verma',
        scopus_id: '57201849200',
        department: 'Department of Chemistry',
        institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
      },
    ],
  },
  cam_projects: {
    title: 'CAM-AI Research Grants & Schemes',
    description: 'Centre for Advanced Modeling & Artificial Intelligence sanctioned project schemes and deliverables.',
    expectedHeaders: ['title', 'id', 'funding', 'category', 'domain', 'principal_investigator', 'status'],
    csvHeaders: ['title', 'id', 'funding', 'category', 'domain', 'principal_investigator', 'status'],
    fields: [
      { name: 'title', type: 'String', required: true, aliases: [], description: 'Sanctioned research project title.', example: 'Autonomous Drone Fleet for Agricultural Surveillance' },
      { name: 'id', type: 'Integer', required: false, aliases: ['legacy_id'], description: 'Legacy project numeric identification number.', example: '101' },
      { name: 'funding', type: 'String/Number', required: false, aliases: [], description: 'Sanctioned budget amount (e.g., ₹5,00,000 or 500000).', example: '₹5,00,000' },
      { name: 'category', type: 'String', required: false, aliases: [], description: 'Grant tier: "major", "minor", or "special".', example: 'major' },
      { name: 'domain', type: 'String', required: false, aliases: [], description: 'AI research domain or subfield.', example: 'Computer Vision & Robotics' },
      { name: 'principal_investigator', type: 'String', required: false, aliases: [], description: 'Principal Investigator (PI) full name.', example: 'Dr. Namita Gupta' },
      { name: 'status', type: 'String', required: false, aliases: [], description: 'Lifecycle status: "awarded", "in_progress", "completed", "terminated".', example: 'awarded' },
    ],
    rules: [
      'Field "title" is required.',
      'Numeric values in "funding" can include currency symbols like ₹, $, or commas; the engine parses both raw and formatted values.',
      'Duplicate projects matching by legacy ID or exact title are marked as SKIP.',
    ],
    sampleData: [
      {
        title: 'Autonomous Drone Fleet for Agricultural Surveillance',
        id: 101,
        funding: '₹5,00,000',
        category: 'major',
        domain: 'Computer Vision & Robotics',
        principal_investigator: 'Dr. Namita Gupta',
        status: 'awarded',
      },
      {
        title: 'Edge AI Sensors for Municipal Water Quality Monitoring',
        id: 102,
        funding: '₹2,50,000',
        category: 'minor',
        domain: 'IoT & Environmental Sensing',
        principal_investigator: 'Dr. Rajesh Verma',
        status: 'in_progress',
      },
    ],
  },
  fellowships: {
    title: 'Fellowship Schemes & Student Cohorts',
    description: 'Institutional and sponsored research fellowship programs.',
    expectedHeaders: ['name', 'students'],
    csvHeaders: ['name', 'students'],
    fields: [
      { name: 'name', type: 'String', required: true, aliases: ['scheme_code'], description: 'Unique fellowship scheme code or name.', example: 'CSJMU-URF-2026' },
      { name: 'students', type: 'Integer', required: false, aliases: ['active_scholars_count'], description: 'Count of currently funded research scholars.', example: '42' },
    ],
    rules: [
      'Field "name" or "scheme_code" is required.',
      'If the fellowship scheme exists, the scholar count is updated during reconciliation.',
    ],
    sampleData: [
      { name: 'CSJMU-URF-2026', students: 42 },
      { name: 'UP-CST-FELLOWSHIP', students: 18 },
    ],
  },
};

export const ImportPage: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const userRoles = (user?.roles || []).map((r) => r.toLowerCase());
  const isSuperAdminUser = Boolean(isSuperAdmin || userRoles.includes('super_admin'));

  const [batches, setBatches] = useState<ImportBatchRecord[]>([]);
  const [totalBatches, setTotalBatches] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [activeTab, setActiveTab] = useState<'upload' | 'bundle'>('bundle');
  const [entityType, setEntityType] = useState<string>('publications');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(true);

  // Preview state
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [bundlePreviewResult, setBundlePreviewResult] = useState<Record<string, any> | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Batch Multi-Selection & Bulk Delete state
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [isBatchBulkDeleteOpen, setIsBatchBulkDeleteOpen] = useState(false);
  const [isDeletingBatches, setIsDeletingBatches] = useState(false);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await samaAdminService.getImportBatches({ limit: 20 });
      setBatches(res.items);
      setTotalBatches(res.total);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load import batch history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleGenerateFilePreview = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select a file to import (JSON, CSV, or Excel).');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await samaAdminService.previewImport(entityType, selectedFile);
      setPreviewResult(res);
      setBundlePreviewResult(null);
      setSuccessMsg(`Preview generated for batch ${res.batch_number}. Review the reconciliation report below.`);
      fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate import preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunBundleSimulation = async (dryRun: boolean) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await samaAdminService.importHistoricalBundle({ dry_run: dryRun });
      setBundlePreviewResult(res);
      setPreviewResult(null);
      if (dryRun) {
        setSuccessMsg(`Historical bundle simulated successfully (Batch: ${res.batch_number}). No persistent records were modified.`);
      } else {
        setSuccessMsg(`Historical bundle executed successfully! Records imported into SAMIKSHA.`);
      }
      fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to run historical bundle reconciliation.');
    } finally {
      setLoading(false);
      setIsExecuting(false);
      setIsConfirmModalOpen(false);
    }
  };

  const handleConfirmExecute = async () => {
    if (previewResult) {
      try {
        setIsExecuting(true);
        setErrorMsg(null);
        const res: ImportExecuteResult = await samaAdminService.executeImport(previewResult.batch_id);
        setSuccessMsg(`Batch ${res.batch_number} executed successfully: ${res.created_count} record(s) created in draft state, ${res.updated_count} updated, ${res.skipped_count} skipped.`);
        setPreviewResult(null);
        fetchBatches();
      } catch (err: any) {
        setErrorMsg(err.message || 'Import execution failed.');
      } finally {
        setIsExecuting(false);
        setIsConfirmModalOpen(false);
      }
    } else if (bundlePreviewResult) {
      handleRunBundleSimulation(false);
    }
  };

  // Download Sample Template Handler
  const handleDownloadTemplate = (format: 'json' | 'csv') => {
    const guide = ENTITY_GUIDES[entityType];
    if (!guide) return;

    let content = '';
    const filename = `samiksha_${entityType}_template.${format}`;
    let mimeType = '';

    if (format === 'json') {
      content = JSON.stringify(guide.sampleData, null, 2);
      mimeType = 'application/json';
    } else if (format === 'csv') {
      const headers = guide.csvHeaders.join(',');
      const rows = guide.sampleData.map((row) =>
        guide.csvHeaders
          .map((h) => {
            const val = row[h] !== undefined ? String(row[h]) : '';
            return val.includes(',') || val.includes('"') || val.includes('\n')
              ? `"${val.replace(/"/g, '""')}"`
              : val;
          })
          .join(',')
      );
      content = [headers, ...rows].join('\n');
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Batch Multi-Selection logic
  const toggleSelectBatch = (id: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllBatchesSelected =
    batches.length > 0 && batches.every((b) => selectedBatchIds.has(b.id));
  const isSomeBatchesSelected =
    batches.some((b) => selectedBatchIds.has(b.id)) && !isAllBatchesSelected;

  const handleToggleSelectAllBatches = () => {
    if (isAllBatchesSelected) {
      setSelectedBatchIds((prev) => {
        const next = new Set(prev);
        batches.forEach((b) => next.delete(b.id));
        return next;
      });
    } else {
      setSelectedBatchIds((prev) => {
        const next = new Set(prev);
        batches.forEach((b) => next.add(b.id));
        return next;
      });
    }
  };

  const handleBulkDeleteBatchesSubmit = async () => {
    if (selectedBatchIds.size === 0) return;
    try {
      setIsDeletingBatches(true);
      setErrorMsg(null);
      const res = await samaAdminService.bulkDeleteImportBatches(Array.from(selectedBatchIds));
      if (res.failed_count === 0) {
        setSuccessMsg(`Successfully deleted ${res.deleted_count} import batch record(s).`);
      } else if (res.deleted_count > 0) {
        setSuccessMsg(`Deleted ${res.deleted_count} batch(es); ${res.failed_count} could not be deleted.`);
      } else {
        setErrorMsg(`Failed to delete selected batches: ${res.failed_items.map((f) => f.reason).join(', ')}`);
      }
      setSelectedBatchIds(new Set());
      setIsBatchBulkDeleteOpen(false);
      fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete import batches.');
    } finally {
      setIsDeletingBatches(false);
    }
  };

  const currentGuide = ENTITY_GUIDES[entityType] || ENTITY_GUIDES.publications;

  return (
    <AdminLayout activeTab="sama-import">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b2811a' }}>
              SAMIKSHA Administration
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#171717', margin: '4px 0 0 0' }}>
              Historical Data Import &amp; Reconciliation
            </h1>
            <p style={{ fontSize: '13px', color: '#737373', margin: '4px 0 0 0' }}>
              Safely validate, preview, and ingest research records into SAMIKSHA with automated duplicate detection and auditable ledger tracking.
            </p>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>✕</button>
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} style={{ border: 'none', background: 'transparent', color: '#22c55e', cursor: 'pointer', fontWeight: 600 }}>✕</button>
          </div>
        )}

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e5e5', paddingBottom: '12px' }}>
          <Button
            variant={activeTab === 'bundle' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('bundle')}
          >
            Historical Portfolio Bundle
          </Button>
          <Button
            variant={activeTab === 'upload' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('upload')}
          >
            Custom File Import (JSON / CSV / Excel)
          </Button>
        </div>

        {/* Tab 1: Custom File Upload */}
        {activeTab === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Upload Action Card */}
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: 0 }}>
                    Upload Single Entity Batch
                  </h3>
                  <p style={{ fontSize: '13px', color: '#737373', marginTop: '2px', marginBottom: 0 }}>
                    Select your target schema and upload a structured data file to generate an instantaneous dry-run preview.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGuidelines((prev) => !prev)}
                >
                  {showGuidelines ? 'Hide Import Guidelines' : 'View Import Guidelines & Templates'}
                </Button>
              </div>

              {/* Supported Formats Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px' }}>
                <span style={{ fontWeight: 600, color: '#0f2b48' }}>Supported File Formats:</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', color: '#065f46', fontWeight: 500 }}>
                  ✓ JSON (.json)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', color: '#065f46', fontWeight: 500 }}>
                  ✓ CSV (.csv)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', color: '#065f46', fontWeight: 500 }}>
                  ✓ Excel (.xlsx / .xls)
                </span>
                <span style={{ fontSize: '11.5px', color: '#64748b', marginLeft: 'auto' }}>
                  Excel files are processed natively via openpyxl engine
                </span>
              </div>

              {/* Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', paddingTop: '4px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#404040', marginBottom: '4px' }}>
                    Target Entity Schema <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <Select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    options={[
                      { label: 'Publications (Research Papers)', value: 'publications' },
                      { label: 'Authors & Scopus Identities', value: 'authors' },
                      { label: 'CAM-AI Projects & Grants', value: 'cam_projects' },
                      { label: 'Fellowship Schemes & Cohorts', value: 'fellowships' },
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#404040', marginBottom: '4px' }}>
                    Data File (.json, .csv, .xlsx, .xls) <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    type="file"
                    accept=".json,.csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    style={{
                      display: 'block',
                      width: '100%',
                      fontSize: '13px',
                      color: '#475569',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate('json')}
                    title={`Download sample ${entityType} template in JSON format`}
                  >
                    ⬇ Download Sample JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate('csv')}
                    title={`Download sample ${entityType} template in CSV format`}
                  >
                    ⬇ Download Sample CSV
                  </Button>
                </div>

                <Button
                  variant="primary"
                  onClick={handleGenerateFilePreview}
                  disabled={loading || !selectedFile}
                >
                  {loading ? 'Validating File...' : 'Generate Dry-Run Preview'}
                </Button>
              </div>
            </div>

            {/* Bulk Import Guidelines & Template Documentation */}
            {showGuidelines && (
              <div
                data-testid="import-guidelines-section"
                style={{
                  background: '#ffffff',
                  padding: '24px',
                  borderRadius: '12px',
                  border: '1px solid #e5e5e5',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f2b48', margin: 0 }}>
                      Bulk Import Guidelines &amp; Data Schema: {currentGuide.title}
                    </h4>
                    <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                      {currentGuide.description}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate('json')}>
                      Download JSON Template
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate('csv')}>
                      Download CSV Template
                    </Button>
                  </div>
                </div>

                {/* Expected Column Headers Banner */}
                <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                    Expected Column Headers (CSV / Excel) or JSON Keys:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {currentGuide.expectedHeaders.map((header) => {
                      const isReq = currentGuide.fields.find((f) => f.name === header)?.required;
                      return (
                        <span
                          key={header}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: isReq ? '#fef2f2' : '#ffffff',
                            border: isReq ? '1px solid #fecaca' : '1px solid #cbd5e1',
                            color: isReq ? '#991b1b' : '#334155',
                            fontWeight: isReq ? 700 : 500,
                          }}
                        >
                          {header} {isReq && '*'}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Field Specification Table */}
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Field Name</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Requirement</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Data Type</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Accepted Aliases</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Description &amp; Guidelines</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Sample Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentGuide.fields.map((f, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < currentGuide.fields.length - 1 ? '1px solid #f1f5f9' : undefined }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0f2b48' }}>
                            {f.name}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {f.required ? (
                              <Badge variant="saffron">REQUIRED</Badge>
                            ) : (
                              <Badge variant="neutral">OPTIONAL</Badge>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{f.type}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b' }}>
                            {f.aliases && f.aliases.length > 0 ? f.aliases.join(', ') : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#334155', maxWidth: '300px' }}>
                            {f.description}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#0369a1', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.example}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Validation Safeguard Rules */}
                <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '12.5px', color: '#92400e' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Validation Rules &amp; Institutional Policies:</div>
                  <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
                    {currentGuide.rules.map((rule, idx) => (
                      <li key={idx}>{rule}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Historical Bundle */}
        {activeTab === 'bundle' && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: 0 }}>
                Historical Research Felicitation Portfolio
              </h3>
              <p style={{ fontSize: '13px', color: '#737373', marginTop: '4px' }}>
                Reconciles historical research publications (207 items across Vol 2 Issue 1 &amp; 2), Scopus author identities,
                research bulletins, certificate documents, CAM-AI project showcases, active fellowship schemes, and faculty spotlights.
              </p>
            </div>

            <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
              <strong>Ecosystem Policy:</strong> All imported publications and bulletins will start in an unverified <code style={{ background: '#fef3c7', padding: '2px 4px', borderRadius: '4px' }}>draft</code> state.
              Imported authors will remain marked as <code style={{ background: '#fef3c7', padding: '2px 4px', borderRadius: '4px' }}>is_verified=False</code> (provisional) until formal institutional verification.
            </div>

            <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
              <Button
                variant="primary"
                onClick={() => handleRunBundleSimulation(true)}
                disabled={loading}
              >
                {loading ? 'Simulating...' : 'Run Historical Dry-Run Preview'}
              </Button>
            </div>
          </div>
        )}

        {/* Validation Errors Box (If preview encountered row-level validation errors) */}
        {previewResult && previewResult.errors && previewResult.errors.length > 0 && (
          <div
            data-testid="import-validation-errors"
            style={{
              background: '#ffffff',
              padding: '20px 24px',
              borderRadius: '12px',
              border: '1px solid #fecaca',
              borderLeft: '4px solid #ef4444',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                Row Validation Errors ({previewResult.errors.length})
              </h4>
              <Badge variant="saffron">Requires Attention</Badge>
            </div>
            <p style={{ fontSize: '12.5px', color: '#7f1d1d', margin: 0 }}>
              The following rows contain missing required fields or formatting issues. They will not be ingested into the repository:
            </p>
            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #fee2e2', borderRadius: '6px' }}>
              <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#fef2f2', color: '#991b1b' }}>
                  <tr>
                    <th style={{ padding: '8px 12px' }}>Row #</th>
                    <th style={{ padding: '8px 12px' }}>Field</th>
                    <th style={{ padding: '8px 12px' }}>Error Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {previewResult.errors.map((err, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #fee2e2' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>Row {err.row}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#b91c1c' }}>
                        {err.field || 'General'}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#7f1d1d' }}>{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Preview Summary Card: File Import */}
        {previewResult && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', margin: 0 }}>
                  Preview Summary: {previewResult.batch_number}
                </h4>
                <p style={{ fontSize: '12px', color: '#737373', margin: '2px 0 0 0' }}>
                  Target: {previewResult.entity_type.toUpperCase()} • Mode: {previewResult.mode.toUpperCase()} • Total Rows: {previewResult.total_rows}
                </p>
              </div>
              <Button
                variant="teal"
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={previewResult.create_count === 0 && previewResult.update_count === 0}
              >
                Execute Batch Import
              </Button>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#171717' }}>{previewResult.total_rows}</div>
                <div style={{ fontSize: '11px', color: '#737373' }}>Total Rows</div>
              </div>
              <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>{previewResult.create_count}</div>
                <div style={{ fontSize: '11px', color: '#059669' }}>To Create (Draft)</div>
              </div>
              <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{previewResult.update_count}</div>
                <div style={{ fontSize: '11px', color: '#2563eb' }}>To Update</div>
              </div>
              <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706' }}>{previewResult.review_count}</div>
                <div style={{ fontSize: '11px', color: '#d97706' }}>Conflicts / Review</div>
              </div>
              <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#737373' }}>{previewResult.skip_count}</div>
                <div style={{ fontSize: '11px', color: '#737373' }}>Skipped (Exists)</div>
              </div>
            </div>

            {/* Items Table */}
            {previewResult.items && previewResult.items.length > 0 && (
              <div style={{ overflowX: 'auto', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
                <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb', color: '#404040' }}>
                    <tr>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Action</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Identifier</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Reconciliation Reason</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.items.map((item, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #e5e5e5' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge
                            variant={
                              item.action === 'create' ? 'teal' :
                              item.action === 'update' ? 'primary' :
                              item.action === 'review' ? 'saffron' : 'neutral'
                            }
                          >
                            {item.action.toUpperCase()}
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{item.identifier}</td>
                        <td style={{ padding: '10px 12px', color: '#525252' }}>{item.reason}</td>
                        <td style={{ padding: '10px 12px', color: '#737373', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {JSON.stringify(item.record_summary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Preview Summary Card: Historical Bundle */}
        {bundlePreviewResult && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', margin: 0 }}>
                  Historical Bundle Simulation: {bundlePreviewResult.batch_number}
                </h4>
                <p style={{ fontSize: '12px', color: '#737373', margin: '2px 0 0 0' }}>
                  Source: {bundlePreviewResult.source_dir} • Mode: {bundlePreviewResult.dry_run ? 'DRY RUN (Preview)' : 'EXECUTED'}
                </p>
              </div>
              {bundlePreviewResult.dry_run && (
                <Button
                  variant="teal"
                  onClick={() => setIsConfirmModalOpen(true)}
                >
                  Execute Historical Import
                </Button>
              )}
            </div>

            {/* Breakdown by entity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {Object.entries(bundlePreviewResult.entities || {}).map(([key, val]: [string, any]) => (
                <div key={key} style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#737373' }}>{key}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#171717', marginTop: '4px' }}>
                    {val.created ?? 0} <span style={{ fontSize: '11px', fontWeight: 400, color: '#737373' }}>new</span>
                  </div>
                  {val.skipped !== undefined && (
                    <div style={{ fontSize: '11px', color: '#737373' }}>{val.skipped} skipped</div>
                  )}
                  {val.updated !== undefined && (
                    <div style={{ fontSize: '11px', color: '#2563eb' }}>{val.updated} updated</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch History Section */}
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', margin: 0 }}>
              Import Batch History ({totalBatches})
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="outline" onClick={fetchBatches} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Batch Selection / Bulk Delete Action Bar */}
          {selectedBatchIds.size > 0 && (
            <div
              data-testid="batch-bulk-actions-banner"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '10px 16px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#9f1239',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 700 }}>
                  {selectedBatchIds.size} of {totalBatches} batches selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedBatchIds(new Set())}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e11d48',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: 0,
                  }}
                >
                  Deselect All
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                style={{
                  color: isSuperAdminUser ? '#ffffff' : '#94a3b8',
                  backgroundColor: isSuperAdminUser ? '#e11d48' : '#e2e8f0',
                  borderColor: isSuperAdminUser ? '#be123c' : '#cbd5e1',
                  fontWeight: 600,
                  cursor: isSuperAdminUser ? 'pointer' : 'not-allowed',
                }}
                disabled={!isSuperAdminUser}
                onClick={() => isSuperAdminUser && setIsBatchBulkDeleteOpen(true)}
                title={
                  isSuperAdminUser
                    ? `Delete ${selectedBatchIds.size} selected import batches`
                    : 'Bulk deletion is restricted to Super Administrators only'
                }
              >
                Bulk Delete Batches ({selectedBatchIds.size})
              </Button>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              Loading batch history...
            </div>
          ) : errorMsg && batches.length === 0 ? (
            <div
              data-testid="import-error-state"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                padding: '32px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ color: '#991b1b', fontWeight: 600, fontSize: '15px' }}>
                Failed to load import batch history
              </div>
              <div style={{ color: '#64748b', fontSize: '13px' }}>{errorMsg}</div>
              <Button variant="primary" size="sm" onClick={fetchBatches}>
                Retry
              </Button>
            </div>
          ) : batches.length === 0 ? (
            <EmptyState
              title="No Import Batches Recorded"
              description="Uploaded and simulated import batches will be listed here with audit ledgers."
            />
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
              <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb', color: '#404040' }}>
                  <tr>
                    <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        aria-label="Select all batches"
                        checked={isAllBatchesSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeBatchesSelected;
                        }}
                        onChange={handleToggleSelectAllBatches}
                        style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#e11d48' }}
                      />
                    </th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Batch Number</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Entity</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Source File</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Rows</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Created</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Updated</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Skipped</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr
                      key={b.id}
                      style={{
                        borderTop: '1px solid #e5e5e5',
                        backgroundColor: selectedBatchIds.has(b.id) ? '#fff1f2' : undefined,
                      }}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          aria-label={`Select batch ${b.batch_number}`}
                          checked={selectedBatchIds.has(b.id)}
                          onChange={() => toggleSelectBatch(b.id)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#e11d48' }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{b.batch_number}</td>
                      <td style={{ padding: '10px 12px', textTransform: 'uppercase', color: '#525252' }}>{b.entity_type}</td>
                      <td style={{ padding: '10px 12px', color: '#525252' }}>{b.source_filename}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge
                          variant={
                            b.status === 'completed' ? 'teal' :
                            b.status === 'previewed' ? 'saffron' : 'neutral'
                          }
                        >
                          {b.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{b.total_rows}</td>
                      <td style={{ padding: '10px 12px', color: '#059669', fontWeight: 600 }}>{b.created_count}</td>
                      <td style={{ padding: '10px 12px', color: '#2563eb' }}>{b.updated_count}</td>
                      <td style={{ padding: '10px 12px', color: '#737373' }}>{b.skipped_count}</td>
                      <td style={{ padding: '10px 12px', color: '#737373' }}>
                        {new Date(b.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirm Batch Execution Modal */}
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirm Import Batch Execution"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', color: '#404040' }}>
            <p style={{ margin: 0 }}>
              Are you sure you want to execute this import batch into the SAMIKSHA repository?
            </p>
            <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>• <strong>Draft Protection:</strong> All publications and bulletins will be initialized in non-public <code style={{ background: '#fef3c7', padding: '1px 3px' }}>draft</code> state.</div>
              <div>• <strong>Provisional Authors:</strong> Authors will remain marked as <code style={{ background: '#fef3c7', padding: '1px 3px' }}>is_verified=False</code>.</div>
              <div>• <strong>Audit Ledger:</strong> This operation will be permanently recorded in the institutional audit log with actor ID and checksum.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
              <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="teal" onClick={handleConfirmExecute} disabled={isExecuting}>
                {isExecuting ? 'Executing...' : 'Confirm & Execute Import'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Confirm Bulk Delete Batches Modal */}
        {isBatchBulkDeleteOpen && (
          <Modal
            isOpen={isBatchBulkDeleteOpen}
            onClose={() => !isDeletingBatches && setIsBatchBulkDeleteOpen(false)}
            title={`Confirm Bulk Deletion (${selectedBatchIds.size} Batches)`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13.5px', color: '#475569' }}>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#9f1239',
                  lineHeight: 1.5,
                }}
              >
                <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>Institutional Action Notice:</p>
                You are about to permanently delete <strong>{selectedBatchIds.size}</strong> import batch ledger records from the SAMIKSHA system.
                This deletes the batch audit record and reconciliation log. Any records already created in draft status remain in the repository.
              </div>

              <p style={{ margin: 0 }}>
                Are you sure you want to proceed with deleting <strong>{selectedBatchIds.size}</strong> import batch history entries?
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBatchBulkDeleteOpen(false)}
                  disabled={isDeletingBatches}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ color: '#ffffff', backgroundColor: '#e11d48', borderColor: '#be123c', fontWeight: 600 }}
                  onClick={handleBulkDeleteBatchesSubmit}
                  disabled={isDeletingBatches}
                >
                  {isDeletingBatches ? 'Deleting...' : `Delete ${selectedBatchIds.size} Batches`}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
};
