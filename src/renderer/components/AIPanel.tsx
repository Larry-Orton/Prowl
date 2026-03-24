import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { AIMessage, AIMessageAction, ActiveContext, Note } from '@shared/types';
import { useMissionModeStore } from '../store/missionModeStore';

interface AIPanelProps {
  messages: AIMessage[];
  isThinking: boolean;
  backgroundThinking?: {
    active: boolean;
    label: string;
  };
  hasApiKey: boolean;
  onSendMessage: (content: string, context: ActiveContext, notes: Note[]) => void;
  onSaveToNotes: (content: string) => void;
  onRunCommand: (cmd: string) => void;
  onOpenApiModal: () => void;
  onMessageAction: (action: AIMessageAction) => void;
  context: ActiveContext;
  notes: Note[];
  currentObjective?: {
    key: string;
    priority: 'quiet' | 'focus' | 'opportunity' | 'urgent';
    title: string;
    summary: string;
    contextLabel?: string;
    action?: AIMessageAction;
  };
  actionCards?: Array<{
    id: string;
    title: string;
    description: string;
    action: AIMessageAction;
  }>;
  onDismissObjective?: () => void;
  initialInput?: string;
  onClearInitialInput?: () => void;
}

function renderMessageContent(content: string, onRunCommand?: (cmd: string) => void): React.ReactNode {
  const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
  return parts.map((part, i) => {
    const codeBlockMatch = part.match(/^```(\w*)\n([\s\S]*?)```$/);
    if (codeBlockMatch) {
      const code = codeBlockMatch[2].trim();
      const lines = code.split('\n');
      return (
        <pre key={i} className="msg-code-block">
          <div className="code-block-header">
            <span>{codeBlockMatch[1] || 'code'}</span>
            {onRunCommand && (
              <button
                className="code-run-btn"
                onClick={() => onRunCommand(code)}
                title="Paste to terminal"
              >
                Paste
              </button>
            )}
          </div>
          <code>
            {lines.map((line, li) => (
              <span
                key={li}
                className={onRunCommand ? 'code-line clickable' : 'code-line'}
                onClick={onRunCommand ? () => onRunCommand(line) : undefined}
                title={onRunCommand ? 'Click to paste to terminal' : undefined}
              >
                {line}
                {li < lines.length - 1 ? '\n' : ''}
              </span>
            ))}
          </code>
        </pre>
      );
    }

    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((p, j) => {
          if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
            const cmd = p.slice(1, -1);
            return (
              <code
                key={j}
                className={`msg-inline-code ${onRunCommand ? 'clickable' : ''}`}
                onClick={onRunCommand ? () => onRunCommand(cmd) : undefined}
                title={onRunCommand ? 'Click to paste to terminal' : undefined}
              >
                {cmd}
              </code>
            );
          }
          return p.split('\n').map((line, k, arr) => (
            <React.Fragment key={k}>
              {line}
              {k < arr.length - 1 && <br />}
            </React.Fragment>
          ));
        })}
      </span>
    );
  });
}

function getMessageMeta(msg: AIMessage): { label: string; bubbleClass: string } {
  if (msg.role === 'user') {
    return { label: 'YOU', bubbleClass: 'user' };
  }

  switch (msg.variant) {
    case 'warning':
      return { label: 'WARNING', bubbleClass: 'warning' };
    case 'suggestion':
      return { label: 'SUGGESTION', bubbleClass: 'suggestion' };
    case 'proactive':
      return { label: 'PROWL NOTICED', bubbleClass: 'proactive' };
    case 'lead':
      return { label: 'LEAD MODE', bubbleClass: 'lead' };
    default:
      return { label: 'PROWL AI', bubbleClass: 'assistant' };
  }
}

