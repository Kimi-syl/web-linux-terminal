###############################################################################
# Web Linux Terminal — Multi-arch Dockerfile
# Full dev environment: C/C++, Rust, Python, Node.js, Go, Java
# Complete sudo access, session-isolated PTY terminals
###############################################################################

FROM ubuntu:22.04

LABEL maintainer="web-linux-terminal"
LABEL description="Full-featured web-based Linux terminal with multi-language dev tools"

# ── Avoid interactive prompts ──────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# ── Base system ────────────────────────────────────────────
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    # Core
    sudo bash coreutils util-linux \
    # Build essentials
    build-essential gcc g++ make cmake gdb \
    # Python
    python3 python3-pip python3-venv python3-dev \
    # Node.js (via NodeSource for latest LTS)
    curl wget ca-certificates gnupg \
    # Java
    default-jdk default-jre \
    # Tools
    git nano vim htop tmux tree jq \
    locales \
    # Networking
    iproute2 iputils-ping net-tools dnsutils traceroute \
    # File utilities
    zip unzip tar gzip bzip2 xz-utils \
    # Text processing
    sed awk grep \
    # Process management
    procps psmisc \
    # Misc
    man-db less \
    && rm -rf /var/lib/apt/lists/*

# ── Locale ─────────────────────────────────────────────────
RUN locale-gen en_US.UTF-8

# ── Node.js 20 LTS via NodeSource ─────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g yarn \
    && rm -rf /var/lib/apt/lists/*

# ── Rust via rustup ────────────────────────────────────────
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --default-toolchain stable --profile default \
    && echo 'source $HOME/.cargo/env' >> /etc/bash.bashrc
ENV PATH="/root/.cargo/bin:${PATH}"

# ── Go ─────────────────────────────────────────────────────
ARG GO_VERSION=1.22.2
RUN wget -q "https://go.dev/dl/go${GO_VERSION}.linux-$(dpkg --print-architecture).tar.gz" -O /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/root/go"

# ── Verify installations ──────────────────────────────────
RUN gcc --version && g++ --version && python3 --version && \
    node --version && npm --version && \
    rustc --version && cargo --version && \
    go version && java --version && \
    git --version

# ── Create non-root user with FULL sudo (no password) ─────
RUN useradd -m -s /bin/bash -G sudo user \
    && echo 'user ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/user \
    && echo 'root ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/root \
    && chmod 440 /etc/sudoers.d/user /etc/sudoers.d/root

# Also keep root as primary (for Replit / container defaults)
# User can run: sudo apt install ... freely

# ── App setup ──────────────────────────────────────────────
WORKDIR /app
COPY package.json ./
RUN npm install --production && npm cache clean --force
COPY . .

# ── Ensure upload directory ────────────────────────────────
RUN mkdir -p /tmp/webterm-uploads && chmod 777 /tmp/webterm-uploads

# ── Expose port (adaptive via $PORT) ──────────────────────
ENV PORT=3000
EXPOSE 3000

# ── Health check ───────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/sysinfo || exit 1

# ── Start ──────────────────────────────────────────────────
CMD ["node", "server/index.js"]
