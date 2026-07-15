# Koryphaios Frontend — Pixel-Perfect Rebuild Spec

**Source root:** `/home/micah/Desktop/Sylorlabs/Koryphaios/frontend` (SvelteKit + Tailwind v4, Tauri desktop shell)
**Reference screenshot:** `/home/micah/Desktop/Sylorlabs/Koryphaios/app_full.png` (1280×720)

**Important versioning note (verified via file mtimes):** the screenshot is dated **May 30**, while `src/app.css` (Jun 29), `src/lib/components/MenuBar.svelte` (Jul 7) and `src/lib/components/CommandInput.svelte` (Jul 9) are newer. The app evolved after the screenshot was taken. Two places visibly drifted:
- **Titlebar right side**: screenshot shows a plain-text `Sidebar on` toggle that no longer exists in current `MenuBar.svelte` (current version instead has Update/Git/Feedback/Notes/Commands/Agents/Settings buttons, no sidebar toggle here).
- **Composer top pills**: screenshot shows `Auto` (gold sparkle) + `Medium` (gold gear icon) pills. Current `CommandInput.svelte` replaced the first pill with an explicit "Select model" dropdown — but it still contains dead migration code (`if (_storedModel === 'auto') { localStorage.removeItem(...) }`) proving `'auto'` used to be a valid model-picker value, confirming the screenshot's older behavior.

Everywhere below, colors/spacing/radii are quoted verbatim from source since the core design-token system (`design-tokens.css`, `theme.svelte.ts` "kintsugi" preset) is stable and pixel-sampled PNG values confirm it still matches exactly. Where markup itself has drifted, it is flagged with the closest faithful reconstruction using the still-current shared CSS patterns.

---

## 1. Design Tokens

### 1a. Color source of truth
Colors are **not** static CSS — `src/lib/stores/theme.svelte.ts` applies them at runtime via `root.style.setProperty(...)` on `document.documentElement`, overriding the `@layer base` fallback values in `src/app.css`. Default config (line 278): `{ preset: 'kintsugi', accent: 'gold', font: 'inter' }`. Pixel-sampled screenshot (e.g. sidebar bg = `rgb(20,18,16)` = `#141210`) matches the **kintsugi** preset exactly, not the app.css `@layer base` fallback (`#151210`). Use the kintsugi values below as ground truth.

```css
/* src/lib/stores/theme.svelte.ts — THEME_PRESETS.kintsugi (RUNTIME TRUTH) */
--color-surface-0: #0D0B0A;
--color-surface-1: #141210;
--color-surface-2: #1C1917;
--color-surface-3: #262220;
--color-surface-4: #302B28;
--color-border: rgba(213, 178, 97, 0.16);
--color-border-bright: rgba(213, 178, 97, 0.36);
--color-text-primary: #F6EFE2;
--color-text-secondary: rgba(214, 206, 192, 0.74);
--color-text-muted: rgba(214, 206, 192, 0.40);
--color-success: #22c55e;      --color-success-bg: rgba(34, 197, 94, 0.15);
--color-error: #ef4444;        --color-error-bg: rgba(239, 68, 68, 0.15);
--color-warning: #f59e0b;      --color-warning-bg: rgba(245, 158, 11, 0.15);
--color-info: #3b82f6;         --color-info-bg: rgba(59, 130, 246, 0.15);
--color-added: #22c55e;  --color-removed: #ef4444;  --color-modified: #f59e0b;

/* ACCENT_COLORS.gold (default accent) */
--color-accent: #D5B261;
--color-accent-hover: #F3DDB0;
```

