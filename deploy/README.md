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

## 1. Primer despliegue (un comando)

Antes: registros DNS **A** de los dos dominios apuntando al VPS.

```bash
sudo git clone https://github.com/teudyjoshuaenc/facturaRD.git /opt/facturard
sudo /opt/facturard/deploy/setup.sh
```

`setup.sh` instala lo que falte (Docker, nginx, certbot), pregunta los dominios y las llaves de
SendGrid/Cloudinary, **genera todos los secretos** en `deploy/.env`, levanta los contenedores
(la API aplica las migraciones sola), instala el sitio de nginx con tus dominios, saca HTTPS con
certbot, programa el backup diario y al final imprime el enlace para GoHighLevel y las URLs del
portal DGII. Es idempotente: si `deploy/.env` ya existe no toca los secretos.

> **Guarda `ENCRYPTION_KEY`** (la imprime al final) en un gestor de contraseñas. Cifra los
> certificados P12 y los tokens de GHL: si se pierde o cambia, ningún cliente puede firmar.

<details><summary>Instalación manual (sin el script)</summary>

```bash
cd /opt/facturard/deploy
cp .env.example .env && nano .env && chmod 600 .env   # secretos: openssl rand -base64 48
docker compose -f docker-compose.prod.yml up -d --build
sudo cp nginx/facturard.conf /etc/nginx/sites-available/   # cambiar server_name por tus dominios
sudo ln -s /etc/nginx/sites-available/facturard.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d APP_DOMAIN -d API_DOMAIN
```
</details>

No agregar `X-Frame-Options` en nginx: la app vive dentro de un iframe de GoHighLevel y Next ya
manda las cabeceras correctas.

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
| Menú personalizado de GoHighLevel | `https://APP_DOMAIN/?location_id={{location.id}}&email={{location.email}}&phone={{location.phone}}&address={{location.full_address}}` — GHL reemplaza las variables y el alta llega con correo/teléfono/dirección prellenados (editables) |
| Webhooks GHL entrantes | `https://API_DOMAIN/api/v1/webhooks/ghl/:tenantId` |
| Portal DGII (receptor, Paso 7) | `https://API_DOMAIN/fe/autenticacion/api/semilla`, `/fe/autenticacion/api/validacioncertificado`, `/fe/recepcion/api/ecf`, `/fe/aprobacioncomercial/api/ecf` |
| Links de correo (reset password) | se toman de `APP_URL` = `https://APP_DOMAIN` (automático) |

## 4. Actualizar (deploy de una versión nueva)

```bash
cd /opt/facturard && sudo git pull && sudo deploy/setup.sh
```

Reconstruye las imágenes y reinicia; las migraciones nuevas se aplican solas. `NEXT_PUBLIC_*` se
incrustan al compilar el frontend, por eso siempre se reconstruye.

## 5. Backups

`setup.sh` programa en el crontab de root:
`15 3 * * * /opt/facturard/deploy/backup.sh >> /var/log/facturard-backup.log 2>&1`

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
- **Numeración e-NCF:** al subir el certificado (onboarding o Configuración → Certificación
  fiscal) FacturaRD consulta a la DGII el último e-NCF recibido por tipo y continúa desde ahí.
  La DGII no expone la fecha de vencimiento de la secuencia: esa se escribe a mano.
- **CI:** `.github/workflows/ci.yml` sólo corre build + tests; el deploy es manual (sección 4).
  Automatizarlo = job que haga SSH al VPS y corra esos mismos comandos.
