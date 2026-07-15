/**
 * app.js — the Koryphaios application, built on the K toolkit.
 *
 * Layout: sidebar / titlebar / agent feed / composer, plus the settings
 * overlay and the command palette. State lives in K.Store instances; the
 * REST + WS clients live in /api.js.
 */

import { K } from '/toolkit.js';
import { api, Socket, DEMO } from '/api.js';

const { el, icon, cx } = K;

/* ═══ State ═══════════════════════════════════════════════════════════════ */

const LAYOUT_KEY = 'koryphaios-layout-prefs';

function loadLayoutPrefs() {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY)) ?? {}; } catch { return {}; }
}

/* ═══ Theme (presets / accents / fonts) ═══════════════════════════════════
 * Colors are applied at runtime by writing CSS custom properties onto
 * document.documentElement — exactly like the original theme store. The
 * selection persists in localStorage['koryphaios-theme'] and is re-applied
 * before first paint (see the module-level applyTheme() call below).
 */

const THEME_KEY = 'koryphaios-theme';
const THEME_DEFAULT = { preset: 'kintsugi', accent: 'gold', font: 'inter' };

// Each preset overrides the surface / border / text scale. Status colors are
// left at their :root defaults (they read well on every preset here).
const THEME_PRESETS = {
  kintsugi: {
    '--color-surface-0': '#0D0B0A', '--color-surface-1': '#141210', '--color-surface-2': '#1C1917',
    '--color-surface-3': '#262220', '--color-surface-4': '#302B28',
    '--color-border': 'rgba(213, 178, 97, 0.16)', '--color-border-bright': 'rgba(213, 178, 97, 0.36)',
    '--color-text-primary': '#F6EFE2', '--color-text-secondary': 'rgba(214, 206, 192, 0.74)',
    '--color-text-muted': 'rgba(214, 206, 192, 0.40)',
  },
  obsidian: {
    '--color-surface-0': '#050506', '--color-surface-1': '#0C0C0F', '--color-surface-2': '#141418',
    '--color-surface-3': '#1D1D22', '--color-surface-4': '#26262D',
    '--color-border': 'rgba(180, 190, 210, 0.10)', '--color-border-bright': 'rgba(180, 190, 210, 0.22)',
    '--color-text-primary': '#EEF0F4', '--color-text-secondary': 'rgba(210, 215, 225, 0.72)',
    '--color-text-muted': 'rgba(210, 215, 225, 0.40)',
  },
  parchment: {
    '--color-surface-0': '#FAF6EE', '--color-surface-1': '#F4EDE0', '--color-surface-2': '#ECE2D1',
    '--color-surface-3': '#E2D5BE', '--color-surface-4': '#D6C5A8',
    '--color-border': 'rgba(120, 90, 40, 0.18)', '--color-border-bright': 'rgba(120, 90, 40, 0.36)',
    '--color-text-primary': '#2A2118', '--color-text-secondary': 'rgba(60, 48, 32, 0.80)',
    '--color-text-muted': 'rgba(60, 48, 32, 0.52)',
  },
};

const THEME_ACCENTS = {
  gold: { main: '#D5B261', hover: '#F3DDB0' },
  emerald: { main: '#10b981', hover: '#34d399' },
  azure: { main: '#3b82f6', hover: '#60a5fa' },
  rose: { main: '#f43f5e', hover: '#fb7185' },
};

const THEME_FONTS = {
  inter: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  jetbrains: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  georgia: "Georgia, 'Times New Roman', serif",
};

const PRESET_OPTIONS = [
  { value: 'kintsugi', label: 'Kintsugi', desc: 'Warm near-black with gold (default)' },
  { value: 'obsidian', label: 'Obsidian', desc: 'Deep neutral dark' },
  { value: 'parchment', label: 'Parchment', desc: 'Warm light theme' },
];
const ACCENT_OPTIONS = [
  { value: 'gold', label: 'Kintsugi Gold', color: '#D5B261' },
  { value: 'emerald', label: 'Emerald', color: '#10b981' },
  { value: 'azure', label: 'Azure', color: '#3b82f6' },
  { value: 'rose', label: 'Rose', color: '#f43f5e' },
];
const FONT_OPTIONS = [
  { value: 'inter', label: 'Inter', category: 'Sans Serif', family: THEME_FONTS.inter },
  { value: 'system', label: 'System UI', category: 'Sans Serif', family: THEME_FONTS.system },
  { value: 'jetbrains', label: 'JetBrains Mono', category: 'Monospace', family: THEME_FONTS.jetbrains },
  { value: 'georgia', label: 'Georgia', category: 'Serif', family: THEME_FONTS.georgia },
];

function loadTheme() {
  try { return { ...THEME_DEFAULT, ...(JSON.parse(localStorage.getItem(THEME_KEY)) ?? {}) }; }
  catch { return { ...THEME_DEFAULT }; }
}

function applyTheme(cfg) {
  const root = document.documentElement;
  const preset = THEME_PRESETS[cfg.preset] ?? THEME_PRESETS.kintsugi;
  for (const [key, val] of Object.entries(preset)) root.style.setProperty(key, val);
  const accent = THEME_ACCENTS[cfg.accent] ?? THEME_ACCENTS.gold;
  root.style.setProperty('--color-accent', accent.main);
  root.style.setProperty('--color-accent-hover', accent.hover);
  root.style.setProperty('--font-sans', THEME_FONTS[cfg.font] ?? THEME_FONTS.inter);
  const isLight = cfg.preset === 'parchment';
  root.setAttribute('data-theme', isLight ? 'light' : 'dark');
  root.style.colorScheme = isLight ? 'light' : 'dark';
}

const S = {
  sessions: new K.Store([]),
  activeSessionId: new K.Store(null),
  searchQuery: new K.Store(''),
  feed: new K.Store([]),                 // entries for the active session
  providers: new K.Store([]),
  config: new K.Store({ version: '0.1.0', projectName: 'Koryphaios', workspace: null }),
  sidebarCollapsed: new K.Store(Boolean(loadLayoutPrefs().sidebarCollapsed)),
  zenMode: new K.Store(false),
  settingsOpen: new K.Store(false),
  settingsTab: new K.Store('providers'),
  managerStatus: new K.Store('idle'),    // idle | streaming | thinking
  model: new K.Store('auto'),
  reasoning: new K.Store('medium'),
  agentMode: new K.Store('auto'),        // auto | single | multi
  critic: new K.Store(true),
  theme: new K.Store(loadTheme()),
};

// Re-apply the saved theme immediately, before the app mounts, so the very
// first paint is already in the chosen preset/accent/font.
applyTheme(S.theme.get());

/** Merge a theme patch, persist it, and recolor the whole app live. */
function setTheme(patch) {
  S.theme.update((cfg) => {
    const next = { ...cfg, ...patch };
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
}

const socket = new Socket('/ws');

const hasProvider = K.computed(S.providers, (list) => list.some((p) => p.configured));

function persistLayout() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ sidebarCollapsed: S.sidebarCollapsed.get() }));
  } catch { /* private mode */ }
}

/* ═══ Toasts (tiny, toolkit-flavoured) ════════════════════════════════════ */

