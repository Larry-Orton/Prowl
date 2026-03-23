import { useEffect } from 'react';
import { useCommandsStore } from '../store/commandsStore';
import { useEngagementStore } from '../store/engagementStore';

export function useCommands() {
  const { commands, isLoaded, setCommands } = useCommandsStore();
  const currentEngagementId = useEngagementStore(s => s.currentEngagementId);

  useEffect(() => {
    if (!currentEngagementId && isLoaded) return;
    window.electronAPI.commands.getAll(currentEngagementId ?? undefined).then(setCommands).catch(console.error);
  }, [currentEngagementId, isLoaded, setCommands]);

  return {
    commands,
    reloadCommands: () => window.electronAPI.commands.getAll(currentEngagementId ?? undefined).then(setCommands),
  };
}
