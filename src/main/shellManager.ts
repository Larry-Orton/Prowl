import * as pty from 'node-pty';
import { WebContents } from 'electron';
import os from 'os';
import { containerManager } from './containerManager';

interface ShellInstance {
  pty: pty.IPty;
  webContents: WebContents;
  type: 'local' | 'kali';
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
    });

    this.shells.set(id, { pty: ptyProcess, webContents, type });
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

  getShellType(id: string): 'local' | 'kali' | null {
    return this.shells.get(id)?.type ?? null;
  }
}

export const shellManager = new ShellManager();
