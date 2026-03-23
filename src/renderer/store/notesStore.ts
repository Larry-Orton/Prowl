import { create } from 'zustand';
import { Note } from '@shared/types';

interface NotesStore {
  notes: Note[];
  selectedNoteId: string | null;
  activeNotebookId: string | null;
  activeNotebookName: string | null;
  searchQuery: string;
  isLoaded: boolean;

  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (note: Note) => void;
  removeNote: (id: string) => void;
  setSelectedNote: (id: string | null) => void;
  setActiveNotebook: (id: string | null, name: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLoaded: (loaded: boolean) => void;

  getFilteredNotes: () => Note[];
  getSelectedNote: () => Note | null;
  getActiveNotebook: () => Note | null;
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  activeNotebookId: null,
  activeNotebookName: null,
  searchQuery: '',
  isLoaded: false,

  setNotes: (notes) => set({ notes, isLoaded: true }),

  addNote: (note) => set((state) => ({
    notes: [note, ...state.notes.filter(n => n.id !== note.id)],
  })),

  updateNote: (note) => set((state) => ({
    notes: state.notes.map(n => n.id === note.id ? note : n),
  })),

  removeNote: (id) => set((state) => ({
    notes: state.notes.filter(n => n.id !== id),
    selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
    activeNotebookId: state.activeNotebookId === id ? null : state.activeNotebookId,
    activeNotebookName: state.activeNotebookId === id ? null : state.activeNotebookName,
  })),

  setSelectedNote: (id) => set({ selectedNoteId: id }),

  setActiveNotebook: (id, name) => set({ activeNotebookId: id, activeNotebookName: name }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setLoaded: (loaded) => set({ isLoaded: loaded }),

  getFilteredNotes: () => {
    const { notes, searchQuery } = get();
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  },

  getSelectedNote: () => {
    const { notes, selectedNoteId } = get();
    return notes.find(n => n.id === selectedNoteId) ?? null;
  },

  getActiveNotebook: () => {
    const { notes, activeNotebookId } = get();
    return notes.find(n => n.id === activeNotebookId) ?? null;
  },
}));
