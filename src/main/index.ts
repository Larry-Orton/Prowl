import { app, BrowserWindow, ipcMain, dialog, session, protocol, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import { shellManager } from './shellManager';
import { sendToAI } from './aiProxy';
import { containerManager } from './containerManager';
import {
  getDatabase,
  saveEngagement,
  getEngagements,
  deleteEngagement,
  resetEngagementMemory,
  getCurrentEngagementId,
  setCurrentEngagementId,
  saveNote,
  getAllNotes,
  searchNotes,
  deleteNote,
  saveCommand,
  getCommands,
  searchCommands,
  saveFinding,
  getFindings,
  searchFindings,
  deleteFinding,
  saveApiKey,
  getApiKey,
  deleteApiKey,
} from '../db/client';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function resolveWorkspaceHostPath(workspacePath?: string): string {
  const workspaceRoot = containerManager.getWorkspacePath();
  const normalizedWorkspacePath = (workspacePath || '/workspace').replace(/\\/g, '/');
  const relativePath = normalizedWorkspacePath.startsWith('/workspace')
    ? path.posix.relative('/workspace', normalizedWorkspacePath)
    : normalizedWorkspacePath.replace(/^\/+/, '');
  const hostPath = path.resolve(workspaceRoot, relativePath || '.');
  const workspaceRootResolved = path.resolve(workspaceRoot);
  const workspaceRelative = path.relative(workspaceRootResolved, hostPath);

  if (workspaceRelative.startsWith('..') || path.isAbsolute(workspaceRelative)) {
    throw new Error('Workspace path escapes root');
  }

  return hostPath;
}

function toWorkspaceContainerPath(hostPath: string): string {
  const workspaceRoot = path.resolve(containerManager.getWorkspacePath());
  const normalizedHostPath = path.resolve(hostPath);
  const relativePath = path.relative(workspaceRoot, normalizedHostPath);

  if (relativePath.startsWith('..')) {
    throw new Error('Workspace path escapes root');
  }

  const posixRelative = relativePath.split(path.sep).join('/');
  return posixRelative ? `/workspace/${posixRelative}` : '/workspace';
}

function migrateWorkspaceDirectory(previousWorkspacePath?: string, nextWorkspacePath?: string): void {
  if (!previousWorkspacePath || !nextWorkspacePath || previousWorkspacePath === nextWorkspacePath) {
    return;
  }

  const workspaceRoot = path.resolve(containerManager.getWorkspacePath());
  const previousHostPath = resolveWorkspaceHostPath(previousWorkspacePath);
  const nextHostPath = resolveWorkspaceHostPath(nextWorkspacePath);

  if (previousHostPath === nextHostPath || previousHostPath === workspaceRoot) {
    fs.mkdirSync(nextHostPath, { recursive: true });
    return;
  }

  if (!fs.existsSync(previousHostPath)) {
    fs.mkdirSync(nextHostPath, { recursive: true });
    return;
  }

  fs.mkdirSync(path.dirname(nextHostPath), { recursive: true });

  if (!fs.existsSync(nextHostPath)) {
    fs.renameSync(previousHostPath, nextHostPath);
    return;
  }

  const nextEntries = fs.readdirSync(nextHostPath);
  if (nextEntries.length === 0) {
    fs.rmSync(nextHostPath, { recursive: true, force: true });
    fs.renameSync(previousHostPath, nextHostPath);
    return;
  }

  fs.mkdirSync(nextHostPath, { recursive: true });
}

function clearWorkspaceDirectory(workspacePath?: string): void {
  if (!workspacePath) {
    return;
  }

  const workspaceRoot = path.resolve(containerManager.getWorkspacePath());
  const targetHostPath = resolveWorkspaceHostPath(workspacePath);
  fs.mkdirSync(targetHostPath, { recursive: true });

  if (targetHostPath === workspaceRoot) {
    return;
  }

  for (const entry of fs.readdirSync(targetHostPath)) {
    fs.rmSync(path.join(targetHostPath, entry), { recursive: true, force: true });
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    thickFrame: true,
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

  // Grant all permissions (microphone for speech recognition, etc.)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  // Set CSP to allow data: URLs for Piper TTS audio and Google speech API
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com data:; " +
          "media-src 'self' data: blob:; " +
          "img-src 'self' data:; " +
          (isDev
            ? "connect-src 'self' ws://localhost:5173 http://localhost:5173 https://fonts.googleapis.com https://fonts.gstatic.com https://www.google.com https://*.google.com wss://*.google.com;"
            : "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://www.google.com https://*.google.com wss://*.google.com;")
        ],
      },
    });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  // Set SOCKS proxy on the embedded browser partition
  const browserSession = session.fromPartition('persist:prowl-browser');
  const socksPort = containerManager.getSocksPort();
  browserSession.setProxy({
    proxyRules: `socks5://127.0.0.1:${socksPort}`,
    proxyBypassRules: '',
  }).then(() => {
    console.log('[PROWL] Browser proxy set: socks5://127.0.0.1:' + socksPort);
  }).catch((err: Error) => {
    console.error('[PROWL] Failed to set browser proxy:', err);
  });

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

