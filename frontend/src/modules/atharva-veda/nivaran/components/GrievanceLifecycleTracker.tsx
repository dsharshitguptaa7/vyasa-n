import React, { useState } from 'react';
import { Badge, AppIcon, IconName, formatStatusLabel } from '@vyasa/ui';
import './GrievanceLifecycleTracker.css';

export interface GrievanceStatusHistoryEntry {
  id?: string;
  from_status?: string;
  to_status: string;
  actor_type: string;
  remarks?: string;
  created_at: string;
}

export interface GrievanceLifecycleTrackerProps {
  currentStatus: string;
  history: GrievanceStatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  grievanceId?: string;
}

interface StageDefinition {
  id: number;
  key: string;
  title: string;
  subtitle: string;
  icon: IconName;
}

const STAGES: StageDefinition[] = [
  {
    id: 1,
    key: 'SUBMITTED',
    title: 'Grievance Filed',
    subtitle: 'Intake Registered',
    icon: 'file-text',
  },
  {
    id: 2,
    key: 'PENDING_REVIEW',
    title: 'AI & Triage',
    subtitle: 'Category Scrutiny',
    icon: 'settings',
  },
  {
    id: 3,
    key: 'INVESTIGATION',
    title: 'Investigation',
    subtitle: 'Authority Review',
    icon: 'layers',
  },
  {
    id: 4,
    key: 'DELIBERATION',
    title: 'Deliberation',
    subtitle: 'Hearing & Findings',
    icon: 'shield',
  },
  {
    id: 5,
    key: 'RESOLVED',
    title: 'Resolution',
    subtitle: 'Redressed & Sealed',
    icon: 'check-circle',
  },
];

const getStageNumberForStatus = (status: string): number => {
  switch (status?.toUpperCase()) {
    case 'CLOSED':
      return 5;
    case 'RESOLVED':
      return 5;
    case 'ESCALATED':
    case 'REOPENED':
      return 4;
    case 'ASSIGNED':
    case 'IN_PROGRESS':
    case 'UNDER_INVESTIGATION':
    case 'AWAITING_INFORMATION':
      return 3;
    case 'AI_PROCESSING':
    case 'PENDING_REVIEW':
      return 2;
    case 'SUBMITTED':
    default:
      return 1;
  }
};

const getStatusExplanation = (status: string): { title: string; description: string } => {
  switch (status?.toUpperCase()) {
    case 'SUBMITTED':
      return {
        title: 'Case Successfully Registered',
        description: 'Your formal grievance has been accepted into the university evidentiary registry. Initial automated triage is queued.',
      };
    case 'AI_PROCESSING':
      return {
        title: 'AI Forensic & Category Analysis',
        description: 'Automated natural language processing is evaluating grievance parameters, assessing urgency, and suggesting subject routing.',
      };
    case 'PENDING_REVIEW':
      return {
        title: 'Pending Grievance Cell Review',
        description: 'Case is under initial triage by the Grievance Cell Manager to confirm classification and allocate the designated authority.',
      };
    case 'ASSIGNED':
      return {
        title: 'Assigned to Competent Authority',
        description: 'The grievance has been officially transferred to the designated Academic or Administrative Authority for active investigation.',
      };
    case 'IN_PROGRESS':
    case 'UNDER_INVESTIGATION':
      return {
        title: 'Active Investigation in Progress',
        description: 'The assigned officer is actively examining evidence, coordinating department fact-finding, and reviewing submissions.',
      };
    case 'AWAITING_INFORMATION':
      return {
        title: 'Additional Documentation Requested',
        description: 'The reviewing authority has requested supplementary documents or testimony to proceed with case resolution.',
      };
    case 'ESCALATED':
      return {
        title: 'Case Escalated for Higher Review',
        description: 'This matter has been escalated to executive academic leadership or dean level for priority intervention.',
      };
    case 'RESOLVED':
      return {
        title: 'Formal Resolution Formulated',
        description: 'The grievance review committee has arrived at a final determination and remedial action is recorded.',
      };
    case 'CLOSED':
      return {
        title: 'Case Formally Closed & Sealed',
        description: 'All resolution actions are complete. An official sealed E-File dossier has been permanently archived.',
      };
    case 'REOPENED':
      return {
        title: 'Case Reopened for Supplementary Review',
        description: 'Supplementary evidence or contestation has been accepted, reopening the inquiry.',
      };
    default:
      return {
        title: 'Grievance in Processing',
        description: 'The grievance is currently advancing through the official institutional lifecycle.',
      };
  }
};

