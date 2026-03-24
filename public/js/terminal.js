/**
 * Terminal Client - xterm.js + Socket.IO
 */

const TERM_FONT_SIZE_MIN = 10;
const TERM_FONT_SIZE_MAX = 32;
const TERM_FONT_SIZE_DEFAULT = 16;

let term = null;
let fitAddon = null;
let socket = null;
let isConnected = false;
let resizeHandler = null;

// ── Theme-aware palette ──────────────────────────────────
function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return isDark ? {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    selectionBackground: '#264f78',
    selectionForeground: '#c9d1d9',
    black:   '#0d1117',
    red:     '#f85149',
    green:   '#3fb950',
    yellow:  '#d29922',
    blue:    '#58a6ff',
    magenta: '#bc8cff',
    cyan:    '#39d353',
    white:   '#c9d1d9',
    brightBlack:   '#484f58',
    brightRed:     '#ff7b72',
    brightGreen:   '#56d364',
    brightYellow:  '#e3b341',
    brightBlue:    '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan:    '#56d4dd',
    brightWhite:   '#f0f6fc',
  } : {
    background: '#fafbfc',
    foreground: '#24292f',
    cursor: '#0969da',
    cursorAccent: '#ffffff',
    selectionBackground: '#add6ff',
    selectionForeground: '#24292f',
    black:   '#24292f',
    red:     '#cf222e',
    green:   '#1a7f37',
    yellow:  '#9a6700',
    blue:    '#0969da',
    magenta: '#8250df',
    cyan:    '#1b7c83',
    white:   '#6e7781',
    brightBlack:   '#57606a',
    brightRed:     '#a40e26',
    brightGreen:   '#2da44e',
    brightYellow:  '#bf8700',
    brightBlue:    '#218bff',
    brightMagenta: '#a475f9',
    brightCyan:    '#3192aa',
    brightWhite:   '#8c959f',
  };
}

// ── Initialize Terminal ──────────────────────────────────
function initTerminal() {
  const container = document.getElementById('terminalContainer');
  container.innerHTML = '';

  term = new Terminal({
    fontSize: TERM_FONT_SIZE_DEFAULT,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', 'Consolas', monospace",
    theme: getThemeColors(),
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 10000,
    allowTransparency: true,
    convertEol: true,
    minimumContrastRatio: 4.5,
  });

  // Fit addon
  fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  // Web links
  term.loadAddon(new WebLinksAddon.WebLinksAddon());

  // Search
  term.loadAddon(new SearchAddon.SearchAddon());

  // Open
  term.open(container);
  fitAddon.fit();

  // ── Keyboard shortcuts ────────────────────────────────
  term.attachCustomKeyEventHandler((e) => {
    // Ctrl+Shift+C — Copy
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
      }
      return false;
    }
    // Ctrl+Shift+V — Paste
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      navigator.clipboard.readText().then(text => {
        if (text && socket && isConnected) {
          socket.emit('input', text);
        }
      }).catch(() => {});
      return false;
    }
    // Ctrl+L — Clear
    if (e.ctrlKey && e.key === 'l') {
      term.clear();
      return false;
    }
    // Ctrl+= — Increase font
    if (e.ctrlKey && e.key === '=') {
      changeFontSize(1);
      return false;
    }
    // Ctrl+- — Decrease font
    if (e.ctrlKey && e.key === '-') {
      changeFontSize(-1);
      return false;
    }
    // Ctrl+0 — Reset font
    if (e.ctrlKey && e.key === '0') {
      setFontSize(TERM_FONT_SIZE_DEFAULT);
      return false;
    }
    // Ctrl+Shift+T — Toggle theme
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      toggleTheme();
      return false;
    }
    return true;
  });

  // Focus
  term.focus();

  // Resize handler — remove any previous listener to avoid accumulation
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }
  resizeHandler = () => {
    fitAddon.fit();
    if (socket && isConnected) {
      socket.emit('resize', { cols: term.cols, rows: term.rows });
    }
  };
  window.addEventListener('resize', resizeHandler);

  // Connect
  connectSocket();
}

