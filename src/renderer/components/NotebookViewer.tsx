import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Note } from '@shared/types';
import { buildNotebookPages } from '../lib/notebookLayout';

interface NotebookViewerProps {
  notebook: Note | null;
  notebookTitle?: string;
  onClose: () => void;
}

const NotebookViewer: React.FC<NotebookViewerProps> = ({ notebook, notebookTitle, onClose }) => {
  const pages = useMemo(
    () => buildNotebookPages(notebook, notebookTitle || notebook?.title || 'Prowl Field Notebook'),
    [notebook, notebookTitle]
  );

  const [spreadIndex, setSpreadIndex] = useState(0);
  const [flip, setFlip] = useState<{
    direction: 'forward' | 'backward';
    progress: number; // 0 to 1
  } | null>(null);
  const animFrameRef = useRef<number>(0);

  const totalSpreads = Math.max(1, Math.ceil(pages.length / 2));

  useEffect(() => {
    setSpreadIndex((value) => Math.min(value, totalSpreads - 1));
  }, [totalSpreads]);

  const animateFlip = useCallback((direction: 'forward' | 'backward') => {
    if (flip) return;
    const duration = 600; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease in-out cubic for smooth page curl
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      setFlip({ direction, progress: eased });

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setFlip(null);
        setSpreadIndex((value) =>
          direction === 'forward'
            ? Math.min(value + 1, totalSpreads - 1)
            : Math.max(value - 1, 0)
        );
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [flip, totalSpreads]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleNextPage = useCallback(() => {
    if (spreadIndex >= totalSpreads - 1 || flip) return;
    animateFlip('forward');
  }, [flip, spreadIndex, totalSpreads, animateFlip]);

  const handlePrevPage = useCallback(() => {
    if (spreadIndex <= 0 || flip) return;
    animateFlip('backward');
  }, [flip, spreadIndex, animateFlip]);

  // Current spread pages
  const leftPage = pages[spreadIndex * 2] ?? null;
  const rightPage = pages[spreadIndex * 2 + 1] ?? null;

  // Next/prev spread pages for the flipping page faces
  const nextLeftPage = pages[(spreadIndex + 1) * 2] ?? null;
  const prevRightPage = pages[(spreadIndex - 1) * 2 + 1] ?? null;

  const renderPageContent = (page: ReturnType<typeof buildNotebookPages>[number] | null, side: 'left' | 'right', pageNum: number) => (
    <div className="nb-page-inner">
      <div className="nb-page-header">
        <span className="nb-page-title">{page?.headerTitle || notebookTitle || notebook?.title || 'Prowl Field Notebook'}</span>
        <span className="nb-page-date">{page?.dateLabel || 'Ready for notes'}</span>
      </div>
      <div className="nb-page-divider" />
      <div className="nb-page-content flow" style={{ userSelect: 'text' }}>
        {page ? page.lines.map((line) => (
          <div key={line.id} className={`nb-line ${line.tone}`}>
            {line.text}
          </div>
        )) : (
          side === 'left' && !notebook ? (
            <div className="nb-page-empty">
              <div className="nb-empty-icon">~</div>
              <div>No notebook yet</div>
              <div className="nb-empty-hint">Set a target and let PROWL build the AI notebook as the engagement develops.</div>
            </div>
          ) : null
        )}
      </div>
      <div className="nb-page-footer">
        <span className="nb-page-source">{page?.sourceLabel || 'FIELD NOTES'}</span>
        <span className="nb-page-number">{pageNum}</span>
      </div>
    </div>
  );

  // Calculate flip transform
  const getFlipStyle = (): React.CSSProperties => {
    if (!flip) return { display: 'none' };
    const { direction, progress } = flip;
    const bend = Math.sin(progress * Math.PI);

    if (direction === 'forward') {
      const angle = progress * -180;
      const skew = bend * 3.8;
      const scale = 1 - bend * 0.04;
      const shadowIntensity = bend * 0.7;
      return {
        position: 'absolute',
        top: 0,
        left: '50%',
        width: '50%',
        height: '100%',
        transformOrigin: 'left center',
        transform: `perspective(2600px) translateX(${-10 * bend}px) translateZ(${10 * bend}px) rotateY(${angle}deg) skewY(${skew}deg) scaleX(${scale})`,
        zIndex: 20,
        filter: `brightness(${1 - shadowIntensity * 0.12})`,
        boxShadow: `${-22 * bend}px 12px 40px rgba(0, 0, 0, ${0.2 + shadowIntensity * 0.2})`,
        pointerEvents: 'none',
      };
    } else {
      const angle = -180 + progress * 180;
      const skew = bend * -3.8;
      const scale = 1 - bend * 0.04;
      const shadowIntensity = bend * 0.7;
      return {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '50%',
        height: '100%',
        transformOrigin: 'right center',
        transform: `perspective(2600px) translateX(${10 * bend}px) translateZ(${10 * bend}px) rotateY(${angle}deg) skewY(${skew}deg) scaleX(${scale})`,
        zIndex: 20,
        filter: `brightness(${1 - shadowIntensity * 0.12})`,
        boxShadow: `${22 * bend}px 12px 40px rgba(0, 0, 0, ${0.2 + shadowIntensity * 0.2})`,
        pointerEvents: 'none',
      };
    }
  };

  // The flipping page has a front and back face
  const renderFlipPage = () => {
    if (!flip) return null;
    const { direction, progress } = flip;
    const showBack = direction === 'forward' ? progress > 0.5 : progress < 0.5;
    const bend = Math.sin(progress * Math.PI);

    let frontContent: React.ReactNode;
    let backContent: React.ReactNode;

    if (direction === 'forward') {
      // Front: current right page, Back: next left page
      const frontNum = spreadIndex * 2 + 2;
      const backNum = (spreadIndex + 1) * 2 + 1;
      frontContent = renderPageContent(rightPage, 'right', frontNum);
      backContent = renderPageContent(nextLeftPage, 'left', backNum);
    } else {
      // Front: current left page, Back: prev right page
      const frontNum = spreadIndex * 2 + 1;
      const backNum = (spreadIndex - 1) * 2 + 2;
      frontContent = renderPageContent(leftPage, 'left', frontNum);
      backContent = renderPageContent(prevRightPage, 'right', backNum);
    }

    return (
      <div style={getFlipStyle()} className="nb-flip-page">
        <div
          className={`nb-page nb-flip-face ${direction === 'forward' ? 'right' : 'left'}`}
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            display: showBack ? 'none' : 'flex',
            borderRadius: direction === 'forward' ? '0 4px 4px 0' : '4px 0 0 4px',
          }}
        >
          {frontContent}
          <div className="nb-flip-gloss" style={{ opacity: 0.16 + bend * 0.16 }} />
          <div className="nb-flip-curl-shadow" style={{ opacity: 0.1 + bend * 0.28 }} />
        </div>
        <div
          className={`nb-page nb-flip-face ${direction === 'forward' ? 'left' : 'right'}`}
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            display: showBack ? 'flex' : 'none',
            borderRadius: direction === 'forward' ? '4px 0 0 4px' : '0 4px 4px 0',
          }}
        >
          {backContent}
          <div className="nb-flip-gloss nb-flip-gloss-back" style={{ opacity: 0.1 + bend * 0.14 }} />
        </div>
        <div
          className="nb-flip-edge"
          style={{
            left: direction === 'forward' ? 0 : undefined,
            right: direction === 'backward' ? 0 : undefined,
            opacity: 0.24 + bend * 0.4,
          }}
        />
      </div>
    );
  };

  // Shadow cast on the page underneath during flip
  const renderFlipShadow = () => {
    if (!flip) return null;
    const { direction, progress } = flip;
    const opacity = Math.sin(progress * Math.PI) * 0.4;

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '50%',
          left: direction === 'forward' ? 0 : '50%',
          background: direction === 'forward'
            ? `linear-gradient(90deg, transparent 60%, rgba(0,0,0,${opacity}))`
            : `linear-gradient(270deg, transparent 60%, rgba(0,0,0,${opacity}))`,
          zIndex: 15,
          pointerEvents: 'none',
        }}
      />
    );
  };

  return (
    <div className="nb-overlay" onClick={onClose}>
      <div className="nb-container" onClick={(event) => event.stopPropagation()}>
        <button className="nb-close" onClick={onClose}>x</button>

        {spreadIndex > 0 && !flip && (
          <button className="nb-nav nb-nav-left" onClick={handlePrevPage}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {spreadIndex < totalSpreads - 1 && !flip && (
          <button className="nb-nav nb-nav-right" onClick={handleNextPage}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        <div className="nb-book" style={{ perspective: '2500px' }}>
          <div className="nb-spine" />

          {/* Static left page */}
          <div
            className="nb-page left"
            onClick={!flip ? handlePrevPage : undefined}
            style={{ opacity: flip?.direction === 'backward' && flip.progress < 0.5 ? 0.7 : 1 }}
          >
            {renderPageContent(leftPage, 'left', spreadIndex * 2 + 1)}
          </div>

          {/* Static right page */}
          <div
            className="nb-page right"
            onClick={!flip ? handleNextPage : undefined}
            style={{ opacity: flip?.direction === 'forward' && flip.progress < 0.5 ? 0.7 : 1 }}
          >
            {renderPageContent(rightPage, 'right', spreadIndex * 2 + 2)}
          </div>

          {/* Flip shadow on underlying page */}
          {renderFlipShadow()}

          {/* The animated flipping page */}
          {renderFlipPage()}
        </div>

        <div className="nb-indicator">
          {spreadIndex + 1} / {totalSpreads}
        </div>
      </div>
    </div>
  );
};

export default NotebookViewer;
