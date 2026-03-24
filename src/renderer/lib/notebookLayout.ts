import { Note } from '@shared/types';

export const NOTEBOOK_LINES_PER_PAGE = 18;

export type NotebookLineTone =
  | 'meta'
  | 'section'
  | 'checkpoint'
  | 'paragraph'
  | 'bullet'
  | 'command'
  | 'finding'
  | 'guidance'
  | 'sideNote'
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

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function wrapText(text: string, width: number, firstPrefix = '', continuationPrefix = ''): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = firstPrefix;
  let prefix = firstPrefix;

  for (const word of words) {
    const separator = current.trim() === prefix.trim() ? '' : ' ';
    const candidate = `${current}${separator}${word}`;

    if (candidate.length > width && current.trim() !== prefix.trim()) {
      lines.push(current);
      prefix = continuationPrefix || firstPrefix;
      current = `${prefix}${word}`;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    lines.push(current);
  }

  return lines;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

function pushWrappedText(
  target: NotebookDisplayLine[],
  text: string,
  tone: NotebookLineTone,
  source: Note['source'],
  createdAt: string,
  options?: {
    width?: number;
    firstPrefix?: string;
    continuationPrefix?: string;
    stickyCount?: number;
  }
) {
  const wrapped = wrapText(
    stripMarkdown(text),
    options?.width ?? 58,
    options?.firstPrefix ?? '',
    options?.continuationPrefix ?? options?.firstPrefix ?? ''
  );

  wrapped.forEach((line, index) => {
    target.push({
      id: `${createdAt}-${tone}-${target.length}-${index}`,
      text: line,
      tone,
      source,
      createdAt,
      stickyCount: index === 0 ? options?.stickyCount : undefined,
    });
  });
}

function pushBlank(target: NotebookDisplayLine[], source: Note['source'], createdAt: string) {
  if (target.length === 0 || target[target.length - 1].tone === 'empty') {
    return;
  }

  target.push({
    id: `${createdAt}-blank-${target.length}`,
    text: '',
    tone: 'empty',
    source,
    createdAt,
  });
}

function classifyBullet(text: string): {
  tone: NotebookLineTone;
  width: number;
  firstPrefix: string;
  continuationPrefix: string;
  normalized: string;
} {
  const cleaned = stripMarkdown(text);
  const labeledMatch = cleaned.match(/^([A-Za-z][A-Za-z ]{1,24}):\s*(.+)$/);
  const label = labeledMatch?.[1].trim().toLowerCase() ?? '';
  const body = labeledMatch?.[2].trim() ?? cleaned;

  if (/^(command|command run|ran|executed|payload|request)$/.test(label)) {
    return {
      tone: 'command',
      width: 54,
      firstPrefix: '$ ',
      continuationPrefix: '  ',
      normalized: body,
    };
  }

  if (/^(finding|result|evidence|output|observation|discovery|service|services|port|ports|credential|credentials|flag|flags)$/.test(label)) {
    return {
      tone: 'finding',
      width: 58,
      firstPrefix: '- ',
      continuationPrefix: '  ',
      normalized: body,
    };
  }

  if (/^(guidance|why it matters|meaning|interpretation|assessment|next step|recommendation)$/.test(label)) {
    return {
      tone: 'guidance',
      width: 58,
      firstPrefix: '> ',
      continuationPrefix: '  ',
      normalized: body,
    };
  }

  if (/^(side note|tip|caution|watch for|operator note|note)$/.test(label)) {
    return {
      tone: 'sideNote',
      width: 56,
      firstPrefix: '! ',
      continuationPrefix: '  ',
      normalized: body,
    };
  }

  if (/^(question|questions|todo)$/.test(label)) {
    return {
      tone: 'bullet',
      width: 57,
      firstPrefix: '? ',
      continuationPrefix: '  ',
      normalized: body,
    };
  }

  if (/^(command|curl|wget|ffuf|gobuster|feroxbuster|nmap|whatweb|nikto|enum4linux|rpcclient|smbclient|crackmapexec)\b/i.test(cleaned)) {
    return {
      tone: 'command',
      width: 54,
      firstPrefix: '$ ',
      continuationPrefix: '  ',
      normalized: cleaned,
    };
  }

  return {
    tone: 'bullet',
    width: 58,
    firstPrefix: '- ',
    continuationPrefix: '  ',
    normalized: cleaned,
  };
}

function buildNotebookLines(notebook: Note): NotebookDisplayLine[] {
  const rawLines = notebook.content.replace(/\r/g, '').split('\n');
  const lines: NotebookDisplayLine[] = [];
  const paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const text = stripMarkdown(paragraphBuffer.join(' '));
    if (text) {
      pushWrappedText(lines, text, 'paragraph', notebook.source, notebook.updatedAt, {
        width: 58,
      });
      pushBlank(lines, notebook.source, notebook.updatedAt);
    }
    paragraphBuffer.length = 0;
  };

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const targetMatch = trimmed.match(/^Target:\s*(.+)$/i);
    if (targetMatch) {
      flushParagraph();
      pushWrappedText(lines, `Target: ${targetMatch[1].trim()}`, 'meta', notebook.source, notebook.updatedAt, {
        width: 60,
        stickyCount: 2,
      });
      pushBlank(lines, notebook.source, notebook.updatedAt);
      continue;
    }

    const sectionMatch = trimmed.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      flushParagraph();
      pushBlank(lines, notebook.source, notebook.updatedAt);
      pushWrappedText(lines, sectionMatch[1].trim(), 'section', notebook.source, notebook.updatedAt, {
        width: 58,
        stickyCount: 3,
      });
      continue;
    }

    const checkpointMatch = trimmed.match(/^###\s+(.+)$/);
    if (checkpointMatch) {
      flushParagraph();
      pushBlank(lines, notebook.source, notebook.updatedAt);
      pushWrappedText(lines, checkpointMatch[1].trim(), 'checkpoint', notebook.source, notebook.updatedAt, {
        width: 58,
        stickyCount: 2,
      });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      const classified = classifyBullet(bulletMatch[1].trim());
      pushWrappedText(lines, classified.normalized, classified.tone, notebook.source, notebook.updatedAt, {
        width: classified.width,
        firstPrefix: classified.firstPrefix,
        continuationPrefix: classified.continuationPrefix,
      });
      continue;
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      const classified = classifyBullet(numberedMatch[2].trim());
      pushWrappedText(lines, classified.normalized, classified.tone, notebook.source, notebook.updatedAt, {
        width: classified.width,
        firstPrefix: `${numberedMatch[1]}. `,
        continuationPrefix: '   ',
      });
      continue;
    }

    const commandMatch = trimmed.match(/^\$\s+(.+)$/);
    if (commandMatch) {
      flushParagraph();
      pushWrappedText(lines, commandMatch[1].trim(), 'command', notebook.source, notebook.updatedAt, {
        width: 54,
        firstPrefix: '$ ',
        continuationPrefix: '  ',
      });
      continue;
    }

    if (/^(note|tip|watch for|caution):/i.test(trimmed)) {
      flushParagraph();
      pushWrappedText(lines, trimmed, 'sideNote', notebook.source, notebook.updatedAt, {
        width: 56,
        firstPrefix: '! ',
        continuationPrefix: '  ',
      });
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();

  while (lines.length > 0 && lines[lines.length - 1].tone === 'empty') {
    lines.pop();
  }

  return lines;
}

function finalizePage(
  pageIndex: number,
  pageLines: NotebookDisplayLine[],
  notebookTitle: string,
  notebook: Note
): NotebookPage {
  const lines = pageLines.slice(0, NOTEBOOK_LINES_PER_PAGE);
  while (lines.length < NOTEBOOK_LINES_PER_PAGE) {
    lines.push({
      id: `page-${pageIndex}-empty-${lines.length}`,
      text: '',
      tone: 'empty',
    });
  }

  return {
    id: `page-${pageIndex}`,
    headerTitle: notebookTitle,
    dateLabel: formatDateLabel(notebook.updatedAt),
    sourceLabel: 'AI NOTEBOOK',
    lines,
  };
}

export function buildNotebookPages(notebook: Note | null, notebookTitle: string): NotebookPage[] {
  if (!notebook) {
    return [];
  }

  const lines = buildNotebookLines(notebook);
  const pages: NotebookPage[] = [];
  let currentPage: NotebookDisplayLine[] = [];

  lines.forEach((line) => {
    const remaining = NOTEBOOK_LINES_PER_PAGE - currentPage.length;
    const stickyCount = line.stickyCount ?? 1;

    if (currentPage.length > 0 && remaining < stickyCount) {
      pages.push(finalizePage(pages.length, currentPage, notebookTitle, notebook));
      currentPage = [];
    }

    currentPage.push(line);

    if (currentPage.length === NOTEBOOK_LINES_PER_PAGE) {
      pages.push(finalizePage(pages.length, currentPage, notebookTitle, notebook));
      currentPage = [];
    }
  });

  if (currentPage.length > 0) {
    pages.push(finalizePage(pages.length, currentPage, notebookTitle, notebook));
  }

  return pages;
}
