#!/usr/bin/env bash
# Start the LifeLink local development stack and print helpful endpoints.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR/../docker"

if [[ ! -f "$DOCKER_DIR/.env" ]]; then
  cp "$DOCKER_DIR/.env.example" "$DOCKER_DIR/.env"
  echo "Created $DOCKER_DIR/.env from .env.example (DEV-ONLY defaults)."
fi

cd "$DOCKER_DIR"
echo "==> Starting LifeLink compose stack..."
docker compose up -d --build
echo

echo "==> Container status"
docker compose ps
echo

echo "==> Useful URLs"
echo "  Frontend SPA      : http://localhost:${FRONTEND_PORT:-5173}"
echo "  Frontend health   : http://localhost:${FRONTEND_PORT:-5173}/healthz"
echo "  Backend API       : http://localhost:${BACKEND_PORT:-8080}"
echo "  Backend Actuator* : http://localhost:${BACKEND_PORT:-8080}/actuator/health"
echo "  (*) only if Spring Boot Actuator is enabled"
echo

echo "==> Health / log commands (run from $DOCKER_DIR)"
echo "  docker compose logs -f backend frontend"
echo "  docker compose exec -T db pg_isready -U \${POSTGRES_USER:-lifelink} -d \${POSTGRES_DB:-lifelink}"
echo "  docker compose exec -T backend nc -z 127.0.0.1 8080 && echo backend-up"
echo "  docker compose down        # stop, keep data"
echo "  docker compose down -v     # stop and DELETE local data"
