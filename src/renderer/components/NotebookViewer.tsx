import React, { useState, useCallback } from 'react';
import { Note } from '@shared/types';

interface NotebookViewerProps {
  notes: Note[];
  onClose: () => void;
}

const NotebookViewer: React.FC<NotebookViewerProps> = ({ notes, onClose }) => {
  // Each "spread" shows 2 notes (left page + right page)
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState<'forward' | 'backward' | null>(null);

  const totalSpreads = Math.ceil(notes.length / 2);

  const handleNextPage = useCallback(() => {
    if (spreadIndex >= totalSpreads - 1 || isFlipping) return;
    setIsFlipping('forward');
    setTimeout(() => {
      setSpreadIndex(s => s + 1);
      setIsFlipping(null);
    }, 400);
  }, [spreadIndex, totalSpreads, isFlipping]);

  const handlePrevPage = useCallback(() => {
    if (spreadIndex <= 0 || isFlipping) return;
    setIsFlipping('backward');
    setTimeout(() => {
      setSpreadIndex(s => s - 1);
      setIsFlipping(null);
    }, 400);
  }, [spreadIndex, isFlipping]);

  const leftNote = notes[spreadIndex * 2] || null;
  const rightNote = notes[spreadIndex * 2 + 1] || null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderPage = (note: Note | null, side: 'left' | 'right') => {
    if (!note) {
      return (
        <div className={`nb-page ${side}`}>
          <div className="nb-page-inner">
            <div className="nb-page-empty">
              {side === 'left' && notes.length === 0 && (
                <>
                  <div className="nb-empty-icon">~</div>
                  <div>No notes yet</div>
                  <div className="nb-empty-hint">Type <em>note &lt;text&gt;</em> in the terminal</div>
                </>
              )}
            </div>
            <div className="nb-page-number">{spreadIndex * 2 + (side === 'left' ? 1 : 2)}</div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`nb-page ${side}`}
        onClick={side === 'right' ? handleNextPage : handlePrevPage}
      >
        <div className="nb-page-inner">
          <div className="nb-page-header">
            <span className="nb-page-title">{note.title}</span>
            <span className="nb-page-date">{formatDate(note.createdAt)}</span>
          </div>
          <div className="nb-page-divider" />
          <div className="nb-page-content" style={{ userSelect: 'text' }}>
            {note.content}
          </div>
          <div className="nb-page-footer">
            <span className="nb-page-source">{note.source}</span>
            <span className="nb-page-number">{spreadIndex * 2 + (side === 'left' ? 1 : 2)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="nb-overlay" onClick={onClose}>
      <div className="nb-container" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="nb-close" onClick={onClose}>x</button>

        {/* Navigation arrows */}
        {spreadIndex > 0 && (
          <button className="nb-nav nb-nav-left" onClick={handlePrevPage}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        {spreadIndex < totalSpreads - 1 && (
          <button className="nb-nav nb-nav-right" onClick={handleNextPage}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}

        {/* Notebook */}
        <div className={`nb-book ${isFlipping === 'forward' ? 'flip-forward' : isFlipping === 'backward' ? 'flip-backward' : ''}`}>
          {/* Spine */}
          <div className="nb-spine" />

          {/* Pages */}
          {renderPage(leftNote, 'left')}
          {renderPage(rightNote, 'right')}
        </div>

        {/* Page indicator */}
        <div className="nb-indicator">
          {spreadIndex + 1} / {Math.max(totalSpreads, 1)}
        </div>
      </div>
    </div>
  );
};

export default NotebookViewer;
