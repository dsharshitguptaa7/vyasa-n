import { Component, ErrorInfo, ReactNode } from 'react';
import { AppIcon } from '@vyasa/ui';

export interface SamikshaErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  fallback?: ReactNode;
  isolate?: boolean;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SamikshaErrorBoundary extends Component<SamikshaErrorBoundaryProps, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[SAMIKSHA ErrorBoundary] Caught component rendering failure:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isCompact = this.props.isolate ?? false;
      const sectionTitle = this.props.title || 'Research Portal Section';

      return (
        <div
          role="alert"
          aria-live="polite"
          className="samiksha-error-boundary-card"
          style={{
            backgroundColor: '#fffdf5',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: isCompact ? '16px 20px' : '28px 32px',
            margin: isCompact ? '10px 0' : '20px 0',
            boxShadow: '0 4px 16px rgba(180, 83, 9, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(217, 119, 6, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}
            >
              <AppIcon name="alert-circle" size={18} color="#b45309" />
            </div>

            <div style={{ flex: 1 }}>
              <h3
                style={{
                  margin: '0 0 4px 0',
                  fontSize: isCompact ? '14px' : '16px',
                  fontWeight: 700,
                  color: '#92400e',
                  lineHeight: 1.3,
                }}
              >
                {sectionTitle} Temporarily Unavailable
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#78350f',
                  lineHeight: 1.55,
                }}
              >
                An unexpected display issue occurred in this section. The rest of the SAMIKSHA research portal remains fully operational.
              </p>

              {this.state.error?.message && (
                <details
                  style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#92400e',
                    cursor: 'pointer',
                  }}
                >
                  <summary style={{ fontWeight: 600, outline: 'none' }}>Technical error details</summary>
                  <pre
                    style={{
                      margin: '6px 0 0 0',
                      padding: '8px 12px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: '#78350f',
                    }}
                  >
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                backgroundColor: '#b45309',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.15s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Retry Component</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
