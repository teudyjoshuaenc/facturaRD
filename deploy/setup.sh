#!/usr/bin/env bash
# FacturaRD — instalación en el VPS en un solo comando (Ubuntu/Debian, nginx del host).
#
#   git clone https://github.com/teudyjoshuaenc/facturaRD.git /opt/facturard
#   sudo /opt/facturard/deploy/setup.sh
#
# Idempotente: se puede volver a correr. Si deploy/.env ya existe NO se tocan los
# secretos (sobre todo ENCRYPTION_KEY: cambiarla deja ilegibles los certificados).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
SITE=/etc/nginx/sites-available/facturard.conf

info() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Córrelo con sudo: sudo $0"

ask() { # ask VAR "Pregunta" [default] [secreto]
  local var=$1 prompt=$2 def=${3:-} secret=${4:-} val
  while :; do
    if [ -n "$secret" ]; then read -r -s -p "$prompt: " val; echo
    else read -r -p "$prompt${def:+ [$def]}: " val; fi
    val=${val:-$def}
    [ -n "$val" ] && break
    echo "  (obligatorio)"
  done
  printf -v "$var" '%s' "$val"
}
gen() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }

# ── 1. Dependencias ──────────────────────────────────────────────────────────
info "Dependencias"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  read -r -p "Docker no está instalado. ¿Instalarlo con el script oficial (get.docker.com)? [s/N] " r
  [[ $r =~ ^[sSyY]$ ]] || die "Instala Docker Engine + Compose v2 y vuelve a correr."
  curl -fsSL https://get.docker.com | sh
fi
for pkg in nginx certbot python3-certbot-nginx openssl; do
  dpkg -s "$pkg" >/dev/null 2>&1 || { apt-get update -qq; apt-get install -y -qq "$pkg"; }
done
ok "docker, nginx, certbot"

# ── 2. Configuración (.env) ──────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  info "Usando $ENV_FILE existente (secretos intactos)"
  set -a; . "$ENV_FILE"; set +a
else
  info "Configuración — se guarda en $ENV_FILE"
  ask APP_DOMAIN "Dominio de la app (ej. app.facturard.do)"
  ask API_DOMAIN "Dominio de la API (ej. api.facturard.do)"
  ask ACME_EMAIL "Correo para Let's Encrypt (avisos de certificados)"
  ask SENDGRID_API_KEY "SendGrid API key" "" secreto
  ask SENDGRID_FROM "Remitente de correos" "noreply@$APP_DOMAIN"
  ask CLOUDINARY_CLOUD_NAME "Cloudinary cloud name"
  ask CLOUDINARY_API_KEY "Cloudinary API key"
  ask CLOUDINARY_API_SECRET "Cloudinary API secret" "" secreto
  ask DGII_ENV "Ambiente DGII: certification o production" "certification"
  ask API_PORT "Puerto local de la API" "3000"
  ask WEB_PORT "Puerto local de la web" "3001"

  umask 077
  cat > "$ENV_FILE" <<EOF
# Generado por deploy/setup.sh el $(date -Iseconds). Ver .env.example.
APP_DOMAIN=$APP_DOMAIN
API_DOMAIN=$API_DOMAIN
ACME_EMAIL=$ACME_EMAIL
API_PORT=$API_PORT
WEB_PORT=$WEB_PORT

POSTGRES_USER=facturard
POSTGRES_PASSWORD=$(gen)
POSTGRES_DB=facturard
REDIS_PASSWORD=$(gen)

JWT_SECRET=$(gen)
JWT_REFRESH_SECRET=$(gen)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
# ⚠️ No cambiar ni perder: cifra los P12 y tokens de GHL. Guarda una copia fuera del VPS.
ENCRYPTION_KEY=$(gen)

SENDGRID_API_KEY=$SENDGRID_API_KEY
SENDGRID_FROM=$SENDGRID_FROM
CLOUDINARY_CLOUD_NAME=$CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY=$CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=$CLOUDINARY_API_SECRET
DGII_ENV=$DGII_ENV
NEXT_PUBLIC_SHOW_WIP_TABS=

BACKUP_DIR=/var/backups/facturard
BACKUP_RETENTION_DAYS=30
EOF
  chmod 600 "$ENV_FILE"
  ok "Secretos generados. Copia ENCRYPTION_KEY a tu gestor de contraseñas:"
  grep '^ENCRYPTION_KEY=' "$ENV_FILE"
