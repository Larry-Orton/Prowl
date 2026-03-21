import { useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Note } from '@shared/types';
import { useNotesStore } from '../store/notesStore';
import { useSessionStore } from '../store/sessionStore';

export function useNotes() {
  const {
    notes,
    setNotes,
    addNote,
    updateNote,
    removeNote,
    setSelectedNote,
    selectedNoteId,
    searchQuery,
    setSearchQuery,
    getFilteredNotes,
    getSelectedNote,
    isLoaded,
  } = useNotesStore();

  const addSessionNote = useSessionStore(s => s.addSessionNote);

  // Load notes on mount
  useEffect(() => {
    if (!isLoaded) {
      window.electronAPI.notes.getAll().then(setNotes).catch(console.error);
    }
  }, [isLoaded, setNotes]);

  const saveNote = useCallback(async (partial: Partial<Note> & { title: string; content: string }) => {
    const note: Partial<Note> & { id: string } = {
      id: partial.id ?? uuidv4(),
      title: partial.title,
      content: partial.content,
      tags: partial.tags ?? [],
      source: partial.source ?? 'manual',
    };

    try {
      const saved = await window.electronAPI.notes.save(note);
      if (notes.find(n => n.id === saved.id)) {
        updateNote(saved);
      } else {
        addNote(saved);
      }
      addSessionNote(`${saved.title}: ${saved.content.slice(0, 100)}`);
      return saved;
    } catch (err) {
      console.error('Failed to save note:', err);
      throw err;
    }
  }, [notes, addNote, updateNote, addSessionNote]);

  const deleteNote = useCallback(async (id: string) => {
    try {
      await window.electronAPI.notes.remove(id);
      removeNote(id);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }, [removeNote]);

  const searchNotes = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      try {
        const results = await window.electronAPI.notes.search(query);
        setNotes(results);
      } catch (err) {
        console.error('Search failed:', err);
      }
    } else {
      try {
        const all = await window.electronAPI.notes.getAll();
        setNotes(all);
      } catch (err) {
        console.error('Failed to reload notes:', err);
      }
    }
  }, [setNotes, setSearchQuery]);

  const exportNotes = useCallback(async () => {
    const allNotes = notes;
    const md = allNotes.map(n =>
      `# ${n.title}\n\n${n.content}\n\n---\n*Source: ${n.source} | ${new Date(n.createdAt).toLocaleString()}*\n`
    ).join('\n\n');
    await window.electronAPI.dialog.saveFile(md, 'prowl-notes.md');
  }, [notes]);

  const quickSaveFromTerminal = useCallback(async (title: string, content: string) => {
    return saveNote({ title, content, source: 'terminal' });
  }, [saveNote]);

  const quickSaveFromAI = useCallback(async (title: string, content: string) => {
    return saveNote({ title, content, source: 'ai' });
  }, [saveNote]);

  return {
    notes,
    filteredNotes: getFilteredNotes(),
    selectedNoteId,
    selectedNote: getSelectedNote(),
    searchQuery,
    saveNote,
    deleteNote,
    searchNotes,
    exportNotes,
    setSelectedNote,
    quickSaveFromTerminal,
    quickSaveFromAI,
    reloadNotes: () => window.electronAPI.notes.getAll().then(setNotes),
  };
}
