import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { AIMessage, ActiveContext, Note } from '@shared/types';

interface AIPanelProps {
  messages: AIMessage[];
  isThinking: boolean;
  hasApiKey: boolean;
  onSendMessage: (content: string, context: ActiveContext, notes: Note[]) => void;
  onSaveToNotes: (content: string) => void;
  onOpenApiModal: () => void;
  context: ActiveContext;
  notes: Note[];
  initialInput?: string;
  onClearInitialInput?: () => void;
}

function renderMessageContent(content: string): React.ReactNode {
  const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
  return parts.map((part, i) => {
    const codeBlockMatch = part.match(/^```(\w*)\n([\s\S]*?)```$/);
    if (codeBlockMatch) {
      return (
        <pre key={i} className="msg-code-block">
          <div className="code-block-header">
            <span>{codeBlockMatch[1] || 'code'}</span>
          </div>
          <code>{codeBlockMatch[2]}</code>
        </pre>
      );
    }

    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((p, j) => {
          if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
            return <code key={j} className="msg-inline-code">{p.slice(1, -1)}</code>;
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

const AIPanel: React.FC<AIPanelProps> = ({
  messages,
  isThinking,
  hasApiKey,
  onSendMessage,
  onSaveToNotes,
  onOpenApiModal,
  context,
  notes,
  initialInput,
  onClearInitialInput,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialInput) {
      setInputValue(initialInput);
      inputRef.current?.focus();
      if (onClearInitialInput) onClearInitialInput();
    }
  }, [initialInput, onClearInitialInput]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    if (!hasApiKey) { onOpenApiModal(); return; }
    setInputValue('');
    onSendMessage(text, context, notes);
  }, [inputValue, hasApiKey, onSendMessage, onOpenApiModal, context, notes]);

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
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-left">
          <span className="ai-title">AI</span>
          <span className="ai-model-badge">Claude</span>
        </div>
        <div className={`ai-status-indicator ${isThinking ? 'thinking' : hasApiKey ? 'ready' : 'offline'}`}>
          <span className="status-pulse" />
          {isThinking ? 'thinking' : hasApiKey ? 'live' : 'offline'}
        </div>
      </div>

      {/* Messages */}
      <div className="ai-messages">
        {messages.length === 0 && !isThinking && (
          <div className="ai-empty">
            <div className="ai-empty-glyph">◆</div>
            <div className="ai-empty-text">Ask me anything about your target</div>
            <div className="ai-empty-hint">
              type <code>ask &lt;question&gt;</code> in terminal
            </div>
            {!hasApiKey && (
              <button className="btn-accent" onClick={onOpenApiModal} style={{ marginTop: 12 }}>
                Set API Key
              </button>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`ai-msg ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="ai-msg-label">
                <span className="ai-msg-dot" />
                CLAUDE
              </div>
            )}
            <div className="ai-msg-content">
              {renderMessageContent(msg.content)}
            </div>
            {msg.role === 'assistant' && (
              <div className="ai-msg-actions">
                <button className="action-btn" onClick={() => handleSaveMessage(msg)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                  save to notes
                </button>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="ai-msg assistant">
            <div className="ai-msg-label">
              <span className="ai-msg-dot thinking" />
              CLAUDE
            </div>
            <div className="ai-thinking-bar">
              <div className="thinking-wave" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-input-bar">
        <textarea
          ref={inputRef}
          className="ai-textarea"
          placeholder="Ask about target, exploits, techniques..."
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
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AIPanel;
