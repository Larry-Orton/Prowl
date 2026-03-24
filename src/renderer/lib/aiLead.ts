import type {
  ActiveContext,
  Finding,
  MissionMode,
  Note,
  TerminalActivityEntry,
  TerminalSessionContext,
} from '@shared/types';

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

export interface LeadAnalysis {
  shouldRespond: boolean;
  commandStatus: 'success' | 'failure' | 'mixed' | 'no_signal';
  importance: 'low' | 'medium' | 'high';
  messageMarkdown: string;
  nextCommand: string;
  notebookSection: CanonicalNotebookSection;
  notebookEntry: string;
  nextStep: string;
}

export interface NotebookScribeResult {
  notebookSection: CanonicalNotebookSection;
  notebookEntry: string;
  nextStep: string;
}

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

function formatFindings(findings: Finding[], target: string): string {
  const relevant = findings
    .filter((finding) => !target || finding.target === target || finding.kind === 'target')
    .slice(0, 8);

  if (relevant.length === 0) {
    return '(none)';
  }

  return relevant
    .map((finding) => `- [${finding.kind}] ${finding.summary}`)
    .join('\n');
}

function formatOperatorNotes(notes: Note[], activeNotebookId: string | null): string {
  const rawNotes = notes
    .filter((note) => note.id !== activeNotebookId && note.source !== 'ai')
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  if (rawNotes.length === 0) {
    return '(none)';
  }

  return rawNotes
    .map((note) => `- ${note.title}: ${note.content.slice(0, 220)}`)
    .join('\n');
}

function formatSessionActivity(
  session: TerminalSessionContext,
  activity: TerminalActivityEntry,
): string {
  const output = activity.output.trim() || '(no output captured yet)';
  return [
    `Terminal: ${session.title} [${session.shellType}]`,
    `Command: ${activity.command}`,
    'Output:',
    output.slice(-2600),
  ].join('\n');
}

function formatPreviousActivity(session: TerminalSessionContext): string {
  const previous = session.recentActivity[1];
  if (!previous) {
    return '(none)';
  }

  return [
    `Previous command: ${previous.command}`,
    `Previous output excerpt: ${(previous.output.trim() || '(none)').slice(-900)}`,
  ].join('\n');
}

export function buildLeadSystemPrompt(): string {
  return `You are Prowl Lead Mode, an embedded offensive-security operator partner.

Your job is to keep the operator moving one command at a time.

Return EXACTLY valid JSON with this shape:
{
  "shouldRespond": true,
  "commandStatus": "success",
  "importance": "medium",
  "messageMarkdown": "Short explanation of what the latest output means plus exactly one next command in a single bash code block.",
  "nextCommand": "the exact next command to run, or empty string",
  "notebookSection": "enumeration",
  "notebookEntry": "A structured notebook checkpoint for the canonical notebook.",
  "nextStep": "One-sentence current next step for the notebook."
}

Rules:
- Lead with exactly one next command unless there is genuinely no useful next command.
- Do not give a multi-step plan unless the operator explicitly asked for one. They did not here.
- If the command failed, explain why and provide the fix as the one next command.
- If a dependency or tool is missing, the next command should be the install/fix command.
- Check saved workspace artifacts and command history before suggesting the next command.
- If the operator already has output for a scan or step, do not suggest rerunning it unless you clearly explain why it is necessary.
- Prefer the simplest verification command over a clever exploit command.
- Do not jump to a new exploit technique unless the latest output clearly supports it and the prerequisite evidence is already present.
- Treat saved payloads, exploit files, and shell artifacts as hints only. They are not proof that an exploit worked.
- The next command must be operator-friendly: one line, easy to understand, and easy to rerun manually.
- Never use heredocs, shell variables, command substitution, backticks, loops, brace expansion, or chained shell commands for the default next step.
- Avoid multiline commands unless the operator explicitly asked for them.
- If the latest output is noisy but still meaningful, summarize the result and choose the single highest-value next command.
- If there is no meaningful signal yet, set "shouldRespond" to false.
- "messageMarkdown" must be short, direct, and operator-friendly.
- "messageMarkdown" should briefly explain why the next step matters in plain operator language.
- "notebookEntry" must read like a clean pentest field journal entry, not a dump of thoughts.
- "notebookEntry" should usually be 4 to 6 short lines in this shape when evidence exists:
  ### Short checkpoint title
  - Command run: exact command or short command summary
  - Finding: what the command or artifact proved
  - Why it matters: the operator meaning
  - Guidance: the one practical follow-up
  - Side note: only if there is a genuinely useful caution or reminder
- Omit bullets that would be fake or repetitive, but keep the structure tight and readable.
- "notebookSection" must be one of: overview, enumeration, web, credentials, initial_access, privilege_escalation, loot, dead_ends, next_step.
- Return JSON only. No markdown fences. No extra commentary.`;
}

