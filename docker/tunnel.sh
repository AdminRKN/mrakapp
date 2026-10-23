#!/bin/sh
# Public https address for the shop from localhost.run → /run/tunnel/url, which the app follows (bot button, links).
# The free address changes on every reconnect; the loop reconnects forever.
# TUNNEL_PROXY (host:port of an HTTP proxy, the VPN's): localhost.run puts the connecting IP into every response
# (x-backend-addr), so through the VPN visitors see its IP instead of the home one. Empty = connect directly.
rm -f /run/tunnel/url
while true; do
  if [ -n "$TUNNEL_PROXY" ]; then set -- -o "ProxyCommand=nc -X connect -x $TUNNEL_PROXY %h %p"; else set --; fi
  ssh -T "$@" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ServerAliveInterval=20 -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes -o ConnectTimeout=15 -R 80:app:8080 nokey@localhost.run 2>&1 |
    while IFS= read -r line; do
      case "$line" in *'connection id is'*) echo "$line" ;; esac
      url=$(printf '%s' "$line" | grep -o 'https://[a-z0-9]*\.lhr\.life' | head -n 1)
      if [ -n "$url" ]; then
        printf '%s\n' "$url" > /run/tunnel/url.tmp && mv /run/tunnel/url.tmp /run/tunnel/url && echo "public url: $url"
      fi
    done
  echo "tunnel dropped, reconnecting in 5 s${TUNNEL_PROXY:+ (via $TUNNEL_PROXY — is the VPN on?)}"
  sleep 5
done
