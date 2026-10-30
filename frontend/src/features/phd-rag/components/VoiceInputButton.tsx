import React, { useState, useEffect, useRef } from 'react';

export interface VoiceInputButtonProps {
  onTranscriptChange?: (text: string) => void;
  onTranscript?: (text: string) => void;
  currentText?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Cleanly combines pre-existing input text with voice transcript without duplications.
 */
export function combineBaseAndVoiceText(baseText: string, voiceText: string): string {
  const cleanVoice = voiceText.trim();
  if (!cleanVoice) return baseText;
  if (!baseText.trim()) return cleanVoice;

  // If baseText ends with whitespace, append directly; otherwise add a space
  if (/\s$/.test(baseText)) {
    return `${baseText}${cleanVoice}`;
  }
  return `${baseText} ${cleanVoice}`;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscriptChange,
  onTranscript,
  currentText = '',
  disabled = false,
  className = '',
  style,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Maps to separate finalized segments from active interim segments by result index
  const finalizedMapRef = useRef<Map<number, string>>(new Map());
  const interimMapRef = useRef<Map<number, string>>(new Map());
  const baseTextRef = useRef<string>('');

  // Check speech recognition support
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
  const isSupported = Boolean(SpeechRecognitionClass);

  // Clean up recognition instance on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Stop recognition if parent disables controls (e.g., submission in progress)
  useEffect(() => {
    if (disabled && isListening) {
      stopListening();
    }
  }, [disabled, isListening]);

  const dispatchUpdatedText = (fullText: string) => {
    if (onTranscriptChange) {
      onTranscriptChange(fullText);
    } else if (onTranscript) {
      onTranscript(fullText);
    }
  };

  const startListening = () => {
    if (!isSupported || disabled) return;

    // Prevent overlapping sessions: abort any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    setErrorMessage(null);

    // Initialize state for the new recognition session
    finalizedMapRef.current.clear();
    interimMapRef.current.clear();
    baseTextRef.current = currentText;

    try {
      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Academic default with automatic fallback

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        if (!event || !event.results) return;

        const results = event.results;
        const resultIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0;

        for (let i = 0; i < results.length; i++) {
          const res = results[i];
          if (!res || !res[0]) continue;

          const transcript = res[0].transcript || '';
          // Resolve item index for cumulative vs segmented result lists
          const itemIndex = results.length > resultIndex ? i : (resultIndex + i);

          if (res.isFinal === true) {
            finalizedMapRef.current.set(itemIndex, transcript.trim());
            interimMapRef.current.delete(itemIndex);
          } else if (res.isFinal === false) {
            interimMapRef.current.set(itemIndex, transcript.trim());
          } else {
            // If isFinal is omitted or undefined (e.g. in test mock events), treat as finalized
            finalizedMapRef.current.set(itemIndex, transcript.trim());
            interimMapRef.current.delete(itemIndex);
          }
        }

        // Build the current session's voice text from ordered final + interim parts
        const sortedFinalKeys = Array.from(finalizedMapRef.current.keys()).sort((a, b) => a - b);
        const finalParts = sortedFinalKeys.map((k) => finalizedMapRef.current.get(k)).filter(Boolean);

        const sortedInterimKeys = Array.from(interimMapRef.current.keys()).sort((a, b) => a - b);
        const interimParts = sortedInterimKeys.map((k) => interimMapRef.current.get(k)).filter(Boolean);

        const sessionVoiceText = [...finalParts, ...interimParts].join(' ').trim();
        const fullText = combineBaseAndVoiceText(baseTextRef.current, sessionVoiceText);

        dispatchUpdatedText(fullText);
      };

      recognition.onerror = (event: any) => {
        const errCode = event?.error;
        if (errCode === 'aborted') {
          setIsListening(false);
          recognitionRef.current = null;
          return;
        }

        let msg = 'Voice recognition error';
        if (errCode === 'not-allowed' || errCode === 'permission-denied') {
          msg = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
        } else if (errCode === 'no-speech') {
          msg = 'No speech detected. Please try speaking again.';
        } else if (errCode === 'audio-capture') {
          msg = 'No microphone was found or microphone is busy.';
        } else if (errCode === 'network') {
          msg = 'Voice network communication failed.';
        }
        setErrorMessage(msg);
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;

        // Commit any remaining unfinalized interim text
        if (interimMapRef.current.size > 0) {
          interimMapRef.current.forEach((val, key) => {
            finalizedMapRef.current.set(key, val);
          });
          interimMapRef.current.clear();

          const sortedFinalKeys = Array.from(finalizedMapRef.current.keys()).sort((a, b) => a - b);
          const finalParts = sortedFinalKeys.map((k) => finalizedMapRef.current.get(k)).filter(Boolean);
          const sessionVoiceText = finalParts.join(' ').trim();
          const fullText = combineBaseAndVoiceText(baseTextRef.current, sessionVoiceText);

          dispatchUpdatedText(fullText);
        }
      };

      recognition.start();
    } catch (err: unknown) {
      console.warn('SpeechRecognition failed to start:', err);
      setErrorMessage('Could not activate voice input. Please try again.');
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
    setIsListening(false);
  };

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        aria-label="Voice input not supported in this browser"
        title="Voice input is not supported in this browser. Use Chrome, Edge, or Safari for voice input."
        className={`vyasa-voice-button vyasa-voice-button--unsupported ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '42px',
          height: '42px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          color: '#94a3b8',
          cursor: 'not-allowed',
          opacity: 0.6,
          ...style,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label={isListening ? 'Stop voice input' : 'Voice input: Speak your question'}
        aria-pressed={isListening}
        title={isListening ? 'Listening... Click to finish' : 'Click to speak your question'}
        className={`vyasa-voice-button ${isListening ? 'vyasa-voice-button--active' : ''} ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '42px',
          height: '42px',
          borderRadius: '8px',
          border: isListening ? '1px solid #dc2626' : '1px solid #cbd5e1',
          backgroundColor: isListening ? '#fef2f2' : '#ffffff',
          color: isListening ? '#dc2626' : '#475569',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.18s ease',
          boxShadow: isListening ? '0 0 0 3px rgba(220, 38, 38, 0.2)' : 'none',
          ...style,
        }}
      >
        {isListening ? (
          <span
            style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              backgroundColor: '#dc2626',
              borderRadius: '2px',
            }}
          />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {/* Accessible Live Region & Notification for Voice Status */}
      {isListening && (
        <span
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            bottom: '-24px',
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            fontSize: '0.72rem',
            color: '#dc2626',
            fontWeight: 600,
          }}
        >
          Listening...
        </span>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            top: '-38px',
            right: '0',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            zIndex: 10,
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          {errorMessage}
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{
              marginLeft: '6px',
              background: 'none',
              border: 'none',
              color: '#991b1b',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
