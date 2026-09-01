#!/bin/sh
# timeman installer — https://github.com/rehanhaider/time-manager
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/rehanhaider/time-manager/main/install.sh | bash
#
# Environment overrides:
#   TIMEMAN_INSTALL_DIR  install directory   (default: ~/.local/bin)
#   TIMEMAN_VERSION      version to install  (default: latest)
set -eu

REPO="rehanhaider/time-manager"
INSTALL_DIR="${TIMEMAN_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${TIMEMAN_VERSION:-latest}"

err() {
  echo "error: $*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || err "curl is required"
command -v tar >/dev/null 2>&1 || err "tar is required"

os="$(uname -s)"
case "$os" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  *) err "unsupported OS: $os — on Windows, use: npm install -g timeman" ;;
esac

arch="$(uname -m)"
case "$arch" in
  x86_64 | amd64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) err "unsupported architecture: $arch" ;;
esac

musl=""
if [ "$os" = "linux" ] && ldd --version 2>&1 | head -n 1 | grep -qi musl; then
  musl="-musl"
fi

asset="tm-${os}-${arch}${musl}.tar.gz"
if [ "$VERSION" = "latest" ]; then
  url="https://github.com/${REPO}/releases/latest/download/${asset}"
else
  url="https://github.com/${REPO}/releases/download/v${VERSION#v}/${asset}"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading ${url}"
curl -fsSL "$url" -o "$tmp/$asset"
tar -xzf "$tmp/$asset" -C "$tmp"

mkdir -p "$INSTALL_DIR"
install -m 755 "$tmp/tm" "$INSTALL_DIR/tm"
# Relative link, so it follows every future `install` of tm instead of going stale.
ln -sf tm "$INSTALL_DIR/timeman"
echo "Installed tm $("$INSTALL_DIR/tm" -V) to $INSTALL_DIR/tm (linked as timeman)"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo ""
    echo "NOTE: $INSTALL_DIR is not on your PATH. Add this to your shell profile:"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    ;;
esac
