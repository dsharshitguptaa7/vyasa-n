import React, { useEffect, useState, useRef } from 'react';
import { visitorService } from '../../../services/visitorService';
import { VisitorStats } from '../../../types/api';
import './InstitutionalReachSection.css';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, duration = 900 }) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const targetRef = useRef<number>(value);

  useEffect(() => {
    targetRef.current = value;
    if (value <= 0) {
      setDisplayValue(0);
      return;
    }

    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      // Subtle ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(easeOut * targetRef.current);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetRef.current);
      }
    };

    startTimeRef.current = null;
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  return <span>{displayValue.toLocaleString('en-IN')}</span>;
};

export const InstitutionalReachSection: React.FC = () => {
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      try {
        setIsLoading(true);
        setIsError(false);
        const data = await visitorService.getOrTrackVisitor();
        if (isMounted) {
          setStats(data);
        }
      } catch {
        if (isMounted) {
          setIsError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div
      id="institutional-reach"
      role="region"
      aria-label="VYASA Institutional Reach"
      className="vyasa-institutional-reach"
    >
      <div className="vyasa-institutional-reach__inner">
        {/* Section Header */}
        <div className="vyasa-institutional-reach__header">
          <div className="vyasa-reach-eyebrow">
            <span className="vyasa-reach-eyebrow__pulse" aria-hidden="true" />
            <span>University Engagement & Reach</span>
          </div>

          <h2 className="vyasa-reach-title">VYASAᴺ — Institutional Reach</h2>

          <p className="vyasa-reach-subtitle">
            Cumulative and active institutional engagement across the central Chhatrapati Shahu Ji Maharaj University research ecosystem.
          </p>
        </div>

        {/* Counter Cards Grid */}
        <div className="vyasa-reach-grid">
          {/* Card 1: Total Visitors */}
          <div className="vyasa-reach-card vyasa-reach-card--total" data-testid="reach-card-total">
            <div className="vyasa-reach-card__top">
              <div className="vyasa-reach-card__icon-badge vyasa-reach-card__icon-badge--gold">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span className="vyasa-reach-card__badge vyasa-reach-card__badge--gold">
                Verified Lifetime Reach
              </span>
            </div>

            <div className="vyasa-reach-card__stat-wrapper">
              {isLoading ? (
                <div className="vyasa-reach-card__skeleton-value" aria-label="Loading total visitors" />
              ) : isError || !stats ? (
                <span className="vyasa-reach-card__value vyasa-reach-card__value--fallback">—</span>
              ) : (
                <span className="vyasa-reach-card__value" data-testid="total-visitors-count">
                  <AnimatedCounter value={stats.total_visitors} />
                </span>
              )}
              <h3 className="vyasa-reach-card__label">Total Visitors</h3>
            </div>

            <p className="vyasa-reach-card__desc">
              Cumulative unique scholars, faculty, and institutional visitors recorded on the main VYASAⁿ website.
            </p>
          </div>

          {/* Card 2: Today's Visitors */}
          <div className="vyasa-reach-card vyasa-reach-card--today" data-testid="reach-card-today">
            <div className="vyasa-reach-card__top">
              <div className="vyasa-reach-card__icon-badge vyasa-reach-card__icon-badge--teal">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span className="vyasa-reach-card__badge vyasa-reach-card__badge--teal">
                Current Calendar Day (IST)
              </span>
            </div>

            <div className="vyasa-reach-card__stat-wrapper">
              {isLoading ? (
                <div className="vyasa-reach-card__skeleton-value" aria-label="Loading today's visitors" />
              ) : isError || !stats ? (
                <span className="vyasa-reach-card__value vyasa-reach-card__value--fallback">—</span>
              ) : (
                <span className="vyasa-reach-card__value" data-testid="today-visitors-count">
                  <AnimatedCounter value={stats.today_visitors} />
                </span>
              )}
              <h3 className="vyasa-reach-card__label">Today's Visitors</h3>
            </div>

            <p className="vyasa-reach-card__desc">
              Unique visitors recorded during the current calendar day, logically reset at midnight IST (Asia/Kolkata).
            </p>
          </div>
        </div>

        {/* Institutional Assurance & Footnote */}
        <div className="vyasa-reach-footer">
          <div className="vyasa-reach-footer__item">
            <span className="vyasa-reach-footer__dot" aria-hidden="true" />
            <span>Timezone: <strong>Asia/Kolkata (IST / UTC+05:30)</strong></span>
          </div>
          <span className="vyasa-reach-footer__sep" aria-hidden="true">•</span>
          <div className="vyasa-reach-footer__item">
            <span>First-Party Anonymous Ledger</span>
          </div>
          <span className="vyasa-reach-footer__sep" aria-hidden="true">•</span>
          <div className="vyasa-reach-footer__item">
            <span>Zero Third-Party Trackers or Fingerprinting</span>
          </div>
        </div>
      </div>
    </div>
  );
};