`src/app.css` `@layer base :root` fallback (used before JS runs / SSR, essentially identical for our purposes — note slightly different, e.g. `--color-accent-hover: #f1dbab` vs runtime `#F3DDB0`, and `.btn-primary` text color `#17120d`):
```css
--color-surface-0: #0d0b0a;   --color-surface-1: #151210;
--color-surface-2: #1d1916;   --color-surface-3: #26211d;   --color-surface-4: #332c27;
--color-border: rgba(213, 178, 97, 0.18);
--color-border-bright: rgba(213, 178, 97, 0.42);
--color-text-primary: #F6EFE2;
--color-text-secondary: rgba(235, 226, 212, 0.8);
--color-text-muted: rgba(214, 206, 192, 0.54);
--color-accent: #d5b261;  --color-accent-hover: #f1dbab;
--color-success: #22c55e; --color-error: #ef4444; --color-warning: #f59e0b;
```
Glow colors (agent-provider identity, not used on this screen but part of the system): `--color-glow-codex: rgba(0,255,255,.5)`, `--color-glow-google: rgba(66,133,244,.5)`, `--color-glow-claude: rgba(255,165,0,.5)`, `--color-glow-kory: rgba(255,215,0,.6)`, `--color-glow-test: rgba(0,255,128,.5)`.

### 1b. Font families
```css
/* Runtime default (theme store, font: 'inter') */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
/* app.css fallback / theme string in @theme block */
--font-sans: 'Geist Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
```
Fonts are self-hosted via `@fontsource/*` npm packages, imported in `src/lib/fonts.ts` (weights 300–700 each) and loaded in `+layout.svelte` before `app.css`. For the rebuild, bundle **Inter** (300/400/500/600/700) as the primary sans and **JetBrains Mono** for code — these are the two actually rendered on this screen. Font files live in `node_modules/@fontsource/*/files/*.woff2` (not under `static/`).

### 1c. Spacing / sizing / radius scale (`src/lib/styles/design-tokens.css`, 4px grid)
```css
--space-1:4px  --space-2:8px  --space-3:12px --space-4:16px --space-5:20px
--space-6:24px --space-8:32px --space-10:40px --space-12:48px --space-16:64px
--space-xs:4px --space-sm:8px --space-md:12px --space-lg:16px --space-xl:24px

--size-2:8px --size-7:28px --size-8:32px --size-9:36px --size-10:40px --size-14:56px

--radius-sm:4px  --radius-md:8px  --radius-lg:10px  --radius-xl:14px
--radius-2xl:18px  --radius-full:9999px

--text-xs:11px --text-sm:13px --text-base:14px --text-md:14px --text-lg:16px --text-xl:18px --text-2xl:20px
--leading-tight:1.25 --leading-snug:1.375 --leading-normal:1.5 --leading-relaxed:1.625
--font-normal:400 --font-medium:500 --font-semibold:600 --font-bold:700

--sidebar-width: clamp(224px, 22vw, 272px);   /* = 272px at 1280px viewport */
--sidebar-width-collapsed: 40px;
--sidebar-min-width: 220px;
--sidebar-max-width: min(340px, 30vw);
--git-panel-width: clamp(260px, 28vw, 360px);
--header-height: 52px;     /* titlebar AND sidebar header row */
--footer-height: 56px;
--drawer-width: 360px;

--duration-fast:100ms --duration-normal:180ms --duration-slow:240ms --duration-slower:300ms
--ease-out: cubic-bezier(0,0,0.2,1);  --ease-in-out: cubic-bezier(0.4,0,0.2,1);
```
At the screenshot's 1280px width, `--sidebar-width` resolves to its cap, **272px** (confirmed against the crop: sidebar/main divider sits at x≈272).

---

## 2. Layout Skeleton

`+layout.svelte` is minimal: imports `app.css` + `$lib/fonts`, renders a `.layout-root` div (`min-height:100vh; background:var(--color-surface-0); color:var(--color-text-primary)`), a skip-link, an offline banner, an initial-load splash (`Loading Koryphaios…` centered, pulsing gold dot), then `<main>{children}</main>`, plus global overlays (`BackendDownOverlay`, `UpdateBanner`, `UpdateDialog`).

`+page.svelte` composes everything through `AppShell.svelte` using Svelte snippets. **`AppShell.svelte`** is the real skeleton:

