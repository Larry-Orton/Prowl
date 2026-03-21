import * as pty from 'node-pty';
import { WebContents } from 'electron';
import os from 'os';

interface ShellInstance {
  pty: pty.IPty;
  webContents: WebContents;
}

class ShellManager {
  private shells: Map<string, ShellInstance> = new Map();

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

  spawn(id: string, webContents: WebContents): void {
    if (this.shells.has(id)) {
      this.kill(id);
    }

    const shell = this.getShellPath();
    const cwd = this.getDefaultCwd();

    const env: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    env.TERM = 'xterm-256color';
    env.COLORTERM = 'truecolor';

    const ptyProcess = pty.spawn(shell, [], {
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
    });

    this.shells.set(id, { pty: ptyProcess, webContents });
  }

  write(id: string, data: string): void {
    const shell = this.shells.get(id);
    if (shell) {
      shell.pty.write(data);
    }
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
}

export const shellManager = new ShellManager();