const AIPanel: React.FC<AIPanelProps> = ({
  messages,
  isThinking,
  backgroundThinking,
  hasApiKey,
  onSendMessage,
  onSaveToNotes,
  onRunCommand,
  onOpenApiModal,
  onMessageAction,
  context,
  notes,
  currentObjective,
  actionCards,
  onDismissObjective,
  initialInput,
  onClearInitialInput,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const missionMode = useMissionModeStore((s) => s.mode);

  useEffect(() => {
    if (initialInput) {
      setInputValue(initialInput);
      inputRef.current?.focus();
      onClearInitialInput?.();
    }
  }, [initialInput, onClearInitialInput]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [backgroundThinking?.active, isThinking, messages]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    if (!hasApiKey) {
      onOpenApiModal();
      return;
    }

    setInputValue('');
    onSendMessage(text, context, notes);
  }, [context, hasApiKey, inputValue, notes, onOpenApiModal, onSendMessage]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleSaveMessage = useCallback((msg: AIMessage) => {
    const plain = msg.content.replace(/```[\w]*\n([\s\S]*?)```/g, '$1').trim();
    const title = plain.slice(0, 50) + (plain.length > 50 ? '...' : '');
    onSaveToNotes(`${title}\n\n${msg.content}`);
  }, [onSaveToNotes]);

  return (
    <div className="panel-inner ai-inner">
      <div className="ai-header">
        <div className="ai-header-left">
          <span className="ai-title">AI</span>
          <span className="ai-model-badge">Claude</span>
          <span className={`ai-mode-chip ${missionMode.id}`}>
            {missionMode.label}
          </span>
        </div>
        <div className={`ai-status-indicator ${(isThinking || backgroundThinking?.active) ? 'thinking' : hasApiKey ? 'ready' : 'offline'}`}>
          <span className="status-pulse" />
          {isThinking ? 'thinking' : backgroundThinking?.active ? 'analyzing' : hasApiKey ? 'live' : 'offline'}
        </div>
      </div>

      <div className="ai-scroll-region">
        {currentObjective && (
          <div className={`ai-objective-card ${currentObjective.priority}`}>
            <div className="ai-objective-label-row">
              <div className="ai-objective-label">Current Objective</div>
              <div className="ai-objective-label-actions">
                <div className={`ai-objective-priority ${currentObjective.priority}`}>
                  {currentObjective.priority}
                </div>
                {onDismissObjective && (
                  <button
                    className="ai-objective-dismiss"
                    onClick={onDismissObjective}
                    title="Hide this objective until the mission context changes"
                  >
                    hide
                  </button>
                )}
              </div>
            </div>
            <div className="ai-objective-title">{currentObjective.title}</div>
            {currentObjective.contextLabel && (
              <div className="ai-objective-context">{currentObjective.contextLabel}</div>
            )}
            <div className="ai-objective-summary">{currentObjective.summary}</div>
            {currentObjective.action && (
              <button
                className="action-btn primary ai-objective-action"
                onClick={() => onMessageAction(currentObjective.action!)}
              >
                {currentObjective.action.label}
              </button>
            )}
          </div>
        )}

        {actionCards && actionCards.length > 0 && (
          <div className="ai-action-card-grid">
            {actionCards.map((card) => (
              <button
                key={card.id}
                className="ai-action-card"
                onClick={() => onMessageAction(card.action)}
              >
                <div className="ai-action-card-title">{card.title}</div>
                <div className="ai-action-card-description">{card.description}</div>
                <div className="ai-action-card-cta">{card.action.label}</div>
              </button>
            ))}
          </div>
        )}

        <div className="ai-messages">
          {messages.length === 0 && !isThinking && (
            <div className="ai-empty">
              <div className="ai-empty-glyph">+</div>
              <div className="ai-empty-text">Ask me anything about your engagement.</div>
              <div className="ai-empty-hint">
                I can see tracked commands and output across your open terminals and lead one step at a time.
              </div>
              {!hasApiKey && (
                <button className="btn-accent" onClick={onOpenApiModal} style={{ marginTop: 12 }}>
                  Set API Key
                </button>
              )}
            </div>
          )}

          {messages.map((msg) => {
            const meta = getMessageMeta(msg);
            return (
              <div key={msg.id} className={`ai-msg-row ${msg.role}`}>
                <div className={`ai-msg ${meta.bubbleClass}`}>
                  <div className="ai-msg-label">
                    <span className="ai-msg-dot" />
                    {meta.label}
                  </div>
                  <div className="ai-msg-content">
                    {renderMessageContent(msg.content, msg.role === 'assistant' ? onRunCommand : undefined)}
                  </div>
                </div>
                {msg.role === 'assistant' && (
                  <div className="ai-msg-actions">
                    {msg.actions?.map((action) => (
                      <button
                        key={action.id}
                        className="action-btn primary"
                        onClick={() => onMessageAction(action)}
                      >
                        {action.label}
                      </button>
                    ))}
                    <button className="action-btn" onClick={() => handleSaveMessage(msg)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                      </svg>
                      save to notes
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {backgroundThinking?.active && !isThinking && (
            <div className="ai-msg-row assistant">
              <div className="ai-msg lead">
                <div className="ai-msg-label">
                  <span className="ai-msg-dot thinking" />
                  LEAD MODE
                </div>
                <div className="ai-thinking-copy">{backgroundThinking.label}</div>
                <div className="ai-thinking-bar">
                  <div className="thinking-wave" />
                </div>
              </div>
            </div>
          )}

          {isThinking && (
            <div className="ai-msg-row assistant">
              <div className="ai-msg assistant">
                <div className="ai-msg-label">
                  <span className="ai-msg-dot thinking" />
                  PROWL AI
                </div>
                <div className="ai-thinking-bar">
                  <div className="thinking-wave" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="ai-input-bar">
        <textarea
          ref={inputRef}
          className="ai-textarea"
          placeholder="Ask what matters, what changed, or what to hit next..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ height: Math.min(100, Math.max(34, inputValue.split('\n').length * 18 + 16)) }}
        />
        <button
          className="ai-send"
          onClick={handleSend}
          disabled={isThinking || !inputValue.trim()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AIPanel;
