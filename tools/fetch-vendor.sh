#!/usr/bin/env bash
# Copies transformers.js and its WebAssembly runtime into vendor/, so the game
# loads no code from a CDN. Run once from the repo root, then commit vendor/:
#
#   bash tools/fetch-vendor.sh
#
# Needs Node.js (for npm). Change VERSION to upgrade.
set -euo pipefail

VERSION="${1:-3}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Installing @huggingface/transformers@$VERSION into a temporary folder..."
npm install --prefix "$TMP" --no-save --no-audit --no-fund "@huggingface/transformers@$VERSION" >/dev/null

PKG="$TMP/node_modules/@huggingface/transformers"
ORT="$TMP/node_modules/onnxruntime-web/dist"
mkdir -p "$ROOT/vendor"

cp "$PKG/dist/transformers.min.js" "$ROOT/vendor/transformers.min.js"

# The WebAssembly runtime. Newer versions ship it in transformers' own dist folder.
found=0
for dir in "$PKG/dist" "$ORT"; do
  for f in "$dir"/ort-wasm-simd-threaded.jsep.wasm "$dir"/ort-wasm-simd-threaded.jsep.mjs; do
    if [ -f "$f" ] && [ ! -f "$ROOT/vendor/$(basename "$f")" ]; then
      cp "$f" "$ROOT/vendor/"
      found=$((found + 1))
    fi
  done
done
[ "$found" -gt 0 ] || { echo "Couldn't find the ort-wasm runtime files. Check $PKG/dist."; exit 1; }

INSTALLED="$(node -p "require('$PKG/package.json').version")"
echo "$INSTALLED" > "$ROOT/vendor/VERSION"
echo "Done: transformers.js $INSTALLED"
ls -lh "$ROOT/vendor"
