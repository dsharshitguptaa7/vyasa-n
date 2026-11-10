import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Badge } from '@vyasa/ui';
import {
  AnudaanApplicantCategory,
  AnudaanApplicationDetailOut,
  AnudaanApplicationCreateDraft,
  AnudaanApplicationUpdateDraft,
} from '../types/anudaan';
import { anudaanService, ApiError } from '../services/anudaanService';

export interface Step1ApplicantProfileProps {
  initialData?: AnudaanApplicationDetailOut | null;
  onSuccess: (updatedApp: AnudaanApplicationDetailOut) => void;
  onCancel?: () => void;
}

const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

export const Step1ApplicantProfile: React.FC<Step1ApplicantProfileProps> = ({
  initialData,
  onSuccess,
  onCancel,
}) => {
  // Form Fields
  const [applicantCategory, setApplicantCategory] = useState<AnudaanApplicantCategory>(
    initialData?.applicant_category || 'FACULTY_CAMPUS'
  );
  const [fullName, setFullName] = useState(initialData?.full_name || '');
  const [institutionalId, setInstitutionalId] = useState(initialData?.institutional_id || '');
  const [designation, setDesignation] = useState(initialData?.designation || '');
  const [departmentName, setDepartmentName] = useState(initialData?.department_name || '');
  const [supervisorName, setSupervisorName] = useState(initialData?.supervisor_name || '');
  const [mobileNumber, setMobileNumber] = useState(initialData?.mobile_number || '');
  const [scopusAuthorId, setScopusAuthorId] = useState(initialData?.scopus_author_id || '');
  const [scopusProfileUrl, setScopusProfileUrl] = useState(initialData?.scopus_profile_url || '');

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setApplicantCategory(initialData.applicant_category);
      setFullName(initialData.full_name);
      setInstitutionalId(initialData.institutional_id);
      setDesignation(initialData.designation);
      setDepartmentName(initialData.department_name);
      setSupervisorName(initialData.supervisor_name || '');
      setMobileNumber(initialData.mobile_number);
      setScopusAuthorId(initialData.scopus_author_id || '');
      setScopusProfileUrl(initialData.scopus_profile_url || '');
    }
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      newErrors.fullName = 'Full name is required (minimum 2 characters).';
    }

    if (!institutionalId.trim()) {
      newErrors.institutionalId =
        applicantCategory === 'FACULTY_CAMPUS'
          ? 'Employee Code is required.'
          : 'Registration / Ph.D. Enrollment Number is required.';
    }

    if (!designation.trim()) {
      newErrors.designation = 'Designation is required.';
    }

    if (!departmentName.trim()) {
      newErrors.departmentName = 'Department / School name is required.';
    }

    if (applicantCategory !== 'FACULTY_CAMPUS' && !supervisorName.trim()) {
      newErrors.supervisorName =
        'Supervisor / Mentor name is mandatory for Research Scholars and Post-Docs.';
    }

    const cleanPhone = mobileNumber.replace(/[\s-]/g, '');
    if (!cleanPhone || !PHONE_REGEX.test(cleanPhone)) {
      newErrors.mobileNumber = 'Please enter a valid 10 to 15-digit mobile number.';
    }

    if (scopusProfileUrl.trim()) {
      try {
        new URL(scopusProfileUrl.trim());
      } catch {
        newErrors.scopusProfileUrl = 'Please enter a valid URL (e.g. https://www.scopus.com/authid/...).';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);

      if (initialData?.id) {
        // Update existing draft
        const updatePayload: AnudaanApplicationUpdateDraft = {
          applicant_category: applicantCategory,
          full_name: fullName.trim(),
          institutional_id: institutionalId.trim(),
          designation: designation.trim(),
          department_name: departmentName.trim(),
          supervisor_name:
            applicantCategory !== 'FACULTY_CAMPUS' ? supervisorName.trim() : null,
          mobile_number: mobileNumber.trim(),
          scopus_author_id: scopusAuthorId.trim() || null,
          scopus_profile_url: scopusProfileUrl.trim() || null,
        };

        const res = await anudaanService.updateDraft(initialData.id, updatePayload);
        if (res.success && res.data) {
          onSuccess(res.data);
        }
      } else {
        // Create initial draft
        const createPayload: AnudaanApplicationCreateDraft = {
          applicant_category: applicantCategory,
          full_name: fullName.trim(),
          institutional_id: institutionalId.trim(),
          designation: designation.trim(),
          department_name: departmentName.trim(),
          supervisor_name:
            applicantCategory !== 'FACULTY_CAMPUS' ? supervisorName.trim() : undefined,
          mobile_number: mobileNumber.trim(),
          scopus_author_id: scopusAuthorId.trim() || undefined,
          scopus_profile_url: scopusProfileUrl.trim() || undefined,
        };

        const res = await anudaanService.createDraft(createPayload);
        if (res.success && res.data) {
          // Fetch full application detail graph
          const fullApp = await anudaanService.getDraft(res.data.application_id);
          if (fullApp.success && fullApp.data) {
            onSuccess(fullApp.data);
          }
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Failed to save applicant profile. Please verify network connectivity.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ padding: 32 }}>
      {/* Step Header */}
      <div style={{ marginBottom: 24, borderBottom: '1px solid #E2E8F0', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 1 of 3
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0B2545', margin: '4px 0 0' }}>
              Applicant Profile & Eligibility
            </h2>
          </div>
          {initialData?.application_number && (
            <Badge variant="primary">
              Draft: {initialData.application_number}
            </Badge>
          )}
        </div>
      </div>

      {/* Institutional Eligibility Advisory Banner */}
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
          🏛️ Institutional Campus Eligibility Rules
        </div>
        <p style={{ margin: 0, color: '#4A5568', fontSize: '0.875rem', lineHeight: 1.5 }}>
          Only regular, serving <strong>CSJMU Campus Faculty</strong>, officially registered{' '}
          <strong>CSJMU Campus Research Scholars</strong>, and <strong>Campus Post-Doctoral Researchers</strong>{' '}
          are eligible to submit claims under the ANUDAAN scheme. Affiliated college faculty, retired staff, and alumni are strictly ineligible.
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

      <form noValidate onSubmit={handleSubmit}>
        {/* Applicant Category */}
        <div style={{ marginBottom: 18 }}>
          <Select
            label="Applicant Category"
            value={applicantCategory}
            onChange={(e) => {
              setApplicantCategory(e.target.value as AnudaanApplicantCategory);
              if (e.target.value === 'FACULTY_CAMPUS') {
                setSupervisorName('');
              }
            }}
            options={[
              { value: 'FACULTY_CAMPUS', label: 'CSJMU Campus Faculty (Regular / Serving)' },
              { value: 'SCHOLAR_CAMPUS', label: 'CSJMU Registered Research Scholar (Campus)' },
              { value: 'POSTDOC_CAMPUS', label: 'CSJMU Post-Doctoral Researcher (Campus)' },
            ]}
            required
          />
        </div>

        {/* Name and ID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 18 }}>
          <Input
            label="Full Name"
            placeholder="Prof. / Dr. / Research Scholar Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            required
          />
          <Input
            label={applicantCategory === 'FACULTY_CAMPUS' ? 'Employee Code' : 'Ph.D. / Enrollment Registration ID'}
            placeholder={applicantCategory === 'FACULTY_CAMPUS' ? 'e.g. EMP-1042' : 'e.g. CSJMU-PHD-2024-042'}
            value={institutionalId}
            onChange={(e) => setInstitutionalId(e.target.value)}
            error={errors.institutionalId}
            required
          />
        </div>

        {/* Designation and Department */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 18 }}>
          <Input
            label="Designation"
            placeholder="e.g. Assistant Professor, Junior Research Fellow"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            error={errors.designation}
            required
          />
          <Input
            label="Department / School"
            placeholder="e.g. School of Arts, Humanities & Social Sciences"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            error={errors.departmentName}
            required
          />
        </div>

        {/* Conditional Supervisor field */}
        {applicantCategory !== 'FACULTY_CAMPUS' && (
          <div style={{ marginBottom: 18 }}>
            <Input
              label="Research Supervisor / Mentor Name"
              placeholder="Full name of allocated Ph.D. supervisor"
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
              error={errors.supervisorName}
              hint="Mandatory for Ph.D. scholars and postdoctoral researchers per university regulations."
              required
            />
          </div>
        )}

        {/* Mobile Number */}
        <div style={{ marginBottom: 18 }}>
          <Input
            label="Mobile Number (Active for SMS / Alerts)"
            placeholder="10-digit mobile number (e.g. 9876543210)"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            error={errors.mobileNumber}
            hint="Used for official incentive status notifications and Dean query dispatches."
            required
          />
        </div>

        {/* Scopus Identifiers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
          <Input
            label="Scopus Author ID (Optional)"
            placeholder="e.g. 57200000000"
            value={scopusAuthorId}
            onChange={(e) => setScopusAuthorId(e.target.value)}
            hint="Facilitates automated Scopus index matching and verification."
          />
          <Input
            label="Scopus Profile URL (Optional)"
            placeholder="https://www.scopus.com/authid/detail.uri?authorId=..."
            value={scopusProfileUrl}
            onChange={(e) => setScopusProfileUrl(e.target.value)}
            error={errors.scopusProfileUrl}
          />
        </div>

        {/* Navigation Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
          {onCancel ? (
            <Button variant="outline" type="button" onClick={onCancel}>
              ← Cancel & Return
            </Button>
          ) : (
            <div />
          )}

          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Saving Profile...' : 'Save & Continue to Bank Details →'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
