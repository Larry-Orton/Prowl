import { Note } from '@shared/types';

export const NOTEBOOK_LINES_PER_PAGE = 15;

export type NotebookLineTone =
  | 'noteTitle'
  | 'noteMeta'
  | 'section'
  | 'paragraph'
  | 'bullet'
  | 'command'
  | 'empty';

export interface NotebookDisplayLine {
  id: string;
  text: string;
  tone: NotebookLineTone;
  source?: Note['source'];
  createdAt?: string;
  stickyCount?: number;
}

export interface NotebookPage {
  id: string;
  headerTitle: string;
  dateLabel: string;
  sourceLabel: string;
  lines: NotebookDisplayLine[];
}

interface NotebookSections {
  summary: string[];
  observations: string[];
  commands: string[];
  questions: string[];
  aiGuidance: string[];
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toSourceLabel(source: Note['source']): string {
  switch (source) {
    case 'ai':
      return 'AI';
    case 'terminal':
      return 'TERMINAL';
    default:
      return 'MANUAL';
  }
}

function wrapText(text: string, width: number, firstPrefix = '', continuationPrefix = ''): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = firstPrefix;
  let currentWidth = firstPrefix.length;
  const continuation = continuationPrefix || firstPrefix;

  for (const word of words) {
    const separator = currentWidth > (lines.length === 0 ? firstPrefix.length : continuation.length) ? ' ' : '';
    const prefixWidth = lines.length === 0 ? firstPrefix.length : continuation.length;
    const next = current + separator + word;

    if (currentWidth > prefixWidth && next.length > width) {
      lines.push(current);
      current = continuation + word;
      currentWidth = current.length;
    } else if (currentWidth === prefixWidth && (continuation + word).length > width && word.length > width - prefixWidth) {
      lines.push(continuation + word);
      current = '';
      currentWidth = 0;
    } else {
      current = next;
      currentWidth = current.length;
    }
  }

  if (current.trim()) {
    lines.push(current);
  }

  return lines;
}

