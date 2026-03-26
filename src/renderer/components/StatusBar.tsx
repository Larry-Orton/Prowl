import React from 'react';
import { ActiveContext } from '@shared/types';
import { CRITICAL_PORTS } from '@shared/constants';
import { useThemeStore } from '../store/themeStore';
import { useMissionModeStore } from '../store/missionModeStore';

interface StatusBarProps {
  context: ActiveContext;
  noteCount: number;
  findingCount: number;
  isAIActive: boolean;
  isThinking: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
  context,
  noteCount,
  findingCount,
  isAIActive,
  isThinking,
}) => {
  const hasCriticalPorts = context.discoveredPorts.some(p => CRITICAL_PORTS.includes(p));
  const theme = useThemeStore(s => s.currentTheme);
  const missionMode = useMissionModeStore(s => s.mode);

  return (
    <div className="statusbar">
      <div className="sb-group">
        <div className="sb-item">
          <span className="sb-label">TGT</span>
          <span className={`sb-value ${context.primaryTarget ? 'live' : 'dim'}`}>
            {context.primaryTarget || 'none'}
          </span>
        </div>

        {context.discoveredPorts.length > 0 && (
          <div className="sb-item">
            <span className="sb-label">PORTS</span>
            <span className={`sb-value ${hasCriticalPorts ? 'danger' : ''}`}>
              {context.discoveredPorts.length}
            </span>
          </div>
        )}

        {context.scannedServices.length > 0 && (
          <div className="sb-item">
            <span className="sb-label">SVC</span>
            <span className="sb-value">{context.scannedServices.length}</span>
          </div>
        )}

        <div className="sb-item">
          <span className="sb-label">MODE</span>
          <span className={`sb-value mode ${missionMode.id}`}>
            {missionMode.label}
          </span>
        </div>
      </div>

      <div className="sb-group sb-right">
        <div className="sb-item">
          <span className={`sb-dot ${isThinking ? 'thinking' : isAIActive ? 'ready' : 'off'}`} />
          <span className="sb-value dim">
            {isThinking ? 'AI thinking' : (isAIActive ? 'AI ready' : 'AI off')}
          </span>
        </div>
        <div className="sb-item">
          <span className="sb-label">NOTES</span>
          <span className="sb-value">{noteCount}</span>
        </div>
        <div className="sb-item">
          <span className="sb-label">FIND</span>
          <span className="sb-value">{findingCount}</span>
        </div>
        <div className="sb-item">
          <span className="sb-value dim">{theme.name}</span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
