import React, { useMemo, useState } from 'react';
import type { Finding } from '@shared/types';
import { getFindingMissionRelevance } from '../lib/missionMode';
import { useMissionModeStore } from '../store/missionModeStore';

interface FindingsPanelProps {
  findings: Finding[];
  onClose: () => void;
  onRunCommand: (cmd: string) => void;
  onOpenBrowser: (url: string) => void;
  onSaveToNotes: (content: string) => void;
}

const KIND_LABELS: Record<Finding['kind'], string> = {
  target: 'Target',
  port: 'Port',
  service: 'Service',
  url: 'URL',
  credential: 'Credential',
  vulnerability: 'Vulnerability',
  file: 'File',
  note: 'Note',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const FindingsPanel: React.FC<FindingsPanelProps> = ({
  findings,
  onClose,
  onRunCommand,
  onOpenBrowser,
  onSaveToNotes,
}) => {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | Finding['kind']>('all');
  const missionMode = useMissionModeStore(s => s.mode);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return findings
      .filter((finding) => {
        if (kindFilter !== 'all' && finding.kind !== kindFilter) {
          return false;
        }
        if (!q) return true;
        return (
          finding.title.toLowerCase().includes(q) ||
          finding.summary.toLowerCase().includes(q) ||
          finding.target.toLowerCase().includes(q) ||
          finding.tags.some(tag => tag.toLowerCase().includes(q))
        );
      })
      .map((finding) => ({
        finding,
        relevance: getFindingMissionRelevance(finding, missionMode.id),
      }))
      .sort((a, b) => (
        b.relevance - a.relevance
        || b.finding.updatedAt.localeCompare(a.finding.updatedAt)
      ));
  }, [findings, kindFilter, missionMode.id, query]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="findings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">Findings</span>
          <button className="theme-picker-close" onClick={onClose}>x</button>
        </div>

        <div className="findings-toolbar">
          <input
            className="search-input findings-search"
            type="text"
            placeholder="Search findings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="findings-select"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as 'all' | Finding['kind'])}
          >
            <option value="all">All kinds</option>
            {Object.entries(KIND_LABELS).map(([kind, label]) => (
              <option key={kind} value={kind}>{label}</option>
            ))}
          </select>
        </div>

        <div className="findings-mode-banner">
          <span className={`findings-mode-pill ${missionMode.id}`}>
            {missionMode.label}
          </span>
          <span className="findings-mode-text">{missionMode.reason}</span>
        </div>

        <div className="findings-list">
          {filtered.length === 0 ? (
            <div className="ws-empty">
              <div>No findings yet</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                Target, ports, services, and saved AI findings will appear here.
              </div>
            </div>
          ) : (
            filtered.map(({ finding, relevance }) => (
              <div key={finding.id} className={`finding-card ${relevance >= 80 ? 'relevant' : ''}`}>
                <div className="finding-card-header">
                  <div className="finding-kind">{KIND_LABELS[finding.kind]}</div>
                  <div className={`finding-confidence ${finding.confidence}`}>{finding.confidence}</div>
                </div>
                <div className="finding-title">{finding.title}</div>
                <div className="finding-summary">{finding.summary}</div>
                {relevance >= 80 && (
                  <div className="finding-relevance">Aligned with current mission mode</div>
                )}
                <div className="finding-meta">
                  <span>{finding.target || 'no target'}</span>
                  <span>{finding.source}</span>
                  <span>{formatDate(finding.updatedAt)}</span>
                </div>
                {finding.tags.length > 0 && (
                  <div className="finding-tags">
                    {finding.tags.map(tag => (
                      <span key={tag} className="finding-tag">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="finding-actions">
                  {finding.metadata.port && finding.target && (
                    <button
                      className="action-btn primary"
                      onClick={() => onRunCommand(`nmap -sV -p ${finding.metadata.port} ${finding.target}`)}
                    >
                      probe port
                    </button>
                  )}
                  {finding.kind === 'target' && finding.target && (
                    <button
                      className="action-btn primary"
                      onClick={() => onRunCommand(`nmap -Pn -p- --min-rate 1000 ${finding.target}`)}
                    >
                      scan target
                    </button>
                  )}
                  {(finding.kind === 'url' || finding.kind === 'service') && finding.target && (
                    <button
                      className="action-btn primary"
                      onClick={() => onOpenBrowser(finding.metadata.url || `http://${finding.target}`)}
                    >
                      open browser
                    </button>
                  )}
                  <button
                    className="action-btn"
                    onClick={() => onSaveToNotes(`${finding.title}\n\n${finding.summary}`)}
                  >
                    save note
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FindingsPanel;
