import React, { useState, useEffect, useRef } from 'react';
import { AppIcon, Button } from '@vyasa/ui';
import { PublicBulletin } from '../services/samaVedaService';
import { config } from '../../../config';

interface SamikshaPdfViewerProps {
  bulletin: PublicBulletin;
  onClose: () => void;
  onDownload: () => void;
}

export const SamikshaPdfViewer: React.FC<SamikshaPdfViewerProps> = ({
  bulletin,
  onClose,
  onDownload,
}) => {
  // Saved reading position key
  const storageKey = `samiksha_pdf_pos_${bulletin.id}`;
  const initialPage = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const p = parseInt(saved, 10);
        if (!isNaN(p) && p >= 1) return p;
      }
    } catch {
      // ignore storage access errors
    }
    return 1;
  };

  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [fitMode, setFitMode] = useState<'custom' | 'width' | 'page'>('width');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch the PDF blob inline
  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    const loadPdfData = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const targetUrl = `${config.apiBaseUrl}/modules/sama-veda/bulletins/${bulletin.id}/download?inline=true`;
        const res = await fetch(targetUrl);

        if (!res.ok) {
          throw new Error(`Failed to load research bulletin (HTTP ${res.status})`);
        }

        const blob = await res.blob();
        if (!isMounted) return;

        // Detect total page count from PDF binary structure
        try {
          const buffer = await blob.arrayBuffer();
          const text = new TextDecoder('latin1').decode(buffer);
          const pageMatches = text.match(/\/Type\s*\/Page\b/g);
          if (pageMatches && pageMatches.length > 0) {
            setTotalPages(pageMatches.length);
          }
        } catch {
          // fallback to 1 page if binary inspection fails
        }

        createdUrl = window.URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } catch (err: any) {
        if (isMounted) {
          setLoadError(
            err.message || 'Unable to open the digital bulletin reader. The document may be unavailable.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPdfData();

    return () => {
      isMounted = false;
      if (createdUrl) {
        window.URL.revokeObjectURL(createdUrl);
      }
    };
  }, [bulletin.id]);

  // Persist current page reading position
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(currentPage));
    } catch {
      // ignore
    }
  }, [currentPage, storageKey]);

  // Page Navigation Handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      if (val >= 1 && val <= totalPages) {
        setCurrentPage(val);
      }
    }
  };

  // Zoom Handlers
  const handleZoomIn = () => {
    setFitMode('custom');
    setZoom((prev) => Math.min(250, prev + 25));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    setZoom((prev) => Math.max(50, prev - 25));
  };

  const handleFitWidth = () => {
    setFitMode('width');
    setZoom(100);
  };

  const handleFitPage = () => {
    setFitMode('page');
    setZoom(100);
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Compute viewer source URL with fragment parameters
  const computedSrc = React.useMemo(() => {
    if (!blobUrl) return '';
    let fragment = `#page=${currentPage}`;
    if (fitMode === 'width') {
      fragment += '&view=FitH';
    } else if (fitMode === 'page') {
      fragment += '&view=Fit';
    } else {
      fragment += `&zoom=${zoom}`;
    }
    return `${blobUrl}${fragment}`;
  }, [blobUrl, currentPage, fitMode, zoom]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${bulletin.title} Digital Reader`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: '#040d1a',
        display: 'flex',
        flexDirection: 'column',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`
        .samiksha-pdf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          padding: 10px 20px;
          background: linear-gradient(180deg, #061325 0%, #0a1f3d 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        @media (max-width: 640px) {
          .samiksha-pdf-header {
            padding: 8px 12px;
            gap: 8px;
          }
          .samiksha-pdf-branding {
            display: none !important;
          }
          .samiksha-pdf-fit-btn {
            display: none !important;
          }
        }
        @media (max-width: 400px) {
          .samiksha-pdf-header {
            padding: 6px 8px;
            gap: 6px;
          }
          .samiksha-pdf-fullscreen-btn span {
            display: none !important;
          }
          .samiksha-pdf-download-btn span {
            font-size: 11px;
          }
          .samiksha-pdf-controls {
            padding: 2px 6px !important;
            gap: 4px !important;
          }
          .samiksha-pdf-back-btn span {
            display: none !important;
          }
        }
      `}</style>
      {/* 1. Reader Master Top Toolbar */}
      <header className="samiksha-pdf-header">
        {/* Left: Back Action & Issue Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onClose}
            className="samiksha-pdf-back-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Return to Bulletin Archive"
          >
            <AppIcon name="arrow-left" size={14} color="#ffffff" />
            <span>Back to Issue</span>
          </button>

          <div className="samiksha-pdf-branding" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.15)', paddingLeft: '14px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#f59e0b', fontWeight: 800, letterSpacing: '0.06em' }}>
              CSJMU Digital Research Bulletin Reader
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Volume {bulletin.volume_number} &bull; Issue {bulletin.issue_number}</span>
              <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 500 }}>
                ({bulletin.publication_period})
              </span>
            </div>
          </div>
        </div>

        {/* Center: Interactive Page Navigation & Zoom Toolbar */}
        <div
          className="samiksha-pdf-controls"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.07)',
            padding: '4px 10px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Page Controls */}
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            style={{
              background: 'transparent',
              border: 'none',
              color: currentPage <= 1 ? 'rgba(255,255,255,0.3)' : '#ffffff',
              cursor: currentPage <= 1 ? 'default' : 'pointer',
              padding: '4px 6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Previous Page"
            aria-label="Previous Page"
          >
            <AppIcon name="chevron-left" size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ color: '#cbd5e1' }}>Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={handlePageInputChange}
              aria-label="Current Page Number"
              style={{
                width: '42px',
                textAlign: 'center',
                padding: '3px 4px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                background: '#040d1a',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
              }}
            />
            <span style={{ color: '#94a3b8' }}>of {totalPages}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            style={{
              background: 'transparent',
              border: 'none',
              color: currentPage >= totalPages ? 'rgba(255,255,255,0.3)' : '#ffffff',
              cursor: currentPage >= totalPages ? 'default' : 'pointer',
              padding: '4px 6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Next Page"
            aria-label="Next Page"
          >
            <AppIcon name="chevron-right" size={16} />
          </button>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

          {/* Zoom Controls */}
          <button
            type="button"
            onClick={handleZoomOut}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px 6px',
              fontSize: '14px',
              fontWeight: 700,
            }}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            &minus;
          </button>

          <span style={{ fontSize: '11.5px', minWidth: '40px', textAlign: 'center', color: '#38bdf8', fontWeight: 600 }}>
            {fitMode === 'width' ? 'Fit W' : fitMode === 'page' ? 'Fit P' : `${zoom}%`}
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px 6px',
              fontSize: '14px',
              fontWeight: 700,
            }}
            title="Zoom In"
            aria-label="Zoom In"
          >
            &#43;
          </button>

          <button
            type="button"
            onClick={handleFitWidth}
            className="samiksha-pdf-fit-btn"
            style={{
              background: fitMode === 'width' ? 'rgba(13, 148, 136, 0.3)' : 'transparent',
              border: fitMode === 'width' ? '1px solid #14b8a6' : '1px solid transparent',
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '11px',
              padding: '3px 7px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            title="Fit to Width"
          >
            Fit Width
          </button>

          <button
            type="button"
            onClick={handleFitPage}
            className="samiksha-pdf-fit-btn"
            style={{
              background: fitMode === 'page' ? 'rgba(13, 148, 136, 0.3)' : 'transparent',
              border: fitMode === 'page' ? '1px solid #14b8a6' : '1px solid transparent',
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '11px',
              padding: '3px 7px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            title="Fit to Page"
          >
            Fit Page
          </button>
        </div>

        {/* Right: Fullscreen & Download Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="samiksha-pdf-fullscreen-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            <AppIcon name="layers" size={13} color="#ffffff" />
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <Button
            variant="primary"
            size="sm"
            onClick={onDownload}
            className="samiksha-pdf-download-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Download PDF &darr;</span>
          </Button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#cbd5e1',
              fontSize: '24px',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '4px',
              marginLeft: '4px',
            }}
            aria-label="Close PDF Reader"
            title="Close Reader"
          >
            &times;
          </button>
        </div>
      </header>

      {/* 2. Viewer Stage / Canvas Area */}
      <main
        style={{
          flex: 1,
          position: 'relative',
          background: '#071526',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isLoading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              color: '#38bdf8',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(56, 189, 248, 0.2)',
                borderTopColor: '#38bdf8',
                borderRadius: '50%',
                animation: 'samiksha-spin 0.8s linear infinite',
              }}
            />
            <div style={{ fontSize: '13px', fontWeight: 600 }}>
              Preparing digital edition reader...
            </div>
          </div>
        )}

        {loadError && !isLoading && (
          <div
            style={{
              maxWidth: '520px',
              textAlign: 'center',
              padding: '32px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <AppIcon name="alert-circle" size={36} color="#ef4444" />
            <h4 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Document Preview Unavailable
            </h4>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              {loadError}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <Button variant="primary" size="sm" onClick={onDownload}>
                Download PDF File &darr;
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Back to Issue
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !loadError && blobUrl && (
          <iframe
            ref={iframeRef}
            src={computedSrc}
            title={`${bulletin.title} PDF Edition`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#071526',
            }}
          />
        )}
      </main>
    </div>
  );
};
