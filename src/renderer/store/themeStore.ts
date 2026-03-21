import { create } from 'zustand';
import { ProwlTheme, THEMES, getTheme, applyTheme } from '../themes';

interface ThemeStore {
  currentTheme: ProwlTheme;
  setTheme: (id: string) => void;
  initTheme: () => void;
}

const THEME_STORAGE_KEY = 'prowl_theme';

export const useThemeStore = create<ThemeStore>((set) => ({
  currentTheme: getTheme('midnight'),

  setTheme: (id: string) => {
    const theme = getTheme(id);
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    set({ currentTheme: theme });
  },

  initTheme: () => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const theme = getTheme(saved ?? 'midnight');
    applyTheme(theme);
    set({ currentTheme: theme });
  },
}));
