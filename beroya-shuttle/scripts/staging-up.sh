#!/bin/sh
set -eu
# One-button staging: infra + migrate + api + worker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d postgres redis minio
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build migrate
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d api worker
echo "Staging API: http://localhost:3001/health"