export function buildLeadUserPrompt(args: {
  context: ActiveContext;
  missionMode: MissionMode;
  findings: Finding[];
  notes: Note[];
  activeNotebookId: string | null;
  workspacePath: string;
  workspaceIntel?: string;
  commandHistory?: string;
  session: TerminalSessionContext;
  activity: TerminalActivityEntry;
  notebookContent?: string;
}): string {
  const {
    context,
    missionMode,
    findings,
    notes,
    activeNotebookId,
    workspacePath,
    workspaceIntel,
    commandHistory,
    session,
    activity,
    notebookContent,
  } = args;

  return [
    `Primary target: ${context.primaryTarget || 'not set'}`,
    `Mission mode: ${missionMode.label} (${missionMode.reason})`,
    `Workspace path: ${workspacePath}`,
    `Open ports: ${context.discoveredPorts.join(', ') || 'none'}`,
    `Scanned services: ${context.scannedServices.join(', ') || 'none'}`,
    '',
    'Saved workspace artifacts and checkpoint:',
    workspaceIntel || '(workspace intelligence unavailable)',
    '',
    'Recent saved command history:',
    commandHistory || '(none)',
    '',
    'Relevant findings:',
    formatFindings(findings, context.primaryTarget),
    '',
    'Raw operator notes (do not rewrite them directly, but use them as context):',
    formatOperatorNotes(notes, activeNotebookId),
    '',
    'Canonical notebook excerpt:',
    notebookContent?.slice(-1800) || '(no notebook content yet)',
    '',
    'Latest terminal checkpoint:',
    formatSessionActivity(session, activity),
    '',
    'Previous activity in the same terminal:',
    formatPreviousActivity(session),
    '',
    'Interpret the latest checkpoint, keep the operator on track, and choose the next single command.',
  ].join('\n');
}

export function buildNotebookScribeSystemPrompt(): string {
  return `You maintain Prowl's canonical pentest notebook.

Return EXACTLY valid JSON with this shape:
{
  "notebookSection": "overview",
  "notebookEntry": "A structured notebook checkpoint derived from the operator's raw note.",
  "nextStep": "Optional short sentence describing the current next step."
}

Rules:
- Turn raw operator notes into clear professional notebook language.
- Do not copy the raw note verbatim if it is messy; clean it up.
- Keep it concise and evidence-based.
- "notebookEntry" should usually be 4 to 6 short lines in this shape:
  ### Short checkpoint title
  - Finding: what was learned
  - Why it matters: why it matters to the engagement
  - Guidance: the next useful direction
  - Side note: optional operator reminder
- "notebookSection" must be one of: overview, enumeration, web, credentials, initial_access, privilege_escalation, loot, dead_ends, next_step.
- Return JSON only.`;
}

export function buildNotebookScribeUserPrompt(args: {
  note: Note;
  context: ActiveContext;
  missionMode: MissionMode;
  findings: Finding[];
  notebookContent?: string;
}): string {
  const { note, context, missionMode, findings, notebookContent } = args;
  return [
    `Primary target: ${context.primaryTarget || 'not set'}`,
    `Mission mode: ${missionMode.label}`,
    '',
    'Recent findings:',
    formatFindings(findings, context.primaryTarget),
    '',
    'Canonical notebook excerpt:',
    notebookContent?.slice(-1600) || '(no notebook content yet)',
    '',
    `Operator raw note title: ${note.title}`,
    'Operator raw note content:',
    note.content.slice(-2000),
    '',
    'Convert this into a canonical notebook update.',
  ].join('\n');
}

