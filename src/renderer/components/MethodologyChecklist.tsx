import React, { useState, useCallback, useEffect } from 'react';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'found';
  tools?: string[];
}

export interface MethodologyPhase {
  id: string;
  label: string;
  items: ChecklistItem[];
}

const METHODOLOGIES: Record<string, MethodologyPhase[]> = {
  general: [
    {
      id: 'recon', label: 'Reconnaissance', items: [
        { id: 'full-tcp', label: 'Full TCP port scan', description: 'nmap -p- or masscan all ports', status: 'pending', tools: ['nmap-full', 'masscan'] },
        { id: 'service-detect', label: 'Service version detection', description: 'nmap -sV -sC on discovered ports', status: 'pending', tools: ['nmap-quick'] },
        { id: 'udp-scan', label: 'UDP top ports', description: 'Check SNMP, DNS, TFTP, NTP', status: 'pending', tools: ['nmap-udp'] },
        { id: 'web-tech', label: 'Web technology fingerprint', description: 'whatweb, wappalyzer', status: 'pending', tools: ['whatweb'] },
        { id: 'dns-enum', label: 'DNS enumeration', description: 'Subdomains, zone transfers', status: 'pending', tools: ['dnsrecon', 'gobuster-dns'] },
      ]
    },
    {
      id: 'enum', label: 'Enumeration', items: [
        { id: 'dir-brute', label: 'Directory brute-force', description: 'gobuster, feroxbuster with medium wordlist', status: 'pending', tools: ['gobuster-dir', 'feroxbuster'] },
        { id: 'vhost-enum', label: 'Virtual host enumeration', description: 'gobuster vhost, wfuzz Host header', status: 'pending', tools: ['gobuster-vhost'] },
        { id: 'api-enum', label: 'API endpoint discovery', description: 'Check /api, /swagger, /docs, /graphql', status: 'pending' },
        { id: 'smb-enum', label: 'SMB enumeration', description: 'Null session, shares, users', status: 'pending', tools: ['impacket-smb', 'enum4linux'] },
        { id: 'source-review', label: 'Source code review', description: 'Check page source, JS files, comments', status: 'pending' },
      ]
    },
    {
      id: 'vuln', label: 'Vulnerability Assessment', items: [
        { id: 'version-vulns', label: 'Check service version CVEs', description: 'searchsploit, Google known vulns', status: 'pending', tools: ['searchsploit'] },
        { id: 'sqli', label: 'SQL injection', description: 'Test all input fields and parameters', status: 'pending', tools: ['sqlmap'] },
        { id: 'xss', label: 'Cross-site scripting', description: 'Reflected, stored, DOM-based', status: 'pending' },
        { id: 'lfi-rfi', label: 'File inclusion (LFI/RFI)', description: 'Path traversal, /etc/passwd', status: 'pending' },
        { id: 'auth-bypass', label: 'Authentication bypass', description: 'Default creds, token manipulation, IDOR', status: 'pending' },
        { id: 'ssrf', label: 'SSRF', description: 'Server-side request forgery', status: 'pending' },
        { id: 'deserialization', label: 'Deserialization', description: 'Java, PHP, Python pickle', status: 'pending' },
      ]
    },
    {
      id: 'exploit', label: 'Exploitation', items: [
        { id: 'initial-access', label: 'Initial access achieved', description: 'Shell, RCE, or foothold established', status: 'pending' },
        { id: 'user-flag', label: 'User flag captured', description: 'user.txt or equivalent', status: 'pending' },
        { id: 'persistence', label: 'Persistence (if needed)', description: 'SSH key, cron job, web shell', status: 'pending' },
      ]
    },
    {
      id: 'privesc', label: 'Privilege Escalation', items: [
        { id: 'suid-bins', label: 'SUID/SGID binaries', description: 'find / -perm -4000', status: 'pending', tools: ['privesc-suid'] },
        { id: 'sudo-perms', label: 'Sudo permissions', description: 'sudo -l, GTFOBins', status: 'pending', tools: ['privesc-sudo'] },
        { id: 'cron-jobs', label: 'Cron jobs / scheduled tasks', description: 'Writable scripts, path injection', status: 'pending', tools: ['privesc-cron'] },
        { id: 'capabilities', label: 'Linux capabilities', description: 'getcap -r /', status: 'pending', tools: ['privesc-caps'] },
        { id: 'kernel-exploit', label: 'Kernel exploit', description: 'Check kernel version, dirty pipe/cow', status: 'pending' },
        { id: 'password-reuse', label: 'Password reuse / pivoting', description: 'Try found credentials on other services', status: 'pending' },
        { id: 'linpeas', label: 'LinPEAS / WinPEAS', description: 'Automated privilege escalation scan', status: 'pending', tools: ['linpeas', 'winpeas'] },
        { id: 'root-flag', label: 'Root flag captured', description: 'root.txt or equivalent', status: 'pending' },
      ]
    },
  ],
  windows: [
    {
      id: 'ad-recon', label: 'AD Reconnaissance', items: [
        { id: 'ad-users', label: 'Enumerate domain users', description: 'crackmapexec, rpcclient, LDAP', status: 'pending', tools: ['crackmapexec-users', 'rpcclient', 'ldapsearch'] },
        { id: 'ad-groups', label: 'Enumerate groups', description: 'Domain Admins, Backup Operators', status: 'pending' },
        { id: 'ad-shares', label: 'Enumerate SMB shares', description: 'Null session, authenticated', status: 'pending', tools: ['crackmapexec-shares', 'impacket-smb'] },
        { id: 'ad-spn', label: 'Service principal names', description: 'Kerberoastable accounts', status: 'pending', tools: ['impacket-getuserspns'] },
        { id: 'ad-asrep', label: 'AS-REP roastable users', description: 'No pre-auth required', status: 'pending', tools: ['impacket-getnpusers'] },
        { id: 'ad-bloodhound', label: 'BloodHound collection', description: 'Map AD relationships and attack paths', status: 'pending', tools: ['bloodhound'] },
      ]
    },
    {
      id: 'ad-attack', label: 'AD Attacks', items: [
        { id: 'ad-kerberoast', label: 'Kerberoasting', description: 'Request TGS tickets, crack offline', status: 'pending', tools: ['impacket-getuserspns'] },
        { id: 'ad-asrep-roast', label: 'AS-REP roasting', description: 'Crack AS-REP hashes', status: 'pending', tools: ['impacket-getnpusers'] },
        { id: 'ad-spray', label: 'Password spraying', description: 'Common passwords across all users', status: 'pending', tools: ['kerbrute'] },
        { id: 'ad-relay', label: 'NTLM relay', description: 'Responder + ntlmrelayx', status: 'pending' },
        { id: 'ad-delegation', label: 'Delegation abuse', description: 'Constrained/unconstrained delegation', status: 'pending' },
        { id: 'ad-dcsync', label: 'DCSync', description: 'Extract all hashes from DC', status: 'pending', tools: ['impacket-secretsdump'] },
        { id: 'ad-golden', label: 'Golden ticket', description: 'KRBTGT hash for persistence', status: 'pending' },
      ]
    },
    {
      id: 'win-privesc', label: 'Windows Privilege Escalation', items: [
        { id: 'win-whoami', label: 'Check privileges', description: 'whoami /priv, whoami /groups', status: 'pending' },
        { id: 'win-services', label: 'Vulnerable services', description: 'Unquoted paths, weak perms', status: 'pending' },
        { id: 'win-scheduled', label: 'Scheduled tasks', description: 'Writable task binaries', status: 'pending' },
        { id: 'win-registry', label: 'Registry autoruns', description: 'AlwaysInstallElevated, RunOnce', status: 'pending' },
        { id: 'win-tokens', label: 'Token impersonation', description: 'SeImpersonatePrivilege, Potato attacks', status: 'pending' },
        { id: 'win-winpeas', label: 'WinPEAS', description: 'Automated Windows privesc scan', status: 'pending', tools: ['winpeas'] },
      ]
    },
  ],
};

