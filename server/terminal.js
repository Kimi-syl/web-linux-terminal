/**
 * Terminal Manager
 * Tries node-pty first, falls back to child_process + script for PTY emulation
 */

let pty = null;
let usePtyModule = false;

try {
  pty = require('node-pty');
  usePtyModule = true;
  console.log('✅ Using node-pty (native PTY)');
} catch {
  try {
    pty = require('node-pty-prebuilt-multiarch');
    usePtyModule = true;
    console.log('✅ Using node-pty-prebuilt-multiarch');
  } catch {
    console.log('ℹ️  node-pty not available — using script(1) fallback');
    usePtyModule = false;
  }
}

// ── node-pty based implementation ────────────────────────
function createWithPty(cols, rows, shell) {
  const defaultShell = shell || process.env.SHELL || '/bin/bash';
  const term = pty.spawn(defaultShell, ['--login'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: process.env.HOME || '/root',
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      HOME: process.env.HOME || '/root',
      USER: process.env.USER || 'root',
      SHELL: defaultShell,
      PATH: [
        '/usr/local/cargo/bin',
        '/usr/local/go/bin',
        '/root/.cargo/bin',
        '/root/.local/bin',
        process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      ].join(':'),
    },
  });
  return {
    write: (data) => term.write(data),
    resize: (c, r) => term.resize(c, r),
    kill: () => { try { term.kill(); } catch {} },
    onData: (cb) => term.onData(cb),
    onExit: (cb) => term.onExit(({ exitCode }) => cb(exitCode)),
    _destroyed: false,
  };
}

// ── child_process + script fallback ──────────────────────
const { spawn } = require('child_process');

function createWithSpawn(cols, rows, shell) {
  const defaultShell = shell || process.env.SHELL || '/bin/bash';
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    HOME: process.env.HOME || '/root',
    USER: process.env.USER || 'root',
    SHELL: defaultShell,
    COLUMNS: String(cols || 80),
    LINES: String(rows || 24),
    PATH: [
      '/usr/local/cargo/bin',
      '/usr/local/go/bin',
      '/root/.cargo/bin',
      '/root/.local/bin',
      process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    ].join(':'),
  };

  // Use 'script' command to get a pseudo-terminal
  // -q: quiet, -f: flush, -c: command
  const child = spawn('script', ['-qfc', `${defaultShell} --login`, '/dev/null'], {
    env,
    cols: cols || 80,
    rows: rows || 24,
    cwd: env.HOME,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Resizer via escape sequences
  const resizer = { currentCols: cols || 80, currentRows: rows || 24 };

  const wrapper = {
    write: (data) => {
      try { child.stdin.write(data); } catch {}
    },
    resize: (c, r) => {
      resizer.currentCols = c;
      resizer.currentRows = r;
      try {
        // Send SIGWINCH to trigger resize
        child.kill('SIGWINCH');
      } catch {}
    },
    kill: () => {
      wrapper._destroyed = true;
      try { child.kill('SIGKILL'); } catch {}
    },
    onData: (cb) => {
      child.stdout.on('data', (chunk) => cb(chunk.toString('utf8')));
      child.stderr.on('data', (chunk) => cb(chunk.toString('utf8')));
    },
    onExit: (cb) => {
      child.on('exit', (code) => {
        wrapper._destroyed = true;
        cb(code || 0);
      });
      child.on('error', () => {
        wrapper._destroyed = true;
        cb(1);
      });
    },
    _destroyed: false,
  };

  return wrapper;
}

// ── Public API ───────────────────────────────────────────
function createTerminal(cols, rows, shell) {
  if (usePtyModule) {
    return createWithPty(cols, rows, shell);
  }
  return createWithSpawn(cols, rows, shell);
}

function destroyTerminal(term) {
  if (term && !term._destroyed) {
    term.kill();
  }
}

function resizeTerminal(term, cols, rows) {
  if (term && !term._destroyed) {
    term.resize(cols, rows);
  }
}

module.exports = { createTerminal, destroyTerminal, resizeTerminal };
