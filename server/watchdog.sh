#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Optional root-managed configuration; no credentials in this file.
if [ -f /etc/delphi/watchdog.env ]; then
    set -a
    source /etc/delphi/watchdog.env
    set +a
fi
exec /usr/bin/python3 "$SCRIPT_DIR/watchdog.py" --model "${DELPHI_WATCHDOG_MODEL:-codellama}" "$@"
