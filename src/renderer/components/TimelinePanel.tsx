import React, { useMemo, useState } from 'react';

export interface TimelineItem {
  id: string;
  kind: 'command' | 'note' | 'finding' | 'ai' | 'event';
  title: string;
  summary: string;
  timestamp: string;
  target?: string;
  accent?: 'default' | 'accent' | 'green' | 'amber' | 'red';
  actionLabel?: string;
  actionPayload?: string;
  actionType?: 'command' | 'ai' | 'browser' | 'note';
}

interface TimelinePanelProps {
  items: TimelineItem[];
  onClose: () => void;
  onRunCommand: (cmd: string) => void;
  onOpenAI: (prompt: string) => void;
  onOpenBrowser: (url: string) => void;
  onOpenNote: (noteId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TimelinePanel: React.FC<TimelinePanelProps> = ({
  items,
  onClose,
  onRunCommand,
  onOpenAI,
  onOpenBrowser,
  onOpenNote,
}) => {
  const [filter, setFilter] = useState<'all' | TimelineItem['kind']>('all');

  const filtered = useMemo(() => {
    return items.filter(item => filter === 'all' || item.kind === filter);
  }, [filter, items]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="timeline-panel" onClick={(e) => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">Mission Timeline</span>
          <button className="theme-picker-close" onClick={onClose}>x</button>
        </div>

        <div className="findings-toolbar">
          <select
            className="findings-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | TimelineItem['kind'])}
          >
            <option value="all">All events</option>
            <option value="command">Commands</option>
            <option value="finding">Findings</option>
            <option value="note">Notes</option>
            <option value="ai">AI</option>
            <option value="event">Mission events</option>
          </select>
        </div>

        <div className="timeline-list">
          {filtered.length === 0 ? (
            <div className="ws-empty">
              <div>No timeline items yet</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                Commands, findings, notes, and AI activity will appear here.
              </div>
            </div>
          ) : (
            filtered.map(item => (
              <div key={item.id} className={`timeline-card ${item.accent ?? 'default'}`}>
                <div className="timeline-card-header">
                  <span className="timeline-kind">{item.kind}</span>
                  <span className="timeline-time">{formatDate(item.timestamp)}</span>
                </div>
                <div className="timeline-title">{item.title}</div>
                <div className="timeline-summary">{item.summary}</div>
                <div className="timeline-meta">
                  {item.target && <span>{item.target}</span>}
                </div>
                {(item.actionLabel && item.actionPayload) && (
                  <div className="timeline-actions">
                    <button
                      className="action-btn primary"
                      onClick={() => {
                        if (item.actionType === 'ai') {
                          onOpenAI(item.actionPayload!);
                        } else if (item.actionType === 'browser') {
                          onOpenBrowser(item.actionPayload!);
                        } else if (item.actionType === 'note') {
                          onOpenNote(item.actionPayload!);
                        } else {
                          onRunCommand(item.actionPayload!);
                        }
                      }}
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TimelinePanel;
