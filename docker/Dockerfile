# ════════════════════════════════════════════════
#  PROWL Kali — lean pentesting container
#  Tools only, no desktop/GUI bloat
# ════════════════════════════════════════════════
FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive
ENV TERM=xterm-256color

# Base system + core utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    vim \
    nano \
    tmux \
    zsh \
    net-tools \
    iputils-ping \
    dnsutils \
    iproute2 \
    procps \
    jq \
    unzip \
    python3 \
    python3-pip \
    python3-venv \
    openssh-client \
    locales \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8

# ── Networking / VPN ────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    openvpn \
    wireguard-tools \
    proxychains4 \
    microsocks \
    socat \
    ncat \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# ── Reconnaissance ──────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    masscan \
    enum4linux \
    dnsrecon \
    dnsenum \
    whois \
    theharvester \
    amass \
    subfinder \
    httpx-toolkit \
    && rm -rf /var/lib/apt/lists/*

# ── Web Testing ─────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    gobuster \
    feroxbuster \
    dirb \
    nikto \
    sqlmap \
    wfuzz \
    whatweb \
    wafw00f \
    && rm -rf /var/lib/apt/lists/*

# ── Exploitation ────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    metasploit-framework \
    exploitdb \
    && rm -rf /var/lib/apt/lists/*

# ── Password Attacks ────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    hydra \
    john \
    hashcat \
    wordlists \
    seclists \
    crunch \
    cewl \
    && rm -rf /var/lib/apt/lists/*

# ── Post-Exploitation ──────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    evil-winrm \
    impacket-scripts \
    crackmapexec \
    chisel \
    ligolo-ng \
    && rm -rf /var/lib/apt/lists/*

# ── Wordlists setup ────────────────────────────
RUN gunzip /usr/share/wordlists/rockyou.txt.gz 2>/dev/null || true
# Symlink common paths so standard tutorials/commands work out of the box
RUN ln -sf /usr/share/seclists/Discovery/Web-Content /usr/share/wordlists/dirbuster \
    && ln -sf /usr/share/seclists /usr/share/wordlists/seclists

# ── SOCKS proxy for PROWL embedded browser ─────
# microsocks listens on port 1080 for browser traffic
EXPOSE 1080

# ── Workspace mount point ──────────────────────
RUN mkdir -p /workspace /vpn
WORKDIR /workspace

# ── Entrypoint ─────────────────────────────────
# Start SOCKS proxy in background, then drop to shell
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash"]
