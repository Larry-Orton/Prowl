<p align="center">
  <img src="assets/logo.png" alt="PROWL" width="220" />
</p>

<h1 align="center">PROWL</h1>

<p align="center">
  <strong>A terminal emulator built for pentesters.</strong>
</p>

<p align="center">
  Local shell. Kali container. AI assistant. VPN management. Target notebooks. Credential vault. All in one window.
</p>

<p align="center">
  <a href="https://github.com/Larry-Orton/Prowl/releases/latest"><strong>Download Latest Release</strong></a>
</p>

---

## What PROWL Actually Is

PROWL is a terminal emulator built for pentesting. Instead of juggling separate windows for your terminal, notes, and browser, everything lives in one app.

It gives you:

- local and Kali container terminals (with split view)
- 35+ Kali tool commands that auto-fill your target — click and go
- an AI assistant that sees your terminal output and remembers everything across sessions
- one notebook per target — you and the AI both write to it
- a credential vault for discovered passwords, hashes, and keys
- a methodology checklist that tracks your progress through the engagement
- a report generator that compiles your findings into a professional pentest report
- VPN management, embedded browser, findings tracker, and loot manager

## Features

| Feature | What it does |
| --- | --- |
| **Multi-tab terminals** | Local shell and Kali container tabs, renameable, with split view |
| **35+ Tool Commands** | Categorized Kali tools (Recon, Web, Brute, Exploit, Win/AD, Linux, Util). Click to paste into terminal with target auto-filled |
| **AI assistant** | Sees your terminal output, remembers across sessions via `target.md`. Choose Opus, Sonnet, or Haiku |
| **Voice output** | Toggle the mic button — AI speaks responses using a bundled neural voice (Piper TTS). No setup needed |
| **Target notebooks** | One notebook per target. You write notes, AI auto-journals commands. Edit or read in page-flip view |
| **Credential vault** | Store discovered credentials — username, password/hash, source, access. Quick SSH/copy buttons |
| **Methodology checklist** | Full pentest methodology with progress tracking. Includes Windows/AD attack paths. RUN buttons paste commands |
| **Report generator** | AI compiles a professional pentest report from your engagement data. Export to markdown |
| **Exploit suggestions** | Per-service searchsploit + AI exploit search for discovered services |
| **Target memory** | AI auto-creates `target.md` per target — remembers ports, services, credentials, and failed attempts across sessions |
| **VPN management** | Upload .ovpn files, connect/disconnect/switch/delete with one click |
| **Findings tracker** | Structured discoveries — targets, ports, services, URLs, credentials, vulnerabilities |
| **Engagements** | Separate targets, notebooks, findings, and history by project. Hostname support for HTTP tools |
| **Mission timeline** | Chronological feed of commands, notes, findings, and events |
| **Loot manager** | Browse workspace files, preview, classify, promote to findings |
| **Embedded browser** | Browse targets through the Kali SOCKS proxy |
| **Command palette** | `Ctrl/Cmd+K` to jump to anything |
| **Themes** | Multiple color schemes |

## What You Need

| Requirement | Why |
| --- | --- |
| **Docker or Podman** | Needed for the Kali container, VPN, SOCKS-routed browser access, and `/workspace` tooling |
| **Anthropic API key** | Needed for AI features |
| **Authorization** | Needed because "I was curious" is not a pentest scope |

Good news:

- You do **not** need Node.js to install or use the packaged app.
- PROWL still works without Docker/Podman if you only want the local shell, tools panel, notebooks, and engagement flow.
- PROWL still works without an API key if you want the terminal and operator workflow without AI.

## Install PROWL

### Download

