# Guía de instalación - chatsito_microservicios

Versión microservicios del chat "chatsito" para comparar contra el monolito (repo chatsito_backend). Servicios: users (3001), auth (3002), conversations (3003); pendientes: messages y media. Nginx (gateway) en 3000, PostgreSQL en 5433.

## 1. Requisitos

```powershell
node -v
```
Qué debes ver: v22.x.x

```powershell
npm -v
```
Qué debes ver: 10.x.x

```powershell
git --version
```
Qué debes ver: git version 2.x.x

```powershell
docker --version
```
Qué debes ver: Docker version 27.x.x

Docker Desktop debe estar instalado y corriendo.

## 2. Clonar

```powershell
git clone https://github.com/josue20L/chatsito_microservicios.git
cd chatsito_microservicios
```

## 3. Crear archivos .env

Los archivos .env no vienen en Git. Crea uno en cada servicio copiando el .env.example:

| Archivo | Variables | Valor sugerido para pruebas |
|---------|-----------|---------------------------|
| .env (raíz) | POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB | postgres, postgres, postgres |
| users-service/.env | DATABASE_URL, JWT_SECRET, PORT | postgresql://postgres:postgres@localhost:5433/users_db, chatsito_secreto_compartido, 3001 |
| auth-service/.env | PORT, JWT_SECRET, JWT_EXPIRES_IN, USERS_SERVICE_URL | 3002, chatsito_secreto_compartido, 1d, http://localhost:3001 |
| conversations-service/.env | DATABASE_URL, JWT_SECRET, PORT, USERS_SERVICE_URL | postgresql://postgres:postgres@localhost:5433/conversations_db, chatsito_secreto_compartido, 3003, http://localhost:3001 |

```powershell
Copy-Item .env.example .env
Copy-Item users-service\.env.example users-service\.env
Copy-Item auth-service\.env.example auth-service\.env
Copy-Item conversations-service\.env.example conversations-service\.env
```

**Importante**: JWT_SECRET debe ser idéntico en users-service, auth-service y conversations-service. Si lo cambias, reinicia los tres servicios.

## 4. Levantar PostgreSQL y Nginx

1. Abre Docker Desktop y espera a que esté corriendo.

2. Levanta los contenedores:

```powershell
docker compose up -d postgres nginx
```

3. Verifica que están corriendo:

```powershell
docker compose ps
```
Qué debes ver: postgres con status "healthy", nginx con status "Up"

4. Verifica que existen las bases de datos:

```powershell
docker compose exec postgres psql -U postgres -c "\l"
```
Qué debes ver: users_db y conversations_db en la lista

