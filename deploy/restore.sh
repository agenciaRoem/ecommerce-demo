#!/usr/bin/env bash
# Restaura una copia hecha con backup.sh. DESTRUYE los datos actuales: pide confirmación escrita.
#   ./deploy/restore.sh backups/db-AAAAMMDD-HHMMSS.dump [backups/media-AAAAMMDD-HHMMSS.tar.gz]
set -euo pipefail

cd "$(dirname "$0")/.."
DB_DUMP="${1:?Indicá el archivo .dump de la base}"
MEDIA_TAR="${2:-}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

read -r -p "Esto reemplaza la base de datos actual. Escribí RESTAURAR para continuar: " answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

"${COMPOSE[@]}" stop backend frontend
"${COMPOSE[@]}" exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < "$DB_DUMP"

if [ -n "$MEDIA_TAR" ]; then
  gunzip -c "$MEDIA_TAR" | "${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh backend -c 'tar -C /app/uploads -xf -'
fi

"${COMPOSE[@]}" up -d backend frontend
echo "Restauración lista. Revisá la tienda y /admin."
