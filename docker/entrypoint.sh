#!/bin/bash
# PROWL Kali container entrypoint
# Starts SOCKS proxy for embedded browser, then drops to shell

# Start microsocks SOCKS5 proxy on port 1080 (for PROWL browser routing)
microsocks -p 1080 &>/dev/null &

# If a VPN config is mounted and PROWL_VPN_AUTO is set, connect automatically
if [ -n "$PROWL_VPN_FILE" ] && [ -f "/vpn/$PROWL_VPN_FILE" ]; then
    echo "[prowl] Auto-connecting VPN: $PROWL_VPN_FILE"
    openvpn --config "/vpn/$PROWL_VPN_FILE" --daemon --log /tmp/vpn.log
    sleep 2
    if ip link show tun0 &>/dev/null; then
        echo "[prowl] VPN connected (tun0 up)"
    else
        echo "[prowl] VPN connecting... check /tmp/vpn.log"
    fi
fi

exec "$@"
