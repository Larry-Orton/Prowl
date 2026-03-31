import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  shell: {
    spawn: (id: string, type?: 'local' | 'kali') => ipcRenderer.invoke('shell:spawn', id, type),
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
    onKeywordAction: (callback: (id: string, action: any) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string, action: any) => callback(id, action);
      ipcRenderer.on('prowl:keyword-action', handler);
      return () => ipcRenderer.removeListener('prowl:keyword-action', handler);
    },
    removeDataListener: () => ipcRenderer.removeAllListeners('shell:data'),
  },
  engagements: {
    save: (engagement: object) => ipcRenderer.invoke('engagements:save', engagement),
    getAll: () => ipcRenderer.invoke('engagements:getAll'),
    delete: (id: string) => ipcRenderer.invoke('engagements:delete', id),
    getCurrent: () => ipcRenderer.invoke('engagements:getCurrent'),
    setCurrent: (id: string) => ipcRenderer.invoke('engagements:setCurrent', id),
    resetMemory: (id: string) => ipcRenderer.invoke('engagements:resetMemory', id),
  },
  notes: {
    save: (note: object) => ipcRenderer.invoke('notes:save', note),
    getAll: (engagementId?: string) => ipcRenderer.invoke('notes:getAll', engagementId),
    search: (query: string, engagementId?: string) => ipcRenderer.invoke('notes:search', query, engagementId),
    remove: (id: string) => ipcRenderer.invoke('notes:delete', id),
  },
  commands: {
    save: (command: string, target: string, engagementId?: string) => ipcRenderer.invoke('commands:save', command, target, engagementId),
    getAll: (engagementId?: string) => ipcRenderer.invoke('commands:getAll', engagementId),
    search: (query: string, currentTarget?: string, engagementId?: string) =>
      ipcRenderer.invoke('commands:search', query, currentTarget, engagementId),
  },
  findings: {
    save: (finding: object) => ipcRenderer.invoke('findings:save', finding),
    getAll: (engagementId?: string) => ipcRenderer.invoke('findings:getAll', engagementId),
    search: (query: string, engagementId?: string) => ipcRenderer.invoke('findings:search', query, engagementId),
    remove: (id: string) => ipcRenderer.invoke('findings:delete', id),
  },
  ai: {
    send: (messages: { role: string; content: string }[], systemPrompt: string) =>
      ipcRenderer.invoke('ai:send', messages, systemPrompt),
    getApiKey: () => ipcRenderer.invoke('ai:hasKey'),
    setApiKey: (key: string) => ipcRenderer.invoke('ai:setKey', key),
    deleteApiKey: () => ipcRenderer.invoke('ai:deleteKey'),
    setModel: (model: string) => ipcRenderer.invoke('ai:setModel', model),
  },
  container: {
    detectRuntime: () => ipcRenderer.invoke('container:detectRuntime'),
    getStatus: () => ipcRenderer.invoke('container:getStatus'),
    buildImage: () => ipcRenderer.invoke('container:buildImage'),
    start: () => ipcRenderer.invoke('container:start'),
    stop: () => ipcRenderer.invoke('container:stop'),
    installTool: (name: string) => ipcRenderer.invoke('container:installTool', name),
    onBuildProgress: (callback: (line: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, line: string) => callback(line);
      ipcRenderer.on('container:buildProgress', handler);
      return () => ipcRenderer.removeListener('container:buildProgress', handler);
    },
  },
  vpn: {
    upload: (filePath: string) => ipcRenderer.invoke('vpn:upload', filePath),
    connect: (filename: string) => ipcRenderer.invoke('vpn:connect', filename),
    disconnect: () => ipcRenderer.invoke('vpn:disconnect'),
    deleteFile: (filename: string) => ipcRenderer.invoke('vpn:deleteFile', filename),
    getStatus: () => ipcRenderer.invoke('vpn:getStatus'),
    listFiles: () => ipcRenderer.invoke('vpn:listFiles'),
    selectFile: () => ipcRenderer.invoke('vpn:selectFile'),
  },
  browser: {
    getSocksPort: () => ipcRenderer.invoke('browser:getSocksPort'),
    capturePageContent: (url: string) => ipcRenderer.invoke('browser:capturePageContent', url),
  },
  workspace: {
    listFiles: (dirPath?: string) => ipcRenderer.invoke('workspace:listFiles', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('workspace:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('workspace:writeFile', filePath, content),
    deleteFile: (filePath: string) => ipcRenderer.invoke('workspace:deleteFile', filePath),
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
