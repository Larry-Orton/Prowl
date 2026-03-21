import React from 'react';
import { ActiveContext } from '@shared/types';
import { CRITICAL_PORTS } from '@shared/constants';

interface StatusBarProps {
  context: ActiveContext;
  noteCount: number;
  isAIActive: boolean;
  isThinking: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
  context,
  noteCount,
  isAIActive,
  isThinking,
}) => {
  const hasCriticalPorts = context.discoveredPorts.some(p => CRITICAL_PORTS.includes(p));

  return (
    <div className="statusbar">
      {/* Target */}
      <div className="statusbar-item">
        <span className="statusbar-label">target</span>
        <span className={`statusbar-value target`}>
          {context.primaryTarget || '—'}
        </span>
      </div>

      {/* Ports */}
      {context.discoveredPorts.length > 0 && (
        <div className="statusbar-item">
          <span className="statusbar-label">ports</span>
          <span
            className="statusbar-value"
            style={{ color: hasCriticalPorts ? 'var(--red)' : 'var(--text2)' }}
          >
            {context.discoveredPorts.slice(0, 8).join(', ')}
            {context.discoveredPorts.length > 8 && ` +${context.discoveredPorts.length - 8}`}
          </span>
        </div>
      )}

      {/* Services */}
      {context.scannedServices.length > 0 && (
        <div className="statusbar-item">
          <span className="statusbar-label">services</span>
          <span className="statusbar-value" style={{ color: 'var(--blue)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {context.scannedServices.slice(0, 3).join(', ')}
          </span>
        </div>
      )}

      <div className="statusbar-spacer" />

      {/* AI status */}
      <div className="statusbar-item">
        <div className={`status-dot ${isThinking ? 'thinking' : isAIActive ? '' : 'offline'}`} />
        <span className="statusbar-value ai">
          {isThinking ? 'thinking' : isAIActive ? 'ai ready' : 'ai off'}
        </span>
      </div>

      {/* Notes count */}
      <div className="statusbar-item">
        <span className="statusbar-label">notes</span>
        <span className="statusbar-value">
          {noteCount}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
