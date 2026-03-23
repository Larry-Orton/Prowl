import * as pty from 'node-pty';
import { WebContents } from 'electron';
import os from 'os';
import { containerManager } from './containerManager';
import { parseKeywordCommand } from '../shared/terminalKeywords';

interface ShellInstance {
  pty: pty.IPty;
  webContents: WebContents;
  type: 'local' | 'kali';
}

class ShellManager {
  private shells: Map<string, ShellInstance> = new Map();
  private lineBuffers: Map<string, string> = new Map();
  private escapeStates: Map<string, 'none' | 'esc' | 'csi' | 'ss3'> = new Map();

  private getShellPath(): string {
    switch (process.platform) {
      case 'darwin':
        return '/bin/zsh';
      case 'linux':
        return '/bin/bash';
      case 'win32':
        return 'powershell.exe';
      default:
        return '/bin/bash';
    }
  }

  private getDefaultCwd(): string {
    return process.env.HOME || process.env.USERPROFILE || os.homedir() || '/';
  }

  private getRuntimePath(): string {
    const rt = containerManager.getRuntime();
    return rt || 'docker';
  }

  spawn(id: string, webContents: WebContents, type: 'local' | 'kali' = 'local'): void {
    if (this.shells.has(id)) {
      this.kill(id);
    }

    const env: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    env.TERM = 'xterm-256color';
    env.COLORTERM = 'truecolor';

    let shell: string;
    let args: string[];
    const cwd = this.getDefaultCwd();

    if (type === 'kali') {
      // Spawn into Docker/Podman container
      shell = this.getRuntimePath();
      args = ['exec', '-it', 'prowl-kali-env', '/bin/bash'];
    } else {
      shell = this.getShellPath();
      args = [];
    }

    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd,
      env,
    });

    ptyProcess.onData((data: string) => {
      if (!webContents.isDestroyed()) {
        webContents.send('shell:data', id, data);
      }
    });

    ptyProcess.onExit(() => {
      if (!webContents.isDestroyed()) {
        webContents.send('shell:exit', id);
      }
      this.shells.delete(id);
      this.lineBuffers.delete(id);
      this.escapeStates.delete(id);
    });

    this.shells.set(id, { pty: ptyProcess, webContents, type });
  }

  write(id: string, data: string): void {
    const shell = this.shells.get(id);
    if (!shell) return;

    let buf = this.lineBuffers.get(id) || '';
    let escapeState = this.escapeStates.get(id) || 'none';

    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const code = ch.charCodeAt(0);

      if (escapeState === 'esc') {
        shell.pty.write(ch);
        if (ch === '[') {
          escapeState = 'csi';
        } else if (ch === 'O') {
          escapeState = 'ss3';
        } else {
          escapeState = 'none';
        }
        continue;
      }

      if (escapeState === 'csi') {
        shell.pty.write(ch);
        if (code >= 64 && code <= 126) {
          escapeState = 'none';
        }
        continue;
      }

      if (escapeState === 'ss3') {
        shell.pty.write(ch);
        escapeState = 'none';
        continue;
      }

      if (ch === '\r') {
        // Enter pressed — check for keyword
        const action = parseKeywordCommand(buf);
        if (action) {
          // Clear the current line without emitting a visible ^C.
          shell.pty.write('\x15');
          if (!shell.webContents.isDestroyed()) {
            shell.webContents.send('prowl:keyword-action', id, action);
          }
          buf = '';
          escapeState = 'none';
        } else {
          // Normal command — send Enter
          shell.pty.write('\r');
          buf = '';
        }
      } else if (ch === '\x7f') {
        // Backspace
        buf = buf.slice(0, -1);
        shell.pty.write(ch);
      } else if (ch === '\x03') {
        // Ctrl+C
        buf = '';
        shell.pty.write(ch);
      } else if (ch === '\x15') {
        // Ctrl+U
        buf = '';
        shell.pty.write(ch);
      } else if (ch === '\x1b') {
        escapeState = 'esc';
        shell.pty.write(ch);
      } else if (code >= 32 && code < 127) {
        // Printable ASCII — track in buffer
        buf += ch;
        shell.pty.write(ch);
      } else {
        // Everything else (escape sequences, control chars, unicode)
        // Pass through without modifying buffer
        shell.pty.write(ch);
      }
    }

    this.lineBuffers.set(id, buf);
    this.escapeStates.set(id, escapeState);
  }

  resize(id: string, cols: number, rows: number): void {
    const shell = this.shells.get(id);
    if (shell) {
      try {
        shell.pty.resize(Math.max(1, cols), Math.max(1, rows));
      } catch {
        // Ignore resize errors
      }
    }
  }

  kill(id: string): void {
    const shell = this.shells.get(id);
    if (shell) {
      try {
        shell.pty.kill();
      } catch {
        // Ignore kill errors
      }
      this.shells.delete(id);
      this.lineBuffers.delete(id);
      this.escapeStates.delete(id);
    }
  }

  killAll(): void {
    for (const id of this.shells.keys()) {
      this.kill(id);
    }
  }

  hasShell(id: string): boolean {
    return this.shells.has(id);
  }

  getShellType(id: string): 'local' | 'kali' | null {
    return this.shells.get(id)?.type ?? null;
  }
}

export const shellManager = new ShellManager();