ipcMain.handle('engagements:save', async (_, engagement) => {
  const previous = engagement.id
    ? getEngagements().find((item) => item.id === engagement.id)
    : undefined;
  const saved = saveEngagement(engagement);
  migrateWorkspaceDirectory(previous?.workspacePath, saved.workspacePath);
  fs.mkdirSync(resolveWorkspaceHostPath(saved.workspacePath), { recursive: true });
  return saved;
});

ipcMain.handle('engagements:getAll', async () => {
  return getEngagements();
});

ipcMain.handle('engagements:delete', async (_, id: string) => {
  deleteEngagement(id);
});

ipcMain.handle('engagements:getCurrent', async () => {
  return getCurrentEngagementId();
});

ipcMain.handle('engagements:setCurrent', async (_, id: string) => {
  return setCurrentEngagementId(id);
});

ipcMain.handle('engagements:resetMemory', async (_, id: string) => {
  const previous = getEngagements().find((item) => item.id === id);
  const reset = resetEngagementMemory(id);
  clearWorkspaceDirectory(previous?.workspacePath);
  if (reset.workspacePath !== previous?.workspacePath) {
    clearWorkspaceDirectory(reset.workspacePath);
  }
  return reset;
});

// ── Notes IPC ──────────────────────────────────────

ipcMain.handle('notes:save', async (_, note) => {
  const db = getDatabase();
  return saveNote(db, note);
});

ipcMain.handle('notes:getAll', async (_, engagementId?: string) => {
  const db = getDatabase();
  return getAllNotes(db, engagementId);
});

ipcMain.handle('notes:search', async (_, query: string, engagementId?: string) => {
  const db = getDatabase();
  return searchNotes(db, query, engagementId);
});

ipcMain.handle('notes:delete', async (_, id: string) => {
  const db = getDatabase();
  deleteNote(db, id);
});

// ── Command History IPC ────────────────────────────

ipcMain.handle('commands:save', async (_, command: string, target: string, engagementId?: string) => {
  return saveCommand(command, target, engagementId);
});

ipcMain.handle('commands:getAll', async (_, engagementId?: string) => {
  return getCommands(engagementId);
});

ipcMain.handle('commands:search', async (_, query: string, currentTarget?: string, engagementId?: string) => {
  return searchCommands(query, currentTarget, engagementId);
});

// ── AI IPC ─────────────────────────────────────────

ipcMain.handle('findings:save', async (_, finding) => {
  return saveFinding(finding);
});

ipcMain.handle('findings:getAll', async (_, engagementId?: string) => {
  return getFindings(engagementId);
});

ipcMain.handle('findings:search', async (_, query: string, engagementId?: string) => {
  return searchFindings(query, engagementId);
});

ipcMain.handle('findings:delete', async (_, id: string) => {
  deleteFinding(id);
});

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

