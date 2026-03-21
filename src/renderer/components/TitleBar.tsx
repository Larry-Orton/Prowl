import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useTerminalStore } from '../store/terminalStore';
import ThemePicker from './ThemePicker';
import ContainerPanel from './ContainerPanel';
import type { ContainerStatus, VPNStatus } from '@shared/types';

interface TitleBarProps {
  showNotes: boolean;
  showAI: boolean;
  showBrowser: boolean;
  onToggleNotes: () => void;
  onToggleAI: () => void;
  onToggleBrowser: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({
  showNotes,
  showAI,
  showBrowser,
  onToggleNotes,
  onToggleAI,
  onToggleBrowser,
}) => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useTerminalStore();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showContainerPanel, setShowContainerPanel] = useState(false);
  const [showNewTabMenu, setShowNewTabMenu] = useState(false);
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>('not_installed');
  const [vpnStatus, setVpnStatus] = useState<VPNStatus>({ connected: false });
  const newTabMenuRef = useRef<HTMLDivElement>(null);

  // Poll container & VPN status
  useEffect(() => {
    const poll = async () => {
      try {
        const st = await window.electronAPI.container.getStatus();
        setContainerStatus(st);
        if (st === 'running') {
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

  const handleTitlebarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, .tab-item, .titlebar-tabs, .titlebar-traffic, .titlebar-right, .new-tab-menu')) return;
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
        <div className="titlebar-traffic">
          <button className="traffic-btn traffic-close" onClick={handleClose} aria-label="Close" />
          <button className="traffic-btn traffic-minimize" onClick={handleMinimize} aria-label="Minimize" />
          <button className="traffic-btn traffic-maximize" onClick={handleMaximize} aria-label="Maximize" />
        </div>

        <div className="titlebar-brand">
          <img src={new URL('../assets/logo.png', import.meta.url).href} alt="PROWL" className="brand-logo" />
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
              <span className="tab-label">{tab.title}</span>
              {tabs.length > 1 && (
                <button className="tab-close" onClick={(e) => handleTabClose(tab.id, e)} title="Close tab">×</button>
              )}
            </div>
          ))}
          {/* New tab button with dropdown */}
          <div style={{ position: 'relative' }} ref={newTabMenuRef}>
            <button
              className="tab-add-btn"
              onClick={(e) => { e.stopPropagation(); setShowNewTabMenu(v => !v); }}
              title="New terminal"
            >
              +
            </button>
            {showNewTabMenu && (
              <div className="new-tab-menu">
                <button className="new-tab-option" onClick={() => handleAddTab('local')}>
                  <span className="new-tab-icon">▸</span>
                  Local Shell
                </button>
                <button
                  className="new-tab-option kali"
                  onClick={() => handleAddTab('kali')}
                  disabled={containerStatus !== 'running'}
                >
                  <span className="new-tab-icon">K</span>
                  Kali Terminal
                  {containerStatus !== 'running' && <span className="new-tab-hint">(not running)</span>}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="titlebar-right">
          {/* VPN indicator */}
          <div
            className={`vpn-indicator ${vpnStatus.connected ? 'connected' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowContainerPanel(true); }}
            title={vpnStatus.connected ? `VPN: ${vpnStatus.ip}` : 'VPN disconnected'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>

          {/* Container status */}
          <button
            className={`titlebar-btn ${containerStatus === 'running' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowContainerPanel(true); }}
            title={`Kali: ${containerStatus}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </button>

          <div className="titlebar-divider" />

          <button className={`titlebar-btn ${showNotes ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleNotes(); }} title="Notes">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
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
    </>
  );
};

export default TitleBar;
