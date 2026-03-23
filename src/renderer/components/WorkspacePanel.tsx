import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { WorkspaceFile } from '@shared/types';
import { useProactiveEventStore } from '../store/proactiveEventStore';
import { useNotes } from '../hooks/useNotes';
import { useFindings } from '../hooks/useFindings';
import { useEngagementStore } from '../store/engagementStore';

interface WorkspacePanelProps {
  onClose: () => void;
}

type LootKind = 'all' | 'scan' | 'credentials' | 'screenshot' | 'web' | 'script' | 'archive' | 'other';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function classifyLoot(file: WorkspaceFile): Exclude<LootKind, 'all'> {
  const lower = file.name.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp)$/.test(lower)) return 'screenshot';
  if (/\.(zip|tar|gz|7z|rar)$/.test(lower)) return 'archive';
  if (/\.(py|sh|ps1|rb|js)$/.test(lower)) return 'script';
  if (/(hash|creds|credential|password|secrets|ntlm|sam|users)/.test(lower)) return 'credentials';
  if (/(burp|http|web|nikto|dir|ffuf|gobuster|ferox|routes|api|json|html)/.test(lower)) return 'web';
  if (/(nmap|masscan|enum4linux|scan|services|ports|recon|hosts)/.test(lower)) return 'scan';
  return 'other';
}

