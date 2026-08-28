#!/usr/bin/env python3
"""Local CORS proxy so Expo web can call official NHL endpoints."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

SEARCH = "https://search.d3.nhle.com/api/v1/search/player"
NHL = "https://api-web.nhle.com"
PORT = 8094


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send(204, b"")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/search/player":
            target = f"{SEARCH}?{parsed.query}" if parsed.query else SEARCH
        elif parsed.path.startswith("/nhl/"):
            target = f"{NHL}/{parsed.path[len('/nhl/'):]}"
            if parsed.query:
                target = f"{target}?{parsed.query}"
        else:
            self._send(404, b'{"error":"not found"}')
            return
        try:
            req = Request(target, headers={"User-Agent": "PuckIQ-local-proxy"})
            with urlopen(req, timeout=12) as res:
                self._send(res.status, res.read(), res.headers.get("Content-Type", "application/json"))
        except HTTPError as err:
            self._send(err.code, err.read() or b'{"error":"upstream"}')
        except Exception as exc:
            self._send(502, f'{{"error":"{exc}"}}'.encode())

    def log_message(self, fmt: str, *args) -> None:
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
