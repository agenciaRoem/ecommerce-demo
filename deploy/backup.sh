#!/usr/bin/env bash
# Copia de seguridad de la base y de las fotos. Pensado para correr desde cron en el servidor:
#   0 3 * * *  cd /opt/omnistock && ./deploy/backup.sh >> /var/log/omnistock-backup.log 2>&1
# Guarda en $BACKUP_DIR (por defecto ./backups) y conserva los últimos $KEEP_DAYS días (14 por defecto).
# Una copia que queda en el mismo servidor no es una copia: sincronizar $BACKUP_DIR a otro lado (rclone, S3, otro VPS).
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
umask 077

echo "[$STAMP] base de datos…"
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$BACKUP_DIR/db-$STAMP.dump"

echo "[$STAMP] fotos de productos…"
"${COMPOSE[@]}" exec -T backend tar -C /app/uploads -cf - . | gzip > "$BACKUP_DIR/media-$STAMP.tar.gz"

# Una copia vacía o truncada es peor que ninguna: se verifica antes de dar por buena la corrida.
"${COMPOSE[@]}" exec -T postgres pg_restore --list < "$BACKUP_DIR/db-$STAMP.dump" > /dev/null
gzip -t "$BACKUP_DIR/media-$STAMP.tar.gz"

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'media-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "[$STAMP] listo: $(du -h "$BACKUP_DIR/db-$STAMP.dump" | cut -f1) de base, $(du -h "$BACKUP_DIR/media-$STAMP.tar.gz" | cut -f1) de fotos"
