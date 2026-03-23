import type { ActiveContext } from '@shared/types';

function hasAnyPorts(context: ActiveContext, ports: number[]): boolean {
  return ports.some(port => context.discoveredPorts.includes(port));
}

export function buildTargetSetHint(target: string): string {
  return [
    `Prowl noticed a new target: ${target}.`,
    'Start broad, then narrow once the services are real.',
    '```bash',
    `nmap -Pn -p- --min-rate 1000 ${target} -oN /workspace/${target}-full-tcp.txt`,
    '```',
  ].join('\n');
}

export function buildPortDiscoveryHint(context: ActiveContext): string | null {
  const { primaryTarget } = context;
  if (!primaryTarget || context.discoveredPorts.length === 0) {
    return null;
  }

  if (hasAnyPorts(context, [80, 443, 8080, 8443])) {
    return [
      `Prowl noticed web ports on ${primaryTarget}.`,
      'Push web recon early so we can map routes, tech, and hidden content before going deep.',
      '```bash',
      `whatweb http://${primaryTarget}`,
      `gobuster dir -u http://${primaryTarget} -w /usr/share/seclists/Discovery/Web-Content/common.txt -o /workspace/${primaryTarget}-gobuster.txt`,
      '```',
    ].join('\n');
  }

  if (hasAnyPorts(context, [139, 445])) {
    return [
      `Prowl noticed SMB on ${primaryTarget}.`,
      'Check shares and null session behavior before reaching for louder actions.',
      '```bash',
      `smbclient -L //${primaryTarget}/ -N`,
      `enum4linux -a ${primaryTarget} | tee /workspace/${primaryTarget}-enum4linux.txt`,
      '```',
    ].join('\n');
  }

  if (hasAnyPorts(context, [22])) {
    return [
      `Prowl noticed SSH on ${primaryTarget}.`,
      'Get version context and usernames first. That usually shapes the next move.',
      '```bash',
      `nmap -sV -p 22 ${primaryTarget}`,
      '```',
    ].join('\n');
  }

  if (hasAnyPorts(context, [3389])) {
    return [
      `Prowl noticed RDP on ${primaryTarget}.`,
      'Confirm encryption and NLA before you treat it as a credential target.',
      '```bash',
      `nmap -sV --script rdp-enum-encryption -p 3389 ${primaryTarget}`,
      '```',
    ].join('\n');
  }

  return [
    `Prowl noticed new listening ports on ${primaryTarget}.`,
    'Lock in service fingerprints before choosing a path.',
    '```bash',
    `nmap -sV -sC ${primaryTarget} -oN /workspace/${primaryTarget}-services.txt`,
    '```',
  ].join('\n');
}

export function buildServiceDiscoveryHint(context: ActiveContext): string | null {
  const { primaryTarget, scannedServices } = context;
  if (!primaryTarget || scannedServices.length === 0) {
    return null;
  }

  const normalized = scannedServices.join(' | ').toLowerCase();

  if (normalized.includes('http') || normalized.includes('apache') || normalized.includes('nginx')) {
    return [
      `Prowl noticed HTTP service fingerprints on ${primaryTarget}.`,
      'Now is a good time to align browser recon with screenshotting, route discovery, and tech fingerprinting.',
      '```bash',
      `curl -I http://${primaryTarget}`,
      `whatweb http://${primaryTarget}`,
      '```',
    ].join('\n');
  }

  if (normalized.includes('microsoft-ds') || normalized.includes('netbios') || normalized.includes('smb')) {
    return [
      `Prowl noticed SMB-related service detail on ${primaryTarget}.`,
      'Collect naming, shares, and auth behavior before you branch into domain attack paths.',
      '```bash',
      `crackmapexec smb ${primaryTarget}`,
      `smbclient -L //${primaryTarget}/ -N`,
      '```',
    ].join('\n');
  }

  if (normalized.includes('mysql') || normalized.includes('mariadb') || normalized.includes('postgres')) {
    return [
      `Prowl noticed a database service on ${primaryTarget}.`,
      'Confirm exposure and versioning before attempting auth or dumping paths.',
      '```bash',
      `nmap -sV ${primaryTarget} -p ${context.discoveredPorts.join(',')}`,
      '```',
    ].join('\n');
  }

  return null;
}

export function buildBrowserScanHint(url: string, content: string): string {
  const normalized = content.toLowerCase();

  if (normalized.includes('"forms":[') || normalized.includes('"inputs":[') || normalized.includes('"action"')) {
    return [
      `Prowl scanned ${url} and noticed form surface worth reviewing.`,
      'Trace input names, hidden fields, and auth flow before fuzzing blindly.',
      'Focus on parameter discovery, default creds, and client-side trust assumptions.',
    ].join('\n');
  }

  if (normalized.includes('/api') || normalized.includes('fetch(') || normalized.includes('xmlhttprequest')) {
    return [
      `Prowl scanned ${url} and noticed client-side hints of API activity.`,
      'Map endpoints and auth tokens next. The JS layer may expose the real attack surface faster than the HTML.',
    ].join('\n');
  }

  return [
    `Prowl scanned ${url}.`,
    'Use the browser result with manual inspection and content discovery to turn page context into an attack surface map.',
  ].join('\n');
}

export function buildVPNConnectedHint(ip?: string): string {
  return [
    `Prowl noticed the VPN tunnel is up${ip ? ` with tunnel IP ${ip}` : ''}.`,
    'Re-run discovery and validate target reachability now that routed access is available.',
    '```bash',
    'ip addr show tun0',
    '```',
  ].join('\n');
}

export function buildContainerRunningHint(): string {
  return [
    'Prowl noticed the Kali container is running.',
    'Open a Kali tab and keep loot in `/workspace` so commands, notes, and files stay aligned.',
  ].join('\n');
}

export function buildWorkspaceLootHint(fileName: string): string {
  return [
    `Prowl noticed a new workspace file: ${fileName}.`,
    'Review it while it is still fresh and tie the interesting lines back to the current target.',
  ].join('\n');
}
