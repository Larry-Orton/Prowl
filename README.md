<p align="center">
  <img src="assets/logo.png" alt="PROWL" width="180" />
</p>

<h1 align="center">PROWL</h1>

<p align="center">
  <strong>Intelligent pentester terminal — never leave the terminal.</strong><br/>
  AI-assisted hacking with a built-in Kali container, smart notes, and embedded browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-6c6cff?style=flat-square" />
  <img src="https://img.shields.io/badge/electron-28-444466?style=flat-square" />
  <img src="https://img.shields.io/badge/AI-Claude-8a8aff?style=flat-square" />
  <img src="https://img.shields.io/badge/Kali-Docker-22c55e?style=flat-square" />
</p>

---

## What is PROWL?

PROWL is a terminal emulator built for hackers and pentesters. It ships with:

- **Built-in Kali Linux container** — 30+ pentest tools ready to go, no VM needed
- **AI assistant (Claude)** — sees your terminal output, notes, and browser pages to help you hack
- **Smart notes** — type what you're thinking, AI organizes it for you
- **Embedded browser** — browse target web apps side-by-side with your terminal, routed through the container's network
- **VPN management** — upload your .ovpn file, connect with one click, green light when connected
- **6 themes** — Midnight, Blood Moon, Ghost Protocol, Phosphor, Arctic, Venom (switch instantly, no restart)
- **Command history with target substitution** — search past commands, auto-rewritten with your current target IP

Works on **Windows, macOS, and Linux**. The Kali container means you get a full pentesting environment regardless of your host OS.

---

## Prerequisites

You need **Node.js 18+** installed on your machine.

**Windows:**
```powershell
winget install OpenJS.NodeJS.LTS
```

**macOS:**
```bash
brew install node
```

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

After installing Node.js, **close and reopen your terminal** so `npm` is available.

For the Kali container features, you also need **Docker** or **Podman**:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac)
- `sudo apt install docker.io` (Linux)
- PROWL auto-detects which one you have

---

## Quick Start

### Option 1: One-Command Install

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/Larry-Orton/Prowl/master/scripts/install.sh | bash
```

**Windows (PowerShell as Admin):**
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/Larry-Orton/Prowl/master/scripts/install.ps1 | iex
```

The installer handles everything: git, Node.js, C++ build tools, and native module compilation.

### Option 2: Manual Setup

```bash
git clone https://github.com/Larry-Orton/Prowl.git
cd Prowl
npm run setup
npm run electron:dev
```

That's it. Three commands and you're in.

### Option 3: Already cloned? Just run it.

```bash
cd Prowl
npm run setup          # first time only — installs deps + compiles native modules
npm run electron:dev   # launches PROWL
```

---

## First Launch

1. **PROWL opens** with a local shell tab
2. Click the **AI button** (layers icon, top-right) to set your Anthropic API key
3. Click the **container icon** (monitor icon, top-right) to set up Kali:
   - Click **Build Kali Image** (one-time, ~2-4 GB download)
   - Click **Start** to launch the container
4. Click **+** next to your tabs and choose **Kali Terminal** — you're now in a full Kali environment
5. Upload your **.ovpn file** in the container panel to connect to HTB/THM

---

## Terminal Commands

Type these directly in the terminal — PROWL intercepts them before the shell:

| Command | What it does |
|---|---|
| `target <ip>` | Set your active target |
| `note <text>` | Save a note (just say what you're thinking) |
| `notes add <text>` | Append to your last note |
| `add last <tool>` | Send last command output to AI for analysis |
| `ask <question>` | Ask the AI anything |
| `help` | Get pentest methodology guidance |
| `search <term>` | Search your notes |
| `export notes` | Export all notes as markdown |
| `commands <tool>` | Get a reference guide for any tool (nmap, sqlmap, etc.) |

---

## Features

### Kali Container
- 30+ tools pre-installed: nmap, masscan, gobuster, feroxbuster, sqlmap, hydra, john, hashcat, metasploit, impacket, evil-winrm, crackmapexec, amass, subfinder, nikto, and more
- Wordlists ready (rockyou.txt unzipped, SecLists installed)
- Your workspace is mounted at `/workspace` — files persist between sessions
- Missing a tool? It auto-installs inside the container

### AI Assistant
- Sees your terminal output, notes, and browser page content
- Context-aware — knows your target, open ports, discovered services
- Click **Scan** in the browser to send page content (forms, scripts, comments) to AI for attack surface analysis
- API key is encrypted and stored securely — never touches the browser

### VPN
- Upload `.ovpn` files through the UI
- One-click connect/disconnect
- Green shield icon when connected, gray when not
- VPN runs inside the container so all tools route through the tunnel

### Browser
- Embedded Chromium browser, side-by-side with your terminal
- Routes through the container's SOCKS proxy — can reach VPN targets (10.10.10.x)
- **Scan** button extracts page structure and sends to AI

### Themes
Click the sun icon in the title bar to switch between 6 themes instantly:
- **Midnight** — deep indigo (default)
- **Blood Moon** — crimson red
- **Ghost Protocol** — monochrome stealth
- **Phosphor** — retro green CRT
- **Arctic** — cold blue steel
- **Venom** — toxic purple

---

## Build a Packaged App

```bash
npm run electron:build
```

Outputs to `release/` — creates installers for your platform (`.exe`, `.dmg`, `.AppImage`, `.deb`).

---

## Architecture

```
src/
  main/                 Electron main process
    index.ts            Entry point, IPC handlers
    shellManager.ts     PTY shell management (local + container)
    containerManager.ts Docker/Podman lifecycle, VPN, tool install
    aiProxy.ts          Claude API proxy (API key stays in main process)
    preload.ts          Context bridge for renderer
  renderer/             React SPA
    components/         Terminal, NotesPanel, AIPanel, BrowserPanel,
                        StatusBar, TitleBar, ThemePicker, ContainerPanel
    hooks/              useTerminal, useNotes, useAI
    store/              Zustand stores (terminal, notes, session, theme)
    themes.ts           6 theme definitions with xterm color sync
  db/
    client.ts           JSON persistence (notes, commands, encrypted API key)
  shared/
    types.ts            Shared TypeScript interfaces
    constants.ts        App constants, tool configs, regex patterns
docker/
  Dockerfile            Lean Kali image with pentest tools
  entrypoint.sh         SOCKS proxy + VPN auto-connect
scripts/
  setup.js              Native module compilation for Electron
  install.sh            One-liner installer (Linux/macOS)
  install.ps1           One-liner installer (Windows)
```

---

## Contributing

Pull requests welcome. If you have ideas for new features or tools to include in the Kali image, open an issue.

## License

MIT
