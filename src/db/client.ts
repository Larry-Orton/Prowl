/**
 * JSON-based persistence layer — no native modules, zero compilation issues.
 * Data is stored at: userData/prowl-data.json
 */
import fs from 'fs';
import path from 'path';
import { app, safeStorage } from 'electron';
import type { Note, NoteRow, CommandRecord } from '../shared/types';

interface ProwlData {
  notes: NoteRow[];
  commands: CommandRecord[];
  encryptedApiKey?: string;
  settings?: Record<string, unknown>;
}

let dataPath: string | null = null;

function getDataPath(): string {
  if (!dataPath) {
    const userDataPath = app.getPath('userData');
    dataPath = path.join(userDataPath, 'prowl-data.json');
  }
  return dataPath;
}

function readData(): ProwlData {
  const p = getDataPath();
  if (!fs.existsSync(p)) {
    return { notes: [], commands: [] };
  }
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw);
    // Ensure new fields exist for older data files
    if (!data.commands) data.commands = [];
    return data;
  } catch {
    return { notes: [], commands: [] };
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

  if (idx >= 0) {
    const existing = data.notes[idx];
    const updated: NoteRow = {
      id: note.id,
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

export function getAllNotes(_db: null): Note[] {
  const data = readData();
  return [...data.notes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(rowToNote);
}

export function searchNotes(_db: null, query: string): Note[] {
  const data = readData();
  const q = query.toLowerCase();
  return data.notes
    .filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
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
    title: row.title,
    content: row.content,
    tags,
    source: row.source as Note['source'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Command History ────────────────────────────────

export function saveCommand(cmd: string, target: string): CommandRecord {
  const data = readData();
  const record: CommandRecord = {
    command: cmd,
    target: target || '',
    timestamp: new Date().toISOString(),
  };
  data.commands.unshift(record);
  // Keep last 500 commands
  if (data.commands.length > 500) {
    data.commands = data.commands.slice(0, 500);
  }
  writeData(data);
  return record;
}

export function getCommands(): CommandRecord[] {
  const data = readData();
  return data.commands;
}

export function searchCommands(query: string, currentTarget?: string): CommandRecord[] {
  const data = readData();
  const q = query.toLowerCase();
  const results = data.commands.filter(c =>
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
