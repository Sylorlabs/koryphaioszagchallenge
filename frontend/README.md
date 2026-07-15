# Koryphaios Frontend — hand-written rebuild

A pixel-faithful rebuild of the Koryphaios UI as plain static files: vanilla
HTML/CSS/JS, no frameworks, no build step, no npm. Everything under
`public/` is servable by any static file server.

```
public/
├── index.html    app shell (splash + #app mount, module script)
├── theme.css     design tokens (kintsugi preset) + every component style
├── icons.js      lucide icon geometry (58 icons as [tag, attrs] node lists)
├── toolkit.js    the "K" UI toolkit (DOM builder, stores, components, overlays)
├── api.js        REST + WebSocket client for the Koryphaios backend contract
├── app.js        the application: layout, state, interactions
├── fonts/        self-hosted Inter 300–700 + JetBrains Mono 400/500 (woff2)
└── logo-*.png, favicon.ico
```

Serve and open:

```sh
python3 -m http.server 8899 -d public
# http://localhost:8899/          — live mode (talks to the backend)
# http://localhost:8899/?demo=1   — backend-free demo seeded to match the
#                                    reference screenshot exactly at 1280x720
```

## The K toolkit (`toolkit.js`)

A ~450-line component toolkit written for this app. Design goals: no virtual
DOM, no compiler, explicit data flow, and primitives that compose.

### DOM builder

```js
K.el('button', { class: 'btn btn-primary', onclick: send }, K.icon('send', 18), 'Send')
```

`K.el(tag, props, ...children)` creates real DOM nodes. Props map naturally:
`class`/`style` (string or object), `dataset`, `on*` listeners, `ref`
callbacks, boolean attributes; children may be nodes, strings, arrays, or
null (skipped). SVG tags are namespace-aware, so the same builder renders
icons. `K.swap(node, ...children)` re-fills a container in place and `K.cx()`
joins conditional class names.

### Icons

`icons.js` exports `ICONS`: each lucide glyph as its 24×24 node list
(`[["path", {d}], ...]`). `K.icon(name, size, props)` renders it as an
`<svg>` with `stroke: currentColor`, `stroke-width: 2` (overridable — the
composer's BrainCog uses 1.9 like the original), round caps and joins. Icons
inherit text color, so state classes recolor them for free.

### State: stores

```js
const count = new K.Store(0);
count.subscribe(fn)   // fires now and on change
count.watch(fn)       // fires on change only
count.update(n => n + 1);
const double = K.computed(count, n => n * 2);   // read-only derived store
```

Plain observable boxes. Equality-checked `set()` keeps no-op writes from
fanning out. `K.computed` derives from one or many stores. There is also a
global pub/sub bus, `K.events` (`on`/`emit`), which the WebSocket layer uses
to broadcast `ws:*` events without coupling transport to UI.

### Components

`K.Component` is a small class: implement `render()` returning one root
node; call `this.bind(store)` inside `render()` to re-render on changes, or
`this.bind(store, fn)` to run a targeted DOM patch (fires immediately and on
change — used for things like the connection dot so a full re-render isn't
needed). `setState(patch)` re-renders with local state. All subscriptions
are registered through `onCleanup()` and disposed before every re-render and
on `destroy()`, so components never leak listeners.

The app composes eight of these: `Titlebar`, `Sidebar`, `SessionList`,
`Feed`, `Composer`, `SettingsOverlay`, plus the imperative command palette
and dialogs. Re-render granularity is chosen so focus is never stolen: the
sidebar shell renders once, only `SessionList` re-renders on data changes;
the composer textarea patches char-count/send-state via direct listeners.

### Overlays

* `K.dropdown(anchor, build, opts)` — positioned floating panel (left/right ×
  top/bottom, viewport-clamped), closes on outside click and Escape; only one
  open at a time; used by the menubar, model/reasoning pickers, and chips.
* `K.modal(build, opts)` / `K.confirm({...})` — backdrop, dialog chrome,
  promise-based confirm (used by session delete).
* `K.tooltip(node, text)` — delayed hover tooltips.
* `K.escapes` — a LIFO Escape stack: every overlay pushes a closer, Escape
  always dismisses the top-most one only.
* `K.hotkeys({'mod+k': fn})` — declarative shortcuts (Ctrl+K palette,
  Ctrl+N session, Ctrl+, settings, Ctrl+B sidebar).

## Theme (`theme.css`)

The kintsugi palette is expressed as CSS custom properties, copied verbatim
from the original's runtime theme store: surfaces `#0D0B0A / #141210 /
#1C1917 / #262220 / #302B28`, gold accent `#D5B261` (hover `#F3DDB0`),
borders as gold at 16%/36% alpha, plus the 4px spacing grid, radius/typography
scales and motion durations from `design-tokens.css`. Inter and JetBrains
Mono are self-hosted woff2 with `-webkit-font-smoothing: antialiased`.
Component sections mirror the original stylesheet structure: shared
primitives (`.btn`, `.input`, `.kbd`, `.status-dot`, `.panel-header`),
sidebar, titlebar, feed/hero, composer, settings, palette.

## Application (`app.js`)

All state lives in one `S` bag of stores (sessions, activeSessionId,
searchQuery, feed, providers, config, sidebarCollapsed, zenMode, settings
tab, model/reasoning/agentMode/critic). `hasProvider` is computed from the
providers store and drives the setup-required banner, the disabled Send
button, the caption text, and the hidden attach buttons — the exact
screenshot state when no provider is configured.

Interactions: session create/select/rename (double-click or pencil)/delete
(confirm dialog), search filtering, sidebar collapse to a 40px rail
(persisted to `localStorage['koryphaios-layout-prefs']`), zen mode, File/
Edit/View menus, suggestion cards that load prompts into the composer,
settings overlay with 9 tabs (Providers functional; the rest tasteful
stubs), and the Ctrl+K command palette with keyboard navigation.

## Transport (`api.js`)

REST + WS client for the Koryphaios backend (bearer auth minted via
`POST /api/auth/session`, `{ok, data}` envelopes, session/message/provider
endpoints). The socket reconnects with exponential backoff and drives the
sidebar "Realtime" dot (emerald connected / amber pulsing connecting / red
offline). Server frames are adapted and re-broadcast as UI-level `ws:*`
events on `K.events`, keeping the transport swappable without touching
components. `?demo=1` short-circuits the network entirely and seeds the
seven-session screenshot state.
