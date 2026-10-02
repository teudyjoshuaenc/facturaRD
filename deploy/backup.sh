#!/usr/bin/env sh
# Backup diario de PostgreSQL. Programar en el crontab del VPS:
#   15 3 * * * /opt/facturard/deploy/backup.sh >> /var/log/facturard-backup.log 2>&1
# Los dumps locales rotan cada BACKUP_RETENTION_DAYS días. La DGII exige conservar
# 10 años: copia los dumps FUERA del VPS (S3, Backblaze, otro servidor).
set -eu

cd "$(dirname "$0")"
set -a
. ./.env
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/facturard}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/facturard-$STAMP.dump"

mkdir -p "$BACKUP_DIR"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"

find "$BACKUP_DIR" -name 'facturard-*.dump' -mtime "+$RETENTION" -delete
echo "$(date -Iseconds) backup OK: $FILE ($(du -h "$FILE" | cut -f1))"