ipcMain.handle('ai:setModel', async (_, model: string) => {
  const { setActiveModel } = await import('./aiProxy');
  setActiveModel(model);
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

ipcMain.handle('vpn:deleteFile', async (_, filename: string) => {
  const vpnDir = containerManager.getVPNDir();
  const filePath = path.join(vpnDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
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

// ── Workspace IPC ─────────────────────────────────

ipcMain.handle('workspace:listFiles', async (_, dirPath?: string) => {
  try {
    const targetHostDir = resolveWorkspaceHostPath(dirPath);
    fs.mkdirSync(targetHostDir, { recursive: true });

    return fs.readdirSync(targetHostDir, { withFileTypes: true })
      .map((entry) => {
        const fullHostPath = path.join(targetHostDir, entry.name);
        const stats = fs.statSync(fullHostPath);
        return {
          name: entry.name,
          path: toWorkspaceContainerPath(fullHostPath),
          type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.modified.localeCompare(a.modified));
  } catch {
    return [];
  }
});

ipcMain.handle('workspace:readFile', async (_, filePath: string) => {
  try {
    const hostPath = resolveWorkspaceHostPath(filePath);
    const preview = fs.readFileSync(hostPath).subarray(0, 512000);
    if (preview.includes(0)) {
      return '[Binary file preview unavailable]';
    }
    return preview.toString('utf-8');
  } catch {
    return null;
  }
});

ipcMain.handle('workspace:deleteFile', async (_, filePath: string) => {
  try {
    const hostPath = resolveWorkspaceHostPath(filePath);
    fs.rmSync(hostPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('workspace:writeFile', async (_, filePath: string, content: string) => {
  try {
    const hostPath = resolveWorkspaceHostPath(filePath);
    const dir = path.dirname(hostPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(hostPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

// ── TTS (Piper) IPC ───────────────────────────────

ipcMain.handle('tts:speak', async (_, text: string) => {
  const { execFile: ef } = await import('child_process');
  const piperDir = app.isPackaged
    ? path.resolve(process.resourcesPath, 'piper')
    : path.resolve(app.getAppPath(), 'resources', 'piper');
  const piperExe = path.join(piperDir, 'piper.exe');
  const modelPath = path.join(piperDir, 'en_US-amy-medium.onnx');

  if (!fs.existsSync(piperExe) || !fs.existsSync(modelPath)) {
    return null;
  }

  const outFile = path.join(app.getPath('temp'), `prowl-tts-${Date.now()}.wav`);

  const success = await new Promise<boolean>((resolve) => {
    const proc = ef(piperExe, [
      '--model', modelPath,
      '--output_file', outFile,
    ], { cwd: piperDir, timeout: 30000 }, (err) => {
      resolve(!err && fs.existsSync(outFile));
    });
    proc.stdin?.write(text);
    proc.stdin?.end();
  });

  if (!success) return null;

  // Serve the WAV file through a local protocol that CSP allows
  return outFile;
});

ipcMain.handle('tts:cleanup', async (_, filePath: string) => {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
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

// Register prowl-tts:// protocol for serving TTS audio files
protocol.registerSchemesAsPrivileged([
  { scheme: 'prowl-tts', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  // Handle prowl-tts:// URLs — serves local WAV files
  protocol.handle('prowl-tts', (request) => {
    const filePath = decodeURIComponent(request.url.replace('prowl-tts://', ''));
    return net.fetch(`file://${filePath}`);
  });

  createWindow();

  // Detect container runtime on startup
  containerManager.detectRuntime();

  // ── Auto-update (packaged builds only) ──────────
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log('[PROWL] Update available:', info.version);
      mainWindow?.webContents.send('updater:status', 'available', info.version);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[PROWL] Update downloaded:', info.version);
      mainWindow?.webContents.send('updater:status', 'downloaded', info.version);
      // Notify user — update installs on next quit
      dialog.showMessageBox({
        type: 'info',
        title: 'PROWL Update Ready',
        message: `Version ${info.version} has been downloaded and will be installed when you close PROWL.`,
        buttons: ['Restart Now', 'Later'],
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (err) => {
      console.error('[PROWL] Auto-update error:', err.message);
    });

    // Check for updates after a short delay
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err: Error) => {
        console.error('[PROWL] Update check failed:', err.message);
      });
    }, 5000);
  }

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
