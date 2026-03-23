/**
 * Web Linux Terminal - Main Server
 * Real PTY terminal over WebSocket with multi-session support
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { createTerminal, destroyTerminal, resizeTerminal } = require('./terminal');

const app = express();
const server = http.createServer(app);

// ── Adaptive port ──────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ── Socket.IO with WebSocket transport ─────────────────────
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 10e6,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Static files ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Session map ────────────────────────────────────────────
const sessions = new Map(); // socketId -> { term, sessionId }

// ── File upload endpoint ───────────────────────────────────
const upload = multer({
  dest: '/tmp/webterm-uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const target = req.body.path || `/tmp/${req.file.originalname}`;
  const fs = require('fs');
  try {
    fs.copyFileSync(req.file.path, target);
    fs.unlinkSync(req.file.path);
    res.json({ ok: true, path: target, size: req.file.size });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── System info endpoint ───────────────────────────────────
app.get('/api/sysinfo', async (req, res) => {
  const { execSync } = require('child_process');
  const run = (cmd) => {
    try { return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim(); }
    catch { return 'N/A'; }
  };
  res.json({
    hostname: run('hostname'),
    os: run('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'') || run('uname -s'),
    kernel: run('uname -r'),
    arch: run('uname -m'),
    cpu: run("grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs") || run('uname -m'),
    cores: run('nproc'),
    memory: run("free -h 2>/dev/null | awk '/Mem:/{print $2}'") || 'N/A',
    uptime: run('uptime -p 2>/dev/null || uptime'),
    shell: run('echo $SHELL'),
    gcc: run('gcc --version 2>/dev/null | head -1'),
    gpp: run('g++ --version 2>/dev/null | head -1'),
    rustc: run('rustc --version 2>/dev/null'),
    cargo: run('cargo --version 2>/dev/null'),
    python: run('python3 --version 2>/dev/null'),
    node: run('node --version'),
    npm: run('npm --version'),
    go: run('go version 2>/dev/null'),
    java: run('java --version 2>/dev/null | head -1'),
    git: run('git --version 2>/dev/null'),
  });
});

// ── Download file endpoint ─────────────────────────────────
app.get('/api/download', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).send('Missing path');
  const fs = require('fs');
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
  res.download(filePath);
});

// ── WebSocket terminal ─────────────────────────────────────
io.on('connection', (socket) => {
  const sessionId = uuidv4();
  console.log(`[+] Session ${sessionId} connected from ${socket.handshake.address}`);

  socket.on('start', (opts = {}) => {
    // Destroy previous terminal if any
    const existing = sessions.get(socket.id);
    if (existing) {
      try { destroyTerminal(existing.term); } catch {}
    }

    const cols = opts.cols || 80;
    const rows = opts.rows || 24;
    const shell = opts.shell || process.env.SHELL || '/bin/bash';

    const term = createTerminal(cols, rows, shell);

    term.onData((data) => {
      socket.emit('output', data);
    });

    term.onExit(({ exitCode }) => {
      socket.emit('exit', exitCode);
      sessions.delete(socket.id);
    });

    sessions.set(socket.id, { term, sessionId });

    // Send welcome
    socket.emit('session', { sessionId, cols, rows });
  });

  socket.on('input', (data) => {
    const s = sessions.get(socket.id);
    if (s) {
      try { s.term.write(data); } catch {}
    }
  });

  socket.on('resize', ({ cols, rows }) => {
    const s = sessions.get(socket.id);
    if (s) {
      try { resizeTerminal(s.term, cols, rows); } catch {}
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Session ${sessionId} disconnected`);
    const s = sessions.get(socket.id);
    if (s) {
      try { destroyTerminal(s.term); } catch {}
      sessions.delete(socket.id);
    }
  });
});

// ── Start ──────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log(`\n🖥️  Web Linux Terminal running at http://${HOST}:${PORT}`);
  console.log(`   Session isolated • PTY enabled • Full sudo\n`);
});
