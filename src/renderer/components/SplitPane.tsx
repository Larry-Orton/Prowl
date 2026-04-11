import React, { useState, useCallback, useRef, useEffect } from 'react';

export type SplitDirection = 'horizontal' | 'vertical';

export interface PaneNode {
  type: 'leaf';
  tabId: string;
}

export interface SplitNode {
  type: 'split';
  direction: SplitDirection;
  ratio: number; // 0-1, how much space the first child gets
  first: LayoutNode;
  second: LayoutNode;
}

export type LayoutNode = PaneNode | SplitNode;

interface SplitPaneProps {
  layout: LayoutNode;
  onLayoutChange: (layout: LayoutNode) => void;
  renderPane: (tabId: string) => React.ReactNode;
  onSplitPane: (tabId: string, direction: SplitDirection) => void;
  onClosePane: (tabId: string) => void;
  onFocusPane: (tabId: string) => void;
  focusedTabId: string | null;
}

// Recursive renderer for the split tree
const SplitPaneNode: React.FC<{
  node: LayoutNode;
  path: string;
  onRatioChange: (path: string, ratio: number) => void;
  renderPane: (tabId: string) => React.ReactNode;
  onSplitPane: (tabId: string, direction: SplitDirection) => void;
  onClosePane: (tabId: string) => void;
  onFocusPane: (tabId: string) => void;
  focusedTabId: string | null;
}> = ({ node, path, onRatioChange, renderPane, onSplitPane, onClosePane, onFocusPane, focusedTabId }) => {
  const dividerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (node.type === 'leaf') {
    const isFocused = node.tabId === focusedTabId;
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          position: 'relative',
          outline: isFocused ? '1px solid var(--accent)' : '1px solid transparent',
          outlineOffset: -1,
        }}
        onClick={() => onFocusPane(node.tabId)}
        onContextMenu={(e) => {
          e.preventDefault();
          // Simple context menu via prompt
          const choice = window.confirm('Split this pane?\n\nOK = Split Right\nCancel = Split Down');
          if (choice) {
            onSplitPane(node.tabId, 'horizontal');
          } else {
            onSplitPane(node.tabId, 'vertical');
          }
        }}
      >
        {renderPane(node.tabId)}
      </div>
    );
  }

  const isHorizontal = node.direction === 'horizontal';

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const startPos = isHorizontal ? e.clientX : e.clientY;
    const totalSize = isHorizontal ? rect.width : rect.height;

    const onMove = (moveEvent: MouseEvent) => {
      const currentPos = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
      const offset = isHorizontal ? rect.left : rect.top;
      const newRatio = Math.max(0.15, Math.min(0.85, (currentPos - offset) / totalSize));
      onRatioChange(path, newRatio);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [isHorizontal, onRatioChange, path]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: `${node.ratio} 0 0%`, display: 'flex', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <SplitPaneNode
          node={node.first}
          path={`${path}.first`}
          onRatioChange={onRatioChange}
          renderPane={renderPane}
          onSplitPane={onSplitPane}
          onClosePane={onClosePane}
          onFocusPane={onFocusPane}
          focusedTabId={focusedTabId}
        />
      </div>
      {/* Draggable divider */}
      <div
        ref={dividerRef}
        onMouseDown={handleDragStart}
        style={{
          [isHorizontal ? 'width' : 'height']: 4,
          [isHorizontal ? 'minWidth' : 'minHeight']: 4,
          background: 'var(--border)',
          cursor: isHorizontal ? 'col-resize' : 'row-resize',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget).style.background = 'var(--accent)'; }}
        onMouseLeave={(e) => { (e.currentTarget).style.background = 'var(--border)'; }}
      />
      <div style={{ flex: `${1 - node.ratio} 0 0%`, display: 'flex', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <SplitPaneNode
          node={node.second}
          path={`${path}.second`}
          onRatioChange={onRatioChange}
          renderPane={renderPane}
          onSplitPane={onSplitPane}
          onClosePane={onClosePane}
          onFocusPane={onFocusPane}
          focusedTabId={focusedTabId}
        />
      </div>
    </div>
  );
};

// Helper to update a ratio at a specific path in the tree
function updateRatioAtPath(node: LayoutNode, path: string, ratio: number): LayoutNode {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0 || node.type === 'leaf') return node;

  const splitNode = node as SplitNode;
  if (parts.length === 1) {
    return { ...splitNode, ratio };
  }

  const [direction, ...rest] = parts;
  const remainingPath = rest.join('.');

  if (direction === 'first') {
    return { ...splitNode, first: updateRatioAtPath(splitNode.first, remainingPath, ratio) };
  } else {
    return { ...splitNode, second: updateRatioAtPath(splitNode.second, remainingPath, ratio) };
  }
}

const SplitPane: React.FC<SplitPaneProps> = ({
  layout,
  onLayoutChange,
  renderPane,
  onSplitPane,
  onClosePane,
  onFocusPane,
  focusedTabId,
}) => {
  const handleRatioChange = useCallback((path: string, ratio: number) => {
    onLayoutChange(updateRatioAtPath(layout, path, ratio));
  }, [layout, onLayoutChange]);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
      <SplitPaneNode
        node={layout}
        path="root"
        onRatioChange={handleRatioChange}
        renderPane={renderPane}
        onSplitPane={onSplitPane}
        onClosePane={onClosePane}
        onFocusPane={onFocusPane}
        focusedTabId={focusedTabId}
      />
    </div>
  );
};

export default SplitPane;
export { updateRatioAtPath };
