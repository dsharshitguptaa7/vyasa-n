import React, { useEffect, useRef } from 'react';
import { Button, AppIcon } from '@vyasa/ui';
import { VedaShloka } from '../../types/wisdom';
import defaultVyasaLogo from '../../../../assets/branding/vyasa/vyasa-logo.png';
import './VYASAWisdomModal.css';

export interface VYASAWisdomModalProps {
  shloka: VedaShloka;
  isOpen: boolean;
  onContinue: () => void;
  onSkip?: () => void;
}

/**
 * VYASA Wisdom Modal
 *
 * A reflective, scholarly knowledge moment presented after successful authentication,
 * before progressing to the user's destination.
 */
export const VYASAWisdomModal: React.FC<VYASAWisdomModalProps> = ({
  shloka,
  isOpen,
  onContinue,
  onSkip,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);

  const handleDismiss = onSkip || onContinue;

  // Keyboard navigation & accessibility focus trap
  useEffect(() => {
    if (!isOpen) return;

    // Focus primary continue button on mount
    const timer = setTimeout(() => {
      const continueBtn = modalRef.current?.querySelector<HTMLButtonElement>('[data-wisdom-continue="true"]');
      continueBtn?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      } else if (e.key === 'Enter') {
        // If target is not the skip/close button, trigger continue
        const activeElem = document.activeElement as HTMLElement | null;
        const activeTag = activeElem?.tagName.toLowerCase();
        const isSkipOrClose = activeElem?.getAttribute('aria-label')?.toLowerCase().includes('skip');
        if (!isSkipOrClose || activeTag !== 'button') {
          e.preventDefault();
          onContinue();
        }
      } else if (e.key === 'Tab') {
        // Simple focus trap within dialog
        if (!modalRef.current) return;
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleDismiss, onContinue]);

  if (!isOpen || !shloka) return null;

  return (
    <div
      className="vyasa-wisdom-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vyasa-wisdom-title"
      aria-describedby="vyasa-wisdom-sanskrit"
      onClick={(e) => {
        // Clicking backdrop closes/continues
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div className="vyasa-wisdom-dialog" ref={modalRef}>
        {/* Header */}
        <div className="vyasa-wisdom-header">
          <div className="vyasa-wisdom-brand">
            <div className="vyasa-wisdom-brand-logo-frame">
              <img
                src={defaultVyasaLogo}
                alt="VYASA Emblem"
                className="vyasa-wisdom-brand-logo"
              />
            </div>
            <div className="vyasa-wisdom-brand-text">
              <div className="vyasa-wisdom-header-eyebrow">
                CSJMU Institutional Heritage
              </div>
              <h2 id="vyasa-wisdom-title" className="vyasa-wisdom-heading">
                VYASA Wisdom
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="vyasa-wisdom-close-btn"
            onClick={handleDismiss}
            aria-label="Close Wisdom and proceed"
          >
            <AppIcon name="close" size={16} color="var(--vyasa-text-muted, #64748b)" />
          </button>
        </div>

        {/* Content Body */}
        <div className="vyasa-wisdom-body">
          {/* Domain / Veda Canonical Badge */}
          <div className="vyasa-wisdom-meta-row">
            <span className="vyasa-wisdom-veda-badge">
              <AppIcon name="book-open" size={12} color="#854d0e" />
              <span>{shloka.veda}</span>
            </span>
            {shloka.theme && (
              <span className="vyasa-wisdom-theme-badge">
                {shloka.theme}
              </span>
            )}
          </div>

          {/* Sanskrit Verse - Central Scholarly Focus */}
          <div className="vyasa-wisdom-verse-frame">
            <div id="vyasa-wisdom-sanskrit" className="vyasa-wisdom-sanskrit">
              {shloka.sanskrit}
            </div>
            {shloka.transliteration && (
              <div className="vyasa-wisdom-transliteration">
                {shloka.transliteration}
              </div>
            )}
          </div>

          {/* Meanings */}
          <div className="vyasa-wisdom-meanings">
            {shloka.meaning_hi && (
              <p className="vyasa-wisdom-meaning-hi">
                {shloka.meaning_hi}
              </p>
            )}
            {shloka.meaning_en && (
              <p className="vyasa-wisdom-meaning-en">
                {shloka.meaning_en}
              </p>
            )}
          </div>

          {/* Source Citation */}
          <div className="vyasa-wisdom-source-wrap">
            <span className="vyasa-wisdom-source">
              Source &bull; <strong>{shloka.source}</strong>
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="vyasa-wisdom-footer">
          <button
            type="button"
            className="vyasa-wisdom-btn-skip"
            onClick={handleDismiss}
            aria-label="Skip to destination"
          >
            Skip
          </button>

          <Button
            variant="primary"
            size="md"
            onClick={onContinue}
            aria-label="Continue to dashboard"
            data-wisdom-continue="true"
            style={{ minWidth: '130px', justifyContent: 'center' }}
          >
            Continue &rarr;
          </Button>
        </div>
      </div>
    </div>
  );
};
