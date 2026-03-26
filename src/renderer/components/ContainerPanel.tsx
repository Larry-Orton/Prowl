import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ContainerStatus, ContainerRuntime } from '@shared/types';
import { useProactiveEventStore } from '../store/proactiveEventStore';

const kaliLogoUrl = new URL('../assets/kali_logo.png', import.meta.url).href;

interface ContainerPanelProps {
  onClose: () => void;
}

const ContainerPanel: React.FC<ContainerPanelProps> = ({ onClose }) => {
  const emitEvent = useProactiveEventStore(s => s.emitEvent);
  const [runtime, setRuntime] = useState<ContainerRuntime>(null);
  const [status, setStatus] = useState<ContainerStatus>('not_installed');
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    const rt = await window.electronAPI.container.detectRuntime();
    setRuntime(rt);
    const st = await window.electronAPI.container.getStatus();
    if (!busyRef.current) setStatus(st);
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
      emitEvent({ type: 'container_running' });
    } catch (err) {
      console.error('Failed to start container:', err);
    } finally {
      setIsStarting(false);
    }
  }, [emitEvent, refresh]);

  const handleStop = useCallback(async () => {
    busyRef.current = true;
    setIsStopping(true);
    setStatus('stopped');
    try {
      await window.electronAPI.container.stop();
    } catch {
      // ignore
    }
    setIsStopping(false);
    // Small delay to let Docker finish cleanup before refreshing
    await new Promise(r => setTimeout(r, 2000));
    busyRef.current = false;
    await refresh();
  }, [refresh]);

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
                <button className="btn-accent kali-build-btn" onClick={handleBuild} disabled={isBuilding} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={kaliLogoUrl} alt="Kali" className="kali-build-logo" />
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
            {status === 'update_available' && (
              <>
                <div className="cp-status-row">
                  <span className="cp-dot ready" />
                  <span>Running</span>
                  <button className="btn-secondary" onClick={handleStop} disabled={isStopping} style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 11 }}>
                    {isStopping ? 'Stopping...' : 'Stop'}
                  </button>
                </div>
                <div className="cp-update-banner">
                  <span className="cp-dot warning" style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--amber)' }}>Update available</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>Stop container and rebuild to get the latest tools.</div>
                  </div>
                </div>
              </>
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

          {/* Hint */}
          {(status === 'running' || status === 'update_available') && (
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
