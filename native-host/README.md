# CINEM Pro local agent (native messaging host)

Chrome native messaging host for files, long jobs, and a keepalive so the
MV3 service worker stays awake during a job.

```bash
# After loading extension/ unpacked, copy its id from chrome://extensions
node native-host/install.mjs --extension-id=abcdefghijklmnopqrstuvwxyzabcdef

# Optional always-on poller (Electron uses this too)
node native-host/host.mjs --http
```

Listens on `127.0.0.1:43181` in `--http` mode. File writes are still gated by
the desk approval queue before `native_file_write` is sent.