```html
<div class="flex h-screen min-h-0 min-w-0 overflow-hidden" style="background: var(--color-surface-0);">
  <!-- LEFT: sidebar (nav, width var(--sidebar-width), border-r, bg surface-1) OR
       collapsed rail (width var(--sidebar-width-collapsed)=40px) -->
  <nav style="width:var(--sidebar-width); min-width:220px; max-width:min(340px,30vw);
              border-right:1px solid var(--color-border); background:var(--color-surface-1);">
    <div class="sidebar-header" style="height:52px; border-bottom:1px solid var(--color-border);">
      <!-- logo-64.png 32x32 + "Koryphaios" + "Beta" pill + "Agent workspace" subtitle + collapse chevron -->
    </div>
    <SessionSidebar /> <!-- flex-1 -->
    <!-- footer: connection dot + "Realtime connected" + provider count, border-top, bg surface-2 -->
  </nav>

  <div class="flex-1 flex min-h-0 min-w-0">
    <div class="relative flex flex-1 min-h-0 min-w-0 flex-col">
      <MenuBar />                 <!-- height: 52px -->
      <AgentRail />                <!-- worker-chat tab strip, conditional -->
      <FileEditPreview />
      <section class="flex flex-1 min-h-0 flex-col overflow-hidden"> <!-- feed --> </section>
      <!-- contextBar (conditional, only with active session) -->
      <!-- backgroundShells (conditional) -->
      <div class="shrink-0" style="background: var(--color-surface-1);"> <!-- composer --> </div>
    </div>
    <!-- RIGHT (optional): Git panel, width var(--git-panel-width), border-l -->
  </div>
</div>
```
No project open → the feed area shows a centered "Open a project to start working" card (`position:fixed; left:50vw; top:50%; transform:translate(-50%,-50%)`, `max-width:36rem`, `rounded-[24px]`, gradient `linear-gradient(180deg, rgba(213,178,97,.1), rgba(213,178,97,.03))`, border `rgba(213,178,97,.22)`).

---

## 3. Component Inventory

### 3a. Titlebar (`MenuBar.svelte`, `.titlebar`)
`height: 52px`, `display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 0 12px; border-bottom:1px solid var(--color-border); background: var(--color-surface-1);` `data-tauri-drag-region`.

**Left**: three menu buttons `File` / `Edit` / `View`, each `px-2.5 py-1.5 text-sm rounded-lg` (10px radius), `color: var(--color-text-secondary)`, hover `bg: var(--color-surface-3)`. Clicking opens a dropdown: `absolute left-0 top-10 z-30 min-w-[260px] border p-1.5 shadow-2xl`, `background: var(--color-surface-2); border-color: var(--color-border); border-radius: 0.5rem`. Items are full-width text buttons `px-2.5 py-1.5 text-xs hover:bg-surface-3`.
- **File**: New Project · Open Project... · Open Workspace... · Import Project File... · divider · "RECENT PROJECTS" (10px uppercase tracked label) · recent list · divider · New Session
- **Edit**: Focus Prompt Input · Clear Current Feed · divider · prompt templates (PRD/Bugfix/Refactor/Ship)
- **View**: Hide/Show Sidebar · Enable/Disable Zen Mode · (Show/Hide Active Agents, advanced) · (Show/Hide Source Control, advanced) · Switch Theme... · Open Settings · (Check for Updates, Tauri only)

**Center**: project name, absolutely centered on the *viewport*: `position:fixed; left:50vw; transform:translateX(-50%); font-size:12px; font-weight:500; color:var(--color-text-secondary);` — screenshot shows "Koryphaios" centered.

**Right** (screenshot version): `Sidebar on` (plain text toggle) → `Git` (GitBranch icon 14px + text) → `Commands` (Search icon 14px + text + `<kbd class="kbd">CtrlK</kbd>`) → Settings gear (18px icon, `p-2.5 rounded-lg hover:bg-surface-2`).
All right-side buttons share: `flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--color-surface-2)]; font-size:12px; font-weight:500; color:var(--color-text-secondary)` (accent when toggled active).

`.kbd` (`app.css`): `display:inline-flex; padding:4px 6px; font-size:11px; font-family:var(--font-mono); background:var(--color-surface-3); border:1px solid var(--color-border); border-radius:4px; color:var(--color-text-muted);`

Zen mode variant: header disappears; `h-4` drag strip remains; `Exit Zen` pill top-right (`absolute top-1.5 right-4`, `px-3.5 py-1.5 text-xs border rounded-full`, `background:var(--color-surface-2)`).

