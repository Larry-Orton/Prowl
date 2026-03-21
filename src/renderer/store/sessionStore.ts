import { create } from 'zustand';
import { ActiveContext } from '@shared/types';
import { NMAP_PORT_REGEX, IP_REGEX, NMAP_SERVICE_REGEX } from '@shared/constants';

interface SessionStore {
  context: ActiveContext;
  setTarget: (ip: string) => void;
  addDiscoveredPort: (port: number) => void;
  addScannedService: (service: string) => void;
  setLastCommandOutput: (output: string) => void;
  addRecentCommand: (cmd: string) => void;
  addSessionNote: (note: string) => void;
  parseAndUpdateFromOutput: (output: string) => void;
  resetContext: () => void;
}

const defaultContext: ActiveContext = {
  primaryTarget: '',
  discoveredPorts: [],
  scannedServices: [],
  lastCommandOutput: '',
  recentCommands: [],
  sessionNotes: [],
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
      lastCommandOutput: output.slice(-3000),
    },
  })),

  addRecentCommand: (cmd) => {
    const { context } = get();
    // Persist to disk via main process
    window.electronAPI.commands.save(cmd, context.primaryTarget).catch(() => {});
    set((state) => ({
      context: {
        ...state.context,
        recentCommands: [cmd, ...state.context.recentCommands].slice(0, 20),
      },
    }));
  },

  addSessionNote: (note) => set((state) => ({
    context: {
      ...state.context,
      sessionNotes: [...state.context.sessionNotes, note].slice(0, 50),
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
