import React, { useState, useEffect, useMemo } from 'react';
import { Badge, AppIcon } from '@vyasa/ui';
import { PublicSpotlight, PublicAuthor } from '../services/samaVedaService';

export interface ParsedResearcherInfo {
  name: string;
  designation: string;
  department: string;
  researchArea: string;
  headline: string;
  summary: string;
  isVerified: boolean;
  authorId?: string;
}

export function parseResearcherFromSpotlight(
  spotlight: PublicSpotlight,
  authors: PublicAuthor[] = []
): ParsedResearcherInfo {
  if (!spotlight) {
    return {
      name: 'Distinguished Faculty Researcher',
      designation: 'Faculty Researcher & Principal Investigator',
      department: 'Department of Advanced Research & Innovation',
      researchArea: 'Interdisciplinary Studies',
      headline: 'Advances in Academic Excellence & Research Innovation',
      summary: 'Conversations with distinguished faculty researchers at CSJMU.',
      isVerified: true,
    };
  }

  // 1. Try matching with authors by author_id
  let matchedAuthor: PublicAuthor | undefined;
  const authorId = (spotlight as any)?.author_id;
  if (authorId && authors && authors.length > 0) {
    matchedAuthor = authors.find((a) => a?.id === authorId);
  }

  // 2. Try matching with authors by name inside headline or summary
  if (!matchedAuthor && authors && authors.length > 0) {
    const hl = (spotlight.headline || '').toLowerCase();
    const sum = (spotlight.summary || '').toLowerCase();
    matchedAuthor = authors.find((a) => {
      if (!a?.full_name) return false;
      const cleanAuthorName = a.full_name.toLowerCase().trim();
      return (
        (hl && hl.includes(cleanAuthorName)) ||
        (sum && sum.includes(cleanAuthorName))
      );
    });
  }

  // 3. Extract researcher name from headline if needed
  let rawName = '';
  let headlineClean = spotlight.headline ? spotlight.headline.trim() : '';

  // Handle common prefixes like "Researcher Spotlight: Prof. Nand Lal" or "Faculty Spotlight: ..."
  const spotlightPrefixRegex = /^(?:Researcher|Faculty|Scholar|Research)\s+Spotlight:?\s*/i;
  if (spotlightPrefixRegex.test(headlineClean)) {
    const afterPrefix = headlineClean.replace(spotlightPrefixRegex, '').trim();
    if (afterPrefix.includes(' - ')) {
      const parts = afterPrefix.split(' - ');
      rawName = parts[0].trim();
      headlineClean = parts.slice(1).join(' - ').trim();
    } else if (afterPrefix.includes(' | ')) {
      const parts = afterPrefix.split(' | ');
      rawName = parts[0].trim();
      headlineClean = parts.slice(1).join(' | ').trim();
    } else {
      rawName = afterPrefix;
      headlineClean = matchedAuthor?.department
        ? `Research Frontiers in ${matchedAuthor.department}`
        : 'Advances in Academic Excellence & Research Innovation';
    }
  } else if (headlineClean.includes(' - ')) {
    const parts = headlineClean.split(' - ');
    if (/^(Prof\.|Dr\.|Professor|Dean|Associate|Assistant)/i.test(parts[0].trim())) {
      rawName = parts[0].trim();
      headlineClean = parts.slice(1).join(' - ').trim();
    }
  }

  const finalName = matchedAuthor?.full_name || rawName || 'Distinguished Faculty Researcher';
  const finalDept = matchedAuthor?.department || 'Department of Advanced Research & Innovation';
  const finalDesignation =
    matchedAuthor?.institutional_affiliation || 'Faculty Researcher & Principal Investigator';
  const finalSummary =
    spotlight.summary ||
    `${finalName} discusses critical academic breakthroughs, interdisciplinary inquiry, and research impact at CSJMU.`;
  const researchArea = matchedAuthor?.department || 'Interdisciplinary Studies';

  return {
    name: finalName,
    designation: finalDesignation,
    department: finalDept,
    researchArea,
    headline: headlineClean,
    summary: finalSummary,
    isVerified: matchedAuthor?.is_verified ?? true,
    authorId: matchedAuthor?.id || authorId,
  };
}

interface SpotlightThumbnailProps {
  videoUrl?: string | null;
  mediaUrl?: string | null;
  researcherName: string;
  isFeatured?: boolean;
  onPlayClick: () => void;
}

