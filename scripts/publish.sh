#!/bin/bash
# Publish script for time-manager.
#
# Behavior:
# - Default: publish to TestPyPI using TEST_PYPI_PUBLISH_TOKEN
# - PROD=TRUE: publish to production PyPI using PYPI_PUBLISH_TOKEN
#
# Usage:
#   make publish
#   PROD=TRUE make publish

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

PROD=${PROD:-FALSE}

if [[ "${PROD^^}" == "TRUE" ]]; then
  INDEX_NAME="pypi"
  TOKEN_VAR="PYPI_PUBLISH_TOKEN"
  PUBLISH_ARGS=()
else
  INDEX_NAME="testpypi"
  TOKEN_VAR="TEST_PYPI_PUBLISH_TOKEN"
  PUBLISH_ARGS=(--index testpypi)
fi

# Load tokens from .env if present (but allow env vars to override).
if [[ -z "${!TOKEN_VAR:-}" && -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

TOKEN="${!TOKEN_VAR:-}"
if [[ -z "$TOKEN" ]]; then
  echo "Error: $TOKEN_VAR is not set. Set it in the environment or in $ENV_FILE" >&2
  exit 1
fi

echo "Publishing to ${INDEX_NAME}..."
UV_PUBLISH_TOKEN="$TOKEN" uv publish "${PUBLISH_ARGS[@]}"