import { create } from 'zustand';
import { TerminalTab } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

interface TerminalStore {
  tabs: TerminalTab[];
  activeTabId: string | null;
  layout: 'single' | 'split';
  secondaryTabId: string | null;
  addTab: (shellType?: 'local' | 'kali') => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  toggleSplit: () => void;
  setSecondaryTab: (id: string | null) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  layout: 'single',
  secondaryTabId: null,

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
      secondaryTabId: state.secondaryTabId ?? null,
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
      layout: filteredTabs.length > 1 ? get().layout : 'single',
      secondaryTabId:
        get().secondaryTabId === id
          ? filteredTabs.find(t => t.id !== newActiveId)?.id ?? null
          : get().secondaryTabId,
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

  toggleSplit: () => {
    const { layout, tabs, activeTabId, secondaryTabId, addTab } = get();
    if (layout === 'split') {
      set({ layout: 'single', secondaryTabId: null });
      return;
    }

    let nextSecondaryId = secondaryTabId ?? tabs.find((tab) => tab.id !== activeTabId)?.id ?? null;
    if (!nextSecondaryId) {
      nextSecondaryId = addTab('local');
    }

    set({
      layout: 'split',
      secondaryTabId: nextSecondaryId,
    });
  },

  setSecondaryTab: (id) => set({ secondaryTabId: id }),
}));
