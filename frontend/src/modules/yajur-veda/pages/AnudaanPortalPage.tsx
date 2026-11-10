import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal, Input, Select, PageContainer } from '@vyasa/ui';
import { anudaanService, ApiError } from '../services/anudaanService';
import {
  getDraftSession,
  clearDraftSession,
  saveDraftSession,
  AnudaanSessionCredentials,
} from '../services/anudaanSession';
import {
  AnudaanApplicantCategory,
  AnudaanDraftCreationResponse,
} from '../types/anudaan';

export const AnudaanPortalPage: React.FC = () => {
  const navigate = useNavigate();

  // Active Session State
  const [activeSession, setActiveSession] = useState<AnudaanSessionCredentials | null>(null);

  // Modal Dialog States
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);

  // New Application Form State
  const [applicantCategory, setApplicantCategory] = useState<AnudaanApplicantCategory>('FACULTY_CAMPUS');
  const [fullName, setFullName] = useState('');
  const [institutionalId, setInstitutionalId] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [scopusAuthorId, setScopusAuthorId] = useState('');
  const [scopusProfileUrl, setScopusProfileUrl] = useState('');

  // Draft Creation Output
  const [createdDraft, setCreatedDraft] = useState<AnudaanDraftCreationResponse | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Resume Form State
  const [resumeAppId, setResumeAppId] = useState('');
  const [resumeSecret, setResumeSecret] = useState('');
  const [resumeSuccessMsg, setResumeSuccessMsg] = useState<string | null>(null);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setActiveSession(getDraftSession());
  }, []);

  const handleStartNewApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !institutionalId.trim() || !designation.trim() || !departmentName.trim() || !mobileNumber.trim()) {
      setErrorMsg('Please complete all mandatory fields.');
      return;
    }

    if (applicantCategory !== 'FACULTY_CAMPUS' && !supervisorName.trim()) {
      setErrorMsg('Supervisor name is mandatory for research scholars and postdoctoral researchers.');
      return;
    }

    try {
      setLoading(true);
      const res = await anudaanService.createDraft({
        applicant_category: applicantCategory,
        full_name: fullName.trim(),
        institutional_id: institutionalId.trim(),
        designation: designation.trim(),
        department_name: departmentName.trim(),
        supervisor_name: supervisorName.trim() || undefined,
        mobile_number: mobileNumber.trim(),
        scopus_author_id: scopusAuthorId.trim() || undefined,
        scopus_profile_url: scopusProfileUrl.trim() || undefined,
      });

      if (res.success && res.data) {
        setCreatedDraft(res.data);
        setActiveSession(getDraftSession());
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to initialize application draft. Please check connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResumeApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResumeSuccessMsg(null);

    const appId = resumeAppId.trim();
    const secret = resumeSecret.trim();

    if (!appId || !secret) {
      setErrorMsg('Both Application ID and Tracking Secret are required.');
      return;
    }

    try {
      setLoading(true);
      const res = await anudaanService.getDraft(appId, secret);
      if (res.success && res.data) {
        saveDraftSession({
          applicationId: res.data.id,
          applicationNumber: res.data.application_number,
          draftKey: secret,
        });
        setActiveSession(getDraftSession());
        setResumeSuccessMsg(
          `Draft verified successfully: ${res.data.application_number} (${res.data.applicant_category})`
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Invalid Application ID or Tracking Secret.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardSession = () => {
    clearDraftSession();
    setActiveSession(null);
  };

  const handleCopyCredentials = () => {
    if (!createdDraft) return;
    const text = `Application Number: ${createdDraft.application_number}\nTracking Secret: ${createdDraft.tracking_secret}\nApplication ID: ${createdDraft.application_id}`;
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 3000);
  };

  return (
    <PageContainer>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px' }}>
        {/* Masthead Banner */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Badge variant="neutral" style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            2nd Pillar • Yajur Veda • Research Governance
          </Badge>
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: '#0B2545',
              margin: '8px 0 16px',
              fontFamily: 'var(--font-heading, Cinzel, serif)',
            }}
          >
            ANUDAAN Research Incentive Portal
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#4A5568', maxWidth: 720, margin: '0 auto', lineHeight: 1.6 }}>
            Chhatrapati Shahu Ji Maharaj University, Kanpur institutional scheme for incentivizing high-impact,
            peer-reviewed research publications indexed in Scopus and Web of Science.
          </p>
        </div>

        {/* Active Draft Banner if present */}
        {activeSession && (
          <div
            style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <span style={{ fontWeight: 600, color: '#1E40AF', display: 'block', fontSize: '0.95rem' }}>
                Active Draft Session Detected
              </span>
              <span style={{ fontSize: '0.875rem', color: '#3B82F6' }}>
                Application No: <strong>{activeSession.applicationNumber}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/modules/yajur-veda/anudaan/apply')}
              >
                Continue Application
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscardSession}
              >
                Clear Session
              </Button>
            </div>
          </div>
        )}

        {/* Primary Action Gateways */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 48 }}>
          {/* Card 1: New Application */}
          <Card style={{ padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 22 }}>📝</span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0B2545', marginBottom: 8 }}>
                New Incentive Claim
              </h2>
              <p style={{ color: '#4A5568', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 20 }}>
                Initiate a research publication incentive claim for articles or reviews published on or after January 1, 2026.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                setErrorMsg(null);
                setCreatedDraft(null);
                setIsStartModalOpen(true);
              }}
              style={{ width: '100%' }}
            >
              Start New Application
            </Button>
          </Card>

          {/* Card 2: Resume Draft */}
          <Card style={{ padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 22 }}>🔑</span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0B2545', marginBottom: 8 }}>
                Resume Application
              </h2>
              <p style={{ color: '#4A5568', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 20 }}>
                Continue a previously saved draft using your institutional Application ID and confidential Tracking Secret.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setErrorMsg(null);
                setResumeSuccessMsg(null);
                setIsResumeModalOpen(true);
              }}
              style={{ width: '100%' }}
            >
              Resume Draft
            </Button>
          </Card>

          {/* Card 3: Track Status */}
          <Card style={{ padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 22 }}>🔍</span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0B2545', marginBottom: 8 }}>
                Track Application
              </h2>
              <p style={{ color: '#4A5568', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 20 }}>
                Check real-time institutional verification, Dean review, and incentive disbursement progress.
              </p>
            </div>
            <Button
              variant="teal"
              onClick={() => navigate('/modules/yajur-veda/anudaan/track')}
              style={{ width: '100%' }}
            >
              Track Status
            </Button>
          </Card>
        </div>

        {/* Scheme Guidelines & Policy Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 24 }}>
          {/* Eligibility Card */}
          <Card style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0B2545', marginBottom: 16 }}>
              🏛️ Institutional Eligibility Criteria
            </h3>
            <ul style={{ paddingLeft: 20, margin: 0, color: '#4A5568', fontSize: '0.925rem', lineHeight: 1.8 }}>
              <li>
                <strong>Eligible Roles:</strong> Regular Campus Faculty, Registered Campus Research Scholars, and Campus Post-Doctoral Researchers.
              </li>
              <li>
                <strong>Institutional Affiliation:</strong> Publications must bear explicit affiliation with <em>Chhatrapati Shahu Ji Maharaj University, Kanpur</em>.
              </li>
              <li>
                <strong>Payable Roles:</strong> Payout is granted exclusively to the First Author and/or one Nominated Corresponding Author.
              </li>
              <li>
                <strong>Exclusions:</strong> Affiliated college faculty, retired personnel, and external authors are non-payable.
              </li>
            </ul>
          </Card>

          {/* Publication Requirements Card */}
          <Card style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0B2545', marginBottom: 16 }}>
              📚 Publication Eligibility Requirements
            </h3>
            <ul style={{ paddingLeft: 20, margin: 0, color: '#4A5568', fontSize: '0.925rem', lineHeight: 1.8 }}>
              <li>
                <strong>Publication Date:</strong> Published on or after <strong>January 1, 2026</strong>.
              </li>
              <li>
                <strong>Document Classification:</strong> Original Research <strong>Article</strong> or Critical <strong>Review</strong>.
              </li>
              <li>
                <strong>Indexing Standard:</strong> Indexed in <strong>Scopus</strong> and/or <strong>Web of Science (WoS)</strong>.
              </li>
              <li>
                <strong>Publication Status:</strong> Only fully <strong>PUBLISHED</strong> papers are eligible (Accepted or In-Press papers must await issue assignment).
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* MODAL 1: Start New Application */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title={createdDraft ? 'Application Draft Initialized' : 'Start New ANUDAAN Application'}
      >
        <div style={{ padding: '8px 4px' }}>
          {errorMsg && (
            <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #F87171', color: '#B91C1C', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.9rem' }}>
              {errorMsg}
            </div>
          )}

          {createdDraft ? (
            <div>
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: 18, marginBottom: 20 }}>
                <p style={{ margin: '0 0 12px', color: '#166534', fontWeight: 600 }}>
                  ✓ Draft created successfully! Please save your confidential credentials below:
                </p>
                <div style={{ fontFamily: 'monospace', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 6, border: '1px solid #DCFCE7' }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: '#6B7280' }}>Application Number:</span>{' '}
                    <strong style={{ color: '#0B2545' }}>{createdDraft.application_number}</strong>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: '#6B7280' }}>Tracking Secret:</span>{' '}
                    <strong style={{ color: '#B45309' }}>{createdDraft.tracking_secret}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6B7280' }}>Application ID:</span>{' '}
                    <span style={{ color: '#374151', fontSize: '0.85rem' }}>{createdDraft.application_id}</span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: 20 }}>
                ⚠️ <strong>Important:</strong> Your Tracking Secret serves as your confidential draft key and is required to track or resume your application. Credentials are saved in your current browser tab.
              </p>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button variant="outline" onClick={handleCopyCredentials}>
                  {copiedSecret ? '✓ Copied!' : 'Copy Credentials'}
                </Button>
                <Button variant="primary" onClick={() => navigate('/modules/yajur-veda/anudaan/apply')}>
                  Proceed to Wizard →
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleStartNewApplication}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                  Applicant Category *
                </label>
                <Select
                  value={applicantCategory}
                  onChange={(e) => setApplicantCategory(e.target.value as AnudaanApplicantCategory)}
                  options={[
                    { value: 'FACULTY_CAMPUS', label: 'CSJMU Campus Faculty' },
                    { value: 'SCHOLAR_CAMPUS', label: 'CSJMU Registered Research Scholar' },
                    { value: 'POSTDOC_CAMPUS', label: 'CSJMU Post-Doctoral Researcher' },
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Full Name *
                  </label>
                  <Input
                    placeholder="Prof. / Dr. / Scholar Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Employee / Registration ID *
                  </label>
                  <Input
                    placeholder="EMP1234 or CSJMU-PHD-202X"
                    value={institutionalId}
                    onChange={(e) => setInstitutionalId(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Designation *
                  </label>
                  <Input
                    placeholder="Assistant Professor, Research Scholar..."
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Department / School *
                  </label>
                  <Input
                    placeholder="Department of Computer Science..."
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {applicantCategory !== 'FACULTY_CAMPUS' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Supervisor / Mentor Name *
                  </label>
                  <Input
                    placeholder="Full name of research supervisor"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                  Mobile Number *
                </label>
                <Input
                  placeholder="10-digit mobile number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Scopus Author ID (Optional)
                  </label>
                  <Input
                    placeholder="e.g. 57200000000"
                    value={scopusAuthorId}
                    onChange={(e) => setScopusAuthorId(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                    Scopus Profile URL (Optional)
                  </label>
                  <Input
                    placeholder="https://www.scopus.com/authid/..."
                    value={scopusProfileUrl}
                    onChange={(e) => setScopusProfileUrl(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button variant="outline" type="button" onClick={() => setIsStartModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? 'Initializing...' : 'Create Application Draft'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* MODAL 2: Resume Draft */}
      <Modal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        title="Resume Existing Application"
      >
        <div style={{ padding: '8px 4px' }}>
          {errorMsg && (
            <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #F87171', color: '#B91C1C', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.9rem' }}>
              {errorMsg}
            </div>
          )}

          {resumeSuccessMsg && (
            <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', padding: '12px 16px', borderRadius: 6, marginBottom: 16, fontSize: '0.9rem' }}>
              <div style={{ marginBottom: 8 }}>✓ {resumeSuccessMsg}</div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/modules/yajur-veda/anudaan/apply')}
              >
                Launch Application Wizard →
              </Button>
            </div>
          )}

          <form onSubmit={handleResumeApplication}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                Application ID (UUID) *
              </label>
              <Input
                placeholder="e.g. 01d12825-9dda-4775-aa02-..."
                value={resumeAppId}
                onChange={(e) => setResumeAppId(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
                Confidential Tracking Secret *
              </label>
              <Input
                type="password"
                placeholder="32-character secret issued at creation"
                value={resumeSecret}
                onChange={(e) => setResumeSecret(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="outline" type="button" onClick={() => setIsResumeModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Resume'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </PageContainer>
  );
};