### 3b. Sessions Sidebar (`SessionSidebar.svelte` — matches screenshot exactly)
- **Header row** (`px-4 py-4 border-b`): title `Sessions` (`text-sm font-semibold leading-none`) + subtitle `Recent workspaces and agent runs` (`text-xs text-muted mt-1`), right-aligned **+** button (Plus icon 16px, `p-2 rounded-lg hover:bg-surface-3`).
- **Search box** (`px-4 py-3`): Search icon 14px absolute `left-3`, `<input class="input text-sm h-9 w-full" style="padding-left:36px" placeholder="Search sessions...">`. `.input` base: `padding:8px 12px; font-size:14px; background:var(--color-surface-2); border:1px solid var(--color-border); border-radius:10px; min-height:36px; box-shadow: inset 0 1px 0 rgba(255,255,255,.02);` focus → `border-color:accent; background:surface-1; box-shadow:0 0 0 3px rgba(213,178,97,.12)`.
- Below search: dashed-border "Join or host a team workspace" row (`rounded-xl border-dashed`, UserPlus icon).
- **Date group label** e.g. `TODAY`: `px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] color:text-muted`.
- **Session row** (`.session-item`): `flex items-center gap-3 px-3 py-3 mx-1 rounded-xl cursor-pointer transition-colors border border-transparent`. Idle: `hover:bg-surface-2 hover:border-border`. **Active** uses `.active-session`:
  ```css
  background: linear-gradient(180deg, rgba(213,178,97,.14), rgba(213,178,97,.08));
  border: 1px solid rgba(213,178,97,.34);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
  ```
  Row content: 18×18px icon chip (`bg-surface-3 rounded-lg`, MessageSquare 12px muted icon) → title (`text-sm font-medium truncate`) → meta row (`flex gap-2.5`, 11px muted): timestamp (`10:29 PM`), message count, cost. Right: hover-revealed Pencil (rename) and Trash2 (delete), 12px, `p-1.5 rounded-lg hover:bg-surface-4`, `opacity-0 group-hover:opacity-100` (`opacity-70` baseline when active).
- **Footer** (in AppShell): `px-4 py-3 border-t flex items-center justify-between; background:var(--color-surface-2)`. Left: 8×8px dot (`bg-emerald-500` connected / `bg-amber-500 animate-pulse` connecting / `bg-red-500` error) + `Realtime connected` (`text-xs muted`). Right: `"N providers"` pill (`px-1.5 py-0.5 rounded bg-surface-3 text-xs muted`), hidden when 0.
- **Sidebar header**: 52px row, logo-64.png at 32×32 (`rounded-lg`) + stacked: `Koryphaios` (14px semibold) + **Beta** pill (uppercase, bold, tracking-wider, `bg: color-mix(accent 18%, transparent)`, color accent, rounded px-1) and `Agent workspace` (11px muted). Right: ChevronLeft 14px collapse button.

### 3c. Agent Feed header
`.panel-header`: `display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--color-surface-1); border-bottom:1px solid var(--color-border); min-height:44px;`
`.panel-title`: `display:flex; gap:8px; font-size:11px; font-weight:600; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:0.08em;` — MessageSquare icon (16px) + `Agent feed` (renders **AGENT FEED**).
Right-aligned **`Bottom`** pill (↓ ArrowDown icon + text): `px-3 py-1.5 rounded-lg border`, `background:var(--color-surface-3)`, `border-color:var(--color-border)`, `color:var(--color-text-secondary)`, `font-size:12px font-weight:500`.