Grab the latest release from [GitHub Releases](https://github.com/Larry-Orton/Prowl/releases/latest).

| Platform | Download | Notes |
| --- | --- | --- |
| **Windows** | `PROWL-Setup-x.x.x.exe` | Installer — choose your install location |
| **Windows** | `PROWL-x.x.x-portable.exe` | Portable single exe, no install needed |
| **macOS** | Coming soon | |
| **Linux** | Coming soon | |

> **Windows SmartScreen / Smart App Control**: Because PROWL is not yet code-signed, Windows may block the installer. For SmartScreen, click **"More info"** then **"Run anyway"**. For Smart App Control, right-click the exe → Properties → check **"Unblock"** → Apply, then run it. This only happens on the first install — PROWL auto-updates after that.

## First Launch

1. Launch PROWL.
2. Open the AI panel and add your Anthropic API key (optional).
3. Open the Kali panel (dragon icon) and build the image (first time only, takes a few minutes).
4. Start the Kali container.
5. Upload your .ovpn file in the VPN panel if you're using HackTheBox or TryHackMe.
6. Set your target: `target <ip>`.
7. Set the hostname in the engagement panel if the target uses one (e.g., `2million.htb`).
8. Use the tool buttons on the left panel to start scanning — commands auto-fill with your target.

## Key Concepts

| Term | Meaning |
| --- | --- |
| **Engagement** | A project (e.g., a specific HTB machine). Keeps notebooks, findings, and history separate |
| **Notebook** | One per target — a markdown file where you and the AI both write. Auto-created when you set a target |
| **Credential** | A discovered username/password/hash stored in the vault with source and access info |
| **Finding** | A structured discovery — target, open port, service, file, URL, or vulnerability |
| **Loot** | Files in your workspace (scan results, scripts, output files) |

## Title Bar Icons

From left to right:

- **VPN indicator**: shows connection status, click to manage VPN
- **Kali dragon**: manage the Kali container (build/start/stop)
- **Command palette**: `Ctrl/Cmd+K` to search everything
- **Engagements**: switch between projects
- **Mission mode**: current attack phase
- **Split**: side-by-side terminals
- **Loot**: workspace file browser
- **Findings**: structured discoveries
- **Timeline**: chronological event feed
- **Credentials**: credential vault (key icon)
- **Methodology**: pentest checklist (check icon)
- **Report**: generate pentest report (document icon)
- **Exploits**: per-service exploit search (lightning icon)
- **Notes**: toggle left panel
- **Notebook**: open target notebook (book icon — dropdown if multiple targets)
- **AI**: toggle AI chat panel
- **Browser**: toggle embedded browser
- **Theme**: color scheme picker

## What The AI Can Do

- Answer questions about tools, techniques, and methodology
- See your terminal output automatically — just ask about what happened
- Search the web for walkthroughs, CVEs, and documentation
- **Persistent target memory** — remembers ports, services, credentials, and failed attempts in `target.md`. Come back tomorrow and it knows where you left off
- **Auto-journal** — after significant commands (nmap, gobuster, etc.), the AI writes a narrative entry in your target notebook
- **Voice output** — click the mic button to have the AI speak responses. Uses a bundled neural voice (Piper TTS), no setup needed, works offline
- **Model selection** — choose between Opus (smartest), Sonnet (balanced), or Haiku (fastest/cheapest)

You need an Anthropic API key to use the AI features. PROWL works fine without one.

## Kali, Browser, VPN, and Loot

### Kali Container

With Docker or Podman available, PROWL runs a Kali environment inside the app with 30+ pentesting tools pre-installed. The image builds once and is reused for every session.

### Embedded Browser

Browse target web apps routed through the Kali SOCKS proxy. Scan pages and send content to AI for analysis.

### VPN

Upload `.ovpn` files, connect/disconnect/switch with one click. VPN runs inside the container so your host network is unaffected.

### Loot Manager

Browse workspace files by engagement, preview text files, classify loot, and promote artifacts into findings. Works even when the Kali container is not running.

## For Developers

### Source Build

```bash
git clone https://github.com/Larry-Orton/Prowl.git
cd Prowl
npm run setup
npm run electron:build
```

Use `npm run setup`, not plain `npm install`, because PROWL rebuilds native Electron dependencies.

### Project Structure

```text
src/
  main/                 Electron main process
    index.ts            IPC handlers, workspace access, TTS, browser capture
    shellManager.ts     Local + Kali shell orchestration, keyword interception
    containerManager.ts Docker/Podman lifecycle, VPN, tool environment
    aiProxy.ts          AI proxying with web search/fetch tools
    preload.ts          Renderer bridge

  renderer/             React app
    App.tsx             Main orchestration layer
    components/         Terminal, AI, notes, timeline, findings, loot, credentials,
                        methodology, report, exploit suggestions, notebook viewer
    hooks/              Engagement, AI, notes, commands, findings
    store/              Zustand state for session, terminals, mission mode, findings
    lib/                Mission mode and notebook logic

  db/
    client.ts           JSON persistence for engagements, notes, commands, findings, API key

  shared/
    types.ts            Shared interfaces
    constants.ts        Tool commands, quick commands, shared constants
    terminalKeywords.ts Terminal keyword parser

docker/
  Dockerfile            Kali image with 30+ tools
  entrypoint.sh         Container startup

resources/
  piper/                Bundled neural TTS voice (Amy)
```

## Legal

Use PROWL on systems you own or are explicitly authorized to assess.

## Contributing

Ideas, issues, and pull requests are welcome.

## License

MIT
