/**
 * Container Manager — handles Docker/Podman lifecycle for the PROWL Kali container.
 * Detects runtime, builds image, starts/stops container, execs into it.
 */
import { execFile, spawn, ChildProcess } from 'child_process';
import { createHash } from 'crypto';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export type ContainerRuntime = 'docker' | 'podman' | null;
export type ContainerStatus = 'not_installed' | 'no_image' | 'stopped' | 'running' | 'update_available';

const IMAGE_NAME = 'prowl-kali';
const CONTAINER_NAME = 'prowl-kali-env';
const SOCKS_PORT = 1080;

class ContainerManager {
  private runtime: ContainerRuntime = null;
  private runtimePath: string = '';

  // ── Detection ────────────────────────────────

  async detectRuntime(): Promise<ContainerRuntime> {
    // Try docker first, then podman
    for (const rt of ['docker', 'podman'] as const) {
      try {
        await this.exec(rt, ['--version']);
        this.runtime = rt;
        this.runtimePath = rt;
        return rt;
      } catch {
        continue;
      }
    }
    this.runtime = null;
    return null;
  }

  getRuntime(): ContainerRuntime {
    return this.runtime;
  }

  // ── Status ───────────────────────────────────

  async getStatus(): Promise<ContainerStatus> {
    if (!this.runtime) {
      const detected = await this.detectRuntime();
      if (!detected) return 'not_installed';
    }

    // Check if image exists
    try {
      const images = await this.exec(this.runtimePath, ['images', IMAGE_NAME, '--format', '{{.Repository}}']);
      if (!images.trim()) return 'no_image';
    } catch {
      return 'no_image';
    }

    // Check if image is outdated
    const outdated = await this.isImageOutdated();

    // Check if container is running
    try {
      const state = await this.exec(this.runtimePath, [
        'inspect', CONTAINER_NAME, '--format', '{{.State.Running}}'
      ]);
      if (state.trim() === 'true') return outdated ? 'update_available' : 'running';
      return outdated ? 'update_available' : 'stopped';
    } catch {
      return outdated ? 'update_available' : 'stopped';
    }
  }

  // ── Version Check ──────────────────────────────

  private getDockerfileHash(): string {
    const dockerDir = this.getDockerDir();
    const dockerfilePath = path.join(dockerDir, 'Dockerfile');
    const entrypointPath = path.join(dockerDir, 'entrypoint.sh');
    const hash = createHash('sha256');
    if (fs.existsSync(dockerfilePath)) hash.update(fs.readFileSync(dockerfilePath));
    if (fs.existsSync(entrypointPath)) hash.update(fs.readFileSync(entrypointPath));
    return hash.digest('hex').slice(0, 12);
  }

  private async isImageOutdated(): Promise<boolean> {
    try {
      const currentHash = this.getDockerfileHash();
      const labelHash = await this.exec(this.runtimePath, [
        'inspect', IMAGE_NAME, '--format', '{{index .Config.Labels "prowl.dockerfile.hash"}}'
      ]);
      return labelHash.trim() !== currentHash;
    } catch {
      return false;
    }
  }

  // ── Image Build ──────────────────────────────

