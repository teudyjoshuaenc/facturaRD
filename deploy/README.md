# Deploy en VPS — FacturaRD

Todo el stack corre en un VPS con Docker Compose:

```
Internet ─▶ nginx del host (80/443, TLS con certbot)
              ├─ APP_DOMAIN ─▶ 127.0.0.1:3001  web  (Next.js)
              └─ API_DOMAIN ─▶ 127.0.0.1:3000  api  (NestJS)  ─▶ postgres (16) + redis (7)
```

`web` y `api` publican sus puertos **sólo en 127.0.0.1** (sólo nginx los alcanza; Docker se salta
ufw, por eso no se publican en 0.0.0.0). Postgres y Redis **no exponen puertos**: sólo se alcanzan
dentro de la red de Docker.

## Requisitos del VPS

- Ubuntu 22.04/24.04 (o similar), **mínimo 2 vCPU / 4 GB RAM** (el build de Next y de la API
  compila en el propio VPS; con 2 GB agregar swap).
- Docker Engine + plugin Compose v2, nginx y certbot (`apt install nginx certbot python3-certbot-nginx`).
- Firewall: abrir sólo **22, 80, 443** (`ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw enable`).
- DNS: registros **A** de `APP_DOMAIN` y `API_DOMAIN` apuntando a la IP del VPS **antes** de
  correr certbot.
- Si los puertos 3000/3001 ya los usa otra app del VPS, cambiar `API_PORT`/`WEB_PORT` en `.env`
  y los `proxy_pass` de `nginx/facturard.conf`.

## 1. Primer despliegue

```bash
sudo mkdir -p /opt/facturard && sudo chown $USER /opt/facturard
git clone https://github.com/teudyjoshuaenc/facturaRD.git /opt/facturard
cd /opt/facturard/deploy
cp .env.example .env
nano .env            # llenar TODO; secretos nuevos con: openssl rand -base64 48
chmod 600 .env
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # api debe quedar "healthy"
curl http://127.0.0.1:3000/api/v1/health

# nginx + HTTPS (editar los server_name con tus dominios primero)
sudo cp nginx/facturard.conf /etc/nginx/sites-available/facturard.conf
sudo ln -s /etc/nginx/sites-available/facturard.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d APP_DOMAIN -d API_DOMAIN     # agrega 443 + redirección; renueva solo
curl https://API_DOMAIN/api/v1/health
```

No agregar `X-Frame-Options` en nginx: la app vive dentro de un iframe de GoHighLevel y Next ya
manda las cabeceras correctas.

La API corre `prisma migrate deploy` en cada arranque: las migraciones nuevas se aplican solas.

## 2. Base de datos inicial

Instalación nueva = base vacía. Los tenants se crean solos al abrir la app desde GoHighLevel
(onboarding). **No correr el seed** (`prisma/seed.ts`) en producción: crea un SUPER_ADMIN con
contraseña conocida.

### Restaurar un backup

```bash
cd /opt/facturard/deploy
docker compose -f docker-compose.prod.yml stop api
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl' < /var/backups/facturard/facturard-AAAAMMDD-HHMMSS.dump
docker compose -f docker-compose.prod.yml start api
```

El dump sólo sirve con la **misma `ENCRYPTION_KEY`** con la que se generaron los datos.

## 3. Puntos que cambian de URL

| Dónde | Valor nuevo |
|---|---|
| App de GoHighLevel (Custom Page / iframe) | `https://APP_DOMAIN/?location_id=...` |
| Webhooks GHL entrantes | `https://API_DOMAIN/api/v1/webhooks/ghl/:tenantId` |
| Portal DGII (receptor, Paso 7) | `https://API_DOMAIN/fe/autenticacion/api/semilla`, `/fe/autenticacion/api/validacioncertificado`, `/fe/recepcion/api/ecf`, `/fe/aprobacioncomercial/api/ecf` |
| Links de correo (reset password) | se toman de `APP_URL` = `https://APP_DOMAIN` (automático) |

## 4. Actualizar (deploy de una versión nueva)

```bash
cd /opt/facturard && git pull
cd deploy && docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

`NEXT_PUBLIC_*` se incrustan al compilar el frontend: si cambias `API_DOMAIN` o
`NEXT_PUBLIC_SHOW_WIP_TABS`, hace falta `--build`.

## 5. Backups

```bash
crontab -e
15 3 * * * /opt/facturard/deploy/backup.sh >> /var/log/facturard-backup.log 2>&1
```

Dump diario en `BACKUP_DIR`, rotación local de `BACKUP_RETENTION_DAYS`. **La DGII exige 10 años de
retención**: sincroniza `BACKUP_DIR` fuera del VPS (rclone a S3/Backblaze, etc.). Probar una
restauración (sección 2) al menos una vez.

## 6. Operación

```bash
docker compose -f docker-compose.prod.yml logs -f api        # logs
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml exec postgres psql -U facturard facturard
```

## Pendiente / fuera de este setup

- **Pasar a producción DGII:** `DGII_ENV=production` en `.env` + `up -d` (sólo cuando certifiquen).
- **CI:** `.github/workflows/ci.yml` sólo corre build + tests; el deploy es manual (sección 4).
  Automatizarlo = job que haga SSH al VPS y corra esos mismos comandos.
