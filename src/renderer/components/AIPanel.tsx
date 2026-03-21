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
  // Split by code blocks
  const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
  return parts.map((part, i) => {
    const codeBlockMatch = part.match(/^```(\w*)\n([\s\S]*?)```$/);
    if (codeBlockMatch) {
      return (
        <pre key={i} style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border2)',
          borderRadius: 5,
          padding: '8px 10px',
          margin: '6px 0',
          overflowX: 'auto',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11,
          color: 'var(--text1)',
          lineHeight: 1.5,
        }}>
          <code>{codeBlockMatch[2]}</code>
        </pre>
      );
    }

    // Inline code
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((p, j) => {
          if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
            return (
              <code key={j} style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                background: 'var(--bg3)',
                padding: '1px 4px',
                borderRadius: 3,
                color: 'var(--accent2)',
              }}>
                {p.slice(1, -1)}
              </code>
            );
          }
          // Handle newlines
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

  // Handle initial input from keyword commands
  useEffect(() => {
    if (initialInput) {
      setInputValue(initialInput);
      inputRef.current?.focus();
      if (onClearInitialInput) onClearInitialInput();
    }
  }, [initialInput, onClearInitialInput]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;

    if (!hasApiKey) {
      onOpenApiModal();
      return;
    }

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
    // Create a plain text version for the note
    const plain = msg.content.replace(/```[\w]*\n([\s\S]*?)```/g, '$1').trim();
    const title = plain.slice(0, 50) + (plain.length > 50 ? '…' : '');
    onSaveToNotes(`${title}\n\n${msg.content}`);
  }, [onSaveToNotes]);

  const contextLive = !!context.primaryTarget || context.discoveredPorts.length > 0;

  return (
    <div className="ai-panel-inner">
      {/* Header */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <h3>AI Assistant</h3>
          <span className="ai-badge">Claude</span>
        </div>
        <div className="ai-status">
          <div className={`status-dot ${hasApiKey ? (contextLive ? '' : '') : 'offline'} ${isThinking ? 'thinking' : ''}`} />
          <span>
            {isThinking ? 'thinking...' : hasApiKey ? 'context live' : 'no api key'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-messages">
        {messages.length === 0 && !isThinking && (
          <div style={{
            padding: '20px 12px',
            textAlign: 'center',
            color: 'var(--text3)',
            fontSize: 11,
            lineHeight: 1.8,
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✦</div>
            <div>Ask me anything about your target</div>
            <div style={{ marginTop: 8, fontSize: 10 }}>
              Type <code style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: 3 }}>ask &lt;question&gt;</code> in terminal
            </div>
            {!hasApiKey && (
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn-primary"
                  onClick={onOpenApiModal}
                  style={{ fontSize: 11, padding: '6px 14px' }}
                >
                  Set API Key
                </button>
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`ai-message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="ai-message-label">CLAUDE · session context attached</div>
            )}
            <div className="ai-message-bubble">
              {renderMessageContent(msg.content)}
            </div>
            {msg.role === 'assistant' && (
              <div className="ai-message-actions">
                <button
                  className="ai-save-btn"
                  onClick={() => handleSaveMessage(msg)}
                >
                  + save to notes
                </button>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="ai-message assistant">
            <div className="ai-message-label">CLAUDE · thinking</div>
            <div className="ai-thinking">
              <div className="thinking-dots">
                <span>·</span>
                <span>·</span>
                <span>·</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-input-area">
        <textarea
          ref={inputRef}
          className="ai-input"
          placeholder="Ask about target, exploits, techniques..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ height: Math.min(120, Math.max(36, inputValue.split('\n').length * 20)) }}
        />
        <button
          className="ai-send-btn"
          onClick={handleSend}
          disabled={isThinking || !inputValue.trim()}
          title="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  );
};

export default AIPanel;
