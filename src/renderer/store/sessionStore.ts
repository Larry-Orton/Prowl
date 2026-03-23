import { create } from 'zustand';
import { ActiveContext, TerminalSessionContext, TerminalTab } from '@shared/types';
import { NMAP_PORT_REGEX, IP_REGEX, NMAP_SERVICE_REGEX } from '@shared/constants';
import { useCommandsStore } from './commandsStore';
import { useEngagementStore } from './engagementStore';

interface SessionStore {
  context: ActiveContext;
  setTarget: (ip: string) => void;
  addDiscoveredPort: (port: number) => void;
  addScannedService: (service: string) => void;
  setLastCommandOutput: (output: string) => void;
  addRecentCommand: (cmd: string) => void;
  recordTerminalCommand: (tabId: string, shellType: 'local' | 'kali', title: string, cmd: string) => void;
  recordTerminalOutput: (tabId: string, shellType: 'local' | 'kali', title: string, output: string) => void;
  syncTerminalSessions: (tabs: TerminalTab[]) => void;
  addSessionNote: (note: string) => void;
  parseAndUpdateFromOutput: (output: string) => void;
  resetContext: () => void;
}

const MAX_RECENT_COMMANDS = 20;
const MAX_SESSION_NOTES = 50;
const MAX_TERMINAL_ACTIVITY = 6;
const MAX_ACTIVITY_OUTPUT = 2400;
const MAX_LAST_OUTPUT = 3000;

function createActivityId(): string {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stripAnsi(input: string): string {
  return input.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    ''
  );
}