let toastHost = null;
function toast(message) {
  if (!toastHost) {
    toastHost = el('div', { style: 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:800;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;' });
    document.body.appendChild(toastHost);
  }
  const node = el('div', {
    style: 'padding:8px 14px;border-radius:10px;background:var(--color-surface-3);border:1px solid var(--color-border);color:var(--color-text-secondary);font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:fly-up 200ms var(--ease-out);',
  }, message);
  toastHost.appendChild(node);
  setTimeout(() => { node.style.opacity = '0'; node.style.transition = 'opacity 240ms'; }, 2400);
  setTimeout(() => node.remove(), 2700);
}

/* ═══ Session actions ═════════════════════════════════════════════════════ */

async function refreshSessions() {
  const sessions = await api.sessions();
  S.sessions.set(sessions);
  const active = S.activeSessionId.get();
  if (active && !sessions.some((s) => s.id === active)) S.activeSessionId.set(sessions[0]?.id ?? null);
  if (!active && DEMO && sessions.length) S.activeSessionId.set(sessions[0].id);
}

async function createSession() {
  const session = await api.createSession('New Session');
  if (!session) return;
  S.sessions.update((list) => [session, ...list]);
  S.activeSessionId.set(session.id);
  S.feed.set([]);
  focusComposer();
}

async function selectSession(id) {
  if (S.activeSessionId.get() === id) return;
  S.activeSessionId.set(id);
  const messages = await api.messages(id);
  S.feed.set(messages.map(messageToEntry));
}

async function renameSession(id, title) {
  S.sessions.update((list) => list.map((s) => (s.id === id ? { ...s, title } : s)));
  await api.renameSession(id, title);
}

async function deleteSession(id) {
  const ok = await K.confirm({
    title: 'Delete Session?',
    message: 'This permanently deletes the session and its history.',
    confirmLabel: 'Delete Session',
    cancelLabel: 'Cancel',
    danger: true,
  });
  if (!ok) return;
  S.sessions.update((list) => list.filter((s) => s.id !== id));
  if (S.activeSessionId.get() === id) {
    S.activeSessionId.set(S.sessions.get()[0]?.id ?? null);
    S.feed.set([]);
  }
  await api.deleteSession(id);
}

function messageToEntry(m) {
  return {
    id: m.id ?? K.uid(),
    ts: m.createdAt ?? Date.now(),
    type: m.type ?? (m.role === 'user' ? 'user_message' : 'content'),
    agent: m.agent ?? null,
    text: m.content ?? '',
    tool: m.tool ?? null,
  };
}

function groupSessions(sessions, query) {
  const q = query.trim().toLowerCase();
  const filtered = q ? sessions.filter((s) => (s.title ?? '').toLowerCase().includes(q)) : sessions;
  const groups = [];
  const byLabel = new Map();
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  for (const s of filtered) {
    const d = new Date(s.updatedAt ?? s.createdAt ?? Date.now());
    let label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (d.toDateString() === now.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    if (!byLabel.has(label)) { byLabel.set(label, []); groups.push({ label, sessions: byLabel.get(label) }); }
    byLabel.get(label).push(s);
  }
  return { groups, count: filtered.length };
}

/* ═══ Composer helpers ════════════════════════════════════════════════════ */

let composerTextarea = null;

function focusComposer() { composerTextarea?.focus(); }

function loadIntoComposer(text) {
  if (!composerTextarea) return;
  const current = composerTextarea.value.trim();
  composerTextarea.value = current ? `${current}\n\n${text}` : text;
  composerTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  composerTextarea.focus();
  composerTextarea.setSelectionRange(composerTextarea.value.length, composerTextarea.value.length);
}

const REASONING_LEVELS = [
  { value: 'none', label: 'None', icon: 'brain', desc: 'No extended thinking — fastest responses.', dim: true },
  { value: 'low', label: 'Low', icon: 'brain', desc: 'Brief reasoning for straightforward tasks.' },
  { value: 'medium', label: 'Medium', icon: 'brain-cog', desc: 'Balanced depth for most work.' },
  { value: 'high', label: 'High', icon: 'brain-circuit', desc: 'Deep reasoning for hard problems.' },
];

const AGENT_MODES = [
  { value: 'auto', label: 'Auto', icon: 'sparkles', desc: 'Kory decides per task' },
  { value: 'single', label: 'Single Agent', icon: 'user', desc: 'One agent handles everything' },
  { value: 'multi', label: 'Multi-Agent', icon: 'users', desc: 'Always delegate to specialist workers' },
];

function reasoningMeta(value) {
  return REASONING_LEVELS.find((r) => r.value === value) ?? REASONING_LEVELS[2];
}

async function sendMessage() {
  if (!hasProvider.get()) return;
  const content = composerTextarea?.value.trim();
  if (!content) return;
  let sessionId = S.activeSessionId.get();
  if (!sessionId) {
    const session = await api.createSession('New Session');
    S.sessions.update((list) => [session, ...list]);
    S.activeSessionId.set(session.id);
    sessionId = session.id;
  }
  S.feed.update((list) => [...list, {
    id: K.uid(), ts: Date.now(), type: 'user_message', agent: null, text: content, tool: null,
  }]);
  composerTextarea.value = '';
  composerTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  await api.chat({
    sessionId,
    content,
    model: S.model.get(),
    reasoning: S.reasoning.get(),
    critic: S.critic.get(),
  });
}

/* ═══ Titlebar ════════════════════════════════════════════════════════════ */

class Titlebar extends K.Component {
  render() {
    this.bind(S.sidebarCollapsed);
    this.bind(S.zenMode);

    if (S.zenMode.get()) {
      return el('button', {
        type: 'button',
        style: 'position:absolute;top:6px;right:16px;z-index:20;padding:6px 14px;font-size:12px;border:1px solid var(--color-border);border-radius:9999px;background:var(--color-surface-2);color:var(--color-text-secondary);box-shadow:0 10px 15px -3px rgba(0,0,0,.3);',
        onclick: () => S.zenMode.set(false),
      }, 'Exit Zen');
    }

    const menuBtn = (label, build) => {
      const btn = el('button', { type: 'button', class: 'menu-btn' }, label);
      btn.addEventListener('click', () => {
        btn.classList.add('open');
        K.dropdown(btn, build, {
          width: label === 'File' ? 260 : 220,
          onClose: () => btn.classList.remove('open'),
        });
      });
      return btn;
    };

    const fileMenu = (close) => [
      K.menuItem('New Project', () => { close(); toast('Project creation needs the desktop shell.'); }),
      K.menuItem('Open Project...', () => { close(); toast('Project picker needs the desktop shell.'); }),
      K.menuItem('Open Workspace...', () => { close(); toast('Workspace picker needs the desktop shell.'); }),
      K.menuItem('Import Project File...', () => { close(); toast('Import needs the desktop shell.'); }, { muted: true }),
      K.menuDivider(),
      K.menuLabel('Recent projects'),
      el('div', { class: 'k-menu-item is-muted', style: 'cursor:default' }, 'No recent projects yet'),
      K.menuDivider(),
      K.menuItem('New Session', () => { close(); createSession(); }),
    ];

    const editMenu = (close) => [
      K.menuItem('Focus Prompt Input', () => { close(); focusComposer(); }),
      K.menuItem('Clear Current Feed', () => { close(); S.feed.set([]); }),
      K.menuDivider(),
      ...[
        ['Insert PRD Template', 'Build Spec\n- Problem:\n- Target user:\n- Success metrics:\n\nRequirements\n- Must have:\n- Nice to have:\n- Out of scope:'],
        ['Insert Bugfix Template', 'Bug Report\n- Expected:\n- Actual:\n- Repro steps:\n- Environment:'],
        ['Insert Refactor Template', 'Refactor Plan\n- Target module:\n- Motivation:\n- Constraints:\n- Verification:'],
        ['Insert Ship Checklist', 'Ship Checklist\n- Tests green:\n- Docs updated:\n- Changelog entry:\n- Rollback plan:'],
      ].map(([label, content]) => K.menuItem(label, () => { close(); loadIntoComposer(content); })),
    ];

    const viewMenu = (close) => [
      K.menuItem(`${S.sidebarCollapsed.get() ? 'Show' : 'Hide'} Sidebar`, () => {
        close();
        S.sidebarCollapsed.update((v) => !v);
        persistLayout();
      }),
      K.menuItem(`${S.zenMode.get() ? 'Disable' : 'Enable'} Zen Mode`, () => { close(); S.zenMode.update((v) => !v); }),
      K.menuItem('Switch Theme...', () => { close(); openSettings('appearance'); }),
      K.menuItem('Open Settings', () => { close(); openSettings(); }),
    ];

    const sidebarToggle = el('button', {
      type: 'button',
      class: 'titlebar-btn',
      onclick: () => { S.sidebarCollapsed.update((v) => !v); persistLayout(); },
    }, `Sidebar ${S.sidebarCollapsed.get() ? 'off' : 'on'}`);

    return el('header', { class: 'titlebar' },
      el('div', { class: 'titlebar-menus' },
        menuBtn('File', fileMenu),
        menuBtn('Edit', editMenu),
        menuBtn('View', viewMenu),
      ),
      el('div', { class: 'titlebar-center' },
        el('div', { class: 'titlebar-project' }, S.config.get().projectName ?? 'Koryphaios'),
      ),
      el('div', { class: 'titlebar-right' },
        sidebarToggle,
        el('button', {
          type: 'button', class: 'titlebar-btn',
          onclick: () => toast('Open a git workspace to use Source Control.'),
        }, icon('git-branch', 14), el('span', null, 'Git')),
        el('button', {
          type: 'button', class: 'titlebar-btn', style: 'gap:8px',
          onclick: () => openPalette(),
        }, icon('search', 14), el('span', null, 'Commands'), el('kbd', { class: 'kbd' }, 'CtrlK')),
        el('button', {
          type: 'button', class: 'titlebar-gear', 'aria-label': 'Open settings',
          onclick: () => openSettings(),
        }, icon('settings', 18)),
      ),
    );
  }
}

/* ═══ Sidebar ═════════════════════════════════════════════════════════════ */

class SessionList extends K.Component {
  render() {
    this.bind(S.sessions);
    this.bind(S.activeSessionId);
    this.bind(S.searchQuery);

    const { groups, count } = groupSessions(S.sessions.get(), S.searchQuery.get());
    const active = S.activeSessionId.get();
    const editingId = this.state.editingId;

    const rows = (group) => group.sessions.map((session) => {
      if (editingId === session.id) return this.renameRow(session);

      const row = el('div', {
        class: cx('session-item', active === session.id && 'active'),
        role: 'button',
        tabindex: 0,
        onclick: () => selectSession(session.id),
        ondblclick: () => this.setState({ editingId: session.id, draft: session.title }),
        onkeydown: (e) => { if (e.key === 'Enter') selectSession(session.id); },
      },
        el('div', { class: 'session-chip' }, icon('message-square', 12)),
        el('div', { class: 'session-info' },
          el('div', { class: 'session-title' }, session.title),
          el('div', { class: 'session-meta' },
            el('span', null, K.formatTime(session.updatedAt ?? session.createdAt ?? Date.now())),
            session.messageCount > 0 ? el('span', null, `${session.messageCount} msgs`) : null,
            session.cost > 0 ? el('span', null, `$${Number(session.cost).toFixed(3)}`) : null,
          ),
        ),
        el('div', { class: 'session-actions' },
          K.tooltip(el('button', {
            type: 'button', class: 'icon-btn', 'aria-label': 'Rename session',
            onclick: (e) => { e.stopPropagation(); this.setState({ editingId: session.id, draft: session.title }); },
          }, icon('pencil', 12)), 'Rename'),
          K.tooltip(el('button', {
            type: 'button', class: 'icon-btn', 'aria-label': 'Delete session',
            onclick: (e) => { e.stopPropagation(); deleteSession(session.id); },
          }, icon('trash-2', 12)), 'Delete'),
        ),
      );
      return row;
    });

    return el('div', { class: 'session-list' },
      groups.map((group) => el('div', { class: 'session-group' },
        el('div', { class: 'session-group-label' }, group.label),
        rows(group),
      )),
      count === 0 && el('div', { class: 'sessions-empty' },
        icon('message-square', 24),
        el('p', null, S.searchQuery.get() ? 'No matching sessions' : 'No sessions yet'),
      ),
    );
  }

  renameRow(session) {
    let inputRef = null;
    const save = () => {
      const title = inputRef.value.trim();
      if (!title) return;
      renameSession(session.id, title);
      this.setState({ editingId: null });
    };
    const cancel = () => this.setState({ editingId: null });
    const row = el('div', { class: 'session-item' },
      el('div', { class: 'session-rename' },
        el('div', { class: 'session-rename-row' },
          el('input', {
            class: 'input', type: 'text', maxlength: 80, value: this.state.draft ?? session.title,
            ref: (n) => { inputRef = n; },
            onclick: (e) => e.stopPropagation(),
            onkeydown: (e) => {
              e.stopPropagation();
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            },
          }),
          el('button', { type: 'button', class: 'icon-btn', style: 'padding:2px;color:var(--color-success)', onclick: (e) => { e.stopPropagation(); save(); }, 'aria-label': 'Save rename' }, icon('check', 12)),
          el('button', { type: 'button', class: 'icon-btn', style: 'padding:2px', onclick: (e) => { e.stopPropagation(); cancel(); }, 'aria-label': 'Cancel rename' }, icon('x', 12)),
        ),
        el('span', { class: 'session-rename-count' }, `${(this.state.draft ?? session.title).length}/80`),
      ),
    );
    requestAnimationFrame(() => { inputRef?.focus(); inputRef?.select(); });
    return row;
  }
}

class Sidebar extends K.Component {
  constructor(props) {
    super(props);
    this.list = new SessionList();
  }

  render() {
    this.bind(S.sidebarCollapsed);
    this.bind(S.zenMode);

    if (S.zenMode.get()) return el('div', { style: 'display:none' });

    if (S.sidebarCollapsed.get()) {
      return el('div', { class: 'sidebar collapsed' },
        el('div', { class: 'sidebar-header' },
          K.tooltip(el('button', {
            type: 'button', class: 'icon-btn', 'aria-label': 'Show sidebar',
            onclick: () => { S.sidebarCollapsed.set(false); persistLayout(); },
          }, icon('chevron-right', 14)), 'Show sidebar'),
        ),
      );
    }

    const footer = el('div', { class: 'sidebar-footer' });
    const dot = el('div', { class: 'status-dot connected' });
    const statusLabel = el('span', null, 'Realtime connected');
    const right = el('div', { style: 'display:flex;align-items:center;gap:4px' });
    footer.append(el('div', { class: 'status' }, dot, statusLabel), right);

    this.bind(socket.status, (status) => {
      dot.className = cx('status-dot',
        status === 'connected' && 'connected',
        status === 'connecting' && 'connecting',
        status === 'error' && 'disconnected');
      statusLabel.textContent =
        status === 'connected' ? 'Realtime connected'
        : status === 'connecting' ? 'Realtime connecting…'
        : 'Realtime offline';
    });
    this.bind(S.providers, (providers) => {
      const n = providers.filter((p) => p.configured).length;
      K.swap(right, n > 0 ? el('span', { class: 'provider-count' }, `${n} providers`) : null);
    });

    return el('nav', { class: 'sidebar', 'aria-label': 'Session navigation' },
      el('div', { class: 'sidebar-header' },
        el('div', { class: 'sidebar-brand' },
          el('img', { class: 'sidebar-logo', src: '/logo-64.png', alt: 'Koryphaios' }),
          el('div', { class: 'sidebar-title-block' },
            el('h1', { class: 'sidebar-title' }, 'Koryphaios',
              // The reference screenshot predates the Beta pill; demo mode
              // reproduces the screenshot exactly, live mode shows the pill.
              DEMO ? null : el('span', { class: 'beta-pill', title: 'Koryphaios is in beta — expect rapid changes' }, 'Beta')),
            el('p', { class: 'sidebar-subtitle' }, 'Agent workspace'),
          ),
        ),
        K.tooltip(el('button', {
          type: 'button', class: 'icon-btn', 'aria-label': 'Hide sidebar',
          onclick: () => { S.sidebarCollapsed.set(true); persistLayout(); },
        }, icon('chevron-left', 14)), 'Hide sidebar'),
      ),
      el('div', { class: 'sidebar-body' },
        el('div', { class: 'sessions-header' },
          el('div', { style: 'min-width:0' },
            el('h2', null, 'Sessions'),
            el('p', null, 'Recent workspaces and agent runs'),
          ),
          K.tooltip(el('button', {
            type: 'button', class: 'icon-btn', 'aria-label': 'New session',
            onclick: () => createSession(),
          }, icon('plus', 16)), 'New session (Ctrl+N)'),
        ),
        el('div', { class: 'sessions-search' },
          el('div', { class: 'search-wrap' },
            icon('search', 14),
            el('input', {
              class: 'input', type: 'text', placeholder: 'Search sessions...',
              oninput: (e) => S.searchQuery.set(e.target.value),
            }),
          ),
        ),
        this.list.mount(),
      ),
      footer,
    );
  }
}

/* ═══ Agent feed ══════════════════════════════════════════════════════════ */

const SUGGESTIONS = [
  { id: 'map-codebase', label: 'Map the codebase', icon: 'zap', prompt: 'Inspect this project and summarize the architecture, key entry points, and the highest-leverage next steps.' },
  { id: 'critique-ui', label: 'Critique the UI', icon: 'paintbrush', prompt: 'Critique the current UI in this project, identify the weakest hierarchy and spacing choices, and recommend the most important visual fixes.' },
  { id: 'review-changes', label: 'Review recent changes', icon: 'git-branch', prompt: 'Review the current uncommitted changes in this project and identify the most likely bugs, regressions, or missing tests.' },
  { id: 'debug-regression', label: 'Debug a regression', icon: 'bug', prompt: 'Help me trace a bug in this project. Start by asking for the failing behavior or error, then narrow the likely root cause.' },
];

const ENTRY_ICONS = {
  user_message: 'send',
  content: 'message-square',
  thought: 'brain',
  thinking: 'brain',
  tool_call: 'wrench',
  tool_result: 'check',
  routing: 'git-branch',
  error: 'circle-alert',
  system: 'cpu',
  tool_group: 'terminal',
  agent_group: 'users',
};

class Feed extends K.Component {
  render() {
    this.bind(S.feed);
    const entries = S.feed.get();

    const scroll = el('div', { class: cx('feed-scroll', entries.length === 0 && 'scrollbar-none') },
      entries.length === 0 ? this.hero() : this.entryList(entries));
    this.scrollEl = scroll;

    return el('section', { class: 'feed-section', role: 'main', 'aria-label': 'Chat feed' },
      el('div', { class: 'panel-header' },
        el('span', { class: 'panel-title' }, icon('message-square', 16), 'Agent feed'),
        el('button', {
          type: 'button', class: 'pill-btn',
          onclick: () => { scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' }); },
        }, icon('arrow-down', 12), el('span', null, 'Bottom')),
      ),
      el('div', { class: 'feed-wrap' }, scroll),
    );
  }

  hero() {
    return el('div', { class: 'hero-wrap' },
      el('div', { class: 'hero-stack' },
        el('div', { class: 'hero-card' },
          el('div', { class: 'hero-badge' },
            el('div', { class: 'dot animate-pulse' }),
            el('span', null, 'Workspace Analyzed'),
          ),
          el('h2', { class: 'hero-title' }, 'What should Koryphaios do with your project?'),
          el('p', { class: 'hero-subtitle' }, "I'm connected and ready to help. Choose a strategic starting point or describe your task in the composer below."),
          el('div', { class: 'suggestion-grid' },
            SUGGESTIONS.map((sug) => el('div', {
              class: 'suggestion-card', role: 'button', tabindex: 0,
              onclick: () => loadIntoComposer(sug.prompt),
              onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadIntoComposer(sug.prompt); } },
            },
              el('div', { class: 'suggestion-glow' }),
              el('button', {
                type: 'button', class: 'suggestion-edit', 'aria-label': `Edit ${sug.label}`,
                onclick: (e) => { e.stopPropagation(); loadIntoComposer(sug.prompt); },
              }, icon('pencil', 14)),
              el('div', { class: 'suggestion-tile' }, icon(sug.icon, 19)),
              el('span', { class: 'suggestion-label' }, sug.label),
              el('span', { class: 'suggestion-prompt' }, sug.prompt),
              el('div', { class: 'suggestion-cta' }, 'Load into composer ', icon('arrow-down', 10)),
            )),
          ),
        ),
        el('div', { class: 'tips-grid' },
          el('div', { class: 'tip-card' },
            el('div', null,
              el('div', { class: 'tip-card-label' }, 'Pro Tips'),
              el('div', { class: 'tip-rows' },
                ['Ask for a repo walkthrough before making changes.', 'Review spacing and hierarchy before polish work.'].map((tip) =>
                  el('div', { class: 'tip-row' }, el('div', { class: 'dot amber' }), el('p', null, tip))),
              ),
            ),
            el('button', {
              type: 'button', class: 'tip-action',
              onclick: () => loadIntoComposer('Write a concrete implementation plan for the highest-priority improvement in this project.'),
            }, icon('beaker', 14), 'Plan next improvement'),
          ),
          el('div', { class: 'tip-card' },
            el('div', null,
              el('div', { class: 'tip-card-label' }, 'Workflow'),
              el('div', { class: 'tip-rows' },
                ['Use composer below for direct tasks.', 'Open Git panel for change review.'].map((tip) =>
                  el('div', { class: 'tip-row' }, el('div', { class: 'dot blue' }), el('p', null, tip))),
              ),
            ),
          ),
        ),
      ),
    );
  }

  entryList(entries) {
    const list = el('div', { class: 'feed-list' }, entries.map((entry) => this.entryRow(entry)));
    requestAnimationFrame(() => { this.scrollEl?.scrollTo({ top: this.scrollEl.scrollHeight }); });
    return list;
  }

  entryRow(entry) {
    const isBash = entry.tool?.name === 'bash' || entry.tool?.command;
    let body;
    if (isBash) {
      const block = el('div', { class: 'terminal-block' },
        el('div', {
          class: 'terminal-head',
          onclick: () => block.classList.toggle('expanded'),
        },
          icon('terminal', 13),
          el('span', { class: 'cmd' }, entry.tool.command ?? entry.text),
          icon('maximize-2', 12),
        ),
        entry.tool.output != null && el('div', { class: 'terminal-body' }, entry.tool.output),
      );
      body = block;
    } else {
      body = entry.text;
    }
    return el('div', { class: cx('feed-entry', `t-${entry.type}`) },
      el('span', { class: 'ts' }, K.formatClock(entry.ts)),
      el('div', { class: 'type-icon' }, icon(ENTRY_ICONS[entry.type] ?? 'message-square', 14)),
      el('div', { class: 'body' },
        entry.agent && el('div', { class: 'agent-label' }, entry.agent),
        body,
      ),
    );
  }
}

/* ═══ Composer ════════════════════════════════════════════════════════════ */

class Composer extends K.Component {
  render() {
    this.bind(hasProvider);
    this.bind(S.reasoning);
    this.bind(S.agentMode);
    this.bind(S.critic);
    this.bind(S.model);

    const configured = hasProvider.get();

    /* Setup banner */
    const banner = configured ? null : el('div', { class: 'setup-banner' },
      el('div', { class: 'lead' },
        el('span', { class: 'title' }, 'Setup required'),
        el('span', { class: 'msg' }, 'No model provider is configured. Open Settings and connect a provider before chatting.'),
      ),
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => openSettings('providers') }, 'Open Settings'),
    );

    /* Model pill */
    const modelLabel = S.model.get() === 'auto' ? 'Auto' : S.model.get();
    const modelPill = el('button', { type: 'button', class: 'selector-pill' },
      icon('sparkles', 16, { class: 'spark' }),
      el('span', null, modelLabel),
      icon('chevron-down', 14, { class: 'chev' }),
    );
    modelPill.addEventListener('click', () => {
      const models = [{ value: 'auto', label: 'Auto', desc: 'Kory routes to the best available model' }];
      for (const p of S.providers.get()) {
        if (p.configured) for (const m of p.models ?? []) models.push({ value: `${p.id}:${m}`, label: `(${p.name}) ${m}`, desc: p.name });
      }
      K.dropdown(modelPill, (close) => models.map((m) => el('button', {
        type: 'button', class: 'k-menu-item',
        style: S.model.get() === m.value ? 'color:var(--color-accent)' : '',
        onclick: () => { S.model.set(m.value); close(); },
      },
        el('span', { style: 'display:flex;flex-direction:column;gap:1px;align-items:flex-start' },
          el('span', { style: 'font-size:13px;font-weight:500' }, m.label),
          el('span', { style: 'font-size:10px;color:var(--color-text-muted)' }, m.desc),
        ),
        S.model.get() === m.value ? icon('check', 12) : null,
      )), { placement: 'top', width: 288 });
    });

    /* Reasoning pill */
    const meta = reasoningMeta(S.reasoning.get());
    const reasoningPill = el('button', { type: 'button', class: 'selector-pill', title: 'Set auto effort' },
      icon(meta.icon, 20, { strokeWidth: 1.9, style: meta.dim ? 'opacity:.45' : '' }),
      el('span', null, meta.label),
      icon('chevron-down', 14, { class: 'chev' }),
    );
    reasoningPill.addEventListener('click', () => {
      K.dropdown(reasoningPill, (close) => REASONING_LEVELS.map((opt) => el('button', {
        type: 'button', class: 'k-menu-item',
        onclick: () => { S.reasoning.set(opt.value); close(); },
      },
        el('span', { style: 'display:flex;flex-direction:column;gap:1px;align-items:flex-start' },
          el('span', { style: `font-size:13px;font-weight:600;${S.reasoning.get() === opt.value ? 'color:var(--color-accent)' : ''}` }, opt.label),
          el('span', { style: 'font-size:11px;color:var(--color-text-muted)' }, opt.desc),
        ),
        S.reasoning.get() === opt.value
          ? el('span', { style: 'width:6px;height:6px;border-radius:9999px;background:var(--color-accent);box-shadow:0 0 8px var(--color-accent)' })
          : null,
      )), { placement: 'top', width: 288 });
    });

    /* Textarea */
    const charCounter = el('span', null, '');
    const textarea = el('textarea', {
      rows: 1,
      placeholder: "What's the move?",
      disabled: !configured,
      oninput: () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(116, Math.min(textarea.scrollHeight, 280)) + 'px';
        charCounter.textContent = textarea.value.length > 0 ? `${textarea.value.length} chars` : '';
      },
      onkeydown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          sendMessage();
        }
      },
    });
    composerTextarea = textarea;

    /* Agent-mode + critic chips */
    const mode = AGENT_MODES.find((m) => m.value === S.agentMode.get()) ?? AGENT_MODES[0];
    const modeChip = el('button', {
      type: 'button',
      class: cx('chip', `mode-${mode.value}`),
      title: `Agent Mode: ${mode.label}`,
    }, icon(mode.icon, 12), el('span', null, mode.label));
    modeChip.addEventListener('click', () => {
      K.dropdown(modeChip, (close) => AGENT_MODES.map((opt) => el('button', {
        type: 'button', class: 'k-menu-item',
        onclick: () => { S.agentMode.set(opt.value); close(); },
      },
        el('span', { style: 'display:flex;align-items:flex-start;gap:10px' },
          icon(opt.icon, 13, { style: `margin-top:1px;color:${S.agentMode.get() === opt.value ? 'var(--color-accent)' : 'var(--color-text-muted)'}` }),
          el('span', { style: 'display:flex;flex-direction:column;gap:1px' },
            el('span', { style: `font-size:11px;font-weight:500;${S.agentMode.get() === opt.value ? 'color:var(--color-accent)' : ''}` }, opt.label),
            el('span', { style: 'font-size:10px;color:var(--color-text-muted)' }, opt.desc),
          ),
        ),
        S.agentMode.get() === opt.value ? icon('check', 12, { style: 'color:var(--color-accent)' }) : null,
      )), { placement: 'top', align: 'right', width: 224 });
    });

    const criticOn = S.critic.get();
    const criticChip = el('button', {
      type: 'button',
      class: cx('chip', criticOn ? 'critic-on' : 'off'),
      title: 'Toggle Critic Agent',
      onclick: () => S.critic.update((v) => !v),
    }, icon(criticOn ? 'shield-check' : 'shield-alert', 12), el('span', null, criticOn ? 'Critic: On' : 'Critic: Off'));

    /* Send */
    const sendBtn = el('button', {
      type: 'button',
      class: 'btn btn-primary send-btn',
      disabled: true,
      title: configured ? 'Type a message to send' : 'Configure a provider to enable sending',
      onclick: () => sendMessage(),
    }, icon('send', 18), 'Send');

    const updateSendState = () => {
      sendBtn.disabled = !configured || textarea.value.trim().length === 0;
    };
    textarea.addEventListener('input', updateSendState);
    updateSendState();

    return el('div', { class: 'composer-strip' },
      el('div', { class: 'command-input' },
        banner,
        el('div', { class: 'composer-box' },
          el('div', { class: 'composer-controls' }, modelPill, reasoningPill),
          el('div', { class: 'composer-row' },
            el('div', { class: cx('composer-field', !configured && 'disabled') },
              textarea,
              el('div', { class: 'composer-attach' },
                K.tooltip(el('button', { type: 'button', disabled: !configured, 'aria-label': 'Reference a file or folder' }, icon('paperclip', 16)), 'Reference a file or folder'),
                K.tooltip(el('button', { type: 'button', disabled: !configured, 'aria-label': 'Paste image from clipboard' }, icon('clipboard', 16)), 'Paste image (Ctrl+Shift+V)'),
              ),
            ),
            el('div', { class: 'action-panel' },
              el('div', { class: 'action-chips' }, modeChip, criticChip),
              sendBtn,
            ),
          ),
        ),
        el('div', { class: 'composer-caption' },
          el('span', null, configured
            ? 'Enter to send · Shift+Enter for new line · Ctrl+V paste text · Ctrl+Shift+V paste image'
            : 'Configure a provider to enable sending.'),
          charCounter,
        ),
      ),
    );
  }
}

