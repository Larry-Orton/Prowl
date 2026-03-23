import { create } from 'zustand';
import type { Engagement } from '@shared/types';

interface EngagementStore {
  engagements: Engagement[];
  currentEngagementId: string | null;
  isLoaded: boolean;
  setEngagements: (engagements: Engagement[]) => void;
  addEngagement: (engagement: Engagement) => void;
  updateEngagement: (engagement: Engagement) => void;
  removeEngagement: (id: string) => void;
  setCurrentEngagementId: (id: string) => void;
}

export const useEngagementStore = create<EngagementStore>((set) => ({
  engagements: [],
  currentEngagementId: null,
  isLoaded: false,
  setEngagements: (engagements) => set((state) => ({
    engagements,
    isLoaded: true,
    currentEngagementId: state.currentEngagementId ?? engagements[0]?.id ?? null,
  })),
  addEngagement: (engagement) => set((state) => ({
    engagements: [engagement, ...state.engagements.filter((item) => item.id !== engagement.id)],
  })),
  updateEngagement: (engagement) => set((state) => ({
    engagements: state.engagements.map((item) => item.id === engagement.id ? engagement : item),
  })),
  removeEngagement: (id) => set((state) => ({
    engagements: state.engagements.filter((item) => item.id !== id),
    currentEngagementId: state.currentEngagementId === id
      ? state.engagements.find((item) => item.id !== id)?.id ?? null
      : state.currentEngagementId,
  })),
  setCurrentEngagementId: (id) => set({ currentEngagementId: id }),
}));
