import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTerminalStore } from '../store/terminalStore';
import ThemePicker from './ThemePicker';
import ContainerPanel from './ContainerPanel';
import VPNPanel from './VPNPanel';
import WorkspacePanel from './WorkspacePanel';
import NotebookViewer from './NotebookViewer';
import FindingsPanel from './FindingsPanel';
import TimelinePanel, { TimelineItem } from './TimelinePanel';
import type { ContainerStatus, VPNStatus } from '@shared/types';
import { useNotesStore } from '../store/notesStore';
import { useFindingsStore } from '../store/findingsStore';

const kaliLogoUrl = new URL('../assets/kali_logo.png', import.meta.url).href;

interface TitleBarProps {
  showNotes: boolean;
  showAI: boolean;
  showBrowser: boolean;
  isSplitLayout: boolean;
  currentEngagementName?: string;
  missionModeLabel: string;
  openWorkspaceRequest?: number;
  openFindingsRequest?: number;
  openTimelineRequest?: number;
  onToggleNotes: () => void;
  onToggleAI: () => void;
  onToggleBrowser: () => void;
  onToggleSplit: () => void;
  onOpenEngagements: () => void;
  onOpenMissionModes: () => void;
  onOpenCommandPalette: () => void;
  onRunCommand: (cmd: string) => void;
  onOpenFindingBrowser: (url: string) => void;
  onSaveFindingNote: (content: string) => void;
  timelineItems: TimelineItem[];
  onOpenTimelineAI: (prompt: string) => void;
  onOpenTimelineBrowser: (url: string) => void;
  onOpenTimelineNote: (noteId: string) => void;
}