/* ═══ Settings overlay ════════════════════════════════════════════════════ */

/**
 * KorySelect-style listbox: a full-width trigger that opens a floating
 * listbox (via K.dropdown) of options with a checkmark on the current one.
 * Matches the original KorySelect look (rounded-xl trigger + surface-2
 * popover). `renderValue`/`renderOption` customise how the selected value
 * and each option render (used for accent swatches and font previews).
 */
function korySelect({ value, options, onChange, ariaLabel, renderValue, renderOption }) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const trigger = el('button', {
    type: 'button', class: 'kory-select-trigger',
    'aria-haspopup': 'listbox', 'aria-label': ariaLabel ?? 'Select',
  },
    el('span', { class: 'kory-select-value' }, renderValue ? renderValue(current) : (current?.label ?? 'Select…')),
    icon('chevron-down', 15, { class: 'kory-select-chev' }),
  );
  trigger.addEventListener('click', () => {
    K.dropdown(trigger, (close) => el('div', { role: 'listbox', 'aria-label': ariaLabel ?? 'Select' },
      options.map((opt) => el('button', {
        type: 'button', role: 'option', 'aria-selected': String(opt.value === value),
        class: cx('kory-option', opt.value === value && 'selected'),
        onclick: () => { close(); onChange(opt.value); },
      },
        el('span', { class: 'kory-check' }, opt.value === value ? icon('check', 14) : null),
        renderOption ? renderOption(opt) : el('span', { style: 'min-width:0' },
          el('span', { class: 'kory-option-label' }, opt.label),
          opt.desc ? el('span', { class: 'kory-option-desc' }, opt.desc) : null,
        ),
      )),
    ), { width: Math.max(trigger.offsetWidth || 0, 240), class: 'kory-listbox' });
  });
  return el('div', { class: 'kory-select' }, trigger);
}