fi
: "${APP_DOMAIN:?}" "${API_DOMAIN:?}" "${API_PORT:=3000}" "${WEB_PORT:=3001}"

# ── 3. Contenedores ──────────────────────────────────────────────────────────
info "Construyendo y levantando contenedores (la primera vez tarda varios minutos)"
cd "$DEPLOY_DIR"
docker compose -f docker-compose.prod.yml up -d --build --wait
curl -fsS "http://127.0.0.1:$API_PORT/api/v1/health" >/dev/null || die "La API no responde en 127.0.0.1:$API_PORT"
ok "API saludable, migraciones aplicadas"

# ── 4. nginx + HTTPS ─────────────────────────────────────────────────────────
info "nginx"
sed -e "s/app\.facturard\.do/$APP_DOMAIN/g" \
    -e "s/api\.facturard\.do/$API_DOMAIN/g" \
    -e "s#127\.0\.0\.1:3000#127.0.0.1:$API_PORT#" \
    -e "s#127\.0\.0\.1:3001#127.0.0.1:$WEB_PORT#" \
    "$DEPLOY_DIR/nginx/facturard.conf" > "$SITE.tmp"
# Si otro sitio ya define $connection_upgrade, quitar nuestro `map` para no duplicarlo.
if grep -rqs --exclude=facturard.conf 'map \$http_upgrade \$connection_upgrade' /etc/nginx/; then
  sed -i '/^# Necesario para el header Connection/,/^}/d' "$SITE.tmp"
fi
# certbot ya agregó el bloque 443 en una corrida anterior: no pisarlo.
if [ -f "$SITE" ] && grep -q 'managed by Certbot' "$SITE"; then
  rm "$SITE.tmp"; ok "Sitio existente con HTTPS (no se modifica)"
else
  mv "$SITE.tmp" "$SITE"
fi
ln -sf "$SITE" /etc/nginx/sites-enabled/facturard.conf
nginx -t && systemctl reload nginx

for d in "$APP_DOMAIN" "$API_DOMAIN"; do
  ip=$(getent ahostsv4 "$d" | awk 'NR==1{print $1}')
  [ -n "$ip" ] || die "El DNS de $d no resuelve todavía. Crea el registro A hacia este VPS y vuelve a correr."
done
certbot --nginx --non-interactive --agree-tos --redirect -m "${ACME_EMAIL:-admin@$APP_DOMAIN}" \
  -d "$APP_DOMAIN" -d "$API_DOMAIN" --keep-until-expiring
ok "HTTPS activo (certbot renueva solo)"

# ── 5. Backups diarios ───────────────────────────────────────────────────────
info "Backups"
chmod +x "$DEPLOY_DIR/backup.sh"
CRON="15 3 * * * $DEPLOY_DIR/backup.sh >> /var/log/facturard-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -vF "$DEPLOY_DIR/backup.sh"; echo "$CRON" ) | crontab -
ok "pg_dump diario a las 03:15 → ${BACKUP_DIR:-/var/backups/facturard} (cópialo fuera del VPS: la DGII exige 10 años)"

# ── 6. Listo ─────────────────────────────────────────────────────────────────
curl -fsS "https://$API_DOMAIN/api/v1/health" >/dev/null && ok "https://$API_DOMAIN responde"
cat <<EOF

────────────────────────────────────────────────────────────────────────
 FacturaRD instalado.

 Enlace del menú personalizado en GoHighLevel (prellena correo/teléfono/dirección):
   https://$APP_DOMAIN/?location_id={{location.id}}&email={{location.email}}&phone={{location.phone}}&address={{location.full_address}}

 URLs del receptor para el portal DGII:
   https://$API_DOMAIN/fe/autenticacion/api/semilla
   https://$API_DOMAIN/fe/autenticacion/api/validacioncertificado
   https://$API_DOMAIN/fe/recepcion/api/ecf
   https://$API_DOMAIN/fe/aprobacioncomercial/api/ecf

 Actualizar a una versión nueva:
   cd $(dirname "$DEPLOY_DIR") && git pull && sudo $DEPLOY_DIR/setup.sh
────────────────────────────────────────────────────────────────────────
EOF
