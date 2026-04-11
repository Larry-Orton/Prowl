import React, { useState, useEffect, useCallback, useRef } from 'react';

interface NotebookTabProps {
  target: string;
  isActive: boolean;
}

const NotebookTab: React.FC<NotebookTabProps> = ({ target, isActive }) => {
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notebook
  useEffect(() => {
    if (!target) return;
    window.electronAPI.workspace.readFile(`/workspace/${target}/notebook.md`)
      .then(c => { setContent(c || `# ${target}\n\n`); setLoaded(true); })
      .catch(() => { setContent(`# ${target}\n\n`); setLoaded(true); });
  }, [target]);

  // Auto-save
  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.electronAPI.workspace.writeFile(`/workspace/${target}/notebook.md`, newContent);
    }, 800);
  }, [target]);

  // Cleanup timer
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  if (!loaded) {
    return (
      <div style={{
        display: isActive ? 'flex' : 'none',
        flex: 1, alignItems: 'center', justifyContent: 'center',
        color: 'var(--text3)', fontSize: 12,
      }}>
        Loading notebook...
      </div>
    );
  }

  return (
    <div style={{
      display: isActive ? 'flex' : 'none',
      flex: 1, flexDirection: 'column',
      height: '100%', width: '100%',
      background: 'var(--bg0)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{target}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>notebook</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text3)', opacity: 0.5 }}>auto-saves</span>
      </div>

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: '16px 20px',
          fontSize: 14,
          lineHeight: 1.7,
          fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
          color: 'var(--text1)',
          background: 'var(--bg0)',
          overflow: 'auto',
          tabSize: 2,
        }}
      />
    </div>
  );
};

export default NotebookTab;
