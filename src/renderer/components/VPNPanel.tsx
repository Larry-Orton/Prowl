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
  const [isConnectingVPN, setIsConnectingVPN] = useState(false);

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

  const handleConnectVPN = useCallback(async (filename: string) => {
    setIsConnectingVPN(true);
    try {
      await window.electronAPI.vpn.connect(filename);
      const vs = await window.electronAPI.vpn.getStatus();
      setVpnStatus(vs);
      if (vs.connected) {
        emitEvent({ type: 'vpn_connected', ip: vs.ip });
      }
    } catch {
      // ignore
    } finally {
      setIsConnectingVPN(false);
    }
  }, [emitEvent]);

  const handleUploadVPN = useCallback(async () => {
    const filename = await window.electronAPI.vpn.selectFile();
    if (filename) {
      await refresh();
      await handleConnectVPN(filename);
    }
  }, [refresh, handleConnectVPN]);

  const handleDisconnectVPN = useCallback(async () => {
    await window.electronAPI.vpn.disconnect();
    const vs = await window.electronAPI.vpn.getStatus();
    setVpnStatus(vs);
  }, []);

  const isContainerRunning = containerStatus === 'running' || containerStatus === 'update_available';

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
                    {vpnStatus.connected
                      ? `Connected${vpnStatus.ip ? ` — ${vpnStatus.ip}` : ''}`
                      : 'Disconnected'}
                  </span>
                  {vpnStatus.connected && (
                    <button className="btn-danger" onClick={handleDisconnectVPN} style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 10 }}>
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {/* VPN Files */}
              <div className="cp-section">
                <div className="cp-label">Configuration Files</div>
                {vpnFiles.length > 0 && !vpnStatus.connected && (
                  <div className="cp-vpn-files">
                    {vpnFiles.map(f => (
                      <button
                        key={f}
                        className="cp-vpn-file"
                        onClick={() => handleConnectVPN(f)}
                        disabled={isConnectingVPN}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        {f}
                        {isConnectingVPN && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text3)' }}>connecting...</span>}
                      </button>
                    ))}
                  </div>
                )}
                {vpnFiles.length === 0 && !vpnStatus.connected && (
                  <div className="cp-info">No VPN files uploaded yet.</div>
                )}
                <button className="export-btn" onClick={handleUploadVPN} style={{ marginTop: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
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
