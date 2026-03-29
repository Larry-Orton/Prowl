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
    });

    this.shells.set(id, { pty: ptyProcess, webContents, type });
  }

  write(id: string, data: string): void {
    const shell = this.shells.get(id);
    if (!shell) return;

    // Check if data contains Enter (\r)
    const enterIdx = data.indexOf('\r');

    if (enterIdx === -1) {
      // No Enter — forward entire data to PTY in one write (preserves escape sequences)
      shell.pty.write(data);
      this.updateLineBuffer(id, data);
      return;
    }

    // Data contains Enter — check line buffer for keyword
    const beforeEnter = data.substring(0, enterIdx);
    this.updateLineBuffer(id, beforeEnter);

    const buf = this.lineBuffers.get(id) || '';
    const action = parseKeywordCommand(buf);

    if (action) {
      // Keyword detected — send everything before Enter, then clear line
      if (beforeEnter) shell.pty.write(beforeEnter);
      shell.pty.write('\x15'); // Ctrl+U to clear the typed text
      if (!shell.webContents.isDestroyed()) {
        shell.webContents.send('prowl:keyword-action', id, action);
      }
      this.lineBuffers.set(id, '');
    } else {
      // Not a keyword — forward everything including Enter
      shell.pty.write(data.substring(0, enterIdx + 1));
      this.lineBuffers.set(id, '');
    }

    // Process anything after the Enter (e.g. pasted text with multiple lines)
    const afterEnter = data.substring(enterIdx + 1);
    if (afterEnter) {
      this.write(id, afterEnter);
    }
  }

  private updateLineBuffer(id: string, data: string): void {
    let buf = this.lineBuffers.get(id) || '';

    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const code = ch.charCodeAt(0);

      if (ch === '\x7f') {
        buf = buf.slice(0, -1);
      } else if (ch === '\x03' || ch === '\x15') {
        buf = '';
      } else if (ch === '\x1b') {
        // Skip escape sequences — don't add to buffer
        // Find end of sequence
        if (i + 1 < data.length) {
          const next = data[i + 1];
          if (next === '[') {
            // CSI sequence — skip until terminator (64-126)
            i += 2;
            while (i < data.length && !(data.charCodeAt(i) >= 64 && data.charCodeAt(i) <= 126)) {
              i++;
            }
          } else if (next === 'O') {
            // SS3 — skip one more char
            i += 2;
          } else {
            i += 1;
          }
        }
      } else if (code >= 32 && code < 127) {
        buf += ch;
      }
      // Ignore all other control characters
    }

    this.lineBuffers.set(id, buf);
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
