import React, { useEffect, useState, useMemo } from 'react';
import defaultVyasaLogo from '../../../../assets/branding/vyasa/vyasa-logo.png';
import './VedicInvocation.css';

export const RIG_VEDA_MANTRA = 'आ नो भद्राः क्रतवो यन्तु विश्वतः॥';
export const RIG_VEDA_SOURCE = 'Rig Veda 1.89.1';
export const INVOCATION_SESSION_KEY = 'vyasa_invocation_completed';

// Elegant upper-arc Sanskrit mantra with refined pushpika stars
export const MANTRA_ORBIT_TEXT = '✦   आ नो भद्राः क्रतवो यन्तु विश्वतः॥   ✦';

export const DEFAULT_LOADING_MESSAGES = [
  'ज्ञान के द्वार खोले जा रहे हैं...',
  'शोध संसाधन तैयार किए जा रहे हैं...',
  'AI इंजन प्रारंभ हो रहा है...',
  'आपका कार्यक्षेत्र तैयार हो रहा है...',
];

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

  /**
   * Contextual loading messages to cycle through smoothly.
   */
  messages?: string[];
}

/**
 * VYASA Signature Vedic Knowledge Mandala Loading Experience
 *
 * Implements a ceremonial, scholarly entry experience inspired by Rig Veda 1.89.1:
 * "आ नो भद्राः क्रतवो यन्तु विश्वतः॥" (May auspicious thoughts come to us from all directions).
 *
 * Architecture:
 * - Central Emblem: Official VYASA emblem with golden breathing illumination.
 * - Sacred Geometry Mandala: Concentric rings, 8-fold lotus petals, Ashtakona star yantra,
 *   subtle radial light rays, and orbiting golden particles.
 * - Upper Celestial Arc: Rig Veda 1.89.1 shloka in Devanagari with golden aura and celestial sway.
 * - Dynamic Intelligence: Contextual Hindi scholarly messages with neural indicator.
 * - Completion Convergence: Radiance burst, particle inward convergence, and smooth cinematic transition.
 */
