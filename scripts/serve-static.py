#!/usr/bin/env python3
"""Serve the public dist for repeatable browser checks without stale page caches."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=4398)
args = parser.parse_args()
if not 1 <= args.port <= 65535:
    parser.error('port must be between 1 and 65535')
public = Path(__file__).resolve().parents[1] / 'dist'

class PublicHandler(SimpleHTTPRequestHandler):
    def __init__(self, *handler_args, **handler_kwargs):
        super().__init__(*handler_args, directory=str(public), **handler_kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *_):
        pass

with ThreadingHTTPServer(('127.0.0.1', args.port), PublicHandler) as server:
    print(f'Static reading preview: http://127.0.0.1:{args.port} (dist, no-store)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
