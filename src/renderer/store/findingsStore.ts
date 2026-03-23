import { create } from 'zustand';
import type { Finding } from '@shared/types';

interface FindingsStore {
  findings: Finding[];
  isLoaded: boolean;
  setFindings: (findings: Finding[]) => void;
  addFinding: (finding: Finding) => void;
  updateFinding: (finding: Finding) => void;
  removeFinding: (id: string) => void;
}

export const useFindingsStore = create<FindingsStore>((set) => ({
  findings: [],
  isLoaded: false,
  setFindings: (findings) => set({ findings, isLoaded: true }),
  addFinding: (finding) => set((state) => ({
    findings: [finding, ...state.findings.filter(existing => existing.id !== finding.id)],
  })),
  updateFinding: (finding) => set((state) => ({
    findings: state.findings.map(existing => existing.id === finding.id ? finding : existing),
  })),
  removeFinding: (id) => set((state) => ({
    findings: state.findings.filter(existing => existing.id !== id),
  })),
}));
