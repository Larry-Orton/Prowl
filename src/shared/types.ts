export interface Note {
  id: string;
  engagementId?: string;
  title: string;
  content: string;
  tags: string[];
  source: 'manual' | 'terminal' | 'ai';
  createdAt: string;
  updatedAt: string;
}

export interface NoteRow {
  id: string;
  engagementId?: string;
  title: string;
  content: string;
  tags: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommandRecord {
  command: string;
  target: string;
  timestamp: string;
  engagementId?: string;
  commandWithCurrentTarget?: string;
}

export type FindingKind = 'target' | 'port' | 'service' | 'url' | 'credential' | 'vulnerability' | 'file' | 'note';
export type FindingSource = 'terminal' | 'ai' | 'browser' | 'workspace' | 'manual';

export interface Finding {
  id: string;
  engagementId?: string;
  kind: FindingKind;
  target: string;
  title: string;
  summary: string;
  source: FindingSource;
  confidence: 'low' | 'medium' | 'high';
  tags: string[];
  metadata: Record<string, string>;
  relatedNoteId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FindingRow {
  id: string;
  engagementId?: string;
  kind: string;
  target: string;
  title: string;
  summary: string;
  source: string;
  confidence: string;
  tags: string;
  metadata: string;
  relatedNoteId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalTab {
  id: string;
  title: string;
  shellType: 'local' | 'kali';
  isActive: boolean;
}

export interface TerminalActivityEntry {
  id: string;
  command: string;
  output: string;
  startedAt: string;
  updatedAt: string;
}

export interface TerminalSessionContext {
  tabId: string;
  title: string;
  shellType: 'local' | 'kali';
  updatedAt: string;
  recentActivity: TerminalActivityEntry[];
}

export interface ActiveContext {
  primaryTarget: string;
  discoveredPorts: number[];
  scannedServices: string[];
  lastCommandOutput: string;
  recentCommands: string[];
  sessionNotes: string[];
  terminalSessions: TerminalSessionContext[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  variant?: 'chat' | 'proactive' | 'warning' | 'suggestion' | 'lead';
  content: string;
  timestamp: string;
  actions?: AIMessageAction[];
  logToNotebook?: boolean;
}

export interface AIMessageAction {
  id: string;
  label: string;
  type:
    | 'run_command'
    | 'prefill_ai'
    | 'open_browser'
    | 'save_finding'
    | 'append_notebook'
    | 'open_findings'
    | 'open_workspace'
    | 'open_timeline'
    | 'create_note'
    | 'set_mission_mode';
  payload: string;
}

export type MissionModeId = 'planning' | 'recon' | 'web' | 'windows' | 'internal' | 'credentials' | 'exploit' | 'dns';
export type MissionModeSource = 'auto' | 'manual';
export type MissionModeConfidence = 'low' | 'medium' | 'high';

export interface MissionMode {
  id: MissionModeId;
  label: string;
  description: string;
  source: MissionModeSource;
  confidence: MissionModeConfidence;
  reason: string;
  updatedAt: string;
}

export interface Engagement {
  id: string;
  name: string;
  primaryTarget?: string;
  workspacePath?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EngagementRow {
  id: string;
  name: string;
  primaryTarget?: string;
  workspacePath?: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

// ── Container Types ────────────────────────────

export type ContainerRuntime = 'docker' | 'podman' | null;
export type ContainerStatus = 'not_installed' | 'no_image' | 'stopped' | 'running' | 'update_available';

export interface VPNStatus {
  connected: boolean;
  ip?: string;
  file?: string;
}

// ── Electron IPC APIs ──────────────────────────

export interface ElectronShellAPI {
  spawn: (id: string, type?: 'local' | 'kali') => Promise<void>;
  write: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  onData: (callback: (id: string, data: string) => void) => (() => void);
  onExit: (callback: (id: string) => void) => (() => void);
  onKeywordAction: (callback: (id: string, action: any) => void) => (() => void);
  removeDataListener: () => void;
}

export interface ElectronNotesAPI {
  save: (note: Partial<Note> & { id: string }) => Promise<Note>;
  getAll: (engagementId?: string) => Promise<Note[]>;
  search: (query: string, engagementId?: string) => Promise<Note[]>;
  remove: (id: string) => Promise<void>;
}

export interface ElectronCommandsAPI {
  save: (command: string, target: string, engagementId?: string) => Promise<CommandRecord>;
  getAll: (engagementId?: string) => Promise<CommandRecord[]>;
  search: (query: string, currentTarget?: string, engagementId?: string) => Promise<CommandRecord[]>;
}

export interface ElectronFindingsAPI {
  save: (finding: Partial<Finding> & { id: string }) => Promise<Finding>;
  getAll: (engagementId?: string) => Promise<Finding[]>;
  search: (query: string, engagementId?: string) => Promise<Finding[]>;
  remove: (id: string) => Promise<void>;
}

export interface ElectronEngagementsAPI {
  save: (engagement: Partial<Engagement> & { id: string }) => Promise<Engagement>;
  getAll: () => Promise<Engagement[]>;
  delete: (id: string) => Promise<void>;
  getCurrent: () => Promise<string>;
  setCurrent: (id: string) => Promise<string>;
  resetMemory: (id: string) => Promise<Engagement>;
}

export interface ElectronAIAPI {
  send: (messages: { role: string; content: string }[], systemPrompt: string) => Promise<string>;
  getApiKey: () => Promise<boolean>;
  setApiKey: (key: string) => Promise<void>;
  deleteApiKey: () => Promise<void>;
}

export interface ElectronContainerAPI {
  detectRuntime: () => Promise<ContainerRuntime>;
  getStatus: () => Promise<ContainerStatus>;
  buildImage: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  installTool: (name: string) => Promise<string>;
  onBuildProgress: (callback: (line: string) => void) => (() => void);
}

export interface ElectronVPNAPI {
  upload: (filePath: string) => Promise<string>;
  connect: (filename: string) => Promise<string>;
  disconnect: () => Promise<void>;
  deleteFile: (filename: string) => Promise<void>;
  getStatus: () => Promise<VPNStatus>;
  listFiles: () => Promise<string[]>;
  selectFile: () => Promise<string | null>;
}

export interface ElectronBrowserAPI {
  getSocksPort: () => Promise<number>;
  capturePageContent: (url: string) => Promise<string>;
}

export interface WorkspaceFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
}

export interface ElectronWorkspaceAPI {
  listFiles: (dirPath?: string) => Promise<WorkspaceFile[]>;
  readFile: (filePath: string) => Promise<string | null>;
  deleteFile: (filePath: string) => Promise<boolean>;
}

export interface ElectronDialogAPI {
  saveFile: (content: string, defaultName: string) => Promise<boolean>;
}

export interface ElectronWindowAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  dragMove: (deltaX: number, deltaY: number) => void;
}

export interface ElectronAPI {
  shell: ElectronShellAPI;
  engagements: ElectronEngagementsAPI;
  notes: ElectronNotesAPI;
  commands: ElectronCommandsAPI;
  findings: ElectronFindingsAPI;
  ai: ElectronAIAPI;
  container: ElectronContainerAPI;
  vpn: ElectronVPNAPI;
  browser: ElectronBrowserAPI;
  workspace: ElectronWorkspaceAPI;
  dialog: ElectronDialogAPI;
  window: ElectronWindowAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
