#!/usr/bin/env bash
# Despliegue en el servidor. Lo ejecuta el pipeline por SSH, o a mano:  ./deploy/deploy.sh v1.2.3
# Pasos: respaldo → bajar imágenes → migrar la base → levantar → comprobar salud → (si falla) volver a la versión anterior.
set -euo pipefail

cd "$(dirname "$0")/.."
TAG="${1:?Indicá la etiqueta de las imágenes (ej. v1.2.3)}"
[[ "$TAG" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Etiqueta inválida: $TAG"; exit 1; }
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
ENV_FILE=".env"

[ -f "$ENV_FILE" ] || { echo "Falta $ENV_FILE (copiá .env.production.example y completalo)."; exit 1; }
PREVIOUS_TAG="$(grep -E '^IMAGE_TAG=' "$ENV_FILE" | cut -d= -f2- || true)"
APP_DOMAIN="$(grep -E '^APP_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"

set_tag() {
  if grep -qE '^IMAGE_TAG=' "$ENV_FILE"; then sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$1|" "$ENV_FILE"; else echo "IMAGE_TAG=$1" >> "$ENV_FILE"; fi
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS "https://api.${APP_DOMAIN}/health" >/dev/null 2>&1; then return 0; fi
    sleep 4
  done
  return 1
}

echo "▶ Respaldo previo"
./deploy/backup.sh || echo "⚠ No se pudo hacer el respaldo (¿primer despliegue?). Se continúa."

echo "▶ Bajando imágenes $TAG"
set_tag "$TAG"
"${COMPOSE[@]}" pull backend frontend migrate caddy

echo "▶ Migrando la base"
"${COMPOSE[@]}" --profile tools run --rm migrate

echo "▶ Levantando servicios"
"${COMPOSE[@]}" up -d --remove-orphans

echo "▶ Comprobando salud"
if healthy; then
  echo "✔ Desplegado $TAG"
  docker image prune -f >/dev/null
  exit 0
fi

echo "✖ La versión $TAG no respondió. Volviendo a ${PREVIOUS_TAG:-la anterior}."
if [ -n "$PREVIOUS_TAG" ]; then
  set_tag "$PREVIOUS_TAG"
  "${COMPOSE[@]}" up -d --remove-orphans
  healthy && echo "↩ Restaurada la versión $PREVIOUS_TAG (las migraciones aplicadas no se deshacen: revisarlas)."
fi
exit 1
