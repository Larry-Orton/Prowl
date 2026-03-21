import React, { useCallback } from 'react';
import { useTerminalStore } from '../store/terminalStore';

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
    // Only drag on the titlebar background itself (not buttons/tabs)
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
    <div className="titlebar" onMouseDown={handleTitlebarMouseDown}>
      {/* macOS traffic lights */}
      <div className="titlebar-traffic">
        <button
          className="traffic-btn traffic-close"
          onClick={handleClose}
          title="Close"
          aria-label="Close"
        />
        <button
          className="traffic-btn traffic-minimize"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize"
        />
        <button
          className="traffic-btn traffic-maximize"
          onClick={handleMaximize}
          title="Maximize"
          aria-label="Maximize"
        />
      </div>

      {/* Tabs */}
      <div className="titlebar-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={(e) => handleTabClick(tab.id, e)}
          >
            <span style={{ fontSize: 10, opacity: 0.5 }}>⬡</span>
            <span>{tab.title}</span>
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
        <button
          className="tab-add-btn"
          onClick={handleAddTab}
          title="New terminal"
        >
          +
        </button>
      </div>

      {/* Right section */}
      <div className="titlebar-right">
        <button
          className={`panel-toggle-btn ${showNotes ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleNotes(); }}
          title="Toggle notes panel"
        >
          <span style={{ fontSize: 11 }}>📋</span>
          Notes
        </button>
        <button
          className={`panel-toggle-btn ${showAI ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleAI(); }}
          title="Toggle AI panel"
        >
          <span style={{ fontSize: 11 }}>✦</span>
          AI
        </button>
        <span className="titlebar-brand">PROWL</span>
      </div>
    </div>
  );
};

export default TitleBar;
