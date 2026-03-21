import React, { useRef, useCallback, useEffect } from 'react';
import { useTerminal, KeywordAction } from '../hooks/useTerminal';
import { useSessionStore } from '../store/sessionStore';
import { useThemeStore } from '../store/themeStore';
import { useTerminalStore } from '../store/terminalStore';

interface TerminalProps {
  tabId: string;
  isActive: boolean;
  onKeywordCommand: (action: KeywordAction) => void;
}

const Terminal: React.FC<TerminalProps> = ({ tabId, isActive, onKeywordCommand }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const addRecentCommand = useSessionStore(s => s.addRecentCommand);
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
    addRecentCommand(cmd);
  }, [addRecentCommand]);

  const { term } = useTerminal({
    tabId,
    shellType: tab?.shellType || 'local',
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

  return (
    <div
      className="terminal-container"
      ref={containerRef}
      onClick={() => {
        const termEl = containerRef.current?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null;
        termEl?.focus();
      }}
      style={{
        display: isActive ? 'block' : 'none',
        height: '100%',
        width: '100%',
        cursor: 'text',
      }}
    />
  );
};

export default Terminal;
