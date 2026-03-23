import { create } from 'zustand';
import type { ActiveContext, AIMessageAction } from '@shared/types';

export type ProactiveEvent =
  | { type: 'target_set'; target: string; actions?: AIMessageAction[] }
  | { type: 'ports_discovered'; context: ActiveContext; actions?: AIMessageAction[] }
  | { type: 'services_discovered'; context: ActiveContext; actions?: AIMessageAction[] }
  | { type: 'browser_scanned'; url: string; content: string }
  | { type: 'vpn_connected'; ip?: string; actions?: AIMessageAction[] }
  | { type: 'container_running'; actions?: AIMessageAction[] }
  | { type: 'workspace_loot_added'; fileName: string; actions?: AIMessageAction[] };

interface StoredProactiveEvent {
  id: number;
  timestamp: string;
  payload: ProactiveEvent;
}

interface ProactiveEventStore {
  lastEvent: StoredProactiveEvent | null;
  events: StoredProactiveEvent[];
  emitEvent: (payload: ProactiveEvent) => void;
}

export const useProactiveEventStore = create<ProactiveEventStore>((set) => ({
  lastEvent: null,
  events: [],
  emitEvent: (payload) =>
    set((state) => ({
      lastEvent: {
        id: (state.lastEvent?.id ?? 0) + 1,
        timestamp: new Date().toISOString(),
        payload,
      },
      events: [{
        id: (state.lastEvent?.id ?? 0) + 1,
        timestamp: new Date().toISOString(),
        payload,
      }, ...state.events].slice(0, 200),
    })),
}));
