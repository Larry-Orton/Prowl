import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { shellManager } from './shellManager';
import { sendToAI } from './aiProxy';
import {
  getDatabase,
  saveNote,
  getAllNotes,
  searchNotes,
  deleteNote,
  saveCommand,
  getCommands,
  searchCommands,
  saveApiKey,
  getApiKey,
  deleteApiKey,
} from '../db/client';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // In dev mode, relax CSP for Vite HMR (unsafe-eval + ws://localhost)
  if (isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com data:; " +
            "connect-src 'self' ws://localhost:5173 http://localhost:5173 https://fonts.googleapis.com https://fonts.gstatic.com;"
          ],
        },
      });
    });
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    shellManager.killAll();
    mainWindow = null;
  });
}

// ── Shell IPC ──────────────────────────────────────

ipcMain.handle('shell:spawn', async (event, id: string) => {
  shellManager.spawn(id, event.sender);
});

ipcMain.on('shell:write', (_, id: string, data: string) => {
  shellManager.write(id, data);
});

ipcMain.on('shell:resize', (_, id: string, cols: number, rows: number) => {
  shellManager.resize(id, cols, rows);
});

// ── Notes IPC ──────────────────────────────────────

ipcMain.handle('notes:save', async (_, note) => {
  const db = getDatabase();
  return saveNote(db, note);
});

ipcMain.handle('notes:getAll', async () => {
  const db = getDatabase();
  return getAllNotes(db);
});

ipcMain.handle('notes:search', async (_, query: string) => {
  const db = getDatabase();
  return searchNotes(db, query);
});

ipcMain.handle('notes:delete', async (_, id: string) => {
  const db = getDatabase();
  deleteNote(db, id);
});

// ── Command History IPC ────────────────────────────

ipcMain.handle('commands:save', async (_, command: string, target: string) => {
  return saveCommand(command, target);
});

ipcMain.handle('commands:getAll', async () => {
  return getCommands();
});

ipcMain.handle('commands:search', async (_, query: string, currentTarget?: string) => {
  return searchCommands(query, currentTarget);
});

// ── AI IPC (proxied through main process) ──────────

ipcMain.handle('ai:send', async (_, messages: { role: string; content: string }[], systemPrompt: string) => {
  return sendToAI(messages, systemPrompt);
});

ipcMain.handle('ai:hasKey', async () => {
  return !!getApiKey();
});

ipcMain.handle('ai:setKey', async (_, key: string) => {
  saveApiKey(key);
});

ipcMain.handle('ai:deleteKey', async () => {
  deleteApiKey();
});

// ── Dialog IPC ─────────────────────────────────────

ipcMain.handle('dialog:saveFile', async (_, content: string, defaultName: string) => {
  if (!mainWindow) return false;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return true;
  }
  return false;
});

// ── Window Control IPC ─────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

ipcMain.on('window:drag-move', (_, deltaX: number, deltaY: number) => {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(x + deltaX, y + deltaY);
});

// ── App lifecycle ──────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  shellManager.killAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  shellManager.killAll();
});
