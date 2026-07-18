#!/bin/bash
# Local publish for timeman / time-manager — everything runs from this machine, no CI.
#
# Behavior (mirrors the old Python-era publish flow):
# - Default: rehearsal — npm --dry-run, wheels to TestPyPI, no GitHub release
# - PROD=TRUE: real — npm publish, wheels to PyPI, GitHub release with binaries
#
# Usage:
#   make publish
#   PROD=TRUE make publish
#
# Requirements:
# - `make package` has been run (dist/npm, dist/wheels, dist/release populated)
# - npm authenticated locally (authToken in ~/.npmrc)
# - .env with TEST_PYPI_PUBLISH_TOKEN / PYPI_PUBLISH_TOKEN (same as before)
# - gh CLI authenticated (only needed for the PROD GitHub release)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROD=${PROD:-FALSE}
VERSION="$(bun -e 'console.log((await Bun.file("package.json").json()).version)')"

if [ ! -d dist/npm ] || [ ! -d dist/wheels ] || [ ! -d dist/release ]; then
  echo "Error: dist/ is incomplete — run 'make package' first." >&2
  exit 1
fi

if [[ "${PROD^^}" == "TRUE" ]]; then
  echo "=== PROD publish of v${VERSION} (npm + PyPI + GitHub release) ==="
  NPM_FLAGS=""
else
  echo "=== Rehearsal publish of v${VERSION} (npm dry-run + TestPyPI) ==="
  NPM_FLAGS="--dry-run"
fi

# --- npm: platform packages first, then the main package ---
for dir in dist/npm/*/; do
  name="$(basename "$dir")"
  [[ "$name" == "timeman-cli" ]] && continue
  echo "npm publish: $name"
  (cd "$dir" && npm publish --access public $NPM_FLAGS)
done
echo "npm publish: timeman-cli"
(cd dist/npm/timeman-cli && npm publish --access public $NPM_FLAGS)

# --- PyPI wheels (tokens from .env, same file as before) ---
ENV_FILE="$ROOT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
fi

if [[ "${PROD^^}" == "TRUE" ]]; then
  echo "PyPI upload (production)"
  uv publish --token "${PYPI_PUBLISH_TOKEN:?PYPI_PUBLISH_TOKEN missing in .env}" dist/wheels/*.whl
else
  echo "PyPI upload (TestPyPI)"
  uv publish --publish-url https://test.pypi.org/legacy/ \
    --token "${TEST_PYPI_PUBLISH_TOKEN:?TEST_PYPI_PUBLISH_TOKEN missing in .env}" \
    dist/wheels/*.whl
fi

# --- GitHub release with binaries (curl installer channel) — PROD only ---
if [[ "${PROD^^}" == "TRUE" ]]; then
  echo "GitHub release v${VERSION}"
  gh release create "v${VERSION}" dist/release/* --title "v${VERSION}" --generate-notes
fi

echo "Done."
