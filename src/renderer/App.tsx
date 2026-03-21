import React, { useState, useCallback, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Terminal from './components/Terminal';
import NotesPanel from './components/NotesPanel';
import AIPanel from './components/AIPanel';
import StatusBar from './components/StatusBar';
import { KeywordAction } from './hooks/useTerminal';
import { useNotes } from './hooks/useNotes';
import { useAI } from './hooks/useAI';
import { useTerminalStore } from './store/terminalStore';
import { useSessionStore } from './store/sessionStore';
import { useThemeStore } from './store/themeStore';

const APIKeyModal: React.FC<{
  onSave: (key: string) => void;
  onDismiss: () => void;
}> = ({ onSave, onDismiss }) => {
  const [value, setValue] = useState('');

  const handleSave = () => {
    if (value.trim()) {
      onSave(value.trim());
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Anthropic API Key</h2>
        <p>
          Prowl uses Claude for AI assistance. Enter your Anthropic API key to enable
          the AI panel. Your key is encrypted and stored securely on this device.
        </p>
        <input
          className="modal-input"
          type="password"
          placeholder="sk-ant-..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onDismiss}>
            Skip
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={!value.trim()}>
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [showNotes, setShowNotes] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [aiInitialInput, setAiInitialInput] = useState('');
  const { tabs, activeTabId, addTab } = useTerminalStore();
  const context = useSessionStore(s => s.context);
  const setTarget = useSessionStore(s => s.setTarget);
  const initTheme = useThemeStore(s => s.initTheme);

  const {
    filteredNotes,
    selectedNoteId,
    searchQuery,
    saveNote,
    deleteNote,
    searchNotes,
    exportNotes,
    setSelectedNote,
    quickSaveFromTerminal,
    quickSaveFromAI,
    notes,
  } = useNotes();

  const {
    messages,
    isThinking,
    hasApiKey,
    showApiKeyModal,
    sendMessage,
    saveApiKey,
    dismissModal,
    openModal,
  } = useAI();

  // Init theme + create first tab on mount
  useEffect(() => {
    initTheme();
    if (tabs.length === 0) {
      addTab();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeywordCommand = useCallback(async (action: KeywordAction) => {
    switch (action.type) {
      case 'target': {
        setTarget(action.ip);
        break;
      }

      case 'note': {
        // Title is first few words, content is full text
        const words = action.text.split(' ');
        const title = words.slice(0, 5).join(' ');
        await quickSaveFromTerminal(title, action.text);
        break;
      }

      case 'notes_add': {
        // Append to most recent note
        if (notes.length > 0) {
          const latest = notes[0];
          await saveNote({
            id: latest.id,
            title: latest.title,
            content: latest.content + '\n' + action.text,
            source: latest.source,
          });
        } else {
          await quickSaveFromTerminal('Note', action.text);
        }
        break;
      }

      case 'add_last': {
        // Get last output from session context and send to AI
        const lastOutput = context.lastCommandOutput;
        if (lastOutput) {
          setShowAI(true);
          const question = `Summarize and analyze this ${action.tool} output, identify important findings:\n\n\`\`\`\n${lastOutput.slice(-2000)}\n\`\`\``;
          await sendMessage(question, context, notes);
        }
        break;
      }

      case 'ask': {
        setShowAI(true);
        setAiInitialInput(action.question);
        break;
      }

      case 'help': {
        setShowAI(true);
        setAiInitialInput('What are the next steps I should take for this pentest engagement? Give me a structured methodology.');
        break;
      }

      case 'search': {
        setShowNotes(true);
        searchNotes(action.term);
        break;
      }

      case 'export_notes': {
        await exportNotes();
        break;
      }

      case 'commands': {
        setShowAI(true);
        setAiInitialInput(`Show me common ${action.tool} commands and usage examples for penetration testing. Format as a reference guide with code blocks.`);
        break;
      }
    }
  }, [
    setTarget, quickSaveFromTerminal, saveNote, notes, context,
    sendMessage, searchNotes, exportNotes, activeTabId
  ]);

  const handleQuickCommand = useCallback((cmd: string) => {
    if (activeTabId) {
      // Write command text directly to the active shell (user can edit before pressing Enter)
      window.electronAPI.shell.write(activeTabId, cmd);
    }
  }, [activeTabId]);

  const handleSaveToNotes = useCallback(async (content: string) => {
    const lines = content.split('\n');
    const title = lines[0].slice(0, 60) || 'AI Note';
    await quickSaveFromAI(title, content);
  }, [quickSaveFromAI]);

  const handleSearchChange = useCallback((query: string) => {
    searchNotes(query);
  }, [searchNotes]);

  return (
    <div className="app-layout">
      <TitleBar
        showNotes={showNotes}
        showAI={showAI}
        onToggleNotes={() => setShowNotes(v => !v)}
        onToggleAI={() => {
          if (!showAI && !hasApiKey) {
            openModal();
          }
          setShowAI(v => !v);
        }}
      />

      <div className="main-content">
        {/* Notes Panel */}
        <div className={`notes-panel ${showNotes ? '' : 'collapsed'}`}>
          <NotesPanel
            notes={filteredNotes}
            selectedNoteId={selectedNoteId}
            searchQuery={searchQuery}
            onSelectNote={setSelectedNote}
            onSearchChange={handleSearchChange}
            onDeleteNote={deleteNote}
            onQuickCommand={handleQuickCommand}
            onExportNotes={exportNotes}
          />
        </div>

        {/* Terminal Area */}
        <div className="terminal-area">
          {tabs.map(tab => (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              style={{
                height: '100%',
                display: tab.id === activeTabId ? 'flex' : 'none',
                flexDirection: 'column',
              }}
            >
              <Terminal
                tabId={tab.id}
                isActive={tab.id === activeTabId}
                onKeywordCommand={handleKeywordCommand}
              />
            </div>
          ))}
          {tabs.length === 0 && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text3)',
              fontSize: 13,
            }}>
              Click + to open a terminal
            </div>
          )}
        </div>

        {/* AI Panel */}
        <div className={`ai-panel ${showAI ? '' : 'collapsed'}`}>
          <AIPanel
            messages={messages}
            isThinking={isThinking}
            hasApiKey={hasApiKey}
            onSendMessage={sendMessage}
            onSaveToNotes={handleSaveToNotes}
            onOpenApiModal={openModal}
            context={context}
            notes={notes}
            initialInput={aiInitialInput}
            onClearInitialInput={() => setAiInitialInput('')}
          />
        </div>
      </div>

      <StatusBar
        context={context}
        noteCount={notes.length}
        isAIActive={hasApiKey}
        isThinking={isThinking}
      />

      {/* API Key Modal */}
      {showApiKeyModal && (
        <APIKeyModal
          onSave={saveApiKey}
          onDismiss={dismissModal}
        />
      )}
    </div>
  );
};

export default App;