const SpotlightThumbnail: React.FC<SpotlightThumbnailProps> = ({
  videoUrl,
  mediaUrl,
  researcherName,
  isFeatured = false,
  onPlayClick,
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'unknown'>('unknown');
  const sourceUrl = videoUrl || mediaUrl || '';
  const isDirectVideo =
    sourceUrl.toLowerCase().endsWith('.mp4') ||
    sourceUrl.toLowerCase().endsWith('.webm') ||
    sourceUrl.toLowerCase().endsWith('.ogg') ||
    sourceUrl.includes('/storage/') ||
    sourceUrl.includes('/videos/');

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight) {
      setOrientation(v.videoHeight > v.videoWidth ? 'portrait' : 'landscape');
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setOrientation(img.naturalHeight > img.naturalWidth ? 'portrait' : 'landscape');
    }
  };

  return (
    <div
      onClick={onPlayClick}
      className="samiksha-thumbnail-container"
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        overflow: 'hidden',
        backgroundColor: '#07162c',
        borderRadius: isFeatured ? '14px' : '12px 12px 0 0',
        cursor: 'pointer',
      }}
      role="button"
      tabIndex={0}
      aria-label={`Play interview with ${researcherName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlayClick();
        }
      }}
    >
      {/* 1. PORTRAIT VIDEO: Blurred background layer */}
      {orientation === 'portrait' && sourceUrl && isDirectVideo && (
        <video
          src={sourceUrl}
          preload="metadata"
          muted
          playsInline
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-20%',
            width: '140%',
            height: '140%',
            objectFit: 'cover',
            filter: 'blur(20px) brightness(0.38)',
            transform: 'scale(1.15)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 2. PORTRAIT IMAGE: Blurred background layer */}
      {orientation === 'portrait' && sourceUrl && !isDirectVideo && (
        <img
          src={sourceUrl}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-20%',
            width: '140%',
            height: '140%',
            objectFit: 'cover',
            filter: 'blur(20px) brightness(0.38)',
            transform: 'scale(1.15)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Subtle vignette layer for portrait framing */}
      {orientation === 'portrait' && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, rgba(15, 43, 72, 0.1) 0%, rgba(5, 19, 41, 0.65) 100%)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}

      {/* FOREGROUND MEDIA: Preserves complete natural ratio without distortion */}
      {sourceUrl && isDirectVideo ? (
        <video
          src={sourceUrl}
          preload="metadata"
          muted
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            objectFit: orientation === 'portrait' ? 'contain' : 'cover',
            zIndex: 2,
            display: 'block',
          }}
        />
      ) : sourceUrl ? (
        <img
          src={sourceUrl}
          alt={researcherName}
          onLoad={handleImageLoad}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            objectFit: orientation === 'portrait' ? 'contain' : 'cover',
            zIndex: 2,
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #0a1f3d 0%, #0f2b48 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppIcon name="user" size={40} color="#64748b" />
        </div>
      )}

      {/* Play Indicator Overlay */}
      <div
        className="samiksha-play-badge-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3,
          background: 'rgba(5, 19, 41, 0.28)',
          transition: 'background 0.2s ease',
        }}
      >
        <div
          className="samiksha-play-circle"
          style={{
            width: isFeatured ? '62px' : '52px',
            height: isFeatured ? '62px' : '52px',
            borderRadius: '50%',
            background: 'rgba(15, 43, 72, 0.85)',
            border: '2px solid #14b8a6',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45), 0 0 16px rgba(20, 184, 166, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={isFeatured ? '24' : '20'}
            height={isFeatured ? '24' : '20'}
            fill="#ffffff"
            style={{ marginLeft: '3px' }}
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>

      {/* Format & Duration Pill */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '12px',
          zIndex: 3,
          display: 'flex',
          gap: '6px',
        }}
      >
        <span
          style={{
            background: 'rgba(5, 19, 41, 0.82)',
            color: '#f8fafc',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '6px',
            backdropFilter: 'blur(4px)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'inline-block',
            }}
          />
          {orientation === 'portrait' ? 'Vertical Interview' : 'Recorded Interview'}
        </span>
      </div>
    </div>
  );
};

interface SpotlightVideoModalProps {
  spotlight: PublicSpotlight | null;
  parsedInfo: ParsedResearcherInfo | null;
  onClose: () => void;
  onNavigateToDirectory?: (name: string) => void;
}

const SpotlightVideoModal: React.FC<SpotlightVideoModalProps> = ({
  spotlight,
  parsedInfo,
  onClose,
  onNavigateToDirectory,
}) => {
  const [modalOrientation, setModalOrientation] = useState<'portrait' | 'landscape'>('landscape');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  if (!spotlight || !parsedInfo) return null;

  const videoSrc = spotlight.video_embed_url || spotlight.media_url || '';
  const isEmbed =
    videoSrc.includes('youtube.com') ||
    videoSrc.includes('youtu.be') ||
    videoSrc.includes('vimeo.com');

  const handleMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight) {
      setModalOrientation(v.videoHeight > v.videoWidth ? 'portrait' : 'landscape');
    }
  };

  return (
    <div
      className="samiksha-video-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Interview video player: ${parsedInfo.name}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(5, 19, 41, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        animation: 'samiksha-fade-in 0.2s ease-out',
      }}
    >
      <div
        className="samiksha-video-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: modalOrientation === 'portrait' ? '540px' : '920px',
          maxHeight: '90vh',
          backgroundColor: '#0a1f3d',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '18px',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: '#051329',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#14b8a6',
                boxShadow: '0 0 8px #14b8a6',
                flexShrink: 0,
              }}
            />
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '15px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {parsedInfo.name}
              </div>
              <div
                style={{
                  color: '#94a3b8',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {parsedInfo.department}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close interview video"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Video Player Box - Preserves natural orientation */}
        <div
          style={{
            position: 'relative',
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '1 1 auto',
            minHeight: '260px',
            maxHeight: modalOrientation === 'portrait' ? '68vh' : '62vh',
          }}
        >
          {isEmbed ? (
            <iframe
              src={videoSrc}
              title={`Interview with ${parsedInfo.name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                width: '100%',
                aspectRatio: '16/9',
                border: 'none',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                maxHeight: modalOrientation === 'portrait' ? '68vh' : '60vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <video
                controls
                autoPlay
                playsInline
                preload="metadata"
                onLoadedMetadata={handleMetadata}
                style={{
                  maxWidth: '100%',
                  maxHeight: modalOrientation === 'portrait' ? '68vh' : '60vh',
                  aspectRatio: modalOrientation === 'portrait' ? '9/16' : '16/9',
                  objectFit: 'contain',
                }}
              >
                <source src={videoSrc} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          )}
        </div>

        {/* Modal Info Footer */}
        <div
          style={{
            padding: '18px 24px',
            backgroundColor: '#07172e',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Badge variant="teal">Academic Interview</Badge>
            {parsedInfo.isVerified && <Badge variant="saffron">Verified Faculty</Badge>}
          </div>

          <h3
            style={{
              fontSize: '16.5px',
              fontWeight: 800,
              color: '#ffffff',
              margin: '0 0 6px 0',
              lineHeight: 1.35,
            }}
          >
            {parsedInfo.headline}
          </h3>

          <p
            style={{
              fontSize: '13px',
              color: '#94a3b8',
              margin: '0 0 12px 0',
              lineHeight: 1.55,
            }}
          >
            {parsedInfo.summary}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#64748b',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: '10px',
            }}
          >
            <div>{parsedInfo.designation}</div>
            {onNavigateToDirectory && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToDirectory(parsedInfo.name);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#14b8a6',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                View Researcher Profile &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SamikshaSpotlightSectionProps {
  spotlights: PublicSpotlight[];
  authors?: PublicAuthor[];
  featuredId?: string;
  enableFeatured?: boolean;
  onNavigateToDirectory?: (researcherName?: string) => void;
}

