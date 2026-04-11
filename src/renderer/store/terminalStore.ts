import { create } from 'zustand';
import { TerminalTab } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

interface TerminalStore {
  tabs: TerminalTab[];
  activeTabId: string | null;
  layout: 'single' | 'split';
  secondaryTabId: string | null;
  // Multi-pane: array of visible tab IDs and layout direction
  visiblePanes: string[];
  splitDirection: 'horizontal' | 'vertical';
  addTab: (shellType?: 'local' | 'kali' | 'notebook', notebookTarget?: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  toggleSplit: () => void;
  setSecondaryTab: (id: string | null) => void;
  // Multi-pane actions
  splitActivePane: (direction: 'horizontal' | 'vertical', shellType?: 'local' | 'kali') => void;
  removePaneById: (tabId: string) => void;
  setSplitDirection: (direction: 'horizontal' | 'vertical') => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  layout: 'single',
  secondaryTabId: null,
  visiblePanes: [],
  splitDirection: 'horizontal',

  addTab: (shellType: 'local' | 'kali' | 'notebook' = 'local', notebookTarget?: string) => {
    // For notebook tabs, check if one already exists for this target
    if (shellType === 'notebook' && notebookTarget) {
      const existing = get().tabs.find(t => t.shellType === 'notebook' && t.notebookTarget === notebookTarget);
      if (existing) {
        set((state) => ({
          tabs: state.tabs.map(t => ({ ...t, isActive: t.id === existing.id })),
          activeTabId: existing.id,
        }));
        return existing.id;
      }
    }

    const id = uuidv4();
    const tabNumber = get().tabs.length + 1;
    const title = shellType === 'kali' ? `Kali ${tabNumber}`
      : shellType === 'notebook' ? (notebookTarget || 'Notebook')
      : `Shell ${tabNumber}`;
    const newTab: TerminalTab = {
      id,
      title,
      shellType,
      isActive: true,
      notebookTarget,
    };
    set((state) => {
      const newVisiblePanes = state.visiblePanes.length === 0 ? [id] : state.visiblePanes;
      return {
        tabs: state.tabs.map(t => ({ ...t, isActive: false })).concat(newTab),
        activeTabId: id,
        secondaryTabId: state.secondaryTabId ?? null,
        visiblePanes: newVisiblePanes,
      };
    });
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

    set((state) => ({
      tabs: filteredTabs.map(t => ({ ...t, isActive: t.id === newActiveId })),
      activeTabId: newActiveId,
      layout: filteredTabs.length > 1 ? state.layout : 'single',
      secondaryTabId:
        state.secondaryTabId === id
          ? filteredTabs.find(t => t.id !== newActiveId)?.id ?? null
          : state.secondaryTabId,
      visiblePanes: state.visiblePanes.filter(p => p !== id),
    }));
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
      set({ layout: 'single', secondaryTabId: null, visiblePanes: activeTabId ? [activeTabId] : [] });
      return;
    }

    let nextSecondaryId = secondaryTabId ?? tabs.find((tab) => tab.id !== activeTabId)?.id ?? null;
    if (!nextSecondaryId) {
      nextSecondaryId = addTab('local');
    }

    set({
      layout: 'split',
      secondaryTabId: nextSecondaryId,
      visiblePanes: [activeTabId!, nextSecondaryId].filter(Boolean),
    });
  },

  setSecondaryTab: (id) => set({ secondaryTabId: id }),

  splitActivePane: (direction, shellType = 'local') => {
    const { activeTabId, addTab: addTabFn } = get();
    if (!activeTabId) return;
    const newId = addTabFn(shellType);
    set((state) => ({
      layout: 'split',
      splitDirection: direction,
      visiblePanes: [...new Set([...state.visiblePanes, activeTabId, newId])],
    }));
  },

  removePaneById: (tabId: string) => {
    set((state) => {
      const newPanes = state.visiblePanes.filter(p => p !== tabId);
      return {
        visiblePanes: newPanes,
        layout: newPanes.length <= 1 ? 'single' : 'split',
      };
    });
  },

  setSplitDirection: (direction) => set({ splitDirection: direction }),
}));
