import React, { useRef, useCallback, useEffect } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useSessionStore } from '../store/sessionStore';
import { useThemeStore } from '../store/themeStore';
import { useTerminalStore } from '../store/terminalStore';
import type { KeywordAction } from '@shared/terminalKeywords';

interface TerminalProps {
  tabId: string;
  isActive: boolean;
  onKeywordCommand: (action: KeywordAction) => void;
  onCommandLogged?: (cmd: string) => void;
}

const Terminal: React.FC<TerminalProps> = ({ tabId, isActive, onKeywordCommand, onCommandLogged }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const recordTerminalCommand = useSessionStore(s => s.recordTerminalCommand);
  const lastOutputRef = useRef('');
  const theme = useThemeStore(s => s.currentTheme);
  const tabs = useTerminalStore(s => s.tabs);
  const tab = tabs.find(t => t.id === tabId);

  const handleOutput = useCallback((data: string) => {
    lastOutputRef.current += data;
    if (lastOutputRef.current.length > 10000) {
      lastOutputRef.current = lastOutputRef.current.slice(-10000);
    }
  }, []);

  const handleCommandRun = useCallback((cmd: string) => {
    recordTerminalCommand(tabId, tab?.shellType || 'local', tab?.title || 'Terminal', cmd);
    if (onCommandLogged) onCommandLogged(cmd);
  }, [onCommandLogged, recordTerminalCommand, tab?.shellType, tab?.title, tabId]);

  const { term, resize } = useTerminal({
    tabId,
    shellType: tab?.shellType || 'local',
    terminalTitle: tab?.title || 'Terminal',
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    onKeywordCommand,
    onCommandRun: handleCommandRun,
    onOutput: handleOutput,
  });

  useEffect(() => {
    if (term.current) {
      term.current.options.theme = theme.terminal;
    }
  }, [theme, term]);

  useEffect(() => {
    if (!isActive || !term.current) {
      return;
    }

    const id = window.requestAnimationFrame(() => {
      resize();
      term.current?.focus();
      if (term.current && term.current.rows > 0) {
        term.current.refresh(0, term.current.rows - 1);
      }
    });

    return () => window.cancelAnimationFrame(id);
  }, [isActive, resize, term]);

  return (
    <div
      className="terminal-container"
      ref={containerRef}
      onClick={() => {
        const termEl = containerRef.current?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null;
        termEl?.focus();
      }}
      style={{
        flex: 1,
        height: '100%',
        width: '100%',
        cursor: 'text',
      }}
    />
  );
};

export default Terminal;
