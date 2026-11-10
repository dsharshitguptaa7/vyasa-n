import React, { useState } from 'react';
import { Card, Button, Input, Select, Badge, Modal } from '@vyasa/ui';
import {
  AnudaanApplicationDetailOut,
  AnudaanPublicationOut,
  AnudaanAuthorOut,
  AnudaanAuthorCreate,
  AnudaanAuthorRole,
  AnudaanBankAccountInput,
  AnudaanBankAccountType,
} from '../types/anudaan';
import { anudaanService, ApiError } from '../services/anudaanService';

export interface Step4AuthorsAndBankProps {
  application: AnudaanApplicationDetailOut;
  cachedBankData?: AnudaanBankAccountInput | null;
  onRefreshApplication: (updatedApp: AnudaanApplicationDetailOut) => void;
  onBack: () => void;
  onSuccess: () => void;
}

const PHONE_REGEX = /^\+?[0-9]{10,15}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const Step4AuthorsAndBank: React.FC<Step4AuthorsAndBankProps> = ({
  application,
  cachedBankData,
  onRefreshApplication,
  onBack,
  onSuccess,
}) => {
  const publications = application.publications || [];

  // Active Target Publication for Adding Author
  const [selectedPublication, setSelectedPublication] = useState<AnudaanPublicationOut | null>(null);
  const [deletingAuthor, setDeletingAuthor] = useState<{ author: AnudaanAuthorOut; pubId: string } | null>(null);

  // Author Modal Form State
  const [fullName, setFullName] = useState('');
  const [authorRole, setAuthorRole] = useState<AnudaanAuthorRole>('FIRST');
  const [authorOrder, setAuthorOrder] = useState<number>(1);
  const [isCsjmuAffiliated, setIsCsjmuAffiliated] = useState(true);
  const [mobileNumber, setMobileNumber] = useState('');
  const [employeeOrRegId, setEmployeeOrRegId] = useState('');
  const [scopusAuthorId, setScopusAuthorId] = useState('');
  const [scopusProfileUrl, setScopusProfileUrl] = useState('');

  // Corresponding Author Special Flags
  const [hasMultipleCorresponding, setHasMultipleCorresponding] = useState(false);
  const [isNominatedCorresponding, setIsNominatedCorresponding] = useState(false);

  // Bank Assignment Strategy for Payable Authors ('APPLICANT_STEP2' | 'NEW' | 'VERIFIED_REUSE')
  const [bankStrategy, setBankStrategy] = useState<'APPLICANT_STEP2' | 'NEW' | 'VERIFIED_REUSE'>(
    cachedBankData ? 'APPLICANT_STEP2' : 'NEW'
  );
  const [isAuthorApplicant, setIsAuthorApplicant] = useState(false);

  // New Bank Form State
  const [bankHolderName, setBankHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountType, setAccountType] = useState<AnudaanBankAccountType>('SAVINGS');
  const [panNumber, setPanNumber] = useState('');

  // Verified Reuse State
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const resetAuthorModal = () => {
    setFullName('');
    setAuthorRole('FIRST');
    setAuthorOrder(1);
    setIsCsjmuAffiliated(true);
    setMobileNumber('');
    setEmployeeOrRegId('');
    setScopusAuthorId('');
    setScopusProfileUrl('');
    setHasMultipleCorresponding(false);
    setIsNominatedCorresponding(false);
    setIsAuthorApplicant(false);
    setBankStrategy(cachedBankData ? 'APPLICANT_STEP2' : 'NEW');
    setBankHolderName('');
    setBankName('');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setIfscCode('');
    setBranchName('');
    setAccountType('SAVINGS');
    setPanNumber('');
    setSelectedBankAccountId('');
    setFormErrors({});
    setServerError(null);
  };

  const openAddAuthorModal = (pub: AnudaanPublicationOut) => {
    resetAuthorModal();
    setSelectedPublication(pub);

    // Default author order to next index
    const nextOrder = (pub.authors || []).length + 1;
    setAuthorOrder(nextOrder);

    // If pub already has a FIRST author, default role to CORRESPONDING or CO_AUTHOR
    const hasFirst = (pub.authors || []).some((a) => a.author_role === 'FIRST');
    const hasNominated = (pub.authors || []).some((a) => a.is_nominated_corresponding_author);

    if (hasFirst) {
      if (!hasNominated) {
        setAuthorRole('CORRESPONDING');
        setIsNominatedCorresponding(true);
      } else {
        setAuthorRole('CO_AUTHOR');
      }
    } else {
      setAuthorRole('FIRST');
    }
  };

  const handleAuthorApplicantToggle = (isApp: boolean) => {
    setIsAuthorApplicant(isApp);
    if (isApp) {
      setFullName(application.full_name);
      setMobileNumber(application.mobile_number);
      setEmployeeOrRegId(application.institutional_id);
      setScopusAuthorId(application.scopus_author_id || '');
      setScopusProfileUrl(application.scopus_profile_url || '');
      setIsCsjmuAffiliated(true);
      if (cachedBankData) {
        setBankStrategy('APPLICANT_STEP2');
      }
    }
  };

  const isPayableRole =
    authorRole === 'FIRST' || (authorRole === 'CORRESPONDING' && isNominatedCorresponding);

  const validateAuthorForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errs.fullName = 'Author full name is required.';
    }

    if (!authorOrder || authorOrder < 1) {
      errs.authorOrder = 'Valid author order number is required.';
    }

    if (mobileNumber.trim()) {
      const cleanPhone = mobileNumber.replace(/[\s-]/g, '');
      if (!PHONE_REGEX.test(cleanPhone)) {
        errs.mobileNumber = 'Please enter a valid 10-15 digit phone number.';
      }
    }

    if (selectedPublication) {
      const currentAuthors = selectedPublication.authors || [];

      // 1. First author cardinality
      if (authorRole === 'FIRST') {
        const existingFirst = currentAuthors.find((a) => a.author_role === 'FIRST');
        if (existingFirst) {
          errs.authorRole = `This paper already has a designated First Author (${existingFirst.full_name}). Only 1 First Author is permitted.`;
        }
      }

      // 2. Nominated corresponding author cardinality
      if (authorRole === 'CORRESPONDING' && isNominatedCorresponding) {
        const existingNominated = currentAuthors.find((a) => a.is_nominated_corresponding_author);
        if (existingNominated) {
          errs.isNominatedCorresponding = `This paper already has a nominated corresponding author (${existingNominated.full_name}). Only 1 author can be nominated for the payable share.`;
        }
      }
    }

    // 3. Bank validation for payable author
    if (isPayableRole) {
      if (bankStrategy === 'APPLICANT_STEP2') {
        if (!isAuthorApplicant) {
          errs.bank = 'Applicant bank reuse is strictly allowed only when this author is explicitly confirmed to be the Applicant.';
        } else if (!cachedBankData) {
          errs.bank = 'No applicant bank details found from Step 2. Please enter new bank details.';
        }
      } else if (bankStrategy === 'VERIFIED_REUSE') {
        if (!selectedBankAccountId) {
          errs.bank = 'Please select a verified bank account from the list.';
        }
      } else if (bankStrategy === 'NEW') {
        if (!bankHolderName.trim()) errs.bankHolderName = 'Account holder name is required.';
        if (!bankName.trim()) errs.bankName = 'Bank institution name is required.';
        if (!accountNumber.trim() || accountNumber.trim().length < 6) {
          errs.accountNumber = 'Valid account number is required (min 6 digits).';
        }
        if (accountNumber.trim() !== confirmAccountNumber.trim()) {
          errs.confirmAccountNumber = 'Account numbers do not match.';
        }
        const cleanIfsc = ifscCode.trim().toUpperCase();
        if (!cleanIfsc || !IFSC_REGEX.test(cleanIfsc)) {
          errs.ifscCode = 'Valid 11-character IFSC code is required.';
        }
        if (!branchName.trim()) errs.branchName = 'Branch name is required.';
        if (panNumber.trim() && !PAN_REGEX.test(panNumber.trim().toUpperCase())) {
          errs.panNumber = 'Invalid PAN format (10 characters alphanumeric).';
        }
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveAuthor = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!selectedPublication || !validateAuthorForm()) {
      return;
    }

    try {
      setLoading(true);

      const payload: AnudaanAuthorCreate = {
        full_name: fullName.trim(),
        scopus_author_id: scopusAuthorId.trim() || null,
        scopus_profile_url: scopusProfileUrl.trim() || null,
        mobile_number: mobileNumber.trim() || null,
        employee_or_registration_id: employeeOrRegId.trim() || null,
        author_role: authorRole,
        author_order: authorOrder,
        is_csjmu_affiliated: isCsjmuAffiliated,
        has_multiple_corresponding_authors:
          authorRole === 'CORRESPONDING' ? hasMultipleCorresponding : false,
        is_nominated_corresponding_author:
          authorRole === 'CORRESPONDING' ? isNominatedCorresponding : false,
        bank_reuse_selected: false,
        bank_account_id: null,
        new_bank_details: null,
      };

      // Populate banking for payable author
      if (isPayableRole) {
        if (bankStrategy === 'APPLICANT_STEP2' && cachedBankData) {
          payload.new_bank_details = {
            account_holder_name: cachedBankData.account_holder_name,
            bank_name: cachedBankData.bank_name,
            account_number: cachedBankData.account_number,
            confirm_account_number: cachedBankData.account_number,
            ifsc_code: cachedBankData.ifsc_code,
            branch_name: cachedBankData.branch_name,
            account_type: cachedBankData.account_type,
            pan_number: cachedBankData.pan_number,
            bank_mobile_number: cachedBankData.bank_mobile_number,
          };
        } else if (bankStrategy === 'VERIFIED_REUSE') {
          payload.bank_reuse_selected = true;
          payload.bank_account_id = selectedBankAccountId;
        } else if (bankStrategy === 'NEW') {
          payload.new_bank_details = {
            account_holder_name: bankHolderName.trim(),
            bank_name: bankName.trim(),
            account_number: accountNumber.trim(),
            confirm_account_number: confirmAccountNumber.trim(),
            ifsc_code: ifscCode.trim().toUpperCase(),
            branch_name: branchName.trim(),
            account_type: accountType,
            pan_number: panNumber.trim().toUpperCase() || null,
            bank_mobile_number: mobileNumber.trim() || null,
          };
        }
      }

      await anudaanService.addAuthor(selectedPublication.id, payload);
      setSelectedPublication(null);

      // Refresh full application graph
      const refreshed = await anudaanService.getDraft(application.id);
      if (refreshed.success && refreshed.data) {
        onRefreshApplication(refreshed.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Failed to add author attribution. Please check network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteAuthor = async () => {
    if (!deletingAuthor) return;

    try {
      setLoading(true);
      await anudaanService.deleteAuthor(deletingAuthor.author.id);
      setDeletingAuthor(null);

      const refreshed = await anudaanService.getDraft(application.id);
      if (refreshed.success && refreshed.data) {
        onRefreshApplication(refreshed.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Failed to delete author.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if every publication satisfies institutional author attribution rules
  const getPublicationChecklist = (pub: AnudaanPublicationOut) => {
    const authors = pub.authors || [];
    const firstAuthor = authors.find((a) => a.author_role === 'FIRST');
    const nominatedCorresponding = authors.find((a) => a.is_nominated_corresponding_author);
    const firstHasBank = !!firstAuthor?.bank_account;
    const nominatedHasBank = !!nominatedCorresponding?.bank_account;

    const isComplete =
      !!firstAuthor && !!nominatedCorresponding && firstHasBank && nominatedHasBank;

    return {
      firstAuthor,
      nominatedCorresponding,
      firstHasBank,
      nominatedHasBank,
      isComplete,
    };
  };

  const allPublicationsReady =
    publications.length > 0 &&
    publications.every((pub) => getPublicationChecklist(pub).isComplete);

  return (
    <Card style={{ padding: 32 }}>
      {/* Step Header */}
      <div style={{ marginBottom: 24, borderBottom: '1px solid #E2E8F0', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 4 of 5
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0B2545', margin: '4px 0 0' }}>
              Author Attribution & Bank Mapping
            </h2>
          </div>
          <Badge variant={allPublicationsReady ? 'teal' : 'neutral'}>
            {allPublicationsReady ? '✓ All Publications Ready' : 'Incomplete Attributions'}
          </Badge>
        </div>
      </div>

      {/* Institutional Policy Guidelines Notice */}
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
          ⚖️ Institutional Author Attribution & Payment Rules (V1.1)
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#4A5568', fontSize: '0.875rem', lineHeight: 1.6 }}>
          <li>
            <strong>First Author:</strong> Each paper must have <strong>exactly one First Author</strong> with designated bank particulars.
          </li>
          <li>
            <strong>Corresponding Author(s):</strong> Multiple corresponding authors may be recorded, but <strong>exactly one must be nominated</strong> for the payable corresponding-author share.
          </li>
          <li>
            <strong>Independent Roles:</strong> The First Author, Nominated Corresponding Author, and Applicant may be different individuals.
          </li>
          <li>
            <strong>Co-authors:</strong> Non-payable under the approved scheme. Bank particulars cannot be attached to co-authors.
          </li>
        </ul>
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

      {/* Publications Author Management Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
        {publications.map((pub, pIdx) => {
          const checklist = getPublicationChecklist(pub);
          const authors = pub.authors || [];

          return (
            <div
              key={pub.id}
              style={{
                border: checklist.isComplete ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '20px 24px',
                backgroundColor: checklist.isComplete ? '#F0FDF4' : '#FFFFFF',
              }}
            >
              {/* Publication Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Badge variant="primary">Publication #{pIdx + 1}</Badge>
                    <Badge variant="gold">Declared {pub.applicant_declared_quartile}</Badge>
                    {checklist.isComplete ? (
                      <Badge variant="teal">✓ Attribution Complete</Badge>
                    ) : (
                      <Badge variant="neutral">Action Required</Badge>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0B2545', margin: '4px 0 2px' }}>
                    {pub.paper_title}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                    {pub.journal_name} ({pub.publication_year}) • DOI: <code>{pub.doi || 'N/A'}</code>
                  </div>
                </div>

                <Button variant="primary" size="sm" onClick={() => openAddAuthorModal(pub)}>
                  + Add Author
                </Button>
              </div>

              {/* Checklist Badges */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, fontSize: '0.8rem' }}>
                <span style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: checklist.firstAuthor ? '#DCFCE7' : '#FEE2E2', color: checklist.firstAuthor ? '#166534' : '#991B1B', fontWeight: 500 }}>
                  {checklist.firstAuthor ? '✓ First Author Assigned' : '✗ Missing First Author'}
                </span>
                <span style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: checklist.firstHasBank ? '#DCFCE7' : '#FEE2E2', color: checklist.firstHasBank ? '#166534' : '#991B1B', fontWeight: 500 }}>
                  {checklist.firstHasBank ? '✓ First Author Bank Linked' : '✗ First Author Bank Missing'}
                </span>
                <span style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: checklist.nominatedCorresponding ? '#DCFCE7' : '#FEE2E2', color: checklist.nominatedCorresponding ? '#166534' : '#991B1B', fontWeight: 500 }}>
                  {checklist.nominatedCorresponding ? '✓ Nominated Corresponding Assigned' : '✗ Missing Nominated Corresponding'}
                </span>
                <span style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: checklist.nominatedHasBank ? '#DCFCE7' : '#FEE2E2', color: checklist.nominatedHasBank ? '#166534' : '#991B1B', fontWeight: 500 }}>
                  {checklist.nominatedHasBank ? '✓ Corresponding Bank Linked' : '✗ Corresponding Bank Missing'}
                </span>
              </div>

              {/* Authors List */}
              {authors.length === 0 ? (
                <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: 6, textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
                  No authors added yet. Click "+ Add Author" to designate First Author, Corresponding Author, and Co-authors.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {authors.map((author) => {
                    const isPayable =
                      author.author_role === 'FIRST' || author.is_nominated_corresponding_author;

                    return (
                      <div
                        key={author.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                          padding: '10px 14px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#64748B', width: 24 }}>
                            #{author.author_order || '-'}
                          </span>
                          <div>
                            <strong style={{ color: '#1E293B', fontSize: '0.925rem' }}>
                              {author.full_name}
                            </strong>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                              <Badge variant={author.author_role === 'FIRST' ? 'primary' : author.author_role === 'CORRESPONDING' ? 'teal' : 'neutral'}>
                                {author.author_role} AUTHOR
                              </Badge>

                              {author.is_nominated_corresponding_author && (
                                <Badge variant="gold">
                                  ★ Nominated Payable Corresponding Author
                                </Badge>
                              )}

                              {author.is_csjmu_affiliated ? (
                                <span style={{ fontSize: '0.75rem', color: '#059669' }}>CSJMU Affiliated</span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>External</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bank Status & Action */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {isPayable ? (
                            author.bank_account ? (
                              <div style={{ fontSize: '0.8rem', textAlign: 'right' }}>
                                <span style={{ color: '#047857', fontWeight: 600, display: 'block' }}>
                                  ✓ {author.bank_account.masked_account_number}
                                </span>
                                <span style={{ color: '#64748B' }}>
                                  {author.bank_account.bank_name} • {author.bank_account.ifsc_code}
                                </span>
                              </div>
                            ) : (
                              <Badge variant="saffron">⚠️ Missing Bank</Badge>
                            )
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Non-Payable</span>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => setDeletingAuthor({ author, pubId: pub.id })}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
        <Button variant="outline" type="button" onClick={onBack}>
          ← Back to Publications
        </Button>

        <Button
          variant="primary"
          type="button"
          disabled={!allPublicationsReady}
          onClick={onSuccess}
        >
          {allPublicationsReady
            ? 'Continue to Supporting Documents →'
            : 'Complete All Author Attributions to Continue'}
        </Button>
      </div>

      {/* ADD AUTHOR MODAL */}
      <Modal
        isOpen={selectedPublication !== null}
        onClose={() => setSelectedPublication(null)}
        title="Add Author Attribution"
      >
        <div style={{ padding: '8px 4px', maxHeight: '75vh', overflowY: 'auto' }}>
          {serverError && (
            <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #F87171', color: '#B91C1C', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.9rem' }}>
              {serverError}
            </div>
          )}

          <form noValidate onSubmit={handleSaveAuthor}>
            {/* Quick-Match Checkbox if Author is Applicant */}
            <div style={{ marginBottom: 16, padding: '10px 14px', backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#0369A1' }}>
                <input
                  type="checkbox"
                  checked={isAuthorApplicant}
                  onChange={(e) => handleAuthorApplicantToggle(e.target.checked)}
                />
                <span>
                  This author is the Applicant (<strong>{application.full_name}</strong>)
                </span>
              </label>
            </div>

            {/* Author Role and Order */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
              <Select
                label="Author Role *"
                value={authorRole}
                onChange={(e) => {
                  const role = e.target.value as AnudaanAuthorRole;
                  setAuthorRole(role);
                  if (role === 'CORRESPONDING') {
                    // Check if pub already has nominated
                    const hasNom = (selectedPublication?.authors || []).some((a) => a.is_nominated_corresponding_author);
                    setIsNominatedCorresponding(!hasNom);
                  } else {
                    setIsNominatedCorresponding(false);
                  }
                }}
                options={[
                  { value: 'FIRST', label: 'FIRST AUTHOR (Payable Share)' },
                  { value: 'CORRESPONDING', label: 'CORRESPONDING AUTHOR (Payable Share upon Nomination)' },
                  { value: 'CO_AUTHOR', label: 'CO-AUTHOR (Non-Payable)' },
                ]}
                error={formErrors.authorRole}
                required
              />
              <Input
                type="number"
                label="Author Order *"
                value={authorOrder}
                min={1}
                onChange={(e) => setAuthorOrder(parseInt(e.target.value, 10))}
                error={formErrors.authorOrder}
                required
              />
            </div>

            {/* Full Name */}
            <div style={{ marginBottom: 14 }}>
              <Input
                label="Full Name *"
                placeholder="Author Name as printed on publication"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={formErrors.fullName}
                required
              />
            </div>

            {/* Corresponding Author Specific Flags */}
            {authorRole === 'CORRESPONDING' && (
              <div style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 6, border: '1px solid #E2E8F0', marginBottom: 16 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#1E293B' }}>
                    <input
                      type="checkbox"
                      checked={hasMultipleCorresponding}
                      onChange={(e) => setHasMultipleCorresponding(e.target.checked)}
                    />
                    <span>Paper has multiple corresponding authors</span>
                  </label>
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#1E293B' }}>
                    <input
                      type="checkbox"
                      checked={isNominatedCorresponding}
                      onChange={(e) => setIsNominatedCorresponding(e.target.checked)}
                    />
                    <span>
                      <strong>Nominate this author for payable corresponding-author share</strong>
                    </span>
                  </label>
                  {formErrors.isNominatedCorresponding && (
                    <div style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: 4 }}>
                      {formErrors.isNominatedCorresponding}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Identifiers and Affiliation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <Input
                label="Employee / Registration ID"
                placeholder="Institutional ID if CSJMU affiliated"
                value={employeeOrRegId}
                onChange={(e) => setEmployeeOrRegId(e.target.value)}
              />
              <Input
                label="Mobile Number"
                placeholder="10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                error={formErrors.mobileNumber}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <Input
                label="Scopus Author ID"
                placeholder="e.g. 57200000000"
                value={scopusAuthorId}
                onChange={(e) => setScopusAuthorId(e.target.value)}
              />
              <Input
                label="Scopus Profile URL"
                placeholder="https://www.scopus.com/..."
                value={scopusProfileUrl}
                onChange={(e) => setScopusProfileUrl(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#1E293B' }}>
                <input
                  type="checkbox"
                  checked={isCsjmuAffiliated}
                  onChange={(e) => setIsCsjmuAffiliated(e.target.checked)}
                />
                <span>Author is affiliated with CSJMU Kanpur</span>
              </label>
            </div>

            {/* BANK DETAILS SECTION (Exclusively for Payable Authors) */}
            {isPayableRole ? (
              <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: 16, marginTop: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0B2545', margin: 0 }}>
                    💳 Designated Bank Account for Incentive Payout *
                  </h4>
                  <Badge variant="gold">Payable Role</Badge>
                </div>

                {formErrors.bank && (
                  <div style={{ color: '#DC2626', fontSize: '0.85rem', marginBottom: 12 }}>
                    {formErrors.bank}
                  </div>
                )}

                {/* Strategy Selector */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {cachedBankData && isAuthorApplicant && (
                    <Button
                      variant={bankStrategy === 'APPLICANT_STEP2' ? 'primary' : 'outline'}
                      size="sm"
                      type="button"
                      onClick={() => setBankStrategy('APPLICANT_STEP2')}
                    >
                      Use Applicant Bank (Step 2)
                    </Button>
                  )}
                  <Button
                    variant={bankStrategy === 'NEW' ? 'primary' : 'outline'}
                    size="sm"
                    type="button"
                    onClick={() => setBankStrategy('NEW')}
                  >
                    Enter New Bank Details
                  </Button>
                </div>

                {/* Option 1: Applicant Step 2 Details Preview */}
                {bankStrategy === 'APPLICANT_STEP2' && cachedBankData && (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: 14, borderRadius: 6, fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                      ✓ Designated Applicant Bank Particulars:
                    </div>
                    <div>Account Holder: <strong>{cachedBankData.account_holder_name}</strong></div>
                    <div>Bank: <strong>{cachedBankData.bank_name}</strong> (IFSC: {cachedBankData.ifsc_code})</div>
                    <div>Account: <strong>••••••••{cachedBankData.account_number.slice(-4)}</strong></div>
                  </div>
                )}

                {/* Option 2: Enter New Bank Particulars */}
                {bankStrategy === 'NEW' && (
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: 16, borderRadius: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <Input
                        label="Account Holder Name *"
                        value={bankHolderName}
                        onChange={(e) => setBankHolderName(e.target.value)}
                        error={formErrors.bankHolderName}
                        required
                      />
                      <Input
                        label="Bank Institution Name *"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        error={formErrors.bankName}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <Input
                        type="password"
                        label="Account Number *"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        error={formErrors.accountNumber}
                        required
                      />
                      <Input
                        type="text"
                        label="Confirm Account Number *"
                        value={confirmAccountNumber}
                        onChange={(e) => setConfirmAccountNumber(e.target.value)}
                        error={formErrors.confirmAccountNumber}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <Input
                        label="IFSC Code *"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                        error={formErrors.ifscCode}
                        maxLength={11}
                        required
                      />
                      <Input
                        label="Branch Name *"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        error={formErrors.branchName}
                        required
                      />
                      <Select
                        label="Account Type"
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value as AnudaanBankAccountType)}
                        options={[
                          { value: 'SAVINGS', label: 'Savings' },
                          { value: 'CURRENT', label: 'Current' },
                        ]}
                      />
                    </div>

                    <div style={{ maxWidth: 240 }}>
                      <Input
                        label="PAN (Optional)"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        error={formErrors.panNumber}
                        maxLength={10}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: 12, backgroundColor: '#F8FAFC', borderRadius: 6, color: '#64748B', fontSize: '0.85rem', marginBottom: 16 }}>
                ℹ️ <strong>Co-author non-payable status:</strong> Co-authors are not eligible for cash incentive disbursement. No bank account is collected.
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 12 }}>
              <Button variant="outline" type="button" onClick={() => setSelectedPublication(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading} onClick={handleSaveAuthor}>
                {loading ? 'Adding Author...' : 'Save Author Attribution'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* CONFIRM DELETE AUTHOR MODAL */}
      <Modal
        isOpen={deletingAuthor !== null}
        onClose={() => setDeletingAuthor(null)}
        title="Confirm Author Removal"
      >
        <div style={{ padding: '8px 4px' }}>
          <p style={{ color: '#1E293B', fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 16px' }}>
            Are you sure you want to remove author <strong>{deletingAuthor?.author.full_name}</strong> from this publication?
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" type="button" onClick={() => setDeletingAuthor(null)}>
              Keep Author
            </Button>
            <Button variant="outline" type="button" onClick={handleConfirmDeleteAuthor} disabled={loading}>
              {loading ? 'Removing...' : 'Confirm Remove'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};
