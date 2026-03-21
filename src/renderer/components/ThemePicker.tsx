import React, { useState } from 'react';
import { THEMES } from '../themes';
import { useThemeStore } from '../store/themeStore';

interface ThemePickerProps {
  onClose: () => void;
}

const ThemePicker: React.FC<ThemePickerProps> = ({ onClose }) => {
  const { currentTheme, setTheme } = useThemeStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="theme-picker-overlay" onClick={onClose}>
      <div className="theme-picker" onClick={(e) => e.stopPropagation()}>
        <div className="theme-picker-header">
          <span className="theme-picker-title">Theme</span>
          <button className="theme-picker-close" onClick={onClose}>×</button>
        </div>
        <div className="theme-picker-grid">
          {THEMES.map((theme) => {
            const isActive = theme.id === currentTheme.id;
            const isHovered = theme.id === hoveredId;
            return (
              <button
                key={theme.id}
                className={`theme-card ${isActive ? 'active' : ''}`}
                onClick={() => setTheme(theme.id)}
                onMouseEnter={() => setHoveredId(theme.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Mini terminal preview */}
                <div
                  className="theme-preview"
                  style={{ background: theme.terminal.background as string }}
                >
                  <div className="theme-preview-bar">
                    <span style={{ background: '#ff5f57', width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
                    <span style={{ background: '#febc2e', width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
                    <span style={{ background: '#28c840', width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
                  </div>
                  <div style={{ padding: '4px 6px', fontFamily: '"JetBrains Mono", monospace', fontSize: 8, lineHeight: 1.4 }}>
                    <span style={{ color: theme.terminal.green as string }}>$</span>
                    <span style={{ color: theme.terminal.foreground as string }}> nmap -sV </span>
                    <span style={{ color: theme.terminal.cyan as string }}>10.10.10.1</span>
                    <br />
                    <span style={{ color: theme.terminal.yellow as string }}>PORT</span>
                    <span style={{ color: theme.terminal.foreground as string }}> STATE SERVICE</span>
                    <br />
                    <span style={{ color: theme.terminal.red as string }}>22</span>
                    <span style={{ color: theme.terminal.foreground as string }}>/tcp open </span>
                    <span style={{ color: theme.terminal.blue as string }}>ssh</span>
                  </div>
                </div>
                <div className="theme-card-info">
                  <div className="theme-card-swatch" style={{ background: theme.preview }} />
                  <div>
                    <div className="theme-card-name">{theme.name}</div>
                    <div className="theme-card-desc">{theme.description}</div>
                  </div>
                  {isActive && <span className="theme-card-check">✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThemePicker;
