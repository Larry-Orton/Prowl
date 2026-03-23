<p align="center">
  <img src="assets/logo.png" alt="PROWL" width="220" />
</p>

<h1 align="center">PROWL</h1>

<p align="center">
  <strong>The pentest terminal that refuses to act like "just a terminal."</strong>
</p>

<p align="center">
  Local shell. Kali container. Embedded browser. Smart notes. Structured findings. Mission timeline. Proactive AI.
</p>

<p align="center">
  <a href="https://github.com/Larry-Orton/Prowl/releases/latest"><strong>Download Latest Release</strong></a>
</p>

---

## What PROWL Actually Is

PROWL is an Electron desktop app for pentesters and security operators who are tired of working across fourteen windows, six sticky notes, three browser tabs, and one terminal session that absolutely should not still be alive but somehow is.

It gives you one cockpit for:

- running local or Kali-backed terminals
- tracking an engagement instead of a random pile of commands
- collecting findings, notes, loot, and browser recon in one place
- getting AI help that can react to what is happening, not just what you type

This means PROWL is not trying to replace your workflow. It is trying to stop your workflow from becoming a crime scene.

## Why It Feels Different

Most terminal tools do one thing well.
PROWL is built around the whole mission.

| Surface | What it does |
| --- | --- |
| **Engagements** | Separate targets, notes, command history, findings, and loot by project |
| **Proactive AI** | Suggests next moves when targets, ports, services, browser scans, VPN, or loot change |
| **Findings** | Captures structured discoveries like targets, ports, services, and files |
| **Mission Timeline** | Shows what happened, in order, across commands, notes, findings, AI, and events |
| **Loot Manager** | Browses `/workspace` artifacts, previews files, promotes loot into findings, and saves notes |
| **Mission Modes** | Keeps the app focused on web, windows, internal, exploit, credential, DNS, or recon workflows |
| **Split Terminals** | Work side-by-side instead of pretending you only need one shell |
| **Command Palette** | Jump to panels, tabs, engagements, and common actions with `Ctrl/Cmd+K` |
| **Browser + VPN** | Explore web targets through the Kali network path without leaving the app |

## What You Need

| Requirement | Why |
| --- | --- |
| **Docker or Podman** | Needed for the Kali container, VPN, SOCKS-routed browser access, and `/workspace` tooling |
| **Anthropic API key** | Needed for AI features |
| **Authorization** | Needed because "I was curious" is not a pentest scope |

Good news:

- You do **not** need Node.js to install or use the packaged app.
- PROWL still works without Docker/Podman if you only want the local shell, notes, findings UI, mission timeline, command palette, and engagement flow.
- PROWL still works without an API key if you want the terminal and operator workflow without AI.

## Install PROWL

### Download

