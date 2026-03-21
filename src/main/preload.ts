import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  shell: {
    spawn: (id: string) => ipcRenderer.invoke('shell:spawn', id),
    write: (id: string, data: string) => ipcRenderer.send('shell:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.send('shell:resize', id, cols, rows),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data);
      ipcRenderer.on('shell:data', handler);
      return () => ipcRenderer.removeListener('shell:data', handler);
    },
    onExit: (callback: (id: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string) => callback(id);
      ipcRenderer.on('shell:exit', handler);
      return () => ipcRenderer.removeListener('shell:exit', handler);
    },
    removeDataListener: () => ipcRenderer.removeAllListeners('shell:data'),
  },
  notes: {
    save: (note: object) => ipcRenderer.invoke('notes:save', note),
    getAll: () => ipcRenderer.invoke('notes:getAll'),
    search: (query: string) => ipcRenderer.invoke('notes:search', query),
    remove: (id: string) => ipcRenderer.invoke('notes:delete', id),
  },
  commands: {
    save: (command: string, target: string) => ipcRenderer.invoke('commands:save', command, target),
    getAll: () => ipcRenderer.invoke('commands:getAll'),
    search: (query: string, currentTarget?: string) =>
      ipcRenderer.invoke('commands:search', query, currentTarget),
  },
  ai: {
    send: (messages: { role: string; content: string }[], systemPrompt: string) =>
      ipcRenderer.invoke('ai:send', messages, systemPrompt),
    getApiKey: () => ipcRenderer.invoke('ai:hasKey'),
    setApiKey: (key: string) => ipcRenderer.invoke('ai:setKey', key),
    deleteApiKey: () => ipcRenderer.invoke('ai:deleteKey'),
  },
  dialog: {
    saveFile: (content: string, defaultName: string) =>
      ipcRenderer.invoke('dialog:saveFile', content, defaultName),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    dragMove: (deltaX: number, deltaY: number) => ipcRenderer.send('window:drag-move', deltaX, deltaY),
  },
});
