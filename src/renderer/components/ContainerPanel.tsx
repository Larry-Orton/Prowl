import React, { useState, useEffect, useCallback } from 'react';
import type { ContainerStatus, ContainerRuntime, VPNStatus } from '@shared/types';

interface ContainerPanelProps {
  onClose: () => void;
}

const ContainerPanel: React.FC<ContainerPanelProps> = ({ onClose }) => {
  const [runtime, setRuntime] = useState<ContainerRuntime>(null);
  const [status, setStatus] = useState<ContainerStatus>('not_installed');
  const [vpnStatus, setVpnStatus] = useState<VPNStatus>({ connected: false });
  const [vpnFiles, setVpnFiles] = useState<string[]>([]);
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isConnectingVPN, setIsConnectingVPN] = useState(false);

  const refresh = useCallback(async () => {
    const rt = await window.electronAPI.container.detectRuntime();
    setRuntime(rt);
    const st = await window.electronAPI.container.getStatus();
    setStatus(st);
    if (st === 'running') {
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

  const handleBuild = useCallback(async () => {
    setIsBuilding(true);
    setBuildLog([]);
    const unsub = window.electronAPI.container.onBuildProgress((line) => {
      setBuildLog(prev => [...prev.slice(-100), line]);
    });
    try {
      await window.electronAPI.container.buildImage();
      await refresh();
    } catch (err) {
      setBuildLog(prev => [...prev, `ERROR: ${err}`]);
    } finally {
      setIsBuilding(false);
      unsub();
    }
  }, [refresh]);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    try {
      await window.electronAPI.container.start();
      await refresh();
    } catch (err) {
      console.error('Failed to start container:', err);
    } finally {
      setIsStarting(false);
    }
  }, [refresh]);

  const handleStop = useCallback(async () => {
    await window.electronAPI.container.stop();
    await refresh();
  }, [refresh]);

  const handleUploadVPN = useCallback(async () => {
    const filename = await window.electronAPI.vpn.selectFile();
    if (filename) {
      await refresh();
    }
  }, [refresh]);

  const handleConnectVPN = useCallback(async (filename: string) => {
    setIsConnectingVPN(true);
    try {
      await window.electronAPI.vpn.connect(filename);
      // Poll for status
      setTimeout(async () => {
        const vs = await window.electronAPI.vpn.getStatus();
        setVpnStatus(vs);
        setIsConnectingVPN(false);
      }, 4000);
    } catch {
      setIsConnectingVPN(false);
    }
  }, []);

  const handleDisconnectVPN = useCallback(async () => {
    await window.electronAPI.vpn.disconnect();
    const vs = await window.electronAPI.vpn.getStatus();
    setVpnStatus(vs);
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="container-panel" onClick={(e) => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">Kali Environment</span>
          <button className="theme-picker-close" onClick={onClose}>×</button>
        </div>

        <div className="container-panel-body">
          {/* Runtime Detection */}
          <div className="cp-section">
            <div className="cp-label">Container Runtime</div>
            {runtime ? (
              <div className="cp-status-row">
                <span className="cp-dot ready" />
                <span>{runtime} detected</span>
              </div>
            ) : (
              <div className="cp-status-row">
                <span className="cp-dot off" />
                <span>No Docker or Podman found</span>
              </div>
            )}
          </div>

          {/* Container Status */}
          <div className="cp-section">
            <div className="cp-label">Kali Container</div>
            {status === 'not_installed' && (
              <div className="cp-info">Install Docker or Podman to use the Kali environment.</div>
            )}
            {status === 'no_image' && (
              <>
                <div className="cp-info">Kali image not built yet. This will download and configure a pentesting environment (~2-4 GB).</div>
                <button className="btn-accent" onClick={handleBuild} disabled={isBuilding} style={{ marginTop: 8 }}>
                  {isBuilding ? 'Building...' : 'Build Kali Image'}
                </button>
                {buildLog.length > 0 && (
                  <div className="cp-build-log">
                    {buildLog.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}
              </>
            )}
            {status === 'stopped' && (
              <div className="cp-status-row">
                <span className="cp-dot off" />
                <span>Stopped</span>
                <button className="btn-accent" onClick={handleStart} disabled={isStarting} style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 11 }}>
                  {isStarting ? 'Starting...' : 'Start'}
                </button>
              </div>
            )}
            {status === 'running' && (
              <div className="cp-status-row">
                <span className="cp-dot ready" />
                <span>Running</span>
                <button className="btn-secondary" onClick={handleStop} style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 11 }}>
                  Stop
                </button>
              </div>
            )}
          </div>

          {/* VPN */}
          {status === 'running' && (
            <div className="cp-section">
              <div className="cp-label">VPN Connection</div>
              <div className="cp-status-row" style={{ marginBottom: 8 }}>
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

              {/* VPN Files */}
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
                    </button>
                  ))}
                </div>
              )}

              <button className="export-btn" onClick={handleUploadVPN} style={{ marginTop: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload .ovpn file
              </button>
            </div>
          )}

          {/* Hint */}
          {status === 'running' && (
            <div className="cp-hint">
              Open a <strong>Kali</strong> tab to use the pentesting environment. Your workspace is mounted at <code>/workspace</code>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContainerPanel;