// ── Socket Connection ────────────────────────────────────
function connectSocket() {
  const badge = document.getElementById('sessionBadge');
  badge.textContent = 'connecting…';
  badge.className = 'session-badge';

  socket = io({ transports: ['polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 10 });
  // Keep the shared termApp reference up to date
  window.termApp.socket = socket;

  socket.on('connect', () => {
    isConnected = true;
    badge.textContent = 'connected';
    badge.className = 'session-badge connected';

    // Start terminal
    socket.emit('start', { cols: term.cols, rows: term.rows });
  });

  socket.on('session', ({ sessionId }) => {
    badge.textContent = `session: ${sessionId.slice(0, 8)}`;
  });

  socket.on('output', (data) => {
    term.write(data);
  });

  socket.on('exit', (code) => {
    term.write(`\r\n\r\n\x1b[1;31m[Process exited with code ${code}]\x1b[0m\r\n`);
    isConnected = false;
    badge.textContent = `exited (${code})`;
    badge.className = 'session-badge disconnected';
  });

  socket.on('disconnect', () => {
    isConnected = false;
    badge.textContent = 'disconnected';
    badge.className = 'session-badge disconnected';
    term.write('\r\n\r\n\x1b[1;33m[Connection lost — reconnecting…]\x1b[0m\r\n');
  });

  socket.on('connect_error', () => {
    badge.textContent = 'error';
    badge.className = 'session-badge disconnected';
  });

  // Send input
  term.onData((data) => {
    if (socket && isConnected) {
      socket.emit('input', data);
    }
  });
}

// ── Font Size ────────────────────────────────────────────
function setFontSize(size) {
  size = Math.max(TERM_FONT_SIZE_MIN, Math.min(TERM_FONT_SIZE_MAX, size));
  term.options.fontSize = size;
  document.getElementById('fontLabel').textContent = size;
  fitAddon.fit();
  if (socket && isConnected) {
    socket.emit('resize', { cols: term.cols, rows: term.rows });
  }
}

function changeFontSize(delta) {
  setFontSize(term.options.fontSize + delta);
}

// ── Theme ────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('webterm-theme', theme);
  if (term) {
    term.options.theme = getThemeColors();
  }
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Start on load ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  const saved = localStorage.getItem('webterm-theme') || 'dark';
  applyTheme(saved);

  initTerminal();
  // initTerminal() assigns term/fitAddon and calls connectSocket() which assigns socket.
  // Sync all references into the shared termApp object so ui.js and upload.js can use them.
  window.termApp.term = term;
  window.termApp.fitAddon = fitAddon;
  window.termApp.socket = socket;

  // Welcome overlay via sysinfo
  fetch('/api/sysinfo')
    .then(r => r.json())
    .then(info => {
      const lines = [
        `\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m`,
        `\x1b[1;36m║\x1b[1;33m          🖥️  Web Linux Terminal  v2.0.0               \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m╠══════════════════════════════════════════════════════════╣\x1b[0m`,
        `\x1b[1;36m║\x1b[0m  \x1b[1mOS\x1b[0m:       ${pad(info.os, 43)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m  \x1b[1mKernel\x1b[0m:   ${pad(info.kernel, 43)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m  \x1b[1mArch\x1b[0m:     ${pad(info.arch, 43)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m  \x1b[1mCPU\x1b[0m:      ${pad(info.cpu, 43)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m  \x1b[1mCores\x1b[0m:   ${pad(info.cores, 43)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m  \x1b[1mMemory\x1b[0m:  ${pad(info.memory, 43)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m  \x1b[1mUptime\x1b[0m:  ${pad(info.uptime, 43)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m╠══════════════════════════════════════════════════════════╣\x1b[0m`,
        `\x1b[1;36m║\x1b[0m  \x1b[32mDev Tools:\x1b[0m                                               \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m    ${pad(info.gcc, 51)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m    ${pad(info.rustc, 51)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m    ${pad(info.python, 51)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m    ${pad(info.node + ' / npm ' + info.npm, 51)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m    ${pad(info.go, 51)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m    ${pad(info.java, 51)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m    ${pad(info.git, 51)} \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m╠══════════════════════════════════════════════════════════╣\x1b[0m`,
        `\x1b[1;36m║\x1b[0m  \x1b[35mShortcuts:\x1b[0m Ctrl+Shift+C/V  Copy/Paste               \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m║\x1b[0m           Ctrl+L Clear  Ctrl+± Font  Ctrl+Shift+T Theme \x1b[1;36m║\x1b[0m`,
        `\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m`,
        '',
      ];
      term.write(lines.join('\r\n'));
    })
    .catch(() => {
      term.write('\x1b[1;32m🖥️  Web Linux Terminal v2.0.0 — Ready\x1b[0m\r\n\r\n');
    });
});

function pad(str, len) {
  str = str || 'N/A';
  return str.length > len ? str.slice(0, len - 1) + '…' : str.padEnd(len);
}

// Export for other modules
window.termApp = { term, fitAddon, socket, changeFontSize, setFontSize, toggleTheme, applyTheme };
