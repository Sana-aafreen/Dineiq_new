#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

export WEBAPP_DIST_DIR="${WEBAPP_DIST_DIR:-${PROJECT_ROOT}/Frontend/Webapp/dist}"
export DASHBOARD_DIST_DIR="${DASHBOARD_DIST_DIR:-${PROJECT_ROOT}/Frontend/Dashboard/dist}"
export PORT="${PORT:-8002}"

cd "${SCRIPT_DIR}"

echo "Starting DineIQ local server on port ${PORT}"
echo "Webapp dist: ${WEBAPP_DIST_DIR}"
echo "Dashboard dist: ${DASHBOARD_DIST_DIR}"

python -m uvicorn main:app --host 0.0.0.0 --port "${PORT}"
