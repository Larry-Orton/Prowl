import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Note, Engagement } from '@shared/types';
import { TOOL_COMMANDS, ToolCommand } from '@shared/constants';
import { useSessionStore } from '../store/sessionStore';

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
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('recon');
  const [openNotebookId, setOpenNotebookId] = useState<string | null>(null);
  const [notebookContent, setNotebookContent] = useState('');

  const ip = context.primaryTarget || '';
  const hostname = currentEngagement?.hostname || ip;
  const url = hostname ? `http://${hostname}` : '';

  // Substitute placeholders in tool commands
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

  // Scan workspace for all target directories that have notebook.md
  const [notebooks, setNotebooks] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const scan = async () => {
      try {
        const files = await window.electronAPI.workspace.listFiles();
        const dirs = files.filter(f => f.isDirectory).map(f => f.name);
        const withNotebooks: { id: string; label: string }[] = [];
        for (const dir of dirs) {
          const nb = await window.electronAPI.workspace.readFile(`/workspace/${dir}/notebook.md`);
          if (nb) withNotebooks.push({ id: dir, label: dir });
        }
        setNotebooks(withNotebooks);
      } catch { /* ignore */ }
    };
    scan();
    const interval = setInterval(scan, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load notebook.md when opening a notebook
  useEffect(() => {
    if (!openNotebookId) {
      setNotebookContent('');
      return;
    }
    window.electronAPI.workspace.readFile(`/workspace/${openNotebookId}/notebook.md`)
      .then(content => setNotebookContent(content || `# ${openNotebookId} Notebook\n\nStart taking notes here...\n`))
      .catch(() => setNotebookContent(`# ${openNotebookId} Notebook\n\nStart taking notes here...\n`));
  }, [openNotebookId]);

  // Save notebook on change (debounced)
  useEffect(() => {
    if (!openNotebookId || !notebookContent) return;
    const timer = setTimeout(() => {
      window.electronAPI.workspace.writeFile(`/workspace/${openNotebookId}/notebook.md`, notebookContent);
    }, 1000);
    return () => clearTimeout(timer);
  }, [notebookContent, openNotebookId]);

  // If notebook is open, show the editable notebook view
  if (openNotebookId) {
    return (
      <div className="panel-inner">
        <div className="panel-section" style={{ flexShrink: 0 }}>
          <button
            className="back-btn"
            onClick={() => setOpenNotebookId(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: '4px 0', fontSize: 12 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back to shelf
          </button>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginTop: 4 }}>
            {openNotebookId} Journal
          </div>
        </div>
        <textarea
          className="notebook-editor"
          value={notebookContent}
          onChange={(e) => setNotebookContent(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            width: '100%',
            background: 'var(--bg0)',
            color: 'var(--text1)',
            border: 'none',
            outline: 'none',
            resize: 'none',
            padding: '12px 14px',
            fontSize: 12,
            fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
            lineHeight: 1.6,
            overflow: 'auto',
          }}
        />
      </div>
    );
  }

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
            <div className="target-empty">
              <span>No target set</span>
            </div>
          )}
        </div>
      </div>

      {/* Tool categories */}
      <div className="panel-section" style={{ flexShrink: 0 }}>
        <div className="section-label">TOOLS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {CATEGORY_ORDER.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 700,
                border: activeCategory === cat ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 4,
                cursor: 'pointer',
                background: activeCategory === cat ? 'var(--accent)' : 'var(--bg2)',
                color: activeCategory === cat ? 'white' : 'var(--text2)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto', maxHeight: '40vh' }}>
          {filteredTools.map(tool => (
            <button
              key={tool.id}
              className="tool-cmd-btn"
              onClick={() => {
                if (!ip) return;
                onPrefillTerminal(fillCommand(tool.cmd));
              }}
              disabled={!ip}
              title={tool.description + (ip ? `\n${fillCommand(tool.cmd)}` : '\nSet a target first')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: ip ? 'var(--text1)' : 'var(--text3)',
                cursor: ip ? 'pointer' : 'not-allowed',
                fontSize: 12,
                textAlign: 'left',
                opacity: ip ? 1 : 0.4,
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => { if (ip) { (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            >
              <span style={{ fontWeight: 700, minWidth: 85, color: ip ? 'var(--accent)' : 'var(--text3)', fontSize: 12 }}>{tool.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tool.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Notebook shelf */}
      <div className="panel-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="section-label" style={{ flexShrink: 0 }}>
          NOTEBOOKS
          <span className="section-count">{notebooks.length}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {notebooks.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>No notebooks yet</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', opacity: 0.6 }}>Set a target and run scans</div>
            </div>
          ) : (
            <div className="bookshelf" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '4px 0',
            }}>
              {notebooks.map(nb => (
                <div key={nb.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button
                    onClick={() => setOpenNotebookId(nb.id)}
                    className="notebook-spine"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: nb.id === ip ? 'linear-gradient(135deg, #4a3828, #5a4530)' : 'linear-gradient(135deg, #3a2e1e, #4a3828)',
                      border: nb.id === ip ? '1px solid rgba(200,170,100,0.4)' : '1px solid rgba(180,150,100,0.2)',
                      borderRadius: 3,
                      cursor: 'pointer',
                      color: '#e8dcc8',
                      fontSize: 12,
                      fontFamily: '"Georgia", serif',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 8px rgba(0,0,0,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.6 }}>
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nb.label}
                    </span>
                    {nb.id === ip && (
                      <span style={{ fontSize: 8, opacity: 0.5, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        active
                      </span>
                    )}
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete notebook for ${nb.label}?`)) {
                        await window.electronAPI.workspace.deleteFile(`/workspace/${nb.id}/notebook.md`);
                        setNotebooks(prev => prev.filter(n => n.id !== nb.id));
                      }
                    }}
                    style={{
                      background: 'none', border: 'none', color: 'rgba(200,150,100,0.4)',
                      cursor: 'pointer', padding: '4px 5px', fontSize: 12, lineHeight: 1,
                      flexShrink: 0,
                    }}
                    title={`Delete ${nb.label} notebook`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        <button className="export-btn" onClick={onExportNotes} style={{ flexShrink: 0, marginTop: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export .md
        </button>
      </div>
    </div>
  );
};

export default NotesPanel;
