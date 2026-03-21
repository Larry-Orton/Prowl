export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: 'manual' | 'terminal' | 'ai';
  createdAt: string;
  updatedAt: string;
}

export interface NoteRow {
  id: string;
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
  commandWithCurrentTarget?: string;
}

export interface TerminalTab {
  id: string;
  title: string;
  isActive: boolean;
}

export interface ActiveContext {
  primaryTarget: string;
  discoveredPorts: number[];
  scannedServices: string[];
  lastCommandOutput: string;
  recentCommands: string[];
  sessionNotes: string[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ElectronShellAPI {
  spawn: (id: string) => Promise<void>;
  write: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  onData: (callback: (id: string, data: string) => void) => (() => void);
  onExit: (callback: (id: string) => void) => (() => void);
  removeDataListener: () => void;
}

export interface ElectronNotesAPI {
  save: (note: Partial<Note> & { id: string }) => Promise<Note>;
  getAll: () => Promise<Note[]>;
  search: (query: string) => Promise<Note[]>;
  remove: (id: string) => Promise<void>;
}

export interface ElectronCommandsAPI {
  save: (command: string, target: string) => Promise<CommandRecord>;
  getAll: () => Promise<CommandRecord[]>;
  search: (query: string, currentTarget?: string) => Promise<CommandRecord[]>;
}

export interface ElectronAIAPI {
  send: (messages: { role: string; content: string }[], systemPrompt: string) => Promise<string>;
  getApiKey: () => Promise<boolean>;
  setApiKey: (key: string) => Promise<void>;
  deleteApiKey: () => Promise<void>;
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
  notes: ElectronNotesAPI;
  commands: ElectronCommandsAPI;
  ai: ElectronAIAPI;
  dialog: ElectronDialogAPI;
  window: ElectronWindowAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
