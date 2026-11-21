"""Loopback-only, allowlisted preview of the generated static public site."""
from __future__ import annotations

import argparse
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

CSP = "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"


def load_candidate(candidate: Path) -> dict:
    manifest = json.loads((candidate / "manifest.json").read_text(encoding="utf-8"))
    for name, expected in manifest["files"].items():
        path = (candidate / "site" / name).resolve()
        if not path.is_relative_to((candidate / "site").resolve()) or path.is_symlink():
            raise ValueError("Unsafe asset path")
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected["sha256"]:
            raise ValueError("Candidate bytes differ from manifest")
    return manifest


class Handler(BaseHTTPRequestHandler):
    server_version = "MasarifiPublicPreview"
    sys_version = ""

    def __init__(self, *args, candidate: Path, manifest: dict, **kwargs):
        self.candidate, self.manifest = candidate, manifest
        super().__init__(*args, **kwargs)

    def do_GET(self):
        self.respond(False)

    def do_HEAD(self):
        self.respond(True)

    def do_POST(self):
        self.send_error(405, "Read-only public resource")

    do_PUT = do_POST
    do_DELETE = do_POST
    do_PATCH = do_POST

    def respond(self, head: bool):
        url = urlsplit(self.path)
        assets = self.manifest["stylesheets"].values()
        if url.scheme or url.netloc or url.fragment:
            self.send_error(404)
            return
        if url.path in ["/" + route for route in self.manifest["routes"]]:
            language = "en" if url.query == "lang=en" else "ar"
            name = url.path[1:] + "." + language + ".html"
            kind, cache = "text/html; charset=utf-8", "public, max-age=300"
        elif url.path[1:] in assets and not url.query:
            name = url.path[1:]
            kind, cache = "text/css; charset=utf-8", "public, max-age=31536000, immutable"
        else:
            self.send_error(404)
            return
        data = (self.candidate / "site" / name).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", cache)
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def log_message(self, format, *args):
        pass  # Do not retain URL query strings or other request metadata.


def server(candidate: Path, port: int = 0) -> ThreadingHTTPServer:
    manifest = load_candidate(candidate)
    return ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, candidate=candidate, manifest=manifest))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--port", type=int, default=4192)
    args = parser.parse_args()
    with server(args.candidate.resolve(), args.port) as http:
        print("Preview: http://127.0.0.1:" + str(http.server_port) + "/privacy", flush=True)
        http.serve_forever()
