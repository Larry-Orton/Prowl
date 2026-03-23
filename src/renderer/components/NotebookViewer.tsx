import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Note } from '@shared/types';
import { buildNotebookPages } from '../lib/notebookLayout';

interface NotebookViewerProps {
  notes: Note[];
  notebookTitle?: string;
  onClose: () => void;
}

const NotebookViewer: React.FC<NotebookViewerProps> = ({ notes, notebookTitle, onClose }) => {
  const pages = useMemo(
    () => buildNotebookPages(notes, notebookTitle || 'Prowl Field Notebook'),
    [notes, notebookTitle]
  );

  const [spreadIndex, setSpreadIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState<'forward' | 'backward' | null>(null);

  const totalSpreads = Math.max(1, Math.ceil(pages.length / 2));

  useEffect(() => {
    setSpreadIndex((value) => Math.min(value, totalSpreads - 1));
  }, [totalSpreads]);

  const handleNextPage = useCallback(() => {
    if (spreadIndex >= totalSpreads - 1 || isFlipping) return;
    setIsFlipping('forward');
    setTimeout(() => {
      setSpreadIndex((value) => value + 1);
      setIsFlipping(null);
    }, 240);
  }, [isFlipping, spreadIndex, totalSpreads]);

  const handlePrevPage = useCallback(() => {
    if (spreadIndex <= 0 || isFlipping) return;
    setIsFlipping('backward');
    setTimeout(() => {
      setSpreadIndex((value) => value - 1);
      setIsFlipping(null);
    }, 240);
  }, [isFlipping, spreadIndex]);

  const leftPage = pages[spreadIndex * 2] ?? null;
  const rightPage = pages[spreadIndex * 2 + 1] ?? null;

  const renderEmptyPage = (side: 'left' | 'right') => (
    <div className={`nb-page ${side}`}>
      <div className="nb-page-inner">
        <div className="nb-page-header">
          <span className="nb-page-title">{notebookTitle || 'Prowl Field Notebook'}</span>
          <span className="nb-page-date">Ready for notes</span>
        </div>
        <div className="nb-page-divider" />
        <div className="nb-page-content flow" style={{ userSelect: 'text' }}>
          {side === 'left' && notes.length === 0 ? (
            <div className="nb-page-empty">
              <div className="nb-empty-icon">~</div>
              <div>No notes yet</div>
              <div className="nb-empty-hint">Type <em>note &lt;text&gt;</em> or open a notebook in the terminal.</div>
            </div>
          ) : null}
        </div>
        <div className="nb-page-footer">
          <span className="nb-page-source">FIELD NOTES</span>
          <span className="nb-page-number">{spreadIndex * 2 + (side === 'left' ? 1 : 2)}</span>
        </div>
      </div>
    </div>
  );

  const renderPage = (side: 'left' | 'right') => {
    const page = side === 'left' ? leftPage : rightPage;
    if (!page) {
      return renderEmptyPage(side);
    }

    return (
      <div
        className={`nb-page ${side}`}
        onClick={side === 'right' ? handleNextPage : handlePrevPage}
      >
        <div className="nb-page-inner">
          <div className="nb-page-header">
            <span className="nb-page-title">{page.headerTitle}</span>
            <span className="nb-page-date">{page.dateLabel || 'Organized view'}</span>
          </div>
          <div className="nb-page-divider" />
          <div className="nb-page-content flow" style={{ userSelect: 'text' }}>
            {page.lines.map((line) => (
              <div key={line.id} className={`nb-line ${line.tone}`}>
                {line.text}
              </div>
            ))}
          </div>
          <div className="nb-page-footer">
            <span className="nb-page-source">{page.sourceLabel}</span>
            <span className="nb-page-number">{spreadIndex * 2 + (side === 'left' ? 1 : 2)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="nb-overlay" onClick={onClose}>
      <div className="nb-container" onClick={(event) => event.stopPropagation()}>
        <button className="nb-close" onClick={onClose}>x</button>

        {spreadIndex > 0 && (
          <button className="nb-nav nb-nav-left" onClick={handlePrevPage}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {spreadIndex < totalSpreads - 1 && (
          <button className="nb-nav nb-nav-right" onClick={handleNextPage}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        <div className={`nb-book ${isFlipping === 'forward' ? 'flip-forward' : isFlipping === 'backward' ? 'flip-backward' : ''}`}>
          <div className="nb-spine" />
          {renderPage('left')}
          {renderPage('right')}
        </div>

        <div className="nb-indicator">
          {spreadIndex + 1} / {totalSpreads}
        </div>
      </div>
    </div>
  );
};

export default NotebookViewer;
