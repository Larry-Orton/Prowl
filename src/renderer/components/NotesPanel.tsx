import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Note, Engagement } from '@shared/types';
import { TOOL_COMMANDS, ToolCommand } from '@shared/constants';
import { useSessionStore } from '../store/sessionStore';
import { useTerminalStore } from '../store/terminalStore';

interface NotesPanelProps {
  notes: Note[];
  selectedNoteId: string | null;
  searchQuery: string;
  currentEngagement: Engagement | null;
  onSelectNote: (id: string | null) => void;
  onSearchChange: (query: string) => void;
  onDeleteNote: (id: string) => void;
  onQuickCommand: (cmd: string) => void;
  onExportNotes: () => void;
  onPrefillTerminal: (cmd: string) => void;
}

type ToolCategory = ToolCommand['category'];

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  recon: 'RECON',
  web: 'WEB',
  brute: 'BRUTE',
  exploit: 'EXPLOIT',
  post: 'LINUX',
  windows: 'WIN/AD',
  util: 'UTIL',
};

const CATEGORY_ORDER: ToolCategory[] = ['recon', 'web', 'brute', 'exploit', 'windows', 'post', 'util'];

const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  currentEngagement,
  onDeleteNote,
  onExportNotes,
  onPrefillTerminal,
}) => {
  const context = useSessionStore(s => s.context);
  const addTab = useTerminalStore(s => s.addTab);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('recon');
  const [openNotebookId, setOpenNotebookId] = useState<string | null>(null);
  const [notebookContent, setNotebookContent] = useState('');

  const ip = context.primaryTarget || '';
  const hostname = currentEngagement?.hostname || ip;
  const url = hostname ? `http://${hostname}` : '';

  const fillCommand = useCallback((cmd: string): string => {
    return cmd
      .replace(/\{IP\}/g, ip)
      .replace(/\{HOST\}/g, hostname)
      .replace(/\{URL\}/g, url);
  }, [ip, hostname, url]);

  const filteredTools = useMemo(() =>
    TOOL_COMMANDS.filter(t => t.category === activeCategory),
    [activeCategory]
  );

  // Scan workspace for notebooks
  const [notebooks, setNotebooks] = useState<{ id: string; label: string }[]>([]);
  const scanNotebooks = useCallback(async () => {
    try {
      const files = await window.electronAPI.workspace.listFiles();
      const dirs = files.filter(f => f.type === 'directory').map(f => f.name);
      const withNotebooks: { id: string; label: string }[] = [];
      for (const dir of dirs) {
        const nb = await window.electronAPI.workspace.readFile(`/workspace/${dir}/notebook.md`);
        if (nb !== null) withNotebooks.push({ id: dir, label: dir });
      }
      setNotebooks(withNotebooks);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    scanNotebooks();
    const interval = setInterval(scanNotebooks, 5000);
    return () => clearInterval(interval);
  }, [scanNotebooks]);

  useEffect(() => {
    if (ip) {
      const timer = setTimeout(scanNotebooks, 1500);
      return () => clearTimeout(timer);
    }
  }, [ip, scanNotebooks]);

  // Load notebook content
  useEffect(() => {
    if (!openNotebookId) { setNotebookContent(''); return; }
    window.electronAPI.workspace.readFile(`/workspace/${openNotebookId}/notebook.md`)
      .then(content => setNotebookContent(content || `# ${openNotebookId} Notebook\n\n`))
      .catch(() => setNotebookContent(`# ${openNotebookId} Notebook\n\n`));
  }, [openNotebookId]);

  // Auto-save
  useEffect(() => {
    if (!openNotebookId || !notebookContent) return;
    const timer = setTimeout(() => {
      window.electronAPI.workspace.writeFile(`/workspace/${openNotebookId}/notebook.md`, notebookContent);
    }, 1000);
    return () => clearTimeout(timer);
  }, [notebookContent, openNotebookId]);

  // ── NOTEBOOK EDITOR VIEW ──
  if (openNotebookId) {
    return (
      <div className="panel-inner" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', flexShrink: 0 }}>
          <button
            onClick={() => setOpenNotebookId(null)}
            style={{
              background: 'none', border: 'none', color: 'var(--text2)',
              cursor: 'pointer', padding: '2px 4px', fontSize: 14, display: 'flex',
              alignItems: 'center',
            }}
            title="Back to library"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {openNotebookId}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)' }}>Auto-saves as you type</div>
          </div>
        </div>
        <textarea
          value={notebookContent}
          onChange={(e) => setNotebookContent(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1, width: '100%', border: 'none', outline: 'none', resize: 'none',
            padding: '8px 4px', fontSize: 12, lineHeight: 1.6,
            fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
            color: 'var(--text1)', background: 'var(--bg0)',
            overflow: 'auto',
          }}
        />
      </div>
    );
  }

  // ── MAIN PANEL VIEW ──
  return (
    <div className="panel-inner">
      {/* Target info */}
      <div className="panel-section" style={{ flexShrink: 0 }}>
        <div className="section-label">TARGET</div>
        <div className="target-card">
          {ip ? (
            <>
              <div className="target-ip">{ip}</div>
              {hostname && hostname !== ip && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>{hostname}</div>
              )}
              {context.discoveredPorts.length > 0 && (
                <div className="port-tags">
                  {context.discoveredPorts.slice(0, 10).map(port => (
                    <span key={port} className="port-tag">{port}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="target-empty"><span>No target set</span></div>
          )}
        </div>
      </div>

      {/* Tools */}
      <div className="panel-section" style={{ flexShrink: 0 }}>
        <div className="section-label">TOOLS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {CATEGORY_ORDER.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 700,
                border: activeCategory === cat ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 4, cursor: 'pointer',
                background: activeCategory === cat ? 'var(--accent)' : 'var(--bg2)',
                color: activeCategory === cat ? 'white' : 'var(--text2)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto', maxHeight: '35vh' }}>
          {filteredTools.map(tool => (
            <button
              key={tool.id}
              onClick={() => { if (ip) onPrefillTerminal(fillCommand(tool.cmd)); }}
              disabled={!ip}
              title={tool.description + (ip ? `\n${fillCommand(tool.cmd)}` : '\nSet a target first')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 5,
                color: ip ? 'var(--text1)' : 'var(--text3)',
                cursor: ip ? 'pointer' : 'not-allowed',
                fontSize: 12, textAlign: 'left',
                opacity: ip ? 1 : 0.4, transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => { if (ip) { (e.currentTarget).style.background = 'var(--bg3)'; (e.currentTarget).style.borderColor = 'var(--accent)'; } }}
              onMouseLeave={(e) => { (e.currentTarget).style.background = 'var(--bg2)'; (e.currentTarget).style.borderColor = 'var(--border)'; }}
            >
              <span style={{ fontWeight: 700, minWidth: 85, color: ip ? 'var(--accent)' : 'var(--text3)', fontSize: 12 }}>{tool.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tool.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Library */}
      <div className="panel-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="section-label" style={{ flexShrink: 0 }}>
          LIBRARY
          <span className="section-count">{notebooks.length}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {notebooks.length === 0 ? (
            <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
              No notebooks yet. Set a target to start.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {notebooks.map(nb => {
                const isActive = nb.id === ip;
                return (
                  <div
                    key={nb.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 5,
                      background: isActive ? 'var(--accent-bg)' : 'var(--bg2)',
                      border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                    onClick={() => setOpenNotebookId(nb.id)}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget).style.background = 'var(--bg3)'; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget).style.background = 'var(--bg2)'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isActive ? 'var(--accent)' : 'var(--text3)'} strokeWidth="1.5" style={{ flexShrink: 0 }}>
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <span style={{
                      flex: 1, fontSize: 12, fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent)' : 'var(--text1)',
                      fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {nb.label}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: 8, color: 'var(--accent)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>
                        active
                      </span>
                    )}
                    {/* Open as full tab */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addTab('notebook', nb.id);
                      }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text3)',
                        cursor: 'pointer', padding: '2px 4px', fontSize: 11, lineHeight: 1,
                        opacity: 0.4, flexShrink: 0, borderRadius: 3,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget).style.opacity = '1'; (e.currentTarget).style.color = 'var(--accent)'; }}
                      onMouseLeave={(e) => { (e.currentTarget).style.opacity = '0.4'; (e.currentTarget).style.color = 'var(--text3)'; }}
                      title="Open in full tab"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Delete notebook for ${nb.label}?`)) {
                          await window.electronAPI.workspace.deleteFile(`/workspace/${nb.id}/notebook.md`);
                          setNotebooks(prev => prev.filter(n => n.id !== nb.id));
                        }
                      }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text3)',
                        cursor: 'pointer', padding: '2px 4px', fontSize: 14, lineHeight: 1,
                        opacity: 0.4, flexShrink: 0, borderRadius: 3,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget).style.opacity = '1'; (e.currentTarget).style.color = '#ef4444'; }}
                      onMouseLeave={(e) => { (e.currentTarget).style.opacity = '0.4'; (e.currentTarget).style.color = 'var(--text3)'; }}
                      title={`Delete ${nb.label} notebook`}
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button className="export-btn" onClick={onExportNotes} style={{ flexShrink: 0, marginTop: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export .md
        </button>
      </div>
    </div>
  );
};

export default NotesPanel;
