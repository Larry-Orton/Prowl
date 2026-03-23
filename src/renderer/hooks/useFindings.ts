import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Finding } from '@shared/types';
import { useFindingsStore } from '../store/findingsStore';
import { useEngagementStore } from '../store/engagementStore';

export function useFindings() {
  const {
    findings,
    isLoaded,
    setFindings,
    addFinding,
    updateFinding,
    removeFinding,
  } = useFindingsStore();
  const currentEngagementId = useEngagementStore(s => s.currentEngagementId);

  useEffect(() => {
    if (!currentEngagementId && isLoaded) return;
    window.electronAPI.findings.getAll(currentEngagementId ?? undefined).then(setFindings).catch(console.error);
  }, [currentEngagementId, isLoaded, setFindings]);

  const saveFinding = useCallback(async (
    partial: Partial<Finding> & {
      title: string;
      summary: string;
      kind: Finding['kind'];
    }
  ) => {
    const finding: Partial<Finding> & { id: string } = {
      id: partial.id ?? uuidv4(),
      kind: partial.kind,
      target: partial.target ?? '',
      title: partial.title,
      summary: partial.summary,
      source: partial.source ?? 'manual',
      confidence: partial.confidence ?? 'medium',
      tags: partial.tags ?? [],
      metadata: partial.metadata ?? {},
      relatedNoteId: partial.relatedNoteId,
      engagementId: partial.engagementId ?? currentEngagementId ?? undefined,
    };

    const saved = await window.electronAPI.findings.save(finding);
    if (findings.find(existing => existing.id === saved.id)) {
      updateFinding(saved);
    } else {
      addFinding(saved);
    }
    return saved;
  }, [addFinding, currentEngagementId, findings, updateFinding]);

  const deleteFinding = useCallback(async (id: string) => {
    await window.electronAPI.findings.remove(id);
    removeFinding(id);
  }, [removeFinding]);

  return {
    findings,
    saveFinding,
    deleteFinding,
    reloadFindings: () => window.electronAPI.findings.getAll(currentEngagementId ?? undefined).then(setFindings),
  };
}
