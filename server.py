import http.server
import socketserver
import threading
import time
import webbrowser
import mimetypes
import os

# Override Windows registry MIME types that browsers reject
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/jpeg", ".jpg")
mimetypes.add_type("image/jpeg", ".jpeg")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("image/gif", ".gif")

PORT = 8080
HEARTBEAT_TIMEOUT = 5   # seconds without a heartbeat before shutdown
STARTUP_GRACE = 10      # seconds to wait before monitoring starts (browser load time)

last_heartbeat = [time.time()]
HEARTBEAT_SCRIPT = (
    b'<script>'
    b'setInterval(function(){fetch("/heartbeat").catch(function(){})},2000);'
    b'</script>'
)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/heartbeat":
            last_heartbeat[0] = time.time()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
            return

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")

        if path.endswith(".html") and os.path.isfile(path):
            with open(path, "rb") as f:
                content = f.read()
            lower = content.lower()
            injected = False
            for tag in [b"</body>", b"</html>"]:
                idx = lower.rfind(tag)
                if idx != -1:
                    content = content[:idx] + HEARTBEAT_SCRIPT + content[idx:]
                    injected = True
                    break
            if not injected:
                content += HEARTBEAT_SCRIPT
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        super().do_GET()

    def log_message(self, fmt, *args):
        pass  # suppress request logs


def monitor(httpd):
    time.sleep(STARTUP_GRACE)
    while True:
        time.sleep(2)
        if time.time() - last_heartbeat[0] > HEARTBEAT_TIMEOUT:
            print("Browser closed. Stopping server...")
            httpd.shutdown()
            print("Server stopped.")
            return


class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


with ThreadingServer(("", PORT), Handler) as httpd:
    monitor_thread = threading.Thread(target=monitor, args=(httpd,), daemon=True)
    monitor_thread.start()

    url = f"http://localhost:{PORT}"
    print(f"Server running at {url}")
    print("Opening browser... (server stops when you close the page)")
    threading.Timer(0.8, webbrowser.open, args=(url,)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("Interrupted.")

print("Server stopped.")
