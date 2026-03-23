import React from 'react';
import type { MissionMode, MissionModeId } from '@shared/types';
import { MISSION_MODE_META } from '../lib/missionMode';

interface MissionModePanelProps {
  currentMode: MissionMode;
  onClose: () => void;
  onSelectMode: (modeId: MissionModeId) => void;
  onUseAuto: () => void;
}

const MissionModePanel: React.FC<MissionModePanelProps> = ({
  currentMode,
  onClose,
  onSelectMode,
  onUseAuto,
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="mode-panel" onClick={(e) => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">Mission Mode</span>
          <button className="theme-picker-close" onClick={onClose}>x</button>
        </div>

        <div className="mode-panel-summary">
          <span className={`findings-mode-pill ${currentMode.id}`}>{currentMode.label}</span>
          <span className="findings-mode-text">{currentMode.reason}</span>
        </div>

        <div className="mode-panel-actions">
          <button className="action-btn" onClick={onUseAuto}>
            use auto mode
          </button>
        </div>

        <div className="mode-grid">
          {(Object.entries(MISSION_MODE_META) as [MissionModeId, typeof MISSION_MODE_META[MissionModeId]][]).map(([modeId, meta]) => (
            <button
              key={modeId}
              className={`mode-card ${currentMode.id === modeId ? 'active' : ''}`}
              onClick={() => onSelectMode(modeId)}
            >
              <div className="mode-card-header">
                <span className={`findings-mode-pill ${modeId}`}>{meta.label}</span>
              </div>
              <div className="mode-card-body">{meta.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MissionModePanel;
