#!/usr/bin/env bash
#
# install-gus.sh — make the Gus CLI installable from the current directory.
#
# This script builds the Gus CLI and symlinks it to ~/.local/bin so the
# `gus` command is available from any terminal directory.
#
# Usage:
#   cd /path/to/gus
#   bash script/install-gus.sh
#
# Or with explicit project root:
#   bash script/install-gus.sh /path/to/gus
#

set -euo pipefail

# Determine project root
if [ -n "${1:-}" ]; then
  PROJECT_ROOT="$(cd "$1" 2>/dev/null && pwd)" || {
    echo "error: '$1' is not a valid directory" >&2
    exit 1
  }
else
  PROJECT_ROOT="$(pwd)"
fi

# Verify we're in a Gus project
if [ ! -f "$PROJECT_ROOT/package.json" ] || [ "$(grep -m1 '"name"' "$PROJECT_ROOT/package.json")" != '"name": "gus"' ]; then
  echo "warning: no 'gus' package.json found at $PROJECT_ROOT" >&2
  echo "continuing anyway..." >&2
fi

USER_BIN_DIR="${GUS_USER_BIN_DIR:-$HOME/.local/bin}"
DEV_DIR="$PROJECT_ROOT/.gus/dev"

echo "==> Using project root: $PROJECT_ROOT"

# ---------------------------------------------------------------------------
# Build CLI into the repo-owned dev directory
# ---------------------------------------------------------------------------
echo "==> Building Gus CLI"
mkdir -p "$DEV_DIR"
(
  cd "$PROJECT_ROOT" || exit 1
  npm run build 2>&1
)

BIN_SRC="$PROJECT_ROOT/dist/cli/main.js"
BIN_DST="$DEV_DIR/gus"

if [ ! -f "$BIN_SRC" ]; then
  echo "error: built binary not found at $BIN_SRC" >&2
  echo "Run 'npm run build' first or ensure the build succeeded." >&2
  exit 1
fi

cp "$BIN_SRC" "$BIN_DST"
chmod +x "$BIN_DST"

echo "==> Gus CLI built and installed to $BIN_DST"

# ---------------------------------------------------------------------------
# Install symlinks into the user binary directory
# ---------------------------------------------------------------------------
echo "==> Installing Gus command"
mkdir -p "$USER_BIN_DIR"

install_link() {
  local name="$1" target="$2"
  ln -sfn "$target" "$USER_BIN_DIR/$name"
  echo "  $USER_BIN_DIR/$name -> $target"
}

install_link "gus" "$BIN_DST"

# ---------------------------------------------------------------------------
# PATH hint
# ---------------------------------------------------------------------------
case ":$PATH:" in
  *":$USER_BIN_DIR:"*)
    echo
    echo "Gus development installation complete."
    echo
    echo "Verify from anywhere:"
    echo "  gus --version"
    echo "  gus --help"
    ;;
  *)
    echo
    echo "Gus development installation complete, but $USER_BIN_DIR is not on PATH."
    echo "Add it (and re-source your shell), for example:"
    echo
    echo "  export PATH=\"$USER_BIN_DIR:\$PATH\""
    echo "  echo 'export PATH=\"$USER_BIN_DIR:\$PATH\"' >> ~/.bashrc   # or ~/.zshrc"
    echo
    echo "Then verify from anywhere:"
    echo "  gus --version"
    echo "  gus --help"
    ;;
esac
