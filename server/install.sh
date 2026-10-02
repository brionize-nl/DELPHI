#!/bin/bash
# Called by setup.sh after the Caddy configuration has been validated.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
command -v python3 >/dev/null || { apt-get update; apt-get install -y python3; }
id delphi >/dev/null 2>&1 || useradd --system --home /data --shell /usr/sbin/nologin delphi
install -d -m 755 /opt/delphi/server
install -d -o delphi -g delphi -m 700 /data/chats /data/watchdog
install -d -o root -g delphi -m 750 /etc/delphi
install -o root -g delphi -m 640 /etc/caddy/ollama-api-key /etc/delphi/api-key
install -m 755 "$SCRIPT_DIR/api.py" /opt/delphi/server/api.py
install -m 755 "$SCRIPT_DIR/watchdog.py" "$SCRIPT_DIR/watchdog.sh" "$SCRIPT_DIR/git-askpass.sh" /opt/delphi/server/
install -m 644 "$SCRIPT_DIR/delphi-api.service" /etc/systemd/system/delphi-api.service
if [ -f /etc/caddy/github-api-key ]; then
    # Node is a syntax checker for watchdog candidates, never the app server.
    if ! command -v node >/dev/null || ! command -v git >/dev/null || ! command -v cron >/dev/null; then
        apt-get update
        apt-get install -y nodejs git cron
    fi
    install -o root -g delphi -m 640 /etc/caddy/github-api-key /etc/delphi/github-key
    if [ ! -f /etc/delphi/watchdog.env ]; then
        # Prefer an installed coding model; avoid downloading gigabytes implicitly.
        WATCHDOG_MODEL=$(python3 - <<'PY'
import json, urllib.request
try:
    with urllib.request.urlopen('http://127.0.0.1:11434/api/tags', timeout=10) as response:
        names = [m['name'] for m in json.load(response).get('models', [])]
    print(next((n for prefix in ('codellama', 'qwen2.5-coder', 'llama3.1', 'llama3.2') for n in names if n.startswith(prefix)), names[0] if names else 'codellama'))
except (OSError, ValueError):
    print('codellama')
PY
)
        printf 'DELPHI_WATCHDOG_MODEL=%s\n' "$WATCHDOG_MODEL" > /etc/delphi/watchdog.env
        chown root:delphi /etc/delphi/watchdog.env
        chmod 640 /etc/delphi/watchdog.env
    fi
    printf '%s\n' 'SHELL=/bin/bash' 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' '0 */4 * * * delphi /opt/delphi/server/watchdog.sh >> /data/watchdog/watchdog.log 2>&1' > /etc/cron.d/delphi-watchdog
    chmod 644 /etc/cron.d/delphi-watchdog
    systemctl enable --now cron
    echo 'Watchdog ingesteld: elke vier uur. Controleer of het gekozen Ollama-model aanwezig is.'
else
    rm -f /etc/cron.d/delphi-watchdog
    echo 'Watchdog nog niet geactiveerd: /etc/caddy/github-api-key ontbreekt.'
fi
systemctl daemon-reload
systemctl enable delphi-api
systemctl restart delphi-api
