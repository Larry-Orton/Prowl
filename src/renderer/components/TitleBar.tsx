import React, { useCallback, useState } from 'react';
import { useTerminalStore } from '../store/terminalStore';
import ThemePicker from './ThemePicker';

interface TitleBarProps {
  showNotes: boolean;
  showAI: boolean;
  onToggleNotes: () => void;
  onToggleAI: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({
  showNotes,
  showAI,
  onToggleNotes,
  onToggleAI,
}) => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useTerminalStore();
  const [showThemePicker, setShowThemePicker] = useState(false);

  const handleClose = useCallback(() => {
    window.electronAPI.window.close();
  }, []);

  const handleMinimize = useCallback(() => {
    window.electronAPI.window.minimize();
  }, []);

  const handleMaximize = useCallback(() => {
    window.electronAPI.window.maximize();
  }, []);

  const handleAddTab = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    addTab();
  }, [addTab]);

  const handleTabClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab(id);
  }, [setActiveTab]);

  const handleTabClose = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length > 1) {
      removeTab(id);
    }
  }, [tabs.length, removeTab]);

  const handleTitlebarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, .tab-item, .titlebar-tabs, .titlebar-traffic, .titlebar-right')) return;
    if (e.button !== 0) return;
    const startX = e.screenX;
    const startY = e.screenY;
    const onMove = (me: MouseEvent) => {
      window.electronAPI.window.dragMove(me.screenX - startX, me.screenY - startY);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return (
    <>
      <div className="titlebar" onMouseDown={handleTitlebarMouseDown}>
        {/* Window controls */}
        <div className="titlebar-traffic">
          <button className="traffic-btn traffic-close" onClick={handleClose} aria-label="Close" />
          <button className="traffic-btn traffic-minimize" onClick={handleMinimize} aria-label="Minimize" />
          <button className="traffic-btn traffic-maximize" onClick={handleMaximize} aria-label="Maximize" />
        </div>

        {/* Brand */}
        <div className="titlebar-brand">
          <span className="brand-mark">P</span>
          <span className="brand-text">PROWL</span>
        </div>

        {/* Tabs */}
        <div className="titlebar-tabs">
          {tabs.map((tab, i) => (
            <div
              key={tab.id}
              className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={(e) => handleTabClick(tab.id, e)}
            >
              <span className="tab-index">{i + 1}</span>
              <span className="tab-label">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => handleTabClose(tab.id, e)}
                  title="Close tab"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button className="tab-add-btn" onClick={handleAddTab} title="New terminal">
            +
          </button>
        </div>

        {/* Right controls */}
        <div className="titlebar-right">
          <button
            className={`titlebar-btn ${showNotes ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleNotes(); }}
            title="Toggle notes"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </button>
          <button
            className={`titlebar-btn ${showAI ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleAI(); }}
            title="Toggle AI"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </button>
          <div className="titlebar-divider" />
          <button
            className="titlebar-btn"
            onClick={(e) => { e.stopPropagation(); setShowThemePicker(true); }}
            title="Change theme"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          </button>
        </div>
      </div>

      {showThemePicker && <ThemePicker onClose={() => setShowThemePicker(false)} />}
    </>
  );
};

export default TitleBar;
