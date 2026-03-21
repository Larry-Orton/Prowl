import React, { useRef, useCallback, useEffect } from 'react';
import { useTerminal, KeywordAction } from '../hooks/useTerminal';
import { useSessionStore } from '../store/sessionStore';
import { useThemeStore } from '../store/themeStore';

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
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    onKeywordCommand,
    onCommandRun: handleCommandRun,
    onOutput: handleOutput,
  });

  // Live theme sync — update xterm theme without restarting
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
