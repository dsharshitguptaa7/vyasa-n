import React from 'react';
import { LoadingState } from '../Feedback/LoadingState';
import { EmptyState } from '../Feedback/EmptyState';

export interface TableCardProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * TableCard: Standardized institutional container for tabular data ledgers.
 * Guarantees responsive horizontal scrolling, consistent surface borders,
 * built-in loading spinners, and dignified empty states without layout shifts.
 */
export const TableCard: React.FC<TableCardProps> = ({
  children,
  title,
  subtitle,
  headerActions,
  footer,
  loading = false,
  loadingMessage = 'Loading records...',
  isEmpty = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching the selected criteria.',
  emptyAction,
  className = '',
  style,
}) => {
  return (
    <div
      className={`vyasa-table-card ${className}`.trim()}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--vyasa-border, #e2e8f0)',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {/* Optional Table Card Header */}
      {(title || headerActions) && (
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--vyasa-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#ffffff',
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--vyasa-navy, #0f2b48)',
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--vyasa-text-secondary, #64748b)',
                  marginTop: '2px',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {headerActions && <div>{headerActions}</div>}
        </div>
      )}

      {/* Main Table Content Body with Horizontal Scroll */}
      <div
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          minHeight: loading || isEmpty ? '180px' : undefined,
        }}
      >
        {loading ? (
          <div
            style={{
              padding: '40px 20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <LoadingState variant="spinner" size="md" message={loadingMessage} />
          </div>
        ) : isEmpty ? (
          <div style={{ padding: '28px 20px' }}>
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
            />
          </div>
        ) : (
          children
        )}
      </div>

      {/* Optional Table Card Footer (Pagination / Summary) */}
      {footer && (
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--vyasa-border, #e2e8f0)',
            backgroundColor: '#fafbfc',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
