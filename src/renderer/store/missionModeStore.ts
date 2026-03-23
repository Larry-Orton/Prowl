import { create } from 'zustand';
import type { MissionMode } from '@shared/types';
import { MISSION_MODE_META } from '../lib/missionMode';

const defaultMode: MissionMode = {
  id: 'planning',
  label: MISSION_MODE_META.planning.label,
  description: MISSION_MODE_META.planning.description,
  source: 'auto',
  confidence: 'low',
  reason: 'No primary target is set yet.',
  updatedAt: new Date().toISOString(),
};

interface MissionModeStore {
  mode: MissionMode;
  setAutoMode: (mode: MissionMode) => void;
  setManualMode: (mode: MissionMode) => void;
  clearManualMode: () => void;
}

export const useMissionModeStore = create<MissionModeStore>((set) => ({
  mode: defaultMode,
  setAutoMode: (mode) => set((state) => {
    if (state.mode.source === 'manual') {
      return state;
    }

    const nextMode = { ...mode, source: 'auto' as const };
    const unchanged =
      state.mode.id === nextMode.id &&
      state.mode.label === nextMode.label &&
      state.mode.description === nextMode.description &&
      state.mode.confidence === nextMode.confidence &&
      state.mode.reason === nextMode.reason &&
      state.mode.source === nextMode.source;

    return unchanged ? state : { mode: nextMode };
  }),
  setManualMode: (mode) => set({ mode: { ...mode, source: 'manual' } }),
  clearManualMode: () => set((state) => (
    state.mode.source === 'manual'
      ? { mode: defaultMode }
      : state
  )),
}));
