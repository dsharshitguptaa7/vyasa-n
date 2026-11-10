import React, { useState } from 'react';
import { Card, Button, Input, Select, Badge } from '@vyasa/ui';
import {
  AnudaanApplicationDetailOut,
  AnudaanBankAccountInput,
  AnudaanBankAccountType,
  AnudaanDocumentCategory,
  AnudaanDocumentOut,
} from '../types/anudaan';
import { anudaanService, ApiError } from '../services/anudaanService';

export interface ApplicantBankFormData extends AnudaanBankAccountInput {
  confirm_account_number: string;
}

export interface Step2ApplicantBankProps {
  application: AnudaanApplicationDetailOut;
  initialBankData?: AnudaanBankAccountInput | null;
  onSuccess: (bankData: AnudaanBankAccountInput) => void;
  onBack: () => void;
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const Step2ApplicantBank: React.FC<Step2ApplicantBankProps> = ({
  application,
  initialBankData,
  onSuccess,
  onBack,
}) => {
  // Bank Form State
  const [accountHolderName, setAccountHolderName] = useState(
    initialBankData?.account_holder_name || application.full_name || ''
  );
  const [bankName, setBankName] = useState(initialBankData?.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(initialBankData?.account_number || '');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState(
    initialBankData?.account_number || ''
  );
  const [ifscCode, setIfscCode] = useState(initialBankData?.ifsc_code || '');
  const [branchName, setBranchName] = useState(initialBankData?.branch_name || '');
  const [accountType, setAccountType] = useState<AnudaanBankAccountType>(
    initialBankData?.account_type || 'SAVINGS'
  );
  const [panNumber, setPanNumber] = useState(initialBankData?.pan_number || '');

  // Document Upload State
  const [selectedProofCategory, setSelectedProofCategory] = useState<AnudaanDocumentCategory>(
    'CANCELLED_CHEQUE'
  );
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedProof, setUploadedProof] = useState<AnudaanDocumentOut | null>(() => {
    return (
      application.documents?.find(
        (d) => d.document_type === 'CANCELLED_CHEQUE' || d.document_type === 'PASSBOOK'
      ) || null
    );
  });

  // Validation & Error States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!accountHolderName.trim() || accountHolderName.trim().length < 2) {
      newErrors.accountHolderName = 'Account holder name is required.';
    }

    if (!bankName.trim() || bankName.trim().length < 2) {
      newErrors.bankName = 'Bank name is required.';
    }

    if (!accountNumber.trim() || accountNumber.trim().length < 6) {
      newErrors.accountNumber = 'Account number must contain at least 6 digits.';
    }

    if (!confirmAccountNumber.trim()) {
      newErrors.confirmAccountNumber = 'Please confirm the account number.';
    } else if (accountNumber.trim() !== confirmAccountNumber.trim()) {
      newErrors.confirmAccountNumber = 'Account numbers do not match. Please verify.';
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!cleanIfsc) {
      newErrors.ifscCode = 'IFSC code is required.';
    } else if (!IFSC_REGEX.test(cleanIfsc)) {
      newErrors.ifscCode = 'Invalid IFSC format. Must be 11 characters (e.g. SBIN0001234).';
    }

    if (!branchName.trim()) {
      newErrors.branchName = 'Branch location/name is required.';
    }

