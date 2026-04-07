import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import TitleBar from './components/TitleBar';
import CommandPalette, { type PaletteItem } from './components/CommandPalette';
import EngagementPanel from './components/EngagementPanel';
import MissionModePanel from './components/MissionModePanel';
import type { TimelineItem } from './components/TimelinePanel';
import Terminal from './components/Terminal';
import NotesPanel from './components/NotesPanel';
import AIPanel from './components/AIPanel';
import StatusBar from './components/StatusBar';
import BrowserPanel from './components/BrowserPanel';
import HelpModal from './components/HelpModal';
import type { AIMessageAction, MissionModeId } from '@shared/types';
import { DEFAULT_ENGAGEMENT_ID, CRITICAL_PORTS } from '@shared/constants';
import type { KeywordAction } from '@shared/terminalKeywords';
import { buildWorkspacePath } from '@shared/workspacePaths';
import {
  buildCanonicalNotebookContent,
  inferNotebookSectionFromText,
  mergeCanonicalNotebook,
} from './lib/notebook';
import { inferMissionMode, MISSION_MODE_META } from './lib/missionMode';
import { resolveNotebookAIIntent, type NotebookAIIntent } from './lib/notebookAI';
import { useEngagements } from './hooks/useEngagements';
import { useNotes } from './hooks/useNotes';
import { useCommands } from './hooks/useCommands';
import { useFindings } from './hooks/useFindings';
import { useAI } from './hooks/useAI';
import { useWorkspaceIntel } from './hooks/useWorkspaceIntel';
import { useProactiveAI } from './hooks/useProactiveAI';
import { useTerminalStore } from './store/terminalStore';
import { useProactiveEventStore } from './store/proactiveEventStore';
import { useSessionStore } from './store/sessionStore';
import { useThemeStore } from './store/themeStore';
import { useNotesStore } from './store/notesStore';
import { useMissionModeStore } from './store/missionModeStore';
import { useEngagementStore } from './store/engagementStore';

type ObjectivePriority = 'quiet' | 'focus' | 'opportunity' | 'urgent';

interface ObjectiveCard {
  key: string;
  priority: ObjectivePriority;
  title: string;
  summary: string;
  contextLabel?: string;
  action?: AIMessageAction;
}