### 3d. Welcome Hero — `ManagerFeed.svelte` (matches screenshot verbatim)
Outer scroll container: `px-6 py-10 max-w-5xl mx-auto`. Card:
```html
<div class="rounded-[28px] border p-8 shadow-2xl backdrop-blur-sm"
     style="background: linear-gradient(165deg, rgba(213,178,97,.12), rgba(12,10,9,.4));
            border-color: rgba(213,178,97,.24);">
```
- Badge: `inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border mb-6` — `background:rgba(0,0,0,.2); border-color:rgba(213,178,97,.15); color:var(--color-text-secondary)`; 6×6px pulsing emerald dot (`bg-emerald-400 animate-pulse`) + **`WORKSPACE ANALYZED`** (`text-[10px] font-bold uppercase tracking-[0.2em] opacity-70`).
- Headline: **`What should Koryphaios do with your project?`** — `text-3xl font-semibold leading-tight mb-4 tracking-tight` (30px/600).
- Subtitle: **`I'm connected and ready to help. Choose a strategic starting point or describe your task in the composer below.`** — `text-[15px] max-w-2xl leading-relaxed mb-10 opacity-70`, color text-secondary.
- **Below the fold**: `grid grid-cols-1 md:grid-cols-2 gap-4` of **4 suggestion cards** (`rounded-2xl border p-5`, `background:rgba(12,10,9,.4)`, hover `translateY(-2px)` + gold glow), each with an 11×11 icon tile, bold label, muted prompt preview, on-hover "Load into composer ↓" caption + pencil edit button:
  1. **Map the codebase** — Zap icon — *"Inspect this project and summarize the architecture, key entry points, and the highest-leverage next steps."*
  2. **Critique the UI** — Paintbrush icon — *"Critique the current UI in this project, identify the weakest hierarchy and spacing choices, and recommend the most important visual fixes."*
  3. **Review recent changes** — GitBranch icon — *"Review the current uncommitted changes in this project and identify the most likely bugs, regressions, or missing tests."*
  4. **Debug a regression** — Bug icon — *"Help me trace a bug in this project. Start by asking for the failing behavior or error, then narrow the likely root cause."*
  Then a 2-col row of "Pro Tips" and "Workflow" info cards (`rounded-[24px]` `bg-surface-2`).

### 3e. Setup-required banner (`CommandInput.svelte`)
```html
<div style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35); border-radius: 12px;"
     class="mb-4 flex items-center justify-between gap-3 px-4 py-3">
  <span class="text-red-400 font-semibold">Setup required</span>
  <span class="text-sm" style="color:var(--color-text-secondary)">No model provider is configured. Open Settings and connect a provider before chatting.</span>
  <button class="btn btn-secondary">Open Settings</button>
</div>
```
`.btn-secondary`: `background:var(--color-surface-3); color:var(--color-text-secondary); border:1px solid var(--color-border);` hover → `background:var(--color-surface-4)`. `.btn` base: `padding:8px 16px; font-size:13px; font-weight:600; border-radius:10px; min-height:32px;`

### 3f. Composer (`CommandInput.svelte`)
Root: `<div class="command-input px-4 py-3">` (`position:relative; z-index:5;`). Inner box:
```css
border-radius: 20px; padding: 12px 20px;
background: rgba(12,10,9,.2); border: 1px solid var(--color-border);
```
**Top control row** (`mb-3 flex flex-wrap items-center gap-3`) — two pills, each `flex items-center gap-2 px-3.5 h-10 rounded-xl text-sm font-medium` (40px tall, 14px radius), `background:var(--color-surface-3); border:1px solid var(--color-border);`, trailing ChevronDown 14px:
  - Pill 1 — **model/routing selector**, screenshot default **`Auto`** with gold Sparkles icon, `color:var(--color-text-primary)`.
  - Pill 2 — **reasoning-effort selector**, screenshot default **`Medium`** with gold BrainCog icon @20px (use accent-gold for pixel fidelity).

**Textarea**: `class="input"` + overrides: `resize:none; min-height:88px (max 280px); font-size:15px; line-height:1.6; padding:10px 88px 10px 12px; background:transparent; border:none; box-shadow:none;` placeholder **`What's the move?`**. Bottom-right: Paperclip and Clipboard 16px icon buttons, `40×32px, rounded-lg, hover:bg-surface-3`.

