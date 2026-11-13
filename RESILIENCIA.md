# Independencia y comparación con el monolito

Revisión del código local del 11 de noviembre de 2026: microservicios
`f3a4465`, monolito `359cbe5`, frontend compartido `c18ebf8`, más los cambios
locales de esta revisión. No representa una comparación de imágenes publicadas.

## Comparación funcional

Ambas versiones tienen rutas públicas para registro/login, perfil/búsqueda de
usuarios, chats privados, grupos, participantes, historial, envío, lectura,
edición, eliminación, reenvío y audios. Coincidir en rutas no garantiza igualdad
completa: no se realizó una prueba de equivalencia con bases de datos reales.

La diferencia principal encontrada fue el tiempo real: el monolito publica
eventos después de las escrituras; microservicios tenía el receptor WebSocket,
pero faltaban los emisores para mensajes de texto y conversaciones. Media ya
notificaba cambios, pero sin el evento que utiliza el frontend para el sonido.
Se agregaron esos emisores y `chat:message` con ID de mensaje y remitente.

## Comportamiento ante fallas

| Falla | Comportamiento |
|---|---|
| Auth | Los servicios validan JWT localmente. Sesiones válidas continúan; login/registro y sesiones vencidas necesitan auth. |
| Users | Mensajes ya toleraba nombres ausentes. Conversaciones ahora también permite listar/ver chats con nombres `Usuario ID`. Crear chats/grupos y agregar participantes sigue requiriendo validar usuarios. |
| Users al recargar el navegador | El frontend usa el perfil guardado en esta pestaña para el mismo token, avisa y reintenta cada 30 s. Sin perfil previo no se garantiza el acceso a la pantalla. La caché no concede permisos: cada petición sigue validando JWT en el backend. |
| Messages | Conversaciones devuelve chats con `noLeidos: null`, en lugar de bloquear la lista o afirmar que hay cero mensajes sin leer. |
| Media | El historial conserva texto y audios con `archivo: null`; el frontend indica que faltan metadatos. Los audios no pueden descargarse/subirse mientras media esté caído. También se toleran metadatos JSON inválidos. |
| Notifications | Las escrituras no esperan al aviso ni fallan por él. El frontend sincroniza al entrar y consulta cada 5 s sin WebSocket. Al reconectar vuelve a sincronizar. |
| Pérdida de un evento con WebSocket conectado | Hay una consulta de respaldo cada 30 s para recuperar cambios aunque el socket siga conectado. |
| Fallo del historial | La lista de chats se actualiza por separado; se conserva el contenido previamente cargado y se muestra el error. |
| Conversations | Enviar/leer mensajes sigue requiriendo comprobar participación. No se omite esa validación por una caída. |
| Nginx o PostgreSQL compartido | Siguen siendo dependencias compartidas. No se agregó alta disponibilidad. |

Las consultas periódicas cargan la ventana reciente del historial que ya usa el
frontend, de hasta 50 mensajes por consulta por defecto; no son una cola durable
ni una sincronización completa del historial. Solo consultan con la pestaña
visible, y al volver a ella sincronizan inmediatamente. No se reproducen sonidos
de eventos perdidos durante la desconexión.

Los avisos son de conexión, perfil, contadores y operaciones fallidas. Login y
registro muestran únicamente fallas de autenticación o usuarios. Las búsquedas
de usuarios y miembros muestran su error junto al buscador; la reproducción
de audio lo muestra en el reproductor. Nginx identifica con JSON el servicio
de destino cuando no puede conectarse (502/504 convertidos a 503). Es necesario
recargar su configuración para aplicar ese cambio. Los avisos se detectan al
realizar la operación, sin consultar módulos ajenos a la pantalla. No hay un
monitor central de salud que identifique inequívocamente todos los servicios.
`/api/health` de Nginx sigue comprobando únicamente el gateway.

## Configuración y pruebas

En messages-service y conversations-service, configurar
`NOTIFICATIONS_SERVICE_URL` con la dirección accesible de notifications-service.
El valor por defecto es `http://localhost:3006` para ejecución local. Dentro de
Docker debe usarse el nombre del servicio, por ejemplo
`http://notifications-service:3006`. Media ya utiliza esa variable.

El frontend es compartido: su respaldo HTTP beneficia también al monolito.
No se cambió el código del backend monolítico. Se recuperó `compose.docker.yaml`
y se reconstruyeron las imágenes de los seis servicios y el frontend. Incluye
`api-gateway` y PostgreSQL, con nueve contenedores en el proyecto `chatsito-micro`.
Consultar [DOCKER.md](DOCKER.md). El `compose.yaml` de desarrollo sigue iniciando
solo Nginx y PostgreSQL; para el despliegue completo usar siempre
`docker compose -f compose.docker.yaml ...`.

Pruebas automatizadas de fallas con dobles de HTTP/BD:

```powershell
node scripts/test-resilience.cjs
```

El ejecutor transpila TypeScript y utiliza Nest/RxJS instalados en el monolito
hermano de este workspace. Para utilizar otra instalación compatible:

```powershell
$env:RESILIENCE_DEPS_ROOT = 'messages-service'
node scripts/test-resilience.cjs
```

Requiere además passport-jwt y jsonwebtoken para la prueba JWT; se puede usar
messages-service con sus dependencias de desarrollo completas.
Estas pruebas no requieren PostgreSQL ni contenedores y no sustituyen las
pruebas de integración de despliegue.

Prueba de integración del despliegue (crea dos cuentas y un chat de prueba):

```powershell
node scripts/verificar-docker.mjs
# También detiene y restaura servicios: ejecutarlo sin usuarios activos.
node scripts/verificar-docker.mjs --fallas
```

Utiliza socket.io-client del frontend hermano de este workspace. Comprueba
registro, login, mensajes, evento WebSocket y subida/descarga de audio; con
`--fallas` comprueba las respuestas HTTP al detener servicios. No comprueba la
interfaz del navegador ni sus temporizadores.

Validación manual de la interfaz:

1. Iniciar sesión con dos usuarios, abrir el mismo chat y comprobar texto,
   sonido, edición, eliminación, reenvío, grupos y audio.
2. Detener auth: ambos usuarios con JWT válido deben seguir enviando; un nuevo
   login debe fallar. Verificar también el rechazo de tokens vencidos.
3. Detener media: enviar texto y consultar un historial con audios; el texto
   debe continuar disponible. Reiniciar y comprobar recuperación.
4. Detener users después de cargar el perfil: consultar chats, enviar texto y
   recargar la misma pestaña. No deben permitirse altas de participantes sin validación.
5. Detener notifications: verificar el aviso y recepción por HTTP en unos
   5 s, sin refrescar. Reiniciar y comprobar reconexión sin mensajes duplicados.
6. Detener messages: la lista de conversaciones debe continuar disponible con
   contadores desconocidos; el historial debe mostrar error sin borrar lo cargado.

Los avisos son de mejor esfuerzo. No se implementó outbox/cola durable: un aviso
fallido se recupera mediante consultas HTTP; no se garantiza reenviar ese evento.