/** Single-line, markdown-stripped preview of a note body for the list. */
function noteSnippet(text, len = 90) {
  const s = (text ?? '').replace(/[#*`>_\-\[\]]/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return 'No content yet';
  return s.length > len ? `${s.slice(0, len)}…` : s;
}

const MEMORY_TIERS = [
  { id: 'universal', icon: 'brain', label: 'Universal Memory', sub: 'Shared across every project and session.' },
  { id: 'project', icon: 'file-text', label: 'Project Memory', sub: 'Context specific to this workspace.' },
  { id: 'session', icon: 'message-square', label: 'Session Memory', sub: 'Notes scoped to the active session.' },
];

const SHORTCUTS = [
  { label: 'Command palette', desc: 'Search and run any command', keys: ['Ctrl', 'K'] },
  { label: 'New session', desc: 'Create a session and focus the composer', keys: ['Ctrl', 'N'] },
  { label: 'Open settings', desc: 'This settings panel', keys: ['Ctrl', ','] },
  { label: 'Toggle sidebar', desc: 'Show or hide the sessions sidebar', keys: ['Ctrl', 'B'] },
  { label: 'Send message', desc: 'Submit the composer', keys: ['Enter'] },
  { label: 'New line', desc: 'Insert a newline without sending', keys: ['Shift', 'Enter'] },
];

const SETTINGS_TABS = [
  { id: 'providers', label: 'Providers', icon: 'key' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' },
  { id: 'billing', label: 'Billing', icon: 'credit-card' },
  { id: 'memory', label: 'Memory', icon: 'brain' },
  { id: 'agent', label: 'Agent', icon: 'bot' },
  { id: 'advanced', label: 'Advanced', icon: 'flask-conical' },
  { id: 'teams', label: 'Teams', icon: 'users' },
  { id: 'notes', label: 'Notes', icon: 'sticky-note' },
];

const DEFAULT_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', configured: false, models: ['claude-sonnet-4-5', 'claude-opus-4-6'], icon: 'sparkles' },
  { id: 'openai', name: 'OpenAI', configured: false, models: ['gpt-5.2', 'gpt-5.2-codex'], icon: 'bot' },
  { id: 'google', name: 'Google', configured: false, models: ['gemini-3-pro', 'gemini-3-flash'], icon: 'globe' },
  { id: 'openrouter', name: 'OpenRouter', configured: false, models: ['auto'], icon: 'refresh-cw' },
  { id: 'xai', name: 'xAI', configured: false, models: ['grok-4.1'], icon: 'zap' },
];

const STUB_COPY = {
  billing: ['Billing', 'Usage-based spend per provider, budgets and alerts appear here once a provider is connected.'],
  agent: ['Agent', 'Execution mode, critic gate, tool permissions and worker limits for the Kory manager agent.'],
  advanced: ['Advanced', 'Experimental flags, local model endpoints and diagnostic logging.'],
  teams: ['Teams', 'Host or join a shared team workspace and manage access profiles.'],
};

let settingsEl = null;
let settingsEscape = null;

class SettingsOverlay extends K.Component {
  render() {
    this.bind(S.settingsTab);
    const tab = S.settingsTab.get();
    // Only the tab that actually reads a store subscribes to it, so a live
    // providers/theme push never blows away a half-typed memory or note.
    if (tab === 'providers') this.bind(S.providers);
    if (tab === 'appearance') this.bind(S.theme);

    const content =
      tab === 'providers' ? this.providersTab()
      : tab === 'appearance' ? this.appearanceTab()
      : tab === 'memory' ? this.memoryTab()
      : tab === 'notes' ? this.notesTab()
      : tab === 'shortcuts' ? this.shortcutsTab()
      : this.stubTab(tab);

    return el('div', { class: 'settings-overlay' },
      el('div', { class: 'settings-header' },
        el('h2', null, 'Settings'),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close settings', onclick: () => closeSettings() }, icon('x', 18)),
      ),
      el('div', { class: 'settings-tabs' },
        SETTINGS_TABS.map((t) => el('button', {
          type: 'button',
          class: cx('settings-tab', tab === t.id && 'active'),
          onclick: () => S.settingsTab.set(t.id),
        }, icon(t.icon, 13), el('span', null, t.label))),
      ),
      el('div', { class: 'settings-content' },
        el('div', { class: 'settings-inner' }, content),
      ),
    );
  }

  /* ── Appearance ─────────────────────────────────────────────────────── */
  appearanceTab() {
    const cfg = S.theme.get();

    const field = (iconName, title, sub, control) => el('div', { class: 'appearance-field' },
      el('div', { class: 'appearance-field-head' },
        icon(iconName, 18),
        el('div', { style: 'min-width:0' },
          el('div', { class: 'appearance-field-title' }, title),
          el('div', { class: 'appearance-field-sub' }, sub),
        ),
      ),
      control,
    );

    const presetSelect = korySelect({
      value: cfg.preset, ariaLabel: 'Theme preset', options: PRESET_OPTIONS,
      onChange: (v) => setTheme({ preset: v }),
    });

    const accentSelect = korySelect({
      value: cfg.accent, ariaLabel: 'Accent color', options: ACCENT_OPTIONS,
      onChange: (v) => setTheme({ accent: v }),
      renderValue: (o) => [el('span', { class: 'kory-swatch', style: `background:${o.color}` }), el('span', null, o.label)],
      renderOption: (o) => el('span', { style: 'display:flex;align-items:center;gap:10px;min-width:0' },
        el('span', { class: 'kory-swatch', style: `background:${o.color}` }),
        el('span', { class: 'kory-option-label' }, o.label)),
    });

    const accentSwatches = el('div', { class: 'accent-swatches' },
      ACCENT_OPTIONS.map((o) => K.tooltip(el('button', {
        type: 'button', class: cx('accent-swatch-btn', cfg.accent === o.value && 'active'),
        style: `background:${o.color}`, 'aria-label': o.label,
        onclick: () => setTheme({ accent: o.value }),
      }, cfg.accent === o.value ? icon('check', 16) : null), o.label)),
    );

    const fontSelect = korySelect({
      value: cfg.font, ariaLabel: 'Font', options: FONT_OPTIONS,
      onChange: (v) => setTheme({ font: v }),
      renderValue: (o) => el('span', { style: `font-family:${o.family}` }, o.label),
      renderOption: (o) => el('span', { style: 'min-width:0' },
        el('span', { class: 'kory-option-label', style: `font-family:${o.family}` }, o.label),
        el('span', { class: 'kory-option-desc' }, o.category)),
    });

    return el('div', null,
      el('div', { class: 'settings-section-title' }, 'Appearance'),
      el('div', { class: 'settings-section-sub' }, 'Theme preset, accent color and interface font. Changes apply live and are saved to this browser.'),
      el('div', { class: 'settings-appearance' },
        field('palette', 'Theme preset', 'Application color scheme', presetSelect),
        field('zap', 'Accent color', 'Primary interaction color', el('div', { style: 'display:flex;flex-direction:column;gap:12px' }, accentSelect, accentSwatches)),
        field('file-text', 'Font', 'Interface typeface', fontSelect),
      ),
    );
  }

  /* ── Memory ─────────────────────────────────────────────────────────── */
  memoryTab() {
    const activeSession = S.activeSessionId.get();
    const tiers = el('div', { class: 'memory-tiers' });

    for (const t of MEMORY_TIERS) {
      const isSession = t.id === 'session';
      const disabled = isSession && !activeSession;
      const tierPath = isSession ? `session/${activeSession}` : t.id;
      let textarea = null;
      let dirty = false; // once the user edits, the async load must not clobber it

      const saveBtn = el('button', {
        type: 'button', class: 'btn btn-secondary settings-save-btn', disabled,
        onclick: async () => {
          const res = await api.putMemory(tierPath, textarea.value);
          if (res?.ok !== false) { dirty = false; toast('Saved'); }
          else toast('Could not save memory — is the backend running?');
        },
      }, icon('check', 13), 'Save');

      const card = el('div', { class: cx('memory-tier', disabled && 'disabled') },
        el('div', { class: 'memory-tier-head' },
          el('div', { class: 'lead' },
            el('div', { class: 'memory-tier-icon' }, icon(t.icon, 16)),
            el('div', { style: 'min-width:0' },
              el('div', { class: 'memory-tier-title' }, t.label),
              el('div', { class: 'memory-tier-sub' }, t.sub),
            ),
          ),
          saveBtn,
        ),
        disabled
          ? el('div', { class: 'memory-empty' }, 'Start or open a session to edit its memory.')
          : (textarea = el('textarea', {
              class: 'memory-textarea', spellcheck: 'false', placeholder: `Enter ${t.label.toLowerCase()}…`,
              oninput: () => { dirty = true; },
            })),
      );
      tiers.appendChild(card);

      if (!disabled) {
        api.getMemory(tierPath).then((content) => { if (textarea && !dirty) textarea.value = content; });
      }
    }

    return el('div', null,
      el('div', { class: 'settings-section-title' }, 'Memory'),
      el('div', { class: 'settings-section-sub' }, 'Long-lived context the agents recall. Universal spans everything, project is per-workspace, session is scoped to the current chat.'),
      tiers,
    );
  }

  /* ── Notes ──────────────────────────────────────────────────────────── */
  reloadNotes() {
    this._notesLoading = true;
    api.listNotes().then((list) => { this._notesLoading = false; this.setState({ notes: list }); });
  }

  async newNote() {
    const note = await api.createNote('Untitled', '');
    if (!note) { toast('Could not create note — is the backend running?'); return; }
    this.state.editingNoteId = note.id;
    this.reloadNotes();
  }

  noteEditor(note) {
    let titleInput = null;
    let contentArea = null;
    const save = async () => {
      const updated = await api.updateNote(note.id, {
        title: titleInput.value.trim() || 'Untitled',
        content: contentArea.value,
      });
      toast(updated ? 'Saved' : 'Could not save note.');
      this.reloadNotes();
    };
    const del = async () => {
      const ok = await K.confirm({
        title: 'Delete note?', message: 'This permanently removes the note.',
        confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true,
      });
      if (!ok) return;
      await api.deleteNote(note.id);
      toast('Note deleted');
      this.state.editingNoteId = null;
      this.reloadNotes();
    };
    return el('div', { class: 'note-editor' },
      el('input', {
        class: 'input note-title-input', type: 'text', value: note.title ?? '',
        placeholder: 'Note title', maxlength: 200,
        ref: (n) => { titleInput = n; },
      }),
      el('textarea', {
        class: 'note-content-area', spellcheck: 'false', placeholder: 'Write your note in markdown…',
        ref: (n) => { contentArea = n; n.value = note.content ?? ''; },
      }),
      el('div', { class: 'note-editor-actions' },
        el('button', { type: 'button', class: 'btn btn-danger settings-save-btn', onclick: del }, icon('trash-2', 13), 'Delete'),
        el('button', { type: 'button', class: 'btn btn-primary settings-save-btn', onclick: save }, icon('check', 13), 'Save'),
      ),
    );
  }

  notesTab() {
    if (this.state.notes === undefined) {
      if (!this._notesLoading) {
        this._notesLoading = true;
        api.listNotes().then((list) => { this._notesLoading = false; this.setState({ notes: list }); });
      }
      return el('div', null,
        el('div', { class: 'settings-section-title' }, 'Notes'),
        el('div', { class: 'settings-section-sub' }, 'Wiki-style notes the agents can read and update as they work.'),
        el('div', { class: 'notes-loading' }, 'Loading notes…'),
      );
    }

    const notes = this.state.notes;
    const editingId = this.state.editingNoteId;
    const editing = notes.find((n) => n.id === editingId) ?? null;

    const list = el('div', { class: 'notes-list' },
      notes.length === 0
        ? el('div', { class: 'notes-empty' }, 'No notes yet. Create one to get started.')
        : notes.map((n) => el('button', {
            type: 'button', class: cx('note-item', n.id === editingId && 'active'),
            onclick: () => this.setState({ editingNoteId: n.id }),
          },
            el('div', { class: 'note-item-title' }, n.title || 'Untitled'),
            el('div', { class: 'note-item-snippet' }, noteSnippet(n.content)),
          )),
    );

    const listCol = el('div', { class: 'notes-col' },
      el('div', { class: 'notes-col-head' },
        el('span', { class: 'notes-col-count' }, `Notes (${notes.length})`),
        el('button', { type: 'button', class: 'btn btn-primary settings-save-btn', onclick: () => this.newNote() }, icon('plus', 14), 'New note'),
      ),
      list,
    );

    const editorCol = editing
      ? this.noteEditor(editing)
      : el('div', { class: 'notes-placeholder' }, icon('sticky-note', 28), el('p', null, 'Select a note to edit, or create a new one.'));

    return el('div', null,
      el('div', { class: 'settings-section-title' }, 'Notes'),
      el('div', { class: 'settings-section-sub' }, 'Wiki-style notes the agents can read and update as they work.'),
      el('div', { class: 'notes-layout' }, listCol, editorCol),
    );
  }

  /* ── Shortcuts ──────────────────────────────────────────────────────── */
  shortcutsTab() {
    return el('div', null,
      el('div', { class: 'settings-section-title' }, 'Keyboard Shortcuts'),
      el('div', { class: 'settings-section-sub' }, 'Global key bindings. On macOS, use ⌘ in place of Ctrl.'),
      el('div', { class: 'shortcuts-table' },
        SHORTCUTS.map((s) => el('div', { class: 'shortcut-row' },
          el('div', { style: 'min-width:0' },
            el('div', { class: 'shortcut-label' }, s.label),
            el('div', { class: 'shortcut-desc' }, s.desc),
          ),
          el('div', { class: 'shortcut-keys' },
            s.keys.map((k, i) => [i > 0 ? el('span', { class: 'plus' }, '+') : null, el('kbd', { class: 'kbd' }, k)]),
          ),
        )),
      ),
    );
  }

  providersTab() {
    const live = S.providers.get();
    const cards = DEFAULT_PROVIDERS.map((def) => {
      const match = live.find((p) => p.id === def.id);
      return { ...def, ...match };
    });
    for (const p of live) {
      if (!cards.some((c) => c.id === p.id)) cards.push({ icon: 'key', ...p });
    }

    return el('div', null,
      el('div', { class: 'settings-section-title' }, 'Model Providers'),
      el('div', { class: 'settings-section-sub' }, 'Connect at least one provider to start chatting. Keys are stored by the backend and never leave your machine.'),
      el('div', { class: 'provider-grid' },
        cards.map((p) => {
          let keyInput = null;
          const save = async () => {
            const apiKey = keyInput.value.trim();
            if (!apiKey) return;
            const res = await api.setProviderKey(p.id, apiKey);
            if (res?.ok !== false) {
              S.providers.update((list) => {
                const existing = list.find((x) => x.id === p.id);
                if (existing) return list.map((x) => (x.id === p.id ? { ...x, configured: true } : x));
                return [...list, { id: p.id, name: p.name, configured: true, models: p.models }];
              });
              toast(`${p.name} connected`);
            } else {
              toast(`Could not save the ${p.name} key — is the backend running?`);
            }
          };
          return el('div', { class: 'provider-card' },
            el('div', { class: 'provider-card-head' },
              el('div', { class: 'provider-mark' }, icon(p.icon ?? 'key', 18)),
              el('div', { style: 'min-width:0' },
                el('div', { class: 'provider-name' }, p.name),
                el('div', { class: 'provider-models' }, (p.models ?? []).join(' · ') || 'auto-discovered models'),
              ),
              el('span', { class: cx('provider-status', p.configured ? 'configured' : 'missing') },
                p.configured ? 'Configured' : 'No key'),
            ),
            el('div', { class: 'provider-key-row' },
              el('input', {
                class: 'input', type: 'password', placeholder: `${p.name} API key`,
                ref: (n) => { keyInput = n; },
                onkeydown: (e) => { if (e.key === 'Enter') save(); },
              }),
              el('button', { type: 'button', class: 'btn btn-secondary', onclick: save }, 'Save'),
            ),
          );
        }),
      ),
    );
  }

  stubTab(tab) {
    const [title, sub] = STUB_COPY[tab] ?? ['Coming soon', ''];
    const meta = SETTINGS_TABS.find((t) => t.id === tab);
    return el('div', { class: 'settings-stub' },
      icon(meta?.icon ?? 'flask-conical', 32),
      el('div', { class: 'stub-title' }, title),
      el('div', { class: 'stub-sub' }, sub),
    );
  }
}

function openSettings(tab) {
  if (tab) S.settingsTab.set(tab);
  if (settingsEl) return;
  const component = new SettingsOverlay();
  settingsEl = component.mount(document.body);
  settingsEscape = K.escapes.push(() => closeSettings());
  settingsEl._component = component;
  S.settingsOpen.set(true);
}

function closeSettings() {
  settingsEscape?.();
  settingsEscape = null;
  settingsEl?._component?.destroy();
  settingsEl = null;
  S.settingsOpen.set(false);
}

/* ═══ Command palette ═════════════════════════════════════════════════════ */

function paletteCommands() {
  return [
    { cat: 'Project', title: 'New Project', desc: 'Start a fresh project workspace', icon: 'folder-open', run: () => toast('Project creation needs the desktop shell.') },
    { cat: 'Project', title: 'Open Project', desc: 'Open an existing folder as a project', icon: 'folder-open', run: () => toast('Project picker needs the desktop shell.') },
    { cat: 'Session', title: 'New Session', desc: 'Create a session and focus the composer', icon: 'plus', keys: ['Ctrl', 'N'], run: () => createSession() },
    { cat: 'Session', title: 'Rename Current Session', desc: 'Edit the active session title', icon: 'pencil', run: () => toast('Double-click a session row to rename it.') },
    { cat: 'Session', title: 'Delete Current Session', desc: 'Remove the active session and its history', icon: 'trash-2', run: () => { const id = S.activeSessionId.get(); if (id) deleteSession(id); } },
    { cat: 'View', title: `${S.sidebarCollapsed.get() ? 'Show' : 'Hide'} Sidebar`, desc: 'Toggle the sessions sidebar', icon: 'chevron-left', run: () => { S.sidebarCollapsed.update((v) => !v); persistLayout(); } },
    { cat: 'View', title: `${S.zenMode.get() ? 'Disable' : 'Enable'} Zen Mode`, desc: 'Distraction-free feed and composer', icon: 'minimize-2', run: () => S.zenMode.update((v) => !v) },
    { cat: 'View', title: 'Focus Composer', desc: 'Jump to the prompt input', icon: 'send', run: () => focusComposer() },
    { cat: 'View', title: 'Clear Current Feed', desc: 'Empty the visible agent feed', icon: 'trash-2', run: () => S.feed.set([]) },
    { cat: 'System', title: 'Open Settings', desc: 'Providers, appearance, shortcuts and more', icon: 'settings', keys: ['Ctrl', ','], run: () => openSettings() },
    { cat: 'System', title: 'Reconnect Realtime', desc: 'Force a websocket reconnect', icon: 'refresh-cw', run: () => socket.connect() },
  ];
}

let paletteOpenFlag = false;

function openPalette() {
  if (paletteOpenFlag) return;
  paletteOpenFlag = true;

  const commands = paletteCommands();
  let filtered = commands;
  let selected = 0;
  let popEscape = null;

  const overlay = el('div', { class: 'palette-overlay' });
  const results = el('div', { class: 'palette-results' });

  function close() {
    popEscape?.();
    overlay.remove();
    paletteOpenFlag = false;
  }

  function run(cmd) { close(); cmd.run(); }

  function renderResults() {
    const groups = [];
    const byCat = new Map();
    for (const cmd of filtered) {
      if (!byCat.has(cmd.cat)) { byCat.set(cmd.cat, []); groups.push({ cat: cmd.cat, items: byCat.get(cmd.cat) }); }
      byCat.get(cmd.cat).push(cmd);
    }
    K.swap(results,
      filtered.length === 0
        ? el('div', { class: 'palette-empty' }, 'No matching commands')
        : groups.map((group) => [
            el('div', { class: 'palette-group-label' }, group.cat),
            group.items.map((cmd) => {
              const idx = filtered.indexOf(cmd);
              return el('button', {
                type: 'button',
                class: cx('palette-item', idx === selected && 'selected'),
                onclick: () => run(cmd),
                onmousemove: () => { if (selected !== idx) { selected = idx; renderResults(); } },
              },
                el('div', { class: 'palette-item-icon' }, icon(cmd.icon, 14)),
                el('div', { style: 'min-width:0' },
                  el('div', { class: 'palette-item-title' }, cmd.title),
                  el('div', { class: 'palette-item-desc' }, cmd.desc),
                ),
                cmd.keys && el('div', { class: 'palette-item-keys' }, cmd.keys.map((k) => el('kbd', { class: 'kbd' }, k))),
              );
            }),
          ]),
    );
  }

  const input = el('input', {
    type: 'text', placeholder: 'Type a command or search...',
    oninput: () => {
      const q = input.value.trim().toLowerCase();
      filtered = q
        ? commands.filter((c) => `${c.title} ${c.desc} ${c.cat}`.toLowerCase().includes(q))
        : commands;
      selected = 0;
      renderResults();
    },
    onkeydown: (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); selected = (selected + 1) % Math.max(filtered.length, 1); renderResults(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selected = (selected - 1 + filtered.length) % Math.max(filtered.length, 1); renderResults(); }
      else if (e.key === 'Enter' && filtered[selected]) { e.preventDefault(); run(filtered[selected]); }
    },
  });

  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });

  overlay.append(el('div', { class: 'palette-panel' },
    el('div', { class: 'palette-input-row' },
      icon('search', 18),
      input,
      el('span', { class: 'palette-esc' }, 'ESC to close'),
    ),
    results,
    el('div', { class: 'palette-footer' },
      el('div', { class: 'hints' }, el('span', null, '↑↓ Navigate'), el('span', null, '↵ Select')),
      el('span', null, `Koryphaios v${S.config.get().version ?? '0.1.0'}`),
    ),
  ));

  renderResults();
  document.body.appendChild(overlay);
  popEscape = K.escapes.push(close);
  requestAnimationFrame(() => input.focus());
}

