#!/usr/bin/env bash
set -e

# ────────────────────────────────────────────────────
#  PROWL — One-command installer for Linux / macOS
#  Usage: curl -fsSL https://raw.githubusercontent.com/Larry-Orton/Prowl/main/scripts/install.sh | bash
# ────────────────────────────────────────────────────

REPO="https://github.com/Larry-Orton/Prowl.git"
INSTALL_DIR="$HOME/prowl"
MIN_NODE=18

red()   { printf "\033[0;31m%s\033[0m\n" "$*"; }
green() { printf "\033[0;32m%s\033[0m\n" "$*"; }
dim()   { printf "\033[0;90m%s\033[0m\n" "$*"; }
bold()  { printf "\033[1m%s\033[0m\n" "$*"; }

bold "
  ╔═══════════════════════════════════════╗
  ║          PROWL  INSTALLER             ║
  ║   intelligent pentester terminal      ║
  ╚═══════════════════════════════════════╝
"

# ── Detect OS ───────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Linux*)  PLATFORM=linux ;;
  Darwin*) PLATFORM=mac ;;
  *)       red "Unsupported OS: $OS"; exit 1 ;;
esac
dim "Detected platform: $PLATFORM"

# ── Check / install git ─────────────────────────────
if ! command -v git &>/dev/null; then
  echo "Installing git..."
  if [ "$PLATFORM" = "linux" ]; then
    if command -v apt-get &>/dev/null; then
      sudo apt-get update -qq && sudo apt-get install -y -qq git
    elif command -v dnf &>/dev/null; then
      sudo dnf install -y git
    elif command -v pacman &>/dev/null; then
      sudo pacman -Sy --noconfirm git
    else
      red "Cannot auto-install git. Please install it manually."
      exit 1
    fi
  elif [ "$PLATFORM" = "mac" ]; then
    xcode-select --install 2>/dev/null || true
    echo "If prompted, install Xcode Command Line Tools, then re-run this script."
  fi
fi
green "✓ git"

# ── Check / install Node.js ─────────────────────────
install_node() {
  echo "Installing Node.js v$MIN_NODE..."
  if command -v nvm &>/dev/null; then
    nvm install $MIN_NODE && nvm use $MIN_NODE
  elif [ "$PLATFORM" = "mac" ] && command -v brew &>/dev/null; then
    brew install node@$MIN_NODE
  elif [ "$PLATFORM" = "linux" ]; then
    # NodeSource setup
    if command -v apt-get &>/dev/null; then
      curl -fsSL "https://deb.nodesource.com/setup_${MIN_NODE}.x" | sudo -E bash -
      sudo apt-get install -y -qq nodejs
    elif command -v dnf &>/dev/null; then
      curl -fsSL "https://rpm.nodesource.com/setup_${MIN_NODE}.x" | sudo bash -
      sudo dnf install -y nodejs
    else
      red "Cannot auto-install Node.js. Please install Node.js >= $MIN_NODE manually."
      exit 1
    fi
  else
    red "Cannot auto-install Node.js. Please install Node.js >= $MIN_NODE manually."
    exit 1
  fi
}

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt "$MIN_NODE" ]; then
    red "Node.js v$NODE_VER found but v$MIN_NODE+ required."
    install_node
  fi
else
  install_node
fi
green "✓ node $(node -v)"

# ── Check / install build tools (needed for node-pty) ─
if [ "$PLATFORM" = "linux" ]; then
  if ! command -v make &>/dev/null || ! command -v g++ &>/dev/null; then
    echo "Installing build tools (make, g++)..."
    if command -v apt-get &>/dev/null; then
      sudo apt-get install -y -qq build-essential python3
    elif command -v dnf &>/dev/null; then
      sudo dnf groupinstall -y "Development Tools"
      sudo dnf install -y python3
    elif command -v pacman &>/dev/null; then
      sudo pacman -Sy --noconfirm base-devel python
    fi
  fi
  green "✓ build tools"
elif [ "$PLATFORM" = "mac" ]; then
  # Xcode CLT should be enough
  if ! xcode-select -p &>/dev/null; then
    echo "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "After installation completes, re-run this script."
    exit 0
  fi
  green "✓ Xcode CLT"
fi

# ── Clone or update repo ────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing Prowl installation..."
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  echo "Cloning Prowl..."
  git clone "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
green "✓ source code"

# ── Run setup ───────────────────────────────────────
echo ""
bold "Running Prowl setup..."
npm run setup

# ── Build ───────────────────────────────────────────
echo ""
bold "Building Prowl..."
npm run build

# ── Create launcher shortcut ────────────────────────
LAUNCHER="$HOME/.local/bin/prowl"
if [ "$PLATFORM" = "linux" ]; then
  mkdir -p "$HOME/.local/bin"
  cat > "$LAUNCHER" << 'SCRIPT'
#!/usr/bin/env bash
cd "$HOME/prowl" && npx electron . "$@"
SCRIPT
  chmod +x "$LAUNCHER"
  green "✓ launcher: $LAUNCHER"
  dim "  (make sure ~/.local/bin is in your PATH)"
elif [ "$PLATFORM" = "mac" ]; then
  mkdir -p "$HOME/.local/bin"
  cat > "$LAUNCHER" << 'SCRIPT'
#!/usr/bin/env bash
cd "$HOME/prowl" && npx electron . "$@"
SCRIPT
  chmod +x "$LAUNCHER"
  green "✓ launcher: $LAUNCHER"
fi

echo ""
green "═══════════════════════════════════════"
green "  PROWL installed successfully!"
green "═══════════════════════════════════════"
echo ""
echo "  To start Prowl:"
echo "    cd $INSTALL_DIR && npm run electron:dev"
echo ""
echo "  Or build a packaged app:"
echo "    cd $INSTALL_DIR && npm run electron:build"
echo ""
