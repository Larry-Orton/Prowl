import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useSessionStore } from '../store/sessionStore';
import { useThemeStore } from '../store/themeStore';
import { WELCOME_BANNER } from '@shared/constants';

export type KeywordAction =
  | { type: 'target'; ip: string }
  | { type: 'note'; text: string }
  | { type: 'notes_add'; text: string }
  | { type: 'add_last'; tool: string }
  | { type: 'ask'; question: string }
  | { type: 'help' }
  | { type: 'search'; term: string }
  | { type: 'export_notes' }
  | { type: 'commands'; tool: string };

interface UseTerminalOptions {
  tabId: string;
  containerRef: React.RefObject<HTMLDivElement>;
  onKeywordCommand: (action: KeywordAction) => void;
  onCommandRun: (cmd: string) => void;
  onOutput: (data: string) => void;
}

export function useTerminal({
  tabId,
  containerRef,
  onKeywordCommand,
  onCommandRun,
  onOutput,
}: UseTerminalOptions) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lineBufferRef = useRef('');
  const cleanupRef = useRef<(() => void)[]>([]);
  const outputBufferRef = useRef('');
  const outputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseAndUpdateFromOutput = useSessionStore(s => s.parseAndUpdateFromOutput);
  const setLastCommandOutput = useSessionStore(s => s.setLastCommandOutput);
  const currentTheme = useThemeStore(s => s.currentTheme);

  const parseKeywordCommand = useCallback((line: string): KeywordAction | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const lower = trimmed.toLowerCase();

    if (lower.startsWith('target ')) {
      const ip = trimmed.slice(7).trim();
      if (ip) return { type: 'target', ip };
    }

    if (lower.startsWith('note ')) {
      const text = trimmed.slice(5).trim();
      if (text) return { type: 'note', text };
    }

    if (lower.startsWith('notes add ')) {
      const text = trimmed.slice(10).trim();
      if (text) return { type: 'notes_add', text };
    }

    if (lower.startsWith('add last ')) {
      const tool = trimmed.slice(9).trim();
      if (tool) return { type: 'add_last', tool };
    }

    if (lower.startsWith('ask ')) {
      const question = trimmed.slice(4).trim();
      if (question) return { type: 'ask', question };
    }

    if (lower === 'help' || lower === 'hack help') {
      return { type: 'help' };
    }

    if (lower.startsWith('search ')) {
      const term = trimmed.slice(7).trim();
      if (term) return { type: 'search', term };
    }

    if (lower === 'export notes') {
      return { type: 'export_notes' };
    }

    if (lower.startsWith('commands ')) {
      const tool = trimmed.slice(9).trim();
      if (tool) return { type: 'commands', tool };
    }

    return null;
  }, []);

  const writeToTerminal = useCallback((data: string) => {
    termRef.current?.write(data);
  }, []);

  const runCommand = useCallback((cmd: string) => {
    if (!termRef.current) return;
    // Write the command to pty
    window.electronAPI.shell.write(tabId, cmd + '\r');
  }, [tabId]);

  const resize = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current) return;
    try {
      fitAddonRef.current.fit();
      const { cols, rows } = termRef.current;
      window.electronAPI.shell.resize(tabId, cols, rows);
    } catch {
      // Ignore resize errors
    }
  }, [tabId]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create terminal with current theme
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
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Guard against StrictMode double-mount: if cleanup runs before rAF fires,
    // skip opening the already-disposed terminal.
    let cancelled = false;

    // Wait until the container has real pixel dimensions before opening xterm.
    // open() reads offsetWidth/offsetHeight internally and throws if they're 0.
    const openWhenReady = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) return;
      if (el.offsetWidth === 0 || el.offsetHeight === 0) {
        requestAnimationFrame(openWhenReady);
        return;
      }

      term.open(el);
      term.focus();

      // Fit, write banner, then spawn shell
      setTimeout(() => {
        if (cancelled) return;
        try { fitAddon.fit(); } catch { /* ignore */ }
        const { cols, rows } = term;
        // Banner BEFORE shell spawn so PowerShell init noise can't appear above it
        term.write(WELCOME_BANNER);
        window.electronAPI.shell.spawn(tabId).then(() => {
          if (cancelled) return;
          window.electronAPI.shell.resize(tabId, cols, rows);
          term.focus();
        });
      }, 50);
    };

    requestAnimationFrame(openWhenReady);

    // Handle pty data
    const unsubData = window.electronAPI.shell.onData((id: string, data: string) => {
      if (id !== tabId) return;
      term.write(data);

      // Accumulate output for context parsing
      outputBufferRef.current += data;
      onOutput(data);

      if (outputTimerRef.current) {
        clearTimeout(outputTimerRef.current);
      }
      outputTimerRef.current = setTimeout(() => {
        const buf = outputBufferRef.current;
        if (buf) {
          parseAndUpdateFromOutput(buf);
          setLastCommandOutput(buf);
          outputBufferRef.current = '';
        }
      }, 500);
    });

    if (typeof unsubData === 'function') {
      cleanupRef.current.push(unsubData);
    }

    // Handle user input with keyword interception
    const dataDisposable = term.onData((data: string) => {
      if (data === '\r') {
        // Enter pressed
        const line = lineBufferRef.current;
        lineBufferRef.current = '';

        const action = parseKeywordCommand(line);
        if (action) {
          // Send Ctrl+U to clear the line in shell, then Ctrl+C to be safe
          window.electronAPI.shell.write(tabId, '\x15');
          setTimeout(() => {
            onKeywordCommand(action);
          }, 50);
          return;
        }

        // Not a keyword — track as regular command
        if (line.trim()) {
          onCommandRun(line.trim());
        }
        window.electronAPI.shell.write(tabId, data);
      } else if (data === '\x7f') {
        // Backspace
        lineBufferRef.current = lineBufferRef.current.slice(0, -1);
        window.electronAPI.shell.write(tabId, data);
      } else if (data === '\x03') {
        // Ctrl+C — reset buffer
        lineBufferRef.current = '';
        window.electronAPI.shell.write(tabId, data);
      } else if (data === '\x1b' || data.startsWith('\x1b[')) {
        // Escape sequences (arrow keys, etc.) — reset line buffer tracking
        lineBufferRef.current = '';
        window.electronAPI.shell.write(tabId, data);
      } else if (data.charCodeAt(0) >= 32 && data.charCodeAt(0) < 127) {
        lineBufferRef.current += data;
        window.electronAPI.shell.write(tabId, data);
      } else {
        window.electronAPI.shell.write(tabId, data);
      }
    });

    cleanupRef.current.push(() => dataDisposable.dispose());

    // ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        window.electronAPI.shell.resize(tabId, cols, rows);
      } catch {
        // ignore
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    cleanupRef.current.push(() => resizeObserver.disconnect());

    // Cleanup
    return () => {
      cancelled = true;
      if (outputTimerRef.current) {
        clearTimeout(outputTimerRef.current);
      }
      for (const fn of cleanupRef.current) {
        fn();
      }
      cleanupRef.current = [];
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      lineBufferRef.current = '';
    };
  }, [tabId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    writeToTerminal,
    runCommand,
    resize,
    term: termRef,
  };
}