const getStatusIcon = (status: string, actorType: string): IconName => {
  const s = status?.toUpperCase() || '';
  if (s === 'CLOSED' || s === 'RESOLVED') return 'check-circle';
  if (s === 'ESCALATED') return 'shield';
  if (s === 'AWAITING_INFORMATION') return 'alert-circle';
  if (s === 'ASSIGNED') return 'user';
  if (s === 'IN_PROGRESS' || s === 'UNDER_INVESTIGATION') return 'layers';
  if (actorType?.toUpperCase() === 'SYSTEM' || s === 'AI_PROCESSING' || s === 'PENDING_REVIEW') return 'settings';
  return 'file-text';
};

const getBulletVariantClass = (status: string, actorType: string): string => {
  const s = status?.toUpperCase() || '';
  if (s === 'CLOSED' || s === 'RESOLVED') return 'nivaran-modern-bullet--resolved';
  if (s === 'ESCALATED') return 'nivaran-modern-bullet--escalated';
  if (s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'UNDER_INVESTIGATION') return 'nivaran-modern-bullet--assigned';
  if (s === 'PENDING_REVIEW') return 'nivaran-modern-bullet--review';
  if (actorType?.toUpperCase() === 'SYSTEM' || s === 'AI_PROCESSING') return 'nivaran-modern-bullet--ai';
  return 'nivaran-modern-bullet--submitted';
};

const getStatusPillClass = (status: string): string => {
  const s = status?.toUpperCase() || '';
  if (s === 'CLOSED' || s === 'RESOLVED') return 'nivaran-status-pill--emerald';
  if (s === 'ESCALATED') return 'nivaran-status-pill--rose';
  if (s === 'PENDING_REVIEW' || s === 'AI_PROCESSING' || s === 'AWAITING_INFORMATION') return 'nivaran-status-pill--gold';
  return 'nivaran-status-pill--target';
};

const getActorDisplay = (actorType: string): { label: string; icon: IconName; className: string } => {
  const a = actorType?.toUpperCase() || 'SYSTEM';
  if (a === 'USER') {
    return {
      label: 'Applicant',
      icon: 'user',
      className: 'nivaran-actor-pill--user',
    };
  }
  if (a === 'SYSTEM') {
    return {
      label: 'AI System Engine',
      icon: 'settings',
      className: 'nivaran-actor-pill--system',
    };
  }
  return {
    label: 'Case Officer',
    icon: 'shield',
    className: 'nivaran-actor-pill--authority',
  };
};

