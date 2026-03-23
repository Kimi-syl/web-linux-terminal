# 🖥️ Web Linux Terminal

A full-featured web-based Linux terminal with real PTY support, WebSocket real-time interaction, multi-language compilation environment, and complete sudo access.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](Dockerfile)

---

## ✨ Features

### 🔧 Real Terminal
- **True Linux PTY** — not a simulator, runs real shell processes
- **WebSocket** real-time I/O with xterm.js frontend
- **Session isolation** — each browser tab gets its own independent terminal
- **Full sudo access** — install packages, modify system, run any command

### 💻 Multi-Language Dev Environment
| Language | Tools |
|----------|-------|
| **C / C++** | gcc, g++, make, cmake, gdb |
| **Rust** | rustc, cargo (via rustup) |
| **Python** | python3, pip, venv |
| **Node.js** | node, npm, yarn |
| **Go** | go compiler + modules |
| **Java** | javac, java (OpenJDK) |
| **Tools** | git, curl, wget, nano, vim, htop, tmux, jq |

### 🎨 UI Features
- **Dark / Light theme** toggle (persisted in localStorage)
- **Font size** adjustment (Ctrl+±)
- **Copy/Paste** — Ctrl+Shift+C / V
- **Clear screen** — Ctrl+L
- **Fullscreen** — F11
- **Drag & drop** file upload to `/tmp/`
- **File download** via `/api/download?path=/path/to/file`
- **Welcome banner** with full system info
- **Responsive** — works on desktop and mobile

---

## 🚀 Quick Start

### Option 1: Replit (One-Click)

1. Click **"Import from GitHub"** on [replit.com](https://replit.com)
2. Paste this repo URL
3. Click **"Run"**

**Start Command** (if needed):
```
npm install && npm start
```

### Option 2: Docker

```bash
# Build and run
docker build -t web-terminal .
docker run -d -p 3000:3000 --privileged --name web-terminal web-terminal

# Or with docker-compose
docker-compose up -d
```

Open: **http://localhost:3000**

### Option 3: Local Development

```bash
# Prerequisites: Node.js 18+, build-essential (for node-pty)

git clone https://github.com/YOUR_USERNAME/web-linux-terminal.git
cd web-linux-terminal
npm install
npm start
```

Open: **http://localhost:3000**

### Option 4: Render / Railway / Fly.io

1. Connect your GitHub repo
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `npm start`
4. The app auto-detects `PORT` from environment

---

## 📁 Project Structure

```
web-linux-terminal/
├── server/
│   ├── index.js          # Express + Socket.IO server, API routes
│   └── terminal.js       # node-pty terminal manager
├── public/
│   ├── index.html        # Main page with xterm.js
│   ├── css/
│   │   └── style.css     # Dark/Light themes, responsive
│   └── js/
│       ├── terminal.js   # Terminal client, Socket.IO, sysinfo
│       ├── ui.js         # Buttons, shortcuts, fullscreen
│       └── upload.js     # Drag & drop file upload
├── Dockerfile            # Multi-arch container with all dev tools
├── docker-compose.yml    # One-command deployment
├── .replit               # Replit configuration
├── replit.nix            # Replit Nix dependencies
├── package.json          # Dependencies
├── .gitignore
└── README.md
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` | Copy selection |
| `Ctrl+Shift+V` | Paste from clipboard |
| `Ctrl+L` | Clear screen |
| `Ctrl++` | Increase font size |
| `Ctrl+-` | Decrease font size |
| `Ctrl+0` | Reset font size |
| `Ctrl+Shift+T` | Toggle dark/light theme |
| `F11` | Toggle fullscreen |
| `?` | Show keyboard shortcuts help |

---

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sysinfo` | System information (OS, CPU, memory, dev tools) |
| `POST` | `/api/upload` | Upload file (multipart, field: `file`, optional: `path`) |
| `GET` | `/api/download?path=` | Download file from server |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `start` | Client→Server | Initialize terminal session (`{cols, rows}`) |
| `input` | Client→Server | Send keystrokes |
| `resize` | Client→Server | Resize terminal (`{cols, rows}`) |
| `output` | Server→Client | Terminal output data |
| `session` | Server→Client | Session info (`{sessionId}`) |
| `exit` | Server→Client | Process exited (`exitCode`) |

---

## 🔒 Security Notes

This terminal runs with **full root/sudo access by design**. It is intended for:

- Personal use
- Isolated development environments
- Controlled internal networks
- Educational / sandbox purposes

**Do NOT expose to the public internet without:**
- Adding authentication (reverse proxy with BasicAuth / OAuth)
- Rate limiting
- Network isolation (Docker network policies)
- Resource limits (cgroups / Docker resource constraints)

---

## 🛠️ Development

### Adding New Dev Tools

Edit the `Dockerfile` to add packages:

```dockerfile
RUN apt-get update && apt-get install -y \
    your-package-here \
    && rm -rf /var/lib/apt/lists/*
```

### Customizing Themes

Edit CSS variables in `public/css/style.css`:

```css
[data-theme="dark"] {
  --bg: #your-color;
  --accent: #your-color;
  /* ... */
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port (auto-detected on PaaS) |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | - | `production` recommended |

---

## 📦 Git Setup & Push

```bash
cd web-linux-terminal

git init
git add -A
git commit -m "feat: complete web linux terminal with multi-language dev environment

- Real PTY terminal via node-pty + WebSocket
- C/C++, Rust, Python, Node.js, Go, Java compilation
- Full sudo access, no restrictions
- Dark/light themes, file upload/download
- Session isolation per browser tab
- Docker + Replit ready"

# Add your remote
git remote add origin https://github.com/YOUR_USERNAME/web-linux-terminal.git
git branch -M main
git push -u origin main
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Credits

- [xterm.js](https://xtermjs.org/) — Terminal frontend
- [node-pty](https://github.com/microsoft/node-pty) — Native PTY bindings
- [Socket.IO](https://socket.io/) — Real-time WebSocket
- [Express](https://expressjs.com/) — Web server
