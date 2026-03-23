import { create } from 'zustand';
import type { CommandRecord } from '@shared/types';

interface CommandsStore {
  commands: CommandRecord[];
  isLoaded: boolean;
  setCommands: (commands: CommandRecord[]) => void;
  addCommand: (command: CommandRecord) => void;
}

export const useCommandsStore = create<CommandsStore>((set) => ({
  commands: [],
  isLoaded: false,
  setCommands: (commands) => set({ commands, isLoaded: true }),
  addCommand: (command) => set((state) => ({
    commands: [command, ...state.commands.filter((item) =>
      !(item.command === command.command && item.timestamp === command.timestamp)
    )],
    isLoaded: true,
  })),
}));