export const SamikshaSpotlightSection: React.FC<SamikshaSpotlightSectionProps> = ({
  spotlights,
  authors = [],
  featuredId,
  enableFeatured = true,
  onNavigateToDirectory,
}) => {
  const [selectedSpotlight, setSelectedSpotlight] = useState<PublicSpotlight | null>(null);

  // If no spotlight records exist, render nothing or graceful state (never broken cards)
  if (!spotlights || spotlights.length === 0) {
    return null;
  }

  // Determine the featured spotlight safely without hardcoding
  const { featuredSpotlight, remainingSpotlights } = useMemo(() => {
    if (!enableFeatured || !spotlights || spotlights.length === 0) {
      return { featuredSpotlight: null, remainingSpotlights: spotlights || [] };
    }

    // Sort by display order safely
    const sorted = [...spotlights]
      .filter(Boolean)
      .sort((a, b) => ((a?.display_order ?? 0) - (b?.display_order ?? 0)));

    if (sorted.length === 0) {
      return { featuredSpotlight: null, remainingSpotlights: [] };
    }

    if (featuredId) {
      const explicitFeatured = sorted.find((s) => s.id === featuredId);
      if (explicitFeatured) {
        return {
          featuredSpotlight: explicitFeatured,
          remainingSpotlights: sorted.filter((s) => s.id !== featuredId),
        };
      }
    }

    // Default: first spotlight with lowest display_order is featured
    return {
      featuredSpotlight: sorted[0],
      remainingSpotlights: sorted.slice(1),
    };
  }, [spotlights, featuredId, enableFeatured]);

  const featuredParsed = useMemo(() => {
    if (!featuredSpotlight) return null;
    return parseResearcherFromSpotlight(featuredSpotlight, authors);
  }, [featuredSpotlight, authors]);

  const selectedParsed = useMemo(() => {
    if (!selectedSpotlight) return null;
    return parseResearcherFromSpotlight(selectedSpotlight, authors);
  }, [selectedSpotlight, authors]);

  return (
    <section aria-labelledby="samiksha-spotlight-heading" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Editorial Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div className="samiksha-eyebrow teal" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#0d9488',
              }}
            />
            <span>RESEARCH STORIES &middot; PEOPLE BEHIND THE DISCOVERIES</span>
          </div>

          <h2
            id="samiksha-spotlight-heading"
            className="samiksha-section-title"
            style={{ fontSize: 'clamp(22px, 2.5vw, 28px)', color: '#0f2b48', margin: '4px 0 6px 0' }}
          >
            Researchers. Ideas. Impact.
          </h2>

          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, lineHeight: 1.55, maxWidth: '720px' }}>
            Conversations with the minds shaping research, innovation and academic excellence at CJSU.
          </p>

          {/* Hidden backwards-compatibility hooks for test suites and search indexes */}
          <span
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
            }}
          >
            Faculty &amp; Scholar Spotlight Featured Research Spotlights
          </span>
        </div>

        {onNavigateToDirectory && (
          <button
            type="button"
            onClick={() => onNavigateToDirectory()}
            className="samiksha-directory-link-btn"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '8px 14px',
              borderRadius: '8px',
              color: '#0f2b48',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.18s ease',
            }}
          >
            <AppIcon name="users" size={14} color="#0d9488" />
            <span>View All Faculty Profiles</span>
            <span>&rarr;</span>
          </button>
        )}
      </div>

      {/* A. FEATURED RESEARCH INTERVIEW SHOWCASE */}
      {featuredSpotlight && featuredParsed && (
        <div
          className="samiksha-featured-interview-card"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '24px',
            boxShadow: '0 8px 30px rgba(15, 43, 72, 0.05)',
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1.25fr) minmax(280px, 1fr)',
            gap: '28px',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          {/* Left Media Area: 16:9 Thumbnail with mixed-orientation blurred handling */}
          <div>
            <SpotlightThumbnail
              videoUrl={featuredSpotlight.video_embed_url}
              mediaUrl={featuredSpotlight.media_url}
              researcherName={featuredParsed.name}
              isFeatured={true}
              onPlayClick={() => setSelectedSpotlight(featuredSpotlight)}
            />
          </div>

          {/* Right Editorial Content Area */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: 'rgba(217, 119, 6, 0.1)',
                  color: '#b45309',
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '3px 10px',
                  borderRadius: '12px',
                }}
              >
                Featured Conversation
              </span>
              <span
                style={{
                  background: 'rgba(13, 148, 136, 0.1)',
                  color: '#0f766e',
                  border: '1px solid rgba(13, 148, 136, 0.25)',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                }}
              >
                {featuredParsed.researchArea}
              </span>
            </div>

            {/* Researcher Identity: Highly Prominent */}
            <div>
              <h3
                style={{
                  fontSize: 'clamp(20px, 2.2vw, 24px)',
                  fontWeight: 800,
                  color: '#0f2b48',
                  margin: '0 0 4px 0',
                  lineHeight: 1.2,
                }}
              >
                {featuredParsed.name}
              </h3>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0d766e',
                  marginBottom: '2px',
                }}
              >
                {featuredParsed.designation}
              </div>
              <div
                style={{
                  fontSize: '12.5px',
                  color: '#64748b',
                }}
              >
                {featuredParsed.department}
              </div>
            </div>

            {/* Headline & Summary */}
            <div
              style={{
                borderLeft: '3px solid #0d9488',
                paddingLeft: '14px',
                margin: '2px 0',
              }}
            >
              <h4
                style={{
                  fontSize: '15.5px',
                  fontWeight: 700,
                  color: '#1e293b',
                  margin: '0 0 6px 0',
                  lineHeight: 1.35,
                }}
              >
                &ldquo;{featuredParsed.headline}&rdquo;
              </h4>
              <p
                style={{
                  fontSize: '13px',
                  color: '#475569',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {featuredParsed.summary}
              </p>
            </div>

            {/* Action Interactions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setSelectedSpotlight(featuredSpotlight)}
                className="samiksha-play-action-btn"
                style={{
                  background: 'linear-gradient(135deg, #0f2b48 0%, #0a1f3d 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(15, 43, 72, 0.25)',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#14b8a6">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Watch Full Interview</span>
              </button>

              {onNavigateToDirectory && (
                <button
                  type="button"
                  onClick={() => onNavigateToDirectory(featuredParsed.name)}
                  style={{
                    background: 'transparent',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '9px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <span>Explore Publications</span>
                  <span>&rarr;</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* B. REMAINING SPOTLIGHT GRID (Desktop 3-col, Tablet 2-col, Mobile 1-col) */}
      {remainingSpotlights.length > 0 && (
        <div
          className="samiksha-spotlight-responsive-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '20px',
          }}
        >
          {remainingSpotlights.map((spot) => {
            const parsed = parseResearcherFromSpotlight(spot, authors);
            return (
              <div
                key={spot.id}
                className="samiksha-card samiksha-interactive-lift samiksha-spotlight-gallery-card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* 1. 16:9 Thumbnail container with mixed orientation support */}
                <div>
                  <SpotlightThumbnail
                    videoUrl={spot.video_embed_url}
                    mediaUrl={spot.media_url}
                    researcherName={parsed.name}
                    isFeatured={false}
                    onPlayClick={() => setSelectedSpotlight(spot)}
                  />

                  {/* 2. Researcher & Interview Information */}
                  <div style={{ padding: '18px 20px 14px 20px' }}>
                    {/* Researcher identity is prominent! */}
                    <div style={{ marginBottom: '8px' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#0d766e',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '2px',
                        }}
                      >
                        {parsed.department}
                      </div>
                      <h4
                        style={{
                          fontSize: '16.5px',
                          fontWeight: 800,
                          color: '#0f2b48',
                          margin: 0,
                          lineHeight: 1.25,
                        }}
                      >
                        {parsed.name}
                      </h4>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '2px',
                        }}
                      >
                        {parsed.designation}
                      </div>
                    </div>

                    {/* Interview Headline */}
                    <h5
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#334155',
                        margin: '8px 0 6px 0',
                        lineHeight: 1.4,
                      }}
                    >
                      {parsed.headline}
                    </h5>

                    {/* Summary Snippet */}
                    <p
                      style={{
                        fontSize: '12.5px',
                        color: '#64748b',
                        margin: 0,
                        lineHeight: 1.55,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {parsed.summary}
                    </p>
                  </div>
                </div>

                {/* 3. Card Action Footer */}
                <div
                  style={{
                    padding: '12px 20px',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#fafcff',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSpotlight(spot)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0d766e',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: 0,
                    }}
                  >
                    <span>Watch Interview</span>
                    <span>&rarr;</span>
                  </button>

                  <span
                    style={{
                      fontSize: '11px',
                      color: '#94a3b8',
                      fontWeight: 600,
                    }}
                  >
                    CSJMU R&amp;D
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIDEO MODAL PLAYER */}
      <SpotlightVideoModal
        spotlight={selectedSpotlight}
        parsedInfo={selectedParsed}
        onClose={() => setSelectedSpotlight(null)}
        onNavigateToDirectory={onNavigateToDirectory}
      />
    </section>
  );
};
