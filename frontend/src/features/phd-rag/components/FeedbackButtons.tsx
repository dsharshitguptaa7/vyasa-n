import React, { useState } from 'react';

export interface FeedbackButtonsProps {
  messageId: string;
  className?: string;
  style?: React.CSSProperties;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  messageId: _messageId,
  className = '',
  style,
}) => {
  const [feedback, setFeedback] = useState<'helpful' | 'unhelpful' | null>(null);

  return (
    <div
      className={`vyasa-feedback-buttons ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => setFeedback((prev) => (prev === 'helpful' ? null : 'helpful'))}
        aria-label="Mark answer as helpful"
        aria-pressed={feedback === 'helpful'}
        title="Helpful response"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          padding: '0',
          backgroundColor: feedback === 'helpful' ? '#f0fdf4' : '#ffffff',
          border: `1px solid ${feedback === 'helpful' ? '#86efac' : '#e2e8f0'}`,
          borderRadius: '6px',
          color: feedback === 'helpful' ? '#15803d' : '#94a3b8',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback === 'helpful' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => setFeedback((prev) => (prev === 'unhelpful' ? null : 'unhelpful'))}
        aria-label="Mark answer as not helpful"
        aria-pressed={feedback === 'unhelpful'}
        title="Not helpful response"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          padding: '0',
          backgroundColor: feedback === 'unhelpful' ? '#fef2f2' : '#ffffff',
          border: `1px solid ${feedback === 'unhelpful' ? '#fca5a5' : '#e2e8f0'}`,
          borderRadius: '6px',
          color: feedback === 'unhelpful' ? '#b91c1c' : '#94a3b8',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback === 'unhelpful' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
        </svg>
      </button>
    </div>
  );
};
