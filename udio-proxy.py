#!/usr/bin/env python3
"""
Simple HTTP proxy server for Udio captcha solving
This bypasses the ngrok TCP tunnel requirement
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import threading
import time

class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"Udio Proxy Server Running")
    
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        # For now, just echo back to verify it's working
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(post_data)
    
    def log_message(self, format, *args):
        # Suppress logs
        pass

def run_server(port=8888):
    server = HTTPServer(('localhost', port), ProxyHandler)
    print(f"Proxy server running on http://localhost:{port}")
    server.serve_forever()

if __name__ == "__main__":
    run_server()