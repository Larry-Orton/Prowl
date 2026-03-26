import React, { useState, useEffect, useCallback } from 'react';
import type { ContainerStatus, VPNStatus } from '@shared/types';
import { useProactiveEventStore } from '../store/proactiveEventStore';

interface VPNPanelProps {
  onClose: () => void;
}

const VPNPanel: React.FC<VPNPanelProps> = ({ onClose }) => {
  const emitEvent = useProactiveEventStore(s => s.emitEvent);
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>('not_installed');
  const [vpnStatus, setVpnStatus] = useState<VPNStatus>({ connected: false });
  const [vpnFiles, setVpnFiles] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const refresh = useCallback(async () => {
    const st = await window.electronAPI.container.getStatus();
    setContainerStatus(st);
    if (st === 'running' || st === 'update_available') {
      const vs = await window.electronAPI.vpn.getStatus();
      setVpnStatus(vs);
      const files = await window.electronAPI.vpn.listFiles();
      setVpnFiles(files);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleConnect = useCallback(async (filename: string) => {
    setIsConnecting(true);
    try {
      // If already connected, disconnect first
      if (vpnStatus.connected) {
        await window.electronAPI.vpn.disconnect();
        await new Promise(r => setTimeout(r, 3000));
      }
      await window.electronAPI.vpn.connect(filename);
      // Poll for connection (openvpn takes a few seconds)
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const vs = await window.electronAPI.vpn.getStatus();
        setVpnStatus(vs);
        if (vs.connected) {
          emitEvent({ type: 'vpn_connected', ip: vs.ip });
          break;
        }
      }
    } catch {
      // ignore
    } finally {
      setIsConnecting(false);
    }
  }, [vpnStatus.connected, emitEvent]);

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await window.electronAPI.vpn.disconnect();
      // Poll until disconnected
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const vs = await window.electronAPI.vpn.getStatus();
        setVpnStatus(vs);
        if (!vs.connected) break;
      }
    } catch {
      // ignore
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  const handleDelete = useCallback(async (filename: string) => {
    // If this file is the active VPN, disconnect first
    if (vpnStatus.connected && vpnStatus.file === filename) {
      await handleDisconnect();
    }
    await window.electronAPI.vpn.deleteFile(filename);
    await refresh();
  }, [vpnStatus, handleDisconnect, refresh]);

  const handleUpload = useCallback(async () => {
    const filename = await window.electronAPI.vpn.selectFile();
    if (filename) {
      await refresh();
    }
  }, [refresh]);

  const isContainerRunning = containerStatus === 'running' || containerStatus === 'update_available';
  const isBusy = isConnecting || isDisconnecting;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="container-panel" onClick={(e) => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: -2 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            VPN Connection
          </span>
          <button className="theme-picker-close" onClick={onClose}>×</button>
        </div>

        <div className="container-panel-body">
          {!isContainerRunning ? (
            <div className="cp-section">
              <div className="cp-info">
                Start the Kali container first to use VPN. Click the Kali icon to manage the container.
              </div>
            </div>
          ) : (
            <>
              {/* Status */}
              <div className="cp-section">
                <div className="cp-label">Status</div>
                <div className="cp-status-row">
                  <span className={`cp-dot ${vpnStatus.connected ? 'ready' : 'off'}`} />
                  <span>
                    {isConnecting
                      ? 'Connecting...'
                      : isDisconnecting
                        ? 'Disconnecting...'
                        : vpnStatus.connected
                          ? `Connected${vpnStatus.ip ? ` — ${vpnStatus.ip}` : ''}${vpnStatus.file ? ` (${vpnStatus.file})` : ''}`
                          : 'Disconnected'}
                  </span>
                  {vpnStatus.connected && !isBusy && (
                    <button
                      className="btn-danger"
                      onClick={handleDisconnect}
                      style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 10 }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {/* VPN Files */}
              <div className="cp-section">
                <div className="cp-label">Configuration Files</div>
                {vpnFiles.length > 0 ? (
                  <div className="cp-vpn-files">
                    {vpnFiles.map(f => {
                      const isActive = vpnStatus.connected && vpnStatus.file === f;
                      return (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            className={`cp-vpn-file${isActive ? ' active' : ''}`}
                            onClick={() => !isActive && handleConnect(f)}
                            disabled={isBusy}
                            style={{ flex: 1 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            {f}
                            {isActive && (
                              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--accent)' }}>connected</span>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(f)}
                            disabled={isBusy}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text3)',
                              cursor: isBusy ? 'default' : 'pointer',
                              padding: '4px 6px',
                              fontSize: 14,
                              lineHeight: 1,
                              opacity: isBusy ? 0.3 : 0.6,
                            }}
                            title={`Delete ${f}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="cp-info">No VPN files uploaded yet.</div>
                )}
                <button className="export-btn" onClick={handleUpload} style={{ marginTop: 6 }} disabled={isBusy}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload .ovpn file
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VPNPanel;