/* ═══ Realtime wiring ═════════════════════════════════════════════════════ */

K.events.on('ws:providers', (msg) => {
  if (Array.isArray(msg.providers)) S.providers.set(msg.providers);
});
K.events.on('ws:session.created', (msg) => {
  if (!msg.session) return;
  S.sessions.update((list) => (list.some((s) => s.id === msg.session.id) ? list : [msg.session, ...list]));
});
K.events.on('ws:session.updated', (msg) => {
  if (!msg.session) return;
  S.sessions.update((list) => list.map((s) => (s.id === msg.session.id ? { ...s, ...msg.session } : s)));
});
K.events.on('ws:session.deleted', (msg) => {
  const id = msg.sessionId ?? msg.id;
  S.sessions.update((list) => list.filter((s) => s.id !== id));
  if (S.activeSessionId.get() === id) { S.activeSessionId.set(S.sessions.get()[0]?.id ?? null); S.feed.set([]); }
});
K.events.on('ws:feed.entry', (msg) => {
  if (msg.sessionId && msg.sessionId !== S.activeSessionId.get()) return;
  S.feed.update((list) => [...list, messageToEntry(msg.entry ?? msg)]);
});
K.events.on('ws:agent.status', (msg) => {
  if (typeof msg.status === 'string') S.managerStatus.set(msg.status);
});
K.events.on('ws:ask', (msg) => {
  if (msg.sessionId && msg.sessionId !== S.activeSessionId.get()) return;
  // show the question in the feed, then an inline answer prompt
  S.feed.update((list) => [...list, {
    id: K.uid(), ts: Date.now(), type: 'system', agent: 'kory',
    text: `Kory asks: ${msg.question}`, tool: null,
  }]);
  askUser(msg);
});

