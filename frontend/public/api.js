/**
 * api.js — REST + WebSocket client for the Koryphaios backend (Zag port).
 *
 * Speaks the faithful original contract:
 *   - Bearer auth minted via POST /api/auth/session, persisted in
 *     localStorage['koryphaios-local-auth-token'], validated via /api/auth/me,
 *     re-minted transparently on 401 (the server rotates its secret per boot).
 *   - Envelopes: {"ok":true,"data":...} on REST; {type,payload,timestamp,
 *     sessionId,agentId} on WS.
 *   - Endpoints: /api/sessions CRUD, /api/messages/:sid, POST /api/messages
 *     (chat; replies stream over WS), /api/providers (+ PUT /:name),
 *     /api/project, /api/health.
 *
 * This module adapts those wire shapes to the store-level interface the UI
 * consumes (sessions with `cost`, providers with `configured`, feed events
 * `ws:token` / `ws:feed.entry` / `ws:agent.status` / `ws:providers`).
 *
 * `?demo=1` seeds the exact state of the reference screenshot without a
 * backend: seven sessions (all 10:29 PM), no providers, "connected" realtime.
 */

import { K } from '/toolkit.js';

export const DEMO = new URLSearchParams(location.search).has('demo');

const TOKEN_KEY = 'koryphaios-local-auth-token';

/* ─── Demo seed (matches the reference screenshot verbatim) ──────────────── */

function demoSeed() {
  const at = new Date();
  at.setHours(22, 29, 0, 0); // "10:29 PM" today
  const t = at.getTime();
  const titles = ['Test', 'Test', 'Test Session', 'Session 1', 'Session 2', 'Session 3', 'Test'];
  return titles.map((title, i) => ({
    id: `demo-${i + 1}`,
    title,
    createdAt: t,
    updatedAt: t,
    messageCount: 0,
    cost: 0,
  }));
}

/* ─── Auth ───────────────────────────────────────────────────────────────── */

let bearer = localStorage.getItem(TOKEN_KEY) ?? null;
let minting = null;

async function mintToken() {
  minting ??= (async () => {
    try {
      const res = await fetch('/api/auth/session', { method: 'POST' });
      const body = await res.json();
      bearer = body?.data?.bearerToken ?? null;
      if (bearer) localStorage.setItem(TOKEN_KEY, bearer);
    } catch {
      bearer = null;
    } finally {
      minting = null;
    }
  })();
  await minting;
  return bearer;
}

export async function ensureAuth() {
  if (DEMO) return null;
  if (!bearer) await mintToken();
  return bearer;
}

/* ─── REST core ──────────────────────────────────────────────────────────── */

async function rawRequest(method, path, body) {
  const headers = {};
  if (bearer) headers.Authorization = bearer;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) throw Object.assign(new Error('unauthorized'), { status: 401 });
  if (!res.ok) throw Object.assign(new Error(`${method} ${path} → ${res.status}`), { status: res.status });
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

/** Request with transparent one-shot re-mint on 401 (server secret rotates per boot). */
async function request(method, path, body) {
  await ensureAuth();
  try {
    return await rawRequest(method, path, body);
  } catch (e) {
    if (e.status !== 401) throw e;
    await mintToken();
    return rawRequest(method, path, body);
  }
}

async function attempt(promise, fallback) {
  try { return await promise; } catch { return fallback; }
}

/* ─── Wire-shape adapters ────────────────────────────────────────────────── */

function adaptSession(s) {
  return {
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount: s.messageCount ?? 0,
    cost: s.totalCost ?? 0,
    tokensIn: s.totalTokensIn ?? 0,
    tokensOut: s.totalTokensOut ?? 0,
  };
}

function blockText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((b) => b?.text ?? '').join('');
  return '';
}

function adaptMessage(m) {
  return {
    id: m.id,
    role: m.role,
    content: blockText(m.content),
    createdAt: m.createdAt,
    model: m.model,
    provider: m.provider,
  };
}

