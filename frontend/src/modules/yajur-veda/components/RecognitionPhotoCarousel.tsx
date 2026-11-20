import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AnudaanGalleryItemOut } from '../types/anudaan';
import { anudaanService } from '../services/anudaanService';
import './RecognitionPhotoCarousel.css';

export interface RecognitionPhotoCarouselProps {
  item: AnudaanGalleryItemOut;
  variant?: 'featured' | 'standard';
  onImageClick?: (index: number) => void;
  badges?: React.ReactNode;
  emptyLabel?: string;
  className?: string;
}

export const RecognitionPhotoCarousel: React.FC<RecognitionPhotoCarouselProps> = ({
  item,
  variant = 'standard',
  onImageClick,
  badges,
  emptyLabel,
  className = '',
}) => {
  const images = item.images || [];
  const hasImages = images.length > 0;
  const hasMultipleImages = images.length >= 2;

  // Initialize at the cover image index if one exists, otherwise index 0
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (!images || images.length === 0) return 0;
    const coverIdx = images.findIndex((img) => img.is_cover);
    return coverIdx >= 0 ? coverIdx : 0;
  });

  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [resetTimerToken, setResetTimerToken] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});

  // Touch & Swipe tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);

  // Listen to prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handler);
      return () => (mediaQuery as any).removeListener(handler);
    }
  }, []);

  // Listen to document visibility changes (pauses autoplay when tab is in background)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Preload the next image for instant, smooth transition
  useEffect(() => {
    if (!hasMultipleImages) return;
    const nextIdx = (currentIndex + 1) % images.length;
    const nextImg = images[nextIdx];
    if (nextImg && !failedImageIds[nextImg.id]) {
      const preloadImg = new Image();
      preloadImg.src = anudaanService.getGalleryImageUrl(nextImg.id);
    }
  }, [currentIndex, images, hasMultipleImages, failedImageIds]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (!hasMultipleImages) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setResetTimerToken((t) => t + 1);
  }, [hasMultipleImages, images.length]);

  const goToPrev = useCallback(() => {
    if (!hasMultipleImages) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setResetTimerToken((t) => t + 1);
  }, [hasMultipleImages, images.length]);

  const goToIndex = useCallback(
    (index: number) => {
      if (!hasMultipleImages) return;
      setCurrentIndex(index);
      setResetTimerToken((t) => t + 1);
    },
    [hasMultipleImages]
  );

  // Autoplay timer effect: rotates every 5 seconds (5000ms)
  useEffect(() => {
    if (!hasMultipleImages || prefersReducedMotion || isHovered || isFocused || isTabHidden) {
      return;
    }

    const intervalId = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [hasMultipleImages, prefersReducedMotion, isHovered, isFocused, isTabHidden, images.length, resetTimerToken]);

  // Touch swipe events
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Detect if finger moved more than 10px in any direction
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe threshold: 40px and dominant horizontal axis
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    // Keep isSwiping active briefly so the upcoming click event is suppressed
    setTimeout(() => {
      isSwiping.current = false;
    }, 120);
  };

  // Click handler to open lightbox
  const handleContainerClick = () => {
    if (isSwiping.current) return;
    if (hasImages && onImageClick) {
      onImageClick(currentIndex);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasMultipleImages) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        if (hasImages && onImageClick) onImageClick(currentIndex);
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToNext();
    } else if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      if (hasImages && onImageClick) onImageClick(currentIndex);
    }
  };

  // Render pagination dots with sliding window if > 7 images
  const renderPaginationDots = () => {
    if (!hasMultipleImages) return null;
    const total = images.length;

    if (total <= 7) {
      return images.map((img, idx) => (
        <button
          key={img.id}
          type="button"
          className={`anudaan-carousel__dot ${idx === currentIndex ? 'anudaan-carousel__dot--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            goToIndex(idx);
          }}
          aria-label={`Go to photograph ${idx + 1} of ${total}`}
          aria-current={idx === currentIndex ? 'true' : undefined}
        />
      ));
    }

    // Sliding window of 5 dots for large galleries
    let start = Math.max(0, currentIndex - 2);
    let end = Math.min(total, start + 5);
    if (end - start < 5) {
      start = Math.max(0, end - 5);
    }

    const visibleDots = [];
    for (let i = start; i < end; i++) {
      const isEdge = (i === start && start > 0) || (i === end - 1 && end < total);
      visibleDots.push(
        <button
          key={images[i].id}
          type="button"
          className={`anudaan-carousel__dot ${
            i === currentIndex ? 'anudaan-carousel__dot--active' : ''
          } ${isEdge ? 'anudaan-carousel__dot--edge' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            goToIndex(i);
          }}
          aria-label={`Go to photograph ${i + 1} of ${total}`}
          aria-current={i === currentIndex ? 'true' : undefined}
        />
      );
    }
    return visibleDots;
  };

  // Handle empty image state
  if (!hasImages) {
    const defaultEmptyLabel =
      variant === 'featured' ? 'Official Ceremony Photograph' : 'Ceremony Record';
    const displayEmptyLabel = emptyLabel || defaultEmptyLabel;

    return (
      <div
        className={`anudaan-carousel anudaan-carousel--empty anudaan-carousel--${variant} ${className}`}
        role="region"
        aria-roledescription="carousel"
        aria-label={item.title}
      >
        {variant === 'featured' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>
            {displayEmptyLabel}
          </div>
        ) : (
          <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>{displayEmptyLabel}</span>
        )}
        {badges && <div className="anudaan-carousel__badges">{badges}</div>}
      </div>
    );
  }

  return (
    <div
      className={`anudaan-carousel anudaan-carousel--${variant} ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${item.title} ceremony photograph carousel`}
      tabIndex={0}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Badges Overlay */}
      {badges && <div className="anudaan-carousel__badges">{badges}</div>}

      {/* Image Slides Track */}
      <div className="anudaan-carousel__track">
        {images.map((img, idx) => {
          const isActive = idx === currentIndex;
          const isFailed = failedImageIds[img.id];

          return (
            <div
              key={img.id}
              className={`anudaan-carousel__slide ${isActive ? 'anudaan-carousel__slide--active' : ''}`}
              style={{
                opacity: isActive ? 1 : 0,
                transition: prefersReducedMotion ? 'none' : 'opacity 500ms ease-in-out',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: isActive ? 1 : 0,
              }}
              aria-hidden={!isActive}
            >
              {isFailed ? (
                <div className="anudaan-carousel__fallback">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>Ceremony photograph unavailable</span>
                </div>
              ) : (
                <img
                  src={anudaanService.getGalleryImageUrl(img.id)}
                  alt={img.caption || item.title}
                  loading={idx === 0 || isActive ? 'eager' : 'lazy'}
                  onError={() => {
                    setFailedImageIds((prev) => ({ ...prev, [img.id]: true }));
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Previous / Next Arrow Controls (rendered only if 2 or more images) */}
      {hasMultipleImages && (
        <>
          <button
            type="button"
            className="anudaan-carousel__nav-btn anudaan-carousel__nav-btn--prev"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="Previous photograph"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="anudaan-carousel__nav-btn anudaan-carousel__nav-btn--next"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="Next photograph"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Pagination Dots (rendered only if 2 or more images) */}
      {hasMultipleImages && (
        <div className="anudaan-carousel__dots" role="tablist" aria-label="Photograph navigation">
          {renderPaginationDots()}
        </div>
      )}

      {/* Photo Counter Overlay (e.g. "1 / 5") */}
      {hasMultipleImages && (
        <div className="anudaan-carousel__counter" aria-live="polite">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
};