function normalizeTerminalText(input: string): string {
  return stripAnsi(input)
    .replace(/\r/g, '')
    .replace(/\u0007/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sortTerminalSessions(sessions: TerminalSessionContext[]): TerminalSessionContext[] {
  return [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function upsertTerminalSession(
  sessions: TerminalSessionContext[],
  tabId: string,
  shellType: 'local' | 'kali',
  title: string,
  updatedAt: string
): TerminalSessionContext[] {
  const existing = sessions.find((session) => session.tabId === tabId);
  if (!existing) {
    return sortTerminalSessions([
      ...sessions,
      {
        tabId,
        title,
        shellType,
        updatedAt,
        recentActivity: [],
      },
    ]);
  }

  return sortTerminalSessions(
    sessions.map((session) => (
      session.tabId === tabId
        ? {
            ...session,
            title,
            shellType,
            updatedAt: session.recentActivity.length > 0 ? session.updatedAt : updatedAt,
          }
        : session
    ))
  );
}

const defaultContext: ActiveContext = {
  primaryTarget: '',
  discoveredPorts: [],
  scannedServices: [],
  lastCommandOutput: '',
  recentCommands: [],
  sessionNotes: [],
  terminalSessions: [],
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  context: { ...defaultContext },

  setTarget: (ip) => set((state) => ({
    context: { ...state.context, primaryTarget: ip },
  })),

  addDiscoveredPort: (port) => set((state) => ({
    context: {
      ...state.context,
      discoveredPorts: state.context.discoveredPorts.includes(port)
        ? state.context.discoveredPorts
        : [...state.context.discoveredPorts, port].sort((a, b) => a - b),
    },
  })),

  addScannedService: (service) => set((state) => ({
    context: {
      ...state.context,
      scannedServices: state.context.scannedServices.includes(service)
        ? state.context.scannedServices
        : [...state.context.scannedServices, service],
    },
  })),

  setLastCommandOutput: (output) => set((state) => ({
    context: {
      ...state.context,
      lastCommandOutput: normalizeTerminalText(output).slice(-MAX_LAST_OUTPUT),
    },
  })),

  addRecentCommand: (cmd) => {
    const { context } = get();
    const engagementId = useEngagementStore.getState().currentEngagementId ?? undefined;
    // Persist to disk via main process
    window.electronAPI.commands.save(cmd, context.primaryTarget, engagementId)
      .then((saved) => {
        useCommandsStore.getState().addCommand(saved);
      })
      .catch(() => {});
    set((state) => ({
      context: {
        ...state.context,
        recentCommands: [cmd, ...state.context.recentCommands].slice(0, MAX_RECENT_COMMANDS),
      },
    }));
  },

  recordTerminalCommand: (tabId, shellType, title, cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed) {
      return;
    }

    get().addRecentCommand(trimmed);
    const now = new Date().toISOString();

    set((state) => {
      const sessions = upsertTerminalSession(
        state.context.terminalSessions,
        tabId,
        shellType,
        title,
        now
      ).map((session) => (
        session.tabId === tabId
          ? {
              ...session,
              updatedAt: now,
              recentActivity: [
                {
                  id: createActivityId(),
                  command: trimmed,
                  output: '',
                  startedAt: now,
                  updatedAt: now,
                },
                ...session.recentActivity,
              ].slice(0, MAX_TERMINAL_ACTIVITY),
            }
          : session
      ));

      return {
        context: {
          ...state.context,
          terminalSessions: sortTerminalSessions(sessions),
        },
      };
    });
  },

  recordTerminalOutput: (tabId, shellType, title, output) => {
    const normalizedOutput = normalizeTerminalText(output);
    if (!normalizedOutput) {
      return;
    }

    const now = new Date().toISOString();

    set((state) => {
      const sessions = upsertTerminalSession(
        state.context.terminalSessions,
        tabId,
        shellType,
        title,
        now
      ).map((session) => {
        if (session.tabId !== tabId) {
          return session;
        }

        const [latestActivity, ...rest] = session.recentActivity;
        if (!latestActivity) {
          return {
            ...session,
            updatedAt: now,
          };
        }

        const mergedOutput = `${latestActivity.output}\n${normalizedOutput}`.trim();
        return {
          ...session,
          updatedAt: now,
          recentActivity: [
            {
              ...latestActivity,
              output: mergedOutput.slice(-MAX_ACTIVITY_OUTPUT),
              updatedAt: now,
            },
            ...rest,
          ],
        };
      });

      return {
        context: {
          ...state.context,
          terminalSessions: sortTerminalSessions(sessions),
        },
      };
    });
  },

  syncTerminalSessions: (tabs) => set((state) => {
    const openTabIds = new Set(tabs.map((tab) => tab.id));
    const existing = state.context.terminalSessions.filter((session) => openTabIds.has(session.tabId));
    const now = new Date().toISOString();

    const synced = tabs.map((tab) => {
      const current = existing.find((session) => session.tabId === tab.id);
      return current
        ? {
            ...current,
            title: tab.title,
            shellType: tab.shellType,
          }
        : {
            tabId: tab.id,
            title: tab.title,
            shellType: tab.shellType,
            updatedAt: now,
            recentActivity: [],
          };
    });

    return {
      context: {
        ...state.context,
        terminalSessions: sortTerminalSessions(synced),
      },
    };
  }),

  addSessionNote: (note) => set((state) => ({
    context: {
      ...state.context,
      sessionNotes: [...state.context.sessionNotes, note].slice(0, MAX_SESSION_NOTES),
    },
  })),

  parseAndUpdateFromOutput: (output: string) => {
    const { addDiscoveredPort, addScannedService, context } = get();

    // Parse nmap port/service output
    const portRegex = new RegExp(NMAP_PORT_REGEX.source, 'gm');
    let portMatch;
    while ((portMatch = portRegex.exec(output)) !== null) {
      const port = parseInt(portMatch[1], 10);
      if (!isNaN(port)) {
        addDiscoveredPort(port);
      }
    }

    // Parse nmap service details
    const serviceRegex = new RegExp(NMAP_SERVICE_REGEX.source, 'gm');
    let serviceMatch;
    while ((serviceMatch = serviceRegex.exec(output)) !== null) {
      const service = `${serviceMatch[1]}/${serviceMatch[2]}`;
      if (serviceMatch[3].trim()) {
        addScannedService(`${service} (${serviceMatch[3].trim().slice(0, 40)})`);
      } else {
        addScannedService(service);
      }
    }

    // Parse IPs — if no primary target set, auto-detect
    if (!context.primaryTarget) {
      const ipRegex = new RegExp(IP_REGEX.source, 'g');
      const ips = output.match(ipRegex);
      if (ips && ips.length > 0) {
        // Filter out common non-target IPs
        const filtered = ips.filter(ip =>
          !ip.startsWith('127.') &&
          !ip.startsWith('0.') &&
          !ip.startsWith('255.')
        );
        if (filtered.length > 0) {
          set((state) => ({
            context: { ...state.context, primaryTarget: filtered[0] },
          }));
        }
      }
    }
  },

  resetContext: () => set({ context: { ...defaultContext } }),
}));
