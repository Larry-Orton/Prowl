import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AIMessage, AIMessageAction, ActiveContext, Note, MissionMode } from '@shared/types';
import { useMissionModeStore } from '../store/missionModeStore';

interface SendMessageOptions {
  supplementalContext?: string;
  logToNotebook?: boolean;
}

function formatTerminalActivity(context: ActiveContext): string {
  if (context.terminalSessions.length === 0) {
    return '(none)';
  }

  return context.terminalSessions
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)
    .map((session) => {
      if (session.recentActivity.length === 0) {
        return `- ${session.title} [${session.shellType}] has no tracked commands yet.`;
      }

      const activity = session.recentActivity
        .slice(0, 3)
        .map((entry, index) => {
          const output = entry.output
            ? entry.output.slice(-900)
            : '(no output captured yet)';
          const indentedOutput = output
            .split('\n')
            .map((line) => `      ${line}`)
            .join('\n');
          return [
            `  ${index + 1}. CMD: ${entry.command}`,
            '     OUT:',
            indentedOutput,
          ].join('\n');
        })
        .join('\n');

      return [
        `- ${session.title} [${session.shellType}]`,
        activity,
      ].join('\n');
    })
    .join('\n');
}

function buildSystemPrompt(
  context: ActiveContext,
  notes: Note[],
  missionMode: MissionMode,
  supplementalContext?: string
): string {
  return `You are an expert penetration tester AI assistant embedded inside Prowl, an intelligent pentester terminal application.

## Current Session
Primary Target: ${context.primaryTarget || 'not set'}
Mission Mode: ${missionMode.label} (${missionMode.confidence})
Mission Mode Reason: ${missionMode.reason}
Discovered Ports: ${context.discoveredPorts.join(', ') || 'none yet'}
Scanned Services: ${context.scannedServices.join(', ') || 'none yet'}
Recent Commands Across Terminals: ${context.recentCommands.slice(0, 12).join(', ') || 'none'}
Most Recent Terminal Output:
${context.lastCommandOutput.slice(-1500) || '(none)'}
Open Terminal Activity:
${formatTerminalActivity(context)}

Session Notes:
${notes.map(n => `- ${n.title}: ${n.content.slice(0, 200)}`).join('\n') || '(none)'}

${supplementalContext ? `Focused Notebook Context:
${supplementalContext}
` : ''}

## Kali Environment
The user is working inside a PROWL Kali container (kalilinux/kali-rolling). Always give commands and paths that work in this environment.

### Installed Tools
**Recon:** nmap, masscan, enum4linux, dnsrecon, dnsenum, whois, theharvester, amass, subfinder, httpx-toolkit
**Web Testing:** gobuster, feroxbuster, dirb, nikto, sqlmap, wfuzz, whatweb, wafw00f
**Exploitation:** metasploit-framework (msfconsole), exploitdb (searchsploit)
**Password Attacks:** hydra, john, hashcat, crunch, cewl
**Post-Exploitation:** evil-winrm, impacket-scripts (impacket-psexec, impacket-smbclient, etc.), crackmapexec, chisel, ligolo-ng
**Networking/VPN:** openvpn, wireguard-tools, proxychains4, microsocks, socat, ncat, netcat-traditional
**Utilities:** python3, pip3, git, curl, wget, vim, nano, tmux, zsh, jq

### Wordlist Paths (IMPORTANT — always use these exact paths)
- /usr/share/wordlists/rockyou.txt
- /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
- /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-small.txt
- /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt
- /usr/share/seclists/Discovery/Web-Content/common.txt
- /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt
- /usr/share/seclists/Discovery/Web-Content/raft-medium-files.txt
- /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt
- /usr/share/seclists/Passwords/Default-Credentials/
- /usr/share/seclists/Usernames/
- /usr/share/wordlists/dirbuster/ (symlink to seclists Web-Content)

### Workspace
The user's workspace is mounted at /workspace. Use this for saving output, scripts, and loot.

## Web Tools
You have two web tools available:
- web_search: search the web for current results and URLs
- web_fetch: fetch the readable contents of a specific web page

USE THEM when the user asks about:
- Specific CVEs, exploits, or vulnerabilities
- Current tool documentation or usage
- Writeups, walkthroughs, or techniques
- Any topic where up-to-date information would help
Do NOT say you cannot search the web — you CAN. Search first, then fetch relevant pages when the actual article contents matter.

## Response Guidelines
- Provide concise, actionable penetration testing guidance
- Treat the mission mode as the current phase of the engagement unless the newest evidence clearly points elsewhere
- Format commands in code blocks using \`\`\` syntax — the user can click commands to paste them into the terminal
- Be direct and technical
- Focus on the current target context when relevant
- Always use the correct paths from this environment — never guess paths
- Do not provide warnings about legality unless specifically asked — assume the user has authorization`;
}