export const GrievanceLifecycleTracker: React.FC<GrievanceLifecycleTrackerProps> = ({
  currentStatus,
  history,
}) => {
  const [sortOrder, setSortOrder] = useState<'chronological' | 'reverse'>('chronological');

  const currentStageNumber = getStageNumberForStatus(currentStatus);
  const isCaseClosed = currentStatus?.toUpperCase() === 'CLOSED';
  const explanation = getStatusExplanation(currentStatus);

  // Sorting
  const sortedHistory = [...history].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sortOrder === 'chronological' ? timeA - timeB : timeB - timeA;
  });

  return (
    <div className="nivaran-tracker-card" aria-label="Grievance Lifecycle Tracking and Status History">
      {/* 1. Header Bar */}
      <div className="nivaran-tracker-header">
        <div className="nivaran-tracker-header__left">
          <div className="nivaran-tracker-header__icon-box" aria-hidden="true">
            <AppIcon name="clock" size={20} color="var(--vyasa-navy, #1b2a4a)" />
          </div>
          <div>
            <h3 className="nivaran-tracker-header__title">
              Status History{' '}
              <span className="sr-only">Lifecycle Status History (Immutable Audit Trail)</span>
            </h3>
            <p className="nivaran-tracker-header__subtitle">
              Chronological audit trail of updates and actions taken
            </p>
          </div>
        </div>

        <div className="nivaran-tracker-header__actions">
          {history.length > 0 && (
            <Badge variant="neutral" size="sm">
              {history.length} Event{history.length > 1 ? 's' : ''}
            </Badge>
          )}

          {history.length > 1 && (
            <button
              type="button"
              className="nivaran-tracker-sort-btn"
              onClick={() => setSortOrder((prev) => (prev === 'chronological' ? 'reverse' : 'chronological'))}
              title={`Switch to ${sortOrder === 'chronological' ? 'latest events first' : 'oldest first'}`}
            >
              <AppIcon name="layers" size={13} />
              <span>{sortOrder === 'chronological' ? 'Oldest First' : 'Latest First'}</span>
            </button>
          )}

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#059669',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '4px 10px',
              borderRadius: '20px',
            }}
          >
            <AppIcon name="shield" size={12} color="#059669" />
            <span>Immutable Trail</span>
          </div>
        </div>
      </div>

      {/* 2. Visual Stage Progress Tracker (Interactive Stepper) */}
      <div className="nivaran-stepper-container">
        <div className="nivaran-stepper-track" role="list" aria-label="Grievance Stage Stepper">
          {STAGES.map((stage, idx) => {
            const isCompleted = isCaseClosed || currentStageNumber > stage.id;
            const isCurrent = !isCaseClosed && currentStageNumber === stage.id;

            const hasNext = idx < STAGES.length - 1;
            const connectorCompleted = isCaseClosed || currentStageNumber > stage.id;
            const connectorActive = !isCaseClosed && currentStageNumber === stage.id;

            return (
              <div key={stage.id} className="nivaran-stepper-step" role="listitem">
                {hasNext && (
                  <div
                    className={`nivaran-stepper-connector ${
                      connectorCompleted
                        ? 'nivaran-stepper-connector--completed'
                        : connectorActive
                        ? 'nivaran-stepper-connector--active'
                        : ''
                    }`}
                  />
                )}

                <div
                  className={`nivaran-step-circle ${
                    isCompleted
                      ? 'nivaran-step-circle--completed'
                      : isCurrent
                      ? 'nivaran-step-circle--current'
                      : 'nivaran-step-circle--upcoming'
                  }`}
                  aria-label={`Stage ${stage.id}: ${stage.title} (${
                    isCompleted ? 'Completed' : isCurrent ? 'Active Now' : 'Upcoming'
                  })`}
                >
                  {isCompleted ? (
                    <AppIcon name="check" size={16} color="#ffffff" strokeWidth={3} />
                  ) : (
                    <AppIcon
                      name={stage.icon}
                      size={15}
                      color={isCurrent ? '#d4a017' : '#94a3b8'}
                    />
                  )}
                </div>

                <div className="nivaran-step-details">
                  <div
                    className={`nivaran-step-title ${
                      isCurrent
                        ? 'nivaran-step-title--active'
                        : isCompleted
                        ? 'nivaran-step-title--completed'
                        : ''
                    }`}
                  >
                    {stage.title}
                  </div>
                  <div className="nivaran-step-sub">{stage.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Active Status Highlights Banner */}
        <div className="nivaran-status-live-banner">
          <div className="nivaran-status-live-banner__left">
            <div className="nivaran-status-live-banner__icon" aria-hidden="true">
              <AppIcon name="info" size={16} />
            </div>
            <div className="nivaran-status-live-banner__text">
              <span className="nivaran-status-live-banner__status-name">{explanation.title}:</span>{' '}
              {explanation.description}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Current State:
            </span>
            <span className={`nivaran-status-pill ${getStatusPillClass(currentStatus)}`} data-status={currentStatus}>
              {formatStatusLabel(currentStatus)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Detailed Chronological Audit Trail (Timeline Ledger) */}
      <div className="nivaran-timeline-body">
        {history.length === 0 ? (
          <div className="nivaran-tracker-empty">
            <div className="nivaran-tracker-empty__icon" aria-hidden="true">
              <AppIcon name="clock" size={24} />
            </div>
            <p className="nivaran-tracker-empty__text">No status transitions recorded yet.</p>
          </div>
        ) : (
          <div className="nivaran-modern-timeline">
            {sortedHistory.map((h, idx) => {
              const actor = getActorDisplay(h.actor_type);
              const bulletClass = getBulletVariantClass(h.to_status, h.actor_type);
              const bulletIcon = getStatusIcon(h.to_status, h.actor_type);
              const isAiActor = h.actor_type?.toUpperCase() === 'SYSTEM';
              const isUserActor = h.actor_type?.toUpperCase() === 'USER';
              const eventNumber = sortOrder === 'chronological' ? idx + 1 : sortedHistory.length - idx;

              return (
                <div key={h.id || idx} className="nivaran-modern-timeline-row">
                  {/* Left Bullet Icon */}
                  <div
                    className={`nivaran-modern-bullet ${bulletClass}`}
                    aria-hidden="true"
                    title={`Event #${eventNumber}: ${h.to_status}`}
                  >
                    <AppIcon name={bulletIcon} size={18} />
                  </div>

                  {/* Right Event Card */}
                  <div className="nivaran-modern-event-card">
                    <div className="nivaran-modern-event-card__top">
                      {/* Transition Flow Pills */}
                      <div className="nivaran-transition-flow">
                        {h.from_status ? (
                          <>
                            <span className="nivaran-status-pill nivaran-status-pill--source">
                              {formatStatusLabel(h.from_status)}
                            </span>
                            <span className="nivaran-transition-arrow" aria-hidden="true">
                              <AppIcon name="arrow-right" size={13} />
                            </span>
                          </>
                        ) : null}
                        <span className={`nivaran-status-pill ${getStatusPillClass(h.to_status)}`} data-status={h.to_status}>
                          {formatStatusLabel(h.to_status)}
                        </span>

                        {/* Actor Tag with Icon */}
                        <span
                          className={`nivaran-actor-pill ${actor.className}`}
                          title={`Action performed by ${actor.label} (${h.actor_type})`}
                        >
                          <AppIcon name={actor.icon} size={12} />
                          <span>{actor.label}</span>
                          <span className="sr-only">({h.actor_type})</span>
                        </span>
                      </div>

                      {/* Timestamp */}
                      <span className="nivaran-event-timestamp">
                        <AppIcon name="clock" size={13} color="#94a3b8" />
                        <span>{new Date(h.created_at).toLocaleString()}</span>
                      </span>
                    </div>

                    {/* Remarks / Explanatory Note */}
                    {h.remarks && (
                      <div
                        className={`nivaran-event-remarks ${
                          isAiActor
                            ? 'nivaran-event-remarks--ai'
                            : isUserActor
                            ? 'nivaran-event-remarks--user'
                            : ''
                        }`}
                      >
                        {h.remarks}
                      </div>
                    )}

                    {/* Evidentiary Footer */}
                    <div className="nivaran-event-footer">
                      <span className="nivaran-event-footer__seq">
                        <AppIcon name="check-circle" size={11} color="#059669" />
                        Audit Entry #{eventNumber}
                      </span>
                      <span className="nivaran-event-footer__tag">
                        Evidentiary Immutability Enforced
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
