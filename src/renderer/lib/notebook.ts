export type CanonicalNotebookSection =
  | 'overview'
  | 'enumeration'
  | 'web'
  | 'credentials'
  | 'initial_access'
  | 'privilege_escalation'
  | 'loot'
  | 'dead_ends'
  | 'next_step';

const SECTION_TITLES: Record<CanonicalNotebookSection, string> = {
  overview: 'Overview',
  enumeration: 'Enumeration',
  web: 'Web & Service Analysis',
  credentials: 'Credentials',
  initial_access: 'Initial Access',
  privilege_escalation: 'Privilege Escalation',
  loot: 'Loot & Flags',
  dead_ends: 'Dead Ends',
  next_step: 'Guidance & Next Step',
};

export function inferNotebookSectionFromText(text: string): CanonicalNotebookSection {
  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return 'overview';
  }

  if (normalized.includes('privesc') || normalized.includes('privilege escalation') || normalized.includes('sudo') || normalized.includes('suid')) {
    return 'privilege_escalation';
  }

  if (normalized.includes('foothold') || normalized.includes('shell') || normalized.includes('initial access') || normalized.includes('login')) {
    return 'initial_access';
  }

  if (normalized.includes('password') || normalized.includes('credential') || normalized.includes('hash') || normalized.includes('token')) {
    return 'credentials';
  }

  if (normalized.includes('flag') || normalized.includes('loot') || normalized.includes('proof') || normalized.includes('user.txt') || normalized.includes('root.txt')) {
    return 'loot';
  }

  if (normalized.includes('dead end') || normalized.includes('failed') || normalized.includes('did not work') || normalized.includes('blocked')) {
    return 'dead_ends';
  }

  if (normalized.includes('web') || normalized.includes('http') || normalized.includes('https') || normalized.includes('route') || normalized.includes('endpoint')) {
    return 'web';
  }

  if (normalized.includes('next') || normalized.includes('todo') || normalized.includes('follow up')) {
    return 'next_step';
  }

  if (normalized.includes('port') || normalized.includes('service') || normalized.includes('enum') || normalized.includes('nmap') || normalized.includes('scan')) {
    return 'enumeration';
  }

  return 'overview';
}

export function buildCanonicalNotebookContent(target: string): string {
  return [
    `Target: ${target}`,
    '',
    '## Overview',
    '### Session kickoff',
    '- Finding: AI notebook initialized for this target.',
    '- Why it matters: This notebook will stay as the cleaned engagement journal while raw user notes remain separate.',
    '- Guidance: Start broad discovery and let the notebook tighten as evidence arrives.',
    '',
    '## Enumeration',
    '',
    '## Web & Service Analysis',
    '',
    '## Credentials',
    '',
    '## Initial Access',
    '',
    '## Privilege Escalation',
    '',
    '## Loot & Flags',
    '',
    '## Dead Ends',
    '',
    '## Guidance & Next Step',
    '- Guidance: Set a target and begin with broad discovery.',
  ].join('\n');
}

function normalizeNotebookEntry(entry: string, section: CanonicalNotebookSection): string {
  const normalized = entry
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    return '';
  }

  if (/^###\s+/m.test(normalized)) {
    return normalized;
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return '';
  }

  const body = lines.map((line, index) => {
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      return line.replace(/^\d+\.\s+/, '- ');
    }

    if (index === 0) {
      return `- Finding: ${line}`;
    }

    return `- ${line}`;
  }).join('\n');

  return `### ${SECTION_TITLES[section]} Update\n${body}`;
}

function ensureSection(content: string, section: CanonicalNotebookSection): string {
  const heading = `## ${SECTION_TITLES[section]}`;
  if (content.includes(heading)) {
    return content;
  }
  return `${content.trim()}\n\n${heading}\n`;
}

function replaceSectionBody(content: string, section: CanonicalNotebookSection, body: string): string {
  const heading = `## ${SECTION_TITLES[section]}`;
  const ensured = ensureSection(content, section);
  const pattern = new RegExp(`(${heading}\\n)([\\s\\S]*?)(?=\\n## |$)`);
  return ensured.replace(pattern, `$1${body.trim()}\n\n`);
}

function appendSectionBody(content: string, section: CanonicalNotebookSection, body: string): string {
  const heading = `## ${SECTION_TITLES[section]}`;
  const ensured = ensureSection(content, section);
  const pattern = new RegExp(`(${heading}\\n)([\\s\\S]*?)(?=\\n## |$)`);
  return ensured.replace(pattern, (_, prefix: string, existingBody: string) => {
    const trimmedExisting = existingBody.trim();
    if (trimmedExisting.includes(body.trim())) {
      return `${prefix}${trimmedExisting}\n\n`;
    }
    const merged = trimmedExisting
      ? `${trimmedExisting}\n\n${body.trim()}`
      : body.trim();
    return `${prefix}${merged}\n\n`;
  });
}

export function mergeCanonicalNotebook(args: {
  existingContent: string;
  section: CanonicalNotebookSection;
  entry: string;
  nextStep?: string;
}): string {
  const base = args.existingContent.trim() || buildCanonicalNotebookContent('Current Target');
  let updated = base;

  if (args.entry.trim()) {
    updated = appendSectionBody(updated, args.section, normalizeNotebookEntry(args.entry, args.section));
  }

  if (args.nextStep?.trim()) {
    updated = replaceSectionBody(updated, 'next_step', `- Guidance: ${args.nextStep.trim()}`);
  }

  return updated.trim();
}
