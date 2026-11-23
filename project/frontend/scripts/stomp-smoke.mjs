// Reproducible live verification of authenticated SockJS/STOMP delivery through
// the frontend nginx proxy. Run with `npm run test:stomp` while Compose is up.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import WebSocket from 'ws';

const backend = process.env.BACKEND_BASE_URL ?? 'http://127.0.0.1:15173';
const origin = new URL(backend).origin;
const email = process.env.SMOKE_EMAIL ?? 'hospital@lifelink.local';
const password = process.env.SMOKE_PASSWORD ?? 'Hospital@123!';

let token = null;
let organizationId = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, init = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (organizationId != null) headers.set('X-Organization-Id', String(organizationId));
  headers.set('Origin', origin);
  const response = await fetch(`${backend}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`${path} failed: HTTP ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const login = await api('/api/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
assert(login.success === true, 'login envelope was not successful');
token = login.data?.accessToken;
assert(typeof token === 'string' && token.length > 0, 'access token missing');
organizationId = login.data?.user?.memberships?.find(
  (membership) => membership.role === 'HOSPITAL_ADMIN',
)?.organizationId ?? login.data?.user?.memberships?.[0]?.organizationId;
assert(Number.isFinite(organizationId), 'demo user has no organization membership');

const infoResponse = await fetch(`${backend}/ws/info`, { headers: { Origin: origin } });
assert(infoResponse.ok, `SockJS info failed: HTTP ${infoResponse.status}`);
const info = await infoResponse.json();
assert(info.websocket === true, 'SockJS did not advertise websocket transport');

const serverId = '000';
const sessionId = crypto.randomUUID().replaceAll('-', '');
const wsUrl = `${backend.replace(/^http/, 'ws')}/ws/${serverId}/${sessionId}/websocket`;
const frames = [];

await new Promise((resolve, reject) => {
  const socket = new WebSocket(wsUrl, { headers: { Origin: origin } });
  const timer = setTimeout(() => {
    socket.close();
    reject(new Error(`STOMP smoke timed out; frames: ${JSON.stringify(frames.map((f) => f.split('\n')[0]))}`));
  }, 90_000);

  const sendStomp = (frame) => socket.send(JSON.stringify([frame]));
  let triggerStarted = false;

  async function triggerNotification() {
    if (triggerStarted) return;
    triggerStarted = true;
    await api('/api/v1/emergency-requests', {
      method: 'POST',
      body: JSON.stringify({
        organizationId,
        patientRef: 'STOMP-LIVE-SMOKE',
        bloodGroup: 'O_POSITIVE',
        componentType: 'RED_CELLS',
        quantity: 1,
        priority: 'URGENT',
        requiredBy: new Date(Date.now() + 3_600_000).toISOString(),
        reason: 'Live STOMP delivery verification',
      }),
    });
  }

  socket.onmessage = (event) => {
    let text = typeof event.data === 'string' ? event.data : String(event.data);
    if (text.startsWith('a[')) {
      try {
        const messages = JSON.parse(text.slice(1));
        if (Array.isArray(messages)) text = messages.join('');
      } catch {
        // Keep the raw frame when it is not a SockJS JSON envelope.
      }
    }
    if (text === 'h' || text === 'o') return;
    frames.push(text);

    if (text.startsWith('CONNECTED')) {
      sendStomp(`SUBSCRIBE\nid:sub-0\ndestination:/user/queue/notifications\n\n\u0000`);
      void triggerNotification().catch((error) => {
        clearTimeout(timer);
        socket.close();
        reject(error);
      });
    } else if (text.startsWith('MESSAGE') && text.includes('New emergency request')) {
      sendStomp(`DISCONNECT\n\n\u0000`);
      clearTimeout(timer);
      socket.close();
      resolve();
    } else if (text.startsWith('ERROR')) {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`STOMP ERROR frame: ${text}`));
    }
  };

  socket.onerror = () => {
    clearTimeout(timer);
    reject(new Error('WebSocket transport error'));
  };

  socket.onopen = () => {
    sendStomp(
      `CONNECT\naccept-version:1.2\nheart-beat:0,0\nAuthorization:Bearer ${token}\n\n\u0000`,
    );
  };
});

const commands = frames.map((frame) => frame.split('\n')[0]);
assert(commands.includes('CONNECTED'), 'no CONNECTED frame received');
assert(commands.includes('MESSAGE'), 'no notification MESSAGE frame received');
const result = {
  verifiedAt: new Date().toISOString(),
  target: backend,
  login: 'ok',
  sockjsInfo: 'ok',
  websocketTransport: 'ok',
  stompConnect: 'authenticated',
  personalQueueSubscribe: 'accepted',
  notificationMessage: 'delivered',
  frameSequence: commands,
};
const output = process.env.SMOKE_OUTPUT_FILE ?? '../docs/evidence/STOMP_SMOKE_RESULT.json';
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