**Nota**: Los scripts db/*.sql solo corren automáticamente si el volumen de PostgreSQL es nuevo. Si faltan bases, ejecútalos a mano:

```powershell
docker compose exec postgres psql -U postgres -f /docker-entrypoint-initdb.d/01-users.sql
docker compose exec postgres psql -U postgres -f /docker-entrypoint-initdb.d/02-conversations.sql
```

**Advertencia**: Nunca uses `docker compose down -v` (borra todos los datos).

## 5. Instalar y arrancar cada servicio

Abre una terminal diferente para cada servicio. Ejecuta los comandos DENTRO de la carpeta del servicio. Los avisos EBADENGINE se ignoran.

### users-service (puerto 3001)

```powershell
cd users-service
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

Qué debes ver: "Nest application successfully started" en el puerto 3001

### auth-service (puerto 3002)

```powershell
cd auth-service
npm install
npm run build
npm run start:dev
```

Qué debes ver: "Nest application successfully started" en el puerto 3002

### conversations-service (puerto 3003)

```powershell
cd conversations-service
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

Qué debes ver: "Nest application successfully started" en el puerto 3003

## 6. Verificar que todo funciona

| Servicio | Comando | Respuesta esperada |
|----------|---------|-------------------|
| users-service | `curl http://localhost:3001/health` | {"status":"ok","database":"ok"} |
| auth-service | `curl http://localhost:3002/health` | {"status":"ok"} |
| conversations-service | `curl http://localhost:3003/health` | {"status":"ok","database":"ok"} |
| Nginx gateway | `curl http://localhost:3000/api/health` | {"status":"ok","gateway":"nginx"} |

## 7. Prueba rápida de punta a punta

En PowerShell:

```powershell
function Probar($metodo, $url, $cuerpo) {
  try {
    $p = @{ Method=$metodo; Uri=$url; UseBasicParsing=$true; Headers=@{ Authorization="Bearer $global:token" } }
    if ($cuerpo) { $p.ContentType='application/json'; $p.Body=$cuerpo }
    $r = Invoke-WebRequest @p
    "$($r.StatusCode) $($r.Content)"
  } catch {
    "$($_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)"
  }
}
```

1. Registrar usuario:

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/auth/register -ContentType 'application/json' -Body '{"nombre":"Test","correo":"test@test.com","password":"123456"}'
```
Qué debes ver: 201 con id_usuario, nombre, correo

2. Login:

```powershell
$login = Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{"correo":"test@test.com","password":"123456"}'
$global:token = $login.access_token
```
Qué debes ver: access_token en la respuesta

3. Obtener datos del usuario:

```powershell
Probar GET http://localhost:3000/api/users/me
```
Qué debes ver: 200 con id_usuario, nombre, correo

4. Crear segundo usuario:

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/auth/register -ContentType 'application/json' -Body '{"nombre":"Test2","correo":"test2@test.com","password":"123456"}'
```
Qué debes ver: 201 con id_usuario (anótalo, será 2)

5. Crear conversación privada:

```powershell
Probar POST http://localhost:3000/api/conversations/private '{"id_usuario":"2"}'
```
Qué debes ver: 201 con id_conversacion, tipo=privada, 2 participantes

6. Listar conversaciones:

```powershell
Probar GET http://localhost:3000/api/conversations
```
Qué debes ver: 200 con array de conversaciones

## 8. Probar con el frontend

Clona el repo frontend-chatsito. En su carpeta:

```powershell
$env:VITE_API_URL="http://localhost:3000/api"
npm run dev
```
Abre http://localhost:5173 en el navegador.

**Importante**: El monolito (chatsito_backend) debe estar apagado porque usa el mismo puerto 3000.

**Funciona hoy**: registro, login, buscar usuarios, chats privados y grupos, listar conversaciones.

**Falla todavía**: mensajes y audios (faltan messages-service y media-service).

## 9. Cómo apagar todo

1. En cada terminal de servicio: Ctrl + C

2. Detener contenedores:

```powershell
docker compose stop
```

NO uses `docker compose down -v` (borra datos).

## 10. Problemas comunes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| docker compose ps vacío | Docker Desktop apagado | Abre Docker Desktop y ejecuta `docker compose up -d postgres nginx` |
| /health con database: error | PostgreSQL apagado o base inexistente | Verifica `docker compose ps` y que existan users_db y conversations_db |
| EADDRINUSE | Puerto ocupado | `Get-NetTCPConnection -LocalPort <puerto> -State Listen \| Select-Object OwningProcess` y `Stop-Process -Id <PID> -Force` |
| 401 entre servicios | JWT_SECRET distinto | Verifica que JWT_SECRET sea idéntico en users-service, auth-service y conversations-service |
| 404 de nginx en el frontend | Servicio no arrancado o ruta no existe | Verifica que el servicio esté corriendo y la ruta exista en nginx.conf |
| Error de CORS | Origen incorrecto | El origen debe ser http://localhost:5173 |
| npm install falla en la raíz | Ejecutando en carpeta equivocada | Ejecuta npm install DENTRO de la carpeta del servicio (users-service, auth-service, conversations-service) |
| Falta src/generated | No se generó Prisma Client | Ejecuta `npm run prisma:generate` en el servicio |

## 11. Estructura del repo

```
chatsito_microservicios/
├── compose.yaml              # Docker Compose (postgres, nginx)
├── nginx/
│   └── nginx.conf           # Configuración del gateway
├── db/
│   ├── 01-users.sql         # Schema de users_db
│   └── 02-conversations.sql # Schema de conversations_db
├── users-service/           # Servicio de usuarios (puerto 3001)
├── auth-service/            # Servicio de autenticación (puerto 3002)
└── conversations-service/   # Servicio de conversaciones (puerto 3003)
```

## Estado del proyecto

- ✅ users-service
- ✅ auth-service
- ✅ conversations-service
- ⏳ messages-service (pendiente)
- ⏳ media-service (pendiente)
- ⏳ Dockerizar los servicios (corren localmente por ahora)
- ⏳ Postman collection
- ⏳ Pruebas de carga (k6)
- ⏳ Informe comparativo con monolito
