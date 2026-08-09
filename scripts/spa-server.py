import http.server, socketserver, os, posixpath
os.chdir('/home/user/Ruflo/dist')
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        p = self.translate_path(self.path.split('?')[0])
        if not os.path.exists(p) and '.' not in posixpath.basename(p):
            self.path = '/index.html'
        return super().do_GET()
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
socketserver.TCPServer(("", 8744), H).serve_forever()
