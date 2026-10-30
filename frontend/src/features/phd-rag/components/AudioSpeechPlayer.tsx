import React, { useState, useEffect, useRef } from 'react';

export type SpeechPlaybackState = 'idle' | 'speaking' | 'paused';

export interface AudioSpeechPlayerProps {
  textToRead: string;
  messageId: string;
  activePlayingId: string | null;
  onPlaybackStateChange: (messageId: string | null, state: SpeechPlaybackState) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sanitizes markdown content for clean, natural speech synthesis.
 */
export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/^#+\s+/gm, '') // Remove heading markers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
    .replace(/\*([^*]+)\*/g, '$1') // Italics
    .replace(/\[([^\]]+)\]/g, '') // Bracketed citations
    .replace(/^[\*\-]\s+/gm, '') // Bullet points
    .replace(/\s+/g, ' ')
    .trim();
}

export const AudioSpeechPlayer: React.FC<AudioSpeechPlayerProps> = ({
  textToRead,
  messageId,
  activePlayingId,
  onPlaybackStateChange,
  className = '',
  style,
}) => {
  const [playbackState, setPlaybackState] = useState<SpeechPlaybackState>('idle');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check if browser supports speech synthesis and SpeechSynthesisUtterance
  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(window.speechSynthesis) &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const isCurrentActive = activePlayingId === messageId;

  // Sync internal state if another player took over
  useEffect(() => {
    if (!isCurrentActive && playbackState !== 'idle') {
      setPlaybackState('idle');
    }
  }, [isCurrentActive, playbackState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (
        isSupported &&
        utteranceRef.current &&
        window.speechSynthesis &&
        typeof window.speechSynthesis.cancel === 'function'
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  if (!isSupported) {
    return null; // Graceful non-rendering when unsupported
  }

  const handlePlay = () => {
    if (!isSupported || !window.speechSynthesis) return;

    // If another playback is running, stop it
    if (typeof window.speechSynthesis.cancel === 'function') {
      window.speechSynthesis.cancel();
    }

    const clean = cleanTextForSpeech(textToRead);
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utteranceRef.current = utterance;

    // Preferred voice setup: smooth natural cadence
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setPlaybackState('speaking');
      onPlaybackStateChange(messageId, 'speaking');
    };

    utterance.onpause = () => {
      setPlaybackState('paused');
      onPlaybackStateChange(messageId, 'paused');
    };

    utterance.onresume = () => {
      setPlaybackState('speaking');
      onPlaybackStateChange(messageId, 'speaking');
    };

    utterance.onend = () => {
      setPlaybackState('idle');
      onPlaybackStateChange(null, 'idle');
    };

    utterance.onerror = (e) => {
      // 'interrupted' is fired when cancel() is intentionally called
      if (e.error !== 'interrupted') {
        console.warn('Speech synthesis error:', e.error);
      }
      setPlaybackState('idle');
      onPlaybackStateChange(null, 'idle');
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (!isSupported || !window.speechSynthesis) return;
    if (typeof window.speechSynthesis.pause === 'function') {
      window.speechSynthesis.pause();
    }
    setPlaybackState('paused');
    onPlaybackStateChange(messageId, 'paused');
  };

  const handleResume = () => {
    if (!isSupported || !window.speechSynthesis) return;
    if (typeof window.speechSynthesis.resume === 'function') {
      window.speechSynthesis.resume();
    }
    setPlaybackState('speaking');
    onPlaybackStateChange(messageId, 'speaking');
  };

  const handleStop = () => {
    if (!isSupported || !window.speechSynthesis) return;
    if (typeof window.speechSynthesis.cancel === 'function') {
      window.speechSynthesis.cancel();
    }
    setPlaybackState('idle');
    onPlaybackStateChange(null, 'idle');
  };

  return (
    <div
      className={`vyasa-speech-player ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        ...style,
      }}
    >
      {playbackState === 'idle' ? (
        <button
          type="button"
          onClick={handlePlay}
          aria-label="Listen to answer"
          title="Listen to this response"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 500,
            color: '#0d766e',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
          <span>Listen</span>
        </button>
      ) : (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#f0fdfa',
            border: '1px solid #99f6e4',
            borderRadius: '6px',
            padding: '2px 6px',
          }}
        >
          {playbackState === 'speaking' ? (
            <button
              type="button"
              onClick={handlePause}
              aria-label="Pause reading"
              title="Pause reading"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 6px',
                background: 'none',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#0d766e',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span>Pause</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResume}
              aria-label="Resume reading"
              title="Resume reading"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 6px',
                background: 'none',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#0d766e',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Resume</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleStop}
            aria-label="Stop reading"
            title="Stop reading"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 6px',
              background: 'none',
              border: 'none',
              fontSize: '0.78rem',
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
              <rect x="5" y="5" width="14" height="14" rx="1" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
