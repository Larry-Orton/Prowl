import React, { useRef, useCallback } from 'react';
import { useTerminal, KeywordAction } from '../hooks/useTerminal';
import { useSessionStore } from '../store/sessionStore';

interface TerminalProps {
  tabId: string;
  isActive: boolean;
  onKeywordCommand: (action: KeywordAction) => void;
}

const Terminal: React.FC<TerminalProps> = ({ tabId, isActive, onKeywordCommand }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const addRecentCommand = useSessionStore(s => s.addRecentCommand);
  const lastOutputRef = useRef('');

  const handleOutput = useCallback((data: string) => {
    lastOutputRef.current += data;
    // Keep last 10k chars
    if (lastOutputRef.current.length > 10000) {
      lastOutputRef.current = lastOutputRef.current.slice(-10000);
    }
  }, []);

  const handleCommandRun = useCallback((cmd: string) => {
    addRecentCommand(cmd);
  }, [addRecentCommand]);

  const { writeToTerminal } = useTerminal({
    tabId,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    onKeywordCommand,
    onCommandRun: handleCommandRun,
    onOutput: handleOutput,
  });

  return (
    <div
      className="terminal-container"
      ref={containerRef}
      onClick={() => {
        // Re-focus terminal on click so typing always works
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
