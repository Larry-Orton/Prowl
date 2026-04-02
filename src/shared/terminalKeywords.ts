export type KeywordAction =
  | { type: 'target'; ip: string }
  | { type: 'note'; text: string }
  | { type: 'notes_add'; text: string }
  | { type: 'notes_append'; index: number; text: string }
  | { type: 'notebook_set'; name: string }
  | { type: 'notebook_new'; name: string }
  | { type: 'notebook_close' }
  | { type: 'add_last'; tool: string }
  | { type: 'ask'; question: string }
  | { type: 'help' }
  | { type: 'search'; term: string }
  | { type: 'export_notes' }
  | { type: 'commands'; tool: string }
  | { type: 'show_help' }
  | { type: 'usage_error'; message: string };

export function parseKeywordCommand(line: string): KeywordAction | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('target ')) {
    const ip = trimmed.slice(7).trim();
    // Only match if it looks like an IP address or hostname (not arbitrary commands)
    if (ip && /^[\d.:\[\]a-zA-Z][\w.\-:]*$/.test(ip)) return { type: 'target', ip };
  }
  if (lower === 'notebook close' || lower === 'notebook end') {
    return { type: 'notebook_close' };
  }
  if (lower.startsWith('notebook new ')) {
    const name = trimmed.slice(13).trim();
    if (name) return { type: 'notebook_new', name };
  }
  if (lower.startsWith('notebook ')) {
    const name = trimmed.slice(9).trim();
    if (name) return { type: 'notebook_set', name };
  }
  if (lower.startsWith('note #')) {
    const rest = trimmed.slice(6).trim();
    const match = rest.match(/^(\d+)\s+(.+)/);
    if (match) return { type: 'notes_append', index: parseInt(match[1], 10), text: match[2] };
  }
  if (lower.startsWith('note ')) {
    const text = trimmed.slice(5).trim();
    if (text) return { type: 'note', text };
  }
  if (lower.startsWith('notes add ')) {
    const text = trimmed.slice(10).trim();
    if (text) return { type: 'notes_add', text };
  }
  if (lower.startsWith('add last ')) {
    const tool = trimmed.slice(9).trim();
    if (tool) return { type: 'add_last', tool };
  }
  if (lower.startsWith('ask ')) {
    const question = trimmed.slice(4).trim();
    if (question) return { type: 'ask', question };
  }
  if (lower === 'hack help') return { type: 'help' };
  if (lower === 'help' || lower === '-help' || lower === '--help') return { type: 'show_help' };
  if (lower.startsWith('search ')) {
    const term = trimmed.slice(7).trim();
    if (term) return { type: 'search', term };
  }
  if (lower === 'export notes') return { type: 'export_notes' };
  if (lower.startsWith('commands ')) {
    const tool = trimmed.slice(9).trim();
    if (tool) return { type: 'commands', tool };
  }
  return null;
}