function detectPromptReady(output: string, shellType: 'local' | 'kali'): boolean {
  const lines = output
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-4);

  if (lines.length === 0) {
    return false;
  }

  const recent = lines.join('\n');

  if (shellType === 'local' && /(?:^|\n)PS [^\n]*>\s*$/m.test(recent)) {
    return true;
  }

  return (
    /(?:^|\n).*└─[#>$]\s*$/m.test(recent)
    || /(?:^|\n)[^\n]*[#$>]\s*$/m.test(recent)
  );
}

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
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserMode, setBrowserMode] = useState<'dock' | 'focus'>('dock');
  const [browserWidth, setBrowserWidth] = useState(440);
  const [browserSessionUrl, setBrowserSessionUrl] = useState('');
  const [showEngagementPanel, setShowEngagementPanel] = useState(false);
  const [showMissionModePanel, setShowMissionModePanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [aiInitialInput, setAiInitialInput] = useState('');
  const [credentials, setCredentials] = useState<import('./components/CredentialVault').Credential[]>([]);
  const [browserInitialUrl, setBrowserInitialUrl] = useState('');
  const [dismissedObjectiveKey, setDismissedObjectiveKey] = useState<string | null>(null);
  const [queuedTerminalCommands, setQueuedTerminalCommands] = useState<Record<string, string>>({});
  const [workspaceOpenRequest, setWorkspaceOpenRequest] = useState(0);
  const [findingsOpenRequest, setFindingsOpenRequest] = useState(0);
  const [timelineOpenRequest, setTimelineOpenRequest] = useState(0);
  const [socksPort, setSocksPort] = useState(1080);
  const [notesWidth, setNotesWidth] = useState(220);
  const [aiWidth, setAiWidth] = useState(280);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const isDraggingRef = useRef<'notes' | 'ai' | 'browser' | null>(null);

  const handleResizeMouseDown = useCallback((panel: 'notes' | 'ai' | 'browser') => (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = panel;
    const startX = e.clientX;
    const startWidth = panel === 'notes'
      ? notesWidth
      : panel === 'ai'
        ? aiWidth
        : browserWidth;

    const onMouseMove = (me: MouseEvent) => {
      const delta = panel === 'notes' ? me.clientX - startX : startX - me.clientX;
      const constraints = panel === 'browser'
        ? { min: 280, max: 1200 }
        : { min: 150, max: 600 };
      const newWidth = Math.max(constraints.min, Math.min(constraints.max, startWidth + delta));
      if (panel === 'notes') setNotesWidth(newWidth);
      else if (panel === 'ai') setAiWidth(newWidth);
      else setBrowserWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [aiWidth, browserWidth, notesWidth]);
  const {
    tabs,
    activeTabId,
    addTab,
    setActiveTab,
    layout,
    secondaryTabId,
    toggleSplit,
    setSecondaryTab,
  } = useTerminalStore();
  const lastProactiveEvent = useProactiveEventStore(s => s.lastEvent);
  const proactiveEvents = useProactiveEventStore(s => s.events);
  const clearProactiveEvents = useProactiveEventStore(s => s.clearEvents);
  const context = useSessionStore(s => s.context);
  const setTarget = useSessionStore(s => s.setTarget);
  const resetContext = useSessionStore(s => s.resetContext);
  const recordTerminalCommand = useSessionStore(s => s.recordTerminalCommand);
  const syncTerminalSessions = useSessionStore(s => s.syncTerminalSessions);
  const activeNotebookId = useNotesStore(s => s.activeNotebookId);
  const setActiveNotebook = useNotesStore(s => s.setActiveNotebook);
  const setNotesSearchQuery = useNotesStore(s => s.setSearchQuery);
  const updateEngagementInStore = useEngagementStore(s => s.updateEngagement);
  const initTheme = useThemeStore(s => s.initTheme);
  const missionMode = useMissionModeStore(s => s.mode);
  const setAutoMissionMode = useMissionModeStore(s => s.setAutoMode);
  const setManualMissionMode = useMissionModeStore(s => s.setManualMode);
  const clearManualMissionMode = useMissionModeStore(s => s.clearManualMode);
  const {
    engagements,
    currentEngagementId,
    currentEngagement,
    saveEngagement,
    selectEngagement,
    deleteEngagement,
    resetEngagementMemory,
  } = useEngagements();
  const currentWorkspacePath = currentEngagement?.workspacePath
    || `/workspace/${currentEngagementId || DEFAULT_ENGAGEMENT_ID}`;

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
    reloadNotes,
  } = useNotes();
  const { commands, reloadCommands } = useCommands();
  const { findings, saveFinding, reloadFindings } = useFindings();
  const { workspaceIntel } = useWorkspaceIntel(currentWorkspacePath);

  const {
    messages,
    isThinking,
    hasApiKey,
    showApiKeyModal,
    sendMessage,
    runBackgroundTask,
    saveApiKey,
    dismissModal,
    openModal,
    clearMessages,
    appendMessage,
    appendProactiveMessage,
  } = useAI();
  const { publishEvent } = useProactiveAI({
    appendProactiveMessage,
    onOpenPanel: () => setShowAI(true),
  });
  const hintedTargetRef = useRef<string | null>(null);
  const hintedPortsRef = useRef('');
  const hintedServicesRef = useRef('');
  const capturedPortFindingsRef = useRef<Set<string>>(new Set());
  const capturedServiceFindingsRef = useRef<Set<string>>(new Set());
  const saveCanonicalNotebookUpdateRef = useRef<((section: Parameters<typeof mergeCanonicalNotebook>[0]['section'], entry: string, nextStep?: string) => Promise<unknown>) | null>(null);

  // Init theme + create first tab on mount
  useEffect(() => {
    initTheme();
    if (tabs.length === 0) {
      addTab();
    }
    // Get SOCKS port for browser
    window.electronAPI.browser.getSocksPort().then(setSocksPort);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    syncTerminalSessions(tabs);
  }, [currentEngagementId, syncTerminalSessions, tabs]);

  useEffect(() => {
    const openTabIds = new Set(tabs.map((tab) => tab.id));
    setQueuedTerminalCommands((current) => {
      const nextEntries = Object.entries(current).filter(([tabId]) => openTabIds.has(tabId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [tabs]);

  const previousEngagementIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentEngagementId) {
      return;
    }

    if (previousEngagementIdRef.current === currentEngagementId) {
      return;
    }

    previousEngagementIdRef.current = currentEngagementId;
    resetContext();
    setDismissedObjectiveKey(null);
    setSelectedNote(null);
    setActiveNotebook(null, null);
    setNotesSearchQuery('');
    if (currentEngagement?.primaryTarget) {
      setTarget(currentEngagement.primaryTarget);
    }
  }, [
    currentEngagement?.primaryTarget,
    currentEngagementId,
    resetContext,
    setActiveNotebook,
    setNotesSearchQuery,
    setSelectedNote,
    setTarget,
  ]);

  useEffect(() => {
    const handlePaletteShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommandPalette(true);
      }
    };

    window.addEventListener('keydown', handlePaletteShortcut);
    return () => window.removeEventListener('keydown', handlePaletteShortcut);
  }, []);

  // Handle browser page scan — sends page content to AI
  const handleResetEngagementMemory = useCallback(async (engagementId: string) => {
    await resetEngagementMemory(engagementId);

    if (engagementId !== currentEngagementId) {
      return;
    }

    resetContext();
    clearMessages();
    clearProactiveEvents();
    setQueuedTerminalCommands({});
    setDismissedObjectiveKey(null);
    setAiInitialInput('');
    setSelectedNote(null);
    setActiveNotebook(null, null);
    setNotesSearchQuery('');
    hintedTargetRef.current = null;
    hintedPortsRef.current = '';
    hintedServicesRef.current = '';
    capturedPortFindingsRef.current.clear();
    capturedServiceFindingsRef.current.clear();
    await Promise.all([
      reloadNotes(),
      reloadCommands(),
      reloadFindings(),
    ]);
  }, [
    clearMessages,
    clearProactiveEvents,
    currentEngagementId,
    reloadCommands,
    reloadFindings,
    reloadNotes,
    resetContext,
    resetEngagementMemory,
    setActiveNotebook,
    setNotesSearchQuery,
    setSelectedNote,
  ]);

  const handlePageContent = useCallback(async (url: string, content: string) => {
    setShowAI(true);
    publishEvent({ type: 'browser_scanned', url, content });
    const question = `Analyze the attack surface and business logic of this web page at ${url}. Identify forms, inputs, scripts, comments, trust boundaries, role assumptions, workflow weaknesses, IDOR/state manipulation risks, and the most important next tests. Here is the extracted page content:\n\n\`\`\`json\n${content}\n\`\`\``;
    await sendMessage(question, context, notes);
  }, [publishEvent, sendMessage, context, notes]);

  const openBrowser = useCallback((url?: string, mode?: 'dock' | 'focus') => {
    setShowBrowser(true);
    if (url) {
      setBrowserInitialUrl(url);
      setBrowserSessionUrl(url);
    }
    if (mode) {
      setBrowserMode(mode);
    }
  }, []);

  const closeBrowser = useCallback(() => {
    setShowBrowser(false);
    setBrowserInitialUrl('');
  }, []);

  const toggleBrowserMode = useCallback(() => {
    if (!showBrowser) {
      setShowBrowser(true);
      return;
    }
    setBrowserMode((value) => value === 'dock' ? 'focus' : 'dock');
  }, [showBrowser]);

  const handleQuickCommand = useCallback((cmd: string) => {
    if (activeTabId) {
      window.dispatchEvent(new CustomEvent('prowl:terminal-prefill', {
        detail: { tabId: activeTabId, data: cmd },
      }));
    }
  }, [activeTabId]);

  const isTerminalReady = useCallback((tabId: string) => {
    const session = context.terminalSessions.find((entry) => entry.tabId === tabId);
    if (!session) {
      return false;
    }

    const latestActivity = session.recentActivity[0];
    if (!latestActivity) {
      return true;
    }

    if (!latestActivity.output.trim()) {
      return false;
    }

    return detectPromptReady(latestActivity.output, session.shellType);
  }, [context.terminalSessions]);

  const runCommandInTab = useCallback((tabId: string, cmd: string) => {
    const activeTab = tabs.find((tab) => tab.id === tabId);
    const trimmedCommand = cmd.trim();
    if (!activeTab || !trimmedCommand) {
      return false;
    }

    recordTerminalCommand(activeTab.id, activeTab.shellType, activeTab.title, trimmedCommand);
    window.electronAPI.shell.write(tabId, `${trimmedCommand}\r`);
    return true;
  }, [recordTerminalCommand, tabs]);

  const executeTerminalCommand = useCallback((cmd: string): 'ran' | 'queued' | 'ignored' => {
    if (!activeTabId) {
      return 'ignored';
    }

    const trimmedCommand = cmd.trim();
    if (!trimmedCommand) {
      return 'ignored';
    }

    if (isTerminalReady(activeTabId)) {
      runCommandInTab(activeTabId, trimmedCommand);
      return 'ran';
    }

    setQueuedTerminalCommands((current) => ({
      ...current,
      [activeTabId]: trimmedCommand,
    }));
    return 'queued';
  }, [activeTabId, isTerminalReady, runCommandInTab]);

  useEffect(() => {
    const queuedEntries = Object.entries(queuedTerminalCommands);
    if (queuedEntries.length === 0) {
      return;
    }

    const readyEntries = queuedEntries.filter(([tabId]) => isTerminalReady(tabId));
    if (readyEntries.length === 0) {
      return;
    }

    setQueuedTerminalCommands((current) => {
      const next = { ...current };
      for (const [tabId] of readyEntries) {
        delete next[tabId];
      }
      return next;
    });

    for (const [tabId, command] of readyEntries) {
      runCommandInTab(tabId, command);
    }
  }, [isTerminalReady, queuedTerminalCommands, runCommandInTab]);

  const handleAIMessageAction = useCallback((action: AIMessageAction) => {
    if (action.id.startsWith('objective-')) {
      setDismissedObjectiveKey(action.id);
    }

    switch (action.type) {
      case 'run_command':
        if (executeTerminalCommand(action.payload) === 'queued') {
          appendMessage(
            'assistant',
            'The active terminal is still busy, so I queued that command and will run it when the prompt returns.',
            'warning',
            undefined,
            false
          );
        }
        break;
      case 'prefill_ai':
        setShowAI(true);
        setAiInitialInput(action.payload);
        break;
      case 'open_browser':
        openBrowser(action.payload);
        break;
      case 'save_finding': {
        const targetLabel = context.primaryTarget || 'unknown-target';
        void saveFinding({
          kind: 'note',
          target: targetLabel,
          title: `Finding - ${targetLabel}`,
          summary: action.payload,
          source: 'ai',
          confidence: 'medium',
          tags: ['ai', 'finding'],
        });
        void quickSaveFromAI(
          `Finding - ${targetLabel}`,
          `[Finding]\nTarget: ${targetLabel}\n\n${action.payload}`
        );
        setShowNotes(true);
        break;
      }
      case 'append_notebook': {
        const entry = action.payload.trim();
        if (!entry) break;
        const saveNotebookUpdate = saveCanonicalNotebookUpdateRef.current;
        if (saveNotebookUpdate) {
          void saveNotebookUpdate(
            inferNotebookSectionFromText(entry),
            entry,
          );
        } else {
          void quickSaveFromAI(
            context.primaryTarget ? `${context.primaryTarget} notebook cue` : 'Prowl notebook cue',
            entry
          );
        }
        setShowNotes(true);
        break;
      }
      case 'open_findings':
        setFindingsOpenRequest((value) => value + 1);
        break;
      case 'open_workspace':
        setWorkspaceOpenRequest((value) => value + 1);
        break;
      case 'open_timeline':
        setTimelineOpenRequest((value) => value + 1);
        break;
      case 'create_note': {
        void quickSaveFromAI(
          context.primaryTarget ? `${context.primaryTarget} snapshot` : 'Prowl snapshot',
          action.payload
        );
        setShowNotes(true);
        break;
      }
      case 'set_mission_mode': {
        const modeId = action.payload as MissionModeId;
        const meta = MISSION_MODE_META[modeId];
        if (meta) {
          setManualMissionMode({
            id: modeId,
            label: meta.label,
            description: meta.description,
            source: 'manual',
            confidence: 'high',
            reason: `Pinned by operator from AI action: ${meta.label}`,
            updatedAt: new Date().toISOString(),
          });
        }
        break;
      }
    }
  }, [
    context.primaryTarget,
    executeTerminalCommand,
    appendMessage,
    openBrowser,
    quickSaveFromAI,
    saveFinding,
    setManualMissionMode,
  ]);

  useEffect(() => {
    if (!lastProactiveEvent) return;
    publishEvent(lastProactiveEvent.payload);
  }, [lastProactiveEvent, publishEvent]);

  useEffect(() => {
    if (!context.primaryTarget) {
      hintedTargetRef.current = null;
      capturedPortFindingsRef.current.clear();
      capturedServiceFindingsRef.current.clear();
      return;
    }
    if (hintedTargetRef.current === context.primaryTarget) {
      return;
    }
    const targetWorkspacePath = buildWorkspacePath(
      context.primaryTarget,
      currentEngagementId || DEFAULT_ENGAGEMENT_ID,
    );
    hintedTargetRef.current = context.primaryTarget;
    publishEvent({
      type: 'target_set',
      target: context.primaryTarget,
      workspacePath: targetWorkspacePath,
      actions: [
        {
          id: 'target-scan',
          label: 'Run full TCP scan',
          type: 'run_command',
          payload: `nmap -Pn -p- --min-rate 1000 ${context.primaryTarget} -oN ${targetWorkspacePath}/${context.primaryTarget}-full-tcp.txt`,
        },
        {
          id: 'target-note',
          label: 'Save finding',
          type: 'save_finding',
          payload: `Target set to ${context.primaryTarget}. Start with broad recon and convert early service data into a plan.`,
        },
      ],
    });
  }, [context.primaryTarget, currentEngagementId, publishEvent]);

  useEffect(() => {
    if (!context.primaryTarget) return;
    const targetId = `target:${context.primaryTarget}`;
    if (findings.some(f => f.kind === 'target' && f.metadata.identity === targetId)) {
      return;
    }
    void saveFinding({
      kind: 'target',
      target: context.primaryTarget,
      title: `Target ${context.primaryTarget}`,
      summary: `Primary target set to ${context.primaryTarget}.`,
      source: 'terminal',
      confidence: 'high',
      tags: ['target'],
      metadata: { identity: targetId },
    });
  }, [context.primaryTarget, findings, saveFinding]);

  useEffect(() => {
    if (!context.primaryTarget || context.discoveredPorts.length === 0) {
      hintedPortsRef.current = '';
      return;
    }
    const signature = `${context.primaryTarget}|${context.discoveredPorts.join(',')}`;
    if (hintedPortsRef.current === signature) {
      return;
    }
    hintedPortsRef.current = signature;
    publishEvent({
      type: 'ports_discovered',
      context,
      workspacePath: currentWorkspacePath,
      actions: [
        {
          id: 'ports-services',
          label: 'Run service detection',
          type: 'run_command',
          payload: `nmap -sV -sC ${context.primaryTarget} -oN ${currentWorkspacePath}/${context.primaryTarget}-services.txt`,
        },
        ...(context.discoveredPorts.some(port => [80, 443, 8080, 8443].includes(port))
          ? [{
              id: 'ports-browser',
              label: 'Open in browser',
              type: 'open_browser' as const,
              payload: `http://${context.primaryTarget}`,
            }]
          : []),
        {
          id: 'ports-note',
          label: 'Append to notebook',
          type: 'append_notebook',
          payload: `[Ports] ${context.primaryTarget}: ${context.discoveredPorts.join(', ')}`,
        },
      ],
    });
  }, [context, currentWorkspacePath, publishEvent]);

  useEffect(() => {
    if (!context.primaryTarget) return;
    for (const port of context.discoveredPorts) {
      const key = `${context.primaryTarget}:port:${port}`;
      if (findings.some(f => f.metadata.identity === key)) {
        capturedPortFindingsRef.current.add(key);
        continue;
      }
      if (capturedPortFindingsRef.current.has(key)) {
        continue;
      }
      capturedPortFindingsRef.current.add(key);
      void saveFinding({
        kind: 'port',
        target: context.primaryTarget,
        title: `Open port ${port}`,
        summary: `Discovered open TCP port ${port} on ${context.primaryTarget}.`,
        source: 'terminal',
        confidence: 'high',
        tags: ['port', CRITICAL_PORTS.includes(port) ? 'critical' : 'discovery'],
        metadata: { identity: key, port: String(port) },
      });
    }
  }, [context.discoveredPorts, context.primaryTarget, findings, saveFinding]);

  useEffect(() => {
    if (!context.primaryTarget || context.scannedServices.length === 0) {
      hintedServicesRef.current = '';
      return;
    }
    const signature = `${context.primaryTarget}|${context.scannedServices.join('|')}`;
    if (hintedServicesRef.current === signature) {
      return;
    }
    hintedServicesRef.current = signature;
    publishEvent({
      type: 'services_discovered',
      context,
      workspacePath: currentWorkspacePath,
      actions: [
        {
          id: 'services-ai',
          label: 'Ask for next steps',
          type: 'prefill_ai',
          payload: `Based on the discovered services on ${context.primaryTarget}, what should I do next?`,
        },
        {
          id: 'services-note',
          label: 'Save finding',
          type: 'save_finding',
          payload: `Service fingerprint summary for ${context.primaryTarget}:\n${context.scannedServices.join('\n')}`,
        },
      ],
    });
  }, [context, currentWorkspacePath, publishEvent]);

  useEffect(() => {
    if (!context.primaryTarget) return;
    for (const service of context.scannedServices) {
      const key = `${context.primaryTarget}:service:${service}`;
      if (findings.some(f => f.metadata.identity === key)) {
        capturedServiceFindingsRef.current.add(key);
        continue;
      }
      if (capturedServiceFindingsRef.current.has(key)) {
        continue;
      }
      capturedServiceFindingsRef.current.add(key);
      void saveFinding({
        kind: 'service',
        target: context.primaryTarget,
        title: `Service ${service}`,
        summary: `Fingerprint captured for ${service} on ${context.primaryTarget}.`,
        source: 'terminal',
        confidence: 'medium',
        tags: ['service'],
        metadata: { identity: key, service },
      });
    }
  }, [context.primaryTarget, context.scannedServices, findings, saveFinding]);

  const handleKeywordCommand = useCallback(async (action: KeywordAction) => {
    switch (action.type) {
      case 'target': {
        setTarget(action.ip);
        if (currentEngagement) {
          const nextWorkspacePath = buildWorkspacePath(action.ip, currentEngagement.id);
          updateEngagementInStore({
            ...currentEngagement,
            primaryTarget: action.ip,
            workspacePath: nextWorkspacePath,
            updatedAt: new Date().toISOString(),
          });
          void saveEngagement({
            id: currentEngagement.id,
            name: currentEngagement.name,
            primaryTarget: action.ip,
            tags: currentEngagement.tags,
            workspacePath: nextWorkspacePath,
          });
        }
        // Auto-create notebook for this target
        void window.electronAPI.workspace.readFile(`/workspace/${action.ip}/notebook.md`).then(existing => {
          if (!existing) {
            const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            void window.electronAPI.workspace.writeFile(`/workspace/${action.ip}/notebook.md`,
              `# ${action.ip} — ${currentEngagement?.name || 'Engagement'}\n\nStarted: ${now}\n\n## Notes\n\n`
            );
          }
        });
        break;
      }
      case 'note': {
        const words = action.text.split(' ');
        const title = words.slice(0, 5).join(' ');
        await quickSaveFromTerminal(title, action.text);
        break;
      }
      case 'notebook_set': {
        // Find existing notebook by name, or create one
        const existing = notes.find(n => n.title.toLowerCase() === action.name.toLowerCase());
        if (existing) {
          setActiveNotebook(existing.id, existing.title);
          setSelectedNote(existing.id);
        } else {
          const nb = await saveNote({
            title: action.name,
            content: buildCanonicalNotebookContent(action.name),
            source: 'ai',
            tags: ['notebook', 'ai-canonical'],
          });
          if (nb) {
            setActiveNotebook(nb.id, nb.title);
            setSelectedNote(nb.id);
          }
        }
        setShowNotes(true);
        break;
      }
      case 'notebook_new': {
        const nb = await saveNote({
          title: action.name,
          content: buildCanonicalNotebookContent(action.name),
          source: 'ai',
          tags: ['notebook', 'ai-canonical'],
        });
        if (nb) {
          setActiveNotebook(nb.id, nb.title);
          setSelectedNote(nb.id);
        }
        setShowNotes(true);
        break;
      }
      case 'notebook_close': {
        setActiveNotebook(null, null);
        break;
      }
      case 'notes_add': {
        const targetNote = selectedNoteId
          ? notes.find(n => n.id === selectedNoteId && n.id !== activeNotebookId)
          : notes.find((note) => note.id !== activeNotebookId);
        if (targetNote) {
          await saveNote({
            id: targetNote.id,
            title: targetNote.title,
            content: targetNote.content + '\n' + action.text,
            source: targetNote.source,
          });
        } else {
          await quickSaveFromTerminal('Note', action.text);
        }
        break;
      }
      case 'notes_append': {
        // Append to a specific note by index (1-based)
        const idx = action.index - 1;
        if (idx >= 0 && idx < notes.length) {
          const note = notes[idx];
          if (note.id === activeNotebookId) {
            await quickSaveFromTerminal(note.title, action.text);
            break;
          }
          await saveNote({
            id: note.id,
            title: note.title,
            content: note.content + '\n' + action.text,
            source: note.source,
          });
        }
        break;
      }
      case 'add_last': {
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
        // Send to AI immediately instead of just pre-filling
        await sendMessage(action.question, context, notes);
        break;
      }
      case 'help': {
        setShowAI(true);
        await sendMessage('What are the next steps I should take for this pentest engagement? Give me a structured methodology.', context, notes);
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
      case 'show_help': {
        setShowHelpModal(true);
        break;
      }
      case 'usage_error': {
        // Show help modal for usage errors too — the user is trying to use a command
        setShowHelpModal(true);
        break;
      }
    }
  }, [
    currentEngagement, saveEngagement, setTarget, quickSaveFromTerminal, saveNote, notes, context,
    sendMessage, searchNotes, exportNotes, activeTabId, selectedNoteId,
    activeNotebookId, setActiveNotebook, setSelectedNote, updateEngagementInStore
  ]);

  // ── "Send to AI" support ────────────────────────
  // Stores the last completed command + output so the floating button can send it.
  const lastCompletedCommandRef = useRef<{ command: string; output: string } | null>(null);
  const [showSendToAI, setShowSendToAI] = useState(false);

  // ── Journal System ──────────────────────────────
  const journalQueueRef = useRef<{ command: string; output: string; timestamp: string }[]>([]);
  const journalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const journalWritingRef = useRef(false);

  const JOURNAL_TOOLS = [
    'nmap', 'masscan', 'gobuster', 'feroxbuster', 'dirb', 'nikto', 'sqlmap',
    'hydra', 'john', 'hashcat', 'curl', 'wget', 'enum4linux', 'smbclient',
    'rpcclient', 'crackmapexec', 'evil-winrm', 'ssh', 'ftp', 'nc', 'ncat',
    'msfconsole', 'searchsploit', 'wfuzz', 'ffuf', 'whatweb', 'wafw00f',
    'python', 'python3', 'ruby', 'perl', 'php', 'chisel', 'ligolo',
    'impacket', 'psexec', 'secretsdump', 'getuserspns', 'dnsrecon', 'dnsenum',
    'dig', 'host', 'whois', 'subfinder', 'amass', 'httpx', 'nuclei',
    'cat /etc', 'cat /root', 'sudo', 'su ', 'chmod', 'find / ', 'linpeas',
    'winpeas', 'pspy', 'certutil', 'powershell', 'whoami /priv', 'netstat',
  ];

  const isJournalWorthy = useCallback((cmd: string): boolean => {
    const lower = cmd.toLowerCase().trim();
    return JOURNAL_TOOLS.some(tool => lower.startsWith(tool) || lower.includes('/' + tool));
  }, []);

  const flushJournal = useCallback(async () => {
    if (journalWritingRef.current) return;
    if (journalQueueRef.current.length === 0) return;
    if (!context.primaryTarget) return;

    const entries = [...journalQueueRef.current];
    journalQueueRef.current = [];
    journalWritingRef.current = true;

    try {
      // Read existing notebook
      const existingJournal = await window.electronAPI.workspace.readFile(
        `/workspace/${context.primaryTarget}/notebook.md`
      ) || '';

      const entriesText = entries.map(e =>
        `Command: \`${e.command}\`\nTimestamp: ${e.timestamp}\nOutput:\n\`\`\`\n${e.output.slice(-3000)}\n\`\`\``
      ).join('\n\n');

      const journalPrompt = `You are writing a pentest engagement journal. Write narrative journal entries for the following commands that were just run against ${context.primaryTarget}.

Write like a senior pentester documenting their work for a report. For each command:
- What phase this belongs to (Recon, Enumeration, Exploitation, Post-Exploitation, Privilege Escalation, Lateral Movement)
- What we did and WHY (the reasoning behind the command)
- What we found (key results from the output)
- What this means for the engagement (implications, next steps)

Write in first person plural ("We ran...", "We discovered..."). Be specific about findings. Include the actual command. Keep each entry 3-6 sentences.

Format each entry as:
### [Phase] — [Brief Title]
*[timestamp]*

[Narrative paragraph]

---

Here are the commands to journal:

${entriesText}

${existingJournal ? `\nExisting journal so far (for context, do NOT repeat these entries):\n${existingJournal.slice(-4000)}` : ''}

Write ONLY the new journal entries. Do not repeat existing entries.`;

      const result = await runBackgroundTask(journalPrompt, context, notes, {
        systemPromptOverride: 'You are a pentest engagement journal writer. Write clear, educational, narrative entries documenting penetration testing activity. Be specific about findings and their implications. Do not include any XML tags or metadata — just the journal entries in markdown.',
      });

      if (result) {
        const newJournal = existingJournal
          ? `${existingJournal}\n\n${result.trim()}`
          : `# Engagement Journal — ${context.primaryTarget}\n\n${result.trim()}`;
        await window.electronAPI.workspace.writeFile(
          `/workspace/${context.primaryTarget}/notebook.md`,
          newJournal
        );
      }
    } catch {
      // Re-queue on failure
      journalQueueRef.current.unshift(...entries);
    } finally {
      journalWritingRef.current = false;
    }
  }, [context, notes, runBackgroundTask]);

  const handleCommandComplete = useCallback((command: string, output: string) => {
    // Strip any remaining ANSI/OSC escape codes
    const cleanOutput = output
      .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      .replace(/\x1b[()][A-Z0-9]/g, '')
      .replace(/\x1b[>=<]/g, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .replace(/\r/g, '')
      .trim();
    const cmd = command.toLowerCase().trim();

    // Skip trivial commands
    const trivialCommands = ['ls', 'cd', 'pwd', 'clear', 'whoami', 'id', 'exit', 'history', 'echo', 'man', 'help'];
    if (trivialCommands.some(t => cmd === t || cmd.startsWith(t + ' '))) {
      setShowSendToAI(false);
      return;
    }

    const lines = cleanOutput.split('\n').filter(Boolean);
    if (lines.length < 2) {
      setShowSendToAI(false);
      return;
    }

    lastCompletedCommandRef.current = { command, output: cleanOutput };
    setShowSendToAI(true);

    // Queue for journal if it's a significant command
    if (isJournalWorthy(command) && context.primaryTarget) {
      journalQueueRef.current.push({
        command,
        output: cleanOutput,
        timestamp: new Date().toLocaleString(),
      });

      // Flush journal after 3 queued commands or 30 seconds
      if (journalQueueRef.current.length >= 3) {
        void flushJournal();
      } else {
        if (journalTimerRef.current) clearTimeout(journalTimerRef.current);
        journalTimerRef.current = setTimeout(() => void flushJournal(), 30000);
      }
    }
  }, [context.primaryTarget, isJournalWorthy, flushJournal]);

  const handleSendLastOutputToAI = useCallback(() => {
    const last = lastCompletedCommandRef.current;
    if (!last) return;

    setShowAI(true);
    setShowSendToAI(false);

    const prompt = `Analyze this command output and tell me what you see. What are the key findings? What should I do next?\n\nCommand: \`${last.command}\`\n\n\`\`\`\n${last.output.slice(-3000)}\n\`\`\``;
    void sendMessage(prompt, context, notes);
  }, [context, notes, sendMessage]);

  const ensureCanonicalNotebook = useCallback(async () => {
    const activeNotebook = activeNotebookId
      ? notes.find((note) => note.id === activeNotebookId) ?? null
      : null;
    if (activeNotebook) {
      return activeNotebook;
    }

    const targetTitle = context.primaryTarget || currentEngagement?.name || 'Prowl Notebook';
    const existing = notes.find((note) => {
      const title = note.title.toLowerCase();
      const normalizedTarget = targetTitle.toLowerCase();
      return title === normalizedTarget || title === `${normalizedTarget} notebook`;
    }) ?? null;

    if (existing) {
      setActiveNotebook(existing.id, existing.title);
      setSelectedNote(existing.id);
      return existing;
    }

    const saved = await saveNote({
      title: targetTitle,
      content: buildCanonicalNotebookContent(targetTitle),
      source: 'ai',
      tags: ['notebook', 'ai-canonical', context.primaryTarget || 'general'],
    });

    setActiveNotebook(saved.id, saved.title);
    setSelectedNote(saved.id);
    return saved;
  }, [
    activeNotebookId,
    context.primaryTarget,
    currentEngagement?.name,
    notes,
    saveNote,
    setActiveNotebook,
    setSelectedNote,
  ]);

  const saveCanonicalNotebookUpdate = useCallback(async (
    section: Parameters<typeof mergeCanonicalNotebook>[0]['section'],
    entry: string,
    nextStep?: string
  ) => {
    const notebook = await ensureCanonicalNotebook();
    if (!notebook) {
      return null;
    }

    const mergedContent = mergeCanonicalNotebook({
      existingContent: notebook.content,
      section,
      entry,
      nextStep,
    });

    const saved = await saveNote({
      id: notebook.id,
      title: notebook.title,
      content: mergedContent,
      source: 'ai',
      tags: Array.from(new Set([...(notebook.tags || []), 'notebook', 'ai-canonical'])),
    });

    setActiveNotebook(saved.id, saved.title);
    setSelectedNote(saved.id);
    return saved;
  }, [ensureCanonicalNotebook, saveNote, setActiveNotebook, setSelectedNote]);

  useEffect(() => {
    saveCanonicalNotebookUpdateRef.current = saveCanonicalNotebookUpdate;
  }, [saveCanonicalNotebookUpdate]);

  useEffect(() => {
    if (!context.primaryTarget) {
      return;
    }
    if (activeNotebookId) {
      return;
    }
    void ensureCanonicalNotebook();
  }, [activeNotebookId, context.primaryTarget, ensureCanonicalNotebook]);

  const handleSaveToNotes = useCallback(async (content: string) => {
    const lines = content.split('\n');
    const title = lines[0].slice(0, 60) || 'AI Note';
    await quickSaveFromAI(title, content);
  }, [quickSaveFromAI]);

  const recentCommandHistoryContext = useMemo(() => {
    const normalizedTarget = context.primaryTarget.trim();
    const relevantCommands = commands
      .filter((record) => !normalizedTarget || !record.target || record.target === normalizedTarget)
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 12);

    if (relevantCommands.length === 0) {
      return '(none)';
    }

    return relevantCommands
      .map((record) => `- ${record.timestamp}: ${record.commandWithCurrentTarget || record.command}`)
      .join('\n');
  }, [commands, context.primaryTarget]);

  const aiOperatorStateContext = useMemo(() => {
    return [
      '## Saved Target Workspace',
      workspaceIntel.summaryText,
      '',
      '## Saved Command History',
      recentCommandHistoryContext,
      '',
      'Use the saved artifacts above to avoid repeating scans that already have output unless there is a clear reason to rerun them.',
      'Use the newest saved artifact to infer where the engagement last left off.',
    ].join('\n');
  }, [recentCommandHistoryContext, workspaceIntel.summaryText]);

  const backupNotebookTitle = useCallback((title: string) => {
    const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
    return `${title} - raw backup ${stamp}`;
  }, []);

  const applyNotebookAIIntent = useCallback(async (intent: NotebookAIIntent, content: string) => {
    const cleanedContent = content.trim();
    if (!cleanedContent) {
      return;
    }

    if (intent.mode === 'replace') {
      if (intent.targetNotebook?.content.trim()) {
        await saveNote({
          title: backupNotebookTitle(intent.targetNotebook.title),
          content: intent.targetNotebook.content,
          source: intent.targetNotebook.source,
          tags: intent.targetNotebook.tags,
        });
      }

      const saved = await saveNote({
        id: intent.targetNotebook?.id,
        title: intent.notebookTitle,
        content: cleanedContent,
        source: 'ai',
        tags: intent.targetNotebook?.tags ?? ['walkthrough', 'ai'],
      });

      setActiveNotebook(saved.id, saved.title);
      setSelectedNote(saved.id);
      setShowNotes(true);
      appendProactiveMessage(
        `Notebook ${saved.title} now has a cleaned walkthrough version. PROWL also kept a raw backup of the previous notebook contents.`,
        'suggestion',
        {
          eventKey: `notebook-rewrite:${saved.id}:${saved.updatedAt}`,
          cooldownMs: 1000,
        }
      );
      return;
    }

    if (intent.targetNotebook) {
      const mergedContent = intent.targetNotebook.content.trim()
        ? `${intent.targetNotebook.content}\n\n${cleanedContent}`
        : cleanedContent;
      const saved = await saveNote({
        id: intent.targetNotebook.id,
        title: intent.targetNotebook.title,
        content: mergedContent,
        source: 'ai',
        tags: intent.targetNotebook.tags,
      });
      setActiveNotebook(saved.id, saved.title);
      setSelectedNote(saved.id);
    } else {
      const saved = await quickSaveFromAI(intent.notebookTitle, cleanedContent);
      if (saved) {
        setActiveNotebook(saved.id, saved.title);
        setSelectedNote(saved.id);
      }
    }

    setShowNotes(true);
    appendProactiveMessage(
      `Notebook ${intent.notebookTitle} was updated with AI-organized walkthrough notes.`,
      'suggestion',
      {
        eventKey: `notebook-append:${intent.notebookTitle}:${Date.now()}`,
        cooldownMs: 1000,
      }
    );
  }, [
    appendProactiveMessage,
    backupNotebookTitle,
    quickSaveFromAI,
    saveNote,
    setActiveNotebook,
    setSelectedNote,
  ]);

  const handleAISendMessage = useCallback(async (
    content: string,
    currentContext: typeof context,
    currentNotes: typeof notes
  ) => {
    const notebookIntent = resolveNotebookAIIntent(content, currentNotes, activeNotebookId);
    const defaultLeadContext = [
      '## Prowl Lead Mode',
      'Default to one next command at a time unless the operator explicitly asks for a plan or full walkthrough.',
      'Interpret the latest evidence briefly, then give the next single command.',
      'If something failed, give the fix as the next command and keep the operator on track.',
      '',
      aiOperatorStateContext,
    ].join('\n');
    const assistantMessage = await sendMessage(
      content,
      currentContext,
      currentNotes,
      {
        supplementalContext: notebookIntent
          ? `${defaultLeadContext}\n\n${notebookIntent.supplementalContext}`
          : defaultLeadContext,
        logToNotebook: false,
      }
    );

    if (!notebookIntent || !assistantMessage || assistantMessage.role !== 'assistant' || assistantMessage.variant === 'warning') {
      return;
    }

    await applyNotebookAIIntent(notebookIntent, assistantMessage.content);
  }, [
    activeNotebookId,
    aiOperatorStateContext,
    applyNotebookAIIntent,
    notes,
    context,
    sendMessage,
  ]);

  const handleSearchChange = useCallback((query: string) => {
    searchNotes(query);
  }, [searchNotes]);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const commandItems: TimelineItem[] = commands.map((command, index) => ({
      id: `cmd-${index}-${command.timestamp}`,
      kind: 'command',
      title: command.command,
      summary: `Command run against ${command.target || 'current shell'}`,
      timestamp: command.timestamp,
      target: command.target || undefined,
      accent: 'default',
      actionLabel: 'rerun',
      actionPayload: command.commandWithCurrentTarget || command.command,
      actionType: 'command',
    }));

    const noteItems: TimelineItem[] = notes.map((note) => ({
      id: `note-${note.id}`,
      kind: 'note',
      title: note.title,
      summary: note.content.slice(0, 180),
      timestamp: note.updatedAt,
      accent: note.source === 'ai' ? 'accent' : 'default',
      actionLabel: 'open note',
      actionPayload: note.id,
      actionType: 'note',
    }));

    const findingItems: TimelineItem[] = findings.map((finding) => ({
      id: `finding-${finding.id}`,
      kind: 'finding',
      title: finding.title,
      summary: finding.summary,
      timestamp: finding.updatedAt,
      target: finding.target || undefined,
      accent: finding.confidence === 'high' ? 'green' : finding.confidence === 'low' ? 'amber' : 'accent',
      actionLabel:
        finding.kind === 'service'
          ? 'ask AI'
          : finding.kind === 'port'
            ? 'probe'
            : (finding.kind === 'url' || finding.metadata.url)
              ? 'open browser'
              : undefined,
      actionPayload:
        finding.kind === 'service'
          ? `What should I do next with this service finding on ${finding.target}: ${finding.summary}`
          : finding.kind === 'port' && finding.metadata.port && finding.target
            ? `nmap -sV -p ${finding.metadata.port} ${finding.target}`
            : (finding.kind === 'url' || finding.metadata.url)
              ? (finding.metadata.url || `http://${finding.target}`)
            : undefined,
      actionType:
        finding.kind === 'service'
          ? 'ai'
          : finding.kind === 'port'
            ? 'command'
            : (finding.kind === 'url' || finding.metadata.url)
              ? 'browser'
              : undefined,
    }));

    const aiItems: TimelineItem[] = messages.map((message) => ({
      id: `ai-${message.id}`,
      kind: 'ai',
      title: message.role === 'user' ? 'You asked PROWL AI' : 'PROWL AI',
      summary: message.content.slice(0, 220),
      timestamp: message.timestamp,
      accent: message.role === 'assistant' ? 'accent' : 'default',
      actionLabel: message.role === 'assistant' ? 'continue thread' : undefined,
      actionPayload: message.content,
      actionType: message.role === 'assistant' ? 'ai' : undefined,
    }));

    const eventItems: TimelineItem[] = proactiveEvents.map((event) => ({
      id: `event-${event.id}`,
      kind: 'event',
      title: event.payload.type.replace(/_/g, ' '),
      summary: JSON.stringify(event.payload).slice(0, 220),
      timestamp: event.timestamp,
      accent: 'amber',
      actionLabel: 'ask AI',
      actionPayload: `Summarize this mission event and suggest the next move: ${JSON.stringify(event.payload)}`,
      actionType: 'ai',
    }));

    return [...commandItems, ...noteItems, ...findingItems, ...aiItems, ...eventItems]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [commands, findings, messages, notes, proactiveEvents]);

  const inferredMissionMode = useMemo(
    () => inferMissionMode(context, findings, proactiveEvents),
    [context, findings, proactiveEvents]
  );

  useEffect(() => {
    setAutoMissionMode(inferredMissionMode);
  }, [inferredMissionMode, setAutoMissionMode]);

  const currentObjective = useMemo<ObjectiveCard>(() => {
    const latestTargetFinding = findings
      .filter(f => f.target === context.primaryTarget)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const latestHighConfidenceFinding = findings
      .filter(f => f.target === context.primaryTarget && f.confidence === 'high')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const latestMissionEvent = proactiveEvents
      .slice()
      .reverse()
      .find((event) => {
        switch (event.payload.type) {
          case 'browser_scanned':
          case 'vpn_connected':
          case 'container_running':
            return true;
          case 'target_set':
            return event.payload.target === context.primaryTarget;
          case 'ports_discovered':
          case 'services_discovered':
            return event.payload.context.primaryTarget === context.primaryTarget;
          default:
            return false;
        }
      });
    const hasWebSurface = context.discoveredPorts.some(port => [80, 443, 8080, 8443].includes(port));
    const hasWindowsSurface = context.discoveredPorts.some(port => [139, 445, 3389, 5985, 5986].includes(port))
      || context.scannedServices.some(service => /(smb|microsoft-ds|netbios|winrm|rdp)/i.test(service));
    const smbAccessible = context.discoveredPorts.some(port => [139, 445].includes(port));
    const missionModeIsCommandDriven = missionMode.reason.startsWith('Recent command');

    if (!context.primaryTarget) {
      return {
        key: 'objective-set-target',
        priority: 'focus' as const,
        title: 'Set the primary target',
        contextLabel: `${missionMode.label} mode • ${missionMode.reason}`,
        summary: 'Start by telling PROWL what host or IP you are working on so findings, AI guidance, and notes stay anchored to the same engagement.',
        action: {
          id: 'objective-set-target',
          label: 'Ask how to begin',
          type: 'prefill_ai' as const,
          payload: 'I am starting a new assessment. What information should I gather first?',
        },
      };
    }

    if (context.discoveredPorts.length === 0) {
      return {
        key: `objective-enumerate-${context.primaryTarget}`,
        priority: 'focus' as const,
        title: `Enumerate ${context.primaryTarget}`,
        contextLabel: `${missionMode.label} mode • ${missionMode.reason}`,
        summary: 'You have a target but no ports yet. The highest-value next move is broad TCP discovery so the rest of the workflow is grounded in real attack surface.',
        action: {
          id: `objective-enumerate-${context.primaryTarget}`,
          label: 'Run full TCP scan',
          type: 'run_command' as const,
          payload: `nmap -Pn -p- --min-rate 1000 ${context.primaryTarget} -oN ${currentWorkspacePath}/${context.primaryTarget}-full-tcp.txt`,
        },
      };
    }

    if (latestHighConfidenceFinding) {
      return {
        key: `objective-finding-${latestHighConfidenceFinding.id}`,
        priority: 'urgent' as const,
        title: 'Exploit the strongest current lead',
        contextLabel: `${missionMode.label} mode • High-confidence ${latestHighConfidenceFinding.kind} finding`,
        summary: `PROWL has high-confidence evidence around "${latestHighConfidenceFinding.title}". Use that finding to choose the next focused command sequence instead of broadening scope again.`,
        action: {
          id: `objective-finding-${latestHighConfidenceFinding.id}`,
          label: 'Ask for next steps',
          type: 'prefill_ai' as const,
          payload: `Given this finding on ${context.primaryTarget}: ${latestHighConfidenceFinding.summary}\nWhat should I do next?`,
        },
      };
    }

    if (missionMode.id === 'credentials') {
      return {
        key: `objective-credentials-${context.primaryTarget}`,
        priority: 'opportunity' as const,
        title: 'Operationalize credential material',
        contextLabel: `${missionMode.label} mode • ${missionMode.reason}`,
        summary: `PROWL sees credential-related momentum on ${context.primaryTarget}. Validate what you have, map where those credentials apply, and capture reusable auth wins before broadening scope.`,
        action: {
          id: `objective-credentials-${context.primaryTarget}`,
          label: 'Ask for credential next steps',
          type: 'prefill_ai' as const,
          payload: `I am working credential material against ${context.primaryTarget}. Based on the current findings, what are the safest next validation and exploitation steps?`,
        },
      };
    }

    if (missionMode.id === 'exploit') {
      return {
        key: `objective-exploit-${context.primaryTarget}`,
        priority: 'urgent' as const,
        title: 'Convert the active lead into execution',
        contextLabel: `${missionMode.label} mode • ${missionMode.reason}`,
        summary: `The engagement is in exploitation mode now. Keep the workflow narrow, tie actions to the strongest lead, and log the exact sequence that turns access into progress.`,
        action: {
          id: `objective-exploit-${context.primaryTarget}`,
          label: 'Ask for exploit sequence',
          type: 'prefill_ai' as const,
          payload: `I am in exploit mode on ${context.primaryTarget}. What is the best next command sequence based on the current state?`,
        },
      };
    }

    if (missionMode.id === 'internal') {
      return {
        key: `objective-internal-${context.primaryTarget}`,
        priority: 'opportunity' as const,
        title: 'Use the internal access window',
        contextLabel: `${missionMode.label} mode • ${missionMode.reason}`,
        summary: 'Fresh internal access creates a short-lived advantage. Map adjacent hosts, confirm routing, and identify the next pivot path before the window goes cold.',
        action: {
          id: `objective-internal-${context.primaryTarget}`,
          label: 'Plan internal recon',
          type: 'prefill_ai' as const,
          payload: `I am in internal recon mode for ${context.primaryTarget}. What should I do next based on the current context and tunnel state?`,
        },
      };
    }

    if (missionMode.id === 'web' && hasWebSurface && (
      missionModeIsCommandDriven
      || context.scannedServices.length > 0
      || latestMissionEvent?.payload.type === 'browser_scanned'
    )) {
      return {
        key: `objective-web-${context.primaryTarget}`,
        priority: 'focus' as const,
        title: 'Stay on the web enumeration path',
        contextLabel: `${missionMode.label} mode • ${missionMode.reason}`,
        summary: `Your recent evidence shows active web recon on ${context.primaryTarget}. Keep momentum by validating routes, technologies, and content discovery before switching tracks.`,
        action: latestMissionEvent?.payload.type === 'browser_scanned'
          ? {
              id: `objective-web-next-${context.primaryTarget}`,
              label: 'Ask for web next steps',
              type: 'prefill_ai' as const,
              payload: `I am actively enumerating the web surface on ${context.primaryTarget}. Based on the current context, what are the next three web-focused steps?`,
            }
          : {
              id: `objective-web-open-${context.primaryTarget}`,
              label: 'Open target in browser',
              type: 'open_browser' as const,
              payload: `http://${context.primaryTarget}`,
            },
      };
    }

    if (missionMode.id === 'windows' && hasWindowsSurface && (
      missionModeIsCommandDriven
      || context.scannedServices.length > 0
    )) {
      return {
        key: `objective-windows-${context.primaryTarget}`,
        priority: 'focus' as const,
        title: 'Deepen Windows and SMB enumeration',
        contextLabel: `${missionMode.label} mode • ${missionMode.reason}`,
        summary: `The current target has Windows-facing surface and your recent workflow supports staying there. Keep pushing shares, users, RPC, WinRM, and auth posture before broadening out.`,
        action: smbAccessible
          ? {
              id: `objective-windows-${context.primaryTarget}`,
              label: 'Run enum4linux',
              type: 'run_command' as const,
              payload: `enum4linux -a ${context.primaryTarget} | tee ${currentWorkspacePath}/${context.primaryTarget}-enum4linux.txt`,
            }
          : {
              id: `objective-windows-next-${context.primaryTarget}`,
              label: 'Ask for Windows next steps',
              type: 'prefill_ai' as const,
              payload: `I am enumerating Windows-facing services on ${context.primaryTarget}. What should I do next based on the current findings?`,
            },
      };
    }

    if (context.scannedServices.length === 0) {
      return {
        key: `objective-services-${context.primaryTarget}`,
        priority: 'focus' as const,
        title: 'Fingerprint discovered ports',
        contextLabel: `${missionMode.label} mode • ${context.discoveredPorts.length} open port${context.discoveredPorts.length === 1 ? '' : 's'} discovered`,
        summary: `Ports are open on ${context.primaryTarget}, but service data is still shallow. Move from discovery to fingerprinting before choosing an exploitation path.`,
        action: {
          id: `objective-services-${context.primaryTarget}`,
          label: 'Run service detection',
          type: 'run_command' as const,
          payload: `nmap -sV -sC ${context.primaryTarget} -oN ${currentWorkspacePath}/${context.primaryTarget}-services.txt`,
        },
      };
    }

    if (missionMode.id === 'dns' && (
      missionModeIsCommandDriven
      || context.scannedServices.length > 0
    )) {
      return {
        key: `objective-dns-${context.primaryTarget}`,
        priority: 'opportunity' as const,
        title: 'Resolve the naming layer before pivoting away',
        contextLabel: `${missionMode.label} mode • ${missionMode.reason}`,
        summary: 'DNS-focused work pays off when you lock in names, alternate hosts, and subdomain structure before the engagement fragments into too many paths.',
        action: {
          id: `objective-dns-${context.primaryTarget}`,
          label: 'Ask for DNS next steps',
          type: 'prefill_ai' as const,
          payload: `I am in DNS enumeration mode for ${context.primaryTarget}. What should I do next with the current context?`,
        },
      };
    }

    if (latestMissionEvent?.payload.type === 'vpn_connected') {
      return {
        key: `objective-vpn-${context.primaryTarget || 'engagement'}`,
        priority: 'opportunity' as const,
        title: 'Validate access through the VPN path',
        contextLabel: latestMissionEvent.payload.ip
          ? `${missionMode.label} mode • VPN connected: ${latestMissionEvent.payload.ip}`
          : `${missionMode.label} mode • VPN tunnel is active`,
        summary: 'You have fresh network access. Confirm routing, identify reachable hosts, and turn that connectivity into scoped reconnaissance before context goes stale.',
        action: {
          id: `objective-vpn-${context.primaryTarget || 'engagement'}`,
          label: 'Plan internal recon',
          type: 'prefill_ai' as const,
          payload: `The VPN is connected for ${context.primaryTarget || 'this engagement'}. What internal recon steps should I run first?`,
        },
      };
    }

    if (latestMissionEvent?.payload.type === 'container_running') {
      return {
        key: `objective-container-${context.primaryTarget || 'engagement'}`,
        priority: 'quiet' as const,
        title: 'Use the Kali environment deliberately',
        contextLabel: `${missionMode.label} mode • Tooling environment is ready`,
        summary: 'The container is up, so this is a good moment to launch the next deliberate scan or browser workflow instead of context switching out of the engagement.',
        action: {
          id: `objective-container-${context.primaryTarget || 'engagement'}`,
          label: 'Ask for a tool sequence',
          type: 'prefill_ai' as const,
          payload: `The Kali environment is ready for ${context.primaryTarget}. What is the best next tool sequence based on the current findings?`,
        },
      };
    }

    return {
      key: `objective-plan-${context.primaryTarget}`,
      priority: latestTargetFinding ? 'opportunity' as const : 'quiet' as const,
      title: 'Consolidate what changed',
      contextLabel: latestTargetFinding
        ? `${missionMode.label} mode • Latest finding: ${latestTargetFinding.title}`
        : `${missionMode.label} mode • ${missionMode.reason}`,
      summary: `You have target, port, and service context for ${context.primaryTarget}. The best next move is to turn the latest observations into a focused plan and capture the likely attack paths.`,
      action: {
        id: `objective-plan-${context.primaryTarget}`,
        label: 'Generate plan',
        type: 'prefill_ai' as const,
        payload: `Summarize the current state of ${context.primaryTarget} and tell me the best next three steps.`,
      },
    };
  }, [context, currentWorkspacePath, findings, missionMode, proactiveEvents]);

  const visibleObjective = dismissedObjectiveKey === currentObjective.key
    ? undefined
    : currentObjective;

  const aiActionCards = useMemo(() => {
    const cards: Array<{
      id: string;
      title: string;
      description: string;
      action: AIMessageAction;
    }> = [
      {
        id: 'card-findings',
        title: 'Review Findings',
        description: `${findings.length} structured findings are available for this engagement.`,
        action: {
          id: 'card-findings-action',
          label: 'Open findings',
          type: 'open_findings',
          payload: '',
        },
      },
      {
        id: 'card-loot',
        title: 'Inspect Loot',
        description: `Open the loot manager for ${currentEngagement?.name || 'the active engagement'}.`,
        action: {
          id: 'card-loot-action',
          label: 'Open loot',
          type: 'open_workspace',
          payload: currentWorkspacePath,
        },
      },
      {
        id: 'card-timeline',
        title: 'Follow the Timeline',
        description: 'Jump into the mission feed to review what changed most recently.',
        action: {
          id: 'card-timeline-action',
          label: 'Open timeline',
          type: 'open_timeline',
          payload: '',
        },
      },
      {
        id: 'card-note',
        title: 'Capture a Snapshot',
        description: 'Save the current state into notes before the engagement context shifts.',
        action: {
          id: 'card-note-action',
          label: 'Create note',
          type: 'create_note',
          payload: `Engagement snapshot\n\nTarget: ${context.primaryTarget || 'not set'}\nMode: ${missionMode.label}\nPorts: ${context.discoveredPorts.join(', ') || 'none'}\nServices: ${context.scannedServices.join(', ') || 'none'}`,
        },
      },
    ];

    if (missionMode.id === 'web' && context.primaryTarget) {
      cards.unshift({
        id: 'card-web',
        title: 'Drive Web Enumeration',
        description: 'Open the browser or ask for the next web-focused steps.',
        action: showBrowser
          ? {
              id: 'card-web-action-ai',
              label: 'Ask for web next steps',
              type: 'prefill_ai',
              payload: `I am working the web surface on ${context.primaryTarget}. What should I do next?`,
            }
          : {
              id: 'card-web-action-browser',
              label: 'Open target in browser',
              type: 'open_browser',
              payload: `http://${context.primaryTarget}`,
            },
      });
    } else if (missionMode.id === 'windows' && context.primaryTarget) {
      cards.unshift({
        id: 'card-windows',
        title: 'Push SMB and Windows',
        description: 'Stay focused on auth posture, shares, and Windows services.',
        action: {
          id: 'card-windows-action',
          label: 'Run enum4linux',
          type: 'run_command',
          payload: `enum4linux -a ${context.primaryTarget} | tee ${currentWorkspacePath}/${context.primaryTarget}-enum4linux.txt`,
        },
      });
    } else if (missionMode.id === 'exploit' && context.primaryTarget) {
      cards.unshift({
        id: 'card-exploit',
        title: 'Keep the Lead Warm',
        description: 'Lock onto the strongest exploit path before widening again.',
        action: {
          id: 'card-exploit-action',
          label: 'Ask for exploit sequence',
          type: 'prefill_ai',
          payload: `I am in exploit mode for ${context.primaryTarget}. What is the best next command sequence?`,
        },
      });
    }

    return cards;
  }, [
    context.discoveredPorts,
    context.primaryTarget,
    context.scannedServices,
    currentEngagement?.name,
    currentWorkspacePath,
    findings.length,
    missionMode.id,
    missionMode.label,
    showBrowser,
  ]);

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      {
        id: 'palette-ai',
        label: 'Open AI panel',
        description: 'Focus the assistant and start typing immediately.',
        group: 'Navigate',
        onSelect: () => setShowAI(true),
      },
      {
        id: 'palette-notes',
        label: 'Open notes',
        description: 'Jump to the notes panel for the active engagement.',
        group: 'Navigate',
        onSelect: () => setShowNotes(true),
      },
      {
        id: 'palette-browser',
        label: 'Open browser',
        description: 'Show the embedded browser panel.',
        group: 'Navigate',
        onSelect: () => openBrowser(),
      },
      ...(showBrowser ? [{
        id: 'palette-browser-mode',
        label: browserMode === 'focus' ? 'Dock browser into workspace' : 'Pop browser into focus view',
        description: browserMode === 'focus'
          ? 'Return the browser to the side-by-side workspace layout.'
          : 'Give the browser the full terminal workspace while keeping AI scanning intact.',
        group: 'Navigate',
        onSelect: () => toggleBrowserMode(),
      }] : []),
      {
        id: 'palette-findings',
        label: 'Open findings',
        description: 'Review structured findings for the active engagement.',
        group: 'Navigate',
        onSelect: () => setFindingsOpenRequest((value) => value + 1),
      },
      {
        id: 'palette-loot',
        label: 'Open loot manager',
        description: 'Inspect files captured in the current workspace.',
        group: 'Navigate',
        onSelect: () => setWorkspaceOpenRequest((value) => value + 1),
      },
      {
        id: 'palette-timeline',
        label: 'Open mission timeline',
        description: 'Review the chronological event feed for this engagement.',
        group: 'Navigate',
        onSelect: () => setTimelineOpenRequest((value) => value + 1),
      },
      {
        id: 'palette-split',
        label: layout === 'split' ? 'Disable split terminals' : 'Enable split terminals',
        description: 'Toggle side-by-side terminal panes.',
        group: 'Terminal',
        onSelect: () => toggleSplit(),
      },
      {
        id: 'palette-local',
        label: 'New local shell',
        description: 'Open another local terminal tab.',
        group: 'Terminal',
        onSelect: () => addTab('local'),
      },
      {
        id: 'palette-kali',
        label: 'New Kali terminal',
        description: 'Open another Kali-backed terminal tab.',
        group: 'Terminal',
        onSelect: () => addTab('kali'),
      },
      {
        id: 'palette-mode-auto',
        label: 'Use automatic mission mode',
        description: 'Let PROWL infer the current phase from your activity and findings.',
        group: 'Mode',
        onSelect: () => clearManualMissionMode(),
      },
    ];

    if (context.primaryTarget) {
      items.push({
        id: 'palette-fullscan',
        label: `Run full TCP scan on ${context.primaryTarget}`,
        description: 'Kick off broad discovery against the primary target.',
        group: 'Recon',
        onSelect: () => executeTerminalCommand(`nmap -Pn -p- --min-rate 1000 ${context.primaryTarget} -oN ${currentWorkspacePath}/${context.primaryTarget}-full-tcp.txt`),
      });
      items.push({
        id: 'palette-servicescan',
        label: `Run service detection on ${context.primaryTarget}`,
        description: 'Deepen service fingerprinting for the current host.',
        group: 'Recon',
        onSelect: () => executeTerminalCommand(`nmap -sV -sC ${context.primaryTarget} -oN ${currentWorkspacePath}/${context.primaryTarget}-services.txt`),
      });
    }

    tabs.forEach((tab) => {
      items.push({
        id: `palette-tab-${tab.id}`,
        label: `Focus ${tab.title}`,
        description: 'Switch the active terminal tab.',
        group: 'Tabs',
        keywords: [tab.shellType],
        onSelect: () => setActiveTab(tab.id),
      });
      if (layout === 'split' && tab.id !== activeTabId) {
        items.push({
          id: `palette-split-${tab.id}`,
          label: `Show ${tab.title} in split pane`,
          description: 'Route this tab into the secondary split pane.',
          group: 'Tabs',
          onSelect: () => {
            setSecondaryTab(tab.id);
            if (layout !== 'split') toggleSplit();
          },
        });
      }
    });

    engagements.forEach((engagement) => {
      items.push({
        id: `palette-engagement-${engagement.id}`,
        label: `Switch to ${engagement.name}`,
        description: engagement.primaryTarget
          ? `Primary target: ${engagement.primaryTarget}`
          : 'No primary target set yet.',
        group: 'Engagements',
        onSelect: () => {
          void selectEngagement(engagement.id);
        },
      });
    });

    (Object.keys(MISSION_MODE_META) as MissionModeId[]).forEach((modeId) => {
      items.push({
        id: `palette-mode-${modeId}`,
        label: `Pin ${MISSION_MODE_META[modeId].label} mode`,
        description: MISSION_MODE_META[modeId].description,
        group: 'Mode',
        onSelect: () => {
          setManualMissionMode({
            id: modeId,
            label: MISSION_MODE_META[modeId].label,
            description: MISSION_MODE_META[modeId].description,
            source: 'manual',
            confidence: 'high',
            reason: `Pinned from command palette: ${MISSION_MODE_META[modeId].label}`,
            updatedAt: new Date().toISOString(),
          });
        },
      });
    });

    return items;
  }, [
    activeTabId,
    addTab,
    browserMode,
    clearManualMissionMode,
    context.primaryTarget,
    currentWorkspacePath,
    engagements,
    executeTerminalCommand,
    layout,
    openBrowser,
    selectEngagement,
    setActiveTab,
    setManualMissionMode,
    setSecondaryTab,
    showBrowser,
    tabs,
    toggleBrowserMode,
    toggleSplit,
  ]);

  const visiblePaneIds = useMemo(() => {
    const paneIds = layout === 'split'
      ? [activeTabId, secondaryTabId].filter(Boolean) as string[]
      : (activeTabId ? [activeTabId] : []);
    return Array.from(new Set(paneIds));
  }, [activeTabId, layout, secondaryTabId]);

  const browserDocked = showBrowser && browserMode === 'dock';
  const browserFocused = showBrowser && browserMode === 'focus';

  return (
    <div className="app-layout">
      <TitleBar
        showNotes={showNotes}
        showAI={showAI}
        showBrowser={showBrowser}
        isSplitLayout={layout === 'split'}
        currentEngagementName={currentEngagement?.name}
        missionModeLabel={missionMode.label}
        openWorkspaceRequest={workspaceOpenRequest}
        openFindingsRequest={findingsOpenRequest}
        openTimelineRequest={timelineOpenRequest}
        onToggleNotes={() => setShowNotes(v => !v)}
        onToggleAI={() => {
          if (!showAI && !hasApiKey) openModal();
          setShowAI(v => !v);
        }}
        onToggleBrowser={() => {
          if (showBrowser) {
            closeBrowser();
          } else {
            openBrowser(browserSessionUrl || undefined);
          }
        }}
        onToggleSplit={() => toggleSplit()}
        onOpenEngagements={() => setShowEngagementPanel(true)}
        onOpenMissionModes={() => setShowMissionModePanel(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onRunCommand={executeTerminalCommand}
        onOpenFindingBrowser={(url) => {
          openBrowser(url);
        }}
        onSaveFindingNote={(content) => {
          void handleSaveToNotes(content);
          setShowNotes(true);
        }}
        timelineItems={timelineItems}
        onOpenTimelineAI={(prompt) => {
          setShowAI(true);
          setAiInitialInput(prompt);
        }}
        onOpenTimelineBrowser={(url) => {
          openBrowser(url);
        }}
        onOpenTimelineNote={(noteId) => {
          setShowNotes(true);
          setSelectedNote(noteId);
        }}
        credentials={credentials}
        onSaveCredential={(cred) => {
          const newCred = { ...cred, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
          setCredentials(prev => [...prev, newCred as import('./components/CredentialVault').Credential]);
        }}
        onDeleteCredential={(id) => setCredentials(prev => prev.filter(c => c.id !== id))}
        onUseCredential={(cred, tool) => {
          const ip = context.primaryTarget || '';
          if (tool === 'ssh') {
            handleQuickCommand(`ssh ${cred.username}@${ip}`);
          } else if (tool === 'winrm') {
            handleQuickCommand(`evil-winrm -i ${ip} -u ${cred.username} -p ${cred.password}`);
          }
        }}
        onGenerateReport={async (prompt) => runBackgroundTask(prompt, context, notes)}
        onAskAIFromExploit={(prompt) => {
          setShowAI(true);
          setAiInitialInput(prompt);
        }}
        currentEngagementId={currentEngagement?.id || 'default'}
        missionModeId={missionMode.id}
        onRunToolFromChecklist={(toolId) => {
          const { TOOL_COMMANDS } = require('@shared/constants');
          const tool = TOOL_COMMANDS.find((t: any) => t.id === toolId);
          if (tool) {
            const ip = context.primaryTarget || '';
            const hostname = currentEngagement?.hostname || ip;
            const cmd = tool.cmd
              .replace(/\{IP\}/g, ip)
              .replace(/\{HOST\}/g, hostname)
              .replace(/\{URL\}/g, hostname ? `http://${hostname}` : `http://${ip}`);
            handleQuickCommand(cmd);
          }
        }}
      />

      <div className="main-content">
        {/* Notes Panel */}
        <div
          className={`notes-panel ${showNotes ? '' : 'collapsed'}`}
          style={showNotes ? { width: notesWidth, minWidth: notesWidth } : undefined}
        >
          <NotesPanel
            notes={filteredNotes}
            selectedNoteId={selectedNoteId}
            searchQuery={searchQuery}
            currentEngagement={currentEngagement}
            onSelectNote={setSelectedNote}
            onSearchChange={handleSearchChange}
            onDeleteNote={deleteNote}
            onQuickCommand={handleQuickCommand}
            onExportNotes={exportNotes}
            onPrefillTerminal={handleQuickCommand}
          />
        </div>
        {showNotes && <div className="resize-handle" onMouseDown={handleResizeMouseDown('notes')} />}

        {/* Terminal + Browser Area */}
        <div className="terminal-area">
          {layout === 'split' && visiblePaneIds.length > 1 && (
            <div className="terminal-split-toolbar">
              <span className="section-label" style={{ marginBottom: 0 }}>Split Layout</span>
              <select
                className="findings-select"
                value={secondaryTabId ?? ''}
                onChange={(e) => setSecondaryTab(e.target.value || null)}
                style={{ minWidth: 180, padding: '4px 8px', fontSize: 11 }}
              >
                {tabs.filter((tab) => tab.id !== activeTabId).map((tab) => (
                  <option key={tab.id} value={tab.id}>{tab.title}</option>
                ))}
              </select>
            </div>
          )}
          <div className={`terminal-browser-row ${browserFocused ? 'browser-focus-active' : ''}`}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: layout === 'split' && visiblePaneIds.length > 1 ? 'row' : 'column',
                overflow: 'hidden',
                minWidth: 0,
                gap: layout === 'split' && visiblePaneIds.length > 1 ? 1 : 0,
                position: 'relative',
              }}
            >
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  data-tab-id={tab.id}
                  style={{
                    flex: 1,
                    display: visiblePaneIds.includes(tab.id) ? 'flex' : 'none',
                    flexDirection: 'column',
                    minHeight: 0,
                    minWidth: 0,
                    borderRight: layout === 'split' && visiblePaneIds.length > 1 && tab.id === activeTabId ? '1px solid var(--border)' : 'none',
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Terminal
                    tabId={tab.id}
                    isActive={tab.id === activeTabId}
                    onKeywordCommand={handleKeywordCommand}
                    onCommandComplete={handleCommandComplete}
                    onLinkClick={(url) => openBrowser(url)}
                  />
                </div>
              ))}
              {/* Floating "Send to Prowl AI" button */}
              {showSendToAI && hasApiKey && (
                <button
                  className="send-to-ai-btn"
                  onClick={handleSendLastOutputToAI}
                  title="Send last command output to Prowl AI for analysis"
                >
                  Send to Prowl AI
                </button>
              )}
            </div>
            {browserDocked && (
              <div className="resize-handle" onMouseDown={handleResizeMouseDown('browser')} />
            )}
            {showBrowser && (
              <div
                className={`browser-shell ${browserDocked ? 'docked' : 'focused'}`}
                style={browserDocked ? { width: browserWidth, minWidth: browserWidth } : undefined}
              >
                <BrowserPanel
                  socksPort={socksPort}
                  onPageContent={handlePageContent}
                  initialUrl={browserInitialUrl}
                  onInitialUrlHandled={() => setBrowserInitialUrl('')}
                  restoredUrl={browserSessionUrl}
                  onCurrentUrlChange={setBrowserSessionUrl}
                  mode={browserMode}
                  onToggleMode={toggleBrowserMode}
                  onClose={closeBrowser}
                />
              </div>
            )}
          </div>
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
        {showAI && <div className="resize-handle" onMouseDown={handleResizeMouseDown('ai')} />}
        <div
          className={`ai-panel ${showAI ? '' : 'collapsed'}`}
          style={showAI ? { width: aiWidth, minWidth: aiWidth } : undefined}
        >
          <AIPanel
            messages={messages}
            isThinking={isThinking}
            hasApiKey={hasApiKey}
            onSendMessage={handleAISendMessage}
            onSaveToNotes={handleSaveToNotes}
            onRunCommand={handleQuickCommand}
            onOpenApiModal={openModal}
            onMessageAction={handleAIMessageAction}
            context={context}
            notes={notes}
            currentObjective={visibleObjective}
            actionCards={aiActionCards}
            onDismissObjective={() => setDismissedObjectiveKey(currentObjective.key)}
            initialInput={aiInitialInput}
            onClearInitialInput={() => setAiInitialInput('')}
          />
        </div>
      </div>

      <StatusBar
        context={context}
        noteCount={notes.length}
        findingCount={findings.length}
        isAIActive={hasApiKey}
        isThinking={isThinking}
      />

      {showApiKeyModal && (
        <APIKeyModal
          onSave={saveApiKey}
          onDismiss={dismissModal}
        />
      )}

      {showHelpModal && (
        <HelpModal
          onClose={() => setShowHelpModal(false)}
          onCopyCommand={handleQuickCommand}
        />
      )}

      {showEngagementPanel && (
        <EngagementPanel
          engagements={engagements}
          currentEngagementId={currentEngagementId}
          onClose={() => setShowEngagementPanel(false)}
          onSelect={(id) => {
            void selectEngagement(id).then(() => setShowEngagementPanel(false));
          }}
          onSave={async (engagement) => {
            const saved = await saveEngagement(engagement);
            if (!engagement.id) {
              await selectEngagement(saved.id);
            }
          }}
          onDelete={async (id) => {
            await deleteEngagement(id);
          }}
          onResetMemory={async (id) => {
            await handleResetEngagementMemory(id);
          }}
        />
      )}

      {showMissionModePanel && (
        <MissionModePanel
          currentMode={missionMode}
          onClose={() => setShowMissionModePanel(false)}
          onSelectMode={(modeId) => {
            setManualMissionMode({
              id: modeId,
              label: MISSION_MODE_META[modeId].label,
              description: MISSION_MODE_META[modeId].description,
              source: 'manual',
              confidence: 'high',
              reason: `Pinned by operator: ${MISSION_MODE_META[modeId].label}`,
              updatedAt: new Date().toISOString(),
            });
            setShowMissionModePanel(false);
          }}
          onUseAuto={() => {
            clearManualMissionMode();
            setShowMissionModePanel(false);
          }}
        />
      )}

      {showCommandPalette && (
        <CommandPalette
          items={paletteItems}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
    </div>
  );
};

export default App;