const TitleBar: React.FC<TitleBarProps> = ({
  showNotes,
  showAI,
  showBrowser,
  isSplitLayout,
  currentEngagementName,
  missionModeLabel,
  openWorkspaceRequest = 0,
  openFindingsRequest = 0,
  openTimelineRequest = 0,
  onToggleNotes,
  onToggleAI,
  onToggleBrowser,
  onToggleSplit,
  onOpenEngagements,
  onOpenMissionModes,
  onOpenCommandPalette,
  onRunCommand,
  onOpenFindingBrowser,
  onSaveFindingNote,
  timelineItems,
  onOpenTimelineAI,
  onOpenTimelineBrowser,
  onOpenTimelineNote,
}) => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, renameTab } = useTerminalStore();
  const allNotes = useNotesStore(s => s.notes);
  const activeNotebookId = useNotesStore(s => s.activeNotebookId);
  const findings = useFindingsStore(s => s.findings);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showContainerPanel, setShowContainerPanel] = useState(false);
  const [showVPNPanel, setShowVPNPanel] = useState(false);
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
  const [showFindings, setShowFindings] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showNewTabMenu, setShowNewTabMenu] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabValue, setEditingTabValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>('not_installed');
  const [vpnStatus, setVpnStatus] = useState<VPNStatus>({ connected: false });
  const newTabMenuRef = useRef<HTMLDivElement>(null);

  const notebookNote = useMemo(() => {
    if (activeNotebookId) {
      return allNotes.find((note) => note.id === activeNotebookId) ?? null;
    }

    return allNotes.find((note) => note.tags.includes('ai-canonical')) ?? null;
  }, [activeNotebookId, allNotes]);

  // Poll container & VPN status
  useEffect(() => {
    const poll = async () => {
      try {
        const st = await window.electronAPI.container.getStatus();
        setContainerStatus(st);
        if (st === 'running' || st === 'update_available') {
          const vs = await window.electronAPI.vpn.getStatus();
          setVpnStatus(vs);
        } else {
          setVpnStatus({ connected: false });
        }
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close new tab menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newTabMenuRef.current && !newTabMenuRef.current.contains(e.target as Node)) {
        setShowNewTabMenu(false);
      }
    };
    if (showNewTabMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewTabMenu]);

  useEffect(() => {
    if (openWorkspaceRequest > 0) {
      setShowWorkspacePanel(true);
    }
  }, [openWorkspaceRequest]);

  useEffect(() => {
    if (openFindingsRequest > 0) {
      setShowFindings(true);
    }
  }, [openFindingsRequest]);

  useEffect(() => {
    if (openTimelineRequest > 0) {
      setShowTimeline(true);
    }
  }, [openTimelineRequest]);

  const handleClose = useCallback(() => window.electronAPI.window.close(), []);
  const handleMinimize = useCallback(() => window.electronAPI.window.minimize(), []);
  const handleMaximize = useCallback(() => window.electronAPI.window.maximize(), []);

  const handleAddTab = useCallback((type: 'local' | 'kali') => {
    addTab(type);
    setShowNewTabMenu(false);
  }, [addTab]);

  const handleTabClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab(id);
  }, [setActiveTab]);

  const handleTabClose = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length > 1) removeTab(id);
  }, [tabs.length, removeTab]);

  // Focus and select text when editing a tab
  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  // Drag is handled natively by -webkit-app-region: drag in CSS.
  // Double-click titlebar to maximize/restore.
  const handleTitlebarDoubleClick = useCallback(() => {
    window.electronAPI.window.maximize();
  }, []);

  return (
    <>
      <div className="titlebar" onDoubleClick={handleTitlebarDoubleClick}>
        <div className="titlebar-traffic">
          <button className="traffic-btn traffic-close" onClick={handleClose} aria-label="Close" />
          <button className="traffic-btn traffic-minimize" onClick={handleMinimize} aria-label="Minimize" />
          <button className="traffic-btn traffic-maximize" onClick={handleMaximize} aria-label="Maximize" />
        </div>

        <div className="titlebar-brand">
          <span className="brand-mark">&lt;Pr&gt;</span>
          <span className="brand-text">PROWL</span>
        </div>

        <div className="titlebar-tabs">
          {tabs.map((tab, i) => (
            <div
              key={tab.id}
              className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={(e) => handleTabClick(tab.id, e)}
            >
              <span className={`tab-index ${tab.shellType === 'kali' ? 'kali' : ''}`}>
                {tab.shellType === 'kali' ? 'K' : (i + 1)}
              </span>
              {editingTabId === tab.id ? (
                <input
                  ref={editInputRef}
                  className="tab-label-edit"
                  value={editingTabValue}
                  onChange={(e) => setEditingTabValue(e.target.value)}
                  onBlur={() => {
                    const trimmed = editingTabValue.trim();
                    if (trimmed) renameTab(tab.id, trimmed);
                    setEditingTabId(null);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      const trimmed = editingTabValue.trim();
                      if (trimmed) renameTab(tab.id, trimmed);
                      setEditingTabId(null);
                    } else if (e.key === 'Escape') {
                      setEditingTabId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span
                  className="tab-label"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTabId(tab.id);
                    setEditingTabValue(tab.title);
                  }}
                >{tab.title}</span>
              )}
              {tabs.length > 1 && (
                <button className="tab-close" onClick={(e) => handleTabClose(tab.id, e)} title="Close tab">×</button>
              )}
            </div>
          ))}
          {/* New tab button with dropdown */}
          <div style={{ position: 'relative' }} ref={newTabMenuRef}>
            <button
              className="tab-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowNewTabMenu(v => !v);
              }}
              title="New terminal"
            >
              +
            </button>
            {showNewTabMenu && (
              <div className="new-tab-menu" style={{
                top: (newTabMenuRef.current?.getBoundingClientRect().bottom ?? 42) + 4,
                left: newTabMenuRef.current?.getBoundingClientRect().left ?? 0,
              }}>
                <button className="new-tab-option" onClick={() => handleAddTab('local')}>
                  <span className="new-tab-icon">▸</span>
                  Local Shell
                </button>
                <button
                  className="new-tab-option kali"
                  onClick={() => handleAddTab('kali')}
                  disabled={containerStatus !== 'running' && containerStatus !== 'update_available'}
                >
                  <span className="new-tab-icon">K</span>
                  Kali Terminal
                  {containerStatus !== 'running' && containerStatus !== 'update_available' && <span className="new-tab-hint">(not running)</span>}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Drag spacer — this is the area users grab to move the window */}
        <div className="titlebar-drag-spacer" />

        <div className="titlebar-right">
          {/* VPN indicator */}
          <div
            className={`vpn-indicator ${vpnStatus.connected ? 'connected' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowVPNPanel(true); }}
            title={vpnStatus.connected ? `VPN: ${vpnStatus.ip}` : 'VPN disconnected'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>

          {/* Container status — Kali dragon logo */}
          <button
            className={`titlebar-btn ${containerStatus === 'running' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowContainerPanel(true); }}
            title={`Kali: ${containerStatus}`}
          >
            <img src={kaliLogoUrl} alt="Kali" className="kali-btn-logo" />
          </button>

          {/* Workspace files */}
          <button
            className="titlebar-btn"
            onClick={(e) => { e.stopPropagation(); onOpenCommandPalette(); }}
            title="Command palette"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/><path d="M4 6h10"/><path d="M4 12h6"/><path d="M4 18h10"/></svg>
          </button>
          <button
            className="titlebar-btn"
            onClick={(e) => { e.stopPropagation(); onOpenEngagements(); }}
            title={currentEngagementName ? `Engagement: ${currentEngagementName}` : 'Engagements'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M12 4h9"/><path d="M4 9h16"/><path d="M4 15h16"/><path d="M8 4v16"/></svg>
          </button>
          <button
            className="titlebar-btn"
            onClick={(e) => { e.stopPropagation(); onOpenMissionModes(); }}
            title={`Mission mode: ${missionModeLabel}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h7"/><path d="M14 6h7"/><path d="M14 18h7"/><circle cx="10" cy="12" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="12" cy="18" r="2"/></svg>
          </button>
          <button
            className={`titlebar-btn ${isSplitLayout ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSplit(); }}
            title={isSplitLayout ? 'Disable split terminals' : 'Enable split terminals'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/></svg>
          </button>

          <button
            className="titlebar-btn"
            onClick={(e) => { e.stopPropagation(); setShowWorkspacePanel(true); }}
            title="Loot manager"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button
            className="titlebar-btn"
            onClick={(e) => { e.stopPropagation(); setShowFindings(true); }}
            title="Findings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </button>
          <button
            className="titlebar-btn"
            onClick={(e) => { e.stopPropagation(); setShowTimeline(true); }}
            title="Mission timeline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </button>

          <div className="titlebar-divider" />

          <button className={`titlebar-btn ${showNotes ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleNotes(); }} title="Notes Panel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </button>
          <button className="titlebar-btn" onClick={(e) => { e.stopPropagation(); setShowNotebook(true); }} title="Open Notebook">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </button>
          <button className={`titlebar-btn ${showAI ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleAI(); }} title="AI">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </button>
          <button className={`titlebar-btn ${showBrowser ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleBrowser(); }} title="Browser">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </button>

          <div className="titlebar-divider" />

          <button className="titlebar-btn" onClick={(e) => { e.stopPropagation(); setShowThemePicker(true); }} title="Theme">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          </button>
        </div>
      </div>

      {showThemePicker && <ThemePicker onClose={() => setShowThemePicker(false)} />}
      {showContainerPanel && <ContainerPanel onClose={() => setShowContainerPanel(false)} />}
      {showVPNPanel && <VPNPanel onClose={() => setShowVPNPanel(false)} />}
      {showWorkspacePanel && <WorkspacePanel onClose={() => setShowWorkspacePanel(false)} />}
      {showFindings && (
        <FindingsPanel
          findings={findings}
          onClose={() => setShowFindings(false)}
          onRunCommand={onRunCommand}
          onOpenBrowser={onOpenFindingBrowser}
          onSaveToNotes={onSaveFindingNote}
        />
      )}
      {showTimeline && (
        <TimelinePanel
          items={timelineItems}
          onClose={() => setShowTimeline(false)}
          onRunCommand={onRunCommand}
          onOpenAI={onOpenTimelineAI}
          onOpenBrowser={onOpenTimelineBrowser}
          onOpenNote={onOpenTimelineNote}
        />
      )}
      {showNotebook && (
        <NotebookViewer
          notebook={notebookNote}
          notebookTitle={currentEngagementName ? `${currentEngagementName} Notebook` : 'Prowl Field Notebook'}
          allNotes={allNotes}
          onClose={() => setShowNotebook(false)}
        />
      )}
    </>
  );
};

export default TitleBar;
