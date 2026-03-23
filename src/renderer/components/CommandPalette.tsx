import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface PaletteItem {
  id: string;
  label: string;
  description: string;
  group: string;
  keywords?: string[];
  onSelect: () => void;
}

interface CommandPaletteProps {
  items: PaletteItem[];
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ items, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q) ||
      item.keywords?.some((keyword) => keyword.toLowerCase().includes(q))
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, Math.max(filteredItems.length - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        filteredItems[selectedIndex]?.onSelect();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, onClose, selectedIndex]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="palette-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search commands, panels, engagements, and modes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="palette-list">
          {filteredItems.length === 0 ? (
            <div className="ws-empty">No matches</div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.id}
                className={`palette-item ${index === selectedIndex ? 'active' : ''}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
              >
                <div className="palette-item-group">{item.group}</div>
                <div className="palette-item-label">{item.label}</div>
                <div className="palette-item-description">{item.description}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
