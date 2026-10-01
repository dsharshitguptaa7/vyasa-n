import React, { useEffect, useState, useMemo } from 'react';
import defaultVyasaLogo from '../../../../assets/branding/vyasa/vyasa-logo.png';
import './VedicInvocation.css';

export const RIG_VEDA_MANTRA = 'आ नो भद्राः क्रतवो यन्तु विश्वतः॥';
export const RIG_VEDA_SOURCE = 'Rig Veda 1.89.1';
export const INVOCATION_SESSION_KEY = 'vyasa_invocation_completed';

// Elegant upper-arc Sanskrit mantra with refined pushpika stars
export const MANTRA_ORBIT_TEXT = '✦   आ नो भद्राः क्रतवो यन्तु विश्वतः॥   ✦';

export function hasInvocationCompleted(): boolean {
  try {
    return sessionStorage.getItem(INVOCATION_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setInvocationCompleted(): void {
  try {
    sessionStorage.setItem(INVOCATION_SESSION_KEY, 'true');
  } catch {
    // ignore
  }
}

export const markInvocationRunThisSession = setInvocationCompleted;

export function resetInvocationSession(): void {
  try {
    sessionStorage.removeItem(INVOCATION_SESSION_KEY);
  } catch {
    // ignore
  }
}

export interface VedicInvocationProps {
  /**
   * Whether application initialization (auth, routes, user profile) has completed.
   * If true, invocation transitions out once min sequence has completed.
   * If false, invocation holds smoothly in continuous orbit until ready.
   */
  isAppReady?: boolean;

  /**
   * Callback fired once invocation has faded out and is dismissed from the DOM.
   */
  onComplete?: () => void;

  /**
   * Minimum duration in milliseconds to present the Vedic sequence.
   * Target: 6–8 seconds so user can read and experience the Sanskrit mantra.
   * Default: 6800ms (reduced to 2400ms if prefers-reduced-motion is detected).
   */
  minDuration?: number;

  /**
   * Failsafe duration to prevent trapping users on slow/offline connections.
   * Default: 16000ms.
   */
  failsafeDuration?: number;

  /**
   * Optional custom logo src (defaults to the official centralized VYASA logo).
   */
  logoSrc?: string;

  /**
   * Force displaying even if session storage has recorded completion (useful in tests).
   */
  forceShow?: boolean;
}

/**
 * VYASA Signature Vedic Knowledge Invocation Loading Experience
 *
 * Implements a ceremonial, scholarly entry experience inspired by Rig Veda 1.89.1:
 * "आ नो भद्राः क्रतवो यन्तु विश्वतः॥" (May auspicious thoughts come to us from all directions).
 *
 * Sequence Architecture:
 * - 0.0–1.0s: VYASA logo appears at center (stationary).
 * - 1.0–2.0s: Sanskrit mantra gradually appears around the logo.
 * - 2.0–5.5s: Composition holds for user to read and experience the mantra.
 *             Subtle, slow orbit rotation (32s / rev) ensures words remain fully readable.
 * - 5.5–6.5s: VYASA wordmark and Hindi brand tagline become prominent.
 * - 6.5–7.5s: Smooth transition into the application:
 *             transition_time = MAX(application_ready_time, invocation_minimum_duration)
 */
export const VedicInvocation: React.FC<VedicInvocationProps> = ({
  isAppReady = true,
  onComplete,
  minDuration = 6800,
  failsafeDuration = 16000,
  logoSrc = defaultVyasaLogo,
  forceShow: _forceShow = false,
}) => {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check reduced motion preference
  const isReducedMotion = useMemo(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, []);

  const effectiveMinDuration = isReducedMotion ? Math.min(minDuration, 2400) : minDuration;

  // 1. Minimum duration timer to allow graceful sequence appreciation (READ -> EXPERIENCE -> TRANSITION)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, effectiveMinDuration);

    return () => clearTimeout(timer);
  }, [effectiveMinDuration]);

  // 2. Failsafe timer: ensure user is never trapped even if network/auth fails
  useEffect(() => {
    const failsafe = setTimeout(() => {
      setIsExiting(true);
    }, failsafeDuration);

    return () => clearTimeout(failsafe);
  }, [failsafeDuration]);

  // 3. Trigger exit once BOTH minimum sequence has elapsed AND underlying app is ready
  // transition_time = MAX(application_ready_time, invocation_minimum_duration)
  useEffect(() => {
    if (minTimeElapsed && isAppReady && !isExiting) {
      setIsExiting(true);
    }
  }, [minTimeElapsed, isAppReady, isExiting]);

  // 4. After exit fade transition completes (750ms), dismiss from DOM
  useEffect(() => {
    if (isExiting) {
      const exitTimer = setTimeout(() => {
        setIsDismissed(true);
        setInvocationCompleted();
        onComplete?.();
      }, 750);

      return () => clearTimeout(exitTimer);
    }
  }, [isExiting, onComplete]);

  // If already dismissed, do not render into the DOM
  if (isDismissed) {
    return null;
  }

  return (
    <div
      className={`vyasa-invocation-container ${isExiting ? 'vyasa-invocation-container--exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="VYASA Knowledge Ecosystem"
      data-testid="vyasa-vedic-invocation"
    >
      {/* Visual stage containing glow, halo rings, upright arc mantra, and stationary logo */}
      <div className="vyasa-invocation__stage" aria-hidden="true">
        {/* Subtle breathing radial glow */}
        <div className="vyasa-invocation__glow" data-testid="vyasa-invocation-glow" />

        {/* Circular Sanskrit Rig Vedic Halo Layer (100% Upright & Readable) */}
        <div className="vyasa-invocation__orbit-wrap" data-testid="vyasa-invocation-orbit">
          <svg
            className="vyasa-invocation__orbit-svg"
            viewBox="0 0 360 360"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              {/* Upper circular arc centered at (180, 180) with radius 136, sweeping across the crown */}
              <path
                id="vyasaMantraOrbitPath"
                d="M 62, 248 A 136, 136 0 1, 1 298, 248"
                fill="none"
              />
            </defs>

            {/* Subtle concentric academic halo rings */}
            <circle
              cx="180"
              cy="180"
              r="136"
              fill="none"
              className="vyasa-invocation__halo-ring"
            />
            <circle
              cx="180"
              cy="180"
              r="128"
              fill="none"
              className="vyasa-invocation__halo-ring-inner"
            />

            {/* Sanskrit mantra on upper arc with gentle celestial sway */}
            <g className="vyasa-invocation__orbit-rotator">
              <text className="vyasa-invocation__orbit-text" textAnchor="middle">
                <textPath
                  href="#vyasaMantraOrbitPath"
                  xlinkHref="#vyasaMantraOrbitPath"
                  startOffset="50%"
                >
                  {MANTRA_ORBIT_TEXT}
                </textPath>
              </text>
            </g>
          </svg>
        </div>

        {/* Official Centered VYASA Logo (Stationary: does NOT rotate) */}
        <div className="vyasa-invocation__logo-wrap" data-testid="vyasa-invocation-logo">
          <img
            src={logoSrc}
            alt="VYASA"
            className="vyasa-invocation__logo"
          />
        </div>
      </div>

      {/* Brand Wordmark & Hindi Tagline */}
      <div className="vyasa-invocation__brand" aria-hidden="true">
        <h1 className="vyasa-invocation__wordmark">VYASA</h1>
        <div className="vyasa-invocation__tagline vyasa-devanagari" lang="hi">
          ज्ञान से शोध तक, AI के साथ
        </div>
        <div className="vyasa-invocation__heartbeat" />
      </div>
    </div>
  );
};

export default VedicInvocation;