export interface UseAIReturn {
  messages: AIMessage[];
  isThinking: boolean;
  hasApiKey: boolean;
  showApiKeyModal: boolean;
  sendMessage: (
    content: string,
    context: ActiveContext,
    notes: Note[],
    options?: SendMessageOptions
  ) => Promise<AIMessage | null>;
  saveApiKey: (key: string) => void;
  dismissModal: () => void;
  openModal: () => void;
  clearMessages: () => void;
  appendMessage: (
    role: 'user' | 'assistant',
    content: string,
    variant?: AIMessage['variant'],
    actions?: AIMessageAction[]
  ) => void;
  appendProactiveMessage: (
    content: string,
    variant?: Exclude<AIMessage['variant'], 'chat'>,
    options?: {
      eventKey?: string;
      cooldownMs?: number;
      actions?: AIMessageAction[];
    }
  ) => void;
}

export function useAI(): UseAIReturn {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const proactiveEventTimesRef = useRef<Map<string, number>>(new Map());

  // Check if API key exists on mount
  useEffect(() => {
    window.electronAPI.ai.getApiKey().then(setHasApiKey);
  }, []);

  const saveApiKey = useCallback(async (key: string) => {
    await window.electronAPI.ai.setApiKey(key);
    setHasApiKey(true);
    setShowApiKeyModal(false);
  }, []);

  const dismissModal = useCallback(() => {
    setShowApiKeyModal(false);
  }, []);

  const openModal = useCallback(() => {
    setShowApiKeyModal(true);
  }, []);

  const appendMessage = useCallback((
    role: 'user' | 'assistant',
    content: string,
    variant: AIMessage['variant'] = 'chat',
    actions?: AIMessageAction[],
    logToNotebook = true
  ) => {
    const msg: AIMessage = {
      id: uuidv4(),
      role,
      variant,
      content,
      timestamp: new Date().toISOString(),
      actions,
      logToNotebook,
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const appendProactiveMessage = useCallback((
    content: string,
    variant: Exclude<AIMessage['variant'], 'chat'> = 'proactive',
    options?: {
      eventKey?: string;
      cooldownMs?: number;
      actions?: AIMessageAction[];
    }
  ) => {
    const eventKey = options?.eventKey;
    const cooldownMs = options?.cooldownMs ?? 120000;
    if (eventKey) {
      const now = Date.now();
      const lastSeen = proactiveEventTimesRef.current.get(eventKey) ?? 0;
      if (now - lastSeen < cooldownMs) {
        return;
      }
      proactiveEventTimesRef.current.set(eventKey, now);
    }
    appendMessage('assistant', content, variant, options?.actions);
  }, [appendMessage]);

  const sendMessage = useCallback(async (
    content: string,
    context: ActiveContext,
    notes: Note[],
    options?: SendMessageOptions
  ) => {
    if (!hasApiKey) {
      setShowApiKeyModal(true);
      return null;
    }

    const logToNotebook = options?.logToNotebook ?? true;

    // Add user message
    const userMsg: AIMessage = {
      id: uuidv4(),
      role: 'user',
      variant: 'chat',
      content,
      timestamp: new Date().toISOString(),
      logToNotebook,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Build messages array for API (include last 10 messages for context)
      const recentMsgs = [...messages, userMsg].slice(-10);
      const apiMessages = recentMsgs.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const systemPrompt = buildSystemPrompt(
        context,
        notes,
        useMissionModeStore.getState().mode,
        options?.supplementalContext
      );

      // Call through main process proxy — API key never touches renderer
      const assistantContent = await window.electronAPI.ai.send(apiMessages, systemPrompt);

      const assistantMsg: AIMessage = {
        id: uuidv4(),
        role: 'assistant',
        variant: 'chat',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        logToNotebook,
      };
      setMessages(prev => [...prev, assistantMsg]);
      return assistantMsg;

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';

      // If auth error, prompt for new key
      if (errMsg.includes('401') || errMsg.toLowerCase().includes('invalid') || errMsg.toLowerCase().includes('api key')) {
        await window.electronAPI.ai.deleteApiKey();
        setHasApiKey(false);
        setShowApiKeyModal(true);
      }

      const errAssistant: AIMessage = {
        id: uuidv4(),
        role: 'assistant',
        variant: 'warning',
        content: `Error: ${errMsg}`,
        timestamp: new Date().toISOString(),
        logToNotebook: false,
      };
      setMessages(prev => [...prev, errAssistant]);
      return errAssistant;
    } finally {
      setIsThinking(false);
    }
  }, [messages, hasApiKey]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isThinking,
    hasApiKey,
    showApiKeyModal,
    sendMessage,
    saveApiKey,
    dismissModal,
    openModal,
    clearMessages,
    appendMessage,
    appendProactiveMessage,
  };
}