function adaptProvider(p) {
  return {
    id: p.name,
    name: p.label ?? p.name,
    configured: !!p.authenticated,
    models: p.models ?? [],
    allModels: p.allAvailableModels ?? [],
    requiresBaseUrl: !!p.requiresBaseUrl,
    deployment: p.deployment ?? 'cloud',
  };
}

/* ─── Public API ─────────────────────────────────────────────────────────── */

export const api = {
  async health() {
    return attempt(request('GET', '/api/health').then((b) => b?.data ?? { status: 'down' }), { status: 'down' });
  },

  async sessions() {
    if (DEMO) return demoSeed();
    const body = await attempt(request('GET', '/api/sessions'), null);
    return Array.isArray(body?.data) ? body.data.map(adaptSession) : [];
  },

  async createSession(title) {
    if (DEMO) {
      return { id: `demo-${K.uid()}`, title, createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0, cost: 0 };
    }
    const body = await attempt(request('POST', '/api/sessions', { title }), null);
    return body?.data ? adaptSession(body.data)
      : { id: `local-${K.uid()}`, title, createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0, cost: 0 };
  },

  async renameSession(id, title) {
    if (DEMO) return true;
    return attempt(request('PATCH', `/api/sessions/${encodeURIComponent(id)}`, { title }).then(() => true), true);
  },

  async deleteSession(id) {
    if (DEMO) return true;
    return attempt(request('DELETE', `/api/sessions/${encodeURIComponent(id)}`).then(() => true), true);
  },

  async messages(sessionId) {
    if (DEMO) return [];
    const body = await attempt(request('GET', `/api/messages/${encodeURIComponent(sessionId)}`), null);
    return Array.isArray(body?.data) ? body.data.map(adaptMessage) : [];
  },

  /** Chat send: returns {ok} immediately; the reply streams over the socket. */
  async chat({ sessionId, content, model, reasoning }) {
    if (DEMO) return { ok: true };
    const body = await attempt(request('POST', '/api/messages', {
      sessionId,
      content,
      model: model ?? 'auto',
      reasoningLevel: reasoning ?? 'medium',
    }), null);
    return { ok: body?.ok === true };
  },

  async providers() {
    if (DEMO) return [];
    const body = await attempt(request('GET', '/api/providers'), null);
    return Array.isArray(body?.data) ? body.data.map(adaptProvider) : [];
  },

  /**
   * Connect a provider. For base-URL providers (ollama) the "key" input is
   * its base URL; everything else is an API key.
   */
  async setProviderKey(id, value) {
    if (DEMO) return { ok: true };
    const payload = /^https?:\/\//i.test(value) || id === 'ollama'
      ? { baseUrl: value }
      : { apiKey: value };
    const body = await attempt(request('PUT', `/api/providers/${encodeURIComponent(id)}`, payload), null);
    return { ok: body?.ok === true };
  },

  /* ── Memory (three-tier markdown docs) ──────────────────────────────────
   * tier is a path segment: 'universal' | 'project' | 'session/<id>'.
   *   GET  /api/memory/<tier> → {ok,data:{content}}
   *   PUT  /api/memory/<tier> {content} → {ok}
   */
  async getMemory(tier) {
    if (DEMO) return '';
    const body = await attempt(request('GET', `/api/memory/${tier}`), null);
    return body?.data?.content ?? '';
  },

  async putMemory(tier, content) {
    if (DEMO) return { ok: true };
    const body = await attempt(request('PUT', `/api/memory/${tier}`, { content }), null);
    return { ok: body?.ok === true };
  },

  /* ── Notes graph (all return the {ok,data} envelope; unwrap .data) ─────── */
  async listNotes() {
    if (DEMO) return [];
    const body = await attempt(request('GET', '/api/notes'), null);
    return Array.isArray(body?.data) ? body.data : [];
  },

  async createNote(title, content) {
    if (DEMO) return { id: `demo-note-${K.uid()}`, title, content, createdAt: Date.now(), updatedAt: Date.now() };
    const body = await attempt(request('POST', '/api/notes', { title, content }), null);
    return body?.data ?? null;
  },

  async updateNote(id, patch) {
    if (DEMO) return { id, ...patch };
    const body = await attempt(request('PUT', `/api/notes/${encodeURIComponent(id)}`, patch), null);
    return body?.data ?? null;
  },

  async deleteNote(id) {
    if (DEMO) return { ok: true };
    const body = await attempt(request('DELETE', `/api/notes/${encodeURIComponent(id)}`), null);
    return { ok: body?.ok === true };
  },

  async config() {
    if (DEMO) return { version: '0.1.0', projectName: 'Koryphaios', workspace: null };
    const [health, project] = await Promise.all([
      attempt(request('GET', '/api/health'), null),
      attempt(request('GET', '/api/project'), null),
    ]);
    return {
      version: health?.data?.version ?? '0.1.0',
      projectName: project?.data?.projectName ?? 'Koryphaios',
      workspace: null,
    };
  },
};