**Right action panel** (desktop ≥1280px):
```css
display:flex; flex-direction:column; gap:12px; border-radius:16px;
padding:12px; background: rgba(12,10,9,.34); border:1px solid var(--color-border);
min-width: 188px;
```
Row 1 (`flex flex-wrap gap-2 justify-end`), two small pills `flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md`:
- **Auto** (execution mode, Sparkles 12px) — `background: rgb(16 185 129 / 0.14); color: rgb(52 211 153); border: 1px solid rgb(16 185 129 / 0.25);`
- **Critic: On** (ShieldCheck 12px) — `background: rgb(245 158 11 / 0.2); color: rgb(251 191 36); border: 1px solid rgb(245 158 11 / 0.3);` Off state: ShieldAlert icon, `bg-surface-3 text-muted border-border`.

Row 2: **Send** button — `.btn .btn-primary`, override `height:52px; padding:0 20px; font-size:14px;`. `.btn-primary`: `background:#D5B261; color:#17120d; box-shadow:0 8px 24px rgba(213,178,97,.18);` hover → `background:var(--color-accent-hover); translateY(-1px)`. Icon: Send 18px + `Send`. Disabled: same gold at ~0.5-0.6 opacity, `cursor:not-allowed`.

**Footer caption**: `flex justify-between mt-2`, left 12px muted — disabled state: **`Configure a provider to enable sending.`**; normal: `Enter to send · Shift+Enter for new line · Ctrl+V paste text · Ctrl+Shift+V paste image`. Right: `N chars` counter once text entered.

**Stop / Waiting states**:
```css
.stop-btn { background: rgb(239 68 68 / .12); border:1px solid rgb(239 68 68 / .45); color:#fca5a5; }
.stop-pulse { width:22px; height:22px; border-radius:50%; background:#ef4444; }
.stop-pulse::after { border:2px solid rgb(239 68 68 / .7); animation: stop-ping 1.4s cubic-bezier(0,0,.2,1) infinite; } /* scale 1→2, opacity .7→0 */
.waiting-btn { background: color-mix(in srgb, #d5b261 14%, transparent); color:#d5b261; border:1px solid color-mix(in srgb,#d5b261 45%, transparent); animation: waiting-breathe 2.4s ease-in-out infinite; }
.waiting-dots span { width:5px;height:5px;border-radius:9999px;background:currentColor; animation: waiting-dot 1.2s ease-in-out infinite; } /* staggered 0/.2s/.4s */
```

### 3g. Scrollbars (global)
```css
::-webkit-scrollbar { width:10px; height:10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-surface-4); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: var(--color-border-bright); }
```

---

## 4. Icons

**Primary icon set: lucide** (24×24 viewBox, `stroke-width:2`, `fill:none`) at 12–20px: Settings, Search, GitBranch, MessageSquare, Pencil, Trash2, Plus, ChevronDown/Left/Right, Send, Sparkles, ShieldCheck/Alert, Zap, Paperclip, Clipboard, ArrowDown/Up, Minus, Square, X, StickyNote, Flag, FolderOpen, Users, Bug, Paintbrush, Terminal, Globe, Brain, BrainCog, BrainCircuit, UserPlus, Key, Palette, Keyboard, CreditCard, Bot, FlaskConical, RefreshCw, AlertCircle, Check, Maximize2, Minimize2.

**Custom icon components** (`src/lib/components/icons/`): BrainIcon (tier: 0=Brain@0.45, 1=Brain, 2=BrainCog, 3=BrainCircuit, custom xhigh glyph, auto = Brain + dashed spinning ring `spin 10s linear infinite`), CriticIcon (custom 24×24 report glyph), FileIcon, ProviderIcon (brand marks from `static/provider-icons/*.svg`).

**App logo** — raster PNG only: `static/logo-64.png` (32×32 in sidebar header, 72×72 empty-state), `logo-192.png`, `logo-512.png`, `logo-favicon.png`, `favicon.ico`. Visual: rounded hexagonal badge, near-black fill, gold/amber asterisk-like radial burst (6–8 spokes) centered. Use the PNG directly.

---

## 5. Secondary Surfaces

