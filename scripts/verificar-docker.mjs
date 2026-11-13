// Prueba local: crea dos cuentas de prueba. --fallas detiene y restaura servicios.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
const run = promisify(execFile);
const cwd = fileURLToPath(new URL('..', import.meta.url));
const frontend = createRequire(new URL('../../frontend-chatsito/package.json', import.meta.url));
const { io } = frontend('socket.io-client');
const origin = process.env.MICRO_TEST_ORIGIN ?? 'http://localhost:8081';
const compose = (...args) => run('docker', ['compose', '-f', 'compose.docker.yaml', ...args], { cwd });
const suffix = Date.now();
const password = `Prueba${suffix}!`;
let token;
let socket;
async function request(path, { method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(`${origin}/api${path}`, {
    method, signal: AbortSignal.timeout(15000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, expected, `${method} ${path}: HTTP ${response.status}`);
  return response.json();
}
async function ready(service) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { stdout } = await run('docker', ['inspect', `chatsito-micro-${service}-1`,
      '--format', '{{.State.Health.Status}}']);
    if (stdout.trim() === 'healthy') return;
    await pause(500);
  }
  throw new Error(`${service} no recuperó su salud`);
}
async function without(service, verify) {
  await compose('stop', service);
  try { await verify(); console.log(`OK caída de ${service}`); }
  finally { await compose('start', service); await ready(service); }
}
try {
  assert.equal((await fetch(origin)).status, 200);
  const users = [];
  for (const number of [1, 2]) {
    users.push(await request('/auth/register', { method: 'POST', expected: 201,
      body: { nombre: `Prueba Docker ${number}`, correo: `docker_${suffix}_${number}@example.invalid`, password } }));
  }
  token = (await request('/auth/login', { method: 'POST', expected: 201,
    body: { correo: `docker_${suffix}_1@example.invalid`, password } })).access_token;
  const chat = await request('/conversations/private', { method: 'POST', expected: 201,
    body: { id_usuario: users[1].id_usuario } });
  const messagesPath = `/conversations/${chat.id_conversacion}/messages`;
  const send = contenido => request(messagesPath, { method: 'POST', expected: 201, body: { contenido } });
  socket = io(origin, { transports: ['websocket'], auth: { token }, autoConnect: false });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket no conectó')), 10000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
    socket.connect();
  });
  const event = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No llegó chat:message')), 10000);
    socket.once('chat:message', data => { clearTimeout(timer); resolve(data); });
  });
  const text = await send('Texto de verificación Docker');
  assert.equal((await event).messageId, text.id_mensaje);
  console.log('OK frontend, registro, login, chat, texto y evento WebSocket');
  const wav = Buffer.alloc(1644);
  wav.write('RIFF'); wav.writeUInt32LE(1636, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(1600, 40);
  const form = new FormData();
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'prueba.wav');
  form.append('duracion_segundos', '1');
  const audio = await request(`/conversations/${chat.id_conversacion}/audio`, {
    method: 'POST', body: form, expected: 201,
  });
  const download = await fetch(`${origin}/api/media/messages/${audio.id_mensaje}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(download.status, 200);
  assert.equal((await download.arrayBuffer()).byteLength, wav.length);
  console.log('OK subida, persistencia y descarga de audio');
  if (process.argv.includes('--fallas')) {
    socket.disconnect();
    await without('auth-service', async () => {
      assert.equal((await request('/auth/login', { method: 'POST', body: {}, expected: 503 })).service, 'auth-service');
      await send('Texto sin autenticación disponible');
    });
    await without('media-service', async () => {
      await send('Texto sin media disponible');
      const history = await request(messagesPath);
      assert.ok(history.some(m => m.tipo === 'audio' && m.archivo === null));
    });
    await without('users-service', async () => {
      await send('Texto sin usuarios disponible');
      assert.ok(Array.isArray(await request('/conversations')));
      assert.equal((await request('/users?search=test', { expected: 503 })).service, 'users-service');
      assert.match((await request('/auth/login', { method: 'POST', expected: 503,
        body: { correo: `docker_${suffix}_1@example.invalid`, password } })).message, /users-service/);
    });
    await without('notifications-service', async () => {
      const message = await send('Texto sin notificaciones disponible');
      assert.ok((await request(messagesPath)).some(m => m.id_mensaje === message.id_mensaje));
    });
    await without('messages-service', async () => {
      assert.ok((await request('/conversations')).some(c => c.id_conversacion === chat.id_conversacion && c.noLeidos === null));
      assert.equal((await request(messagesPath, { expected: 503 })).service, 'messages-service');
    });
  }
  console.log('Verificación completada. Se conservaron dos cuentas y su chat de prueba.');
} finally {
  socket?.disconnect();
}
