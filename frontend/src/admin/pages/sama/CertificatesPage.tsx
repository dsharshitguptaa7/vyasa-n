import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppIcon, Button, Badge, Modal, Input, Select, EmptyState, LoadingState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { useAuth } from '../../../context/AuthContext';
import { samaAdminService } from '../../services/samaAdminService';
import type {
  CertificateRecord,
  AuthorRecord,
  BulletinRecord,
  PublicationRecord,
  CertificateStatsRecord,
  CertificateTemplateItem,
  CertificateSignatoryItem,
  CertificateAuthorItem,
  CreateTemplatePayload,
  CreateSignatoryPayload,
  BulkVerifyCertificatesResponse,
  CertificateVerificationItem,
} from '../../types/sama';
import { isHistoricalCertificate } from '../../types/sama';
import { BulkOperationsSection } from './BulkOperationsSection';

type TabKey = 'ledger' | 'approvals' | 'bulk_operations' | 'designer' | 'templates' | 'signatories' | 'verification';

export const CertificatesPage: React.FC = () => {
  const { user, isSuperAdmin: authSuperAdmin } = useAuth();
  const isSuperAdmin = authSuperAdmin || Boolean(user?.roles?.includes('super_admin'));

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabKey>('ledger');

  // Stats
  const [stats, setStats] = useState<CertificateStatsRecord>({
    total_certificates: 0,
    draft_certificates: 0,
    pending_approvals: 0,
    issued_certificates: 0,
    revoked_certificates: 0,
    reissued_certificates: 0,
    total_researchers_linked: 0,
  });

  // Certificate Ledger State
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Search (Issued Ledger)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issued' | 'scheduled' | 'revoked' | 'superseded' | 'archived' | 'historical'>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'active' | 'historical'>('all');
  const [page, setPage] = useState(1);
  const limit = 12;

  // Dedicated Approval Queue State
  const [approvalCertificates, setApprovalCertificates] = useState<CertificateRecord[]>([]);
  const [approvalTotalCount, setApprovalTotalCount] = useState(0);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalSearch, setApprovalSearch] = useState('');
  const [approvalStageFilter, setApprovalStageFilter] = useState<'all' | 'DEAN' | 'VC'>('all');
  const [approvalPage, setApprovalPage] = useState(1);
  const approvalLimit = 10;

  // Auxiliary Reference Data
  const [authors, setAuthors] = useState<AuthorRecord[]>([]);
  const [bulletins, setBulletins] = useState<BulletinRecord[]>([]);
  const [publications, setPublications] = useState<PublicationRecord[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplateItem[]>([]);
  const [signatories, setSignatories] = useState<CertificateSignatoryItem[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(false);
  const [refDataError, setRefDataError] = useState<string | null>(null);

  // Action states
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Modals state
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showReissueModal, setShowReissueModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsCert, setDetailsCert] = useState<CertificateRecord | null>(null);
  const [rescheduleCert, setRescheduleCert] = useState<CertificateRecord | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSignatoryModal, setShowSignatoryModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);

  // Bulk Selection & Deletion State
  const [selectedCertIds, setSelectedCertIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showSingleDeleteModal, setShowSingleDeleteModal] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<CertificateRecord | null>(null);
  const [singleDeleteReason, setSingleDeleteReason] = useState('');
  const [isSingleDeleting, setIsSingleDeleting] = useState(false);

  // Historical Recovery Metadata & PDF Repair State
  const [showEditRecoveryModal, setShowEditRecoveryModal] = useState(false);
  const [recoveryTargetCert, setRecoveryTargetCert] = useState<CertificateRecord | null>(null);
  const [recoveryRecipientName, setRecoveryRecipientName] = useState('');
  const [recoveryScopusId, setRecoveryScopusId] = useState('');
  const [recoveryResearchTitle, setRecoveryResearchTitle] = useState('');
  const [recoveryDepartment, setRecoveryDepartment] = useState('');
  const [recoveryPublicationDetails, setRecoveryPublicationDetails] = useState('');
  const [recoveryIssueReference, setRecoveryIssueReference] = useState('');
  const [recoveryStorageKey, setRecoveryStorageKey] = useState('');
  const [recoveryOriginalFilename, setRecoveryOriginalFilename] = useState('');
  const [isSavingRecovery, setIsSavingRecovery] = useState(false);
  const [recoveryModalError, setRecoveryModalError] = useState<string | null>(null);
  const [recoveryModalSuccess, setRecoveryModalSuccess] = useState<string | null>(null);

  // PDF Testing state
  const [isTestingPdf, setIsTestingPdf] = useState(false);
  const [pdfTestResult, setPdfTestResult] = useState<{
    status: 'found' | 'missing' | 'error';
    message: string;
    provider?: string | null;
    file_size_bytes?: number | null;
    storage_key?: string | null;
    exists?: boolean;
  } | null>(null);

  // Restoration State
  const [showBulkRestoreModal, setShowBulkRestoreModal] = useState(false);
  const [bulkRestoreReason, setBulkRestoreReason] = useState('');
  const [isBulkRestoring, setIsBulkRestoring] = useState(false);
  const [showSingleRestoreModal, setShowSingleRestoreModal] = useState(false);
  const [singleRestoreTarget, setSingleRestoreTarget] = useState<CertificateRecord | null>(null);
  const [singleRestoreReason, setSingleRestoreReason] = useState('');
  const [isSingleRestoring, setIsSingleRestoring] = useState(false);

  // Bulk Verification State
  const [verifyInputMode, setVerifyInputMode] = useState<'TEXT' | 'CSV'>('TEXT');
  const [verifyRawText, setVerifyRawText] = useState('');
  const [verifyCsvFile, setVerifyCsvFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<BulkVerifyCertificatesResponse | null>(null);
  const [verifySearchQuery, setVerifySearchQuery] = useState('');
  const [verifyStatusFilter, setVerifyStatusFilter] = useState('ALL');

  // Revoke state
  const [revocationReason, setRevocationReason] = useState('');

  // Reissue state
  const [reissueReason, setReissueReason] = useState('');
  const [reissueTitle, setReissueTitle] = useState('');
  const [reissueResearchTitle, setReissueResearchTitle] = useState('');

  // Approval state
  const [approvalAuthority, setApprovalAuthority] = useState<'DEAN_RD' | 'VICE_CHANCELLOR'>('DEAN_RD');
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [approvalRemarks, setApprovalRemarks] = useState('');

  // Designer State
  const [designerTitle, setDesignerTitle] = useState('Certificate of Appreciation & Research Excellence');
  const [designerPresentation, setDesignerPresentation] = useState('This certificate is proudly conferred upon');
  const [designerContribution, setDesignerContribution] = useState('in recognition of scholarly research publication in:');
  const [designerResearchTitle, setDesignerResearchTitle] = useState(
    'Exploring the dielectric, supercapacitor and photocatalytic capabilities of sol-gel synthesized TiC nanoparticles'
  );
  const [designerCongratulatory, setDesignerCongratulatory] = useState(
    'The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.'
  );
  const [designerAuthors] = useState<CertificateAuthorItem[]>([
    {
      author_name_snapshot: 'Dr. Akhilesh Kumar',
      academic_title_snapshot: 'Dr.',
      department_snapshot: 'Department of Physics',
      scopus_id_snapshot: '57211512345',
      affiliation_snapshot: 'CSJM University, Kanpur',
      author_order: 1,
      author_role: 'First Author',
    },
    {
      author_name_snapshot: 'Dr. Anju Dixit',
      academic_title_snapshot: 'Dr.',
      department_snapshot: 'Department of Chemistry',
      scopus_id_snapshot: '57200192834',
      affiliation_snapshot: 'CSJM University, Kanpur',
      author_order: 2,
      author_role: 'Corresponding Author',
    },
  ]);
  const [designerBorderColor, setDesignerBorderColor] = useState('#B2811A');
  const [designerAccentColor, setDesignerAccentColor] = useState('#6B1D2F');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);

  // Create Wizard State
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardCategory, setWizardCategory] = useState<'RESEARCH_PUBLICATION' | 'INCENTIVE_AWARD'>('RESEARCH_PUBLICATION');
  const [wizardTemplateId, setWizardTemplateId] = useState('');
  const [wizardTitle, setWizardTitle] = useState('Certificate of Appreciation & Research Excellence');
  const [wizardPresentation, setWizardPresentation] = useState('This certificate is proudly conferred upon');
  const [wizardContribution, setWizardContribution] = useState('in recognition of scholarly research publication in:');
  const [wizardResearchTitle, setWizardResearchTitle] = useState('');
  const [wizardCongratulatory, setWizardCongratulatory] = useState(
    'The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.'
  );
  const [wizardBulletinVolume, setWizardBulletinVolume] = useState<string>('');
  const [wizardBulletinId, setWizardBulletinId] = useState('');
  const [wizardIncentiveAmount, setWizardIncentiveAmount] = useState<string>('');
  const [wizardSanctionRef, setWizardSanctionRef] = useState<string>('');
  const [wizardPublicationId, setWizardPublicationId] = useState('');
  const [wizardAuthors, setWizardAuthors] = useState<CertificateAuthorItem[]>([]);
  const [wizardIssueDate, setWizardIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [wizardSubmitMode, setWizardSubmitMode] = useState<'APPROVAL' | 'DIRECT' | 'DRAFT'>('APPROVAL');
  const [wizardDirectJustification, setWizardDirectJustification] = useState('');

  // Manual Certificate Number & Verification Identifier Overrides
  const [wizardCertNumber, setWizardCertNumber] = useState('');
  const [wizardVerificationId, setWizardVerificationId] = useState('');
  const [wizardVerificationUrlPreview, setWizardVerificationUrlPreview] = useState('');
  const [wizardUrlExtractionNotice, setWizardUrlExtractionNotice] = useState<string | null>(null);

  const handleVerificationIdChange = (inputVal: string) => {
    let cleanVal = inputVal.trim();
    setWizardUrlExtractionNotice(null);

    // If a full verification URL is pasted, extract the identifier
    if (cleanVal.includes('://') || cleanVal.startsWith('/')) {
      const urlPattern = /^(?:https?:\/\/[^\/]+)?(?:\/api)?(?:\/modules\/sama-veda)?\/(?:certificates\/)?verify\/([a-zA-Z0-9_\-]+)\/?$/i;
      const match = cleanVal.match(urlPattern);
      if (match && match[1]) {
        cleanVal = match[1];
        setWizardUrlExtractionNotice(`Extracted verification identifier: "${cleanVal}" from pasted URL.`);
      } else {
        setWizardUrlExtractionNotice('Warning: Pasted URL does not match the expected application verification route (/verify/{identifier}).');
      }
    }

    setWizardVerificationId(cleanVal);

    if (cleanVal) {
      const baseUrl = window.location.origin;
      setWizardVerificationUrlPreview(`${baseUrl}/verify/${cleanVal}`);
    } else {
      setWizardVerificationUrlPreview('');
    }
  };

  // Live Vector PDF Preview State
  const [wizardPreviewBlobUrl, setWizardPreviewBlobUrl] = useState<string | null>(null);
  const [renderingWizardPreview, setRenderingWizardPreview] = useState(false);
  const [showWizardPreviewModal, setShowWizardPreviewModal] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // Wizard Author Picker & Search-as-you-type
  const [searchAuthorQuery, setSearchAuthorQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AuthorRecord[]>([]);
  const [isSearchingAuthors, setIsSearchingAuthors] = useState(false);
  const [selectedDirectoryAuthorTitle, setSelectedDirectoryAuthorTitle] = useState('None');
  const [selectedDirectoryAuthorRole, setSelectedDirectoryAuthorRole] = useState('Co-Author');
  const [manualAuthorName, setManualAuthorName] = useState('');
  const [manualAuthorTitle, setManualAuthorTitle] = useState('None');
  const [manualAuthorDept, setManualAuthorDept] = useState('');
  const [manualAuthorScopusId, setManualAuthorScopusId] = useState('');
  const [manualAuthorRole, setManualAuthorRole] = useState('Co-Author');
  const [manualAuthorAffiliation, setManualAuthorAffiliation] = useState('');

  // Template Modal State
  const [templateForm, setTemplateForm] = useState<CreateTemplatePayload>({
    code: '',
    name: '',
    description: '',
    certificate_type: 'RESEARCH_PUBLICATION',
    orientation: 'LANDSCAPE',
  });

  // Signatory Modal State
  const [signatoryForm, setSignatoryForm] = useState<CreateSignatoryPayload>({
    authority_type: 'DEAN_RD',
    signatory_name: '',
    designation: '',
    department: 'CSJMU, Kanpur',
  });
  const [signatureUploadFile, setSignatureUploadFile] = useState<File | null>(null);

  // Enhanced Signatory Management State
  const [editingSignatoryId, setEditingSignatoryId] = useState<string | null>(null);
  const [showUploadSignatureModal, setShowUploadSignatureModal] = useState(false);
  const [selectedSignatoryForUpload, setSelectedSignatoryForUpload] = useState<CertificateSignatoryItem | null>(null);
  const [signaturePreviewSignatory, setSignaturePreviewSignatory] = useState<CertificateSignatoryItem | null>(null);
  const [deleteSignatoryTarget, setDeleteSignatoryTarget] = useState<CertificateSignatoryItem | null>(null);
  const [signatureFilePreviewUrl, setSignatureFilePreviewUrl] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  const fetchStats = async () => {
    try {
      const data = await samaAdminService.getCertificateStats();
      setStats(data);
    } catch (err) {
      console.warn('Failed to fetch certificate statistics', err);
    }
  };

  const fetchCertificates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let isRevokedParam: boolean | undefined = undefined;
      let statusParam: string | undefined = undefined;
      let scopeParam: 'ledger' | undefined = undefined;
      let originParam: 'all' | 'active' | 'historical' | undefined = originFilter;

      if (statusFilter === 'all') {
        scopeParam = originParam === 'historical' ? undefined : 'ledger';
      } else if (statusFilter === 'revoked') {
        isRevokedParam = true;
      } else if (statusFilter === 'issued') {
        statusParam = 'ISSUED';
        isRevokedParam = false;
      } else if (statusFilter === 'scheduled') {
        statusParam = 'SCHEDULED';
      } else if (statusFilter === 'superseded') {
        statusParam = 'SUPERSEDED';
      } else if (statusFilter === 'archived') {
        statusParam = 'ARCHIVED';
      } else if (statusFilter === 'historical') {
        originParam = 'historical';
        statusParam = undefined;
        scopeParam = undefined;
      }

      if (originParam === 'historical') {
        scopeParam = undefined;
      }

      const res = await samaAdminService.getCertificates({
        skip: (page - 1) * limit,
        limit,
        search: search.trim() || undefined,
        is_revoked: isRevokedParam,
        status: statusParam,
        scope: scopeParam,
        origin: originParam,
      });

      setCertificates(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, originFilter]);

  const fetchApprovalQueue = useCallback(async () => {
    try {
      setApprovalLoading(true);
      setApprovalError(null);

      const res = await samaAdminService.getCertificates({
        scope: 'approvals',
        approval_stage: approvalStageFilter !== 'all' ? approvalStageFilter : undefined,
        skip: (approvalPage - 1) * approvalLimit,
        limit: approvalLimit,
        search: approvalSearch.trim() || undefined,
      });

      setApprovalCertificates(res.items);
      setApprovalTotalCount(res.total);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setApprovalError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to load approval queue');
    } finally {
      setApprovalLoading(false);
    }
  }, [approvalPage, approvalSearch, approvalStageFilter]);

  const loadReferenceData = useCallback(async () => {
    try {
      setRefDataLoading(true);
      setRefDataError(null);
      const [authRes, bullRes, pubRes, tplRes, sigRes] = await Promise.all([
        samaAdminService.getAuthors({ limit: 250 }),
        samaAdminService.getBulletins({ limit: 100 }),
        samaAdminService.getPublications({ limit: 100 }),
        samaAdminService.getTemplates({ limit: 50 }),
        samaAdminService.getSignatories({ limit: 50 }),
      ]);
      setAuthors(authRes.items);
      setBulletins(bullRes.items);
      setPublications(pubRes.items);
      setTemplates(tplRes.items);
      setSignatories(sigRes.items);
      if (tplRes.items.length > 0) {
        setWizardTemplateId(tplRes.items[0].id);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to load reference data';
      setRefDataError(msg);
      console.warn('Failed to load auxiliary data', err);
    } finally {
      setRefDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
    fetchStats();
  }, [fetchCertificates]);

  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchApprovalQueue();
    }
  }, [activeTab, fetchApprovalQueue]);

  useEffect(() => {
    loadReferenceData();
  }, []);

  // ---------------------------------------------------------------------------
  // Designer & Preview Actions
  // ---------------------------------------------------------------------------
  const handleRenderDesignerPreview = async () => {
    try {
      setRenderingPreview(true);
      setError(null);
      const blob = await samaAdminService.previewCertificate({
        title: designerTitle,
        presentation_statement: designerPresentation,
        research_contribution_statement: designerContribution,
        research_title: designerResearchTitle,
        congratulatory_statement: designerCongratulatory,
        authors: designerAuthors,
        config_overrides: {
          primary_border_color: designerBorderColor,
          accent_color: designerAccentColor,
        },
      });

      if (previewPdfUrl) {
        window.URL.revokeObjectURL(previewPdfUrl);
      }
      const newUrl = window.URL.createObjectURL(blob);
      setPreviewPdfUrl(newUrl);
      setSuccessMessage('High-resolution vector certificate rendered.');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to render live vector preview');
    } finally {
      setRenderingPreview(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Wizard Actions
  // ---------------------------------------------------------------------------
  const handleOpenWizard = () => {
    setWizardStep(1);
    setWizardCategory('RESEARCH_PUBLICATION');
    setWizardTitle('Certificate of Appreciation & Research Excellence');
    setWizardPresentation('This certificate is proudly conferred upon');
    setWizardContribution('in recognition of scholarly research publication in:');
    setWizardResearchTitle('');
    setWizardCongratulatory(
      'The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.'
    );
    setWizardBulletinVolume('');
    setWizardBulletinId('');
    setWizardIncentiveAmount('');
    setWizardSanctionRef('');
    setWizardPublicationId('');
    setWizardAuthors([]);
    setSelectedDirectoryAuthorTitle('None');
    setSelectedDirectoryAuthorRole('Co-Author');
    setManualAuthorTitle('None');
    setManualAuthorName('');
    setManualAuthorDept('');
    setManualAuthorScopusId('');
    setManualAuthorAffiliation('');
    setWizardIssueDate(new Date().toISOString().split('T')[0]);
    setWizardSubmitMode('APPROVAL');
    setWizardDirectJustification('');
    setWizardCertNumber('');
    setWizardVerificationId('');
    setWizardVerificationUrlPreview('');
    setWizardUrlExtractionNotice(null);
    setSearchAuthorQuery('');
    setSearchResults([]);
    setIsSearchingAuthors(false);
    const defaultTpl = templates.find((t) => t.is_default || t.certificate_type === 'RESEARCH_PUBLICATION');
    setWizardTemplateId(defaultTpl?.id || templates[0]?.id || '');
    setShowWizardModal(true);
  };

  const handleSwitchWizardCategory = (cat: 'RESEARCH_PUBLICATION' | 'INCENTIVE_AWARD') => {
    setWizardCategory(cat);
    if (cat === 'INCENTIVE_AWARD') {
      const incTpl = templates.find(
        (t) => t.code === 'DEFAULT_CSJMU_INCENTIVE_A4' || t.certificate_type === 'INCENTIVE_AWARD'
      );
      if (incTpl) setWizardTemplateId(incTpl.id);
      setWizardTitle('Certificate of Appreciation for Research Publication');
      setWizardPresentation('This certificate is proudly awarded to');
      setWizardContribution(
        'in recognition of distinguished research productivity and scholarly impact under the University Publication Incentive Policy for the work titled:'
      );
      setWizardCongratulatory(
        'The University commends the meritorious scholarly productivity, research excellence, and exemplary intellectual dedication to advancing scientific innovation.'
      );
    } else {
      const pubTpl = templates.find(
        (t) => t.code === 'DEFAULT_CSJMU_A4' || t.certificate_type === 'RESEARCH_PUBLICATION' || t.is_default
      );
      if (pubTpl) setWizardTemplateId(pubTpl.id);
      setWizardTitle('Certificate of Appreciation for Research Publication');
      setWizardPresentation('This certificate is proudly conferred upon');
      setWizardContribution('in recognition of scholarly research publication in:');
      setWizardCongratulatory(
        'The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.'
      );
    }
  };

  const handleSelectBulletinVolume = (volStr: string) => {
    setWizardBulletinVolume(volStr);
    if (!volStr) {
      setWizardBulletinId('');
      return;
    }
    const volNum = parseInt(volStr, 10);
    const matchingIssues = bulletins.filter((b) => (b.volume_number || b.volume) === volNum);
    if (matchingIssues.length === 1) {
      setWizardBulletinId(matchingIssues[0].id);
    } else if (!matchingIssues.some((b) => b.id === wizardBulletinId)) {
      setWizardBulletinId('');
    }
  };

  // Debounced live search against Institutional Directory
  useEffect(() => {
    const q = searchAuthorQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearchingAuthors(false);
      return;
    }

    setIsSearchingAuthors(true);
    const timer = setTimeout(async () => {
      try {
        const res = await samaAdminService.getAuthors({ search: q, limit: 50 });
        setSearchResults(res.items || []);
      } catch (err) {
        console.error('Failed to search institutional directory:', err);
      } finally {
        setIsSearchingAuthors(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchAuthorQuery]);

  // Combined Directory Authors: server results prioritized + fast token-based local fallback
  const displayedDirectoryAuthors = useMemo(() => {
    const q = searchAuthorQuery.trim().toLowerCase();
    if (!q) return [];

    const rawTokens = q.split(/\s+/).filter(Boolean);
    const honorifics = new Set(['prof.', 'prof', 'dr.', 'dr', 'mr.', 'mr', 'ms.', 'ms', 'mrs.', 'mrs', 'er.', 'er', 'shri', 'smt']);
    const substantiveTokens = rawTokens.filter((t) => !honorifics.has(t.toLowerCase()));
    const tokens = substantiveTokens.length > 0 ? substantiveTokens : rawTokens;

    // Fast local matching for instant typing feedback
    const localMatches = authors.filter((a) => {
      const name = a.full_name.toLowerCase();
      const dept = (a.department || '').toLowerCase();
      const scopus = (a.scopus_id || '').toLowerCase();
      return tokens.every((tok) => name.includes(tok) || dept.includes(tok) || scopus.includes(tok));
    });

    // Merge server search results (which query the entire directory) with local matches
    const map = new Map<string, AuthorRecord>();
    searchResults.forEach((a) => map.set(a.id, a));
    localMatches.forEach((a) => {
      if (!map.has(a.id)) {
        map.set(a.id, a);
      }
    });
    return Array.from(map.values());
  }, [searchAuthorQuery, searchResults, authors]);

  const handleAddAuthorFromDirectory = (authorRecord: AuthorRecord) => {
    if (!authorRecord) return;

    if (wizardAuthors.some((a) => a.researcher_id === authorRecord.id)) {
      setError(`Researcher "${authorRecord.full_name}" is already included on this certificate.`);
      return;
    }

    if (authorRecord.scopus_id) {
      const conflict = wizardAuthors.find((a) => a.scopus_id_snapshot === authorRecord.scopus_id);
      if (conflict) {
        setError(`Notice: Scopus ID "${authorRecord.scopus_id}" is already assigned to "${conflict.author_name_snapshot}".`);
      }
    }

    const assignedRole = wizardAuthors.length === 0 ? 'First Author' : selectedDirectoryAuthorRole || 'Co-Author';
    const assignedTitle = selectedDirectoryAuthorTitle && selectedDirectoryAuthorTitle !== 'None' ? selectedDirectoryAuthorTitle : null;
    const newAuthor: CertificateAuthorItem = {
      researcher_id: authorRecord.id,
      author_name_snapshot: authorRecord.full_name,
      academic_title_snapshot: assignedTitle,
      department_snapshot: authorRecord.department || 'Department of Research',
      scopus_id_snapshot: authorRecord.scopus_id || null,
      affiliation_snapshot: authorRecord.institutional_affiliation || 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
      author_order: wizardAuthors.length + 1,
      author_role: assignedRole,
    };

    setWizardAuthors([...wizardAuthors, newAuthor]);
    setSearchAuthorQuery('');
    setSearchResults([]);
    setIsSearchingAuthors(false);
    setError(null);
  };

  const handleAddManualAuthor = () => {
    if (!manualAuthorName.trim()) {
      setError('Author full legal name is required.');
      return;
    }

    let cleanName = manualAuthorName.trim();
    const prefixes = ['Dr.', 'Prof.', 'Mr.', 'Ms.', 'Mrs.', 'Er.', 'Dr', 'Prof', 'Mr', 'Ms', 'Mrs', 'Er'];
    for (const p of prefixes) {
      if (cleanName.toLowerCase().startsWith(p.toLowerCase() + ' ')) {
        cleanName = cleanName.slice(p.length).trim();
        break;
      }
    }

    const newAuthor: CertificateAuthorItem = {
      researcher_id: null,
      author_name_snapshot: cleanName,
      academic_title_snapshot: manualAuthorTitle && manualAuthorTitle !== 'None' ? manualAuthorTitle : null,
      department_snapshot: manualAuthorDept.trim() || 'Department of Research',
      scopus_id_snapshot: manualAuthorScopusId.trim() || null,
      affiliation_snapshot: manualAuthorAffiliation.trim() || 'External Collaborator / Independent Researcher',
      author_order: wizardAuthors.length + 1,
      author_role: manualAuthorRole || (wizardAuthors.length === 0 ? 'First Author' : 'Co-Author'),
    };

    setWizardAuthors([...wizardAuthors, newAuthor]);
    setManualAuthorName('');
    setManualAuthorTitle('None');
    setManualAuthorDept('');
    setManualAuthorScopusId('');
    setManualAuthorAffiliation('');
    setError(null);
  };

  const handleRemoveWizardAuthor = (idx: number) => {
    const updated = wizardAuthors.filter((_, i) => i !== idx).map((a, i) => ({ ...a, author_order: i + 1 }));
    setWizardAuthors(updated);
  };

  const handleMoveWizardAuthor = (idx: number, direction: 'UP' | 'DOWN') => {
    const newIdx = direction === 'UP' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= wizardAuthors.length) return;
    const copy = [...wizardAuthors];
    const temp = copy[idx];
    copy[idx] = copy[newIdx];
    copy[newIdx] = temp;
    setWizardAuthors(copy.map((a, i) => ({ ...a, author_order: i + 1 })));
  };

  const handleSelectPublicationForWizard = (pubId: string) => {
    setWizardPublicationId(pubId);
    const pub = publications.find((p) => p.id === pubId);
    if (pub) {
      setWizardResearchTitle(pub.title);
      if (pub.bulletin_id) {
        setWizardBulletinId(pub.bulletin_id);
      }
    }
  };

  const handleGenerateWizardPreview = async () => {
    if (!wizardBulletinId) {
      setError('Please select an official Research Bulletin edition (Volume and Issue) before previewing.');
      return;
    }
    if (wizardAuthors.length === 0) {
      setError('Please add at least one recipient author before generating a vector preview.');
      return;
    }
    try {
      setRenderingWizardPreview(true);
      setError(null);
      const incDetails = wizardCategory === 'INCENTIVE_AWARD' ? {
        incentive_amount: wizardIncentiveAmount.trim() || undefined,
        sanction_order: wizardSanctionRef.trim() || undefined,
      } : undefined;

      const blob = await samaAdminService.previewCertificate({
        title: wizardTitle,
        certificate_type: wizardCategory,
        presentation_statement: wizardPresentation,
        research_contribution_statement: wizardContribution,
        research_title: wizardResearchTitle || (wizardCategory === 'INCENTIVE_AWARD' ? 'Distinguished Research Publication Incentive Achievement' : 'Exploring the dielectric, supercapacitor and photocatalytic capabilities of sol-gel synthesized TiC nanoparticles'),
        congratulatory_statement: wizardCongratulatory,
        template_id: wizardTemplateId || null,
        bulletin_id: wizardBulletinId || null,
        publication_details: incDetails,
        issue_date: wizardIssueDate || undefined,
        authors: wizardAuthors,
        certificate_number: wizardCertNumber.trim() || undefined,
        verification_token: wizardVerificationId.trim() || undefined,
        verification_identifier: wizardVerificationId.trim() || undefined,
      });

      if (wizardPreviewBlobUrl) {
        URL.revokeObjectURL(wizardPreviewBlobUrl);
      }
      const newUrl = URL.createObjectURL(blob);
      setWizardPreviewBlobUrl(newUrl);
      setShowWizardPreviewModal(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to render PDF vector preview');
    } finally {
      setRenderingWizardPreview(false);
    }
  };

  const handleSubmitWizard = async () => {
    if (!wizardBulletinId) {
      setError('Research Bulletin selection is mandatory. Please select an official Bulletin Volume and Issue.');
      return;
    }
    if (wizardAuthors.length === 0) {
      setError('Please add at least one recipient author.');
      return;
    }
    if (!wizardResearchTitle.trim()) {
      setError('Research paper / publication title is required.');
      return;
    }
    if (wizardSubmitMode === 'DIRECT') {
      if (wizardDirectJustification.trim().length < 10) {
        setError('Direct official issuance requires a mandatory institutional justification (minimum 10 characters).');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      const submitForApproval = wizardSubmitMode === 'APPROVAL';
      const incDetails = wizardCategory === 'INCENTIVE_AWARD' ? {
        incentive_amount: wizardIncentiveAmount.trim() || undefined,
        sanction_order: wizardSanctionRef.trim() || undefined,
      } : undefined;

      const created = await samaAdminService.issueCertificate({
        template_id: wizardTemplateId || undefined,
        certificate_type: wizardCategory,
        title: wizardTitle,
        presentation_statement: wizardPresentation,
        research_contribution_statement: wizardContribution,
        research_title: wizardResearchTitle,
        congratulatory_statement: wizardCongratulatory,
        bulletin_id: wizardBulletinId,
        publication_id: wizardPublicationId || undefined,
        publication_details: incDetails,
        issue_date: wizardIssueDate || undefined,
        authors: wizardAuthors,
        submit_for_approval: submitForApproval,
        direct_issue_justification: wizardSubmitMode === 'DIRECT' ? wizardDirectJustification.trim() : undefined,
        certificate_number: wizardCertNumber.trim() || undefined,
        verification_identifier: wizardVerificationId.trim() || undefined,
        verification_token: wizardVerificationId.trim() || undefined,
      });

      setSuccessMessage(
        created.status === 'SCHEDULED'
          ? `Certificate ${created.certificate_number} scheduled for activation on ${created.scheduled_issue_date}. It remains hidden from public verification until that date.`
          : submitForApproval
          ? `Certificate ${created.certificate_number} created and submitted for Dean – R&D approval.`
          : `Certificate ${created.certificate_number} officially issued via authorized direct seal.`
      );
      setShowWizardModal(false);
      fetchCertificates();
      fetchApprovalQueue();
      fetchStats();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to issue certificate');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Approval Actions
  // ---------------------------------------------------------------------------
  const handleOpenApprovalModal = (cert: CertificateRecord, authority: 'DEAN_RD' | 'VICE_CHANCELLOR') => {
    setSelectedCert(cert);
    setApprovalAuthority(authority);
    setApprovalAction('APPROVE');
    setApprovalRemarks('');
    setShowApprovalModal(true);
  };

  const handleSubmitApproval = async () => {
    if (!selectedCert) return;
    if (approvalAction === 'REJECT' && !approvalRemarks.trim()) {
      setError('Rejection remarks are mandatory.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await samaAdminService.approveCertificate(
        selectedCert.id,
        approvalAuthority,
        approvalAction,
        approvalRemarks.trim()
      );

      setSuccessMessage(
        approvalAction === 'APPROVE'
          ? `Approval successfully registered by ${approvalAuthority === 'DEAN_RD' ? 'Dean – R&D' : 'Vice Chancellor'}.`
          : `Certificate review returned with feedback.`
      );
      setShowApprovalModal(false);
      setSelectedCert(null);
      fetchCertificates();
      fetchApprovalQueue();
      fetchStats();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Approval action failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Revocation & Reissuance Actions
  // ---------------------------------------------------------------------------
  const handleOpenRevoke = (cert: CertificateRecord) => {
    setSelectedCert(cert);
    setRevocationReason('');
    setShowRevokeModal(true);
  };

  const handleSubmitRevocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCert) return;
    if (revocationReason.trim().length < 5) {
      setError('Revocation reason must be at least 5 characters with official audit rationale.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await samaAdminService.revokeCertificate(selectedCert.id, {
        revocation_reason: revocationReason.trim(),
      });

      setSuccessMessage(`Certificate ${selectedCert.certificate_number} permanently revoked.`);
      setShowRevokeModal(false);
      setSelectedCert(null);
      fetchCertificates();
      fetchStats();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to revoke certificate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReissue = (cert: CertificateRecord) => {
    setSelectedCert(cert);
    setReissueReason('');
    setReissueTitle(cert.title || 'Certificate of Appreciation & Research Excellence');
    setReissueResearchTitle(cert.research_title || '');
    setShowReissueModal(true);
  };

  const handleSubmitReissue = async () => {
    if (!selectedCert) return;
    if (reissueReason.trim().length < 5) {
      setError('Reissue explanation must be at least 5 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const reissued = await samaAdminService.reissueCertificate(selectedCert.id, {
        reissue_reason: reissueReason.trim(),
        updated_title: reissueTitle.trim() || undefined,
        updated_research_title: reissueResearchTitle.trim() || undefined,
      });

      setSuccessMessage(
        `Original certificate superseded. New official replacement ${reissued.certificate_number} generated.`
      );
      setShowReissueModal(false);
      setSelectedCert(null);
      fetchCertificates();
      fetchStats();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to reissue certificate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReschedule = (cert: CertificateRecord) => {
    setRescheduleCert(cert);
    setRescheduleDate(cert.scheduled_issue_date || (cert.issued_at ? cert.issued_at.split('T')[0] : new Date().toISOString().split('T')[0]));
    setShowRescheduleModal(true);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleCert || !rescheduleDate) return;
    try {
      setRescheduling(true);
      setError(null);
      await samaAdminService.rescheduleCertificate(rescheduleCert.id, rescheduleDate);
      setSuccessMessage(`Certificate ${rescheduleCert.certificate_number} scheduled Date of Issue updated to ${rescheduleDate}.`);
      setShowRescheduleModal(false);
      setRescheduleCert(null);
      fetchCertificates();
      fetchStats();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to reschedule certificate');
    } finally {
      setRescheduling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PDF Download & Public Verification Link
  // ---------------------------------------------------------------------------
  const handleDownload = async (cert: CertificateRecord) => {
    try {
      setDownloadingId(cert.id);
      setError(null);
      await samaAdminService.downloadCertificate(
        cert.id,
        `${cert.certificate_number.split('/').join('_')}.pdf`
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to download certificate PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyVerificationUrl = (cert: CertificateRecord) => {
    const token = cert.verification_token || cert.certificate_number;
    const url = `${window.location.origin}/verify/${encodeURIComponent(token)}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setSuccessMessage(`Public verification URL copied to clipboard: ${url}`);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  // ---------------------------------------------------------------------------
  // Historical Recovery Metadata & Storage Repair Handlers
  // ---------------------------------------------------------------------------
  const handleOpenEditRecoveryMetadata = (cert: CertificateRecord) => {
    setRecoveryTargetCert(cert);
    const pubMeta = (cert.publication_details || {}) as Record<string, any>;
    const firstAuthor = cert.authors && cert.authors[0];

    setRecoveryRecipientName(
      cert.recipient_name || firstAuthor?.author_name_snapshot || ''
    );
    setRecoveryScopusId(
      cert.scopus_id || pubMeta.scopus_id || firstAuthor?.scopus_id_snapshot || ''
    );
    setRecoveryResearchTitle(cert.research_title || '');
    setRecoveryDepartment(
      cert.department || pubMeta.department || firstAuthor?.department_snapshot || ''
    );
    setRecoveryPublicationDetails(
      typeof pubMeta.publication_details === 'string'
        ? pubMeta.publication_details
        : pubMeta.publication_details ? JSON.stringify(pubMeta.publication_details) : ''
    );
    setRecoveryIssueReference(
      cert.issue_reference || pubMeta.issue_reference || ''
    );
    setRecoveryStorageKey(
      cert.storage_key || pubMeta.storage_key || cert.file_storage_path || ''
    );
    setRecoveryOriginalFilename(
      cert.original_filename || pubMeta.original_filename || ''
    );
    setRecoveryModalError(null);
    setRecoveryModalSuccess(null);
    setPdfTestResult(null);
    setShowEditRecoveryModal(true);
  };

  const handleTestPdfAvailability = async () => {
    if (!recoveryTargetCert) return;
    setIsTestingPdf(true);
    setPdfTestResult(null);
    setRecoveryModalError(null);
    try {
      const res = await samaAdminService.testPdfAvailability(
        recoveryTargetCert.id,
        recoveryStorageKey.trim() || undefined
      );
      setPdfTestResult(res);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setPdfTestResult({
        status: 'error',
        message: e.response?.data?.message || e.response?.data?.detail || e.message || 'Storage check connection error.',
        exists: false,
      });
    } finally {
      setIsTestingPdf(false);
    }
  };

  const handleSaveRecoveryMetadata = async () => {
    if (!recoveryTargetCert) return;
    setIsSavingRecovery(true);
    setRecoveryModalError(null);
    setRecoveryModalSuccess(null);

    // Validate Scopus ID format if provided
    if (recoveryScopusId.trim()) {
      if (!/^\d{8,12}$/.test(recoveryScopusId.trim())) {
        setRecoveryModalError("Scopus Author ID must be an 8 to 12 digit numeric identifier.");
        setIsSavingRecovery(false);
        return;
      }
    }

    // Validate storage key if provided
    if (recoveryStorageKey.trim()) {
      const key = recoveryStorageKey.trim();
      if (key.startsWith('http://') || key.startsWith('https://')) {
        setRecoveryModalError("Storage key cannot be an external URL. Enter the relative Spaces object key (e.g. 'sama_veda/certificates/filename.pdf').");
        setIsSavingRecovery(false);
        return;
      }
      if (/^[a-zA-Z]:/.test(key) || key.startsWith('/') || key.startsWith('\\')) {
        setRecoveryModalError("Storage key must be a relative object key and cannot be an absolute server or drive path.");
        setIsSavingRecovery(false);
        return;
      }
      if (key.includes('..')) {
        setRecoveryModalError("Storage key cannot contain directory traversal ('..').");
        setIsSavingRecovery(false);
        return;
      }
      if (!key.toLowerCase().endsWith('.pdf')) {
        setRecoveryModalError("Storage key must target a PDF file ending in .pdf.");
        setIsSavingRecovery(false);
        return;
      }
    }

    try {
      const updated = await samaAdminService.updateHistoricalRecoveryMetadata(
        recoveryTargetCert.id,
        {
          recipient_name: recoveryRecipientName.trim() || null,
          scopus_id: recoveryScopusId.trim() || null,
          research_title: recoveryResearchTitle.trim() || null,
          department: recoveryDepartment.trim() || null,
          publication_details: recoveryPublicationDetails.trim() || null,
          issue_reference: recoveryIssueReference.trim() || null,
          storage_key: recoveryStorageKey.trim() || null,
          original_filename: recoveryOriginalFilename.trim() || null,
        }
      );

      setRecoveryModalSuccess('Recovery metadata and PDF storage references updated successfully.');
      setCertificates((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      setRecoveryTargetCert(updated);
      setTimeout(() => {
        setShowEditRecoveryModal(false);
      }, 1200);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setRecoveryModalError(
        e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to update recovery metadata.'
      );
    } finally {
      setIsSavingRecovery(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Bulk Selection, Deletion & Verification Handlers
  // ---------------------------------------------------------------------------
  const handleToggleSelectCert = (id: string) => {
    const target = certificates.find((c) => c.id === id);
    if (target?.is_legacy || target?.status === 'HISTORICAL') return;
    setSelectedCertIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllCurrentPage = () => {
    const selectableCerts = certificates.filter((c) => !c.is_legacy && c.status !== 'HISTORICAL');
    const allSelected = selectableCerts.length > 0 && selectableCerts.every((c) => selectedCertIds.has(c.id));
    if (allSelected) {
      setSelectedCertIds((prev) => {
        const next = new Set(prev);
        selectableCerts.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedCertIds((prev) => {
        const next = new Set(prev);
        selectableCerts.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };

  const handleBulkDeleteSubmit = async () => {
    if (!bulkDeleteReason.trim()) {
      setError('Please provide a mandatory deletion reason for institutional audit.');
      return;
    }
    const idsToDelete = Array.from(selectedCertIds);
    if (idsToDelete.length === 0) return;

    try {
      setIsBulkDeleting(true);
      setError(null);
      const res = await samaAdminService.bulkDeleteCertificates(idsToDelete, bulkDeleteReason.trim());
      setShowBulkDeleteModal(false);
      setBulkDeleteReason('');
      setSelectedCertIds(new Set());
      setSuccessMessage(`Successfully deleted/archived ${res.deleted_count} certificate(s).`);
      fetchCertificates();
      fetchStats();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to bulk delete certificates.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleOpenSingleDelete = (cert: CertificateRecord) => {
    setSingleDeleteTarget(cert);
    setSingleDeleteReason('');
    setShowSingleDeleteModal(true);
  };

  const handleSingleDeleteSubmit = async () => {
    if (!singleDeleteTarget) return;
    if (!singleDeleteReason.trim()) {
      setError('Please provide a mandatory deletion reason.');
      return;
    }

    try {
      setIsSingleDeleting(true);
      setError(null);
      await samaAdminService.deleteCertificate(singleDeleteTarget.id, singleDeleteReason.trim());
      setShowSingleDeleteModal(false);
      setSingleDeleteTarget(null);
      setSingleDeleteReason('');
      setSuccessMessage(`Certificate ${singleDeleteTarget.certificate_number} archived successfully.`);
      fetchCertificates();
      fetchStats();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to delete certificate.');
    } finally {
      setIsSingleDeleting(false);
    }
  };

  const handleOpenSingleRestore = (cert: CertificateRecord) => {
    setSingleRestoreTarget(cert);
    setSingleRestoreReason('');
    setShowSingleRestoreModal(true);
  };

  const handleSingleRestoreSubmit = async () => {
    if (!singleRestoreTarget) return;
    if (!singleRestoreReason.trim()) {
      setError('Please provide a mandatory restoration reason for institutional audit.');
      return;
    }

    try {
      setIsSingleRestoring(true);
      setError(null);
      const res = await samaAdminService.restoreCertificate(singleRestoreTarget.id, singleRestoreReason.trim());
      setShowSingleRestoreModal(false);
      setSingleRestoreTarget(null);
      setSingleRestoreReason('');
      setSuccessMessage(`Certificate ${res.certificate_number} restored to ${res.restored_to_status} successfully.`);
      fetchCertificates();
      fetchStats();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to restore certificate.');
    } finally {
      setIsSingleRestoring(false);
    }
  };

  const handleBulkRestoreSubmit = async () => {
    if (!bulkRestoreReason.trim()) {
      setError('Please provide a mandatory restoration reason for institutional audit.');
      return;
    }
    const idsToRestore = Array.from(selectedCertIds);
    if (idsToRestore.length === 0) return;

    try {
      setIsBulkRestoring(true);
      setError(null);
      const res = await samaAdminService.bulkRestoreCertificates(idsToRestore, bulkRestoreReason.trim());
      setShowBulkRestoreModal(false);
      setBulkRestoreReason('');
      setSelectedCertIds(new Set());
      setSuccessMessage(`Successfully restored ${res.restored_count} certificate(s).`);
      fetchCertificates();
      fetchStats();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to bulk restore certificates.');
    } finally {
      setIsBulkRestoring(false);
    }
  };

  const handleRunBulkVerification = async () => {
    setVerifyError(null);
    const lines = verifyRawText
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setVerifyError('Please enter at least one certificate number to verify.');
      return;
    }
    if (lines.length > 250) {
      setVerifyError(`Batch contains ${lines.length} items. Maximum allowed is 250 per verification request.`);
      return;
    }

    try {
      setIsVerifying(true);
      const res = await samaAdminService.bulkVerifyCertificates({ certificate_numbers: lines });
      setVerifyResults(res);
    } catch (err: any) {
      setVerifyError(err?.response?.data?.detail || err?.message || 'Failed to perform bulk verification.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUploadCsvVerification = async () => {
    if (!verifyCsvFile) {
      setVerifyError('Please select a CSV or text file to upload.');
      return;
    }
    try {
      setIsVerifying(true);
      setVerifyError(null);
      const res = await samaAdminService.bulkVerifyCertificatesCsv(verifyCsvFile);
      setVerifyResults(res);
    } catch (err: any) {
      setVerifyError(err?.response?.data?.detail || err?.message || 'Failed to verify certificates from CSV file.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExportVerificationCsv = () => {
    if (!verifyResults || !verifyResults.results || verifyResults.results.length === 0) return;
    const headers = ['Input Text', 'Certificate Number', 'Status', 'Is Duplicate', 'Recipient Name', 'Research Title', 'Issue Date', 'Scheduled Issue Date', 'Revocation Reason', 'Replacement Certificate', 'Details / Error'];
    const rows = verifyResults.results.map((it: CertificateVerificationItem) => [
      `"${it.input_text}"`,
      `"${it.certificate_number || ''}"`,
      `"${it.status}"`,
      `"${it.is_duplicate ? 'YES' : 'NO'}"`,
      `"${(it.recipient_name || '').replace(/"/g, '""')}"`,
      `"${(it.research_title || '').replace(/"/g, '""')}"`,
      `"${it.issue_date || ''}"`,
      `"${it.scheduled_issue_date || ''}"`,
      `"${(it.revocation_reason || '').replace(/"/g, '""')}"`,
      `"${(it.replacement_certificate_number || '').replace(/"/g, '""')}"`,
      `"${(it.error_message || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `samiksha_bulk_verification_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredVerifyResults = useMemo(() => {
    if (!verifyResults || !verifyResults.results) return [];
    return verifyResults.results.filter((item: CertificateVerificationItem) => {
      const q = verifySearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.input_text.toLowerCase().includes(q) ||
        (item.certificate_number && item.certificate_number.toLowerCase().includes(q)) ||
        (item.recipient_name && item.recipient_name.toLowerCase().includes(q)) ||
        (item.research_title && item.research_title.toLowerCase().includes(q)) ||
        (item.error_message && item.error_message.toLowerCase().includes(q));

      let matchesFilter = true;
      if (verifyStatusFilter === 'VALID') matchesFilter = item.status === 'VALID / ISSUED';
      else if (verifyStatusFilter === 'SCHEDULED') matchesFilter = item.status === 'SCHEDULED';
      else if (verifyStatusFilter === 'REVOKED') matchesFilter = item.status === 'REVOKED';
      else if (verifyStatusFilter === 'SUPERSEDED') matchesFilter = item.status === 'SUPERSEDED';
      else if (verifyStatusFilter === 'NOT_FOUND') matchesFilter = item.status === 'NOT_FOUND';
      else if (verifyStatusFilter === 'INVALID') matchesFilter = item.status === 'INVALID';

      return matchesSearch && matchesFilter;
    });
  }, [verifyResults, verifySearchQuery, verifyStatusFilter]);

  // ---------------------------------------------------------------------------
  // Template & Signatory Management Handlers
  // ---------------------------------------------------------------------------
  const handleCreateTemplate = async () => {
    if (!templateForm.code || !templateForm.name) {
      setError('Template code and name are required.');
      return;
    }
    try {
      setSubmitting(true);
      await samaAdminService.createTemplate(templateForm);
      setSuccessMessage(`Template ${templateForm.name} created.`);
      setShowTemplateModal(false);
      loadReferenceData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || 'Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAddSignatory = () => {
    setEditingSignatoryId(null);
    setSignatoryForm({
      authority_type: 'DEAN_RD',
      signatory_name: '',
      designation: '',
      department: 'CSJMU, Kanpur',
      is_active: true,
    });
    setSignatureUploadFile(null);
    setSignatureFilePreviewUrl(null);
    setShowSignatoryModal(true);
  };

  const handleOpenEditSignatory = (sig: CertificateSignatoryItem) => {
    setEditingSignatoryId(sig.id);
    setSignatoryForm({
      authority_type: sig.authority_type,
      signatory_name: sig.signatory_name,
      designation: sig.designation,
      department: sig.department || '',
      is_active: sig.is_active,
    });
    setSignatureUploadFile(null);
    setSignatureFilePreviewUrl(null);
    setShowSignatoryModal(true);
  };

  const handleSaveSignatory = async () => {
    if (!signatoryForm.signatory_name.trim() || !signatoryForm.designation.trim()) {
      setError('Signatory full name and official designation are required.');
      return;
    }
    try {
      setSubmitting(true);
      if (editingSignatoryId) {
        await samaAdminService.updateSignatory(editingSignatoryId, {
          authority_type: signatoryForm.authority_type,
          signatory_name: signatoryForm.signatory_name.trim(),
          designation: signatoryForm.designation.trim(),
          department: signatoryForm.department?.trim() || undefined,
          is_active: signatoryForm.is_active,
        });
        setSuccessMessage(`Authority details updated for ${signatoryForm.signatory_name}.`);
      } else {
        const sig = await samaAdminService.createSignatory({
          ...signatoryForm,
          signatory_name: signatoryForm.signatory_name.trim(),
          designation: signatoryForm.designation.trim(),
        });
        if (signatureUploadFile) {
          await samaAdminService.uploadSignatorySignature(sig.id, signatureUploadFile);
        }
        setSuccessMessage(`Signing authority ${signatoryForm.signatory_name} created successfully.`);
      }
      setShowSignatoryModal(false);
      setEditingSignatoryId(null);
      setSignatureUploadFile(null);
      setSignatureFilePreviewUrl(null);
      loadReferenceData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.detail || e.response?.data?.message || e.message || 'Failed to save signatory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSignatoryActive = async (sig: CertificateSignatoryItem) => {
    try {
      setSubmitting(true);
      await samaAdminService.toggleSignatoryActive(sig.id);
      setSuccessMessage(`Authority ${sig.signatory_name} status updated.`);
      loadReferenceData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.detail || e.response?.data?.message || e.message || 'Failed to toggle status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenUploadSignatureModal = (sig: CertificateSignatoryItem) => {
    setSelectedSignatoryForUpload(sig);
    setSignatureUploadFile(null);
    setSignatureFilePreviewUrl(null);
    setShowUploadSignatureModal(true);
  };

  const handleSignatureFileSelect = (file: File | null) => {
    setSignatureUploadFile(file);
    if (file) {
      try {
        if (typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function') {
          const objectUrl = window.URL.createObjectURL(file);
          setSignatureFilePreviewUrl(objectUrl);
        } else {
          setSignatureFilePreviewUrl(null);
        }
      } catch {
        setSignatureFilePreviewUrl(null);
      }
    } else {
      setSignatureFilePreviewUrl(null);
    }
  };

  const handleUploadSignatureSubmit = async () => {
    if (!selectedSignatoryForUpload || !signatureUploadFile) {
      setError('Please select an authorized transparent PNG or JPEG signature file.');
      return;
    }
    try {
      setSubmitting(true);
      await samaAdminService.uploadSignatorySignature(selectedSignatoryForUpload.id, signatureUploadFile);
      setSuccessMessage(`Digital signature asset uploaded for ${selectedSignatoryForUpload.signatory_name}.`);
      setShowUploadSignatureModal(false);
      setSelectedSignatoryForUpload(null);
      setSignatureUploadFile(null);
      setSignatureFilePreviewUrl(null);
      loadReferenceData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.detail || e.response?.data?.message || e.message || 'Failed to upload signature');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSignatoryConfirm = async () => {
    if (!deleteSignatoryTarget) return;
    try {
      setSubmitting(true);
      const res = await samaAdminService.deleteSignatory(deleteSignatoryTarget.id);
      setSuccessMessage(res.message || 'Signing authority deleted.');
      setDeleteSignatoryTarget(null);
      loadReferenceData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.detail || e.response?.data?.message || e.message || 'Failed to delete authority');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <AdminLayout activeTab="sama-certificates">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Institutional Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0F2B48 0%, #1E3A8A 60%, #6B1D2F 100%)',
            color: '#FFFFFF',
            padding: '24px 28px',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(15, 43, 72, 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#D4AF37',
                marginBottom: '4px',
              }}
            >
              CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR • समीक्षा
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AppIcon name="shield" size={26} color="#D4AF37" />
              Digital Certificate Management & Verification System
            </h1>
            <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: '#E2E8F0', maxWidth: '780px' }}>
              Institution-grade digital certificates with multi-author citation, dual authorized signatures (Dean R&D &
              Vice Chancellor), vector PDF rendering, and cryptographic QR verification.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="outline" size="sm" onClick={() => { fetchCertificates(); fetchApprovalQueue(); fetchStats(); }}>
              <AppIcon name="clock" size={14} style={{ marginRight: '6px' }} />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenWizard}
              style={{ backgroundColor: '#B2811A', borderColor: '#B2811A', fontWeight: 600 }}
            >
              <AppIcon name="edit" size={14} style={{ marginRight: '6px' }} />
              New Joint Certificate
            </Button>
          </div>
        </div>

        {/* 7 KPI Statistics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Total Issued</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0F2B48', marginTop: '4px' }}>
              {stats.total_issued ?? ((stats.issued_certificates || (stats as any).issued || 0) + (stats.revoked_certificates || (stats as any).revoked || 0) + (stats.reissued_certificates || (stats as any).superseded || 0))}
            </div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
              {stats.total_certificates ?? (stats as any).total ?? 0} in registry
            </div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Issued & Active</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#166534', marginTop: '4px' }}>{stats.issued_certificates ?? (stats as any).issued ?? 0}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#0284C7', textTransform: 'uppercase' }}>Scheduled</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0284C7', marginTop: '4px' }}>{stats.scheduled_certificates ?? 0}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#D97706', textTransform: 'uppercase' }}>Pending Approvals</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#D97706', marginTop: '4px' }}>{stats.pending_approvals ?? (stats as any).in_review ?? 0}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#6366F1', textTransform: 'uppercase' }}>Drafts</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#6366F1', marginTop: '4px' }}>{stats.draft_certificates ?? (stats as any).draft ?? 0}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626', textTransform: 'uppercase' }}>Revoked</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#DC2626', marginTop: '4px' }}>{stats.revoked_certificates ?? (stats as any).revoked ?? 0}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#8B5CF6', textTransform: 'uppercase' }}>Superseded</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#8B5CF6', marginTop: '4px' }}>{stats.reissued_certificates ?? (stats as any).superseded ?? 0}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#0284C7', textTransform: 'uppercase' }}>Linked Scholars</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0284C7', marginTop: '4px' }}>{stats.total_researchers_linked ?? 0}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #FDE68A', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#B45309', textTransform: 'uppercase' }}>📜 Recovered (Legacy)</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#B45309', marginTop: '4px' }}>{stats.historical_certificates ?? 0}</div>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#991B1B', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B' }}>
              <AppIcon name="close" size={14} />
            </button>
          </div>
        )}
        {successMessage && (
          <div style={{ padding: '12px 16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', color: '#166534', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>
              <AppIcon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '20px' }}>
          <button
            onClick={() => setActiveTab('ledger')}
            style={{
              padding: '10px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'ledger' ? 700 : 500,
              color: activeTab === 'ledger' ? '#0F2B48' : '#64748B',
              borderBottom: activeTab === 'ledger' ? '3px solid #B2811A' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="file-text" size={16} />
            Issued Ledger ({totalCount})
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            style={{
              padding: '10px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'approvals' ? 700 : 500,
              color: activeTab === 'approvals' ? '#0F2B48' : '#64748B',
              borderBottom: activeTab === 'approvals' ? '3px solid #B2811A' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="shield" size={16} />
            Approval Queue {stats.pending_approvals > 0 && <Badge variant="gold">{stats.pending_approvals}</Badge>}
          </button>
          <button
            onClick={() => setActiveTab('bulk_operations')}
            style={{
              padding: '10px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'bulk_operations' ? 700 : 500,
              color: activeTab === 'bulk_operations' ? '#0F2B48' : '#64748B',
              borderBottom: activeTab === 'bulk_operations' ? '3px solid #B2811A' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="file-text" size={16} />
            Bulk Operations & Dual Approvals
          </button>
          <button
            onClick={() => setActiveTab('designer')}
            style={{
              padding: '10px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'designer' ? 700 : 500,
              color: activeTab === 'designer' ? '#0F2B48' : '#64748B',
              borderBottom: activeTab === 'designer' ? '3px solid #B2811A' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="edit" size={16} />
            Online Certificate Designer
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            style={{
              padding: '10px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'templates' ? 700 : 500,
              color: activeTab === 'templates' ? '#0F2B48' : '#64748B',
              borderBottom: activeTab === 'templates' ? '3px solid #B2811A' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="file-text" size={16} />
            Templates {refDataLoading ? '(…)' : refDataError ? '(!)' : `(${templates.length})`}
          </button>
          <button
            onClick={() => setActiveTab('signatories')}
            style={{
              padding: '10px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'signatories' ? 700 : 500,
              color: activeTab === 'signatories' ? '#0F2B48' : '#64748B',
              borderBottom: activeTab === 'signatories' ? '3px solid #B2811A' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="user" size={16} />
            Signing Authorities {refDataLoading ? '(…)' : refDataError ? '(!)' : `(${signatories.length})`}
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            style={{
              padding: '10px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'verification' ? 700 : 500,
              color: activeTab === 'verification' ? '#0F2B48' : '#64748B',
              borderBottom: activeTab === 'verification' ? '3px solid #B2811A' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="shield" size={16} />
            Bulk Verification
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: ISSUED LEDGER */}
        {/* =================================================================== */}
        {activeTab === 'ledger' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Search and Filters */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 300px' }}>
                <Input
                  placeholder="Search certificate #, author name, Scopus ID, paper title, token..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ width: '240px' }}>
                <Select
                  value={originFilter}
                  onChange={(e) => {
                    setOriginFilter(e.target.value as any);
                    setPage(1);
                  }}
                  options={[
                    { label: 'All Origins (Active + Historical)', value: 'all' },
                    { label: 'Active Ledger Only', value: 'active' },
                    { label: '📜 Historical Recovered Only', value: 'historical' },
                  ]}
                />
              </div>
              <div style={{ width: '280px' }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setPage(1);
                  }}
                  options={[
                    { label: 'All Issued (Active, Revoked, Superseded)', value: 'all' },
                    { label: 'Issued & Active', value: 'issued' },
                    { label: '📜 Historical / Recovered', value: 'historical' },
                    { label: 'Revoked', value: 'revoked' },
                    { label: 'Superseded', value: 'superseded' },
                    { label: 'Scheduled (Pre-Activation)', value: 'scheduled' },
                    { label: '📦 Archived / Soft-Deleted (Recovery)', value: 'archived' },
                  ]}
                />
              </div>
            </div>

            {/* Super Admin Bulk Selection Toolbar */}
            {isSuperAdmin && certificates.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: selectedCertIds.size > 0 ? '#FEF2F2' : '#F8FAFC',
                  border: selectedCertIds.size > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                    <input
                      type="checkbox"
                      checked={certificates.length > 0 && certificates.every((c) => selectedCertIds.has(c.id))}
                      onChange={handleSelectAllCurrentPage}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#DC2626' }}
                    />
                    <span>Select All on Page ({certificates.length})</span>
                  </label>
                  {selectedCertIds.size > 0 && (
                    <Badge variant="neutral" style={{ color: '#DC2626', borderColor: '#FECACA', background: '#FFFFFF' }}>
                      {selectedCertIds.size} selected
                    </Badge>
                  )}
                </div>

                {selectedCertIds.size > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCertIds(new Set())}
                    >
                      Clear Selection
                    </Button>
                    {statusFilter === 'archived' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setBulkRestoreReason('');
                          setShowBulkRestoreModal(true);
                        }}
                        style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                      >
                        ♻️ Bulk Restore ({selectedCertIds.size})
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setBulkDeleteReason('');
                          setShowBulkDeleteModal(true);
                        }}
                        style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                      >
                        🗑️ Bulk Archive ({selectedCertIds.size})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Certificate Ledger Cards */}
            {loading ? (
              <LoadingState message="Loading certificate records..." />
            ) : error ? (
              <div
                style={{
                  padding: '36px 24px',
                  textAlign: 'center',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '12px',
                  margin: '16px 0',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#991B1B' }}>
                  Unable to Load Certificates
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: '#B91C1C', maxWidth: '640px', marginInline: 'auto' }}>
                  {error}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    fetchCertificates();
                    fetchStats();
                  }}
                  style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  <AppIcon name="clock" size={14} style={{ marginRight: '6px' }} />
                  Retry Request
                </Button>
              </div>
            ) : certificates.length === 0 ? (
              <EmptyState
                title="No Certificates Found"
                description="No digital certificates match your filter criteria. Issue a new joint certificate using the wizard."
                action={
                  <Button variant="primary" size="sm" onClick={handleOpenWizard}>
                    <span style={{ marginRight: '6px' }}>+</span>
                    Issue First Certificate
                  </Button>
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {certificates.map((cert) => {
                  const isLegacy = isHistoricalCertificate(cert);
                  const isArchived = cert.status === 'ARCHIVED';
                  const isRevoked = cert.is_revoked || cert.status === 'REVOKED';
                  const isSuperseded = cert.status === 'SUPERSEDED';
                  const isScheduled = cert.status === 'SCHEDULED';
                  const isPending =
                    cert.status === 'PENDING_DEAN_APPROVAL' ||
                    cert.status === 'PENDING_VC_APPROVAL' ||
                    cert.status === 'DRAFT';

                  return (
                    <div
                      key={cert.id}
                      style={{
                        background: isLegacy ? '#FFFDF5' : '#FFFFFF',
                        border: cert.has_legacy_collision
                          ? '1px solid #FCD34D'
                          : isArchived
                          ? '1px solid #CBD5E1'
                          : isRevoked
                          ? '1px solid #FECACA'
                          : isSuperseded
                          ? '1px solid #E2E8F0'
                          : isLegacy
                          ? '1px solid #FDE68A'
                          : '1px solid #E2E8F0',
                        borderLeft: isLegacy
                          ? '5px solid #D97706'
                          : isArchived
                          ? '5px solid #64748B'
                          : isRevoked
                          ? '5px solid #DC2626'
                          : isSuperseded
                          ? '5px solid #8B5CF6'
                          : isScheduled
                          ? '5px solid #0284C7'
                          : isPending
                          ? '5px solid #D97706'
                          : '5px solid #166534',
                        borderRadius: '8px',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {isSuperAdmin && (
                              <input
                                type="checkbox"
                                checked={selectedCertIds.has(cert.id)}
                                onChange={() => handleToggleSelectCert(cert.id)}
                                disabled={isLegacy}
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  cursor: isLegacy ? 'not-allowed' : 'pointer',
                                  accentColor: '#DC2626',
                                  marginRight: '4px',
                                  opacity: isLegacy ? 0.3 : 1,
                                }}
                                title={isLegacy ? "Historical recovered certificates are immutable records and cannot be bulk deleted" : "Select certificate for bulk action"}
                              />
                            )}
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F2B48', fontFamily: 'monospace' }}>
                              {cert.certificate_number}
                            </span>
                            {isLegacy ? (
                              <Badge variant="neutral" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A', fontWeight: 700 }}>
                                📜 Historical / Recovered
                              </Badge>
                            ) : isArchived ? (
                              <Badge variant="neutral" style={{ background: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' }}>📦 ARCHIVED</Badge>
                            ) : isRevoked ? (
                              <Badge variant="neutral" style={{ color: '#DC2626', borderColor: '#FECACA' }}>REVOKED</Badge>
                            ) : isSuperseded ? (
                              <Badge variant="neutral">SUPERSEDED</Badge>
                            ) : isScheduled ? (
                              <Badge variant="teal" style={{ background: '#F0F9FF', color: '#0284C7', borderColor: '#BAE6FD' }}>
                                ⏰ SCHEDULED
                              </Badge>
                            ) : cert.status === 'PENDING_DEAN_APPROVAL' ? (
                              <Badge variant="gold">Awaiting Dean R&D</Badge>
                            ) : cert.status === 'PENDING_VC_APPROVAL' ? (
                              <Badge variant="gold">Awaiting Vice Chancellor</Badge>
                            ) : cert.status === 'DRAFT' ? (
                              <Badge variant="neutral">Draft</Badge>
                            ) : (
                              <Badge variant="teal">ISSUED & VERIFIED</Badge>
                            )}
                            {cert.certificate_type && (
                              <Badge variant="neutral" style={{ background: '#F1F5F9', color: '#475569', fontSize: '11px', borderColor: '#E2E8F0' }}>
                                {cert.certificate_type}
                              </Badge>
                            )}
                            {cert.issue_reference && (
                              <Badge variant="neutral" style={{ background: '#F8FAFC', color: '#475569', fontSize: '11px', borderColor: '#E2E8F0' }}>
                                {cert.issue_reference}
                              </Badge>
                            )}
                            {cert.sanction_amount && (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                                Sanction: {cert.sanction_amount}
                              </span>
                            )}
                            {isScheduled ? (
                              <span style={{ fontSize: '12px', color: '#0284C7', fontWeight: 600 }}>
                                Scheduled Issue Date: {cert.scheduled_issue_date || (cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : '')}
                                {cert.time_until_activation_seconds != null && (
                                  <span style={{ marginLeft: '6px', padding: '2px 8px', borderRadius: '10px', background: '#E0F2FE', color: '#0369A1', fontSize: '11px' }}>
                                    Activates in {Math.ceil(cert.time_until_activation_seconds / 86400)} day(s) at 00:00 IST
                                  </span>
                                )}
                                <span style={{ marginLeft: '6px', padding: '2px 8px', borderRadius: '10px', background: '#FEF3C7', color: '#92400E', fontSize: '11px' }}>
                                  Admin Print Available
                                </span>
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#64748B' }}>
                                Issued: {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : isLegacy ? 'Historical (Issue 3)' : 'Pending'}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginTop: '4px' }}>
                            {cert.title || 'Certificate of Appreciation & Research Excellence'}
                          </div>

                          {cert.research_title && (
                            <div style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>
                              "{cert.research_title}"
                            </div>
                          )}

                          {cert.has_legacy_collision && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: '#FFFBEB',
                              border: '1px solid #FCD34D',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              color: '#92400E',
                            }}>
                              <span style={{ fontSize: '14px' }}>⚠️</span>
                              <span>
                                <strong>Serial Collision Advisory:</strong> Certificate <code>{cert.certificate_number}</code> is simultaneously present in Active ledger ({cert.legacy_collision_info?.active_recipient || 'Active Recipient'}) and Historical registry ({cert.legacy_collision_info?.historical_recipient || 'Historical Recipient'}). Both records are cryptographically unique and preserved in independent registries.
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ color: '#0F2B48', borderColor: '#CBD5E1' }}
                            onClick={() => {
                              setDetailsCert(cert);
                              setShowDetailsModal(true);
                            }}
                            title="View full certificate details & metadata"
                          >
                            <AppIcon name="file-text" size={14} style={{ marginRight: '4px' }} />
                            Details
                          </Button>

                          {isScheduled && isSuperAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              style={{ color: '#0284C7', borderColor: '#BAE6FD' }}
                              onClick={() => handleOpenReschedule(cert)}
                              title="Change scheduled Date of Issue prior to activation"
                            >
                              Reschedule
                            </Button>
                          )}
                          {!isScheduled && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyVerificationUrl(cert)}
                              title="Copy Public Verification Link"
                            >
                              <AppIcon name="clipboard" size={14} style={{ marginRight: '4px' }} />
                              {copiedToken === (cert.verification_token || cert.certificate_number) ? 'Copied' : 'Verify Link'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === cert.id || (!isLegacy && (isRevoked || isSuperseded))}
                            onClick={() => handleDownload(cert)}
                            title={
                              isRevoked
                                ? 'Revoked certificate cannot be downloaded'
                                : isSuperseded
                                ? 'Superseded certificate cannot be downloaded'
                                : isScheduled
                                ? 'Download advance PDF for physical printing (Admin only; public access inactive until scheduled date)'
                                : isLegacy
                                ? 'Download Original Historical PDF'
                                : 'Download Official PDF'
                            }
                          >
                            <span style={{ marginRight: '4px' }}>&darr;</span>
                            {downloadingId === cert.id ? 'Downloading...' : isScheduled ? 'Print / PDF' : 'PDF'}
                          </Button>

                          {isLegacy ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditRecoveryMetadata(cert)}
                                title="Edit Recovery Metadata & Storage References"
                                style={{
                                  borderColor: '#6366F1',
                                  color: '#4F46E5',
                                  background: '#EEF2FF',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <AppIcon name="edit" size={14} style={{ marginRight: '5px' }} />
                                Edit Recovery Metadata
                              </Button>
                              <Badge variant="neutral" style={{ background: '#F8FAFC', color: '#64748B', borderColor: '#E2E8F0', fontSize: '11px' }}>
                                🔒 Historical Immutable
                              </Badge>
                            </>
                          ) : (
                            <>
                              {!isRevoked && !isSuperseded && !isScheduled && isSuperAdmin && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenReissue(cert)}
                                    title="Reissue / Supersede with corrections"
                                  >
                                    Reissue
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    style={{ color: '#DC2626', borderColor: '#FECACA' }}
                                    onClick={() => handleOpenRevoke(cert)}
                                    title="Permanently revoke certificate"
                                  >
                                    Revoke
                                  </Button>
                                </>
                              )}

                              {isSuperAdmin && (
                                isArchived ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    style={{ color: '#059669', borderColor: '#A7F3D0' }}
                                    onClick={() => handleOpenSingleRestore(cert)}
                                    title="Restore archived certificate to original state"
                                  >
                                    ♻️ Restore
                                  </Button>
                                ) : cert.status === 'ISSUED' && !isRevoked ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    style={{ color: '#94A3B8', borderColor: '#E2E8F0', cursor: 'not-allowed' }}
                                    title="Active issued certificates cannot be archived directly; revoke or reissue first."
                                  >
                                    Archive (Revoke First)
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    style={{ color: '#DC2626', borderColor: '#FECACA' }}
                                    onClick={() => handleOpenSingleDelete(cert)}
                                    title="Soft-delete / archive certificate"
                                  >
                                    Archive
                                  </Button>
                                )
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Multi-Author Chips */}
                      {cert.authors && cert.authors.length > 0 ? (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                            Recipients ({cert.authors.length}):
                          </span>
                          {cert.authors.map((auth, aIdx) => (
                            <span
                              key={aIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#F1F5F9',
                                border: '1px solid #CBD5E1',
                                borderRadius: '14px',
                                padding: '3px 10px',
                                fontSize: '12px',
                                color: '#0F2B48',
                              }}
                            >
                              <strong>{auth.author_name_snapshot}</strong>
                              {auth.scopus_id_snapshot && (
                                <span style={{ fontSize: '10px', color: '#D97706', fontWeight: 600 }}>
                                  [Scopus: {auth.scopus_id_snapshot}]
                                </span>
                              )}
                              <span style={{ fontSize: '10px', color: '#64748B' }}>({auth.author_role})</span>
                            </span>
                          ))}
                        </div>
                      ) : cert.author_name ? (
                        <div style={{ fontSize: '12.5px', color: '#334155' }}>
                          Recipient: <strong>{cert.author_name}</strong> {cert.author_department && `(${cert.author_department})`}
                        </div>
                      ) : null}

                      {/* Revocation Warning */}
                      {isRevoked && cert.revocation_reason && (
                        <div style={{ background: '#FEF2F2', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: '#991B1B' }}>
                          <strong>Revocation Reason:</strong> {cert.revocation_reason}
                        </div>
                      )}

                      {/* Reissue Notice */}
                      {isSuperseded && cert.reissued_reason && (
                        <div style={{ background: '#F5F3FF', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: '#6D28D9' }}>
                          <strong>Superseded Note:</strong> {cert.reissued_reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls for Issued Ledger */}
            {totalCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 4px',
                  borderTop: '1px solid #E2E8F0',
                  marginTop: '8px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div data-testid="ledger-pagination-info" style={{ fontSize: '13px', color: '#64748B' }}>
                  Showing <strong style={{ color: '#0F2B48' }}>{Math.min((page - 1) * limit + 1, totalCount)}</strong> to{' '}
                  <strong style={{ color: '#0F2B48' }}>{Math.min(page * limit, totalCount)}</strong> of{' '}
                  <strong style={{ color: '#0F2B48' }}>{totalCount}</strong> certificates
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  >
                    ← Previous
                  </Button>
                  <span data-testid="ledger-page-info" style={{ fontSize: '13px', color: '#475569', padding: '0 8px' }}>
                    Page <strong>{page}</strong> of <strong>{Math.max(1, Math.ceil(totalCount / limit))}</strong>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(totalCount / limit)}
                    onClick={() => setPage((p) => Math.min(p + 1, Math.ceil(totalCount / limit)))}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: APPROVAL QUEUE */}
        {/* =================================================================== */}
        {activeTab === 'approvals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '14px 18px', color: '#92400E', fontSize: '13.5px' }}>
              <strong>Dual Signing Policy:</strong> Official university certificates require mandatory review and approval by both the <strong>Dean – Research & Development</strong> and the <strong>Vice Chancellor</strong> before final cryptographic sealing and public release.
            </div>

            {/* Stage filter and search */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 280px' }}>
                <Input
                  placeholder="Search pending certificate #, author name, Scopus ID, title..."
                  value={approvalSearch}
                  onChange={(e) => {
                    setApprovalSearch(e.target.value);
                    setApprovalPage(1);
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant={approvalStageFilter === 'all' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setApprovalStageFilter('all');
                    setApprovalPage(1);
                  }}
                  style={approvalStageFilter === 'all' ? { backgroundColor: '#0F2B48', borderColor: '#0F2B48' } : {}}
                >
                  All Pending ({stats.pending_approvals})
                </Button>
                <Button
                  variant={approvalStageFilter === 'DEAN' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setApprovalStageFilter('DEAN');
                    setApprovalPage(1);
                  }}
                  style={approvalStageFilter === 'DEAN' ? { backgroundColor: '#B2811A', borderColor: '#B2811A' } : {}}
                >
                  Awaiting Dean R&D
                </Button>
                <Button
                  variant={approvalStageFilter === 'VC' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setApprovalStageFilter('VC');
                    setApprovalPage(1);
                  }}
                  style={approvalStageFilter === 'VC' ? { backgroundColor: '#7C3AED', borderColor: '#7C3AED' } : {}}
                >
                  Awaiting Vice Chancellor
                </Button>
              </div>
            </div>

            {approvalLoading ? (
              <LoadingState message="Checking approval queue..." />
            ) : approvalError ? (
              <div
                style={{
                  padding: '36px 24px',
                  textAlign: 'center',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '12px',
                  margin: '16px 0',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#991B1B' }}>
                  Unable to Load Approval Queue
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: '#B91C1C', maxWidth: '640px', marginInline: 'auto' }}>
                  {approvalError}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    fetchApprovalQueue();
                    fetchStats();
                  }}
                  style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  <AppIcon name="clock" size={14} style={{ marginRight: '6px' }} />
                  Retry Request
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {approvalCertificates.map((cert) => (
                  <div
                    key={cert.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '18px 22px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: '#0F2B48', fontFamily: 'monospace' }}>
                            {cert.certificate_number}
                          </span>
                          {cert.status === 'PENDING_DEAN_APPROVAL' ? (
                            <Badge variant="gold">Step 1: Pending Dean R&D Approval</Badge>
                          ) : cert.status === 'PENDING_VC_APPROVAL' ? (
                            <Badge variant="gold">Step 2: Pending Vice Chancellor Approval</Badge>
                          ) : (
                            <Badge variant="neutral">Draft</Badge>
                          )}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginTop: '6px' }}>
                          {cert.title}
                        </div>
                        <div style={{ fontSize: '13.5px', color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>
                          "{cert.research_title}"
                        </div>
                      </div>

                      {/* Direct Authority Review Actions */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {cert.status === 'PENDING_DEAN_APPROVAL' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              style={{ backgroundColor: '#166534', borderColor: '#166534' }}
                              onClick={() => handleOpenApprovalModal(cert, 'DEAN_RD')}
                            >
                              <AppIcon name="check" size={14} style={{ marginRight: '4px' }} />
                              Approve as Dean R&D
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              style={{ color: '#DC2626', borderColor: '#FECACA' }}
                              onClick={() => {
                                setSelectedCert(cert);
                                setApprovalAuthority('DEAN_RD');
                                setApprovalAction('REJECT');
                                setApprovalRemarks('');
                                setShowApprovalModal(true);
                              }}
                            >
                              Reject with Remarks
                            </Button>
                          </>
                        )}

                        {cert.status === 'PENDING_VC_APPROVAL' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              style={{ backgroundColor: '#B2811A', borderColor: '#B2811A' }}
                              onClick={() => handleOpenApprovalModal(cert, 'VICE_CHANCELLOR')}
                            >
                              <AppIcon name="shield" size={14} style={{ marginRight: '4px' }} />
                              Seal & Issue as Vice Chancellor
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              style={{ color: '#DC2626', borderColor: '#FECACA' }}
                              onClick={() => {
                                setSelectedCert(cert);
                                setApprovalAuthority('VICE_CHANCELLOR');
                                setApprovalAction('REJECT');
                                setApprovalRemarks('');
                                setShowApprovalModal(true);
                              }}
                            >
                              Reject with Remarks
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Author Details Breakdown */}
                    {cert.authors && cert.authors.length > 0 && (
                      <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 14px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                          Author Citation Breakdown:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                          {cert.authors.map((a, i) => (
                            <div key={i} style={{ fontSize: '12.5px', color: '#1E293B' }}>
                              <strong>{a.author_order}. {a.author_name_snapshot}</strong> ({a.author_role})
                              <div style={{ fontSize: '11px', color: '#64748B' }}>
                                {a.department_snapshot} {a.scopus_id_snapshot && `• Scopus: ${a.scopus_id_snapshot}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {approvalTotalCount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 4px',
                      borderTop: '1px solid #E2E8F0',
                      marginTop: '8px',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div data-testid="approval-pagination-info" style={{ fontSize: '13px', color: '#64748B' }}>
                      Showing <strong style={{ color: '#0F2B48' }}>{Math.min((approvalPage - 1) * approvalLimit + 1, approvalTotalCount)}</strong> to{' '}
                      <strong style={{ color: '#0F2B48' }}>{Math.min(approvalPage * approvalLimit, approvalTotalCount)}</strong> of{' '}
                      <strong style={{ color: '#0F2B48' }}>{approvalTotalCount}</strong> pending certificates
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={approvalPage <= 1}
                        onClick={() => setApprovalPage((p) => Math.max(p - 1, 1))}
                      >
                        ← Previous
                      </Button>
                      <span data-testid="approval-page-info" style={{ fontSize: '13px', color: '#475569', padding: '0 8px' }}>
                        Page <strong>{approvalPage}</strong> of <strong>{Math.max(1, Math.ceil(approvalTotalCount / approvalLimit))}</strong>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={approvalPage >= Math.ceil(approvalTotalCount / approvalLimit)}
                        onClick={() => setApprovalPage((p) => Math.min(p + 1, Math.ceil(approvalTotalCount / approvalLimit)))}
                      >
                        Next →
                      </Button>
                    </div>
                  </div>
                )}

                {approvalCertificates.length === 0 && (
                  <EmptyState
                    title="All Approvals Cleared"
                    description={
                      approvalSearch || approvalStageFilter !== 'all'
                        ? 'No pending certificates match your search/filter criteria.'
                        : 'No certificates are currently awaiting Dean R&D or Vice Chancellor authorization.'
                    }
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB: BULK OPERATIONS & DUAL APPROVALS */}
        {/* =================================================================== */}
        {activeTab === 'bulk_operations' && (
          <BulkOperationsSection
            isSuperAdmin={isSuperAdmin}
            onRefreshStats={fetchStats}
          />
        )}

        {/* =================================================================== */}
        {/* TAB 3: ONLINE CERTIFICATE DESIGNER */}
        {/* =================================================================== */}
        {activeTab === 'designer' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
            {/* Live Visual Canvas */}
            <div
              style={{
                background: '#FAF7F0',
                border: `3px double ${designerBorderColor}`,
                borderRadius: '8px',
                padding: '36px 40px',
                position: 'relative',
                boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                minHeight: '520px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Corner Ornaments */}
              <div style={{ position: 'absolute', top: '10px', left: '10px', width: '24px', height: '24px', borderTop: `2px solid ${designerBorderColor}`, borderLeft: `2px solid ${designerBorderColor}` }} />
              <div style={{ position: 'absolute', top: '10px', right: '10px', width: '24px', height: '24px', borderTop: `2px solid ${designerBorderColor}`, borderRight: `2px solid ${designerBorderColor}` }} />
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '24px', height: '24px', borderBottom: `2px solid ${designerBorderColor}`, borderLeft: `2px solid ${designerBorderColor}` }} />
              <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '24px', height: '24px', borderBottom: `2px solid ${designerBorderColor}`, borderRight: `2px solid ${designerBorderColor}` }} />

              {/* Header: University Branding */}
              <div style={{ textAlign: 'center', borderBottom: `1px solid ${designerBorderColor}40`, paddingBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: designerAccentColor, textTransform: 'uppercase' }}>
                  CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  (Accredited A++ by NAAC) • Research & Development Cell
                </div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 700, color: designerAccentColor, margin: '14px 0 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {designerTitle}
                </h2>
              </div>

              {/* Body Content */}
              <div style={{ textAlign: 'center', margin: '20px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontStyle: 'italic', fontSize: '13px', color: '#475569' }}>
                  {designerPresentation}
                </div>

                {/* Author Names */}
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F2B48', fontFamily: 'Georgia, serif' }}>
                  {designerAuthors.map((a) => a.author_name_snapshot).join('  •  ')}
                </div>

                <div style={{ fontStyle: 'italic', fontSize: '13px', color: '#475569' }}>
                  {designerContribution}
                </div>

                {/* Research Title */}
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: designerAccentColor, maxWidth: '680px', margin: '0 auto', lineHeight: '1.4' }}>
                  "{designerResearchTitle}"
                </div>

                <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '620px', margin: '8px auto 0 auto', lineHeight: '1.4' }}>
                  {designerCongratulatory}
                </div>
              </div>

              {/* Signatures & Seal Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '20px', borderTop: `1px solid ${designerBorderColor}40` }}>
                <div style={{ textAlign: 'center', width: '180px' }}>
                  <div style={{ height: '36px', borderBottom: '1px dashed #94A3B8', marginBottom: '6px' }} />
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F2B48' }}>Dean – Research & Development</div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Chhatrapati Shahu Ji Maharaj University</div>
                </div>

                {/* Central Academic Seal */}
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      border: `2px double ${designerBorderColor}`,
                      margin: '0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#FFF',
                    }}
                  >
                    <AppIcon name="shield" size={28} color={designerBorderColor} />
                  </div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: designerBorderColor, marginTop: '4px', letterSpacing: '0.06em' }}>
                    SEAL OF EXCELLENCE
                  </div>
                </div>

                <div style={{ textAlign: 'center', width: '180px' }}>
                  <div style={{ height: '36px', borderBottom: '1px dashed #94A3B8', marginBottom: '6px' }} />
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F2B48' }}>Vice Chancellor</div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Chhatrapati Shahu Ji Maharaj University</div>
                </div>
              </div>
            </div>

            {/* Designer Configuration Panel */}
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F2B48' }}>
                Designer Configuration
              </h3>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Certificate Title</label>
                <Input value={designerTitle} onChange={(e) => setDesignerTitle(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Presentation Statement</label>
                <Input value={designerPresentation} onChange={(e) => setDesignerPresentation(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Contribution Statement</label>
                <Input value={designerContribution} onChange={(e) => setDesignerContribution(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Research Paper Title</label>
                <Input value={designerResearchTitle} onChange={(e) => setDesignerResearchTitle(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Congratulatory Note</label>
                <Input value={designerCongratulatory} onChange={(e) => setDesignerCongratulatory(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Primary Gold Border</label>
                <input
                  type="color"
                  value={designerBorderColor}
                  onChange={(e) => setDesignerBorderColor(e.target.value)}
                  style={{ width: '100%', height: '36px', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Maroon Accent Color</label>
                <input
                  type="color"
                  value={designerAccentColor}
                  onChange={(e) => setDesignerAccentColor(e.target.value)}
                  style={{ width: '100%', height: '36px', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer' }}
                />
              </div>

              <Button
                variant="primary"
                onClick={handleRenderDesignerPreview}
                disabled={renderingPreview}
                style={{ backgroundColor: '#B2811A', borderColor: '#B2811A' }}
              >
                <AppIcon name="file-text" size={14} style={{ marginRight: '6px' }} />
                {renderingPreview ? 'Rendering Vector PDF...' : 'Render Live Vector PDF'}
              </Button>

              {previewPdfUrl && (
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textAlign: 'center', fontSize: '13px', color: '#0284C7', textDecoration: 'underline' }}
                >
                  Open Rendered Vector PDF in New Tab
                </a>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: TEMPLATES */}
        {/* =================================================================== */}
        {activeTab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F2B48' }}>Reusable Certificate Templates</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                  Institutional templates retain fixed dimensions, official emblems, and decorative gold borders.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowTemplateModal(true)}>
                <span style={{ marginRight: '6px' }}>+</span>
                New Template
              </Button>
            </div>

            {refDataLoading ? (
              <LoadingState message="Loading certificate templates..." />
            ) : refDataError ? (
              <div
                style={{
                  padding: '36px 24px',
                  textAlign: 'center',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '12px',
                  margin: '16px 0',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#991B1B' }}>
                  Unable to Load Templates
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: '#B91C1C', maxWidth: '640px', marginInline: 'auto' }}>
                  {refDataError}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={loadReferenceData}
                  style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  <AppIcon name="clock" size={14} style={{ marginRight: '6px' }} />
                  Retry Loading Templates
                </Button>
              </div>
            ) : templates.length === 0 ? (
              <EmptyState
                title="No Templates Configured"
                description="No certificate templates currently exist. Create your first template using the button above."
                action={
                  <Button variant="primary" size="sm" onClick={() => setShowTemplateModal(true)}>
                    <span style={{ marginRight: '6px' }}>+</span>
                    New Template
                  </Button>
                }
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#B2811A', fontFamily: 'monospace' }}>
                          {tpl.code}
                        </span>
                        {tpl.is_default && <Badge variant="teal">DEFAULT</Badge>}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2B48', marginTop: '4px' }}>
                        {tpl.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                        {tpl.description || 'Institutional landscape A4 template.'}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                      Orientation: {tpl.orientation} • Type: {tpl.certificate_type} • Version: {tpl.version}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: SIGNATORIES */}
        {/* =================================================================== */}
        {activeTab === 'signatories' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F2B48' }}>
                  Signing Authorities & Digital Signature Management
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                  Manage authorized institutional signatories (Dean – R&D and Vice Chancellor), upload genuine transparent signature assets, and maintain immutable cryptographic snapshots for certificate issuance.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={handleOpenAddSignatory}>
                <span style={{ marginRight: '6px' }}>+</span>
                Add Signing Authority
              </Button>
            </div>

            {/* Information Notice */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderLeft: '4px solid #B2811A',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '20px' }}>🛡️</div>
              <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
                <strong>Strict Signature Integrity:</strong> Certificates require genuine transparent PNG signature assets. Simulated or artificial cursive signatures are prohibited. Whenever an authority signs or a certificate is approved, immutable signature snapshots are permanently preserved with the certificate record.
              </div>
            </div>

            {refDataLoading ? (
              <LoadingState message="Loading signing authorities..." />
            ) : refDataError ? (
              <div
                style={{
                  padding: '36px 24px',
                  textAlign: 'center',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '12px',
                  margin: '16px 0',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#991B1B' }}>
                  Unable to Load Signing Authorities
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: '#B91C1C', maxWidth: '640px', marginInline: 'auto' }}>
                  {refDataError}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={loadReferenceData}
                  style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  <AppIcon name="clock" size={14} style={{ marginRight: '6px' }} />
                  Retry Loading Signatories
                </Button>
              </div>
            ) : signatories.length === 0 ? (
              <EmptyState
                title="No Signing Authorities Found"
                description="No authorized institutional signatories have been registered. Add the Dean – R&D or Vice Chancellor to enable dual signing."
                action={
                  <Button variant="primary" size="sm" onClick={handleOpenAddSignatory}>
                    <span style={{ marginRight: '6px' }}>+</span>
                    Add Signing Authority
                  </Button>
                }
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {signatories.map((sig) => {
                  const hasSignature = Boolean(sig.signature_image_path);
                  const sigUrl = samaAdminService.getSignatorySignatureUrl(sig.id);

                  return (
                    <div
                      key={sig.id}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* Header Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Badge variant={sig.authority_type === 'DEAN_RD' ? 'primary' : 'gold'}>
                          {sig.authority_type === 'DEAN_RD' ? 'Dean – Research & Development' : 'Vice Chancellor'}
                        </Badge>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Badge variant={sig.is_active ? 'teal' : 'neutral'}>
                            {sig.is_active ? 'Active Signatory' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>

                      {/* Dignitary Info */}
                      <div>
                        <div style={{ fontSize: '17px', fontWeight: 700, color: '#0F2B48' }}>
                          {sig.signatory_name}
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
                          {sig.designation}
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
                          {sig.department || 'Chhatrapati Shahu Ji Maharaj University, Kanpur'}
                        </div>
                      </div>

                      {/* Digital Signature Container */}
                      <div
                        style={{
                          background: '#FAF7F0',
                          border: '1px solid #E2D9C8',
                          borderRadius: '8px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#8C6510', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Registered Signature Asset
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            Version: <strong>v{sig.signature_asset_version || 1}</strong>
                          </span>
                        </div>

                        {hasSignature ? (
                          <div
                            style={{
                              background: '#FFFFFF',
                              border: '1px dashed #CBD5E1',
                              borderRadius: '6px',
                              height: '64px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              position: 'relative',
                              cursor: 'pointer',
                            }}
                            onClick={() => setSignaturePreviewSignatory(sig)}
                            title="Click to view high-resolution preview"
                          >
                            <img
                              src={sigUrl}
                              alt={`Signature of ${sig.signatory_name}`}
                              style={{ maxHeight: '52px', maxWidth: '85%', objectFit: 'contain' }}
                              onError={(e) => {
                                // If image fails to load via browser direct fetch, show placeholder
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              background: '#FEF3C7',
                              border: '1px solid #FCD34D',
                              borderRadius: '6px',
                              padding: '10px 12px',
                              fontSize: '12px',
                              color: '#92400E',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span>⚠️</span>
                            <span>
                              No signature uploaded. Official certificates will leave this signature field empty until a transparent PNG is uploaded.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons Toolbar */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          borderTop: '1px solid #F1F5F9',
                          paddingTop: '12px',
                          marginTop: 'auto',
                        }}
                      >
                        {hasSignature && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSignaturePreviewSignatory(sig)}
                            title="Preview full digital signature"
                          >
                            👁️ Preview
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenUploadSignatureModal(sig)}
                        >
                          ✍️ {hasSignature ? 'Replace Signature' : 'Upload Signature'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditSignatory(sig)}
                        >
                          ✏️ Edit Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleSignatoryActive(sig)}
                          disabled={submitting}
                        >
                          {sig.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteSignatoryTarget(sig)}
                          style={{ color: '#DC2626', borderColor: '#FECACA' }}
                          disabled={submitting}
                        >
                          🗑️ Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 6: BULK CERTIFICATE VERIFICATION */}
        {/* =================================================================== */}
        {activeTab === 'verification' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header Description */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '22px' }}>🔍</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F2B48' }}>
                  Institutional Bulk Certificate Verification
                </h3>
                <Badge variant="primary">Super Admin</Badge>
              </div>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B', lineHeight: '1.5' }}>
                Verify batches of up to 250 certificate numbers in a single optimized query. Cross-checks certificate authenticity, lifecycle status, revocation details, superseding chains, scheduled activation dates, and recipient author lists.
              </p>
            </div>

            {/* Input Section */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Input Mode Selector */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
                <Button
                  variant={verifyInputMode === 'TEXT' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setVerifyInputMode('TEXT')}
                >
                  📝 Text / Comma / Newline Input
                </Button>
                <Button
                  variant={verifyInputMode === 'CSV' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setVerifyInputMode('CSV')}
                >
                  📁 CSV / TXT File Upload
                </Button>
              </div>

              {verifyInputMode === 'TEXT' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Paste Certificate Numbers (one per line or comma-separated, max 250):
                  </label>
                  <textarea
                    rows={6}
                    value={verifyRawText}
                    onChange={(e) => setVerifyRawText(e.target.value)}
                    placeholder="VYASA-SAM-2024-0001&#10;VYASA-SAM-2024-0002&#10;VYASA-SAM-2024-0003"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      Tip: Duplicate entries are automatically identified; malformed tokens are flagged as INVALID.
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleRunBulkVerification}
                      disabled={isVerifying || !verifyRawText.trim()}
                    >
                      {isVerifying ? 'Verifying Batch...' : 'Run Bulk Verification'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Upload CSV or Text File (.csv, .txt with certificate numbers, max 2MB):
                  </label>
                  <div
                    style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                      background: '#F8FAFC',
                    }}
                  >
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => setVerifyCsvFile(e.target.files?.[0] || null)}
                      style={{ fontSize: '13px' }}
                    />
                    {verifyCsvFile && (
                      <div style={{ marginTop: '8px', fontSize: '13px', color: '#0F2B48', fontWeight: 600 }}>
                        Selected file: {verifyCsvFile.name} ({(verifyCsvFile.size / 1024).toFixed(1)} KB)
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleUploadCsvVerification}
                      disabled={isVerifying || !verifyCsvFile}
                    >
                      {isVerifying ? 'Uploading & Verifying...' : 'Upload & Verify CSV'}
                    </Button>
                  </div>
                </div>
              )}

              {verifyError && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: '#991B1B',
                  }}
                >
                  ⚠️ {verifyError}
                </div>
              )}
            </div>

            {/* Results Section */}
            {verifyResults && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Metric Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Queried</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#0F2B48', marginTop: '4px' }}>{verifyResults.total_submitted}</div>
                  </div>
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11.5px', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Valid / Issued</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#15803D', marginTop: '4px' }}>{verifyResults.valid_count}</div>
                  </div>
                  <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11.5px', color: '#0369A1', fontWeight: 600, textTransform: 'uppercase' }}>Scheduled</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#0284C7', marginTop: '4px' }}>{verifyResults.scheduled_count}</div>
                  </div>
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11.5px', color: '#991B1B', fontWeight: 600, textTransform: 'uppercase' }}>Revoked</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#DC2626', marginTop: '4px' }}>{verifyResults.revoked_count}</div>
                  </div>
                  <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11.5px', color: '#6D28D9', fontWeight: 600, textTransform: 'uppercase' }}>Superseded</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#7C3AED', marginTop: '4px' }}>{verifyResults.superseded_count}</div>
                  </div>
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11.5px', color: '#92400E', fontWeight: 600, textTransform: 'uppercase' }}>Not Found</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#D97706', marginTop: '4px' }}>{verifyResults.not_found_count}</div>
                  </div>
                  <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>Invalid Format</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#64748B', marginTop: '4px' }}>{verifyResults.invalid_count}</div>
                  </div>
                  <div style={{ background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11.5px', color: '#C2410C', fontWeight: 600, textTransform: 'uppercase' }}>Duplicates</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#EA580C', marginTop: '4px' }}>{verifyResults.duplicate_count}</div>
                  </div>
                </div>

                {/* Filter and Export Toolbar */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ width: '240px' }}>
                      <Input
                        placeholder="Search results..."
                        value={verifySearchQuery}
                        onChange={(e) => setVerifySearchQuery(e.target.value)}
                      />
                    </div>
                    <div style={{ width: '180px' }}>
                      <Select
                        value={verifyStatusFilter}
                        onChange={(e) => setVerifyStatusFilter(e.target.value)}
                        options={[
                          { label: 'All Statuses', value: 'ALL' },
                          { label: 'Valid / Issued', value: 'VALID' },
                          { label: 'Scheduled', value: 'SCHEDULED' },
                          { label: 'Revoked', value: 'REVOKED' },
                          { label: 'Superseded', value: 'SUPERSEDED' },
                          { label: 'Not Found', value: 'NOT_FOUND' },
                          { label: 'Invalid Format', value: 'INVALID' },
                        ]}
                      />
                    </div>
                    <span style={{ fontSize: '12.5px', color: '#64748B' }}>
                      Showing {filteredVerifyResults.length} of {verifyResults.results.length} items
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportVerificationCsv}
                  >
                    📥 Export Verification CSV
                  </Button>
                </div>

                {/* Verification Results Table */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    overflowX: 'auto',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600, width: '40px' }}>#</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>Certificate Number</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600, width: '140px' }}>Status</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>Recipient / Research</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>Issue / Scheduled Date</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>Details / Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVerifyResults.map((item: CertificateVerificationItem, idx: number) => {
                        const statusColors: Record<string, { bg: string; text: string; border: string }> = {
                          'VALID / ISSUED': { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
                          SCHEDULED: { bg: '#F0F9FF', text: '#0284C7', border: '#BAE6FD' },
                          REVOKED: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
                          SUPERSEDED: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
                          NOT_FOUND: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
                          INVALID: { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
                        };
                        const sc = statusColors[item.status] || { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' };

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 14px', color: '#94A3B8', fontFamily: 'monospace' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F2B48' }}>
                                {item.certificate_number || item.input_text}
                              </span>
                              {item.is_duplicate && (
                                <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '4px', background: '#FFEDD5', color: '#C2410C', fontSize: '10.5px', fontWeight: 600 }}>
                                  DUPLICATE
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  background: sc.bg,
                                  color: sc.text,
                                  border: `1px solid ${sc.border}`,
                                }}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {item.recipient_name ? (
                                <div>
                                  <span style={{ fontWeight: 600, color: '#1E293B' }}>{item.recipient_name}</span>
                                  {item.research_title && (
                                    <div style={{ fontSize: '11.5px', color: '#64748B', fontStyle: 'italic', marginTop: '2px' }}>
                                      {item.research_title.slice(0, 60)}{item.research_title.length > 60 ? '...' : ''}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#94A3B8' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>
                              {item.status === 'SCHEDULED' && item.scheduled_issue_date ? (
                                <span style={{ color: '#0284C7', fontWeight: 600 }}>⏰ {item.scheduled_issue_date}</span>
                              ) : item.issue_date ? (
                                item.issue_date
                              ) : (
                                <span style={{ color: '#94A3B8' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                              {item.revocation_reason ? (
                                <span style={{ color: '#DC2626' }}>Reason: {item.revocation_reason}</span>
                              ) : item.replacement_certificate_number ? (
                                <span style={{ color: '#7C3AED' }}>Superseded by: {item.replacement_certificate_number}</span>
                              ) : item.error_message ? (
                                <span style={{ color: '#64748B' }}>{item.error_message}</span>
                              ) : (
                                <span style={{ color: '#94A3B8' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: CREATE JOINT CERTIFICATE WIZARD */}
        {/* =================================================================== */}
        {showWizardModal && (
          <Modal
            isOpen={showWizardModal}
            onClose={() => setShowWizardModal(false)}
            title="Create Joint Institutional Certificate"
            className="vyasa-modal--lg"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Wizard Steps Progress Indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: '14px',
                  gap: '8px',
                }}
              >
                {[
                  { num: 1, title: 'Template & Scope', subtitle: 'Layout & Type' },
                  { num: 2, title: `Recipient Authors (${wizardAuthors.length})`, subtitle: 'Order & Credentials' },
                  { num: 3, title: 'Publication Details', subtitle: 'Title & Citations' },
                  { num: 4, title: 'Review & Issue', subtitle: 'Verification & Seal' },
                ].map((item, idx, arr) => {
                  const isCurrent = wizardStep === item.num;
                  const isDone = wizardStep > item.num;
                  return (
                    <React.Fragment key={item.num}>
                      <div
                        onClick={() => {
                          if (isDone) setWizardStep(item.num);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: isDone ? 'pointer' : 'default',
                          userSelect: 'none',
                        }}
                      >
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isCurrent ? '#B2811A' : isDone ? '#0F2B48' : '#F1F5F9',
                            color: isCurrent || isDone ? '#FFFFFF' : '#64748B',
                            boxShadow: isCurrent ? '0 0 0 3px rgba(178, 129, 26, 0.2)' : 'none',
                            flexShrink: 0,
                            transition: 'all 0.15s ease-in-out',
                          }}
                        >
                          {isDone ? '✓' : item.num}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '12.5px',
                              fontWeight: isCurrent ? 700 : isDone ? 600 : 500,
                              color: isCurrent ? '#B2811A' : isDone ? '#0F2B48' : '#64748B',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.title}
                          </div>
                          <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      {idx < arr.length - 1 && (
                        <div
                          style={{
                            height: '1px',
                            backgroundColor: isDone ? '#0F2B48' : '#E2E8F0',
                            flex: 1,
                            minWidth: '12px',
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* STEP 1: Category, Bulletin & Template Selection */}
              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Category Selector (Two Official University Streams) */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                      1. Select Certificate Category *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div
                        onClick={() => handleSwitchWizardCategory('RESEARCH_PUBLICATION')}
                        style={{
                          border: wizardCategory === 'RESEARCH_PUBLICATION' ? '2px solid #0F2B48' : '1px solid #CBD5E1',
                          borderRadius: '8px',
                          padding: '14px',
                          backgroundColor: wizardCategory === 'RESEARCH_PUBLICATION' ? '#F0F9FF' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.15s ease-in-out',
                        }}
                      >
                        <span style={{ fontSize: '24px' }}>📚</span>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F2B48' }}>
                            Research Work Certificate
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                            Scholarly research publications, journal citations & academic excellence
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => handleSwitchWizardCategory('INCENTIVE_AWARD')}
                        style={{
                          border: wizardCategory === 'INCENTIVE_AWARD' ? '2px solid #B2811A' : '1px solid #CBD5E1',
                          borderRadius: '8px',
                          padding: '14px',
                          backgroundColor: wizardCategory === 'INCENTIVE_AWARD' ? '#FAF7F0' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.15s ease-in-out',
                        }}
                      >
                        <span style={{ fontSize: '24px' }}>🏆</span>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#B2811A' }}>
                            Incentive Certificate
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                            Approved research incentive sanction awards & policy incentives
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Research Bulletin Selection (Hierarchical Volume & Issue) */}
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          2. Associate Research Bulletin Edition *
                        </span>
                        <Badge variant="teal">Mandatory Citation</Badge>
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        {bulletins.length} edition{bulletins.length === 1 ? '' : 's'} on record
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px', marginBottom: '10px' }}>
                      {/* Volume Selector */}
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                          Bulletin Volume
                        </label>
                        <select
                          value={wizardBulletinVolume}
                          onChange={(e) => handleSelectBulletinVolume(e.target.value)}
                          style={{
                            width: '100%',
                            fontSize: '12.5px',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#0F2B48',
                            fontWeight: 600,
                            height: '38px',
                          }}
                        >
                          <option value="">-- Select Volume --</option>
                          {Array.from(new Set(bulletins.map((b) => b.volume_number || b.volume).filter(Boolean)))
                            .sort((a, b) => (Number(b) || 0) - (Number(a) || 0))
                            .map((vol) => (
                              <option key={String(vol)} value={String(vol)}>
                                Volume {vol}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Issue Selector */}
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                          Issue &amp; Publication Period
                        </label>
                        <select
                          value={wizardBulletinId}
                          onChange={(e) => {
                            const bId = e.target.value;
                            setWizardBulletinId(bId);
                            const found = bulletins.find((b) => b.id === bId);
                            if (found && !wizardBulletinVolume) {
                              const v = found.volume_number || found.volume;
                              if (v) setWizardBulletinVolume(String(v));
                            }
                          }}
                          disabled={!wizardBulletinVolume && bulletins.length > 0}
                          style={{
                            width: '100%',
                            fontSize: '12.5px',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: !wizardBulletinVolume ? '#F1F5F9' : '#FFFFFF',
                            color: '#0F2B48',
                            fontWeight: 600,
                            height: '38px',
                          }}
                        >
                          <option value="">-- Select Issue Edition --</option>
                          {bulletins
                            .filter((b) => !wizardBulletinVolume || (b.volume_number || b.volume) === parseInt(wizardBulletinVolume, 10))
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                Issue {b.issue_number || b.issue} — {b.publication_period || b.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Selected Bulletin Banner */}
                    {wizardBulletinId ? (
                      (() => {
                        const selB = bulletins.find((b) => b.id === wizardBulletinId);
                        if (!selB) return null;
                        return (
                          <div
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #0D9488',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                              color: '#0F2B48',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>🏛️</span>
                              <span>
                                <strong>CSJMU Research Bulletin:</strong> Volume {selB.volume_number} • Issue {selB.issue_number} ({selB.publication_period || 'Regular Edition'})
                              </span>
                            </div>
                            <Badge variant="teal">✓ Verified Edition</Badge>
                          </div>
                        );
                      })()
                    ) : (
                      <div style={{ fontSize: '11.5px', color: '#DC2626', marginTop: '4px' }}>
                        ⚠️ You must select an official Volume and Issue to generate institutional citation and proceed.
                      </div>
                    )}
                  </div>

                  {/* Template Visual Cards (Filtered to selected category) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        3. University Certificate Template Layout
                      </label>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        {templates.filter((tpl) => !wizardCategory || tpl.certificate_type === wizardCategory || (!tpl.certificate_type && wizardCategory === 'RESEARCH_PUBLICATION')).length} template(s) for category
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                      {templates
                        .filter((tpl) => !wizardCategory || tpl.certificate_type === wizardCategory || (!tpl.certificate_type && wizardCategory === 'RESEARCH_PUBLICATION'))
                        .map((tpl) => {
                          const isSelected = wizardTemplateId === tpl.id || (!wizardTemplateId && (tpl.is_default || tpl.code.includes(wizardCategory)));
                          return (
                            <div
                              key={tpl.id}
                              onClick={() => setWizardTemplateId(tpl.id)}
                              style={{
                                border: isSelected ? '2px solid #B2811A' : '1px solid #CBD5E1',
                                borderRadius: '8px',
                                padding: '12px',
                                backgroundColor: isSelected ? '#FAF7F0' : '#FFFFFF',
                                boxShadow: isSelected ? '0 4px 12px rgba(178, 129, 26, 0.15)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease-in-out',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#6B1D2F', letterSpacing: '0.05em' }}>
                                  {tpl.code}
                                </span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {tpl.is_default && <Badge variant="gold">Default</Badge>}
                                  {isSelected && <Badge variant="teal">✓ Selected</Badge>}
                                </div>
                              </div>

                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', lineHeight: 1.3 }}>
                                {tpl.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                                Category: <strong>{tpl.certificate_type === 'INCENTIVE_AWARD' ? 'Research Incentive' : 'Research Publication'}</strong>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748B' }}>
                                Format: <strong>Landscape A4 (297 × 210 mm)</strong>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Date of Issue Selection (Current Date default, future scheduling, retrospective limits) */}
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                        4. Official Date of Issuance *
                      </label>
                      {(() => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        if (wizardIssueDate > todayStr) {
                          return <Badge variant="gold">⏰ Scheduled Future Issuance</Badge>;
                        } else if (wizardIssueDate === todayStr) {
                          return <Badge variant="teal">⚡ Immediate Activation</Badge>;
                        } else {
                          return <Badge variant="neutral">📜 Retrospective Issuance</Badge>;
                        }
                      })()}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '14px', alignItems: 'center' }}>
                      <input
                        type="date"
                        value={wizardIssueDate}
                        onChange={(e) => setWizardIssueDate(e.target.value)}
                        style={{
                          padding: '8px 12px',
                          border: '1.5px solid #CBD5E1',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0F2B48',
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                        {(() => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          if (wizardIssueDate > todayStr) {
                            return (
                              <span style={{ color: '#0284C7', fontWeight: 500 }}>
                                ℹ️ <strong>Future-dated:</strong> Certificate will enter <strong>SCHEDULED</strong> status upon approval/creation. It remains completely hidden from all public verification, Scopus discovery, and download interfaces until <strong>{wizardIssueDate} at 00:00 IST</strong>, when it will activate automatically.
                              </span>
                            );
                          } else if (wizardIssueDate === todayStr) {
                            return (
                              <span style={{ color: '#166534' }}>
                                ✓ <strong>Current Date:</strong> Certificate activates immediately upon final approval or issuance.
                              </span>
                            );
                          } else {
                            return (
                              <span style={{ color: '#475569' }}>
                                ℹ️ <strong>Retrospective:</strong> Backfilled issuance date. Institutional policy allows retrospective dates up to 365 days past.
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Certificate Formal Heading</label>
                    <Input value={wizardTitle} onChange={(e) => setWizardTitle(e.target.value)} />
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Presentation Statement</label>
                    <Input value={wizardPresentation} onChange={(e) => setWizardPresentation(e.target.value)} />
                  </div>
                </div>
              )}

              {/* STEP 2: Multi-Author Management & Researcher Directory */}
              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Real-Time Autocomplete Directory Search */}
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '16px',
                      boxShadow: '0 1px 2px rgba(15, 43, 72, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F2B48', letterSpacing: '-0.01em' }}>
                          🏛️ Search Institutional Directory
                        </span>
                        <Badge variant="teal">समीक्षा Verified</Badge>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Title:</span>
                          <select
                            aria-label="Directory Author Title"
                            value={selectedDirectoryAuthorTitle}
                            onChange={(e) => setSelectedDirectoryAuthorTitle(e.target.value)}
                            style={{
                              fontSize: '12.5px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#0F2B48',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <option value="None">None</option>
                            <option value="Dr.">Dr.</option>
                            <option value="Prof.">Prof.</option>
                            <option value="Mr.">Mr.</option>
                            <option value="Ms.">Ms.</option>
                            <option value="Mrs.">Mrs.</option>
                            <option value="Er.">Er.</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Assign Role:</span>
                          <select
                            aria-label="Directory Author Role"
                            value={selectedDirectoryAuthorRole}
                            onChange={(e) => setSelectedDirectoryAuthorRole(e.target.value)}
                            style={{
                              fontSize: '12.5px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#0F2B48',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <option value="First Author">First Author</option>
                            <option value="Corresponding Author">Corresponding Author</option>
                            <option value="Co-Author">Co-Author</option>
                            <option value="Principal Investigator">Principal Investigator</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <Input
                        placeholder="Search by researcher name, department, or Scopus ID..."
                        value={searchAuthorQuery}
                        onChange={(e) => setSearchAuthorQuery(e.target.value)}
                        style={{ paddingLeft: '34px' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          left: '11px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '14px',
                          color: '#94A3B8',
                          pointerEvents: 'none',
                        }}
                      >
                        🔍
                      </span>
                      {searchAuthorQuery.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSearchAuthorQuery('')}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            fontSize: '13px',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Autocomplete Suggestions Dropdown */}
                    {searchAuthorQuery.trim().length > 0 && (
                      <div
                        style={{
                          marginTop: '8px',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          maxHeight: '260px',
                          overflowY: 'auto',
                          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
                        }}
                      >
                        {isSearchingAuthors && displayedDirectoryAuthors.length === 0 ? (
                          <div style={{ padding: '14px', fontSize: '12.5px', color: '#64748B', textAlign: 'center' }}>
                            Searching Institutional Directory...
                          </div>
                        ) : displayedDirectoryAuthors.length === 0 ? (
                          <div style={{ padding: '14px', fontSize: '12.5px', color: '#64748B', textAlign: 'center' }}>
                            No matching researchers found in directory. Use manual entry below for external collaborators.
                          </div>
                        ) : (
                          displayedDirectoryAuthors.slice(0, 12).map((a) => {
                            const isAlreadyAdded = wizardAuthors.some((auth) => auth.researcher_id === a.id);
                            return (
                              <div
                                key={a.id}
                                onClick={() => {
                                  if (!isAlreadyAdded) handleAddAuthorFromDirectory(a);
                                }}
                                style={{
                                  padding: '10px 14px',
                                  borderBottom: '1px solid #F1F5F9',
                                  cursor: isAlreadyAdded ? 'not-allowed' : 'pointer',
                                  backgroundColor: isAlreadyAdded ? '#F8FAFC' : '#FFFFFF',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: 'background-color 0.1s ease',
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px', color: isAlreadyAdded ? '#94A3B8' : '#0F2B48' }}>
                                      {a.full_name}
                                    </span>
                                    {a.is_verified && (
                                      <Badge variant="teal">Directory Verified</Badge>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                                    {a.department || 'Chhatrapati Shahu Ji Maharaj University, Kanpur'}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  {a.scopus_id ? (
                                    <Badge variant="gold">Scopus: {a.scopus_id}</Badge>
                                  ) : (
                                    <Badge variant="neutral">No Scopus ID</Badge>
                                  )}
                                  {isAlreadyAdded ? (
                                    <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Already Added</span>
                                  ) : (
                                    <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); handleAddAuthorFromDirectory(a); }}>
                                      + Add
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Manual Author Entry Fallback (Structured 2-Row Form) */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '16px',
                      boxShadow: '0 1px 2px rgba(15, 43, 72, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F2B48' }}>
                            ✍️ Add External / Non-Directory Author
                          </span>
                          <Badge variant="neutral">Manual Entry</Badge>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          For external university collaborators, visiting scholars, or researchers not in the local directory
                        </div>
                      </div>
                    </div>

                    {/* Row 1: Title, Legal Name, Role */}
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1.8fr 1.2fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '4px' }}>
                          Title
                        </label>
                        <select
                          aria-label="Manual Author Title"
                          value={manualAuthorTitle}
                          onChange={(e) => setManualAuthorTitle(e.target.value)}
                          style={{
                            width: '100%',
                            fontSize: '12.5px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#0F2B48',
                            height: '38px',
                            fontWeight: 500,
                          }}
                        >
                          <option value="None">None</option>
                          <option value="Dr.">Dr.</option>
                          <option value="Prof.">Prof.</option>
                          <option value="Mr.">Mr.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Er.">Er.</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '4px' }}>
                          Full Legal Name <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <Input
                          placeholder="e.g. Ramesh Chandra Verma"
                          value={manualAuthorName}
                          onChange={(e) => setManualAuthorName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddManualAuthor();
                            }
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '4px' }}>
                          Author Role
                        </label>
                        <select
                          value={manualAuthorRole}
                          onChange={(e) => setManualAuthorRole(e.target.value)}
                          style={{
                            width: '100%',
                            fontSize: '12.5px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#0F2B48',
                            height: '38px',
                            fontWeight: 500,
                          }}
                        >
                          <option value="First Author">First Author</option>
                          <option value="Corresponding Author">Corresponding Author</option>
                          <option value="Co-Author">Co-Author</option>
                          <option value="Principal Investigator">Principal Investigator</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Department, Affiliation, Scopus ID, Add Button */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 130px auto', gap: '12px', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '4px' }}>
                          Department
                        </label>
                        <Input
                          placeholder="e.g. Physics & Materials"
                          value={manualAuthorDept}
                          onChange={(e) => setManualAuthorDept(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '4px' }}>
                          Affiliation / Institution
                        </label>
                        <Input
                          placeholder="e.g. IIT Kanpur / BHU / External Univ"
                          value={manualAuthorAffiliation}
                          onChange={(e) => setManualAuthorAffiliation(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '4px' }}>
                          Scopus ID (opt.)
                        </label>
                        <Input
                          placeholder="e.g. 57201234567"
                          value={manualAuthorScopusId}
                          onChange={(e) => setManualAuthorScopusId(e.target.value)}
                        />
                      </div>

                      <div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleAddManualAuthor}
                          style={{
                            height: '38px',
                            padding: '0 18px',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600,
                            backgroundColor: '#0F2B48',
                            borderColor: '#0F2B48',
                          }}
                        >
                          <span>+ Add Author</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Current Authors List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F2B48' }}>
                          📜 Authors Included on Certificate
                        </span>
                        <Badge variant={wizardAuthors.length > 0 ? 'gold' : 'neutral'}>
                          {wizardAuthors.length} {wizardAuthors.length === 1 ? 'Recipient' : 'Recipients'}
                        </Badge>
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        Use ↑ / ↓ to adjust order (Author #1 is designated as the primary recipient on the printed certificate)
                      </span>
                    </div>

                    {wizardAuthors.length === 0 ? (
                      <div
                        style={{
                          border: '2px dashed #CBD5E1',
                          borderRadius: '10px',
                          padding: '28px 16px',
                          textAlign: 'center',
                          backgroundColor: '#F8FAFC',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <div style={{ fontSize: '28px', color: '#94A3B8' }}>👥</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#334155' }}>
                          No Authors Added Yet
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '420px', lineHeight: 1.4 }}>
                          Search the institutional directory above or manually enter external collaborators to add at least one recipient to this certificate.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                        {wizardAuthors.map((auth, idx) => {
                          const isPrimary = idx === 0;
                          return (
                            <div
                              key={idx}
                              style={{
                                background: isPrimary ? '#FAF7F0' : '#FFFFFF',
                                border: `1.5px solid ${isPrimary ? '#B2811A' : '#E2E8F0'}`,
                                borderRadius: '8px',
                                padding: '12px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                boxShadow: isPrimary ? '0 2px 6px rgba(178, 129, 26, 0.12)' : '0 1px 3px rgba(0, 0, 0, 0.03)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                <div
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    backgroundColor: isPrimary ? '#B2811A' : '#64748B',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                  title={`Author Order #${auth.author_order}${isPrimary ? ' (Lead Author)' : ''}`}
                                >
                                  #{auth.author_order}
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <select
                                      aria-label={`Author Title for ${auth.author_name_snapshot}`}
                                      value={auth.academic_title_snapshot || 'None'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updated = [...wizardAuthors];
                                        updated[idx] = {
                                          ...updated[idx],
                                          academic_title_snapshot: val === 'None' ? null : val,
                                        };
                                        setWizardAuthors(updated);
                                      }}
                                      style={{
                                        fontSize: '11.5px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid #CBD5E1',
                                        backgroundColor: '#FFFFFF',
                                        color: '#0F2B48',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        height: '26px',
                                      }}
                                    >
                                      <option value="None">None</option>
                                      <option value="Dr.">Dr.</option>
                                      <option value="Prof.">Prof.</option>
                                      <option value="Mr.">Mr.</option>
                                      <option value="Ms.">Ms.</option>
                                      <option value="Mrs.">Mrs.</option>
                                      <option value="Er.">Er.</option>
                                    </select>
                                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F2B48' }}>
                                      {auth.author_name_snapshot}
                                    </span>
                                    {isPrimary && (
                                      <span
                                        style={{
                                          fontSize: '10.5px',
                                          fontWeight: 700,
                                          color: '#B2811A',
                                          backgroundColor: '#FEF3C7',
                                          border: '1px solid #FDE68A',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.04em',
                                        }}
                                      >
                                        ⭐ Primary Recipient
                                      </span>
                                    )}
                                    <Badge variant={auth.author_role === 'First Author' ? 'gold' : auth.author_role === 'Corresponding Author' ? 'teal' : 'neutral'}>
                                      {auth.author_role}
                                    </Badge>
                                    {auth.scopus_id_snapshot ? (
                                      <Badge variant="gold">Scopus: {auth.scopus_id_snapshot}</Badge>
                                    ) : (
                                      <Badge variant="neutral">No Scopus ID</Badge>
                                    )}
                                    {auth.researcher_id ? (
                                      <Badge variant="teal">Directory</Badge>
                                    ) : (
                                      <Badge variant="neutral">External</Badge>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {auth.department_snapshot} • {auth.affiliation_snapshot}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '12px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleMoveWizardAuthor(idx, 'UP')}
                                  disabled={idx === 0}
                                  title="Move author up"
                                  style={{
                                    background: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '5px',
                                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                    opacity: idx === 0 ? 0.35 : 1,
                                    padding: '5px 9px',
                                    fontSize: '12px',
                                    lineHeight: 1,
                                    color: '#0F2B48',
                                    fontWeight: 600,
                                  }}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveWizardAuthor(idx, 'DOWN')}
                                  disabled={idx === wizardAuthors.length - 1}
                                  title="Move author down"
                                  style={{
                                    background: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '5px',
                                    cursor: idx === wizardAuthors.length - 1 ? 'not-allowed' : 'pointer',
                                    opacity: idx === wizardAuthors.length - 1 ? 0.35 : 1,
                                    padding: '5px 9px',
                                    fontSize: '12px',
                                    lineHeight: 1,
                                    color: '#0F2B48',
                                    fontWeight: 600,
                                  }}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveWizardAuthor(idx)}
                                  title="Remove author from certificate"
                                  style={{
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    padding: '5px 9px',
                                    fontSize: '12px',
                                    lineHeight: 1,
                                    color: '#DC2626',
                                    fontWeight: 700,
                                    marginLeft: '4px',
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Publication / Incentive Details */}
              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {wizardCategory === 'INCENTIVE_AWARD' ? (
                    /* INCENTIVE AWARD DETAILS */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ background: '#FAF7F0', border: '1.5px solid #B2811A', borderRadius: '10px', padding: '16px' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#B2811A', textTransform: 'uppercase', marginBottom: '10px' }}>
                          🏆 Research Incentive Sanction Particulars
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                              Approved Incentive Amount (₹)
                            </label>
                            <Input
                              placeholder="e.g. 25000"
                              value={wizardIncentiveAmount}
                              onChange={(e) => setWizardIncentiveAmount(e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                              Sanction Order / Resolution Reference
                            </label>
                            <Input
                              placeholder="e.g. CSJMU/RD/INCENTIVE/2026/042"
                              value={wizardSanctionRef}
                              onChange={(e) => setWizardSanctionRef(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                          Associated Research Paper / Publication Title *
                        </label>
                        <Input
                          value={wizardResearchTitle}
                          onChange={(e) => setWizardResearchTitle(e.target.value)}
                          placeholder="e.g. Exploring the dielectric, supercapacitor and photocatalytic capabilities of sol-gel synthesized TiC nanoparticles"
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Award Recognition Statement</label>
                        <Input value={wizardContribution} onChange={(e) => setWizardContribution(e.target.value)} />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Commendation Statement</label>
                        <Input value={wizardCongratulatory} onChange={(e) => setWizardCongratulatory(e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    /* RESEARCH PUBLICATION DETAILS */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Associate Existing Publication (Optional)</label>
                        <Select
                          value={wizardPublicationId}
                          onChange={(e) => handleSelectPublicationForWizard(e.target.value)}
                          options={[
                            { label: '-- Select publication from समीक्षा database --', value: '' },
                            ...publications
                              .filter((p) => !wizardBulletinId || p.bulletin_id === wizardBulletinId)
                              .map((p) => ({ label: `${p.title} (${p.source_journal || 'CSJMU'})`, value: p.id })),
                            ...(wizardBulletinId && publications.some((p) => p.bulletin_id !== wizardBulletinId)
                              ? publications
                                  .filter((p) => p.bulletin_id !== wizardBulletinId)
                                  .map((p) => ({ label: `[Other Bulletin] ${p.title} (${p.source_journal || 'CSJMU'})`, value: p.id }))
                              : []),
                          ]}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Research Paper / Publication Title *</label>
                        <Input
                          value={wizardResearchTitle}
                          onChange={(e) => setWizardResearchTitle(e.target.value)}
                          placeholder="e.g. Exploring the dielectric, supercapacitor and photocatalytic capabilities of sol-gel synthesized TiC nanoparticles"
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Contribution Statement</label>
                        <Input value={wizardContribution} onChange={(e) => setWizardContribution(e.target.value)} />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Congratulatory Note</label>
                        <Input value={wizardCongratulatory} onChange={(e) => setWizardCongratulatory(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Review, Live Vector PDF Preview & Submission */}
              {wizardStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Summary Card */}
                  <div style={{ background: '#FAF7F0', border: '1px solid #B2811A', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#B2811A', textTransform: 'uppercase' }}>Certificate Summary</span>
                        <Badge variant={wizardCategory === 'INCENTIVE_AWARD' ? 'gold' : 'teal'}>
                          {wizardCategory === 'INCENTIVE_AWARD' ? '🏆 Incentive Certificate' : '📚 Research Work'}
                        </Badge>
                      </div>
                      <Badge variant="neutral">
                        {templates.find((t) => t.id === wizardTemplateId)?.name || 'Default Template'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F2B48', marginTop: '6px' }}>{wizardTitle}</div>
                    <div style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', marginTop: '3px' }}>"{wizardResearchTitle}"</div>
                    {wizardBulletinId && (() => {
                      const b = bulletins.find((x) => x.id === wizardBulletinId);
                      return b ? (
                        <div style={{ fontSize: '12px', color: '#0D9488', fontWeight: 600, marginTop: '6px' }}>
                          🏛️ Research Bulletin: Volume {b.volume_number} • Issue {b.issue_number} ({b.publication_period || 'Verified Edition'})
                        </div>
                      ) : null;
                    })()}
                    {wizardCategory === 'INCENTIVE_AWARD' && wizardIncentiveAmount && (
                      <div style={{ fontSize: '12.5px', color: '#B2811A', fontWeight: 700, marginTop: '4px' }}>
                        💰 Sanctioned Incentive: ₹ {wizardIncentiveAmount} {wizardSanctionRef ? `(Ref: ${wizardSanctionRef})` : ''}
                      </div>
                    )}
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F2B48', marginTop: '8px' }}>
                      Recipients ({wizardAuthors.length}): {wizardAuthors.map((a) => `${a.academic_title_snapshot && a.academic_title_snapshot !== 'None' ? `${a.academic_title_snapshot} ` : ''}${a.author_name_snapshot} (${a.author_role})`).join(' • ')}
                    </div>
                  </div>

                  {/* Prominent Live Vector PDF Preview Action */}
                  <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48' }}>
                        Live Vector PDF Preview (Temporary Draft Render)
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                        Renders the vector certificate with dynamic typography, DRAFT watermark, and placeholder signatures without reserving a certificate number.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={renderingWizardPreview}
                      onClick={handleGenerateWizardPreview}
                    >
                      {renderingWizardPreview ? 'Rendering Vector PDF...' : 'Preview Vector PDF'}
                    </Button>
                  </div>

                  {/* Manual Identifiers & Legacy QR Restoration Overrides (Optional) */}
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48' }}>
                        Manual Identifiers & Legacy QR Restoration (Optional)
                      </span>
                      <Badge variant="neutral">Optional Overrides</Badge>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginBottom: '12px', lineHeight: '1.4' }}>
                      Leave blank to use automatic generation. Enter manual values only when specific credentials or previously printed QR verification URLs must be restored.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {/* Certificate Number */}
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                          Certificate Number (Optional)
                        </label>
                        <Input
                          value={wizardCertNumber}
                          onChange={(e) => setWizardCertNumber(e.target.value)}
                          placeholder="Auto-generated if left blank"
                          style={{ fontSize: '12.5px' }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', lineHeight: '1.3' }}>
                          Leave blank to generate automatically. Enter a value only when a specific certificate number is required.
                        </div>
                      </div>

                      {/* Verification Identifier */}
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                          Verification Identifier (Optional)
                        </label>
                        <Input
                          value={wizardVerificationId}
                          onChange={(e) => handleVerificationIdChange(e.target.value)}
                          placeholder="Auto-generated if left blank"
                          style={{ fontSize: '12.5px' }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', lineHeight: '1.3' }}>
                          Leave blank to generate automatically. Enter an existing identifier to restore a previously printed QR verification URL.
                        </div>
                      </div>
                    </div>

                    {/* Extracted URL Notice */}
                    {wizardUrlExtractionNotice && (
                      <div style={{ marginTop: '10px', fontSize: '11.5px', color: wizardUrlExtractionNotice.startsWith('Warning') ? '#DC2626' : '#059669', fontWeight: 500 }}>
                        {wizardUrlExtractionNotice}
                      </div>
                    )}

                    {/* Live Verification URL Preview */}
                    {wizardVerificationUrlPreview && (
                      <div style={{ marginTop: '10px', padding: '8px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Resolved Verification URL:</span>
                        <code style={{ fontSize: '11.5px', color: '#15803D', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                          {wizardVerificationUrlPreview}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Submission Workflow Mode Selection */}
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Issuance Workflow Mode</label>
                    <Select
                      value={wizardSubmitMode}
                      onChange={(e) => setWizardSubmitMode(e.target.value as any)}
                      options={[
                        { label: 'Submit for Dual Authority Approval (Dean R&D & VC)', value: 'APPROVAL' },
                        { label: 'Direct Official Issuance (Super Admin immediate seal)', value: 'DIRECT' },
                        { label: 'Save as Draft', value: 'DRAFT' },
                      ]}
                    />
                  </div>

                  {/* Direct Issuance Warning & Mandatory Justification */}
                  {wizardSubmitMode === 'DIRECT' && (
                    <div style={{ background: '#FFFBEB', border: '1px solid #F59E0B', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', marginBottom: '4px' }}>
                        ⚠️ Institutional Direct Issuance Notice
                      </div>
                      <div style={{ fontSize: '12px', color: '#92400E', marginBottom: '8px' }}>
                        Direct issuance immediately affixes the official seal and generates permanent credentials, bypassing the Dean R&D and Vice Chancellor dual approval workflow. This action is permanently recorded in the immutable institutional audit ledger with your user identity and timestamp.
                      </div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#78350F' }}>
                        Mandatory Institutional Justification / Audit Rationale * (min 10 characters):
                      </label>
                      <textarea
                        value={wizardDirectJustification}
                        onChange={(e) => setWizardDirectJustification(e.target.value)}
                        placeholder="State the institutional council directive or official reason for direct seal issuance..."
                        rows={3}
                        style={{
                          width: '100%',
                          marginTop: '4px',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #D97706',
                          fontSize: '12.5px',
                          fontFamily: 'inherit',
                        }}
                      />
                      <div style={{ fontSize: '11px', color: wizardDirectJustification.trim().length >= 10 ? '#059669' : '#DC2626', marginTop: '2px' }}>
                        {wizardDirectJustification.trim().length}/10 characters minimum
                      </div>
                    </div>
                  )}

                  {wizardSubmitMode === 'APPROVAL' && (
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#1E40AF' }}>
                      <strong>Standard Dual Approval Routing:</strong> The certificate will enter the Dean – R&D queue for academic verification, followed by the Vice Chancellor queue for final seal and cryptographic registration.
                    </div>
                  )}
                </div>
              )}

              {/* Wizard Navigation Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={wizardStep === 1}
                  onClick={() => setWizardStep(wizardStep - 1)}
                >
                  ← Back
                </Button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {wizardStep === 1 && !wizardBulletinId && (
                    <span style={{ fontSize: '11.5px', color: '#DC2626', fontWeight: 500 }}>
                      Select a Research Bulletin edition to proceed
                    </span>
                  )}
                  {wizardStep === 2 && wizardAuthors.length === 0 && (
                    <span style={{ fontSize: '11.5px', color: '#DC2626', fontWeight: 500 }}>
                      Add at least one author to proceed
                    </span>
                  )}
                  {wizardStep === 3 && !wizardResearchTitle.trim() && (
                    <span style={{ fontSize: '11.5px', color: '#DC2626', fontWeight: 500 }}>
                      Enter research title to proceed
                    </span>
                  )}
                  {wizardStep < 4 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={
                        (wizardStep === 1 && !wizardBulletinId) ||
                        (wizardStep === 2 && wizardAuthors.length === 0) ||
                        (wizardStep === 3 && !wizardResearchTitle.trim())
                      }
                      onClick={() => setWizardStep(wizardStep + 1)}
                    >
                      Next Step →
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={submitting}
                      onClick={handleSubmitWizard}
                      style={{ backgroundColor: '#B2811A', borderColor: '#B2811A' }}
                    >
                      {submitting ? 'Processing...' : 'Complete & Submit Certificate'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: LIVE VECTOR PDF PREVIEW (PHASE 1) */}
        {/* =================================================================== */}
        {showWizardPreviewModal && wizardPreviewBlobUrl && (
          <Modal
            isOpen={showWizardPreviewModal}
            onClose={() => setShowWizardPreviewModal(false)}
            title="Live Vector PDF Preview (Temporary Draft Render)"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Draft Watermark Advisory Banner */}
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #F87171',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <div style={{ fontSize: '12px', color: '#991B1B', lineHeight: 1.4 }}>
                  <strong>DRAFT PREVIEW MODE:</strong> This vector PDF was generated on-the-fly using the ReportLab engine with semi-transparent draft watermarks and preview placeholders for verification QR codes and official signatures. No permanent certificate record or unique sequence number has been reserved.
                </div>
              </div>

              {/* Controls Toolbar: Zoom, Open in Tab, Close */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Zoom:</span>
                  {[75, 100, 125, 150].map((z) => (
                    <button
                      key={z}
                      onClick={() => setPreviewZoom(z)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: previewZoom === z ? '1px solid #B2811A' : '1px solid #CBD5E1',
                        background: previewZoom === z ? '#FAF7F0' : '#FFFFFF',
                        fontWeight: previewZoom === z ? 700 : 500,
                        color: previewZoom === z ? '#B2811A' : '#334155',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      }}
                    >
                      {z}%
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href={wizardPreviewBlobUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-block',
                      textDecoration: 'none',
                      fontSize: '12px',
                      color: '#0284C7',
                      fontWeight: 600,
                      padding: '4px 8px',
                    }}
                  >
                    Open in Tab ↗
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = wizardPreviewBlobUrl;
                      link.download = `CSJMU_Certificate_Draft_Preview_${Date.now()}.pdf`;
                      link.click();
                    }}
                  >
                    Download Draft PDF
                  </Button>
                </div>
              </div>

              {/* Embed / Iframe Viewer */}
              <div
                style={{
                  width: '100%',
                  height: '520px',
                  overflow: 'auto',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  background: '#525659',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <iframe
                  src={`${wizardPreviewBlobUrl}#zoom=${previewZoom}`}
                  title="Certificate Vector Preview"
                  style={{
                    width: `${previewZoom}%`,
                    height: '100%',
                    border: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                <Button variant="primary" size="sm" onClick={() => setShowWizardPreviewModal(false)}>
                  Close Preview
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: APPROVAL DECISION */}
        {/* =================================================================== */}
        {showApprovalModal && selectedCert && (
          <Modal
            isOpen={showApprovalModal}
            onClose={() => setShowApprovalModal(false)}
            title={`Authority Review: ${approvalAuthority === 'DEAN_RD' ? 'Dean – R&D' : 'Vice Chancellor'}`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13.5px', color: '#1E293B' }}>
                Reviewing Certificate <strong>{selectedCert.certificate_number}</strong>
                <div style={{ fontStyle: 'italic', color: '#64748B', marginTop: '2px' }}>"{selectedCert.research_title}"</div>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Action</label>
                <Select
                  value={approvalAction}
                  onChange={(e) => setApprovalAction(e.target.value as any)}
                  options={[
                    { label: 'Approve & Affix Official Seal', value: 'APPROVE' },
                    { label: 'Reject with Mandatory Institutional Remarks', value: 'REJECT' },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                  Remarks {approvalAction === 'REJECT' && <span style={{ color: '#DC2626' }}>* (Mandatory)</span>}
                </label>
                <Input
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder={approvalAction === 'APPROVE' ? 'e.g. Meritorious publication approved.' : 'Reason for rejection...'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <Button variant="outline" size="sm" onClick={() => setShowApprovalModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                  onClick={handleSubmitApproval}
                  style={approvalAction === 'REJECT' ? { backgroundColor: '#DC2626', borderColor: '#DC2626' } : {}}
                >
                  {submitting ? 'Submitting...' : approvalAction === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: RESCHEDULE CERTIFICATE */}
        {/* =================================================================== */}
        {showRescheduleModal && rescheduleCert && (
          <Modal
            isOpen={showRescheduleModal}
            onClose={() => setShowRescheduleModal(false)}
            title={`Reschedule Certificate Date of Issue — ${rescheduleCert.certificate_number}`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', color: '#0369A1' }}>
                ℹ️ <strong>Pre-Activation Rescheduling:</strong> You may adjust the scheduled Date of Issue for this certificate prior to activation. The vector PDF credentials will be re-rendered with the updated date. Once activated, the issuance record is immutable.
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  New Date of Issue *
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: '#0F2B48',
                    width: '100%',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <Button variant="outline" size="sm" onClick={() => setShowRescheduleModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={rescheduling || !rescheduleDate}
                  onClick={handleConfirmReschedule}
                >
                  {rescheduling ? 'Updating Date...' : 'Confirm Reschedule'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: REVOKE CERTIFICATE */}
        {/* =================================================================== */}
        {showRevokeModal && selectedCert && (
          <Modal
            isOpen={showRevokeModal}
            onClose={() => setShowRevokeModal(false)}
            title="Revoke Certificate"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#991B1B' }}>
                <strong>Permanent Action:</strong> Revoking will permanently invalidate certificate{' '}
                <strong>{selectedCert.certificate_number}</strong>. Public verification will display REVOKED status and downloads will be blocked.
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                  Revocation Audit Reason * (min 5 characters)
                </label>
                <Input
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  placeholder="e.g. Journal retraction or institutional correction"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <Button variant="outline" size="sm" onClick={() => setShowRevokeModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={submitting || revocationReason.trim().length < 5}
                  onClick={handleSubmitRevocation}
                  style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  {submitting ? 'Revoking...' : 'Permanently Revoke'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: REISSUE / SUPERSEDE */}
        {/* =================================================================== */}
        {showReissueModal && selectedCert && (
          <Modal
            isOpen={showReissueModal}
            onClose={() => setShowReissueModal(false)}
            title="Reissue / Supersede Certificate"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: '#475569' }}>
                This creates an official replacement for <strong>{selectedCert.certificate_number}</strong>, preserving cryptographic history and marking the previous certificate as SUPERSEDED.
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Reissue Reason * (min 5 characters)</label>
                <Input
                  value={reissueReason}
                  onChange={(e) => setReissueReason(e.target.value)}
                  placeholder="e.g. Author name orthography correction per official university records"
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Corrected Certificate Title</label>
                <Input value={reissueTitle} onChange={(e) => setReissueTitle(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Corrected Research Title</label>
                <Input value={reissueResearchTitle} onChange={(e) => setReissueResearchTitle(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <Button variant="outline" size="sm" onClick={() => setShowReissueModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={submitting || reissueReason.trim().length < 5}
                  onClick={handleSubmitReissue}
                  style={{ backgroundColor: '#B2811A', borderColor: '#B2811A' }}
                >
                  {submitting ? 'Processing...' : 'Confirm Reissue'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: CREATE TEMPLATE */}
        {/* =================================================================== */}
        {showTemplateModal && (
          <Modal
            isOpen={showTemplateModal}
            onClose={() => setShowTemplateModal(false)}
            title="Create Reusable Template"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Template Code (e.g. CSJMU_A4_SPECIAL)</label>
                <Input value={templateForm.code} onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Template Name</label>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Description</label>
                <Input value={templateForm.description || ''} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <Button variant="outline" size="sm" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleCreateTemplate} disabled={submitting}>Save Template</Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: ADD / EDIT SIGNATORY */}
        {/* =================================================================== */}
        {showSignatoryModal && (
          <Modal
            isOpen={showSignatoryModal}
            onClose={() => {
              setShowSignatoryModal(false);
              setEditingSignatoryId(null);
            }}
            title={editingSignatoryId ? "Edit Signing Authority" : "Add Signing Authority"}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Institutional Authority Role *</label>
                <Select
                  value={signatoryForm.authority_type}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, authority_type: e.target.value })}
                  options={[
                    { label: 'Dean – Research & Development (Dean R&D)', value: 'DEAN_RD' },
                    { label: 'Vice Chancellor (VC)', value: 'VICE_CHANCELLOR' },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Signatory Full Legal Name & Honorific *</label>
                <Input
                  value={signatoryForm.signatory_name}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, signatory_name: e.target.value })}
                  placeholder="e.g. Prof. (Dr.) Rajesh Kumar"
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Official Designation *</label>
                <Input
                  value={signatoryForm.designation}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, designation: e.target.value })}
                  placeholder="e.g. Dean – Research & Development"
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Department / Office</label>
                <Input
                  value={signatoryForm.department || ''}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, department: e.target.value })}
                  placeholder="e.g. Research & Development Cell, CSJMU Kanpur"
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Status</label>
                <Select
                  value={signatoryForm.is_active ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, is_active: e.target.value === 'ACTIVE' })}
                  options={[
                    { label: 'Active (Available for certificate approval & signing)', value: 'ACTIVE' },
                    { label: 'Inactive (Historical / Archived)', value: 'INACTIVE' },
                  ]}
                />
              </div>

              {!editingSignatoryId && (
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                    Signature Asset (Transparent PNG preferred, max 2MB)
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => handleSignatureFileSelect(e.target.files?.[0] || null)}
                    style={{ display: 'block', marginTop: '6px', fontSize: '13px' }}
                  />
                  {signatureFilePreviewUrl && (
                    <div style={{ marginTop: '10px', background: '#FAF7F0', border: '1px dashed #B2811A', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                      <img src={signatureFilePreviewUrl} alt="Preview" style={{ maxHeight: '50px', maxWidth: '80%', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button variant="outline" size="sm" onClick={() => {
                  setShowSignatoryModal(false);
                  setEditingSignatoryId(null);
                }}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveSignatory} disabled={submitting}>
                  {submitting ? 'Saving...' : editingSignatoryId ? 'Update Authority' : 'Create Authority'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: UPLOAD / REPLACE DIGITAL SIGNATURE */}
        {/* =================================================================== */}
        {showUploadSignatureModal && selectedSignatoryForUpload && (
          <Modal
            isOpen={showUploadSignatureModal}
            onClose={() => {
              setShowUploadSignatureModal(false);
              setSelectedSignatoryForUpload(null);
              setSignatureUploadFile(null);
              setSignatureFilePreviewUrl(null);
            }}
            title={`Upload Signature: ${selectedSignatoryForUpload.signatory_name}`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F2B48' }}>
                  {selectedSignatoryForUpload.signatory_name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {selectedSignatoryForUpload.designation} ({selectedSignatoryForUpload.authority_type === 'DEAN_RD' ? 'Dean – R&D' : 'Vice Chancellor'})
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                  Current Signature Version: v{selectedSignatoryForUpload.signature_asset_version || 1}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                  Select Signature Asset * (Transparent PNG preferred, max 2MB)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => handleSignatureFileSelect(e.target.files?.[0] || null)}
                  style={{ display: 'block', marginTop: '6px', fontSize: '13px', width: '100%' }}
                />
                <p style={{ margin: '6px 0 0 0', fontSize: '11.5px', color: '#64748B' }}>
                  Notice: Only genuine, transparent PNG or high-resolution JPEG signatures are accepted. AI-generated, typed or simulated signatures are strictly rejected.
                </p>
              </div>

              {signatureFilePreviewUrl && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Live Asset Preview:</div>
                  <div
                    style={{
                      background: '#FAF7F0',
                      border: '1px dashed #B2811A',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center',
                      minHeight: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={signatureFilePreviewUrl}
                      alt="Signature asset preview"
                      style={{ maxHeight: '70px', maxWidth: '90%', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowUploadSignatureModal(false);
                    setSelectedSignatoryForUpload(null);
                    setSignatureUploadFile(null);
                    setSignatureFilePreviewUrl(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUploadSignatureSubmit}
                  disabled={submitting || !signatureUploadFile}
                >
                  {submitting ? 'Uploading...' : 'Confirm & Upload Signature'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: FULL SIGNATURE PREVIEW */}
        {/* =================================================================== */}
        {signaturePreviewSignatory && (
          <Modal
            isOpen={Boolean(signaturePreviewSignatory)}
            onClose={() => setSignaturePreviewSignatory(null)}
            title="Official Digital Signature Preview"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2B48' }}>
                  {signaturePreviewSignatory.signatory_name}
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569' }}>
                  {signaturePreviewSignatory.designation}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Authority Role: {signaturePreviewSignatory.authority_type === 'DEAN_RD' ? 'Dean – Research & Development' : 'Vice Chancellor'} • Asset Version: v{signaturePreviewSignatory.signature_asset_version || 1}
                </div>
              </div>

              <div
                style={{
                  background: '#FAF7F0',
                  border: '2px solid #B2811A',
                  borderRadius: '10px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '140px',
                  gap: '12px',
                }}
              >
                <img
                  src={samaAdminService.getSignatorySignatureUrl(signaturePreviewSignatory.id)}
                  alt={`Signature of ${signaturePreviewSignatory.signatory_name}`}
                  style={{ maxHeight: '110px', maxWidth: '90%', objectFit: 'contain' }}
                />
                <div style={{ width: '160px', height: '1px', background: '#B2811A' }} />
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#061325' }}>
                  {signaturePreviewSignatory.signatory_name}
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  {signaturePreviewSignatory.designation}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <Button variant="primary" size="sm" onClick={() => setSignaturePreviewSignatory(null)}>
                  Close Preview
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: SAFE DELETE SIGNING AUTHORITY */}
        {/* =================================================================== */}
        {deleteSignatoryTarget && (
          <Modal
            isOpen={Boolean(deleteSignatoryTarget)}
            onClose={() => setDeleteSignatoryTarget(null)}
            title="Delete Signing Authority"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#991B1B' }}>
                <strong>Institutional Dependency Check:</strong> You are about to remove <strong>{deleteSignatoryTarget.signatory_name}</strong> ({deleteSignatoryTarget.designation}).
              </div>

              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                If this authority has approved or signed any existing research certificates, they will be <strong>safely deactivated and soft-deleted</strong>. Previously issued certificates will permanently retain their original signatures, names, designations, and verification records. If unreferenced, the authority will be deleted completely.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button variant="outline" size="sm" onClick={() => setDeleteSignatoryTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDeleteSignatoryConfirm}
                  disabled={submitting}
                  style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  {submitting ? 'Processing...' : 'Confirm Safe Deletion'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: BULK CERTIFICATE DELETION / ARCHIVAL */}
        {/* =================================================================== */}
        {showBulkDeleteModal && (
          <Modal
            isOpen={showBulkDeleteModal}
            onClose={() => !isBulkDeleting && setShowBulkDeleteModal(false)}
            title="Bulk Delete / Archive Certificates"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#991B1B',
                }}
              >
                <strong>Critical Action:</strong> You are about to delete <strong>{selectedCertIds.size} certificate(s)</strong>.
              </div>

              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Certificates will be <strong>safely archived</strong> (soft-deleted). Their records are retained for institutional auditing, foreign key integrity, and legal traceability, but they will be removed from active ledgers, counts, and public directories.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Mandatory Reason for Deletion / Archival: *
                </label>
                <textarea
                  rows={3}
                  value={bulkDeleteReason}
                  onChange={(e) => setBulkDeleteReason(e.target.value)}
                  placeholder="Specify institutional reason (e.g., Erroneous duplicate issuance, Administrative correction authorized by R&D office)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={isBulkDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBulkDeleteSubmit}
                  disabled={isBulkDeleting || !bulkDeleteReason.trim()}
                  style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  {isBulkDeleting ? 'Archiving Certificates...' : `Confirm Bulk Delete (${selectedCertIds.size})`}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: BULK CERTIFICATE RESTORATION */}
        {/* =================================================================== */}
        {showBulkRestoreModal && (
          <Modal
            isOpen={showBulkRestoreModal}
            onClose={() => !isBulkRestoring && setShowBulkRestoreModal(false)}
            title="Bulk Restore Archived Certificates"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#065F46',
                }}
              >
                <strong>Administrative Recovery:</strong> Restoring <strong>{selectedCertIds.size} archived certificate(s)</strong>.
              </div>

              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Certificates will be restored to their previous lifecycle status. <strong>Note:</strong> Certificates that were previously revoked or superseded will be restored strictly to their Revoked/Superseded status and will never be reactivated as active.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Mandatory Reason for Restoration: *
                </label>
                <textarea
                  rows={3}
                  value={bulkRestoreReason}
                  onChange={(e) => setBulkRestoreReason(e.target.value)}
                  placeholder="Specify institutional recovery reason (e.g., Accidental archival during batch audit, Administrative reinstatement authorized by R&D)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkRestoreModal(false)}
                  disabled={isBulkRestoring}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBulkRestoreSubmit}
                  disabled={isBulkRestoring || !bulkRestoreReason.trim()}
                  style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                >
                  {isBulkRestoring ? 'Restoring Certificates...' : `Confirm Bulk Restore (${selectedCertIds.size})`}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: SINGLE CERTIFICATE RESTORATION */}
        {/* =================================================================== */}
        {showSingleRestoreModal && singleRestoreTarget && (
          <Modal
            isOpen={showSingleRestoreModal}
            onClose={() => !isSingleRestoring && setShowSingleRestoreModal(false)}
            title="Restore Archived Certificate"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#065F46',
                }}
              >
                <strong>Confirm Restoration:</strong> Certificate <strong>{singleRestoreTarget.certificate_number}</strong>
              </div>

              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                This record will be recovered from archives and restored to its previous lifecycle state. Revoked or superseded certificates remain safely revoked/superseded upon restoration.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Mandatory Reason for Restoration: *
                </label>
                <textarea
                  rows={3}
                  value={singleRestoreReason}
                  onChange={(e) => setSingleRestoreReason(e.target.value)}
                  placeholder="State reason for restoring this certificate record..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSingleRestoreModal(false)}
                  disabled={isSingleRestoring}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSingleRestoreSubmit}
                  disabled={isSingleRestoring || !singleRestoreReason.trim()}
                  style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                >
                  {isSingleRestoring ? 'Restoring...' : 'Confirm Restore'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: SINGLE CERTIFICATE DELETION / ARCHIVAL */}
        {/* =================================================================== */}
        {showSingleDeleteModal && singleDeleteTarget && (
          <Modal
            isOpen={showSingleDeleteModal}
            onClose={() => !isSingleDeleting && setShowSingleDeleteModal(false)}
            title="Delete / Archive Certificate"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#991B1B',
                }}
              >
                <strong>Confirm Deletion:</strong> Certificate <strong>{singleDeleteTarget.certificate_number}</strong>
              </div>

              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                This certificate will be <strong>safely archived</strong> (soft-deleted). It will no longer appear in the active certificate ledger, statistics, or public verification lookups.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Mandatory Reason for Deletion: *
                </label>
                <textarea
                  rows={3}
                  value={singleDeleteReason}
                  onChange={(e) => setSingleDeleteReason(e.target.value)}
                  placeholder="State reason for deleting this certificate record..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSingleDeleteModal(false)}
                  disabled={isSingleDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSingleDeleteSubmit}
                  disabled={isSingleDeleting || !singleDeleteReason.trim()}
                  style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  {isSingleDeleting ? 'Archiving...' : 'Confirm Delete'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* MODAL: CERTIFICATE FULL DETAILS (ACTIVE & HISTORICAL) */}
        {showDetailsModal && detailsCert && (
          <Modal
            isOpen={showDetailsModal}
            onClose={() => {
              setShowDetailsModal(false);
              setDetailsCert(null);
            }}
            title={`Certificate Details — ${detailsCert.certificate_number}`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Collision Alert if present */}
              {detailsCert.has_legacy_collision && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  fontSize: '13px',
                  color: '#92400E',
                  lineHeight: '1.4',
                }}>
                  <strong>⚠️ Active / Historical Serial Collision Advisory:</strong>
                  <div style={{ marginTop: '4px' }}>
                    Serial <code>{detailsCert.certificate_number}</code> is assigned across both the Active ledger ({detailsCert.legacy_collision_info?.active_recipient || 'Active Recipient'}) and the Historical registry ({detailsCert.legacy_collision_info?.historical_recipient || 'Historical Recipient'}). Both records are cryptographically unique and strictly isolated.
                  </div>
                </div>
              )}

              {/* Origin & Status Row */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {isHistoricalCertificate(detailsCert) ? (
                  <Badge variant="neutral" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A', fontWeight: 700 }}>
                    📜 Historical / Recovered Registry Record
                  </Badge>
                ) : (
                  <Badge variant="teal" style={{ fontWeight: 600 }}>
                    Active Ledger Record
                  </Badge>
                )}
                <Badge variant="neutral">{detailsCert.status || 'ISSUED'}</Badge>
                {detailsCert.certificate_type && (
                  <Badge variant="neutral" style={{ background: '#F1F5F9', color: '#475569' }}>
                    {detailsCert.certificate_type}
                  </Badge>
                )}
                {detailsCert.issue_reference && (
                  <Badge variant="neutral" style={{ background: '#EEF2FF', color: '#4338CA', borderColor: '#C7D2FE' }}>
                    {detailsCert.issue_reference}
                  </Badge>
                )}
              </div>

              {/* Recipient / Authors Section */}
              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Recipient(s) / Authors
                </div>
                {detailsCert.authors && detailsCert.authors.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {detailsCert.authors.map((auth, idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong>{auth.author_name_snapshot}</strong>
                        {auth.designation_snapshot && <span style={{ color: '#64748B' }}>({auth.designation_snapshot})</span>}
                        {auth.department_snapshot && <span style={{ color: '#475569' }}>— {auth.department_snapshot}</span>}
                        {auth.affiliation_snapshot && <span style={{ color: '#64748B', fontSize: '12px' }}>[{auth.affiliation_snapshot}]</span>}
                        {auth.scopus_id_snapshot && (
                          <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600 }}>
                            Scopus: {auth.scopus_id_snapshot}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#64748B' }}>({auth.author_role || 'Author'})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#1E293B' }}>
                    {detailsCert.presentation_statement || 'Recipient Researcher'}
                  </div>
                )}
              </div>

              {/* Title & Research Title */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Certificate Title</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F2B48', marginTop: '2px' }}>
                  {detailsCert.title || 'Certificate of Appreciation & Research Excellence'}
                </div>
              </div>

              {detailsCert.research_title && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Research Contribution</div>
                  <div style={{ fontSize: '13px', color: '#334155', fontStyle: 'italic', marginTop: '2px' }}>
                    "{detailsCert.research_title}"
                  </div>
                </div>
              )}

              {/* Financial Sanction / Details */}
              {(detailsCert.sanction_amount || detailsCert.publication_details?.sanction_amount) && (
                <div style={{ background: '#ECFDF5', padding: '10px 14px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#065F46', textTransform: 'uppercase' }}>Financial Sanction Amount</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#047857', marginTop: '2px' }}>
                    {detailsCert.sanction_amount || detailsCert.publication_details?.sanction_amount}
                  </div>
                </div>
              )}

              {/* Recovery & Audit Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                {detailsCert.recovery_source && (
                  <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Recovery Source</div>
                    <div style={{ fontSize: '12px', color: '#0F2B48', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                      {detailsCert.recovery_source}
                    </div>
                  </div>
                )}
                <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Verification Token</div>
                  <div style={{ fontSize: '12px', color: '#0F2B48', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                    {detailsCert.verification_token || 'N/A'}
                  </div>
                </div>
                {detailsCert.checksum_sha256 && (
                  <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>SHA-256 Digest</div>
                    <div style={{ fontSize: '11px', color: '#0F2B48', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                      {detailsCert.checksum_sha256}
                    </div>
                  </div>
                )}
                {detailsCert.file_storage_path && (
                  <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Storage Path / Key</div>
                    <div style={{ fontSize: '11px', color: '#0F2B48', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                      {detailsCert.file_storage_path}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyVerificationUrl(detailsCert)}
                >
                  <AppIcon name="clipboard" size={14} style={{ marginRight: '4px' }} />
                  {copiedToken === (detailsCert.verification_token || detailsCert.certificate_number) ? 'Verification Link Copied' : 'Copy Verification Link'}
                </Button>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {isHistoricalCertificate(detailsCert) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const target = detailsCert;
                        setShowDetailsModal(false);
                        handleOpenEditRecoveryMetadata(target);
                      }}
                      style={{
                        borderColor: '#6366F1',
                        color: '#4F46E5',
                        background: '#EEF2FF',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                      }}
                      title="Edit Historical Recovery Metadata & Storage References"
                    >
                      <AppIcon name="edit" size={14} style={{ marginRight: '5px' }} />
                      Edit Recovery Metadata
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDetailsModal(false);
                      setDetailsCert(null);
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={downloadingId === detailsCert.id}
                    onClick={() => handleDownload(detailsCert)}
                  >
                    <span style={{ marginRight: '4px' }}>&darr;</span>
                    {downloadingId === detailsCert.id ? 'Downloading...' : 'Download PDF'}
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: EDIT HISTORICAL RECOVERY METADATA & PDF REPAIR */}
        {/* =================================================================== */}
        {showEditRecoveryModal && recoveryTargetCert && (
          <Modal
            isOpen={showEditRecoveryModal}
            onClose={() => !isSavingRecovery && setShowEditRecoveryModal(false)}
            title={`Edit Recovery Metadata — ${recoveryTargetCert.certificate_number}`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Context Notice */}
              <div
                style={{
                  background: '#EEF2FF',
                  border: '1px solid #C7D2FE',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#3730A3',
                  lineHeight: '1.4',
                }}
              >
                <strong>🏛️ Historical Certificate Repair Mode:</strong>
                <div style={{ marginTop: '4px', fontSize: '12px' }}>
                  This tool repairs incomplete metadata, Scopus linkage, and DigitalOcean Spaces storage keys for recovered certificate records without regenerating files or altering the active certificate ledger.
                </div>
              </div>

              {recoveryModalError && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#991B1B',
                    fontSize: '13px',
                  }}
                >
                  {recoveryModalError}
                </div>
              )}

              {recoveryModalSuccess && (
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#166534',
                    fontSize: '13px',
                  }}
                >
                  {recoveryModalSuccess}
                </div>
              )}

              {/* SECTION 1: RESEARCH METADATA */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', background: '#FFFFFF' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0F2B48', fontWeight: 600 }}>
                  1. Research Metadata & Author Linkage
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      value={recoveryRecipientName}
                      onChange={(e) => setRecoveryRecipientName(e.target.value)}
                      placeholder="e.g. Dr. Jane Doe"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Scopus Author ID (8–12 digits)
                    </label>
                    <input
                      type="text"
                      value={recoveryScopusId}
                      onChange={(e) => setRecoveryScopusId(e.target.value)}
                      placeholder="e.g. 57201234567"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      Validated numeric ID; immediately searchable in SAdmin search.
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Research Title
                  </label>
                  <textarea
                    rows={2}
                    value={recoveryResearchTitle}
                    onChange={(e) => setRecoveryResearchTitle(e.target.value)}
                    placeholder="Full research publication title"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Department / Affiliation
                    </label>
                    <input
                      type="text"
                      value={recoveryDepartment}
                      onChange={(e) => setRecoveryDepartment(e.target.value)}
                      placeholder="e.g. Department of Physics"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Research Bulletin Citation
                    </label>
                    <input
                      type="text"
                      value={recoveryIssueReference}
                      onChange={(e) => setRecoveryIssueReference(e.target.value)}
                      placeholder="e.g. Volume 2, Issue 3 (July - September 2026)"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Publication Details / Citation Reference
                  </label>
                  <input
                    type="text"
                    value={recoveryPublicationDetails}
                    onChange={(e) => setRecoveryPublicationDetails(e.target.value)}
                    placeholder="e.g. Nature Materials, Vol. 25, pp. 112-120"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* SECTION 2: PDF STORAGE REFERENCE & AVAILABILITY TEST */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', background: '#FFFFFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#0F2B48', fontWeight: 600 }}>
                    2. PDF Storage Reference & Availability
                  </h4>
                  <Badge variant="info" style={{ fontSize: '11px', background: '#F0F9FF', color: '#0369A1', borderColor: '#BAE6FD' }}>
                    ☁️ DigitalOcean Spaces (S3-Compatible)
                  </Badge>
                </div>

                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
                  Spaces credentials and secret keys are securely isolated on the backend. Only relative object keys are stored and inspected.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Original PDF Storage Key / Object Path *
                  </label>
                  <input
                    type="text"
                    value={recoveryStorageKey}
                    onChange={(e) => setRecoveryStorageKey(e.target.value)}
                    placeholder="e.g. sama_veda/certificates/CSJMU_SAMIKSHA_2026_000001.pdf"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                    Safe relative key format: <code>sama_veda/certificates/&lt;filename&gt;.pdf</code>. Path traversals, absolute drives, and external URLs are rejected.
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Original Filename (Optional metadata reference)
                  </label>
                  <input
                    type="text"
                    value={recoveryOriginalFilename}
                    onChange={(e) => setRecoveryOriginalFilename(e.target.value)}
                    placeholder="e.g. CSJMU_SAMIKSHA_2026_000001_signed.pdf"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* PDF Availability Test Button & Results */}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestPdfAvailability}
                      disabled={isTestingPdf}
                      style={{ borderColor: '#0284C7', color: '#0369A1', fontWeight: 600 }}
                    >
                      {isTestingPdf ? 'Checking Storage...' : '⚡ Test PDF Availability'}
                    </Button>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      Directly verifies object existence on Spaces before saving.
                    </span>
                  </div>

                  {pdfTestResult && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background:
                          pdfTestResult.status === 'found'
                            ? '#F0FDF4'
                            : pdfTestResult.status === 'missing'
                            ? '#FFFBEB'
                            : '#FEF2F2',
                        border: `1px solid ${
                          pdfTestResult.status === 'found'
                            ? '#BBF7D0'
                            : pdfTestResult.status === 'missing'
                            ? '#FDE68A'
                            : '#FECACA'
                        }`,
                        color:
                          pdfTestResult.status === 'found'
                            ? '#166534'
                            : pdfTestResult.status === 'missing'
                            ? '#92400E'
                            : '#991B1B',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {pdfTestResult.status === 'found' && '✓ Object Verified in Storage'}
                        {pdfTestResult.status === 'missing' && '✗ Object Not Found in Storage'}
                        {pdfTestResult.status === 'error' && '⚠️ Storage Verification Error'}
                      </div>
                      <div style={{ marginTop: '4px' }}>{pdfTestResult.message}</div>
                      {pdfTestResult.file_size_bytes && (
                        <div style={{ marginTop: '2px', fontFamily: 'monospace' }}>
                          File size: {(pdfTestResult.file_size_bytes / 1024).toFixed(1)} KB ({pdfTestResult.file_size_bytes.toLocaleString()} bytes)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* MODAL FOOTER ACTIONS */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditRecoveryModal(false)}
                  disabled={isSavingRecovery}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveRecoveryMetadata}
                  disabled={isSavingRecovery}
                  style={{ backgroundColor: '#4F46E5', borderColor: '#4F46E5' }}
                >
                  {isSavingRecovery ? 'Saving Corrections...' : 'Save Recovery Metadata'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
};

export default CertificatesPage;
