import type {
  ActiveContext,
  Finding,
  MissionMode,
  MissionModeConfidence,
  MissionModeId,
} from '@shared/types';
import type { ProactiveEvent } from '../store/proactiveEventStore';

interface MissionModeMeta {
  label: string;
  description: string;
}

export const MISSION_MODE_META: Record<MissionModeId, MissionModeMeta> = {
  planning: {
    label: 'Planning',
    description: 'Anchor the engagement and establish the first deliberate step.',
  },
  recon: {
    label: 'Recon',
    description: 'Expand visibility and turn unknown surface area into concrete services.',
  },
  web: {
    label: 'Web',
    description: 'Drive browser, route, and content enumeration against web-facing services.',
  },
  windows: {
    label: 'Windows',
    description: 'Push SMB, RPC, WinRM, and Windows-auth enumeration deeper.',
  },
  internal: {
    label: 'Internal',
    description: 'Use fresh network access to map reachable hosts and pivot opportunities.',
  },
  credentials: {
    label: 'Credentials',
    description: 'Validate, crack, or operationalize credential material with discipline.',
  },
  exploit: {
    label: 'Exploit',
    description: 'Turn the strongest lead into a focused exploitation sequence.',
  },
  dns: {
    label: 'DNS',
    description: 'Map naming, resolution, and subdomain signals before switching tracks.',
  },
};

function buildMissionMode(
  id: MissionModeId,
  confidence: MissionModeConfidence,
  reason: string,
  source: MissionMode['source'] = 'auto'
): MissionMode {
  return {
    id,
    label: MISSION_MODE_META[id].label,
    description: MISSION_MODE_META[id].description,
    source,
    confidence,
    reason,
    updatedAt: new Date().toISOString(),
  };
}

function classifyRecentCommand(command?: string): MissionModeId | null {
  if (!command) return null;
  const lower = command.toLowerCase();

  if (/(hydra|john|hashcat|kerbrute|cewl|crunch)/.test(lower)) return 'credentials';
  if (/(msfconsole|searchsploit|exploitdb|metasploit)/.test(lower)) return 'exploit';
  if (/(proxychains|arp-scan|netdiscover|fping|ligolo|chisel|socat)/.test(lower)) return 'internal';
  if (/(gobuster|feroxbuster|ffuf|dirb|nikto|whatweb|httpx|curl|wget|wfuzz|sqlmap)/.test(lower)) return 'web';
  if (/(enum4linux|smbclient|rpcclient|crackmapexec|netexec|evil-winrm|impacket|wmiexec|psexec|rdp|winrm)/.test(lower)) return 'windows';
  if (/(dig|host |nslookup|dnsrecon|dnsenum|amass|subfinder)/.test(lower)) return 'dns';
  if (/(nmap|masscan|rustscan|naabu)/.test(lower)) return 'recon';

  return null;
}

function hasRecentEvent(events: { payload: ProactiveEvent }[], type: ProactiveEvent['type']): boolean {
  return events.some((event) => event.payload.type === type);
}