export function getLeadCommandComplexityIssue(command: string): string | null {
  const normalized = command.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.includes('\n')) {
    return 'contains multiple lines';
  }

  if (normalized.includes('<<')) {
    return 'uses a heredoc';
  }

  if (/\$\(/.test(normalized)) {
    return 'uses command substitution';
  }

  if (/`/.test(normalized)) {
    return 'uses backticks';
  }

  if (/^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(normalized)) {
    return 'starts with shell variable assignment';
  }

  if (/(^|[^\\])(&&|\|\||;)/.test(normalized)) {
    return 'chains multiple shell commands';
  }

  if (/\\\s*$/.test(normalized)) {
    return 'uses shell line continuation';
  }

  if (normalized.length > 220) {
    return 'is too long';
  }

  return null;
}

export function buildLeadSimplificationPrompt(args: {
  originalPrompt: string;
  rejectedCommand: string;
  issue: string;
}): string {
  return [
    'The previous Lead Mode answer was too complex for the operator.',
    `Issue: ${args.issue}`,
    `Rejected command: ${args.rejectedCommand}`,
    '',
    'Rewrite the answer as exactly one short, obvious next command.',
    'Prefer a verification or inspection step over payload creation or exploitation.',
    'Do not use heredocs, shell variables, command substitution, backticks, or chained commands.',
    '',
    'Original checkpoint context:',
    args.originalPrompt,
  ].join('\n');
}

export function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || raw;
  const first = source.indexOf('{');
  const last = source.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }
  return source.slice(first, last + 1);
}

function normalizeSection(value: string | undefined): CanonicalNotebookSection {
  const normalized = (value || '').trim().toLowerCase();
  switch (normalized) {
    case 'overview':
      return 'overview';
    case 'enumeration':
    case 'recon':
      return 'enumeration';
    case 'web':
    case 'web_service':
    case 'web-service':
      return 'web';
    case 'credentials':
      return 'credentials';
    case 'initial_access':
    case 'initial-access':
    case 'foothold':
      return 'initial_access';
    case 'privilege_escalation':
    case 'privilege-escalation':
    case 'privesc':
      return 'privilege_escalation';
    case 'loot':
    case 'flags':
      return 'loot';
    case 'dead_ends':
    case 'dead-ends':
      return 'dead_ends';
    case 'next_step':
    case 'next-step':
      return 'next_step';
    default:
      return 'overview';
  }
}

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

export function parseLeadAnalysis(raw: string): LeadAnalysis | null {
  const json = extractJsonObject(raw);
  if (!json) {
    return null;
  }

  try {
    const parsed = JSON.parse(json) as Partial<LeadAnalysis> & Record<string, unknown>;
    return {
      shouldRespond: Boolean(parsed.shouldRespond),
      commandStatus: (parsed.commandStatus as LeadAnalysis['commandStatus']) || 'no_signal',
      importance: (parsed.importance as LeadAnalysis['importance']) || 'medium',
      messageMarkdown: typeof parsed.messageMarkdown === 'string' ? parsed.messageMarkdown.trim() : '',
      nextCommand: typeof parsed.nextCommand === 'string' ? parsed.nextCommand.trim() : '',
      notebookSection: normalizeSection(parsed.notebookSection as string | undefined),
      notebookEntry: typeof parsed.notebookEntry === 'string' ? parsed.notebookEntry.trim() : '',
      nextStep: typeof parsed.nextStep === 'string' ? parsed.nextStep.trim() : '',
    };
  } catch {
    return null;
  }
}

export function parseNotebookScribeResult(raw: string): NotebookScribeResult | null {
  const json = extractJsonObject(raw);
  if (!json) {
    return null;
  }

  try {
    const parsed = JSON.parse(json) as Partial<NotebookScribeResult> & Record<string, unknown>;
    return {
      notebookSection: normalizeSection(parsed.notebookSection as string | undefined),
      notebookEntry: typeof parsed.notebookEntry === 'string' ? parsed.notebookEntry.trim() : '',
      nextStep: typeof parsed.nextStep === 'string' ? parsed.nextStep.trim() : '',
    };
  } catch {
    return null;
  }
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
