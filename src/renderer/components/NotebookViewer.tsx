import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Note } from '@shared/types';

interface NotebookViewerProps {
  notebook: Note | null;
  notebookTitle?: string;
  allNotes?: Note[];
  onClose: () => void;
}

interface PageData {
  id: string;
  title: string;
  date: string;
  lines: string[];
  source: string;
  pageNum: number;
}

const LINES_PER_PAGE = 22;
const CHARS_PER_LINE = 52;

function wordWrap(text: string, maxChars: number): string[] {
  const result: string[] = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    if (!para.trim()) {
      result.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      if (line && (line.length + 1 + word.length) > maxChars) {
        result.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildPages(notes: Note[], notebookTitle: string): PageData[] {
  if (!notes.length) return [];

  const pages: PageData[] = [];
  let pageNum = 1;

  // Title page
  pages.push({
    id: 'title-page',
    title: notebookTitle,
    date: notes[0]?.createdAt || new Date().toISOString(),
    lines: [
      '',
      '',
      '',
      '',
      '',
      notebookTitle.toUpperCase(),
      '',
      '________________________',
      '',
      `${notes.length} note${notes.length !== 1 ? 's' : ''}`,
      '',
      formatDate(notes[0]?.createdAt || new Date().toISOString()),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'PROWL Field Notebook',
    ],
    source: 'COVER',
    pageNum: pageNum++,
  });

  // Each note becomes one or more pages
  for (const note of notes) {
    const content = note.content || '(empty note)';
    const allLines = wordWrap(content, CHARS_PER_LINE);

    // Split into page-sized chunks
    for (let i = 0; i < allLines.length; i += LINES_PER_PAGE) {
      const chunk = allLines.slice(i, i + LINES_PER_PAGE);
      // Pad to full page
      while (chunk.length < LINES_PER_PAGE) {
        chunk.push('');
      }

      pages.push({
        id: `${note.id}-page-${Math.floor(i / LINES_PER_PAGE)}`,
        title: note.title || 'Untitled',
        date: formatDate(note.updatedAt || note.createdAt),
        lines: chunk,
        source: note.source === 'ai' ? 'AI' : note.source === 'terminal' ? 'TERMINAL' : 'MANUAL',
        pageNum: pageNum++,
      });
    }
  }

  return pages;
}

const NotebookViewer: React.FC<NotebookViewerProps> = ({ notebook, notebookTitle, allNotes, onClose }) => {
  const notes = useMemo(() => {
    if (allNotes && allNotes.length > 0) return allNotes;
    if (notebook) return [notebook];
    return [];
  }, [notebook, allNotes]);

  const pages = useMemo(
    () => buildPages(notes, notebookTitle || notebook?.title || 'Prowl Field Notebook'),
    [notes, notebookTitle, notebook?.title]
  );

  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'forward' | 'backward'>('forward');
  const [flipProgress, setFlipProgress] = useState(0);
  const animRef = useRef<number>(0);

  const totalSpreads = Math.max(1, Math.ceil(pages.length / 2));

  useEffect(() => {
    setCurrentPage(p => Math.min(p, totalSpreads - 1));
  }, [totalSpreads]);

  const flip = useCallback((direction: 'forward' | 'backward') => {
    if (isFlipping) return;
    if (direction === 'forward' && currentPage >= totalSpreads - 1) return;
    if (direction === 'backward' && currentPage <= 0) return;

    setIsFlipping(true);
    setFlipDirection(direction);
    const start = performance.now();
    const duration = 1400;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Smooth ease-in-out
      const eased = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;

      setFlipProgress(eased);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setIsFlipping(false);
        setFlipProgress(0);
        setCurrentPage(p => direction === 'forward' ? p + 1 : p - 1);
      }
    };

    animRef.current = requestAnimationFrame(animate);
  }, [isFlipping, currentPage, totalSpreads]);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') flip('forward');
      if (e.key === 'ArrowLeft') flip('backward');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flip, onClose]);

  const leftPage = pages[currentPage * 2] ?? null;
  const rightPage = pages[currentPage * 2 + 1] ?? null;

  const renderPage = (page: PageData | null, side: 'left' | 'right') => (
    <div className={`nb-page ${side}`}>
      <div className="nb-page-inner">
        {page ? (
          <>
            <div className="nb-page-header">
              <span className="nb-page-title">{page.title}</span>
              <span className="nb-page-date">{page.date}</span>
            </div>
            <div className="nb-page-rule" />
            <div className="nb-page-body">
              {page.lines.map((line, i) => (
                <div key={i} className={`nb-text-line ${!line.trim() ? 'empty' : ''}`}>
                  {line || '\u00A0'}
                </div>
              ))}
            </div>
            <div className="nb-page-footer">
              <span className="nb-page-source">{page.source}</span>
              <span className="nb-page-number">{page.pageNum}</span>
            </div>
          </>
        ) : (
          <div className="nb-page-body">
            {Array.from({ length: LINES_PER_PAGE }, (_, i) => (
              <div key={i} className="nb-text-line empty">{'\u00A0'}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // The flipping page container transform
  const getFlipContainerStyle = (): React.CSSProperties => {
    if (!isFlipping) return { display: 'none' };

    const angle = flipDirection === 'forward'
      ? flipProgress * -180
      : -180 + flipProgress * 180;

    const bend = Math.sin(flipProgress * Math.PI);

    return {
      position: 'absolute',
      top: 0,
      left: flipDirection === 'forward' ? '50%' : 0,
      width: '50%',
      height: '100%',
      transformOrigin: flipDirection === 'forward' ? 'left center' : 'right center',
      transform: `perspective(1800px) rotateY(${angle}deg)`,
      transformStyle: 'preserve-3d' as const,
      zIndex: 30,
      pointerEvents: 'none' as const,
      transition: 'none',
      filter: `drop-shadow(${flipDirection === 'forward' ? '-' : ''}${Math.round(bend * 20)}px 8px ${Math.round(bend * 30)}px rgba(0,0,0,${0.2 + bend * 0.3}))`,
    };
  };

  // Shadow on the page underneath during flip
  const renderUnderpageShadow = () => {
    if (!isFlipping) return null;
    const intensity = Math.sin(flipProgress * Math.PI) * 0.45;
    const spread = Math.sin(flipProgress * Math.PI) * 30;

    return (
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0,
        width: '50%',
        left: flipDirection === 'forward' ? 0 : '50%',
        background: flipDirection === 'forward'
          ? `linear-gradient(90deg, transparent ${50 - spread}%, rgba(0,0,0,${intensity}))`
          : `linear-gradient(270deg, transparent ${50 - spread}%, rgba(0,0,0,${intensity}))`,
        zIndex: 25,
        pointerEvents: 'none',
      }} />
    );
  };

  // Two-sided flipping page — front and back both visible
  const renderFlipPage = () => {
    if (!isFlipping) return null;

    // Front face: the page that's currently visible before the flip
    // Back face: the page that will be revealed after the flip
    let frontPage: PageData | null;
    let backPage: PageData | null;
    let frontSide: 'left' | 'right';
    let backSide: 'left' | 'right';

    if (flipDirection === 'forward') {
      frontPage = pages[currentPage * 2 + 1] ?? null;      // current right page
      backPage = pages[(currentPage + 1) * 2] ?? null;      // next left page
      frontSide = 'right';
      backSide = 'left';
    } else {
      frontPage = pages[currentPage * 2] ?? null;            // current left page
      backPage = pages[(currentPage - 1) * 2 + 1] ?? null;   // prev right page
      frontSide = 'left';
      backSide = 'right';
    }

    const bend = Math.sin(flipProgress * Math.PI);

    return (
      <div style={getFlipContainerStyle()}>
        {/* Front face */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          overflow: 'hidden',
          borderRadius: flipDirection === 'forward' ? '0 4px 4px 0' : '4px 0 0 4px',
        }}>
          {renderPage(frontPage, frontSide)}
          {/* Darkening as page turns away */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `rgba(0,0,0,${flipProgress * 0.15})`,
            pointerEvents: 'none',
          }} />
        </div>

        {/* Back face (rotated 180deg so it faces the other way) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          overflow: 'hidden',
          borderRadius: flipDirection === 'forward' ? '4px 0 0 4px' : '0 4px 4px 0',
        }}>
          {renderPage(backPage, backSide)}
          {/* Slight brightening as page reveals */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `rgba(255,255,255,${(1 - flipProgress) * 0.08})`,
            pointerEvents: 'none',
          }} />
        </div>

        {/* Edge highlight along the spine edge during flip */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          width: '3px',
          [flipDirection === 'forward' ? 'left' : 'right']: 0,
          background: `linear-gradient(to bottom, rgba(255,240,200,${bend * 0.2}), rgba(200,180,140,${bend * 0.1}))`,
          boxShadow: `0 0 ${Math.round(bend * 8)}px rgba(0,0,0,${bend * 0.3})`,
          pointerEvents: 'none',
          zIndex: 2,
        }} />
      </div>
    );
  };

  if (pages.length === 0) {
    return (
      <div className="nb-overlay" onClick={onClose}>
        <div className="nb-container" onClick={e => e.stopPropagation()}>
          <button className="nb-close" onClick={onClose}>x</button>
          <div className="nb-book">
            <div className="nb-spine" />
            {renderPage(null, 'left')}
            {renderPage(null, 'right')}
          </div>
          <div className="nb-empty-msg">No notes yet. Start taking notes during your engagement.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="nb-overlay" onClick={onClose}>
      <div className="nb-container" onClick={e => e.stopPropagation()}>
        <button className="nb-close" onClick={onClose}>x</button>

        {currentPage > 0 && !isFlipping && (
          <button className="nb-nav nb-nav-left" onClick={() => flip('backward')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {currentPage < totalSpreads - 1 && !isFlipping && (
          <button className="nb-nav nb-nav-right" onClick={() => flip('forward')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        <div className="nb-book" style={{ perspective: '2000px' }}>
          <div className="nb-spine" />

          {/* Left page */}
          <div
            onClick={!isFlipping && currentPage > 0 ? () => flip('backward') : undefined}
            style={{ flex: 1, display: 'flex', position: 'relative', opacity: isFlipping && flipDirection === 'backward' && flipProgress < 0.5 ? 0.6 : 1 }}
          >
            {renderPage(leftPage, 'left')}
          </div>

          {/* Right page */}
          <div
            onClick={!isFlipping && currentPage < totalSpreads - 1 ? () => flip('forward') : undefined}
            style={{ flex: 1, display: 'flex', position: 'relative', opacity: isFlipping && flipDirection === 'forward' && flipProgress < 0.5 ? 0.6 : 1 }}
          >
            {renderPage(rightPage, 'right')}
          </div>

          {/* Shadow on underlying page during flip */}
          {renderUnderpageShadow()}

          {/* The two-sided flipping page */}
          {renderFlipPage()}
        </div>

        <div className="nb-indicator">
          {currentPage + 1} / {totalSpreads}
        </div>
      </div>
    </div>
  );
};

export default NotebookViewer;
