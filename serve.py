#!/usr/bin/env python3
"""
Serve the site with custom 404 page. Usage (from this directory):

  python3 serve.py [port]
  python3 serve.py [port] [docroot]
  python3 serve.py [docroot]

e.g. python3 serve.py 8000  →  http://localhost:8000
"""

import os
import shutil
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


CLIENT_DISCONNECT_ERRORS = (
    BrokenPipeError,
    ConnectionAbortedError,
    ConnectionResetError,
)


class Handler(SimpleHTTPRequestHandler):
    def handle_one_request(self):
        try:
            super().handle_one_request()
        except CLIENT_DISCONNECT_ERRORS:
            self.close_connection = True

    def send_error(self, code, message=None):
        if code == 404 and os.path.isfile("404.html"):
            self.error_message_format = ""
            try:
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                with open("404.html", "rb") as f:
                    self.wfile.write(f.read())
            except CLIENT_DISCONNECT_ERRORS:
                self.close_connection = True
        else:
            super().send_error(code, message)

    def copyfile(self, source, outputfile):
        try:
            shutil.copyfileobj(source, outputfile)
        except CLIENT_DISCONNECT_ERRORS:
            self.close_connection = True


class Server(ThreadingHTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    args = sys.argv[1:]
    port = 8000
    docroot = os.path.dirname(os.path.abspath(__file__))

    if args:
        if args[0].isdigit():
            port = int(args[0])
            if len(args) > 1:
                docroot = os.path.abspath(args[1])
        else:
            docroot = os.path.abspath(args[0])
            if len(args) > 1 and args[1].isdigit():
                port = int(args[1])

    os.chdir(docroot)
    server = Server(("", port), Handler)
    print("Serving {} at http://localhost:{}/ (404 -> 404.html)".format(docroot, port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
