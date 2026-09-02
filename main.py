"""
Minimal static file server for the VITERA frontend.

This is plain HTML/CSS/JS -- no build step, no framework -- so all this
needs to do is serve the files and let the browser's fetch() calls talk
directly to the FastAPI backend (which already has CORS wide open).

Run:
    python main.py
Then open:
    http://127.0.0.1:5500
"""
import http.server
import socketserver
import os

PORT = 5500
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)


if __name__ == "__main__":
    with socketserver.TCPServer(("192.168.1.171", PORT), Handler) as httpd:
        print(f"VITERA frontend running at 192.168.1.171:{PORT}")
        httpd.serve_forever()