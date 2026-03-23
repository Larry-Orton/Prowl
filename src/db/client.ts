/**
 * JSON-based persistence layer — no native modules, zero compilation issues.
 * Data is stored at: userData/prowl-data.json
 */
import fs from 'fs';
import path from 'path';
import { app, safeStorage } from 'electron';
import { DEFAULT_ENGAGEMENT_ID, DEFAULT_ENGAGEMENT_NAME } from '../shared/constants';
import type {
  Note,
  NoteRow,
  CommandRecord,
  Finding,
  FindingRow,
  Engagement,
  EngagementRow,
} from '../shared/types';

interface ProwlData {
  notes: NoteRow[];
  commands: CommandRecord[];
  findings: FindingRow[];
  engagements: EngagementRow[];
  encryptedApiKey?: string;
  settings?: {
    currentEngagementId?: string;
    [key: string]: unknown;
  };
}

let dataPath: string | null = null;

function getDataPath(): string {
  if (!dataPath) {
    const userDataPath = app.getPath('userData');
    dataPath = path.join(userDataPath, 'prowl-data.json');
  }
  return dataPath;
}

function createDefaultEngagementRow(): EngagementRow {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_ENGAGEMENT_ID,
    name: DEFAULT_ENGAGEMENT_NAME,
    primaryTarget: '',
    workspacePath: `/workspace/${DEFAULT_ENGAGEMENT_ID}`,
    tags: '[]',
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeEngagementId(engagementId?: string): string {
  return engagementId || DEFAULT_ENGAGEMENT_ID;
}

function resolveEngagementId(data: ProwlData, engagementId?: string): string {
  return normalizeEngagementId(engagementId || data.settings?.currentEngagementId);
}

function ensureDataShape(input: Partial<ProwlData> | undefined): ProwlData {
  const data: ProwlData = {
    notes: Array.isArray(input?.notes) ? input!.notes : [],
    commands: Array.isArray(input?.commands) ? input!.commands : [],
    findings: Array.isArray(input?.findings) ? input!.findings : [],
    engagements: Array.isArray(input?.engagements) ? input!.engagements : [],
    encryptedApiKey: input?.encryptedApiKey,
    settings: typeof input?.settings === 'object' && input?.settings !== null ? input.settings : {},
  };

  if (data.engagements.length === 0) {
    data.engagements = [createDefaultEngagementRow()];
  }

  if (!data.engagements.some((engagement) => engagement.id === DEFAULT_ENGAGEMENT_ID)) {
    data.engagements.unshift(createDefaultEngagementRow());
  }

  data.notes = data.notes.map((note) => ({
    ...note,
    engagementId: normalizeEngagementId(note.engagementId),
  }));
  data.commands = data.commands.map((command) => ({
    ...command,
    engagementId: normalizeEngagementId(command.engagementId),
  }));
  data.findings = data.findings.map((finding) => ({
    ...finding,
    engagementId: normalizeEngagementId(finding.engagementId),
  }));
  data.engagements = data.engagements.map((engagement) => ({
    ...engagement,
    workspacePath: engagement.workspacePath || `/workspace/${engagement.id}`,
    tags: engagement.tags || '[]',
  }));

  data.settings = {
    ...data.settings,
    currentEngagementId: normalizeEngagementId(data.settings?.currentEngagementId),
  };

  if (!data.engagements.some((engagement) => engagement.id === data.settings?.currentEngagementId)) {
    data.settings.currentEngagementId = DEFAULT_ENGAGEMENT_ID;
  }

  return data;
}

function readData(): ProwlData {
  const p = getDataPath();
  if (!fs.existsSync(p)) {
    const initial = ensureDataShape({ notes: [], commands: [], findings: [], engagements: [] });
    writeData(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    const data = ensureDataShape(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(data)) {
      writeData(data);
    }
    return data;
  } catch {
    return ensureDataShape({ notes: [], commands: [], findings: [], engagements: [] });
  }
}

function writeData(data: ProwlData): void {
  const p = getDataPath();
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Notes ──────────────────────────────────────────

export function getDatabase(): null {
  return null;
}

export function saveNote(_db: null, note: Partial<Note> & { id: string }): Note {
  const data = readData();
  const now = new Date().toISOString();
  const idx = data.notes.findIndex(n => n.id === note.id);
  const engagementId = resolveEngagementId(data, note.engagementId);

  if (idx >= 0) {
    const existing = data.notes[idx];
    const updated: NoteRow = {
      id: note.id,
      engagementId,
      title: note.title ?? existing.title,
      content: note.content ?? existing.content,
      tags: note.tags ? JSON.stringify(note.tags) : existing.tags,
      source: note.source ?? existing.source,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    data.notes[idx] = updated;
    writeData(data);
    return rowToNote(updated);
  } else {
    const newNote: NoteRow = {
      id: note.id,
      engagementId,
      title: note.title ?? 'Untitled',
      content: note.content ?? '',
      tags: note.tags ? JSON.stringify(note.tags) : '[]',
      source: note.source ?? 'manual',
      createdAt: now,
      updatedAt: now,
    };
    data.notes.unshift(newNote);
    writeData(data);
    return rowToNote(newNote);
  }
}

export function getAllNotes(_db: null, engagementId?: string): Note[] {
  const data = readData();
  const resolvedEngagementId = resolveEngagementId(data, engagementId);
  return [...data.notes]
    .filter((note) => normalizeEngagementId(note.engagementId) === resolvedEngagementId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(rowToNote);
}

export function searchNotes(_db: null, query: string, engagementId?: string): Note[] {
  const data = readData();
  const q = query.toLowerCase();
  const resolvedEngagementId = resolveEngagementId(data, engagementId);
  return data.notes
    .filter(n =>
      normalizeEngagementId(n.engagementId) === resolvedEngagementId &&
      (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      )
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(rowToNote);
}

export function deleteNote(_db: null, id: string): void {
  const data = readData();
  data.notes = data.notes.filter(n => n.id !== id);
  writeData(data);
}

function rowToNote(row: NoteRow): Note {
  let tags: string[] = [];
  try {
    tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    engagementId: normalizeEngagementId(row.engagementId),
    title: row.title,
    content: row.content,
    tags,
    source: row.source as Note['source'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Command History ────────────────────────────────

export function saveCommand(cmd: string, target: string, engagementId?: string): CommandRecord {
  const data = readData();
  const record: CommandRecord = {
    command: cmd,
    target: target || '',
    timestamp: new Date().toISOString(),
    engagementId: resolveEngagementId(data, engagementId),
  };
  data.commands.unshift(record);
  // Keep last 500 commands
  if (data.commands.length > 500) {
    data.commands = data.commands.slice(0, 500);
  }
  writeData(data);
  return record;
}

export function getCommands(engagementId?: string): CommandRecord[] {
  const data = readData();
  const resolvedEngagementId = resolveEngagementId(data, engagementId);
  return data.commands.filter((command) => normalizeEngagementId(command.engagementId) === resolvedEngagementId);
}

export function searchCommands(query: string, currentTarget?: string, engagementId?: string): CommandRecord[] {
  const data = readData();
  const q = query.toLowerCase();
  const resolvedEngagementId = resolveEngagementId(data, engagementId);
  const results = data.commands.filter(c =>
    normalizeEngagementId(c.engagementId) === resolvedEngagementId &&
    c.command.toLowerCase().includes(q)
  );

  // If there's a current target, substitute the old target with the new one in results
  if (currentTarget) {
    return results.map(c => {
      if (c.target && c.target !== currentTarget) {
        return {
          ...c,
          commandWithCurrentTarget: c.command.replace(
            new RegExp(c.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            currentTarget
          ),
        };
      }
      return c;
    });
  }

  return results;
}

// —— Findings ————————————————————————————————————————————————

export function saveFinding(finding: Partial<Finding> & { id: string }): Finding {
  const data = readData();
  const now = new Date().toISOString();
  const idx = data.findings.findIndex(f => f.id === finding.id);
  const engagementId = resolveEngagementId(data, finding.engagementId);

  if (idx >= 0) {
    const existing = data.findings[idx];
    const updated: FindingRow = {
      id: finding.id,
      engagementId,
      kind: finding.kind ?? existing.kind,
      target: finding.target ?? existing.target,
      title: finding.title ?? existing.title,
      summary: finding.summary ?? existing.summary,
      source: finding.source ?? existing.source,
      confidence: finding.confidence ?? existing.confidence,
      tags: finding.tags ? JSON.stringify(finding.tags) : existing.tags,
      metadata: finding.metadata ? JSON.stringify(finding.metadata) : existing.metadata,
      relatedNoteId: finding.relatedNoteId ?? existing.relatedNoteId,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    data.findings[idx] = updated;
    writeData(data);
    return rowToFinding(updated);
  }

  const row: FindingRow = {
    id: finding.id,
    engagementId,
    kind: finding.kind ?? 'note',
    target: finding.target ?? '',
    title: finding.title ?? 'Untitled finding',
    summary: finding.summary ?? '',
    source: finding.source ?? 'manual',
    confidence: finding.confidence ?? 'medium',
    tags: JSON.stringify(finding.tags ?? []),
    metadata: JSON.stringify(finding.metadata ?? {}),
    relatedNoteId: finding.relatedNoteId,
    createdAt: now,
    updatedAt: now,
  };
  data.findings.unshift(row);
  writeData(data);
  return rowToFinding(row);
}

export function getFindings(engagementId?: string): Finding[] {
  const data = readData();
  const resolvedEngagementId = resolveEngagementId(data, engagementId);
  return [...data.findings]
    .filter((finding) => normalizeEngagementId(finding.engagementId) === resolvedEngagementId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(rowToFinding);
}

export function searchFindings(query: string, engagementId?: string): Finding[] {
  const data = readData();
  const q = query.toLowerCase();
  const resolvedEngagementId = resolveEngagementId(data, engagementId);
  return data.findings
    .filter(f =>
      normalizeEngagementId(f.engagementId) === resolvedEngagementId &&
      (f.title.toLowerCase().includes(q) ||
      f.summary.toLowerCase().includes(q) ||
      f.target.toLowerCase().includes(q))
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(rowToFinding);
}

export function deleteFinding(id: string): void {
  const data = readData();
  data.findings = data.findings.filter(f => f.id !== id);
  writeData(data);
}

function rowToFinding(row: FindingRow): Finding {
  let tags: string[] = [];
  let metadata: Record<string, string> = {};
  try {
    tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
  } catch {
    tags = [];
  }
  try {
    metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    engagementId: normalizeEngagementId(row.engagementId),
    kind: row.kind as Finding['kind'],
    target: row.target,
    title: row.title,
    summary: row.summary,
    source: row.source as Finding['source'],
    confidence: row.confidence as Finding['confidence'],
    tags,
    metadata,
    relatedNoteId: row.relatedNoteId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// -- Engagements -------------------------------------------------------------

export function saveEngagement(engagement: Partial<Engagement> & { id: string }): Engagement {
  const data = readData();
  const now = new Date().toISOString();
  const idx = data.engagements.findIndex((item) => item.id === engagement.id);

  if (idx >= 0) {
    const existing = data.engagements[idx];
    const updated: EngagementRow = {
      id: engagement.id,
      name: engagement.name ?? existing.name,
      primaryTarget: engagement.primaryTarget ?? existing.primaryTarget,
      workspacePath: engagement.workspacePath ?? existing.workspacePath ?? `/workspace/${engagement.id}`,
      tags: engagement.tags ? JSON.stringify(engagement.tags) : existing.tags,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    data.engagements[idx] = updated;
    writeData(data);
    return rowToEngagement(updated);
  }

  const row: EngagementRow = {
    id: engagement.id,
    name: engagement.name ?? 'Untitled Engagement',
    primaryTarget: engagement.primaryTarget ?? '',
    workspacePath: engagement.workspacePath ?? `/workspace/${engagement.id}`,
    tags: JSON.stringify(engagement.tags ?? []),
    createdAt: now,
    updatedAt: now,
  };
  data.engagements.unshift(row);
  writeData(data);
  return rowToEngagement(row);
}

export function getEngagements(): Engagement[] {
  const data = readData();
  return [...data.engagements]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(rowToEngagement);
}

export function deleteEngagement(id: string): void {
  if (id === DEFAULT_ENGAGEMENT_ID) return;

  const data = readData();
  data.engagements = data.engagements.filter((engagement) => engagement.id !== id);
  data.notes = data.notes.map((note) => (
    normalizeEngagementId(note.engagementId) === id
      ? { ...note, engagementId: DEFAULT_ENGAGEMENT_ID }
      : note
  ));
  data.commands = data.commands.map((command) => (
    normalizeEngagementId(command.engagementId) === id
      ? { ...command, engagementId: DEFAULT_ENGAGEMENT_ID }
      : command
  ));
  data.findings = data.findings.map((finding) => (
    normalizeEngagementId(finding.engagementId) === id
      ? { ...finding, engagementId: DEFAULT_ENGAGEMENT_ID }
      : finding
  ));

  if (normalizeEngagementId(data.settings?.currentEngagementId) === id) {
    data.settings = {
      ...data.settings,
      currentEngagementId: DEFAULT_ENGAGEMENT_ID,
    };
  }

  writeData(ensureDataShape(data));
}

export function getCurrentEngagementId(): string {
  const data = readData();
  return resolveEngagementId(data);
}

export function setCurrentEngagementId(id: string): string {
  const data = readData();
  const resolvedId = data.engagements.some((engagement) => engagement.id === id)
    ? id
    : DEFAULT_ENGAGEMENT_ID;
  data.settings = {
    ...data.settings,
    currentEngagementId: resolvedId,
  };
  writeData(data);
  return resolvedId;
}

function rowToEngagement(row: EngagementRow): Engagement {
  let tags: string[] = [];
  try {
    tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    name: row.name,
    primaryTarget: row.primaryTarget,
    workspacePath: row.workspacePath || `/workspace/${row.id}`,
    tags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── API Key (encrypted via Electron safeStorage) ───

export function saveApiKey(key: string): void {
  const data = readData();
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key);
    data.encryptedApiKey = encrypted.toString('base64');
  } else {
    // Fallback: store as base64 (not truly secure, but better than plaintext in localStorage)
    data.encryptedApiKey = Buffer.from(key).toString('base64');
  }
  writeData(data);
}

export function getApiKey(): string {
  const data = readData();
  if (!data.encryptedApiKey) return '';

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(data.encryptedApiKey, 'base64');
      return safeStorage.decryptString(buffer);
    } else {
      return Buffer.from(data.encryptedApiKey, 'base64').toString('utf-8');
    }
  } catch {
    return '';
  }
}

export function deleteApiKey(): void {
  const data = readData();
  delete data.encryptedApiKey;
  writeData(data);
}
