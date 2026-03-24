import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Engagement } from '@shared/types';
import { DEFAULT_ENGAGEMENT_ID } from '@shared/constants';
import { useEngagementStore } from '../store/engagementStore';

export function useEngagements() {
  const {
    engagements,
    currentEngagementId,
    isLoaded,
    setEngagements,
    addEngagement,
    updateEngagement,
    removeEngagement,
    setCurrentEngagementId,
  } = useEngagementStore();

  useEffect(() => {
    if (!isLoaded) {
      Promise.all([
        window.electronAPI.engagements.getAll(),
        window.electronAPI.engagements.getCurrent(),
      ]).then(([all, current]) => {
        setEngagements(all);
        setCurrentEngagementId(current);
      }).catch(console.error);
    }
  }, [isLoaded, setCurrentEngagementId, setEngagements]);

  const saveEngagement = useCallback(async (partial: Partial<Engagement> & { name: string }) => {
    const engagement: Partial<Engagement> & { id: string } = {
      id: partial.id ?? uuidv4(),
      name: partial.name,
      primaryTarget: partial.primaryTarget ?? '',
      workspacePath: partial.workspacePath,
      tags: partial.tags ?? [],
    };
    const saved = await window.electronAPI.engagements.save(engagement);
    if (engagements.some((item) => item.id === saved.id)) {
      updateEngagement(saved);
    } else {
      addEngagement(saved);
    }
    return saved;
  }, [addEngagement, engagements, updateEngagement]);

  const selectEngagement = useCallback(async (id: string) => {
    const selectedId = await window.electronAPI.engagements.setCurrent(id);
    setCurrentEngagementId(selectedId);
    return selectedId;
  }, [setCurrentEngagementId]);

  const deleteEngagement = useCallback(async (id: string) => {
    if (id === DEFAULT_ENGAGEMENT_ID) return;
    await window.electronAPI.engagements.delete(id);
    removeEngagement(id);
    const current = await window.electronAPI.engagements.getCurrent();
    setCurrentEngagementId(current);
  }, [removeEngagement, setCurrentEngagementId]);

  const resetEngagementMemory = useCallback(async (id: string) => {
    const reset = await window.electronAPI.engagements.resetMemory(id);
    updateEngagement(reset);
    return reset;
  }, [updateEngagement]);

  const reloadEngagements = useCallback(async () => {
    const [all, current] = await Promise.all([
      window.electronAPI.engagements.getAll(),
      window.electronAPI.engagements.getCurrent(),
    ]);
    setEngagements(all);
    setCurrentEngagementId(current);
  }, [setCurrentEngagementId, setEngagements]);

  return {
    engagements,
    currentEngagementId,
    currentEngagement: engagements.find((item) => item.id === currentEngagementId) ?? null,
    saveEngagement,
    selectEngagement,
    deleteEngagement,
    resetEngagementMemory,
    reloadEngagements,
  };
}