    if (panNumber.trim()) {
      const cleanPan = panNumber.trim().toUpperCase();
      if (!PAN_REGEX.test(cleanPan)) {
        newErrors.panNumber = 'Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUploadProofDocument = async () => {
    if (!uploadFile) {
      setServerError('Please select a cancelled cheque or passbook file to upload.');
      return;
    }

    const allowedMime = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedMime.includes(uploadFile.type)) {
      setServerError('Unsupported document format. Only PDF, PNG, and JPEG documents are permitted.');
      return;
    }

    if (uploadFile.size > 10 * 1024 * 1024) {
      setServerError('File size exceeds the 10 MB institutional ceiling.');
      return;
    }

    try {
      setUploading(true);
      setServerError(null);
      setUploadNotice(null);

      const res = await anudaanService.uploadDocument(
        application.id,
        uploadFile,
        selectedProofCategory
      );

      if (res.success && res.data) {
        setUploadedProof(res.data);
        setUploadFile(null);
        setUploadNotice(`Proof document uploaded successfully: ${res.data.original_filename}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Failed to upload proof document. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProofDocument = async () => {
    if (!uploadedProof) return;

    try {
      setUploading(true);
      setServerError(null);
      await anudaanService.deleteDocument(uploadedProof.id);
      setUploadedProof(null);
      setUploadNotice('Bank proof document removed.');
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Failed to delete proof document.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    // Exclude confirm_account_number from client data payload per strict specification
    const bankPayload: AnudaanBankAccountInput = {
      account_holder_name: accountHolderName.trim(),
      bank_name: bankName.trim(),
      account_number: accountNumber.trim(),
      ifsc_code: ifscCode.trim().toUpperCase(),
      branch_name: branchName.trim(),
      account_type: accountType,
      pan_number: panNumber.trim().toUpperCase() || null,
      bank_mobile_number: application.mobile_number || null,
    };

    onSuccess(bankPayload);
  };

  return (
    <Card style={{ padding: 32 }}>
      {/* Step Header */}
      <div style={{ marginBottom: 24, borderBottom: '1px solid #E2E8F0', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 2 of 3
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0B2545', margin: '4px 0 0' }}>
              Applicant Bank Details Intake
            </h2>
          </div>
          <Badge variant="neutral">
            Intake Session (Client Memory)
          </Badge>
        </div>
      </div>

      {/* IMPORTANT ARCHITECTURAL RESTRICTION ADVISORY */}
      <div
        style={{
          backgroundColor: '#FFFBEB',
          borderLeft: '4px solid #F59E0B',
          borderRadius: 4,
          padding: '16px 20px',
          marginBottom: 28,
        }}
      >
        <div style={{ fontWeight: 700, color: '#92400E', fontSize: '0.925rem', marginBottom: 6 }}>
          Institutional Architecture Notice: Bank Details Persistence Limitation
        </div>
        <p style={{ margin: '0 0 8px', color: '#78350F', fontSize: '0.875rem', lineHeight: 1.5 }}>
          Under the ANUDAAN Field Mapping V1.1 and database architecture, bank accounts are legally bound to{' '}
          <strong>Publication Authors</strong> upon attribution in Step 4, rather than stored as top-level draft fields on the application.
        </p>
        <p style={{ margin: 0, color: '#92400E', fontSize: '0.825rem', lineHeight: 1.5 }}>
          <strong>State Handling:</strong> The bank particulars entered below are retained in client session memory during this intake step.
          In Step 4, if you designate yourself as a payable author (First Author or Nominated Corresponding Author), you will be able to explicitly attach these details.
          If you refresh the browser or re-open the draft from another browser session without attributing authors, bank details are not permanently recovered.
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

      {uploadNotice && (
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
          {uploadNotice}
        </div>
      )}

      <form noValidate onSubmit={handleSubmit}>
        {/* Account Holder and Bank Name */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 18 }}>
          <Input
            label="Account Holder Name (As per Bank Records)"
            placeholder="e.g. Dr. Harshit Gupta"
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            error={errors.accountHolderName}
            required
          />
          <Input
            label="Bank Institution Name"
            placeholder="e.g. State Bank of India, Punjab National Bank"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            error={errors.bankName}
            required
          />
        </div>

        {/* Account Number and Confirmation */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 18 }}>
          <Input
            type="password"
            label="Bank Account Number"
            placeholder="Enter full account number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            error={errors.accountNumber}
            required
          />
          <Input
            type="text"
            label="Confirm Bank Account Number"
            placeholder="Re-enter account number to verify"
            value={confirmAccountNumber}
            onChange={(e) => setConfirmAccountNumber(e.target.value)}
            error={errors.confirmAccountNumber}
            hint="Frontend verification only. Never stored or transmitted."
            required
          />
        </div>

        {/* IFSC, Branch, and Account Type */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 18 }}>
          <Input
            label="IFSC Code"
            placeholder="e.g. SBIN0001234"
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            error={errors.ifscCode}
            maxLength={11}
            required
          />
          <Input
            label="Branch Name / Location"
            placeholder="e.g. CSJMU Campus Branch, Kanpur"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            error={errors.branchName}
            required
          />
          <Select
            label="Account Type"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AnudaanBankAccountType)}
            options={[
              { value: 'SAVINGS', label: 'Savings Account' },
              { value: 'CURRENT', label: 'Current Account' },
            ]}
            required
          />
        </div>

        {/* PAN Number */}
        <div style={{ marginBottom: 28, maxWidth: 360 }}>
          <Input
            label="PAN Number (Optional)"
            placeholder="e.g. ABCDE1234F"
            value={panNumber}
            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
            error={errors.panNumber}
            maxLength={10}
            hint="Used for institutional tax deduction compliance on disbursements."
          />
        </div>

        {/* Bank Proof Document Upload Section */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 24, marginBottom: 28 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0B2545', marginBottom: 8 }}>
            📎 Bank Proof Document (Cancelled Cheque / Passbook)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 16px' }}>
            Attach a legible PDF or image of your cancelled cheque or passbook front page bearing your account number and IFSC.
          </p>

          {uploadedProof ? (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: '#1E293B', display: 'block', fontSize: '0.9rem' }}>
                  {uploadedProof.original_filename}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Type: {uploadedProof.document_type} • Size: {(uploadedProof.file_size_bytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleDeleteProofDocument}
                disabled={uploading}
              >
                {uploading ? 'Removing...' : 'Remove Document'}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ width: 200 }}>
                <Select
                  label="Document Type"
                  value={selectedProofCategory}
                  onChange={(e) => setSelectedProofCategory(e.target.value as AnudaanDocumentCategory)}
                  options={[
                    { value: 'CANCELLED_CHEQUE', label: 'Cancelled Cheque' },
                    { value: 'PASSBOOK', label: 'Passbook Front Page' },
                  ]}
                />
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#4A5568', marginBottom: 4 }}>
                  Select File (PDF, PNG, JPEG max 10MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>
              <Button
                variant="teal"
                type="button"
                onClick={handleUploadProofDocument}
                disabled={!uploadFile || uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Proof'}
              </Button>
            </div>
          )}
        </div>

        {/* Navigation Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
          <Button variant="outline" type="button" onClick={onBack}>
            ← Back to Profile
          </Button>

          <Button variant="primary" type="submit">
            Continue to Publications →
          </Button>
        </div>
      </form>
    </Card>
  );
};
