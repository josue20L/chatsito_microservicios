// Pruebas de fallas con dependencias reales de Nest y dobles de BD/HTTP.
// Ejecutar: node scripts/test-resilience.cjs
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { createRequire, Module } = require('node:module');
const { test, afterEach } = require('node:test');
const root = resolve(__dirname, '..');
const deps = createRequire(resolve(root, process.env.RESILIENCE_DEPS_ROOT ?? '../backend-chatsito', 'package.json'));
const ts = deps('typescript');
const { of, throwError, firstValueFrom } = deps('rxjs');
const cache = new Map();
function load(relative) {
  const filename = resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.require = (name) => {
    if (name.startsWith('.')) {
      const target = resolve(dirname(filename), name.replace(/\.js$/, '.ts'));
      if (existsSync(target)) return load(target);
    }
    return deps(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true, emitDecoratorMetadata: false, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const config = { get: () => undefined };
const user = { id_usuario: '1' };
const conversation = { id_conversacion: 7n, tipo: 'privada', nombre: null,
  fecha_creacion: new Date(), participantes: [{ id_usuario: 1n }, { id_usuario: 2n }] };

test('autenticación caída: JWT se verifica localmente y rechaza tokens vencidos', async () => {
  const { JwtStrategy } = load('messages-service/src/auth/jwt.strategy.ts');
  const jwt = deps('jsonwebtoken');
  const secret = 'secreto-exclusivo-de-pruebas';
  global.fetch = async () => { throw new Error('No debe consultar autenticación'); };
  const authenticate = token => new Promise((resolve, reject) => {
    const strategy = new JwtStrategy({ get: () => secret });
    strategy.success = resolve;
    strategy.fail = reject;
    strategy.error = reject;
    strategy.authenticate({ headers: { authorization: `Bearer ${token}` } });
  });
  const result = await authenticate(jwt.sign({ sub: '1' }, secret, { expiresIn: '1h' }));
  assert.equal(result.id_usuario, '1');
  await assert.rejects(authenticate(jwt.sign({ sub: '1' }, secret, { expiresIn: -1 })));
});

test('sin usuarios: listar funciona, validar nuevos participantes sigue fallando', async () => {
  const { UsersClient } = load('conversations-service/src/conversations/users.client.ts');
  const client = new UsersClient(config);
  global.fetch = async () => { throw new Error('offline'); };
  assert.equal((await client.obtenerNombres(['1'], true)).size, 0);
  await assert.rejects(client.obtenerNombres(['1']), /users-service no disponible/);
});

test('sin usuarios ni mensajes: lista y detalle conservan chats y permisos', async () => {
  const { ConversationsService } = load('conversations-service/src/conversations/conversations.service.ts');
  const service = new ConversationsService({ conversaciones: {
    findMany: async () => [conversation], findUnique: async () => conversation,
  } }, { obtenerNombres: async () => new Map() }, {
    obtenerNoLeidos: async () => { throw new Error('offline'); },
  });
  const [chat] = await service.findAll(user);
  assert.equal(chat.id_conversacion, '7');
  assert.equal(chat.noLeidos, null);
  assert.equal(chat.participantes[1].nombre, 'Usuario 2');
  assert.equal((await service.findOne('7', user)).id_conversacion, '7');
  await assert.rejects(service.findOne('7', { id_usuario: '9' }), /No tienes acceso/);
});

test('sin usuarios: enviar texto persiste el mensaje con el ID autenticado', async () => {
  const { MessagesService } = load('messages-service/src/messages/messages.service.ts');
  const { UsersClient } = load('messages-service/src/messages/users.client.ts');
  global.fetch = async () => { throw new Error('offline'); };
  let saved;
  const service = new MessagesService({ mensajes: { create: async ({ data }) => {
    saved = data; return { ...data, id_mensaje: 12n, lecturas_mensajes: [] };
  } } }, new UsersClient(config), { esParticipante: async () => true }, {});
  const result = await service.createMessage('7', { contenido: 'hola' }, user);
  assert.equal(saved.id_remitente, 1n);
  assert.equal(result.contenido, 'hola');
  assert.equal(result.remitente.nombre, 'Usuario 1');
});

test('sin media: historial conserva texto y audio sin metadatos', async () => {
  const { MessagesService } = load('messages-service/src/messages/messages.service.ts');
  const { MediaClient } = load('messages-service/src/messages/media.client.ts');
  global.fetch = async () => { throw new Error('offline'); };
  const items = [ { id_mensaje: 12n, tipo: 'audio' }, { id_mensaje: 11n, tipo: 'texto', contenido: 'hola' } ]
    .map(m => ({ ...m, id_conversacion: 7n, id_remitente: 1n, lecturas_mensajes: [] }));
  const service = new MessagesService({ mensajes: { findMany: async () => items } },
    { obtenerNombres: async () => new Map() }, { esParticipante: async () => true }, new MediaClient(config));
  const result = await service.getMessages('7', user);
  assert.equal(result.length, 2);
  assert.equal(result[0].contenido, 'hola');
  assert.equal(result[1].archivo, null);
});

test('sin conversaciones: no se permite enviar saltando la validación', async () => {
  const { MessagesService } = load('messages-service/src/messages/messages.service.ts');
  let writes = 0;
  const service = new MessagesService({ mensajes: { create: async () => { writes++; } } }, {}, {
    esParticipante: async () => { throw new Error('conversations-service no disponible'); },
  }, {});
  await assert.rejects(service.createMessage('7', { contenido: 'hola' }, user));
  assert.equal(writes, 0);
});

test('media devuelve JSON inválido: no bloquea el historial', async () => {
  const { MediaClient } = load('messages-service/src/messages/media.client.ts');
  global.fetch = async () => ({ ok: true, json: async () => null });
  assert.equal((await new MediaClient(config).obtenerArchivos(['12'])).size, 0);
});

for (const service of ['messages-service', 'conversations-service']) {
  test(`${service}: notificaciones caídas no bloquean escrituras y no notifican GET ni errores`, async () => {
    const { NotificationsInterceptor } = load(`${service}/src/notifications.interceptor.ts`);
    const interceptor = new NotificationsInterceptor(config);
    const calls = [];
    global.fetch = async (_url, init) => { calls.push(JSON.parse(init.body)); throw new Error('offline'); };
    const context = (method, path) => ({ getType: () => 'http', switchToHttp: () => ({
      getRequest: () => ({ method, path }),
    }) });
    const result = { id_conversacion: '7', id_mensaje: '12', id_remitente: '1' };
    assert.equal(await firstValueFrom(interceptor.intercept(context('POST', '/api/conversations/7/messages'), {
      handle: () => of(result),
    })), result);
    assert.deepEqual(calls[0], { conversationId: '7', kind: 'message', messageId: '12', senderId: '1' });
    await firstValueFrom(interceptor.intercept(context('GET', '/api/conversations'), { handle: () => of([]) }));
    await assert.rejects(firstValueFrom(interceptor.intercept(context('POST', '/api/conversations/group'), {
      handle: () => throwError(() => new Error('BD caída')),
    })));
    await firstValueFrom(interceptor.intercept(context('POST', '/api/conversations/7/messages/read'), {
      handle: () => of({ marcados: 0 }),
    }));
    assert.equal(calls.length, 1);
  });
}

test('WebSocket emite cambios y sonido solo a los participantes', async () => {
  const { RealtimeGateway } = load('notifications-service/src/notifications/realtime.gateway.ts');
  const gateway = new RealtimeGateway({}, { get: () => 'http://conversations' });
  const events = [];
  gateway.server = { to: rooms => ({ emit: (name, event) => events.push({ rooms, name, event }) }) };
  global.fetch = async () => ({ ok: true, json: async () => ({ participantes: ['1', '2', '2'] }) });
  await gateway.changed('7', 'message', { messageId: '12', senderId: '1' });
  assert.deepEqual(events.map(e => e.name), ['chat:changed', 'chat:message']);
  assert.deepEqual(events[0].rooms, ['user:1', 'user:2']);
});