// Inline answer prompt for kory.ask_user — option chips + free-text, resolved
// over the socket via user_input.
function askUser(msg) {
  const sid = msg.sessionId ?? S.activeSessionId.get();
  let done = false;
  const answer = (selection, text) => {
    if (done) return;
    done = true;
    socket.answerUser(sid, selection, text);
    S.feed.update((list) => [...list, {
      id: K.uid(), ts: Date.now(), type: 'user_message', agent: null,
      text: selection || text || '(answered)', tool: null,
    }]);
    overlay.remove();
    popEscape?.();
  };
  const input = el('input', {
    class: 'input', placeholder: msg.allowOther ? 'Type your answer…' : 'Answer…',
    onkeydown: (e) => { if (e.key === 'Enter' && input.value.trim()) answer(null, input.value.trim()); },
  });
  const overlay = el('div', { class: 'ask-overlay' },
    el('div', { class: 'ask-panel' },
      el('div', { class: 'ask-question' }, msg.question),
      (msg.options && msg.options.length)
        ? el('div', { class: 'ask-options' },
            msg.options.map((opt) => el('button', {
              type: 'button', class: 'ask-option', onclick: () => answer(opt, null),
            }, opt)))
        : null,
      msg.allowOther !== false ? el('div', { class: 'ask-other' }, input) : null,
    ),
  );
  document.body.appendChild(overlay);
  const popEscape = K.escapes.push(() => { if (!done) { overlay.remove(); } });
  requestAnimationFrame(() => input.focus?.());
}
K.events.on('ws:token', (msg) => {
  if (msg.sessionId && msg.sessionId !== S.activeSessionId.get()) return;
  S.feed.update((list) => {
    const last = list[list.length - 1];
    if (last && last.type === 'content' && last.streaming) {
      return [...list.slice(0, -1), { ...last, text: last.text + (msg.token ?? msg.text ?? '') }];
    }
    return [...list, { id: K.uid(), ts: Date.now(), type: 'content', agent: msg.agent ?? 'kory', text: msg.token ?? msg.text ?? '', streaming: true }];
  });
});

