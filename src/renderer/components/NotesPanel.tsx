import React, { useState, useCallback } from 'react';
import { Note } from '@shared/types';
import { QUICK_COMMANDS, CRITICAL_PORTS } from '@shared/constants';
import { useSessionStore } from '../store/sessionStore';
import { useNotesStore } from '../store/notesStore';

interface NotesPanelProps {
  notes: Note[];
  selectedNoteId: string | null;
  searchQuery: string;
  onSelectNote: (id: string | null) => void;
  onSearchChange: (query: string) => void;
  onDeleteNote: (id: string) => void;
  onQuickCommand: (cmd: string) => void;
  onExportNotes: () => void;
}

const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  selectedNoteId,
  searchQuery,
  onSelectNote,
  onSearchChange,
  onDeleteNote,
  onQuickCommand,
  onExportNotes,
}) => {
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const context = useSessionStore(s => s.context);
  const activeNotebookId = useNotesStore(s => s.activeNotebookId);
  const activeNotebookName = useNotesStore(s => s.activeNotebookName);
  const setActiveNotebook = useNotesStore(s => s.setActiveNotebook);

  const handleNoteClick = useCallback((note: Note) => {
    if (selectedNoteId === note.id) {
      setViewingNote(note);
    } else {
      onSelectNote(note.id);
    }
  }, [selectedNoteId, onSelectNote]);

  const handleBackFromDetail = useCallback(() => {
    setViewingNote(null);
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isHighRisk = (port: number) => CRITICAL_PORTS.includes(port);

  const sourceIcon = (source: string) => {
    switch (source) {
      case 'ai': return '◆';
      case 'terminal': return '▸';
      default: return '●';
    }
  };

  if (viewingNote) {
    return (
      <div className="panel-inner">
        <div className="panel-section">
          <button className="back-btn" onClick={handleBackFromDetail}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
        </div>
        <div className="note-detail">
          <div className="note-detail-title">{viewingNote.title}</div>
          <div className="note-detail-meta">
            <span className={`source-dot ${viewingNote.source}`}>{sourceIcon(viewingNote.source)}</span>
            {viewingNote.source} · {formatDate(viewingNote.createdAt)}
          </div>
          <div className="note-detail-content">{viewingNote.content}</div>
          <button
            className="btn-danger"
            onClick={() => { onDeleteNote(viewingNote.id); setViewingNote(null); }}
          >
            Delete Note
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-inner">
      {/* Search */}
      <div className="panel-section">
        <div className="search-wrapper">
          <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Active Target */}
      <div className="panel-section">
        <div className="section-label">TARGET</div>
        <div className="target-card">
          {context.primaryTarget ? (
            <>
              <div className="target-ip">{context.primaryTarget}</div>
              {context.discoveredPorts.length > 0 && (
                <div className="port-tags">
                  {context.discoveredPorts.slice(0, 10).map(port => (
                    <span key={port} className={`port-tag ${isHighRisk(port) ? 'critical' : ''}`}>
                      {port}
                    </span>
                  ))}
                  {context.discoveredPorts.length > 10 && (
                    <span className="port-tag more">+{context.discoveredPorts.length - 10}</span>
                  )}
                </div>
              )}
              {context.discoveredPorts.length === 0 && (
                <div className="target-hint">No ports discovered</div>
              )}
            </>
          ) : (
            <div className="target-empty">
              <span className="target-empty-icon">⊘</span>
              <span>No target — type <code>target &lt;ip&gt;</code></span>
            </div>
          )}
        </div>
      </div>

      {/* Active Notebook */}
      {activeNotebookName && (
        <div className="panel-section notebook-indicator">
          <div className="notebook-active">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span className="notebook-name">{activeNotebookName}</span>
            <button
              className="notebook-close-btn"
              onClick={() => setActiveNotebook(null, null)}
              title="Close notebook"
            >
              ×
            </button>
          </div>
          <div className="notebook-hint">AI maintains this notebook. Your raw notes stay separate.</div>
        </div>
      )}

      {/* Notes */}
      <div className="panel-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="section-label" style={{ flexShrink: 0 }}>
          NOTES
          <span className="section-count">{notes.length}</span>
        </div>
        <div className="notes-scroll">
          {notes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◇</div>
              <div>No notes yet</div>
              <div className="empty-hint">type <code>note &lt;text&gt;</code></div>
            </div>
          ) : (
            notes.map((note, i) => (
              <div
                key={note.id}
                className={`note-item ${note.id === selectedNoteId ? 'selected' : ''} ${note.id === activeNotebookId ? 'active-notebook' : ''}`}
                onClick={() => handleNoteClick(note)}
              >
                <div className="note-item-header">
                  <span className={`source-dot ${note.source}`}>{sourceIcon(note.source)}</span>
                  <span className="note-item-title">{note.title}</span>
                  <button
                    className="note-delete-btn"
                    onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                    title="Delete note"
                  >
                    ×
                  </button>
                </div>
                <div className="note-item-preview">{note.content.slice(0, 55)}{note.content.length > 55 ? '...' : ''}</div>
                <div className="note-item-date">
                  <span className="note-index">#{i + 1}</span>
                  {formatDate(note.updatedAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Commands */}
      <div className="panel-section panel-footer">
        <div className="section-label">TOOLS</div>
        <div className="quick-grid">
          {QUICK_COMMANDS.map(qc => (
            <button
              key={qc.label}
              className="quick-btn"
              onClick={() => onQuickCommand(qc.cmd)}
              title={qc.description}
            >
              {qc.label}
            </button>
          ))}
        </div>
        <button className="export-btn" onClick={onExportNotes}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export .md
        </button>
      </div>
    </div>
  );
};

export default NotesPanel;
