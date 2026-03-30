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
