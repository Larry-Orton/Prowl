import { create } from 'zustand';
import { TerminalTab } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

interface TerminalStore {
  tabs: TerminalTab[];
  activeTabId: string | null;
  addTab: (shellType?: 'local' | 'kali') => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (shellType: 'local' | 'kali' = 'local') => {
    const id = uuidv4();
    const tabNumber = get().tabs.length + 1;
    const title = shellType === 'kali' ? `Kali ${tabNumber}` : `Shell ${tabNumber}`;
    const newTab: TerminalTab = {
      id,
      title,
      shellType,
      isActive: true,
    };
    set((state) => ({
      tabs: state.tabs.map(t => ({ ...t, isActive: false })).concat(newTab),
      activeTabId: id,
    }));
    return id;
  },

  removeTab: (id: string) => {
    const { tabs, activeTabId } = get();
    const filteredTabs = tabs.filter(t => t.id !== id);

    let newActiveId: string | null = activeTabId;
    if (activeTabId === id) {
      const idx = tabs.findIndex(t => t.id === id);
      const prev = filteredTabs[idx - 1];
      const next = filteredTabs[idx];
      newActiveId = prev?.id || next?.id || null;
    }

    set({
      tabs: filteredTabs.map(t => ({ ...t, isActive: t.id === newActiveId })),
      activeTabId: newActiveId,
    });
  },

  setActiveTab: (id: string) => {
    set((state) => ({
      tabs: state.tabs.map(t => ({ ...t, isActive: t.id === id })),
      activeTabId: id,
    }));
  },

  renameTab: (id: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map(t => t.id === id ? { ...t, title } : t),
    }));
  },
}));