### Settings (`SettingsDrawer.svelte`) — full-screen overlay
```html
<div class="fixed inset-0 z-50 flex flex-col" style="background: var(--color-surface-1);">
  <!-- Header: px-6 py-4 border-b bg-surface-0 — "Settings" (text-base font-semibold) + X close (18px) -->
  <!-- Tab bar: px-4 py-2 border-b bg-surface-0, flex gap-1, overflow-x-auto -->
```
9 tabs, each `flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 text-xs rounded-md`, active = `bg-surface-3 text-primary font-medium`, inactive = `text-muted hover:text-secondary`:
`Providers` (Key) · `Appearance` (Palette) · `Shortcuts` (Keyboard) · `Billing` (CreditCard) · `Memory` (Brain) · `Agent` (Bot) · `Advanced` (FlaskConical) · `Teams` (Users) · `Notes` (StickyNote). Icon size 13px.
Content: `flex-1 overflow-y-auto px-6 py-5`, `max-w-7xl mx-auto`. Providers tab lists provider cards with ProviderIcon + connect/rotate-key controls. Appearance tab uses KorySelect dropdowns (trigger `rounded-xl border bg-surface-1 min-h-11 px-4 py-3`, popover `absolute z-[120] mt-2 rounded-xl border bg-surface-2 shadow-2xl`, options `rounded-lg px-3 py-2.5`, checkmark for selected).

### Command Palette (`CommandPalette.svelte`, Ctrl/⌘K)
```css
overlay: fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]; background: rgba(0,0,0,.5); backdrop-blur-sm;
panel: w-full max-w-xl (576px) rounded-xl border shadow-2xl; background: var(--color-surface-1);
```
Fades in (150ms), panel flies down from `y:-20px` over 200ms. Header row: Search icon 18px + `<input placeholder="Type a command or search...">` (transparent, 14px) + `ESC to close` badge (10px, bg-surface-3, rounded, px-1.5 py-0.5). Results grouped by category (10px uppercase bold tracked: Project/Session/View/System), each row `flex gap-3 px-3 py-2.5 rounded-lg`, 8×8 icon tile (`bg-surface-2`, `bg-surface-4` + accent icon when selected), title (14px medium) + description (12px muted), optional kbd chips right. Selected: `box-shadow: inset 0 0 0 1px var(--color-border-bright)`. Footer: `↑↓ Navigate`, `↵ Select` left, `Koryphaios v0.1.0` right, `bg-surface-0` top border.

### Git / Source Control Panel (`SourceControlPanel.svelte`) — right aside, width clamp(260px,28vw,360px)
Top bar: branch pill (branch name + ahead/behind arrows + ChevronDown branch dropdown) + RefreshCw/ArrowDown(pull)/ArrowUp(push) icon buttons (`p-1.5 hover:bg-surface-3 rounded`, 14px). Conflict banner: `bg-red-500/10 border-b border-red-500/20`, AlertCircle + `CONFLICTS DETECTED` (10px bold uppercase) + "Resolve with Kory →". Commit box: `<textarea class="input h-20" placeholder="Message (⌘+Enter to commit)">` + char counter (`N/72`, yellow past 72) + full-width `.btn.btn-primary` **Commit** (Check icon). Stats row: `N added` (green), `N modified` (amber), `N deleted` (red), 10px, `bg-surface-2`. Below: sticky **Staged Changes (N)** / unstaged lists, rows `flex gap-2 px-3 py-1.5 hover:bg-surface-2 text-xs`, FileIcon + name.

---

## 6. Interactions

- **Sidebar collapse**: ChevronLeft swaps 272px nav for 40px icon rail with centered ChevronRight. Persists to `localStorage['koryphaios-layout-prefs']`.
- **Session row hover**: Pencil/Trash2 via `opacity-0 → opacity-100` on `.group:hover`; active row `opacity-70` baseline.
- **Transitions**: `--duration-fast:100ms`, `--duration-normal:180ms` (ease-in-out `cubic-bezier(.4,0,.2,1)`), `--duration-slow:240ms`, `--duration-slower:300ms`, `--ease-out: cubic-bezier(0,0,.2,1)`. Drawer: `transform:translateX(100%); transition: transform 240ms var(--ease-out);` → open `translateX(0)`.
- **Pulses**: `.status-dot.connecting { animation: pulse 1s ease-in-out infinite; }` (opacity 1↔.5); splash dot 1↔.4; badge dot Tailwind `animate-pulse` (2s cubic-bezier(.4,0,.6,1)); stop-ping 1.4s (scale 1→2, opacity .7→0); waiting-breathe 2.4s; waiting-dot 1.2s staggered 0/.2/.4s.
- **Feed entries** fly in `{ y: 20, duration: 300 }` only for entries <5s old.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` forces durations to 0.01ms.

### Feed rows (`FeedEntry.svelte`) — log rows, NOT chat bubbles
```html
<div class="flex items-start gap-[12px] py-[8px] text-sm leading-relaxed rounded px-[12px] -mx-[12px]">
  <span class="text-xs text-muted w-16 leading-6 tabular-nums"><!-- HH:MM:SS --></span>
  <div class="w-5 h-6 flex items-center justify-center"><!-- type icon, 14px --></div>
  <div class="flex-1 min-w-0"><!-- agent name label + content --></div>
