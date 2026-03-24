{ pkgs }: {
  deps = [
    pkgs.nodejs-20_x
    pkgs.gcc
    pkgs.gnumake
    pkgs.python3
    pkgs.cargo
    pkgs.rustc
    pkgs.go
    pkgs.jdk17
    pkgs.git
    pkgs.wget
    pkgs.curl
    pkgs.nano
    pkgs.vim
    pkgs.htop
    # node-pty build deps
    pkgs.nodePackages.node-gyp
    pkgs.pkg-config
  ];
}
