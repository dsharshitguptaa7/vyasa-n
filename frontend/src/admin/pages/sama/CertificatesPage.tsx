import React, { useState, useEffect, useCallback } from 'react';
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
} from '../../types/sama';

type TabKey = 'ledger' | 'approvals' | 'designer' | 'templates' | 'signatories';

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

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issued' | 'pending' | 'revoked' | 'superseded'>('all');
  const [page, setPage] = useState(1);
  const limit = 12;

  // Auxiliary Reference Data
  const [authors, setAuthors] = useState<AuthorRecord[]>([]);
  const [bulletins, setBulletins] = useState<BulletinRecord[]>([]);
  const [publications, setPublications] = useState<PublicationRecord[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplateItem[]>([]);
  const [signatories, setSignatories] = useState<CertificateSignatoryItem[]>([]);

  // Action states
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Modals state
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showReissueModal, setShowReissueModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSignatoryModal, setShowSignatoryModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);

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
  const [wizardTemplateId, setWizardTemplateId] = useState('');
  const [wizardTitle, setWizardTitle] = useState('Certificate of Appreciation & Research Excellence');
  const [wizardPresentation, setWizardPresentation] = useState('This certificate is proudly conferred upon');
  const [wizardContribution, setWizardContribution] = useState('in recognition of scholarly research publication in:');
  const [wizardResearchTitle, setWizardResearchTitle] = useState('');
  const [wizardCongratulatory, setWizardCongratulatory] = useState(
    'The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.'
  );
  const [wizardBulletinId, setWizardBulletinId] = useState('');
  const [wizardPublicationId, setWizardPublicationId] = useState('');
  const [wizardAuthors, setWizardAuthors] = useState<CertificateAuthorItem[]>([]);
  const [wizardSubmitMode, setWizardSubmitMode] = useState<'APPROVAL' | 'DIRECT' | 'DRAFT'>('APPROVAL');
  const [wizardDirectJustification, setWizardDirectJustification] = useState('');

  // Live Vector PDF Preview State
  const [wizardPreviewBlobUrl, setWizardPreviewBlobUrl] = useState<string | null>(null);
  const [renderingWizardPreview, setRenderingWizardPreview] = useState(false);
  const [showWizardPreviewModal, setShowWizardPreviewModal] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // Wizard Author Picker & Search-as-you-type
  const [searchAuthorQuery, setSearchAuthorQuery] = useState('');
  const [selectedDirectoryAuthorRole, setSelectedDirectoryAuthorRole] = useState('Co-Author');
  const [manualAuthorName, setManualAuthorName] = useState('');
  const [manualAuthorTitle, setManualAuthorTitle] = useState('Dr.');
  const [manualAuthorDept, setManualAuthorDept] = useState('');
  const [manualAuthorScopusId, setManualAuthorScopusId] = useState('');
  const [manualAuthorRole, setManualAuthorRole] = useState('Co-Author');
  const [manualAuthorAffiliation, setManualAuthorAffiliation] = useState(
    'Chhatrapati Shahu Ji Maharaj University, Kanpur'
  );

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
      if (statusFilter === 'revoked') isRevokedParam = true;

      const res = await samaAdminService.getCertificates({
        skip: (page - 1) * limit,
        limit,
        search: search.trim() || undefined,
        is_revoked: isRevokedParam,
      });

      let items = res.items;
      if (statusFilter === 'issued') {
        items = items.filter((c) => c.status === 'ISSUED' && !c.is_revoked);
      } else if (statusFilter === 'pending') {
        items = items.filter(
          (c) => c.status === 'PENDING_DEAN_APPROVAL' || c.status === 'PENDING_VC_APPROVAL' || c.status === 'DRAFT'
        );
      } else if (statusFilter === 'superseded') {
        items = items.filter((c) => c.status === 'SUPERSEDED');
      }

      setCertificates(items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.message || e.response?.data?.detail || e.message || 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const loadReferenceData = async () => {
    try {
      const [authRes, bullRes, pubRes, tplRes, sigRes] = await Promise.all([
        samaAdminService.getAuthors({ limit: 100 }),
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
    } catch (err) {
      console.warn('Failed to load auxiliary data', err);
    }
  };

  useEffect(() => {
    fetchCertificates();
    fetchStats();
  }, [fetchCertificates]);

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
    setWizardTitle('Certificate of Appreciation & Research Excellence');
    setWizardPresentation('This certificate is proudly conferred upon');
    setWizardContribution('in recognition of scholarly research publication in:');
    setWizardResearchTitle('');
    setWizardCongratulatory(
      'The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.'
    );
    setWizardBulletinId(bulletins[0]?.id || '');
    setWizardPublicationId('');
    setWizardAuthors([]);
    setWizardSubmitMode('APPROVAL');
    setWizardDirectJustification('');
    setSearchAuthorQuery('');
    setWizardTemplateId(templates[0]?.id || '');
    setShowWizardModal(true);
  };

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
    const newAuthor: CertificateAuthorItem = {
      researcher_id: authorRecord.id,
      author_name_snapshot: authorRecord.full_name,
      academic_title_snapshot: authorRecord.full_name.startsWith('Dr.') ? 'Dr.' : (authorRecord.full_name.startsWith('Prof.') ? 'Prof.' : 'Dr.'),
      department_snapshot: authorRecord.department || 'Department of Research',
      scopus_id_snapshot: authorRecord.scopus_id || null,
      affiliation_snapshot: authorRecord.institutional_affiliation || 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
      author_order: wizardAuthors.length + 1,
      author_role: assignedRole,
    };

    setWizardAuthors([...wizardAuthors, newAuthor]);
    setSearchAuthorQuery('');
    setError(null);
  };

  const handleAddManualAuthor = () => {
    if (!manualAuthorName.trim()) {
      setError('Author full legal name is required.');
      return;
    }

    const newAuthor: CertificateAuthorItem = {
      researcher_id: null,
      author_name_snapshot: manualAuthorName.trim(),
      academic_title_snapshot: manualAuthorTitle,
      department_snapshot: manualAuthorDept.trim() || 'Department of Research',
      scopus_id_snapshot: manualAuthorScopusId.trim() || null,
      affiliation_snapshot: manualAuthorAffiliation.trim() || 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
      author_order: wizardAuthors.length + 1,
      author_role: manualAuthorRole || (wizardAuthors.length === 0 ? 'First Author' : 'Co-Author'),
    };

    setWizardAuthors([...wizardAuthors, newAuthor]);
    setManualAuthorName('');
    setManualAuthorDept('');
    setManualAuthorScopusId('');
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
    if (wizardAuthors.length === 0) {
      setError('Please add at least one recipient author before generating a vector preview.');
      return;
    }
    try {
      setRenderingWizardPreview(true);
      setError(null);
      const blob = await samaAdminService.previewCertificate({
        title: wizardTitle,
        presentation_statement: wizardPresentation,
        research_contribution_statement: wizardContribution,
        research_title: wizardResearchTitle || 'Exploring the dielectric, supercapacitor and photocatalytic capabilities of sol-gel synthesized TiC nanoparticles',
        congratulatory_statement: wizardCongratulatory,
        template_id: wizardTemplateId || null,
        authors: wizardAuthors,
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
      const created = await samaAdminService.issueCertificate({
        template_id: wizardTemplateId || undefined,
        title: wizardTitle,
        presentation_statement: wizardPresentation,
        research_contribution_statement: wizardContribution,
        research_title: wizardResearchTitle,
        congratulatory_statement: wizardCongratulatory,
        bulletin_id: wizardBulletinId || undefined,
        publication_id: wizardPublicationId || undefined,
        authors: wizardAuthors,
        submit_for_approval: submitForApproval,
        direct_issue_justification: wizardSubmitMode === 'DIRECT' ? wizardDirectJustification.trim() : undefined,
      });

      setSuccessMessage(
        submitForApproval
          ? `Certificate ${created.certificate_number} created and submitted for Dean – R&D approval.`
          : `Certificate ${created.certificate_number} officially issued via authorized direct seal.`
      );
      setShowWizardModal(false);
      fetchCertificates();
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
              CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR • SAMIKSHA
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
            <Button variant="outline" size="sm" onClick={() => { fetchCertificates(); fetchStats(); }}>
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
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0F2B48', marginTop: '4px' }}>{stats.total_certificates}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Issued & Active</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#166534', marginTop: '4px' }}>{stats.issued_certificates}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#D97706', textTransform: 'uppercase' }}>Pending Approvals</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#D97706', marginTop: '4px' }}>{stats.pending_approvals}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#6366F1', textTransform: 'uppercase' }}>Drafts</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#6366F1', marginTop: '4px' }}>{stats.draft_certificates}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626', textTransform: 'uppercase' }}>Revoked</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#DC2626', marginTop: '4px' }}>{stats.revoked_certificates}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#8B5CF6', textTransform: 'uppercase' }}>Superseded</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#8B5CF6', marginTop: '4px' }}>{stats.reissued_certificates}</div>
          </div>
          <div style={{ background: '#FFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#0284C7', textTransform: 'uppercase' }}>Linked Scholars</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0284C7', marginTop: '4px' }}>{stats.total_researchers_linked}</div>
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
            Templates ({templates.length})
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
            Signing Authorities ({signatories.length})
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
                  placeholder="Search certificate #, author name, Scopus ID, paper title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ width: '180px' }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setPage(1);
                  }}
                  options={[
                    { label: 'All Certificates', value: 'all' },
                    { label: 'Issued & Active', value: 'issued' },
                    { label: 'Pending Approvals', value: 'pending' },
                    { label: 'Revoked', value: 'revoked' },
                    { label: 'Superseded', value: 'superseded' },
                  ]}
                />
              </div>
            </div>

            {/* Certificate Ledger Cards */}
            {loading ? (
              <LoadingState message="Loading certificate records..." />
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
                  const isRevoked = cert.is_revoked || cert.status === 'REVOKED';
                  const isSuperseded = cert.status === 'SUPERSEDED';
                  const isPending =
                    cert.status === 'PENDING_DEAN_APPROVAL' ||
                    cert.status === 'PENDING_VC_APPROVAL' ||
                    cert.status === 'DRAFT';

                  return (
                    <div
                      key={cert.id}
                      style={{
                        background: '#FFFFFF',
                        border: isRevoked ? '1px solid #FECACA' : isSuperseded ? '1px solid #E2E8F0' : '1px solid #E2E8F0',
                        borderLeft: isRevoked
                          ? '5px solid #DC2626'
                          : isSuperseded
                          ? '5px solid #8B5CF6'
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
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F2B48', fontFamily: 'monospace' }}>
                              {cert.certificate_number}
                            </span>
                            {isRevoked ? (
                              <Badge variant="neutral" style={{ color: '#DC2626', borderColor: '#FECACA' }}>REVOKED</Badge>
                            ) : isSuperseded ? (
                              <Badge variant="neutral">SUPERSEDED</Badge>
                            ) : cert.status === 'PENDING_DEAN_APPROVAL' ? (
                              <Badge variant="gold">Awaiting Dean R&D</Badge>
                            ) : cert.status === 'PENDING_VC_APPROVAL' ? (
                              <Badge variant="gold">Awaiting Vice Chancellor</Badge>
                            ) : cert.status === 'DRAFT' ? (
                              <Badge variant="neutral">Draft</Badge>
                            ) : (
                              <Badge variant="teal">ISSUED & VERIFIED</Badge>
                            )}
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                              Issued: {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : 'Pending'}
                            </span>
                          </div>

                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginTop: '4px' }}>
                            {cert.title || 'Certificate of Appreciation & Research Excellence'}
                          </div>

                          {cert.research_title && (
                            <div style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>
                              "{cert.research_title}"
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyVerificationUrl(cert)}
                            title="Copy Public Verification Link"
                          >
                            <AppIcon name="clipboard" size={14} style={{ marginRight: '4px' }} />
                            {copiedToken === (cert.verification_token || cert.certificate_number) ? 'Copied' : 'Verify Link'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === cert.id || isRevoked}
                            onClick={() => handleDownload(cert)}
                            title={isRevoked ? 'Revoked certificate cannot be downloaded' : 'Download Official PDF'}
                          >
                            <span style={{ marginRight: '4px' }}>&darr;</span>
                            {downloadingId === cert.id ? 'Downloading...' : 'PDF'}
                          </Button>

                          {!isRevoked && !isSuperseded && isSuperAdmin && (
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

            {loading ? (
              <LoadingState message="Checking approval queue..." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {certificates
                  .filter(
                    (c) =>
                      c.status === 'PENDING_DEAN_APPROVAL' ||
                      c.status === 'PENDING_VC_APPROVAL' ||
                      c.status === 'DRAFT'
                  )
                  .map((cert) => (
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

                {certificates.filter(
                  (c) =>
                    c.status === 'PENDING_DEAN_APPROVAL' ||
                    c.status === 'PENDING_VC_APPROVAL' ||
                    c.status === 'DRAFT'
                ).length === 0 && (
                  <EmptyState
                    title="All Approvals Cleared"
                    description="No certificates are currently awaiting Dean R&D or Vice Chancellor authorization."
                  />
                )}
              </div>
            )}
          </div>
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

              {/* STEP 1: Visual Template Selector */}
              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Select University Certificate Template
                      </label>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        {templates.length} official template{templates.length === 1 ? '' : 's'} available
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                      {templates.map((tpl) => {
                        const isSelected = wizardTemplateId === tpl.id || (!wizardTemplateId && tpl.is_default);
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

                            {/* Miniature Vector Mockup */}
                            <div
                              style={{
                                height: '70px',
                                backgroundColor: '#FAF7F0',
                                border: '1.5px solid #B2811A',
                                borderRadius: '4px',
                                padding: '4px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '10px',
                              }}
                            >
                              <div style={{ width: '92%', height: '100%', border: '1px solid #D4AF37', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '3px' }}>
                                <div style={{ width: '60%', height: '3px', backgroundColor: '#6B1D2F', borderRadius: '1px' }} />
                                <div style={{ width: '40%', height: '2px', backgroundColor: '#142C46', borderRadius: '1px' }} />
                                <div style={{ width: '75%', height: '2px', backgroundColor: '#64748B', borderRadius: '1px' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '90%' }}>
                                  <div style={{ width: '25%', height: '1.5px', backgroundColor: '#B2811A' }} />
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#B2811A', opacity: 0.5 }} />
                                  <div style={{ width: '25%', height: '1.5px', backgroundColor: '#B2811A' }} />
                                </div>
                              </div>
                            </div>

                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48', lineHeight: 1.3 }}>
                              {tpl.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                              Category: <strong>{tpl.certificate_type || 'Research Publication'}</strong>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              Format: <strong>Landscape A4 (297 × 210 mm)</strong>
                            </div>

                            {/* Color Scheme Palette Swatches */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #E2E8F0' }}>
                              <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>Palette:</span>
                              <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#FAF7F0', border: '1px solid #CBD5E1' }} title="Warm Ivory #FAF7F0" />
                              <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#B2811A' }} title="Antique Gold #B2811A" />
                              <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#6B1D2F' }} title="Deep Maroon #6B1D2F" />
                              <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#142C46' }} title="Deep Navy #142C46" />
                              <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: 'auto' }}>v{tpl.version || 1}</span>
                            </div>
                          </div>
                        );
                      })}
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
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48' }}>
                          Search Researcher Directory
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          (Auto-fill from SAMIKSHA database)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Add as:</span>
                        <select
                          value={selectedDirectoryAuthorRole}
                          onChange={(e) => setSelectedDirectoryAuthorRole(e.target.value)}
                          style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#0F2B48',
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

                    <Input
                      placeholder="Type researcher name, department, or Scopus ID to search..."
                      value={searchAuthorQuery}
                      onChange={(e) => setSearchAuthorQuery(e.target.value)}
                    />

                    {/* Autocomplete Suggestions Dropdown */}
                    {searchAuthorQuery.trim().length > 0 && (
                      <div
                        style={{
                          marginTop: '8px',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          maxHeight: '190px',
                          overflowY: 'auto',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        }}
                      >
                        {(() => {
                          const filtered = authors.filter((a) => {
                            const q = searchAuthorQuery.toLowerCase();
                            return (
                              a.full_name.toLowerCase().includes(q) ||
                              (a.department && a.department.toLowerCase().includes(q)) ||
                              (a.scopus_id && a.scopus_id.toLowerCase().includes(q))
                            );
                          });

                          if (filtered.length === 0) {
                            return (
                              <div style={{ padding: '12px', fontSize: '12.5px', color: '#64748B', textAlign: 'center' }}>
                                No matching researchers found in directory. Use manual entry below for external collaborators.
                              </div>
                            );
                          }

                          return filtered.slice(0, 8).map((a) => {
                            const isAlreadyAdded = wizardAuthors.some((auth) => auth.researcher_id === a.id);
                            return (
                              <div
                                key={a.id}
                                onClick={() => {
                                  if (!isAlreadyAdded) handleAddAuthorFromDirectory(a);
                                }}
                                style={{
                                  padding: '9px 12px',
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
                                  <span style={{ fontWeight: 600, fontSize: '13px', color: isAlreadyAdded ? '#94A3B8' : '#0F2B48' }}>
                                    {a.full_name}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '8px' }}>
                                    {a.department || 'CSJMU'}
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
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Manual Author Entry Fallback (Structured 2-Row Form) */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48' }}>
                          Add External / Non-Directory Co-Author
                        </span>
                        <Badge variant="neutral">Manual Entry</Badge>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        For collaborators from external universities or non-directory researchers
                      </span>
                    </div>

                    {/* Row 1: Title, Legal Name, Role */}
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1.8fr 1.2fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                          Title
                        </label>
                        <select
                          value={manualAuthorTitle}
                          onChange={(e) => setManualAuthorTitle(e.target.value)}
                          style={{
                            width: '100%',
                            fontSize: '12.5px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#0F2B48',
                            height: '36px',
                          }}
                        >
                          <option value="Dr.">Dr.</option>
                          <option value="Prof.">Prof.</option>
                          <option value="Mr.">Mr.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Er.">Er.</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                          Full Legal Name <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <Input
                          placeholder="e.g. Ramesh Chandra Verma"
                          value={manualAuthorName}
                          onChange={(e) => setManualAuthorName(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                          Author Role
                        </label>
                        <select
                          value={manualAuthorRole}
                          onChange={(e) => setManualAuthorRole(e.target.value)}
                          style={{
                            width: '100%',
                            fontSize: '12.5px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#0F2B48',
                            height: '36px',
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 120px auto', gap: '10px', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                          Department
                        </label>
                        <Input
                          placeholder="e.g. Physics & Materials"
                          value={manualAuthorDept}
                          onChange={(e) => setManualAuthorDept(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                          Affiliation / Institution
                        </label>
                        <Input
                          placeholder="e.g. IIT Kanpur / External Univ"
                          value={manualAuthorAffiliation}
                          onChange={(e) => setManualAuthorAffiliation(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                          Scopus ID (opt.)
                        </label>
                        <Input
                          placeholder="57201234567"
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
                            height: '36px',
                            padding: '0 16px',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600,
                          }}
                        >
                          + Add Author
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Current Authors List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48' }}>
                          Authors Included on Certificate
                        </span>
                        <Badge variant={wizardAuthors.length > 0 ? 'gold' : 'neutral'}>
                          {wizardAuthors.length} {wizardAuthors.length === 1 ? 'Recipient' : 'Recipients'}
                        </Badge>
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        Use ↑ / ↓ to adjust order (Author #1 is displayed as primary on the certificate)
                      </span>
                    </div>

                    {wizardAuthors.length === 0 ? (
                      <div
                        style={{
                          border: '1.5px dashed #CBD5E1',
                          borderRadius: '8px',
                          padding: '24px 16px',
                          textAlign: 'center',
                          backgroundColor: '#FAFCFE',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <div style={{ fontSize: '24px', color: '#94A3B8' }}>👥</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                          No Authors Added Yet
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#94A3B8', maxWidth: '380px' }}>
                          Search the researcher directory or use manual entry above to include at least one author on this certificate.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                        {wizardAuthors.map((auth, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: idx === 0 ? '#FAF7F0' : '#F8FAFC',
                              border: `1px solid ${idx === 0 ? '#E8D4A2' : '#E2E8F0'}`,
                              borderLeft: `4px solid ${idx === 0 ? '#B2811A' : '#64748B'}`,
                              borderRadius: '6px',
                              padding: '10px 14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              boxShadow: idx === 0 ? '0 1px 3px rgba(178, 129, 26, 0.1)' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <div
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  backgroundColor: idx === 0 ? '#B2811A' : '#E2E8F0',
                                  color: idx === 0 ? '#FFFFFF' : '#475569',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                                title={`Author Order #${auth.author_order}`}
                              >
                                #{auth.author_order}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48' }}>
                                    {auth.academic_title_snapshot ? `${auth.academic_title_snapshot} ` : ''}{auth.author_name_snapshot}
                                  </span>
                                  <Badge variant={auth.author_role === 'First Author' ? 'gold' : 'teal'}>
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
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {auth.department_snapshot} • {auth.affiliation_snapshot}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '12px' }}>
                              <button
                                onClick={() => handleMoveWizardAuthor(idx, 'UP')}
                                disabled={idx === 0}
                                title="Move author up"
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '4px',
                                  cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                  opacity: idx === 0 ? 0.35 : 1,
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  lineHeight: 1,
                                }}
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => handleMoveWizardAuthor(idx, 'DOWN')}
                                disabled={idx === wizardAuthors.length - 1}
                                title="Move author down"
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '4px',
                                  cursor: idx === wizardAuthors.length - 1 ? 'not-allowed' : 'pointer',
                                  opacity: idx === wizardAuthors.length - 1 ? 0.35 : 1,
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  lineHeight: 1,
                                }}
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => handleRemoveWizardAuthor(idx)}
                                title="Remove author from certificate"
                                style={{
                                  background: '#FEE2E2',
                                  border: '1px solid #FECACA',
                                  color: '#DC2626',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  lineHeight: 1,
                                  fontWeight: 700,
                                  marginLeft: '4px',
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Publication Details */}
              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Associate Existing Publication (Optional)</label>
                    <Select
                      value={wizardPublicationId}
                      onChange={(e) => handleSelectPublicationForWizard(e.target.value)}
                      options={[
                        { label: '-- Select publication from SAMIKSHA database --', value: '' },
                        ...publications.map((p) => ({ label: `${p.title} (${p.source_journal})`, value: p.id })),
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

              {/* STEP 4: Review, Live Vector PDF Preview & Submission */}
              {wizardStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Summary Card */}
                  <div style={{ background: '#FAF7F0', border: '1px solid #B2811A', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#B2811A', textTransform: 'uppercase' }}>Certificate Summary</div>
                      <Badge variant="gold">
                        {templates.find((t) => t.id === wizardTemplateId)?.name || 'Default Template'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F2B48', marginTop: '6px' }}>{wizardTitle}</div>
                    <div style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', marginTop: '3px' }}>"{wizardResearchTitle}"</div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F2B48', marginTop: '10px' }}>
                      Recipients ({wizardAuthors.length}): {wizardAuthors.map((a) => `${a.academic_title_snapshot} ${a.author_name_snapshot} (${a.author_role})`).join(' • ')}
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
                  {wizardStep === 2 && wizardAuthors.length === 0 && (
                    <span style={{ fontSize: '11.5px', color: '#DC2626', fontWeight: 500 }}>
                      Add at least one author to proceed
                    </span>
                  )}
                  {wizardStep < 4 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={wizardStep === 2 && wizardAuthors.length === 0}
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
      </div>
    </AdminLayout>
  );
};

export default CertificatesPage;