Grab the latest release from [GitHub Releases](https://github.com/Larry-Orton/Prowl/releases/latest).

| Platform | Download | Notes |
| --- | --- | --- |
| **Windows** | `PROWL-Setup-0.1.0.exe` | NSIS installer, choose your install location |
| **Windows** | `PROWL-0.1.0-portable.exe` | Portable single exe, no install needed |
| **Windows** | `PROWL-0.1.0-win-portable.zip` | Portable zip, extract and run `PROWL.exe` |
| **macOS** | Coming soon | |
| **Linux** | Coming soon | |

### Install In About 60 Seconds

1. Download the file for your OS from the [latest release](https://github.com/Larry-Orton/Prowl/releases/latest).
2. Run the installer or extract the portable build.
3. Launch PROWL.
4. Set your Anthropic API key if you want AI features.
5. Build and start the Kali container if you want the full cockpit.

That is the normal user path.
That is the blessed path.
That is the path where you do not end up explaining Electron rebuild logs to your future self.

## First Launch

Here is the fastest way to stop staring at the UI and start using it:

1. Launch PROWL.
2. Open the AI panel and add your Anthropic API key.
3. Open the Kali/container panel and build the image (first time only, takes a few minutes).
4. Start the Kali container.
5. Create or select an engagement.
6. Set your target with `target <ip-or-host>`.
7. Use `Ctrl/Cmd+K` to open the command palette and jump where you need to go.
8. Start recon. PROWL will begin building findings, timeline events, notes, and suggestions around what you do.

That is the intended flow.
Not "open five apps and promise yourself you will organize it later."

## Five-Minute Mental Model

If you are new to PROWL, these terms matter:

| Term | Meaning |
| --- | --- |
| **Engagement** | The project you are working on. It owns target context, notes, findings, command history, and workspace view |
| **Finding** | A structured discovery like a target, open port, service, file, URL, or AI-saved note |
| **Loot** | Files captured in the engagement workspace |
| **Mission Mode** | PROWL's opinion about what phase you are in: recon, web, windows, internal, exploit, and so on |
| **Timeline** | A chronological feed of commands, notes, findings, AI messages, and mission events |
| **Objective Card** | The "what matters right now" summary at the top of the AI panel |

## Terminal Keywords

These commands are intercepted by PROWL before they hit the shell:

| Command | What it does |
| --- | --- |
| `target <ip>` | Set the active target for the current engagement |
| `note <text>` | Save a note (appends to active notebook if one is open) |
| `notes add <text>` | Append to the active note or notebook |
| `note #<n> <text>` | Append to a specific note by index |
| `notebook <name>` | Open or reuse a notebook with that name |
| `notebook new <name>` | Create a fresh notebook |
| `notebook close` | Close the active notebook |
| `add last <tool>` | Send the last command output to AI for analysis |
| `ask <question>` | Ask AI directly |
| `commands <tool>` | Ask AI for a tool reference guide |
| `search <term>` | Search notes |
| `export notes` | Export notes to Markdown |
| `help` / `-help` | Open command help |
| `hack help` | Ask AI for methodology guidance |

## Buttons Worth Knowing

If you never read title bars and just click whatever looks suspicious, here is the cheat sheet:

- **Palette button** or `Ctrl/Cmd+K`: opens the command palette
- **Engagements button**: switch projects
- **Mission mode button**: pin or release the current mode
- **Split button**: turn one terminal into two
- **Loot button**: open the loot manager
- **Findings button**: open structured discoveries
- **Timeline button**: open the mission feed
- **Notebook button**: open notebook view
- **AI button**: open the assistant panel
- **Browser button**: open the embedded browser

## What The AI Can Do

The AI is not just a chat box anymore.

It can:

- respond to normal prompts
- react to target changes, discovered ports, services, browser scans, VPN state, container state, and new loot
- suggest commands before you ask
- create notes and save findings
- open browser or workflow surfaces
- follow the current mission mode

The intended experience is "operator copiloting," not "tab with opinions."

## Kali, Browser, VPN, and Loot

### Kali Container

With Docker or Podman available, PROWL can run a Kali environment inside the app.

That unlocks:

- Kali-backed terminal tabs
- mounted `/workspace` storage
- browser routing through a SOCKS proxy
- VPN workflows inside the tooling environment

The Kali image builds once and is reused for every session. You do not need to rebuild it each time you launch PROWL.

### Embedded Browser

The browser panel is there for actual recon, not moral support.

Use it to:

- browse target web apps inside the app
- scan a page and send extracted structure to AI
- keep browser and terminal side-by-side during web work

### VPN

Upload your `.ovpn` file in the VPN panel and connect with one click. VPN traffic runs inside the Kali container so your host network is unaffected.

### Loot Manager

The loot manager lets you:

- browse workspace files by engagement
- preview text files
- classify loot by type
- promote artifacts into findings
- save loot directly into notes

It also works off the host workspace path, which means your loot is still visible even if the Kali container is not currently running.

## For Developers

You do not need this section to use PROWL.
You do need it if you are about to open twelve files and say "I will just trace the flow real quick."

### Source Build Setup

This section is for contributors, local builders, and people intentionally working on the codebase.
It is **not** the recommended install path for regular users.

Requirements for source builds:

- **Node.js 18+**
- **npm**
- native build prerequisites for `node-pty`
- optionally **Docker** or **Podman** for the Kali container features

Source build flow:

```bash
git clone https://github.com/Larry-Orton/Prowl.git
cd Prowl
npm run setup
npm run electron:build
```

Important:

- Use `npm run setup`, not plain `npm install`, because PROWL rebuilds native Electron dependencies for Electron.
- If `node` or `npm` are "not found" right after install, close and reopen your terminal so PATH updates apply.

### Build A Packaged App

If you are building PROWL from source and want installers:

```bash
npm run electron:build
```

Artifacts are written to `release/`.

Current packaging targets:

- **Windows**: `nsis`, `portable`
- **macOS**: `dmg`, `zip` (coming soon)
- **Linux**: `AppImage`, `deb` (coming soon)

### Project Structure

```text
src/
  main/                 Electron main process
    index.ts            IPC handlers, workspace access, browser capture
    shellManager.ts     Local + Kali shell orchestration, keyword interception
    containerManager.ts Docker/Podman lifecycle, VPN, tool environment
    aiProxy.ts          AI proxying from the trusted side
    preload.ts          Renderer bridge

  renderer/             React app
    App.tsx             Main orchestration layer
    components/         Terminal, AI, notes, timeline, findings, loot, title bar
    hooks/              Engagement, AI, notes, commands, findings, proactive logic
    store/              Zustand state for session, terminals, mission mode, findings, etc.
    lib/                Mission mode and proactive hint logic

  db/
    client.ts           JSON persistence for engagements, notes, commands, findings, API key

  shared/
    types.ts            Shared interfaces
    constants.ts        Shared constants
    terminalKeywords.ts Terminal keyword parser (shared between main + renderer)

docker/
  Dockerfile            Kali image
  entrypoint.sh         Container startup behavior

scripts/
  setup.js              Electron/native dependency setup
```

Helpful commands:

```bash
npm run setup             # Install deps and rebuild native modules
npm run build             # Build main + renderer
npm run electron:build    # Build and package installers
npm run typecheck         # Type-check everything
```

## A Brief And Necessary Legal Vibe Check

Use PROWL on systems you own or are explicitly authorized to assess.

If you point it at something you should not be touching, that is not "research."
That is paperwork.

## Contributing

Ideas, issues, and pull requests are welcome.
If you want to improve the operator experience, AI workflows, container image, recon ergonomics, or mission management, you are very much in the right repo.

## License

MIT