</div>
```
Row hover: `hover:bg-surface-2/30`. Selected: `bg-accent/10 ring-1 ring-accent/30`. Per-type colors:
```
user_message → text-accent font-medium (gold), icon: Send (gold)
content      → text-text-primary (markdown)
thought      → text-yellow-400
thinking     → text-blue-400/70 (collapsible)
tool_call    → text-accent
tool_result  → text-green-400
routing      → text-yellow-300
error        → text-red-400
system       → text-text-muted
tool_group   → text-blue-400 font-medium italic
agent_group  → text-purple-400 font-medium
```
Tool rows: simple read/write collapse to one-line `verb + path` (11px); bash renders collapsible terminal block (`rounded-lg border bg-surface-2`, header `bg-surface-3` with Terminal icon + command, Maximize2/Minimize2, mono body, max-height 120px collapsed / 800px expanded); web-search renders cyan card (`border-sky-400/28 bg-sky-400/6`) with spinning Globe. Markdown: 14px/1.7; inline code `bg-surface-2, padding:.2em .4em, radius:4px, color:accent`; block code highlight.js atom-one-dark; `a.wikilink` gold underlined.

---

## 7. Fonts

- **Primary: Inter** — `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` (400/500/600/700 needed).
- **Mono: JetBrains Mono** — `'JetBrains Mono', 'SF Mono', 'Fira Code', monospace` (400/500).
- Body: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`
- Self-host woff2 files (from @fontsource packages or Google Fonts).

---

## Exact UI copy inventory (screenshot)
Titlebar: `Koryphaios` · `Agent workspace` · `File` `Edit` `View` · `Koryphaios` (center) · `Sidebar on` · `Git` · `Commands` `CtrlK`
Sidebar: `Sessions` / `Recent workspaces and agent runs` · `Search sessions...` · `TODAY` · rows `Test`, `Test`, `Test Session`, `Session 1`, `Session 2`, `Session 3`, `Test` (all `10:29 PM`) · `Realtime connected`
Feed header: `AGENT FEED` · `Bottom`
Hero: `WORKSPACE ANALYZED` · `What should Koryphaios do with your project?` · `I'm connected and ready to help. Choose a strategic starting point or describe your task in the composer below.`
Banner: `Setup required` · `No model provider is configured. Open Settings and connect a provider before chatting.` · `Open Settings`
Composer: `Auto` · `Medium` · `What's the move?` (placeholder) · `Auto` (execution-mode pill) · `Critic: On` · `Send` · `Configure a provider to enable sending.`

---

### Key source files (reference copy at reference/Koryphaios/frontend/)
- Tokens/theme: `src/lib/styles/design-tokens.css`, `src/app.css`, `src/lib/stores/theme.svelte.ts`
- Layout: `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/lib/components/shell/AppShell.svelte`
- Titlebar: `src/lib/components/MenuBar.svelte`
- Sidebar: `src/lib/components/SessionSidebar.svelte`
- Feed/hero: `src/lib/components/ManagerFeed.svelte`, `src/lib/components/FeedEntry.svelte`
- Composer: `src/lib/components/CommandInput.svelte`, icons in `src/lib/components/icons/`
- Secondary: `SettingsDrawer.svelte`, `CommandPalette.svelte`, `SourceControlPanel.svelte`, `KorySelect.svelte`
- Logo: `static/logo-64.png` etc.
