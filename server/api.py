#!/usr/bin/env python3
"""DELPHI JSON storage API. Python standard library only; bind to loopback."""
import argparse
import hmac
import json
import os
from pathlib import Path
import re
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

MAX_BODY = 8 * 1024 * 1024
PROJECTS = ('DELPHI', 'Brionicle', 'sysdash', 'brionize-ai-framework')
LOCK = threading.Lock()
ID = re.compile(r"[A-Za-z0-9_-]{1,100}\Z")


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=".tmp-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(value, f, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def validate_chat(value):
    if not isinstance(value, dict) or not isinstance(value.get('id'), str) or not ID.fullmatch(value['id']) or value['id'] in ('__proto__', 'constructor', 'prototype', 'list', 'deleted'):
        raise ValueError("Ongeldig gesprek-id")
    if not isinstance(value.get("title"), str) or len(value["title"]) > 200:
        raise ValueError("Ongeldige titel")
    messages = value.get("messages")
    if not isinstance(messages, list) or len(messages) > 10000:
        raise ValueError("Ongeldige berichten")
    for m in messages:
        if not isinstance(m, dict) or m.get("role") not in ("user", "assistant", "system") or not isinstance(m.get("content"), str):
            raise ValueError("Ongeldig bericht")
    for key in ("created", "updated"):
        if type(value.get(key)) not in (int, float) or not 0 <= value[key] < 1e16:
            raise ValueError("Ongeldige tijd")
    for key in ("project", "preset", "provider", "model"):
        if not isinstance(value.get(key, ""), str) or len(value.get(key, "")) > 300:
            raise ValueError("Ongeldige context")
    return value


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.handle_api()

    def do_POST(self):
        self.handle_api()

    def do_DELETE(self):
        self.handle_api()

    def handle_api(self):
        if not hmac.compare_digest(self.headers.get("X-API-Key", "").encode(), self.server.api_key.encode()):
            return self.reply(401, {"error": "Ongeautoriseerd"})
        route = unquote(urlsplit(self.path).path).rstrip("/")
        chats = self.server.data_dir / "chats"
        try:
            with LOCK:
                if route == '/api/inspections' and self.command == 'GET':
                    reports = []
                    for project in PROJECTS:
                        file = self.server.data_dir / 'watchdog' / 'inspections' / project / 'latest.json'
                        if file.exists():
                            reports.append(json.loads(file.read_text()))
                        else:
                            reports.append({'project': project, 'status': 'not-scanned', 'fixes': [], 'findings': []})
                    return self.reply(200, reports)
                if route.startswith('/api/inspections/'):
                    project = route.removeprefix('/api/inspections/')
                    if project not in PROJECTS:
                        return self.reply(400, {'error': 'Onbekend project'})
                    file = self.server.data_dir / 'watchdog' / 'inspections' / project / 'latest.json'
                    if not file.exists():
                        return self.reply(404, {'error': 'Nog geen inspectie'})
                    report = json.loads(file.read_text())
                    if self.command == 'GET':
                        return self.reply(200, report)
                    if self.command == 'POST':
                        length = int(self.headers.get('Content-Length', '0'))
                        if not 0 < length < 4096:
                            return self.reply(413, {'error': 'Te grote invoer'})
                        value = json.loads(self.rfile.read(length))
                        if not isinstance(value, dict) or value.get('status') not in ('merged', 'ignored') or not report.get('head') or value.get('head') != report['head']:
                            return self.reply(409, {'error': 'Inspectie gewijzigd; ververs eerst'})
                        report['status'] = value['status']
                        atomic_json(file, report)
                        return self.reply(200, report)
                if route == "/api/history/list" and self.command == "GET":
                    values = []
                    for file in chats.glob("*.json"):
                        if file.is_symlink():
                            continue
                        try:
                            c = validate_chat(json.loads(file.read_text()))
                            values.append({k: c.get(k, "") for k in ("id", "title", "created", "updated", "project", "preset")})
                        except (ValueError, OSError):
                            continue
                    return self.reply(200, sorted(values, key=lambda c: c["updated"], reverse=True))
                if route == '/api/history/deleted' and self.command == 'GET':
                    tombstones = chats / '.deleted.json'
                    return self.reply(200, json.loads(tombstones.read_text()) if tombstones.exists() else [])
                if route == "/api/history" and self.command == "POST":
                    length = int(self.headers.get("Content-Length", "0"))
                    if not 0 < length <= MAX_BODY:
                        return self.reply(413, {"error": "Gesprek te groot of leeg"})
                    self.connection.settimeout(15)
                    value = validate_chat(json.loads(self.rfile.read(length)))
                    tombstones = chats / '.deleted.json'
                    if tombstones.exists() and value['id'] in json.loads(tombstones.read_text()):
                        return self.reply(409, {'error': 'Gesprek is verwijderd; begin een nieuw gesprek'})
                    file = chats / (value["id"] + ".json")
                    if file.is_symlink():
                        return self.reply(400, {"error": "Ongeldig bestand"})
                    if file.exists():
                        old = json.loads(file.read_text())
                        if old.get("updated", 0) > value["updated"]:
                            return self.reply(409, {"error": "Server heeft een nieuwer gesprek; ververs eerst"})
                    atomic_json(file, value)
                    return self.reply(200, {"id": value["id"]})
                if route.startswith("/api/history/"):
                    cid = route.removeprefix("/api/history/")
                    if not ID.fullmatch(cid):
                        return self.reply(400, {"error": "Ongeldig gesprek-id"})
                    file = chats / (cid + ".json")
                    if file.is_symlink():
                        return self.reply(400, {"error": "Ongeldig bestand"})
                    if self.command == "GET":
                        if not file.exists():
                            return self.reply(404, {"error": "Gesprek niet gevonden"})
                        return self.reply(200, validate_chat(json.loads(file.read_text())))
                    if self.command == "DELETE":
                        tombstones = chats / '.deleted.json'
                        deleted = set(json.loads(tombstones.read_text()) if tombstones.exists() else [])
                        deleted.add(cid)
                        atomic_json(tombstones, sorted(deleted))
                        file.unlink(missing_ok=True)
                        return self.reply(200, {"deleted": cid})
                return self.reply(404, {"error": "Route niet gevonden"})
        except (ValueError, UnicodeError):
            return self.reply(400, {"error": "Ongeldige JSON of invoer"})
        except OSError:
            return self.reply(500, {"error": "Opslag niet beschikbaar"})

    def log_message(self, fmt, *args):
        # Never log credentials or chat bodies.
        print("DELPHI API: %s" % fmt % args, flush=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=3001)
    p.add_argument("--data", default="/data")
    p.add_argument("--key-file", default="/etc/delphi/api-key")
    args = p.parse_args()
    key = Path(args.key_file).read_text().strip()
    if not key:
        raise SystemExit("API key ontbreekt")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.api_key = key
    server.data_dir = Path(args.data)
    (server.data_dir / "chats").mkdir(parents=True, exist_ok=True)
    print('DELPHI API listening on ' + str(server.server_port), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