/* ═══ Boot ════════════════════════════════════════════════════════════════ */

async function boot() {
  // Re-apply the persisted theme before the first mount/paint.
  applyTheme(S.theme.get());

  const app = document.getElementById('app');

  const titlebar = new Titlebar();
  const sidebar = new Sidebar();
  const feed = new Feed();
  const composer = new Composer();

  const column = el('div', { class: 'app-column' });
  column.append(titlebar.mount(), feed.mount(), composer.mount());

  const root = el('div', { class: 'app-root' });
  root.append(sidebar.mount(), el('div', { class: 'app-main' }, column));
  app.appendChild(root);

  // Zen mode moves the exit pill into the column (titlebar renders it).
  S.zenMode.watch(() => { /* components rebind via their own subscriptions */ });

  K.hotkeys({
    'mod+k': () => openPalette(),
    'mod+n': () => createSession(),
    'mod+,': () => openSettings(),
    'mod+b': () => { S.sidebarCollapsed.update((v) => !v); persistLayout(); },
  });

  socket.connect();

  // Every viewed session gets a realtime subscription (replayed on reconnect).
  S.activeSessionId.watch((id) => { if (id) socket.subscribe(id); });

  const [, providers, config] = await Promise.all([
    refreshSessions(),
    api.providers(),
    api.config(),
  ]);
  S.providers.set(providers);
  if (config) S.config.set(config);

  // If the active session already has history, load it.
  const active = S.activeSessionId.get();
  if (active && !DEMO) {
    const messages = await api.messages(active);
    S.feed.set(messages.map(messageToEntry));
  }

  // Remove the splash once fonts have settled so the first paint is final.
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  document.getElementById('splash')?.remove();
}

boot();
