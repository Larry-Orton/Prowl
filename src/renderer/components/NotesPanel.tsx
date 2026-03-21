import React, { useState, useCallback } from 'react';
import { Note } from '@shared/types';
import { QUICK_COMMANDS, CRITICAL_PORTS, HIGH_RISK_PORTS } from '@shared/constants';
import { useSessionStore } from '../store/sessionStore';

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

  if (viewingNote) {
    return (
      <div className="notes-panel-inner">
        <div className="panel-section">
          <div className="note-detail-back" onClick={handleBackFromDetail}>
            ← Back
          </div>
        </div>
        <div className="note-detail">
          <div className="note-detail-title">{viewingNote.title}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>
            {formatDate(viewingNote.createdAt)} · <span style={{
              color: viewingNote.source === 'ai' ? 'var(--accent2)' :
                     viewingNote.source === 'terminal' ? 'var(--green)' : 'var(--text3)'
            }}>{viewingNote.source}</span>
          </div>
          <div className="note-detail-content">{viewingNote.content}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              className="ai-save-btn"
              onClick={() => onDeleteNote(viewingNote.id)}
              style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-panel-inner">
      {/* Search */}
      <div className="panel-section">
        <input
          className="search-input"
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Active Target */}
      <div className="panel-section">
        <div className="panel-section-title">Active Target</div>
        <div className="target-card">
          {context.primaryTarget ? (
            <>
              <div className="target-ip">{context.primaryTarget}</div>
              {context.discoveredPorts.length > 0 && (
                <div className="port-tags">
                  {context.discoveredPorts.slice(0, 12).map(port => (
                    <span
                      key={port}
                      className={`port-tag ${isHighRisk(port) ? 'high-risk' : ''}`}
                    >
                      {port}
                    </span>
                  ))}
                  {context.discoveredPorts.length > 12 && (
                    <span className="port-tag" style={{ color: 'var(--text3)' }}>
                      +{context.discoveredPorts.length - 12}
                    </span>
                  )}
                </div>
              )}
              {context.discoveredPorts.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  No ports discovered yet
                </div>
              )}
            </>
          ) : (
            <div className="target-ip-placeholder">
              No target set<br />
              <span style={{ fontSize: 10 }}>type: target &lt;ip&gt;</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes List */}
      <div className="notes-list" style={{ flex: 1 }}>
        {notes.length === 0 ? (
          <div className="notes-empty">
            No notes yet<br />
            type <code style={{ fontSize: 10, background: 'var(--bg3)', padding: '1px 4px', borderRadius: 3 }}>note &lt;text&gt;</code><br />
            to add a note
          </div>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              className={`note-item ${note.id === selectedNoteId ? 'selected' : ''}`}
              onClick={() => handleNoteClick(note)}
            >
              <div className="note-item-title">{note.title}</div>
              <div className="note-item-preview">
                {note.content.slice(0, 60)}{note.content.length > 60 ? '…' : ''}
              </div>
              <div className="note-item-meta">
                <span className={`note-source-badge ${note.source}`}>
                  {note.source}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>
                  {formatDate(note.updatedAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Commands */}
      <div className="quick-commands">
        <div className="panel-section-title" style={{ marginBottom: 6 }}>Quick Commands</div>
        <div className="quick-cmd-grid">
          {QUICK_COMMANDS.map(qc => (
            <button
              key={qc.label}
              className="quick-cmd-btn"
              onClick={() => onQuickCommand(qc.cmd)}
              title={qc.description}
            >
              {qc.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="ai-save-btn"
            onClick={onExportNotes}
            style={{ fontSize: 10 }}
          >
            Export .md
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="panel-hint">
        type <strong>note &lt;text&gt;</strong> to add<br />
        <strong>add last nmap</strong> to AI-summarize
      </div>
    </div>
  );
};

export default NotesPanel;
