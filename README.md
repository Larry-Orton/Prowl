<p align="center">
  <img src="assets/logo.png" alt="PROWL" width="180" />
</p>

<h1 align="center">PROWL</h1>

<p align="center">
  <strong>Intelligent pentester terminal — never leave the terminal.</strong><br/>
  Electron + React + xterm.js + Claude AI
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-6c6cff?style=flat-square" />
  <img src="https://img.shields.io/badge/electron-28-444466?style=flat-square" />
  <img src="https://img.shields.io/badge/AI-Claude-8a8aff?style=flat-square" />
</p>

## Quick Install

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/Larry-Orton/Prowl/main/scripts/install.sh | bash
```

**Windows (PowerShell as Admin):**
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/Larry-Orton/Prowl/main/scripts/install.ps1 | iex
```

The installer handles everything: git, Node.js, C++ build tools, and native module compilation.

## Manual Setup

```bash
git clone https://github.com/Larry-Orton/Prowl.git
cd prowl
npm run setup
```

## Dev

```bash
npm run electron:dev
```

## Build

```bash
npm run electron:build
```

## Terminal Commands

| Command | Action |
|---|---|
| `target <ip>` | Set active target |
| `note <text>` | Save note (AI auto-organizes) |
| `notes add <text>` | Append to last note |
| `add last <tool>` | Send last output to AI for analysis |
| `ask <question>` | Open AI with question |
| `help` | Get pentest methodology guidance |
| `search <term>` | Filter notes |
| `export notes` | Export notes as .md |
| `commands <tool>` | Show tool reference |

## Architecture

```
src/
  main/           Electron main process
    index.ts      Entry point, IPC handlers
    shellManager   PTY shell management (node-pty)
    aiProxy.ts     Claude API proxy (keeps API key secure)
    preload.ts     Context bridge for renderer
  renderer/        React SPA
    components/    Terminal, NotesPanel, AIPanel, StatusBar, TitleBar
    hooks/         useTerminal, useNotes, useAI
    store/         Zustand stores (terminal, notes, session)
  db/
    client.ts      JSON persistence (notes, command history, encrypted API key)
  shared/
    types.ts       Shared TypeScript interfaces
    constants.ts   App constants, tool configs
```
