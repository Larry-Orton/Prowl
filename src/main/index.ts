import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { shellManager } from './shellManager';
import { sendToAI } from './aiProxy';
import { containerManager } from './containerManager';
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
    backgroundColor: '#07070d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,  // Enable <webview> for embedded browser
    },
    show: false,
  });

  // In dev mode, relax CSP for Vite HMR
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

ipcMain.handle('shell:spawn', async (event, id: string, type?: 'local' | 'kali') => {
  shellManager.spawn(id, event.sender, type || 'local');
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

// ── AI IPC ─────────────────────────────────────────

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

// ── Container IPC ──────────────────────────────────

ipcMain.handle('container:detectRuntime', async () => {
  return containerManager.detectRuntime();
});

ipcMain.handle('container:getStatus', async () => {
  return containerManager.getStatus();
});

ipcMain.handle('container:buildImage', async (event) => {
  await containerManager.buildImage((line) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('container:buildProgress', line);
    }
  });
});

ipcMain.handle('container:start', async () => {
  const workspacePath = containerManager.getWorkspacePath();
  const vpnDir = containerManager.getVPNDir();
  await containerManager.startContainer(workspacePath, vpnDir);
});

ipcMain.handle('container:stop', async () => {
  await containerManager.stopContainer();
});

ipcMain.handle('container:installTool', async (_, name: string) => {
  return containerManager.installTool(name);
});

// ── VPN IPC ────────────────────────────────────────

ipcMain.handle('vpn:upload', async (_, filePath: string) => {
  const vpnDir = containerManager.getVPNDir();
  fs.mkdirSync(vpnDir, { recursive: true });
  const filename = path.basename(filePath);
  const dest = path.join(vpnDir, filename);
  fs.copyFileSync(filePath, dest);
  return filename;
});

ipcMain.handle('vpn:connect', async (_, filename: string) => {
  return containerManager.connectVPN(filename);
});

ipcMain.handle('vpn:disconnect', async () => {
  return containerManager.disconnectVPN();
});

ipcMain.handle('vpn:getStatus', async () => {
  return containerManager.getVPNStatus();
});

ipcMain.handle('vpn:listFiles', async () => {
  const vpnDir = containerManager.getVPNDir();
  return containerManager.listVPNFiles(vpnDir);
});

ipcMain.handle('vpn:selectFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select OpenVPN Configuration',
    filters: [
      { name: 'OpenVPN', extensions: ['ovpn', 'conf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  // Copy to VPN dir
  const filePath = result.filePaths[0];
  const vpnDir = containerManager.getVPNDir();
  fs.mkdirSync(vpnDir, { recursive: true });
  const filename = path.basename(filePath);
  fs.copyFileSync(filePath, path.join(vpnDir, filename));
  return filename;
});

// ── Browser IPC ────────────────────────────────────

ipcMain.handle('browser:getSocksPort', async () => {
  return containerManager.getSocksPort();
});

ipcMain.handle('browser:capturePageContent', async (_, url: string) => {
  // Creates a hidden BrowserWindow, loads the URL through the SOCKS proxy,
  // extracts text content, and returns it for AI analysis
  const socksPort = containerManager.getSocksPort();

  const proxySession = session.fromPartition('prowl-browser-capture');
  await proxySession.setProxy({ proxyRules: `socks5://127.0.0.1:${socksPort}` });

  return new Promise<string>((resolve) => {
    const capture = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        session: proxySession,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const timeout = setTimeout(() => {
      capture.destroy();
      resolve('[Page load timed out]');
    }, 15000);

    capture.webContents.on('did-finish-load', async () => {
      clearTimeout(timeout);
      try {
        const content = await capture.webContents.executeJavaScript(`
          (function() {
            // Extract meaningful page content for AI analysis
            const title = document.title || '';
            const meta = Array.from(document.querySelectorAll('meta')).map(m =>
              m.getAttribute('name') + '=' + m.getAttribute('content')
            ).filter(m => !m.startsWith('null')).join('; ');
            const forms = Array.from(document.querySelectorAll('form')).map(f => ({
              action: f.action, method: f.method,
              inputs: Array.from(f.querySelectorAll('input,select,textarea')).map(i => ({
                type: i.type || i.tagName.toLowerCase(), name: i.name, id: i.id
              }))
            }));
            const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
              text: a.textContent?.trim().slice(0, 50), href: a.href
            }));
            const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
            const comments = document.documentElement.innerHTML.match(/<!--[\\s\\S]*?-->/g) || [];
            const headers = {};
            const bodyText = document.body?.innerText?.slice(0, 3000) || '';
            return JSON.stringify({ title, meta, forms, links, scripts, comments: comments.slice(0, 10), bodyText });
          })()
        `);
        capture.destroy();
        resolve(content);
      } catch (err) {
        capture.destroy();
        resolve('[Failed to extract page content]');
      }
    });

    capture.webContents.on('did-fail-load', () => {
      clearTimeout(timeout);
      capture.destroy();
      resolve('[Page failed to load — target may be unreachable]');
    });

    capture.loadURL(url);
  });
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

  // Detect container runtime on startup
  containerManager.detectRuntime();

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
