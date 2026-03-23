import { Note } from '@shared/types';

export type NotebookWriteMode = 'replace' | 'append';

export interface NotebookAIIntent {
  mode: NotebookWriteMode;
  notebookTitle: string;
  targetNotebook: Note | null;
  supplementalContext: string;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function titleCaseNotebookAction(mode: NotebookWriteMode): string {
  return mode === 'replace' ? 'rewrite' : 'append to';
}

function detectNotebookWriteMode(lowerPrompt: string): NotebookWriteMode | null {
  if (!/notebook|walkthrough|notes/.test(lowerPrompt)) {
    return null;
  }

  if (/(append|add to|save to|put .* in)/.test(lowerPrompt)) {
    return 'append';
  }

  if (/(rewrite|clean up|cleanup|organize|reformat|polish|turn .*walkthrough|write .*walkthrough|write clear|easy to follow|step-by-step)/.test(lowerPrompt)) {
    return 'replace';
  }

  return null;
}

function resolveNotebookTitle(prompt: string, notes: Note[], activeNotebookId: string | null): { title: string; note: Note | null } | null {
  const lowerPrompt = prompt.toLowerCase();
  const exactMatch = notes
    .filter((note) => note.title && lowerPrompt.includes(note.title.toLowerCase()))
    .sort((a, b) => b.title.length - a.title.length)[0];

  if (exactMatch) {
    return { title: exactMatch.title, note: exactMatch };
  }

  const namedMatch = prompt.match(/notebook(?:\s+named|\s+called)?\s+["“]?([^"\n”]+?)["”]?(?:[,.]|$)/i);
  if (namedMatch?.[1]) {
    const requestedTitle = normalizeWhitespace(namedMatch[1]);
    const existing = notes.find((note) => note.title.toLowerCase() === requestedTitle.toLowerCase()) ?? null;
    return {
      title: existing?.title ?? requestedTitle,
      note: existing,
    };
  }

  if (activeNotebookId) {
    const active = notes.find((note) => note.id === activeNotebookId) ?? null;
    if (active) {
      return { title: active.title, note: active };
    }
  }

  return null;
}

export function resolveNotebookAIIntent(
  prompt: string,
  notes: Note[],
  activeNotebookId: string | null
): NotebookAIIntent | null {
  const lowerPrompt = prompt.toLowerCase();
  const mode = detectNotebookWriteMode(lowerPrompt);
  if (!mode) {
    return null;
  }

  const resolved = resolveNotebookTitle(prompt, notes, activeNotebookId);
  if (!resolved) {
    return null;
  }

  const existingContent = resolved.note?.content?.trim() || '(empty notebook)';
  const noteSource = resolved.note?.source ?? 'manual';
  const noteUpdatedAt = resolved.note?.updatedAt ?? resolved.note?.createdAt ?? 'unknown';

  const supplementalContext = [
    '## Referenced Notebook',
    `Notebook title: ${resolved.title}`,
    `Notebook source: ${noteSource}`,
    `Notebook updated: ${noteUpdatedAt}`,
    'Current notebook contents:',
    existingContent,
    '',
    '## Notebook Rewrite Instruction',
    `The operator explicitly wants you to ${titleCaseNotebookAction(mode)} this notebook.`,
    'Write clean, readable walkthrough notes that another operator could follow later without guessing the missing logic.',
    'Prefer a structure like: Overview, Enumeration, Initial Access, Privilege Escalation, Flags/Loot, and Key Commands.',
    'Keep commands concise and explain why each step mattered.',
    'Return only the notebook-ready content. Do not wrap it in commentary about saving or updating.',
  ].join('\n');

  return {
    mode,
    notebookTitle: resolved.title,
    targetNotebook: resolved.note,
    supplementalContext,
  };
}