interface MethodologyChecklistProps {
  missionMode: string;
  engagementId: string;
  onRunTool?: (toolId: string) => void;
  onClose: () => void;
}

const MethodologyChecklist: React.FC<MethodologyChecklistProps> = ({
  missionMode,
  engagementId,
  onRunTool,
  onClose,
}) => {
  const storageKey = `prowl-checklist-${engagementId}`;
  const [statuses, setStatuses] = useState<Record<string, ChecklistItem['status']>>({});

  // Load saved statuses
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setStatuses(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [storageKey]);

  // Save on change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(statuses));
  }, [statuses, storageKey]);

  const cycleStatus = useCallback((itemId: string) => {
    setStatuses(prev => {
      const current = prev[itemId] || 'pending';
      const next: ChecklistItem['status'] =
        current === 'pending' ? 'in_progress' :
        current === 'in_progress' ? 'done' :
        current === 'done' ? 'found' :
        'pending';
      return { ...prev, [itemId]: next };
    });
  }, []);

  const isWindows = missionMode === 'windows' || missionMode === 'internal' || missionMode === 'credentials';
  const methodology = isWindows ? [...METHODOLOGIES.general, ...METHODOLOGIES.windows] : METHODOLOGIES.general;

  const totalItems = methodology.reduce((sum, phase) => sum + phase.items.length, 0);
  const completedItems = methodology.reduce((sum, phase) =>
    sum + phase.items.filter(item => {
      const s = statuses[item.id] || 'pending';
      return s === 'done' || s === 'found';
    }).length, 0
  );

  const statusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'pending': return { symbol: '', bg: 'var(--bg3)', color: 'var(--text3)' };
      case 'in_progress': return { symbol: '~', bg: '#fbbf2430', color: '#fbbf24' };
      case 'done': return { symbol: '/', bg: '#4ade8030', color: '#4ade80' };
      case 'found': return { symbol: '!', bg: '#f4726030', color: '#f47260' };
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="container-panel" style={{ width: 520, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="container-panel-header">
          <span className="container-panel-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: -2 }}>
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Methodology
            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>
              {completedItems}/{totalItems} complete
            </span>
          </span>
          <button className="theme-picker-close" onClick={onClose}>x</button>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, transition: 'width 0.3s ease',
              width: `${totalItems ? (completedItems / totalItems) * 100 : 0}%`,
              background: completedItems === totalItems && totalItems > 0
                ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                : 'linear-gradient(90deg, var(--accent), var(--accent2))',
            }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 12 }}>
            <span>{'Click to cycle: pending \u2192 in progress \u2192 done \u2192 found'}</span>
          </div>
        </div>

        <div className="container-panel-body" style={{ overflow: 'auto', maxHeight: '70vh' }}>
          {methodology.map(phase => {
            const phaseComplete = phase.items.every(item => {
              const s = statuses[item.id] || 'pending';
              return s === 'done' || s === 'found';
            });

            return (
              <div key={phase.id} style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: phaseComplete ? '#4ade80' : 'var(--text2)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '4px 0', borderBottom: '1px solid var(--border)', marginBottom: 4,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {phaseComplete && <span style={{ color: '#4ade80' }}>&#10003;</span>}
                  {phase.label}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {phase.items.map(item => {
                    const status = statuses[item.id] || item.status;
                    const icon = statusIcon(status);

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                          background: icon.bg,
                          transition: 'background 0.1s',
                          opacity: status === 'done' ? 0.6 : 1,
                        }}
                        onClick={() => cycleStatus(item.id)}
                      >
                        {/* Status indicator */}
                        <span style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: `2px solid ${icon.color}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: icon.color, flexShrink: 0,
                        }}>
                          {icon.symbol}
                        </span>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, fontWeight: 500, color: 'var(--text1)',
                            textDecoration: status === 'done' ? 'line-through' : 'none',
                          }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{item.description}</div>
                        </div>

                        {/* Quick tool buttons */}
                        {item.tools && onRunTool && (
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            {item.tools.slice(0, 2).map(toolId => (
                              <button
                                key={toolId}
                                onClick={(e) => { e.stopPropagation(); onRunTool(toolId); }}
                                style={{
                                  padding: '1px 5px', fontSize: 8, background: 'var(--bg3)',
                                  border: '1px solid var(--border)', borderRadius: 3,
                                  color: 'var(--accent)', cursor: 'pointer', fontWeight: 600,
                                }}
                                title={`Run ${toolId}`}
                              >
                                RUN
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MethodologyChecklist;
