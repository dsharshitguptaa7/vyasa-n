import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Button, Badge } from '@vyasa/ui';
import { AnudaanStepper } from '../components/AnudaanStepper';
import { Step1ApplicantProfile } from '../components/Step1ApplicantProfile';
import { Step2ApplicantBank } from '../components/Step2ApplicantBank';
import { Step3Publications } from '../components/Step3Publications';
import { Step4AuthorsAndBank } from '../components/Step4AuthorsAndBank';
import { Step5Documents } from '../components/Step5Documents';
import {
  AnudaanApplicationDetailOut,
  AnudaanBankAccountInput,
} from '../types/anudaan';
import { anudaanService, ApiError } from '../services/anudaanService';
import { getDraftSession } from '../services/anudaanSession';

export const AnudaanWizardPage: React.FC = () => {
  const navigate = useNavigate();

  // Wizard Navigation State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [application, setApplication] = useState<AnudaanApplicationDetailOut | null>(null);

  // Client-Side Bank Intake Cache (held only in client memory per architectural restriction)
  const [cachedBankData, setCachedBankData] = useState<AnudaanBankAccountInput | null>(null);

  // Loading & Milestone States
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCompletedNotice, setIsCompletedNotice] = useState<boolean>(false);

  useEffect(() => {
    const session = getDraftSession();
    if (!session?.applicationId) {
      setLoading(false);
      return;
    }

    const loadDraft = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const res = await anudaanService.getDraft(session.applicationId, session.draftKey);
        if (res.success && res.data) {
          setApplication(res.data);
          const initialCompleted: number[] = [];

          // Step 1: Profile exists
          if (res.data.full_name && res.data.institutional_id) {
            initialCompleted.push(1);
          }

          // Step 3: Publications exist
          if (res.data.publications && res.data.publications.length > 0) {
            initialCompleted.push(3);

            // Step 4: Authors & Banks complete
            const allAuthorsReady = res.data.publications.every((pub) => {
              const authors = pub.authors || [];
              const firstAuthor = authors.find((a) => a.author_role === 'FIRST');
              const nominated = authors.find((a) => a.is_nominated_corresponding_author);
              return !!firstAuthor && !!nominated && !!firstAuthor.bank_account && !!nominated.bank_account;
            });
            if (allAuthorsReady) {
              initialCompleted.push(4);
            }

            // Step 5: Documents complete
            const docs = res.data.documents || [];
            const allDocsReady = res.data.publications.every((pub) =>
              docs.some((d) => d.document_type === 'PUBLISHED_PAPER' && d.publication_id === pub.id)
            );
            if (allDocsReady) {
              initialCompleted.push(5);
            }
          }

          setCompletedSteps(initialCompleted);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg('Failed to restore draft application from server.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadDraft();
  }, []);

  const handleStep1Success = (updatedApp: AnudaanApplicationDetailOut) => {
    setApplication(updatedApp);
    setCompletedSteps((prev) => (prev.includes(1) ? prev : [...prev, 1]));
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStep2Success = (bankData: AnudaanBankAccountInput) => {
    setCachedBankData(bankData);
    setCompletedSteps((prev) => (prev.includes(2) ? prev : [...prev, 2]));
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStep3Success = () => {
    setCompletedSteps((prev) => (prev.includes(3) ? prev : [...prev, 3]));
    setCurrentStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStep4Success = () => {
    setCompletedSteps((prev) => (prev.includes(4) ? prev : [...prev, 4]));
    setCurrentStep(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStep5Complete = () => {
    setCompletedSteps((prev) => (prev.includes(5) ? prev : [...prev, 5]));
    setIsCompletedNotice(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <PageContainer>
        <div style={{ maxWidth: 960, margin: '80px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: '1.25rem', color: '#0B2545', margin: '0 0 8px' }}>
            Loading ANUDAAN Application Draft...
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.9rem' }}>
            Verifying draft credentials and restoring institutional state...
          </p>
        </div>
      </PageContainer>
    );
  }

  // No active session state
  if (!application) {
    return (
      <PageContainer>
        <div
          style={{
            maxWidth: 680,
            margin: '60px auto',
            padding: 36,
            textAlign: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0B2545', margin: '0 0 10px' }}>
            No Active Application Session Found
          </h2>
          <p style={{ color: '#4A5568', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 24 }}>
            {errorMsg ||
              'To proceed with an incentive claim, please start a new application draft or resume an existing draft with your confidential Tracking Secret.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => navigate('/modules/yajur-veda/anudaan')}>
              Go to ANUDAAN Portal
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px' }}>
        {/* Masthead Ribbon */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 24,
            borderBottom: '1px solid #E2E8F0',
            paddingBottom: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Badge variant="primary">ANUDAAN Application Wizard</Badge>
              <Badge variant="neutral">Status: {application.status}</Badge>
            </div>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: '#0B2545',
                fontFamily: 'var(--font-heading, Cinzel, serif)',
                margin: 0,
              }}
            >
              {application.application_number}
            </h1>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/modules/yajur-veda/anudaan')}
          >
            Save & Exit to Portal
          </Button>
        </div>

        {/* 5-Step Progress Tracker */}
        <AnudaanStepper
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={(step) => setCurrentStep(step)}
        />

        {/* Phase 4.3 Completion Milestone Banner */}
        {isCompletedNotice && (
          <div
            style={{
              backgroundColor: '#ECFDF5',
              border: '1px solid #10B981',
              borderRadius: 8,
              padding: '20px 24px',
              marginBottom: 28,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#065F46', fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>
              <span>✓</span> Phase 4.3 Intake & Document Milestone Complete!
            </div>
            <p style={{ margin: '0 0 10px', color: '#047857', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Steps 1 through 5 have been successfully completed. Your applicant profile, research publications, author attributions, encrypted banking particulars, and manuscript proof documents are fully verified and persisted on the server.
            </p>
            <div style={{ fontSize: '0.85rem', color: '#065F46' }}>
              <strong>Upcoming Milestone:</strong> Step 6 (Statutory Declarations, Final Review & Atomic Submission) will unlock in Phase 4.4.
            </div>
          </div>
        )}

        {/* Active Step Content */}
        {currentStep === 1 && (
          <Step1ApplicantProfile
            initialData={application}
            onSuccess={handleStep1Success}
            onCancel={() => navigate('/modules/yajur-veda/anudaan')}
          />
        )}

        {currentStep === 2 && (
          <Step2ApplicantBank
            application={application}
            initialBankData={cachedBankData}
            onSuccess={handleStep2Success}
            onBack={() => {
              setCurrentStep(1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentStep === 3 && (
          <Step3Publications
            application={application}
            onRefreshApplication={(updated) => setApplication(updated)}
            onBack={() => {
              setCurrentStep(2);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onComplete={handleStep3Success}
          />
        )}

        {currentStep === 4 && (
          <Step4AuthorsAndBank
            application={application}
            cachedBankData={cachedBankData}
            onRefreshApplication={(updated) => setApplication(updated)}
            onBack={() => {
              setCurrentStep(3);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSuccess={handleStep4Success}
          />
        )}

        {currentStep === 5 && (
          <Step5Documents
            application={application}
            onRefreshApplication={(updated) => setApplication(updated)}
            onBack={() => {
              setCurrentStep(4);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onComplete={handleStep5Complete}
          />
        )}
      </div>
    </PageContainer>
  );
};