export function inferMissionMode(
  context: ActiveContext,
  findings: Finding[],
  proactiveEvents: { payload: ProactiveEvent }[]
): MissionMode {
  if (!context.primaryTarget) {
    return buildMissionMode('planning', 'low', 'No primary target is set yet.');
  }

  const targetFindings = findings.filter((finding) => finding.target === context.primaryTarget);
  const latestCommand = context.recentCommands[0];
  const commandMode = classifyRecentCommand(latestCommand);
  const hasWebSurface = context.discoveredPorts.some((port) => [80, 443, 8080, 8443].includes(port))
    || context.scannedServices.some((service) => /(http|https|nginx|apache|iis|tomcat|jetty)/i.test(service));
  const hasWindowsSurface = context.discoveredPorts.some((port) => [139, 445, 3389, 5985, 5986].includes(port))
    || context.scannedServices.some((service) => /(smb|microsoft-ds|netbios|winrm|rdp)/i.test(service));
  const hasCredentialSignal = targetFindings.some((finding) =>
    finding.kind === 'credential'
    || /(credential|creds|password|hash|ntlm|login)/i.test(`${finding.title} ${finding.summary} ${finding.tags.join(' ')}`)
  );
  const hasExploitSignal = targetFindings.some((finding) =>
    finding.kind === 'vulnerability'
    || (finding.confidence === 'high' && /(critical|vuln|rce|shell|admin)/i.test(`${finding.title} ${finding.summary} ${finding.tags.join(' ')}`))
  );

  if (commandMode === 'credentials' || hasCredentialSignal) {
    return buildMissionMode(
      'credentials',
      commandMode === 'credentials' ? 'high' : 'medium',
      commandMode === 'credentials'
        ? `Recent command is credential-focused: ${latestCommand}`
        : 'Captured findings suggest credential material is now a primary lead.'
    );
  }

  if (commandMode === 'exploit' || hasExploitSignal) {
    return buildMissionMode(
      'exploit',
      commandMode === 'exploit' ? 'high' : 'medium',
      commandMode === 'exploit'
        ? `Recent command is exploitation-focused: ${latestCommand}`
        : 'A high-confidence vulnerability or exploit lead is active.'
    );
  }

  if (commandMode === 'internal' || hasRecentEvent(proactiveEvents, 'vpn_connected')) {
    return buildMissionMode(
      'internal',
      commandMode === 'internal' ? 'high' : 'medium',
      commandMode === 'internal'
        ? `Recent command is pivoting or internal-recon focused: ${latestCommand}`
        : 'The VPN tunnel is active, so internal mapping should stay in focus.'
    );
  }

  if (commandMode === 'web' || hasRecentEvent(proactiveEvents, 'browser_scanned') || hasWebSurface) {
    return buildMissionMode(
      'web',
      commandMode === 'web' ? 'high' : hasWebSurface ? 'medium' : 'low',
      commandMode === 'web'
        ? `Recent command is web-focused: ${latestCommand}`
        : hasRecentEvent(proactiveEvents, 'browser_scanned')
          ? 'A fresh browser scan suggests the web surface is active.'
          : 'Web-facing services are present on the current target.'
    );
  }

  if (commandMode === 'windows' || hasWindowsSurface) {
    return buildMissionMode(
      'windows',
      commandMode === 'windows' ? 'high' : 'medium',
      commandMode === 'windows'
        ? `Recent command is Windows-focused: ${latestCommand}`
        : 'SMB, WinRM, or RDP surface is present on the current target.'
    );
  }

  if (commandMode === 'dns') {
    return buildMissionMode('dns', 'high', `Recent command is DNS-focused: ${latestCommand}`);
  }

  if (context.discoveredPorts.length === 0 || context.scannedServices.length === 0 || commandMode === 'recon') {
    return buildMissionMode(
      'recon',
      commandMode === 'recon' ? 'high' : 'medium',
      commandMode === 'recon'
        ? `Recent command is reconnaissance-focused: ${latestCommand}`
        : context.discoveredPorts.length === 0
          ? 'The target still needs broad discovery.'
          : 'Service fingerprinting is still incomplete.'
    );
  }

  return buildMissionMode(
    'recon',
    'low',
    targetFindings.length > 0
      ? `Latest finding: ${targetFindings.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].title}`
      : 'No stronger mission mode signal is active yet.'
  );
}

export function getFindingMissionRelevance(finding: Finding, missionModeId: MissionModeId): number {
  switch (missionModeId) {
    case 'planning':
      return finding.kind === 'target' ? 90 : 20;
    case 'recon':
      if (finding.kind === 'target') return 100;
      if (finding.kind === 'port') return 90;
      if (finding.kind === 'service') return 85;
      return 40;
    case 'web':
      if (finding.kind === 'url') return 100;
      if (/(http|https|web|content|route|directory|virtual-host)/i.test(`${finding.title} ${finding.summary} ${finding.tags.join(' ')}`)) return 90;
      if (finding.kind === 'service' || finding.kind === 'vulnerability') return 75;
      return 35;
    case 'windows':
      if (finding.kind === 'credential') return 100;
      if (/(smb|microsoft-ds|netbios|winrm|rdp|share|rpc|domain)/i.test(`${finding.title} ${finding.summary} ${finding.tags.join(' ')}`)) return 90;
      if (finding.kind === 'service' || finding.kind === 'port') return 70;
      return 35;
    case 'internal':
      if (finding.kind === 'target') return 95;
      if (finding.kind === 'port' || finding.kind === 'service') return 85;
      return 45;
    case 'credentials':
      if (finding.kind === 'credential') return 100;
      if (/(password|hash|login|default-cred|user)/i.test(`${finding.title} ${finding.summary} ${finding.tags.join(' ')}`)) return 90;
      return 35;
    case 'exploit':
      if (finding.kind === 'vulnerability') return 100;
      if (finding.confidence === 'high') return 85;
      if (finding.kind === 'service') return 65;
      return 30;
    case 'dns':
      if (/(dns|subdomain|host|domain|zone)/i.test(`${finding.title} ${finding.summary} ${finding.tags.join(' ')}`)) return 95;
      if (finding.kind === 'target' || finding.kind === 'url') return 60;
      return 25;
    default:
      return 0;
  }
}
