import React, { useState, useRef, useCallback, useEffect } from 'react';

interface BrowserPanelProps {
  socksPort: number;
  onPageContent?: (url: string, content: string) => void;
  initialUrl?: string;
  onInitialUrlHandled?: () => void;
  restoredUrl?: string;
  mode?: 'dock' | 'focus';
  onToggleMode?: () => void;
  onClose?: () => void;
  onCurrentUrlChange?: (url: string) => void;
}

const BrowserPanel: React.FC<BrowserPanelProps> = ({
  socksPort,
  onPageContent,
  initialUrl,
  onInitialUrlHandled,
  restoredUrl,
  mode = 'dock',
  onToggleMode,
  onClose,
  onCurrentUrlChange,
}) => {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const webviewRef = useRef<any>(null);

  const navigate = useCallback((targetUrl: string) => {
    let finalUrl = targetUrl.trim();
    if (!finalUrl) return;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'http://' + finalUrl;
    }
    setCurrentUrl(finalUrl);
    setUrl(finalUrl);
    onCurrentUrlChange?.(finalUrl);
  }, [onCurrentUrlChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      navigate(url);
    }
  }, [url, navigate]);

  const handleBack = useCallback(() => {
    webviewRef.current?.goBack();
  }, []);

  const handleForward = useCallback(() => {
    webviewRef.current?.goForward();
  }, []);

  const handleReload = useCallback(() => {
    webviewRef.current?.reload();
  }, []);

  const handleScanPage = useCallback(async () => {
    if (!currentUrl) return;
    try {
      const content = await window.electronAPI.browser.capturePageContent(currentUrl);
      onPageContent?.(currentUrl, content);
    } catch {
      // ignore
    }
  }, [currentUrl, onPageContent]);

  useEffect(() => {
    if (!initialUrl) return;
    navigate(initialUrl);
    onInitialUrlHandled?.();
  }, [initialUrl, navigate, onInitialUrlHandled]);

  useEffect(() => {
    if (currentUrl || !restoredUrl) return;
    navigate(restoredUrl);
  }, [currentUrl, navigate, restoredUrl]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !currentUrl) return;

    const onStartLoad = () => setIsLoading(true);
    const onStopLoad = () => {
      setIsLoading(false);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
      if (typeof webview.getURL === 'function') {
        onCurrentUrlChange?.(webview.getURL());
      }
    };
    const onNavigate = (e: any) => {
      setUrl(e.url);
      setCurrentUrl(e.url);
      onCurrentUrlChange?.(e.url);
    };

    webview.addEventListener('did-start-loading', onStartLoad);
    webview.addEventListener('did-stop-loading', onStopLoad);
    webview.addEventListener('did-navigate', onNavigate);
    webview.addEventListener('did-navigate-in-page', onNavigate);

    return () => {
      webview.removeEventListener('did-start-loading', onStartLoad);
      webview.removeEventListener('did-stop-loading', onStopLoad);
      webview.removeEventListener('did-navigate', onNavigate);
      webview.removeEventListener('did-navigate-in-page', onNavigate);
    };
  }, [currentUrl, onCurrentUrlChange]);

  return (
    <div className="browser-panel">
      {/* Browser toolbar */}
      <div className="browser-toolbar">
        <div className="browser-nav-btns">
          <button className="browser-nav-btn" onClick={handleBack} disabled={!canGoBack} title="Back">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button className="browser-nav-btn" onClick={handleForward} disabled={!canGoForward} title="Forward">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button className="browser-nav-btn" onClick={handleReload} title="Reload">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        <div className="browser-url-bar">
          <input
            className="browser-url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter target URL..."
            spellCheck={false}
          />
          {isLoading && <div className="browser-loading-bar" />}
        </div>
        <div className="browser-toolbar-actions">
          <button className="browser-scan-btn" onClick={handleScanPage} title="Send page to AI for attack-surface and business-logic analysis">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            AI Scan
          </button>
          <button
            className="browser-mode-btn"
            onClick={onToggleMode}
            title={mode === 'focus' ? 'Dock browser back into the workspace' : 'Pop browser into focused view'}
          >
            {mode === 'focus' ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
            )}
          </button>
          <button className="browser-mode-btn close" onClick={onClose} title="Close browser">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Webview */}
      {currentUrl ? (
        <webview
          ref={webviewRef}
          src={currentUrl}
          partition="persist:prowl-browser"
          className="browser-webview"
          // @ts-ignore - webview attributes
          allowpopups="false"
          style={{ flex: 1, width: '100%' }}
        />
      ) : (
        <div className="browser-empty">
          <div className="browser-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <div className="browser-empty-text">Enter a target URL to browse</div>
          <div className="browser-empty-hint">Traffic routes through the Kali container's network</div>
        </div>
      )}
    </div>
  );
};

export default BrowserPanel;
