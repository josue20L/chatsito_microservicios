# Chatsito en contenedores

Desde esta carpeta, con Docker Desktop iniciado:

```powershell
docker compose -f compose.docker.yaml up -d --build
docker compose -f compose.docker.yaml ps
```

Abrir http://localhost:8081. El gateway también responde en
http://localhost:3100/api/health. El frontend usa `/api` y `/socket.io/`
en su mismo origen; su proxy llega al gateway mediante el alias `backend`.
La carpeta `../frontend-chatsito` debe estar presente para construirlo.

El proyecto `chatsito-micro` agrupa nueve contenedores: frontend, api-gateway,
users-service, auth-service, conversations-service, messages-service,
media-service, notifications-service y postgres. Cada microservicio tiene su propia imagen.
PostgreSQL contiene users_db, conversations_db, messages_db y media_db y no publica
un puerto al host. Los servicios se comunican por sus nombres en la red Docker.

Este Compose es independiente del compose.yaml de desarrollo. Usa un volumen
propio y puertos 8081/3100 para poder convivir con el monolito. Reutiliza el
volumen anterior de `chatsito-micro` si ya existe. No importa sus
usuarios ni conversaciones. Los SQL de db/ se ejecutan al inicializar el volumen.
Si el volumen ya existía antes de agregar media, y `media_db` no existe, crearla
una sola vez con:

```powershell
docker compose -f compose.docker.yaml exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/04-media.sql
```

Los audios se conservan en el volumen `micro_media_uploads`.
El servicio de gateway se llama `api-gateway` (su tecnología sigue siendo Nginx).
El contenedor detenido del antiguo servicio `nginx` puede aparecer como huérfano;
no interfiere con los nueve servicios actuales ni requiere borrar volúmenes.

## Configuración local

Los valores predeterminados son únicamente para desarrollo local. Puedes
definir MICRO_JWT_SECRET, MICRO_POSTGRES_PASSWORD, MICRO_FRONTEND_PORT y
MICRO_API_PORT en el .env de esta carpeta o en PowerShell antes del arranque.
La contraseña debe codificarse para una URL si contiene caracteres reservados,
por lo que para esta configuración conviene usar una contraseña alfanumérica.
Cambiar la variable de contraseña no cambia la de un volumen ya inicializado.
No se necesitan archivos .env dentro de cada servicio para este Compose.

```powershell
docker compose -f compose.docker.yaml logs --tail=100 messages-service
docker compose -f compose.docker.yaml restart messages-service
docker compose -f compose.docker.yaml stop
```

No uses `down -v` si quieres conservar los datos.

## Alcance

Los Dockerfiles instalan las dependencias del lockfile, generan Prisma cuando
corresponde, compilan y ejecutan con el usuario node. El cliente Prisma se genera
en ESM, coherente con los paquetes que declaran `type: module`.
Los healthchecks comprueban también el estado reportado por la aplicación.

La configuración no publica imágenes en Docker Hub. Incluye media y los eventos
de notificaciones integrados en el código actual. El gateway resuelve los nombres
de los servicios periódicamente para tolerar que se recreen sus contenedores.
Para validar su configuración:

```powershell
docker compose -f compose.docker.yaml exec api-gateway nginx -t
```
