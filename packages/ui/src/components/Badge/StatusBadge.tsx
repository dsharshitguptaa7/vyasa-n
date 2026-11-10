import React from 'react';
import { Badge, BadgeProps } from './Badge';

export type StatusVariant = 'primary' | 'saffron' | 'gold' | 'teal' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface StatusConfig {
  label: string;
  variant: StatusVariant;
}

/**
 * Universal canonical mapping of all workflow and administrative status keys
 * across NIVARAN, ANUDAAN, SAMIKSHA, and Core Governance.
 */
export const STATUS_MAP: Record<string, StatusConfig> = {
  // --- NIVARAN (Atharva Veda) Workflow States ---
  SUBMITTED: { label: 'Submitted', variant: 'info' },
  PENDING_REVIEW: { label: 'Under Review', variant: 'warning' },
  AWAITING_INFORMATION: { label: 'Action Required', variant: 'warning' },
  AWAITING_INFO: { label: 'Action Required', variant: 'warning' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  UNDER_INVESTIGATION: { label: 'Under Investigation', variant: 'info' },
  ESCALATED: { label: 'Escalated', variant: 'saffron' },
  ESCALATED_DEAN: { label: 'Escalated to Dean', variant: 'saffron' },
  COMMITTEE_FORMED: { label: 'Committee Review', variant: 'primary' },
  COMMITTEE_HEARING: { label: 'Hearing Scheduled', variant: 'primary' },
  RESOLVED: { label: 'Resolved', variant: 'success' },
  CLOSED: { label: 'Closed', variant: 'neutral' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  DISMISSED: { label: 'Dismissed', variant: 'neutral' },
  RATIFIED: { label: 'Ratified', variant: 'teal' },
  OVERRIDDEN: { label: 'Category Overridden', variant: 'warning' },

  // --- ANUDAAN (Yajur Veda) Workflow States ---
  DRAFT: { label: 'Draft', variant: 'neutral' },
  UNDER_FACULTY_REVIEW: { label: 'Faculty Review', variant: 'warning' },
  UNDER_DEAN_REVIEW: { label: 'Dean Review', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  SANCTIONED: { label: 'Sanctioned', variant: 'success' },
  DISBURSED: { label: 'Disbursed', variant: 'teal' },
  REVISION_REQUESTED: { label: 'Revision Requested', variant: 'warning' },
  EXPIRED: { label: 'Expired', variant: 'neutral' },

  // --- SAMIKSHA (Sama Veda) & Institutional Statuses ---
  ACTIVE: { label: 'Active', variant: 'success' },
  INACTIVE: { label: 'Inactive', variant: 'neutral' },
  PUBLISHED: { label: 'Published', variant: 'teal' },
  PENDING: { label: 'Pending', variant: 'warning' },
  ARCHIVED: { label: 'Archived', variant: 'neutral' },
  PROVISIONAL: { label: 'Provisional', variant: 'warning' },
  VERIFIED: { label: 'Verified', variant: 'teal' },
  REVOKED: { label: 'Revoked', variant: 'danger' },

  // --- General System / Technical Execution Statuses ---
  SUCCESS: { label: 'Success', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
  ERROR: { label: 'Error', variant: 'danger' },
  PROCESSING: { label: 'Processing', variant: 'info' },
  QUEUED: { label: 'Queued', variant: 'neutral' },
  ONLINE: { label: 'Online', variant: 'success' },
  OFFLINE: { label: 'Offline', variant: 'neutral' },
  SEALED: { label: 'Digitally Sealed', variant: 'teal' },
};

/**
 * Converts any technical enum or snake_case key into a polished, human-readable label.
 * Guarantees never returning undefined, null, or [object Object].
 */
export function formatStatusLabel(rawStatus?: unknown): string {
  if (rawStatus === null || rawStatus === undefined) {
    return 'Unknown';
  }
  if (typeof rawStatus !== 'string' && typeof rawStatus !== 'number') {
    return 'Unknown';
  }

  const normalized = String(rawStatus).trim();
  if (!normalized) return 'Unknown';

  const upper = normalized.toUpperCase();
  if (STATUS_MAP[upper]) {
    return STATUS_MAP[upper].label;
  }

  // Fallback: Convert SNAKE_CASE or hyphenated string to Title Case
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Determines the visual variant for a status, defaulting to 'neutral' for unknown keys.
 */
export function getStatusVariant(rawStatus?: unknown): StatusVariant {
  if (rawStatus === null || rawStatus === undefined) {
    return 'neutral';
  }
  if (typeof rawStatus !== 'string' && typeof rawStatus !== 'number') {
    return 'neutral';
  }

  const upper = String(rawStatus).trim().toUpperCase();
  return STATUS_MAP[upper]?.variant || 'neutral';
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'children'> {
  status?: string | number | null;
  label?: string;
  variant?: StatusVariant;
  fallbackLabel?: string;
}

/**
 * StatusBadge: Institutional status badge that standardizes raw database
 * enums into respectful, user-facing English with semantic color coding.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  variant,
  fallbackLabel,
  size = 'md',
  className = '',
  ...rest
}) => {
  const displayLabel = label || (status ? formatStatusLabel(status) : fallbackLabel || 'Unknown');
  const displayVariant = variant || getStatusVariant(status);

  return (
    <Badge
      variant={displayVariant}
      size={size}
      className={`vyasa-status-badge ${className}`.trim()}
      {...rest}
    >
      {displayLabel}
    </Badge>
  );
};