export const VedicInvocation: React.FC<VedicInvocationProps> = ({
  isAppReady = true,
  onComplete,
  minDuration = 6800,
  failsafeDuration = 16000,
  logoSrc = defaultVyasaLogo,
  forceShow: _forceShow = false,
  messages = DEFAULT_LOADING_MESSAGES,
}) => {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [messageFading, setMessageFading] = useState(false);

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

  // 5. Dynamic contextual loading messages cycling smoothly without flicker
  useEffect(() => {
    if (isExiting || messages.length <= 1) return;

    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    const intervalId = setInterval(() => {
      setMessageFading(true);
      fadeTimer = setTimeout(() => {
        setActiveMessageIndex((prev) => (prev + 1) % messages.length);
        setMessageFading(false);
      }, 300);
    }, 2200);

    return () => {
      clearInterval(intervalId);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [isExiting, messages.length]);

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
      {/* Visual stage containing glow, intricate knowledge mandala, Sanskrit arc, and stationary logo */}
      <div
        className={`vyasa-invocation__stage ${isExiting ? 'vyasa-invocation__stage--exiting' : ''}`}
        aria-hidden="true"
      >
        {/* Subtle breathing radial golden illumination glow behind central emblem */}
        <div className="vyasa-invocation__glow" data-testid="vyasa-invocation-glow" />

        {/* Golden Radiance Bloom active during completion transition */}
        <div className="vyasa-mandala__radiance-burst" />

        {/* Intricate Sacred Geometry Knowledge Mandala & Sanskrit Arc Layer */}
        <div className="vyasa-invocation__orbit-wrap" data-testid="vyasa-invocation-orbit">
          <svg
            className="vyasa-invocation__orbit-svg vyasa-mandala-svg"
            viewBox="0 0 360 360"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              {/* Upper circular arc centered at (180, 180) with radius 136, sweeping across crown */}
              <path
                id="vyasaMantraOrbitPath"
                d="M 62, 248 A 136, 136 0 1, 1 298, 248"
                fill="none"
              />

              {/* Sacred geometry outer lotus petal */}
              <path
                id="vyasaPetal"
                d="M 180, 68 C 190, 84 190, 102 180, 116 C 170, 102 170, 84 180, 68 Z"
              />

              {/* Sacred geometry inner petal accent */}
              <path
                id="vyasaInnerPetal"
                d="M 180, 78 C 186, 88 186, 102 180, 112 C 174, 102 174, 88 180, 78 Z"
              />

              {/* Gradients */}
              <linearGradient id="vyasaRayGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#d4a017" stopOpacity="0" />
                <stop offset="60%" stopColor="#ecdfba" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#d4a017" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="vyasaProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#b2811a" stopOpacity="0.25" />
                <stop offset="50%" stopColor="#d4a017" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#fff2c6" stopOpacity="1" />
              </linearGradient>

              {/* Filters */}
              <filter id="vyasaTextGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="vyasaParticleGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Delicate Radial Light Rays */}
            <g className="vyasa-mandala__rays-group">
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                <line
                  key={`ray-${deg}`}
                  x1="180"
                  y1="48"
                  x2="180"
                  y2="114"
                  stroke="url(#vyasaRayGrad)"
                  strokeWidth="1"
                  strokeLinecap="round"
                  transform={`rotate(${deg} 180 180)`}
                />
              ))}
            </g>

            {/* 2. Outer Perimeter & Sacred Kalachakra Time Markers */}
            <g className="vyasa-mandala__perimeter-group">
              <circle
                cx="180"
                cy="180"
                r="162"
                fill="none"
                className="vyasa-mandala__perimeter-ring"
              />
              {Array.from({ length: 24 }).map((_, i) => (
                <line
                  key={`tick-${i}`}
                  x1="180"
                  y1="160"
                  x2="180"
                  y2="164"
                  stroke="rgba(212, 160, 23, 0.28)"
                  strokeWidth="0.8"
                  transform={`rotate(${i * 15} 180 180)`}
                />
              ))}
              {[0, 90, 180, 270].map((deg) => (
                <circle
                  key={`cardinal-${deg}`}
                  cx="180"
                  cy="162"
                  r="1.5"
                  fill="#f7d88c"
                  opacity="0.65"
                  transform={`rotate(${deg} 180 180)`}
                />
              ))}
            </g>

            {/* 3. Gradually Illuminating Circular Progress Ring */}
            <g className="vyasa-mandala__progress-group">
              <circle
                cx="180"
                cy="180"
                r="152"
                fill="none"
                className="vyasa-mandala__progress-track"
              />
              <circle
                cx="180"
                cy="180"
                r="146"
                fill="none"
                className="vyasa-mandala__progress-inner-guide"
              />
              <circle
                cx="180"
                cy="180"
                r="152"
                fill="none"
                stroke="url(#vyasaProgressGrad)"
                strokeWidth="1.75"
                strokeLinecap="round"
                className="vyasa-mandala__progress-arc"
              />
            </g>

            {/* 4. Concentric Academic Halo Rings */}
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

            {/* 5. Interlocking Ashtakona Sacred Star of Wisdom (Clockwise Rotation) */}
            <g className="vyasa-mandala__star-group">
              <polygon
                points="180,84 276,180 180,276 84,180"
                fill="none"
                className="vyasa-mandala__star-poly"
              />
              <polygon
                points="248,112 248,248 112,248 112,112"
                fill="none"
                className="vyasa-mandala__star-poly"
              />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <circle
                  key={`star-bindu-${deg}`}
                  cx="180"
                  cy="84"
                  r="1.5"
                  fill="#f7d88c"
                  className="vyasa-mandala__star-bindu"
                  transform={`rotate(${deg} 180 180)`}
                />
              ))}
            </g>

            {/* 6. Sacred 8-Fold Lotus Petals Layer (Alternating Counter-Clockwise Rotation) */}
            <g className="vyasa-mandala__petals-group">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <g key={`petal-pair-${deg}`} transform={`rotate(${deg} 180 180)`}>
                  <use
                    href="#vyasaPetal"
                    xlinkHref="#vyasaPetal"
                    className="vyasa-mandala__petal"
                  />
                  <use
                    href="#vyasaInnerPetal"
                    xlinkHref="#vyasaInnerPetal"
                    className="vyasa-mandala__inner-petal"
                  />
                </g>
              ))}
            </g>

            {/* 7. Inner Core Sacred Geometry Ring & Bindus */}
            <g className="vyasa-mandala__core-ring-group">
              <circle
                cx="180"
                cy="180"
                r="58"
                fill="none"
                className="vyasa-mandala__core-ring"
              />
              <circle
                cx="180"
                cy="180"
                r="52"
                fill="none"
                className="vyasa-mandala__core-ring-inner"
              />
              {[0, 90, 180, 270].map((deg) => (
                <circle
                  key={`core-node-${deg}`}
                  cx="180"
                  cy="58"
                  r="1.25"
                  fill="#f7d88c"
                  opacity="0.8"
                  transform={`rotate(${deg} 180 180)`}
                />
              ))}
            </g>

            {/* 8. Orbiting Golden Particles (Converge Inward on Completion) */}
            <g className="vyasa-mandala__particles-group">
              {/* Inner orbit A */}
              <g className="vyasa-mandala__orbit-a">
                <circle
                  cx="180"
                  cy="114"
                  r="2.2"
                  fill="#fff5d0"
                  filter="url(#vyasaParticleGlow)"
                  className="vyasa-mandala__particle"
                />
              </g>
              {/* Mid orbit B (Twin balanced particles) */}
              <g className="vyasa-mandala__orbit-b">
                <circle
                  cx="180"
                  cy="78"
                  r="2"
                  fill="#f7d88c"
                  filter="url(#vyasaParticleGlow)"
                  className="vyasa-mandala__particle"
                />
                <circle
                  cx="180"
                  cy="282"
                  r="1.8"
                  fill="#d4a017"
                  filter="url(#vyasaParticleGlow)"
                  className="vyasa-mandala__particle"
                />
              </g>
              {/* Outer orbit C */}
              <g className="vyasa-mandala__orbit-c">
                <circle
                  cx="180"
                  cy="28"
                  r="2.4"
                  fill="#ffffff"
                  filter="url(#vyasaParticleGlow)"
                  className="vyasa-mandala__particle"
                />
              </g>
            </g>

            {/* 9. Sanskrit Rig Veda Mantra on Upper Arc with Celestial Sway */}
            <g className="vyasa-invocation__orbit-rotator">
              <text className="vyasa-invocation__orbit-text" textAnchor="middle" filter="url(#vyasaTextGlow)">
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

        {/* Official Centered VYASA Logo (Stationary, Non-distorted, Golden Illumination) */}
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

      {/* Loading Intelligence: Smooth Dynamic Contextual Status */}
      <div className="vyasa-invocation__intelligence" aria-live="polite">
        <div className="vyasa-invocation__intel-chip" data-testid="vyasa-invocation-intel">
          <span className="vyasa-invocation__intel-node" aria-hidden="true" />
          <span
            className={`vyasa-invocation__intel-text ${messageFading ? 'vyasa-invocation__intel-text--fading' : ''}`}
          >
            {messages[activeMessageIndex]}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VedicInvocation;
