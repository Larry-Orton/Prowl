import React, { useCallback } from 'react';

interface HelpModalProps {
  onClose: () => void;
  onCopyCommand: (cmd: string) => void;
}

const COMMANDS = [
  { section: 'Notes & Notebooks' },
  { cmd: 'note <text>', desc: 'Save a quick note (appends to active notebook)' },
  { cmd: 'notebook <name>', desc: 'Set active notebook for session' },
  { cmd: 'notebook new <name>', desc: 'Start a fresh notebook' },
  { cmd: 'notebook close', desc: 'Stop writing to active notebook' },
  { cmd: 'notes add <text>', desc: 'Append to active notebook or latest note' },
  { cmd: 'note #<n> <text>', desc: 'Append to note by number' },
  { cmd: 'search <term>', desc: 'Search your notes' },
  { cmd: 'export notes', desc: 'Export all notes to .md file' },
  { section: 'Target & Recon' },
  { cmd: 'target <ip>', desc: 'Set the primary target IP' },
  { section: 'AI Assistant' },
  { cmd: 'ask <question>', desc: 'Ask the AI assistant' },
  { cmd: 'hack help', desc: 'AI pentest methodology guidance' },
  { cmd: 'add last <tool>', desc: 'Send last output to AI for analysis' },
  { cmd: 'commands <tool>', desc: 'Show common commands for a tool' },
] as const;

const HelpModal: React.FC<HelpModalProps> = ({ onClose, onCopyCommand }) => {
  const handleCopy = useCallback((cmd: string) => {
    // Extract just the command keyword (before the <placeholder>)
    const base = cmd.split(' <')[0].split(' #')[0];
    navigator.clipboard.writeText(base);
    onCopyCommand(base);
  }, [onCopyCommand]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">PROWL Commands</span>
          <button className="theme-picker-close" onClick={onClose}>x</button>
        </div>
        <div className="help-modal-body">
          {COMMANDS.map((item, i) => {
            if ('section' in item) {
              return (
                <div key={i} className="help-section-label">{item.section}</div>
              );
            }
            return (
              <div
                key={i}
                className="help-cmd-row"
                onClick={() => handleCopy(item.cmd)}
                title="Click to copy"
              >
                <code className="help-cmd">{item.cmd}</code>
                <span className="help-desc">{item.desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