const WorkspacePanel: React.FC<WorkspacePanelProps> = ({ onClose }) => {
  const emitEvent = useProactiveEventStore(s => s.emitEvent);
  const currentEngagement = useEngagementStore(s =>
    s.engagements.find((engagement) => engagement.id === s.currentEngagementId) ?? null
  );
  const { quickSaveFromAI } = useNotes();
  const { saveFinding } = useFindings();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [currentPath, setCurrentPath] = useState(currentEngagement?.workspacePath || '/workspace');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [viewingFile, setViewingFile] = useState<{ file: WorkspaceFile; content: string } | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<LootKind>('all');
  const [loading, setLoading] = useState(true);
  const seenFilesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setCurrentPath(currentEngagement?.workspacePath || '/workspace');
    setPathHistory([]);
    setViewingFile(null);
  }, [currentEngagement?.workspacePath]);

  const loadFiles = useCallback(async (dirPath: string) => {
    setLoading(true);
    const result = await window.electronAPI.workspace.listFiles(dirPath);
    if (dirPath === (currentEngagement?.workspacePath || '/workspace')) {
      let latestNewFile: string | null = null;
      for (const file of result) {
        if (!seenFilesRef.current.has(file.path)) {
          seenFilesRef.current.add(file.path);
          if (file.type === 'file' && !file.name.startsWith('.')) {
            latestNewFile = file.name;
          }
        }
      }
      if (latestNewFile) {
        emitEvent({ type: 'workspace_loot_added', fileName: latestNewFile });
      }
    }
    setFiles(result);
    setLoading(false);
  }, [currentEngagement?.workspacePath, emitEvent]);

  useEffect(() => {
    loadFiles(currentPath);
    const interval = setInterval(() => loadFiles(currentPath), 5000);
    return () => clearInterval(interval);
  }, [currentPath, loadFiles]);

  const handleFileClick = useCallback(async (file: WorkspaceFile) => {
    if (file.type === 'directory') {
      setPathHistory(prev => [...prev, currentPath]);
      setCurrentPath(file.path);
    } else {
      const content = await window.electronAPI.workspace.readFile(file.path);
      if (content !== null) {
        setViewingFile({ file, content });
      }
    }
  }, [currentPath]);

  const handleBack = useCallback(() => {
    if (viewingFile) {
      setViewingFile(null);
      return;
    }
    if (pathHistory.length > 0) {
      const prev = pathHistory[pathHistory.length - 1];
      setPathHistory(h => h.slice(0, -1));
      setCurrentPath(prev);
    }
  }, [viewingFile, pathHistory]);

  const handleRefresh = useCallback(() => {
    loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return files.filter((file) => {
      const lootKind = classifyLoot(file);
      if (kindFilter !== 'all' && lootKind !== kindFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        file.name.toLowerCase().includes(normalizedQuery) ||
        file.path.toLowerCase().includes(normalizedQuery) ||
        lootKind.includes(normalizedQuery)
      );
    });
  }, [files, kindFilter, query]);

  const lootSummary = useMemo(() => {
    return files.reduce<Record<Exclude<LootKind, 'all'>, number>>((acc, file) => {
      const lootKind = classifyLoot(file);
      acc[lootKind] += 1;
      return acc;
    }, {
      scan: 0,
      credentials: 0,
      screenshot: 0,
      web: 0,
      script: 0,
      archive: 0,
      other: 0,
    });
  }, [files]);

  const handlePromoteFinding = useCallback(async (file: WorkspaceFile) => {
    const lootKind = classifyLoot(file);
    await saveFinding({
      kind: 'file',
      target: currentEngagement?.primaryTarget || '',
      title: `Loot: ${file.name}`,
      summary: `Captured ${lootKind} loot at ${file.path}.`,
      source: 'workspace',
      confidence: lootKind === 'credentials' ? 'high' : 'medium',
      tags: ['loot', lootKind],
      metadata: {
        path: file.path,
        category: lootKind,
      },
    });
  }, [currentEngagement?.primaryTarget, saveFinding]);

  const handleSaveLootNote = useCallback(async (file: WorkspaceFile, content?: string | null) => {
    const noteBody = content
      ? `Loot file: ${file.path}\n\n${content.slice(0, 4000)}`
      : `Loot file captured: ${file.path}`;
    await quickSaveFromAI(`Loot - ${file.name}`, noteBody);
  }, [quickSaveFromAI]);

  const breadcrumb = currentPath.split('/').filter(Boolean);

  if (viewingFile) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="workspace-panel" onClick={(e) => e.stopPropagation()}>
          <div className="container-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="ws-back-btn" onClick={handleBack} title="Back">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="container-panel-title">{viewingFile.file.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="action-btn primary" onClick={() => void handlePromoteFinding(viewingFile.file)}>
                promote finding
              </button>
              <button className="action-btn" onClick={() => void handleSaveLootNote(viewingFile.file, viewingFile.content)}>
                save note
              </button>
              <button className="theme-picker-close" onClick={onClose}>x</button>
            </div>
          </div>
          <div className="ws-file-viewer">
            <pre className="ws-file-content">{viewingFile.content}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="workspace-panel" onClick={(e) => e.stopPropagation()}>
        <div className="container-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {pathHistory.length > 0 && (
              <button className="ws-back-btn" onClick={handleBack} title="Back">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            <span className="container-panel-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: -2 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Loot Manager
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="ws-back-btn" onClick={handleRefresh} title="Refresh">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <button className="theme-picker-close" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="ws-breadcrumb">
          {breadcrumb.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="ws-breadcrumb-sep">/</span>}
              <span className="ws-breadcrumb-part">{part}</span>
            </React.Fragment>
          ))}
        </div>

        <div className="findings-mode-banner" style={{ paddingBottom: 10 }}>
          <span className="findings-mode-pill web">{currentEngagement?.name || 'Active Engagement'}</span>
          <span className="findings-mode-text">
            {Object.entries(lootSummary)
              .filter(([, count]) => count > 0)
              .map(([kind, count]) => `${kind}: ${count}`)
              .join(' • ') || 'No captured loot yet.'}
          </span>
        </div>

        <div className="findings-toolbar" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <input
            className="search-input findings-search"
            type="text"
            placeholder="Search loot..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="findings-select"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as LootKind)}
          >
            <option value="all">All loot</option>
            <option value="scan">Scans</option>
            <option value="credentials">Credentials</option>
            <option value="screenshot">Screenshots</option>
            <option value="web">Web</option>
            <option value="script">Scripts</option>
            <option value="archive">Archives</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="ws-file-list">
          {loading && filteredFiles.length === 0 && (
            <div className="ws-empty">Loading...</div>
          )}
          {!loading && filteredFiles.length === 0 && (
            <div className="ws-empty">
              <div style={{ fontSize: 24, marginBottom: 8 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>No loot yet</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                Save output with: <code>nmap -oN /workspace/scan.txt</code>
              </div>
            </div>
          )}
          {filteredFiles.map((file) => (
            <div
              key={file.path}
              className={`ws-file-item ${file.type}`}
              onClick={() => void handleFileClick(file)}
            >
              <div className="ws-file-icon">
                {file.type === 'directory' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--amber)" stroke="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                )}
              </div>
              <div className="ws-file-info">
                <span className="ws-file-name">{file.name}</span>
                <span className="ws-file-meta">
                  <span className="finding-tag">{classifyLoot(file)}</span>
                  {file.type === 'file' && ` ${formatSize(file.size)} • `}
                  {formatDate(file.modified)}
                </span>
              </div>
              {file.type === 'file' && (
                <>
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handlePromoteFinding(file);
                    }}
                    title="Promote to finding"
                  >
                    finding
                  </button>
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSaveLootNote(file);
                    }}
                    title="Save to notes"
                  >
                    note
                  </button>
                </>
              )}
              <button
                className="ws-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  window.electronAPI.workspace.deleteFile(file.path).then(() => loadFiles(currentPath));
                }}
                title="Delete"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkspacePanel;
