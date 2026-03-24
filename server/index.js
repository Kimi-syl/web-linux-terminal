/**
 * Web Linux Terminal - Main Server
 * Real PTY terminal over WebSocket with multi-session support
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { Server } = require('socket.io');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { createTerminal, destroyTerminal, resizeTerminal } = require('./terminal');

const app = express();
const server = http.createServer(app);

// ── Adaptive port ──────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ── Socket.IO — polling transport (works behind proxies like Replit/Railway) ──
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 10e6,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],
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

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many upload requests, please try again later.' },
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many download requests, please try again later.',
});

app.post('/api/upload', uploadLimiter, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  // Sanitize filename: strip any path components to prevent traversal
  const safeName = path.basename(req.file.originalname);
  // Only allow a target path inside /tmp to prevent arbitrary file writes.
  // Resolve the path to prevent traversal via '..' segments or symlinks.
  const bodyPath = (req.body && typeof req.body.path === 'string') ? req.body.path.trim() : null;
  const requestedPath = bodyPath ? path.resolve(bodyPath) : null;
  const target = (requestedPath && requestedPath.startsWith('/tmp/'))
    ? requestedPath
    : `/tmp/${safeName}`;
  try {
    // Ensure the parent directory resolves within /tmp (catches symlink attacks)
    const realParent = fs.realpathSync(path.dirname(target));
    if (realParent !== '/tmp' && !realParent.startsWith('/tmp/')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // Reject if target already exists and is a symlink to avoid symlink overwrite
    try {
      const targetStat = fs.lstatSync(target);
      if (targetStat.isSymbolicLink()) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } catch (statErr) {
      if (statErr.code !== 'ENOENT') {
        throw statErr;
      }
      // ENOENT: target does not exist yet, safe to proceed
    }
    // Move the uploaded temp file into place without following symlinks
    fs.renameSync(req.file.path, target);
    res.json({ ok: true, path: target, size: req.file.size });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── System info endpoint ───────────────────────────────────
app.get('/api/sysinfo', async (req, res) => {
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
app.get('/api/download', downloadLimiter, (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).send('Missing path');
  // Resolve to an absolute path and restrict to /tmp to prevent arbitrary reads
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith('/tmp/')) return res.status(403).send('Access denied');
  if (!fs.existsSync(resolved)) return res.status(404).send('File not found');
  // Resolve symlinks to prevent symlink-based traversal out of /tmp
  try {
    const real = fs.realpathSync(resolved);
    if (!real.startsWith('/tmp/')) return res.status(403).send('Access denied');
    res.download(real);
  } catch {
    res.status(404).send('File not found');
  }
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
