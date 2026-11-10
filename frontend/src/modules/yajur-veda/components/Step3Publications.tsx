import React, { useState } from 'react';
import { Card, Button, Input, Select, Badge, Modal } from '@vyasa/ui';
import {
  AnudaanApplicationDetailOut,
  AnudaanPublicationOut,
  AnudaanPublicationCreate,
  AnudaanPublicationUpdate,
  AnudaanDocumentType,
  AnudaanIndexingType,
  AnudaanQuartile,
} from '../types/anudaan';
import { anudaanService, ApiError } from '../services/anudaanService';

export interface Step3PublicationsProps {
  application: AnudaanApplicationDetailOut;
  onRefreshApplication: (updatedApp: AnudaanApplicationDetailOut) => void;
  onBack: () => void;
  onComplete?: () => void;
}

export const Step3Publications: React.FC<Step3PublicationsProps> = ({
  application,
  onRefreshApplication,
  onBack,
  onComplete,
}) => {
  const publications = application.publications || [];

  // Modal Dialog States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPublication, setEditingPublication] = useState<AnudaanPublicationOut | null>(null);
  const [deletingPublication, setDeletingPublication] = useState<AnudaanPublicationOut | null>(null);

  // Publication Form State
  const [doi, setDoi] = useState('');
  const [paperTitle, setPaperTitle] = useState('');
  const [journalName, setJournalName] = useState('');
  const [issn, setIssn] = useState('');
  const [eIssn, setEIssn] = useState('');
  const [publicationDate, setPublicationDate] = useState('2026-01-01');
  const [publicationYear, setPublicationYear] = useState<number>(2026);
  const [volume, setVolume] = useState('');
  const [issue, setIssue] = useState('');
  const [pageDetails, setPageDetails] = useState('');
  const [documentType, setDocumentType] = useState<AnudaanDocumentType>('ARTICLE');
  const [indexingType, setIndexingType] = useState<AnudaanIndexingType>('SCOPUS');
  const [hasCsjmuAffiliation, setHasCsjmuAffiliation] = useState(true);
  const [applicantDeclaredQuartile, setApplicantDeclaredQuartile] = useState<AnudaanQuartile>('Q1');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const resetForm = () => {
    setDoi('');
    setPaperTitle('');
    setJournalName('');
    setIssn('');
    setEIssn('');
    setPublicationDate('2026-01-01');
    setPublicationYear(2026);
    setVolume('');
    setIssue('');
    setPageDetails('');
    setDocumentType('ARTICLE');
    setIndexingType('SCOPUS');
    setHasCsjmuAffiliation(true);
    setApplicantDeclaredQuartile('Q1');
    setFormErrors({});
    setServerError(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (pub: AnudaanPublicationOut) => {
    resetForm();
    setEditingPublication(pub);
    setDoi(pub.doi || '');
    setPaperTitle(pub.paper_title);
    setJournalName(pub.journal_name);
    setIssn(pub.issn || '');
    setEIssn(pub.e_issn || '');
    setPublicationDate(pub.publication_date);
    setPublicationYear(pub.publication_year);
    setVolume(pub.volume || '');
    setIssue(pub.issue || '');
    setPageDetails(pub.page_details || '');
    setDocumentType(pub.document_type);
    setIndexingType(pub.indexing_type);
    setHasCsjmuAffiliation(pub.has_csjmu_affiliation);
    setApplicantDeclaredQuartile(pub.applicant_declared_quartile);
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!paperTitle.trim() || paperTitle.trim().length < 3) {
      errs.paperTitle = 'Paper title is required (minimum 3 characters).';
    }

    if (!journalName.trim() || journalName.trim().length < 2) {
      errs.journalName = 'Journal name is required.';
    }

    if (!publicationDate) {
      errs.publicationDate = 'Publication date is required.';
    } else {
      const pubDate = new Date(publicationDate);
      const minDate = new Date('2026-01-01');
      if (pubDate < minDate) {
        errs.publicationDate = 'Ineligible date. Only works published on or after January 1, 2026 are eligible.';
      }
    }

    if (!publicationYear || isNaN(publicationYear) || publicationYear < 2020) {
      errs.publicationYear = 'Valid publication year is required (2020 or later).';
    }

    if (!hasCsjmuAffiliation) {
      errs.hasCsjmuAffiliation = 'Publication must bear explicit CSJMU institutional affiliation.';
    }

    // Client-side intra-draft duplicate DOI pre-check
    if (doi.trim()) {
      const normalizedInput = doi.trim().toLowerCase();
      const existingDuplicate = publications.find(
        (p) =>
          p.id !== editingPublication?.id &&
          (p.normalized_doi === normalizedInput || p.doi?.toLowerCase() === normalizedInput)
      );
      if (existingDuplicate) {
        errs.doi = 'A publication with this DOI is already added to your application draft.';
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSavePublication = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      if (editingPublication) {
        // Update existing publication
        const updatePayload: AnudaanPublicationUpdate = {
          doi: doi.trim() || null,
          paper_title: paperTitle.trim(),
          journal_name: journalName.trim(),
          issn: issn.trim() || null,
          e_issn: eIssn.trim() || null,
          publication_date: publicationDate,
          publication_year: publicationYear,
          volume: volume.trim() || null,
          issue: issue.trim() || null,
          page_details: pageDetails.trim() || null,
          document_type: documentType,
          indexing_type: indexingType,
          has_csjmu_affiliation: hasCsjmuAffiliation,
          applicant_declared_quartile: applicantDeclaredQuartile,
        };

        await anudaanService.updatePublication(editingPublication.id, updatePayload);
        setEditingPublication(null);
      } else {
        // Create new publication
        const createPayload: AnudaanPublicationCreate = {
          doi: doi.trim() || null,
          paper_title: paperTitle.trim(),
          journal_name: journalName.trim(),
          issn: issn.trim() || null,
          e_issn: eIssn.trim() || null,
          publication_date: publicationDate,
          publication_year: publicationYear,
          volume: volume.trim() || null,
          issue: issue.trim() || null,
          page_details: pageDetails.trim() || null,
          document_type: documentType,
          indexing_type: indexingType,
          has_csjmu_affiliation: hasCsjmuAffiliation,
          applicant_declared_quartile: applicantDeclaredQuartile,
        };

        await anudaanService.addPublication(application.id, createPayload);
        setIsAddModalOpen(false);
      }

      // Refresh application draft
      const refreshed = await anudaanService.getDraft(application.id);
      if (refreshed.success && refreshed.data) {
        onRefreshApplication(refreshed.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setServerError(
            `Duplicate DOI Conflict: ${err.message || 'This publication has already been submitted or claimed.'}`
          );
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Failed to save publication. Please check connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPublication) return;

    try {
      setLoading(true);
      await anudaanService.deletePublication(deletingPublication.id);
      setDeletingPublication(null);

      const refreshed = await anudaanService.getDraft(application.id);
      if (refreshed.success && refreshed.data) {
        onRefreshApplication(refreshed.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Failed to delete publication.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ padding: 32 }}>
      {/* Step Header */}
      <div style={{ marginBottom: 24, borderBottom: '1px solid #E2E8F0', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 3 of 3
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0B2545', margin: '4px 0 0' }}>
              Research Publications Intake
            </h2>
          </div>
          <Button variant="primary" onClick={openAddModal}>
            + Add Publication
          </Button>
        </div>
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

      {/* Publications List */}
      {publications.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            border: '2px dashed #CBD5E1',
            borderRadius: 8,
            backgroundColor: '#F8FAFC',
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1E293B', margin: '0 0 6px' }}>
            No Publications Added Yet
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.9rem', maxWidth: 460, margin: '0 auto 18px', lineHeight: 1.5 }}>
            You must add at least one eligible research paper published on or after January 1, 2026 to proceed with your claim.
          </p>
          <Button variant="primary" onClick={openAddModal}>
            + Add Your First Publication
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          {publications.map((pub, idx) => (
            <div
              key={pub.id}
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '20px 24px',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <Badge variant="primary">#{idx + 1}</Badge>
                    <Badge variant="teal">{pub.document_type}</Badge>
                    <Badge variant="gold">Declared {pub.applicant_declared_quartile}</Badge>
                    <Badge variant="neutral">{pub.indexing_type}</Badge>
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0B2545', margin: '0 0 6px', lineHeight: 1.4 }}>
                    {pub.paper_title}
                  </h4>
                  <div style={{ fontSize: '0.9rem', color: '#475569', marginBottom: 4 }}>
                    <strong>{pub.journal_name}</strong> • Published: {pub.publication_date} ({pub.publication_year})
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#64748B', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {pub.doi && <span>DOI: <code>{pub.doi}</code></span>}
                    {pub.volume && <span>Vol: {pub.volume}</span>}
                    {pub.issue && <span>Issue: {pub.issue}</span>}
                    {pub.page_details && <span>Pages: {pub.page_details}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="outline" size="sm" onClick={() => openEditModal(pub)}>
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeletingPublication(pub)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
        <Button variant="outline" type="button" onClick={onBack}>
          ← Back to Bank Details
        </Button>

        <Button
          variant="primary"
          type="button"
          disabled={publications.length === 0}
          onClick={onComplete}
        >
          {publications.length === 0
            ? 'Add at least 1 publication to continue'
            : `Save & Continue (${publications.length} publication${publications.length > 1 ? 's' : ''}) →`}
        </Button>
      </div>

      {/* ADD / EDIT PUBLICATION MODAL */}
      <Modal
        isOpen={isAddModalOpen || editingPublication !== null}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingPublication(null);
        }}
        title={editingPublication ? 'Edit Research Publication' : 'Add Research Publication'}
      >
        <div style={{ padding: '8px 4px', maxHeight: '75vh', overflowY: 'auto' }}>
          {serverError && (
            <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #F87171', color: '#B91C1C', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.9rem' }}>
              {serverError}
            </div>
          )}

          <form noValidate onSubmit={handleSavePublication}>
            {/* Paper Title */}
            <div style={{ marginBottom: 14 }}>
              <Input
                label="Paper Title *"
                placeholder="Full official title of research paper"
                value={paperTitle}
                onChange={(e) => setPaperTitle(e.target.value)}
                error={formErrors.paperTitle}
                required
              />
            </div>

            {/* Journal Name */}
            <div style={{ marginBottom: 14 }}>
              <Input
                label="Journal Name *"
                placeholder="e.g. IEEE Transactions on Software Engineering"
                value={journalName}
                onChange={(e) => setJournalName(e.target.value)}
                error={formErrors.journalName}
                required
              />
            </div>

            {/* DOI */}
            <div style={{ marginBottom: 14 }}>
              <Input
                label="Digital Object Identifier (DOI)"
                placeholder="e.g. 10.1016/j.neucom.2025.109204"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                error={formErrors.doi}
                hint="Normalized automatically on server. URLs and prefixes will be cleanly stripped."
              />
            </div>

            {/* Publication Date and Year */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <Input
                type="date"
                label="Official Publication Date *"
                value={publicationDate}
                min="2026-01-01"
                onChange={(e) => {
                  setPublicationDate(e.target.value);
                  const y = new Date(e.target.value).getFullYear();
                  if (!isNaN(y)) setPublicationYear(y);
                }}
                error={formErrors.publicationDate}
                hint="Must be on or after 2026-01-01"
                required
              />
              <Input
                type="number"
                label="Publication Year *"
                value={publicationYear}
                onChange={(e) => setPublicationYear(parseInt(e.target.value, 10))}
                error={formErrors.publicationYear}
                min={2020}
                required
              />
            </div>

            {/* Document Type and Indexing Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <Select
                label="Document Classification *"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as AnudaanDocumentType)}
                options={[
                  { value: 'ARTICLE', label: 'Original Research Article' },
                  { value: 'REVIEW', label: 'Review Article' },
                ]}
                required
              />
              <Select
                label="Indexing Database *"
                value={indexingType}
                onChange={(e) => setIndexingType(e.target.value as AnudaanIndexingType)}
                options={[
                  { value: 'SCOPUS', label: 'Scopus Indexed' },
                  { value: 'WEB_OF_SCIENCE', label: 'Web of Science (WoS) Indexed' },
                  { value: 'SCOPUS_AND_WOS', label: 'Both Scopus & Web of Science' },
                ]}
                required
              />
            </div>

            {/* Quartile and ISSN */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <Select
                label="Applicant-Declared Quartile *"
                value={applicantDeclaredQuartile}
                onChange={(e) => setApplicantDeclaredQuartile(e.target.value as AnudaanQuartile)}
                options={[
                  { value: 'Q1', label: 'Q1 (Top Tier)' },
                  { value: 'Q2', label: 'Q2' },
                  { value: 'Q3', label: 'Q3' },
                  { value: 'Q4', label: 'Q4' },
                  { value: 'UNASSIGNED', label: 'Unassigned / Other' },
                ]}
                hint="Subject to independent institutional verification."
                required
              />
              <Input
                label="ISSN / e-ISSN (Optional)"
                placeholder="e.g. 0004-3702"
                value={issn}
                onChange={(e) => setIssn(e.target.value)}
              />
            </div>

            {/* Volume, Issue, Pages */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
              <Input
                label="Volume"
                placeholder="e.g. 42"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
              <Input
                label="Issue"
                placeholder="e.g. 4"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
              />
              <Input
                label="Page Numbers"
                placeholder="e.g. 112-124"
                value={pageDetails}
                onChange={(e) => setPageDetails(e.target.value)}
              />
            </div>

            {/* CSJMU Affiliation Confirmation Checkbox */}
            <div style={{ marginBottom: 20, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#1E293B' }}>
                <input
                  type="checkbox"
                  aria-label="Affiliation Affirmation"
                  checked={hasCsjmuAffiliation}
                  onChange={(e) => setHasCsjmuAffiliation(e.target.checked)}
                />
                <span>
                  <strong>Affiliation Affirmation:</strong> I confirm that this published work explicitly names <em>Chhatrapati Shahu Ji Maharaj University, Kanpur</em> in author affiliation.
                </span>
              </label>
              {formErrors.hasCsjmuAffiliation && (
                <div style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: 4 }}>
                  {formErrors.hasCsjmuAffiliation}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingPublication(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingPublication ? 'Update Publication' : 'Add Publication'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={deletingPublication !== null}
        onClose={() => setDeletingPublication(null)}
        title="Confirm Publication Deletion"
      >
        <div style={{ padding: '8px 4px' }}>
          <p style={{ color: '#1E293B', fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 16px' }}>
            Are you sure you want to remove the following publication from your application draft?
          </p>
          <div style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 6, border: '1px solid #E2E8F0', marginBottom: 20 }}>
            <strong>{deletingPublication?.paper_title}</strong>
            <div style={{ color: '#64748B', fontSize: '0.85rem', marginTop: 4 }}>
              {deletingPublication?.journal_name} ({deletingPublication?.publication_year})
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" type="button" onClick={() => setDeletingPublication(null)}>
              Keep Publication
            </Button>
            <Button variant="outline" type="button" onClick={handleConfirmDelete} disabled={loading}>
              {loading ? 'Deleting...' : 'Confirm Remove'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};
