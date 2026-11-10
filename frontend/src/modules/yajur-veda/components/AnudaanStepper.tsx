import React from 'react';

export interface StepItem {
  id: number;
  title: string;
  subtitle: string;
}

export interface AnudaanStepperProps {
  currentStep: number;
  totalSteps?: number;
  steps?: StepItem[];
  onStepClick?: (step: number) => void;
  completedSteps?: number[];
}

const DEFAULT_STEPS: StepItem[] = [
  { id: 1, title: 'Applicant Profile', subtitle: 'Category & Identity' },
  { id: 2, title: 'Bank Details', subtitle: 'Payout Account Intake' },
  { id: 3, title: 'Publications', subtitle: 'Articles & DOIs' },
  { id: 4, title: 'Authors & Bank', subtitle: 'Attribution & Mapping' },
  { id: 5, title: 'Documents', subtitle: 'Manuscript Proofs' },
];

export const AnudaanStepper: React.FC<AnudaanStepperProps> = ({
  currentStep,
  steps = DEFAULT_STEPS,
  onStepClick,
  completedSteps = [],
}) => {
  return (
    <nav aria-label="Application Progress" style={{ marginBottom: 32 }}>
      <ol
        className="anudaan-stepper-list"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${steps.length}, minmax(135px, 1fr))`,
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {steps.map((step) => {
          const isCurrent = currentStep === step.id;
          const isCompleted = completedSteps.includes(step.id) || currentStep > step.id;
          const isClickable = isCompleted && onStepClick && !isCurrent;

          let badgeBg = '#E2E8F0';
          let badgeColor = '#64748B';
          let borderTopColor = '#E2E8F0';
          let titleColor = '#64748B';

          if (isCurrent) {
            badgeBg = '#0B2545';
            badgeColor = '#FFFFFF';
            borderTopColor = '#0B2545';
            titleColor = '#0B2545';
          } else if (isCompleted) {
            badgeBg = '#059669';
            badgeColor = '#FFFFFF';
            borderTopColor = '#059669';
            titleColor = '#059669';
          }

          return (
            <li
              key={step.id}
              style={{
                borderTop: `3px solid ${borderTopColor}`,
                paddingTop: 12,
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'border-color 0.2s ease',
              }}
              onClick={() => {
                if (isClickable && onStepClick) {
                  onStepClick(step.id);
                }
              }}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {isCompleted && !isCurrent ? '✓' : step.id}
                </span>
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: isCurrent ? 700 : 600,
                      color: titleColor,
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {step.title}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      color: '#64748B',
                      lineHeight: 1.2,
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {step.subtitle}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