/* ─── WebSocket client ───────────────────────────────────────────────────── */

/**
 * Realtime socket speaking the original envelope protocol.
 * status Store: 'connecting' | 'connected' | 'error'
 *
 * Server frames {type, payload, timestamp, sessionId, agentId} are adapted
 * and re-emitted on K.events as UI-level events:
 *   stream.delta     → ws:token        {token, sessionId, agent}
 *   stream.thinking  → ws:feed.entry   {entry:{type:'thinking', ...}}
 *   kory.thought     → ws:feed.entry   {entry:{type:'thought', ...}}
 *   kory.routing     → ws:feed.entry   {entry:{type:'routing', ...}}
 *   agent.error      → ws:feed.entry   {entry:{type:'error', ...}}
 *   system.error     → ws:feed.entry   {entry:{type:'error', ...}}
 *   system.info      → ws:feed.entry   {entry:{type:'system', ...}}
 *   agent.status     → ws:agent.status {status}
 *   session.updated  → ws:session.created + ws:session.updated {session}
 *   provider.status  → ws:providers    {providers} (adapted)
 * Every raw frame is also emitted as ws:raw:<type> for future surfaces.
 */
export class Socket {
  constructor(path = '/ws') {
    this.path = path;
    this.status = new K.Store(DEMO ? 'connected' : 'connecting');
    this._attempts = 0;
    this._timer = 0;
    this._closed = false;
    this._ws = null;
    this._subscribed = new Set();
  }

  async connect() {
    if (DEMO || this._closed) return;
    this.status.set(this._attempts === 0 ? 'connecting' : this.status.get());
    await ensureAuth();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const auth = bearer ? `?auth=${encodeURIComponent(bearer)}` : '';
    let ws;
    try {
      ws = new WebSocket(`${proto}://${location.host}${this.path}${auth}`, ['koryphaios']);
    } catch {
      this._scheduleReconnect();
      return;
    }
    this._ws = ws;

    ws.onopen = () => {
      this._attempts = 0;
      this.status.set('connected');
      // subscriptions are per-connection server-side; replay them
      for (const sid of this._subscribed) {
        this.send({ type: 'subscribe_session', sessionId: sid, timestamp: Date.now() });
      }
      K.events.emit('ws:open');
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (!msg || typeof msg.type !== 'string') return;
      this._dispatch(msg);
    };
    ws.onclose = () => {
      if (this._closed) return;
      this.status.set(this._attempts >= 3 ? 'error' : 'connecting');
      this._scheduleReconnect();
    };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
  }

