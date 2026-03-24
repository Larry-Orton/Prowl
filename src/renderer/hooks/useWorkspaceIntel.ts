import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceFile } from '@shared/types';

interface WorkspaceIntel {
  summaryText: string;
  fileCount: number;
  lastUpdated: string | null;
}

function classifyArtifact(name: string): string {
  const lower = name.toLowerCase();

  if (/(full-tcp|all[-_]?ports|tcp-scan|masscan|nmap)/.test(lower)) return 'full_tcp_scan';
  if (/(udp)/.test(lower)) return 'udp_scan';
  if (/(services|service|versions|svc|default-script|-sv|-sc)/.test(lower)) return 'service_scan';
  if (/(whatweb|nikto|ffuf|gobuster|ferox|dirb|routes|curl|web|http|api)/.test(lower)) return 'web_recon';
  if (/(enum4linux|crackmapexec|smb|rpc|ldap|kerb|winrm|rdp|ad|bloodhound)/.test(lower)) return 'windows_internal_recon';
  if (/(hash|creds|credential|password|secret|token|sam|ntlm|tickets)/.test(lower)) return 'credentials';
  if (/(user\.txt|root\.txt|proof|flag|loot)/.test(lower)) return 'loot';
  if (/(exploit|shell|reverse|payload|privesc|sudo|suid|linpeas|winpeas)/.test(lower)) return 'access_or_privesc';
  return 'artifact';
}

function isPreviewCandidate(file: WorkspaceFile): boolean {
  const lower = file.name.toLowerCase();
  if (file.type !== 'file') return false;
  if (/\.(png|jpg|jpeg|gif|webp|zip|gz|7z|rar|pdf|db|sqlite|bin)$/i.test(lower)) return false;
  return true;
}

function formatModified(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizePreview(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const signalLines = lines.filter((line) => (
    /(open|closed|filtered|report for|starting nmap|service|title:|server:|login|password|credential|shell|uid=|gid=|flag|user\.txt|root\.txt|directory|endpoint|http|ssh|smb)/i.test(line)
  ));

  const selected = (signalLines.length > 0 ? signalLines : lines).slice(0, 8);
  return selected.join(' | ').slice(0, 900) || '(no readable preview)';
}

async function listRecursiveWorkspaceFiles(dirPath: string, depth = 2): Promise<WorkspaceFile[]> {
  const entries = await window.electronAPI.workspace.listFiles(dirPath);
  if (depth <= 0) {
    return entries;
  }

  const nested = await Promise.all(
    entries
      .filter((entry) => entry.type === 'directory')
      .slice(0, 6)
      .map(async (entry) => {
        try {
          return await listRecursiveWorkspaceFiles(entry.path, depth - 1);
        } catch {
          return [];
        }
      })
  );

  return [...entries, ...nested.flat()];
}

function buildWorkspaceSummary(workspacePath: string, files: WorkspaceFile[], previews: Map<string, string>): string {
  const actualFiles = files
    .filter((file) => file.type === 'file')
    .slice()
    .sort((a, b) => b.modified.localeCompare(a.modified));

  if (actualFiles.length === 0) {
    return [
      `Workspace intelligence for ${workspacePath}:`,
      '- No saved target artifacts yet.',
    ].join('\n');
  }

  const reconCompleteKinds = new Set([
    'full_tcp_scan',
    'udp_scan',
    'service_scan',
    'web_recon',
    'windows_internal_recon',
    'credentials',
    'loot',
  ]);

  const completedSteps = Array.from(new Set(
    actualFiles
      .slice(0, 12)
      .map((file) => ({ name: file.name, kind: classifyArtifact(file.name) }))
      .filter((file) => reconCompleteKinds.has(file.kind))
      .map((file) => `${file.kind} (${file.name})`)
  ));

  const exploitArtifacts = actualFiles
    .filter((file) => (
      /\.(xslt|xml|py|sh|php|pl)$/i.test(file.name)
      || /(exploit|payload|shell|reverse|exsl|lfi|xxe)/i.test(file.name)
    ))
    .slice(0, 5);

  const recentArtifacts = actualFiles.slice(0, 8).map((file) => (
    `- ${file.name} [${classifyArtifact(file.name)}] modified ${formatModified(file.modified)}`
  ));

  const newestFile = actualFiles[0];
  const newestPreview = previews.get(newestFile.path);

  const excerptLines = newestPreview
    ? [
        `Most recent saved checkpoint: ${newestFile.name}`,
        `Checkpoint preview: ${summarizePreview(newestPreview)}`,
      ]
    : [
        `Most recent saved checkpoint: ${newestFile.name}`,
      ];

  return [
    `Workspace intelligence for ${workspacePath}:`,
    ...(completedSteps.length > 0
      ? [
          'Likely completed saved recon steps:',
          ...completedSteps.map((step) => `- ${step}`),
          '',
        ]
      : [
          'Likely completed saved recon steps:',
          '- No clear completed recon checkpoints yet.',
          '',
        ]),
    ...excerptLines,
    '',
    ...(exploitArtifacts.length > 0
      ? [
          'Saved payload or exploit artifacts present (not proof of success):',
          ...exploitArtifacts.map((file) => `- ${file.name}`),
          '',
        ]
      : []),
    'Recent saved artifacts:',
    ...recentArtifacts,
  ].join('\n').slice(0, 3200);
}

export function useWorkspaceIntel(workspacePath: string) {
  const [workspaceIntel, setWorkspaceIntel] = useState<WorkspaceIntel>({
    summaryText: `Workspace intelligence for ${workspacePath}:\n- Loading workspace artifacts...`,
    fileCount: 0,
    lastUpdated: null,
  });

  const refreshWorkspaceIntel = useCallback(async () => {
    try {
      const files = await listRecursiveWorkspaceFiles(workspacePath, 2);
      const previewCandidates = files
        .filter(isPreviewCandidate)
        .slice()
        .sort((a, b) => b.modified.localeCompare(a.modified))
        .slice(0, 5);

      const previewEntries = await Promise.all(
        previewCandidates.map(async (file) => {
          try {
            const content = await window.electronAPI.workspace.readFile(file.path);
            return [file.path, content || ''] as const;
          } catch {
            return [file.path, ''] as const;
          }
        })
      );

      const previews = new Map<string, string>(previewEntries);

      setWorkspaceIntel({
        summaryText: buildWorkspaceSummary(workspacePath, files, previews),
        fileCount: files.filter((file) => file.type === 'file').length,
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      setWorkspaceIntel({
        summaryText: `Workspace intelligence for ${workspacePath}:\n- Unable to read saved artifacts right now.`,
        fileCount: 0,
        lastUpdated: new Date().toISOString(),
      });
    }
  }, [workspacePath]);

  useEffect(() => {
    void refreshWorkspaceIntel();
    const interval = window.setInterval(() => {
      void refreshWorkspaceIntel();
    }, 12000);

    return () => window.clearInterval(interval);
  }, [refreshWorkspaceIntel]);

  return {
    workspaceIntel,
    refreshWorkspaceIntel,
  };
}