  async buildImage(onProgress: (line: string) => void): Promise<void> {
    if (!this.runtime) throw new Error('No container runtime found');

    const dockerDir = this.getDockerDir();
    if (!fs.existsSync(path.join(dockerDir, 'Dockerfile'))) {
      throw new Error('Dockerfile not found at ' + dockerDir);
    }

    const hash = this.getDockerfileHash();

    return new Promise((resolve, reject) => {
      const proc = spawn(this.runtimePath, ['build', '-t', IMAGE_NAME, '--label', `prowl.dockerfile.hash=${hash}`, '.'], {
        cwd: dockerDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach(line => onProgress(line));
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach(line => onProgress(line));
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Image build failed with code ${code}`));
      });

      proc.on('error', reject);
    });
  }

  // ── Container Lifecycle ──────────────────────

  async startContainer(workspacePath: string, vpnDir: string): Promise<void> {
    if (!this.runtime) throw new Error('No container runtime found');

    // Remove existing stopped container
    try {
      await this.exec(this.runtimePath, ['rm', '-f', CONTAINER_NAME]);
    } catch {
      // doesn't exist, fine
    }

    // Ensure workspace and vpn dirs exist
    fs.mkdirSync(workspacePath, { recursive: true });
    fs.mkdirSync(vpnDir, { recursive: true });

    const args = [
      'run', '-d',
      '--name', CONTAINER_NAME,
      '--hostname', 'prowl',
      '--cap-add', 'NET_ADMIN',       // needed for VPN/tun devices
      '--device', '/dev/net/tun',      // TUN device for OpenVPN (Linux only, ignored on others)
      '-p', `${SOCKS_PORT}:${SOCKS_PORT}`,  // SOCKS proxy for browser
      '-v', `${workspacePath}:/workspace`,
      '-v', `${vpnDir}:/vpn`,
      '--restart', 'unless-stopped',
      IMAGE_NAME,
      'sleep', 'infinity',            // keep container alive
    ];

    await this.exec(this.runtimePath, args);

    // Run entrypoint manually since we override CMD with sleep
    await this.exec(this.runtimePath, [
      'exec', '-d', CONTAINER_NAME, '/entrypoint.sh', 'true'
    ]);
  }

  async stopContainer(): Promise<void> {
    if (!this.runtime) return;
    try {
      await this.exec(this.runtimePath, ['stop', CONTAINER_NAME]);
    } catch {
      // already stopped
    }
  }

  async removeContainer(): Promise<void> {
    if (!this.runtime) return;
    try {
      await this.exec(this.runtimePath, ['rm', '-f', CONTAINER_NAME]);
    } catch {
      // doesn't exist
    }
  }

  // ── Exec into container (returns spawned process) ──

  spawnShell(): ChildProcess {
    if (!this.runtime) throw new Error('No container runtime found');

    return spawn(this.runtimePath, [
      'exec', '-it', CONTAINER_NAME, '/bin/bash'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  async execCommand(command: string): Promise<string> {
    if (!this.runtime) throw new Error('No container runtime found');
    return this.exec(this.runtimePath, [
      'exec', CONTAINER_NAME, '/bin/bash', '-c', command
    ]);
  }

  // ── VPN Management ───────────────────────────

  async connectVPN(ovpnFilename: string): Promise<string> {
    // Ensure TUN device exists (Docker Desktop on Windows doesn't provide it)
    await this.execCommand(
      'mkdir -p /dev/net && [ ! -e /dev/net/tun ] && mknod /dev/net/tun c 10 200 && chmod 600 /dev/net/tun || true'
    );
    return this.execCommand(
      `openvpn --config /vpn/${ovpnFilename} --daemon --log /tmp/vpn.log && sleep 8 && ` +
      `(ip link show tun0 &>/dev/null && echo "connected" || (tail -5 /tmp/vpn.log && echo "failed"))`
    );
  }

  async disconnectVPN(): Promise<void> {
    await this.execCommand('killall openvpn 2>/dev/null || true');
  }

  async getVPNStatus(): Promise<{ connected: boolean; ip?: string }> {
    try {
      const result = await this.execCommand(
        'ip addr show tun0 2>/dev/null | grep "inet " | awk \'{print $2}\' | cut -d/ -f1'
      );
      const ip = result.trim();
      return { connected: !!ip, ip: ip || undefined };
    } catch {
      return { connected: false };
    }
  }

  async listVPNFiles(vpnDir: string): Promise<string[]> {
    try {
      const files = fs.readdirSync(vpnDir);
      return files.filter(f => f.endsWith('.ovpn') || f.endsWith('.conf'));
    } catch {
      return [];
    }
  }

  // ── Tool Auto-Install ────────────────────────

  async installTool(toolName: string): Promise<string> {
    return this.execCommand(
      `apt-get update -qq && apt-get install -y -qq ${toolName} 2>&1`
    );
  }

  async isToolInstalled(toolName: string): Promise<boolean> {
    try {
      const result = await this.execCommand(`which ${toolName}`);
      return !!result.trim();
    } catch {
      return false;
    }
  }

  // ── Helpers ──────────────────────────────────

  private getDockerDir(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'docker');
    }
    return path.join(app.getAppPath(), 'docker');
  }

  getWorkspacePath(): string {
    return path.join(app.getPath('userData'), 'workspaces');
  }

  getVPNDir(): string {
    return path.join(app.getPath('userData'), 'vpn');
  }

  getSocksPort(): number {
    return SOCKS_PORT;
  }

  private exec(cmd: string, args: string[], timeout = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }
}

export const containerManager = new ContainerManager();