  _dispatch(msg) {
    const p = msg.payload ?? {};
    const sid = msg.sessionId ?? null;
    K.events.emit(`ws:raw:${msg.type}`, msg);
    switch (msg.type) {
      case 'stream.delta':
        K.events.emit('ws:token', { token: p.content ?? '', sessionId: sid, agent: 'kory' });
        break;
      case 'stream.thinking':
        K.events.emit('ws:feed.entry', { sessionId: sid, entry: { type: 'thinking', content: p.thinking ?? '', createdAt: msg.timestamp } });
        break;
      case 'kory.thought':
        K.events.emit('ws:feed.entry', { sessionId: sid, entry: { type: 'thought', content: p.thought ?? '', createdAt: msg.timestamp } });
        break;
      case 'kory.routing':
        K.events.emit('ws:feed.entry', {
          sessionId: sid,
          entry: {
            type: 'routing',
            content: `Routed to ${p.selectedProvider ?? '?'}:${p.selectedModel ?? '?'} — ${p.reasoning ?? ''}`,
            createdAt: msg.timestamp,
          },
        });
        break;
      case 'stream.tool_call':
        K.events.emit('ws:feed.entry', {
          sessionId: sid,
          entry: { type: 'tool_call', content: `${p.toolCall?.name ?? 'tool'}(${JSON.stringify(p.toolCall?.input ?? {})})`, createdAt: msg.timestamp },
        });
        break;
      case 'stream.tool_result':
        K.events.emit('ws:feed.entry', {
          sessionId: sid,
          entry: { type: 'tool_result', content: p.toolResult?.output ?? '', tool: p.toolResult?.name, createdAt: msg.timestamp },
        });
        break;
      case 'agent.error':
      case 'system.error':
        K.events.emit('ws:feed.entry', { sessionId: sid, entry: { type: 'error', content: p.error ?? 'Unknown error', createdAt: msg.timestamp } });
        break;
      case 'system.info':
        K.events.emit('ws:feed.entry', { sessionId: sid, entry: { type: 'system', content: p.message ?? '', createdAt: msg.timestamp } });
        break;
      case 'agent.status':
        K.events.emit('ws:agent.status', { status: p.status, sessionId: sid });
        break;
      case 'kory.ask_user':
        K.events.emit('ws:ask', {
          sessionId: sid,
          question: p.question ?? '',
          options: Array.isArray(p.options) ? p.options : [],
          allowOther: p.allowOther !== false,
        });
        break;
      case 'agent.spawned': {
        const a = p.agent ?? {};
        const role = a.role ?? 'agent';
        const dom = a.domain ? ` (${a.domain})` : '';
        K.events.emit('ws:feed.entry', {
          sessionId: sid,
          entry: { type: 'agent_group', content: `Spawned ${role}${dom}: ${p.task ?? ''}`, createdAt: msg.timestamp },
        });
        break;
      }
      case 'session.updated': {
        if (!p.session) break;
        const session = adaptSession(p.session);
        K.events.emit('ws:session.created', { session });
        K.events.emit('ws:session.updated', { session });
        break;
      }
      case 'provider.status':
        K.events.emit('ws:providers', { providers: (p.providers ?? []).map(adaptProvider) });
        break;
      case 'stream.usage':
        K.events.emit('ws:usage', { ...p, sessionId: sid });
        break;
      default:
        break;
    }
  }

  /** Subscribe to a session's event stream (replayed on every reconnect). */
  subscribe(sessionId) {
    if (!sessionId || this._subscribed.has(sessionId)) return;
    this._subscribed.add(sessionId);
    this.send({ type: 'subscribe_session', sessionId, timestamp: Date.now() });
  }

  /** Answer a pending kory.ask_user question, resuming the agent. */
  answerUser(sessionId, selection, text) {
    this.send({ type: 'user_input', sessionId, selection: selection ?? '', text: text ?? '', timestamp: Date.now() });
  }

  _scheduleReconnect() {
    clearTimeout(this._timer);
    const delay = Math.min(30000, 1000 * 2 ** this._attempts) + Math.random() * 400;
    this._attempts += 1;
    if (this._attempts >= 4) this.status.set('error');
    this._timer = setTimeout(() => this.connect(), delay);
  }

  send(obj) {
    if (this._ws?.readyState === WebSocket.OPEN) this._ws.send(JSON.stringify(obj));
  }

  close() {
    this._closed = true;
    clearTimeout(this._timer);
    this._ws?.close();
  }
}
