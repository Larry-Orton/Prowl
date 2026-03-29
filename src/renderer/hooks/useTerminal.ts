import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useSessionStore } from '../store/sessionStore';
import { useThemeStore } from '../store/themeStore';
import { WELCOME_BANNER } from '@shared/constants';
import { KeywordAction, parseKeywordCommand } from '@shared/terminalKeywords';

interface UseTerminalOptions {
  tabId: string;
  shellType?: 'local' | 'kali';
  terminalTitle: string;
  containerRef: React.RefObject<HTMLDivElement>;
  onKeywordCommand: (action: KeywordAction) => void;
  onCommandRun: (cmd: string) => void;
  onOutput: (data: string) => void;
  onCommandComplete?: (command: string, output: string) => void;
  onLinkClick?: (url: string) => void;
}

function detectPromptReturn(output: string, shellType: 'local' | 'kali'): boolean {
  const lines = output
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-4);

  if (lines.length === 0) {
    return false;
  }

  const recent = lines.join('\n');

  if (shellType === 'local' && /(?:^|\n)PS [^\n]*>\s*$/m.test(recent)) {
    return true;
  }

  return (
    /(?:^|\n).*└─[#>$]\s*$/m.test(recent)
    || /(?:^|\n)[^\n]*[#$>]\s*$/m.test(recent)
  );
}

// ── Hook ──────────────────────────────────────────

export function useTerminal({
  tabId,
  shellType = 'local',
  terminalTitle,
  containerRef,
  onKeywordCommand,
  onCommandRun: _onCommandRun,
  onOutput,
  onCommandComplete,
  onLinkClick,
}: UseTerminalOptions) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);
  const outputBufferRef = useRef('');
  const outputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputBufferRef = useRef('');
  const lastCommandRef = useRef('');
  const commandStartRowRef = useRef(-1);
  const inputEscapeStateRef = useRef<'none' | 'esc' | 'csi' | 'ss3'>('none');

  const parseAndUpdateFromOutput = useSessionStore(s => s.parseAndUpdateFromOutput);
  const recordTerminalOutput = useSessionStore(s => s.recordTerminalOutput);
  const setLastCommandOutput = useSessionStore(s => s.setLastCommandOutput);
  const currentTheme = useThemeStore(s => s.currentTheme);

  const writeToTerminal = useCallback((data: string) => {
    termRef.current?.write(data);
  }, []);

  const runCommand = useCallback((cmd: string) => {
    if (!termRef.current) return;
    window.electronAPI.shell.write(tabId, cmd + '\r');
  }, [tabId]);

  const resize = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current || !containerRef.current) return;
    if (containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
      return;
    }
    try {
      fitAddonRef.current.fit();
      const { cols, rows } = termRef.current;
      window.electronAPI.shell.resize(tabId, cols, rows);
    } catch {
      // Ignore resize errors during init
    }
  }, [tabId]);

  const trackInputData = useCallback((data: string) => {
    let buf = inputBufferRef.current;
    let escapeState = inputEscapeStateRef.current;

    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const code = ch.charCodeAt(0);

      if (escapeState === 'esc') {
        if (ch === '[') {
          escapeState = 'csi';
        } else if (ch === 'O') {
          escapeState = 'ss3';
        } else {
          escapeState = 'none';
        }
        continue;
      }

      if (escapeState === 'csi') {
        if (code >= 64 && code <= 126) {
          escapeState = 'none';
        }
        continue;
      }

      if (escapeState === 'ss3') {
        escapeState = 'none';
        continue;
      }

      if (ch === '\r' || ch === '\n') {
        const trimmed = buf.trim();
        if (trimmed && !parseKeywordCommand(buf)) {
          _onCommandRun(trimmed);
          lastCommandRef.current = trimmed;
          // Record cursor row so we know where this command's output starts
          const t = termRef.current;
          if (t?.buffer?.active) {
            commandStartRowRef.current = t.buffer.active.cursorY + t.buffer.active.baseY;
          }
        }
        buf = '';
      } else if (ch === '\x1b') {
        escapeState = 'esc';
      } else if (ch === '\x7f') {
        buf = buf.slice(0, -1);
      } else if (ch === '\x03' || ch === '\x15') {
        buf = '';
      } else if (code >= 32 && code < 127) {
        buf += ch;
      }
    }

    inputBufferRef.current = buf;
    inputEscapeStateRef.current = escapeState;
  }, [_onCommandRun]);

  const prefillTerminalInput = useCallback((text: string) => {
    const normalized = text.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
    if (!normalized) {
      return;
    }
    trackInputData(normalized);
    window.electronAPI.shell.write(tabId, normalized);
    termRef.current?.focus();
  }, [tabId, trackInputData]);

  useEffect(() => {
    if (!containerRef.current) return;
    inputBufferRef.current = '';
    inputEscapeStateRef.current = 'none';

    const term = new Terminal({
      theme: currentTheme.terminal,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: false,
      scrollback: 5000,
      smoothScrollDuration: 0,
      rightClickSelectsWord: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon((_event, url) => {
      if (onLinkClick) {
        onLinkClick(url);
      } else {
        window.open(url, '_blank');
      }
    });

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let cancelled = false;
    let isOpened = false;

    // Wait until container has real dimensions before opening xterm
    const openWhenReady = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) return;
      if (el.offsetWidth === 0 || el.offsetHeight === 0) {
        requestAnimationFrame(openWhenReady);
        return;
      }

      try {
        term.open(el);
        isOpened = true;
      } catch (err) {
        console.error('Failed to open terminal:', err);
        return;
      }

      term.focus();

      setTimeout(() => {
        if (cancelled) return;
        try { fitAddon.fit(); } catch { /* ignore */ }
        const { cols, rows } = term;
        term.write(WELCOME_BANNER);
        window.electronAPI.shell.spawn(tabId, shellType).then(() => {
          if (cancelled) return;
          try {
            window.electronAPI.shell.resize(tabId, cols, rows);
          } catch { /* ignore */ }
          term.focus();
        }).catch((err: unknown) => {
          console.error('Failed to spawn shell:', err);
          term.write('\r\n\x1b[31mFailed to start shell. Check your environment.\x1b[0m\r\n');
        });
      }, 50);
    };

    requestAnimationFrame(openWhenReady);

    const readCommandOutput = (): string => {
      if (!term.buffer?.active) return '';
      const buf = term.buffer.active;
      const endRow = buf.cursorY + buf.baseY;
      // Read from where the command was entered, or last 50 lines as fallback
      const startRow = commandStartRowRef.current >= 0
        ? commandStartRowRef.current
        : Math.max(0, endRow - 50);
      const lines: string[] = [];
      for (let i = startRow; i <= endRow; i++) {
        const line = buf.getLine(i);
        if (line) lines.push(line.translateToString(true));
      }
      return lines.join('\n').trim();
    };

    const flushOutputBuffer = () => {
      const buf = outputBufferRef.current;
      if (!buf) {
        return;
      }

      parseAndUpdateFromOutput(buf);
      recordTerminalOutput(tabId, shellType, terminalTitle, buf);
      setLastCommandOutput(buf);

      // Notify App that a command finished with its output — use clean rendered text
      const cmd = lastCommandRef.current;
      if (cmd && onCommandComplete) {
        const cleanOutput = readCommandOutput();
        onCommandComplete(cmd, cleanOutput);
        lastCommandRef.current = '';
      }

      outputBufferRef.current = '';

      if (outputTimerRef.current) {
        clearTimeout(outputTimerRef.current);
        outputTimerRef.current = null;
      }
    };

    // ── PTY Data Handler ──────────────────────────
    const unsubData = window.electronAPI.shell.onData((id: string, data: string) => {
      if (id !== tabId) return;
      term.write(data);

      outputBufferRef.current += data;
      onOutput(data);

      if (outputTimerRef.current) {
        clearTimeout(outputTimerRef.current);
      }

      if (detectPromptReturn(outputBufferRef.current, shellType)) {
        flushOutputBuffer();
        return;
      }

      outputTimerRef.current = setTimeout(flushOutputBuffer, 500);
    });

    if (typeof unsubData === 'function') {
      cleanupRef.current.push(unsubData);
    }

    // ── Copy/Paste ─────────────────────────────────
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true;

      // Ctrl+C: copy if selection, otherwise interrupt
      if (e.ctrlKey && !e.shiftKey && e.key === 'c') {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection());
          term.clearSelection();
          return false;
        }
        return true;
      }

      // Ctrl+V / Ctrl+Shift+V: paste
      if ((e.ctrlKey && !e.shiftKey && e.key === 'v') ||
          (e.ctrlKey && e.shiftKey && e.key === 'V')) {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.readText().then(text => {
          if (text) {
            prefillTerminalInput(text);
          }
        });
        return false;
      }

      // Ctrl+Shift+C: copy
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection());
          term.clearSelection();
        }
        return false;
      }

      // Ctrl+L: clear
      if (e.ctrlKey && e.key === 'l') {
        term.clear();
        return true;
      }

      return true;
    });

    // ── Right-click: copy selection or paste ──────
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection());
        term.clearSelection();
      } else {
        navigator.clipboard.readText().then(text => {
          if (text) {
            prefillTerminalInput(text);
          }
        });
      }
    };
    containerRef.current?.addEventListener('contextmenu', handleContextMenu);
    cleanupRef.current.push(() => {
      containerRef.current?.removeEventListener('contextmenu', handleContextMenu);
    });

    // ── User Input Handler ────────────────────────
    // Forward all input to main process shell manager which handles keyword
    // detection and PTY writes. Track input locally for command history.
    const dataDisposable = term.onData((data: string) => {
      trackInputData(data);
      window.electronAPI.shell.write(tabId, data);
    });

    cleanupRef.current.push(() => dataDisposable.dispose());

    const handlePrefillEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ tabId?: string; data?: string }>).detail;
      if (!detail || detail.tabId !== tabId || typeof detail.data !== 'string') {
        return;
      }
      prefillTerminalInput(detail.data);
    };

    window.addEventListener('prowl:terminal-prefill', handlePrefillEvent as EventListener);
    cleanupRef.current.push(() => {
      window.removeEventListener('prowl:terminal-prefill', handlePrefillEvent as EventListener);
    });

    // ── Keyword Actions from Main Process ─────────
    const unsubKeyword = window.electronAPI.shell.onKeywordAction((id: string, action: KeywordAction) => {
      if (id !== tabId) return;
      onKeywordCommand(action);
    });

    if (typeof unsubKeyword === 'function') {
      cleanupRef.current.push(unsubKeyword);
    }

    // ── Resize Observer ───────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      if (!isOpened) return;
      if (!containerRef.current || containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
        return;
      }
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        window.electronAPI.shell.resize(tabId, cols, rows);
      } catch {
        // ignore — terminal may not be ready
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    cleanupRef.current.push(() => resizeObserver.disconnect());

    // ── Cleanup ───────────────────────────────────
    return () => {
      cancelled = true;
      flushOutputBuffer();
      if (outputTimerRef.current) {
        clearTimeout(outputTimerRef.current);
      }
      for (const fn of cleanupRef.current) {
        try { fn(); } catch { /* ignore cleanup errors */ }
      }
      cleanupRef.current = [];
      try { term.dispose(); } catch { /* ignore */ }
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [tabId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    writeToTerminal,
    runCommand,
    resize,
    term: termRef,
  };
}