function collapseParagraph(lines: string[]): string {
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

function parseNoteSections(note: Note): NotebookSections {
  const sections: NotebookSections = {
    summary: [],
    observations: [],
    commands: [],
    questions: [],
    aiGuidance: [],
  };

  const rawLines = note.content.replace(/\r/g, '').split('\n');
  const paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const paragraph = collapseParagraph(paragraphBuffer);
    if (paragraph) {
      sections.summary.push(paragraph);
    }
    paragraphBuffer.length = 0;
  };

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const bannerMatch = trimmed.match(/^---\s*(.+?)\s*---$/);
    if (bannerMatch) {
      flushParagraph();
      const bannerText = bannerMatch[1].trim();
      if (bannerText.toLowerCase() !== note.title.trim().toLowerCase()) {
        sections.observations.push(bannerText);
      }
      continue;
    }

    const commandMatch = trimmed.match(/^\[CMD\]\s*(.+)$/i);
    if (commandMatch) {
      flushParagraph();
      sections.commands.push(commandMatch[1].trim());
      continue;
    }

    const questionMatch = trimmed.match(/^\[ASK\]\s*(.+)$/i);
    if (questionMatch) {
      flushParagraph();
      sections.questions.push(questionMatch[1].trim());
      continue;
    }

    const aiMatch = trimmed.match(/^\[AI\]\s*(.+)$/i);
    if (aiMatch) {
      flushParagraph();
      sections.aiGuidance.push(aiMatch[1].trim());
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      sections.observations.push(bulletMatch[1].trim());
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      sections.observations.push(numberedMatch[1].trim());
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();

  return sections;
}

function pushWrappedLines(
  target: NotebookDisplayLine[],
  lines: string[],
  tone: NotebookLineTone,
  source: Note['source'],
  createdAt: string,
  options?: {
    width?: number;
    prefix?: string;
    continuationPrefix?: string;
    stickyCount?: number;
  }
) {
  const width = options?.width ?? 42;
  const prefix = options?.prefix ?? '';
  const continuationPrefix = options?.continuationPrefix ?? '';

  lines.forEach((line, lineIndex) => {
    wrapText(line, width, prefix, continuationPrefix).forEach((wrapped, wrappedIndex) => {
      target.push({
        id: `${createdAt}-${tone}-${target.length}-${lineIndex}-${wrappedIndex}`,
        text: wrapped,
        tone,
        source,
        createdAt,
        stickyCount: wrappedIndex === 0 ? options?.stickyCount : undefined,
      });
    });
  });
}

function addSection(
  target: NotebookDisplayLine[],
  sectionTitle: string,
  entries: string[],
  tone: Extract<NotebookLineTone, 'paragraph' | 'bullet' | 'command'>,
  source: Note['source'],
  createdAt: string,
  options?: {
    width?: number;
    prefix?: string;
    continuationPrefix?: string;
  }
) {
  if (entries.length === 0) {
    return;
  }

  target.push({
    id: `${createdAt}-${sectionTitle}-${target.length}`,
    text: sectionTitle.toUpperCase(),
    tone: 'section',
    source,
    createdAt,
    stickyCount: 2,
  });

  pushWrappedLines(target, entries, tone, source, createdAt, options);
  target.push({
    id: `${createdAt}-${sectionTitle}-break-${target.length}`,
    text: '',
    tone: 'empty',
    source,
    createdAt,
  });
}

function buildNotebookLines(notes: Note[]): NotebookDisplayLine[] {
  const orderedNotes = notes
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const lines: NotebookDisplayLine[] = [];

  orderedNotes.forEach((note, noteIndex) => {
    const sections = parseNoteSections(note);

    if (noteIndex > 0 && lines.length > 0 && lines[lines.length - 1].tone !== 'empty') {
      lines.push({
        id: `${note.id}-gap-${lines.length}`,
        text: '',
        tone: 'empty',
        source: note.source,
        createdAt: note.createdAt,
      });
    }

    pushWrappedLines(lines, [note.title], 'noteTitle', note.source, note.createdAt, {
      width: 34,
      stickyCount: 4,
    });

    lines.push({
      id: `${note.id}-meta`,
      text: `${formatDateLabel(note.createdAt)}  |  ${toSourceLabel(note.source)}`,
      tone: 'noteMeta',
      source: note.source,
      createdAt: note.createdAt,
      stickyCount: 3,
    });

    if (
      sections.summary.length > 0 &&
      (sections.observations.length > 0 || sections.commands.length > 0 || sections.questions.length > 0 || sections.aiGuidance.length > 0)
    ) {
      addSection(lines, 'Summary', sections.summary, 'paragraph', note.source, note.createdAt, { width: 42 });
    } else {
      pushWrappedLines(lines, sections.summary, 'paragraph', note.source, note.createdAt, { width: 42 });
      if (sections.summary.length > 0) {
        lines.push({
          id: `${note.id}-summary-break-${lines.length}`,
          text: '',
          tone: 'empty',
          source: note.source,
          createdAt: note.createdAt,
        });
      }
    }

    addSection(lines, 'Observations', sections.observations, 'bullet', note.source, note.createdAt, {
      width: 42,
      prefix: '- ',
      continuationPrefix: '  ',
    });

    addSection(lines, 'Commands Run', sections.commands, 'command', note.source, note.createdAt, {
      width: 38,
      prefix: '$ ',
      continuationPrefix: '  ',
    });

    addSection(lines, 'Questions To AI', sections.questions, 'bullet', note.source, note.createdAt, {
      width: 41,
      prefix: '? ',
      continuationPrefix: '  ',
    });

    addSection(lines, 'AI Guidance', sections.aiGuidance, 'paragraph', note.source, note.createdAt, {
      width: 42,
    });

    while (lines.length > 0 && lines[lines.length - 1].tone === 'empty') {
      lines.pop();
    }
  });

  return lines;
}

function finalizePage(
  pageIndex: number,
  pageLines: NotebookDisplayLine[],
  notebookTitle: string
): NotebookPage {
  const lines = pageLines.slice(0, NOTEBOOK_LINES_PER_PAGE);
  while (lines.length < NOTEBOOK_LINES_PER_PAGE) {
    lines.push({
      id: `page-${pageIndex}-empty-${lines.length}`,
      text: '',
      tone: 'empty',
    });
  }

  const datedLines = pageLines.filter((line) => line.createdAt);
  const sources = Array.from(new Set(pageLines.flatMap((line) => (line.source ? [toSourceLabel(line.source)] : []))));
  const firstDate = datedLines[0]?.createdAt;
  const lastDate = datedLines[datedLines.length - 1]?.createdAt;

  const dateLabel = firstDate
    ? firstDate === lastDate
      ? formatDateLabel(firstDate)
      : `${formatDateLabel(firstDate)} - ${formatDateLabel(lastDate ?? firstDate)}`
    : '';

  return {
    id: `page-${pageIndex}`,
    headerTitle: notebookTitle,
    dateLabel,
    sourceLabel: sources.join(' / ') || 'FIELD NOTES',
    lines,
  };
}

export function buildNotebookPages(notes: Note[], notebookTitle: string): NotebookPage[] {
  if (notes.length === 0) {
    return [];
  }

  const lines = buildNotebookLines(notes);
  const pages: NotebookPage[] = [];
  let currentPage: NotebookDisplayLine[] = [];

  lines.forEach((line) => {
    const remaining = NOTEBOOK_LINES_PER_PAGE - currentPage.length;
    const stickyCount = line.stickyCount ?? 1;

    if (currentPage.length > 0 && remaining < stickyCount) {
      pages.push(finalizePage(pages.length, currentPage, notebookTitle));
      currentPage = [];
    }

    currentPage.push(line);

    if (currentPage.length === NOTEBOOK_LINES_PER_PAGE) {
      pages.push(finalizePage(pages.length, currentPage, notebookTitle));
      currentPage = [];
    }
  });

  if (currentPage.length > 0) {
    pages.push(finalizePage(pages.length, currentPage, notebookTitle));
  }

  return pages;
}
