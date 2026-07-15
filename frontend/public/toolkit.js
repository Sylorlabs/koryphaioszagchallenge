/**
 * toolkit.js — the Koryphaios UI toolkit ("K").
 *
 * A tiny, dependency-free component toolkit written for this app:
 *   K.el(tag, props, ...children)   hyperscript DOM builder
 *   K.icon(name, size, props)       lucide icon renderer (see /icons.js)
 *   K.Store / K.computed            observable state containers
 *   K.Component                     class components with reactive re-render
 *   K.events                        global pub/sub bus
 *   K.dropdown / K.modal / K.tooltip / K.confirm   floating primitives
 *   K.escapes                       LIFO Escape-key stack for overlays
 *   K.hotkeys                       declarative keyboard shortcuts
 *
 * No frameworks, no build step. Plain ES modules.
 */

import { ICONS } from '/icons.js';

/* ─── DOM builder ────────────────────────────────────────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g', 'defs', 'linearGradient', 'stop']);

/**
 * Create a DOM element.
 *   el('div', { class: 'row', style: { gap: '8px' }, onclick: fn }, 'text', child, [more])
 * Prop conventions:
 *   class / className   string
 *   style               string or object of css props
 *   dataset             object -> data-* attributes
 *   on<event>           lowercase event listeners (onclick, oninput, ...)
 *   ref                 callback receiving the created node
 *   html                innerHTML (trusted content only)
 *   anything else       setAttribute (false/null/undefined removes)
 */
function el(tag, props, ...children) {
  const node = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class' || key === 'className') {
        node.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : value);
      } else if (key === 'style') {
        if (typeof value === 'string') node.style.cssText = value;
        else Object.assign(node.style, value);
      } else if (key === 'dataset') {
        Object.assign(node.dataset, value);
      } else if (key === 'ref') {
        value(node);
      } else if (key === 'html') {
        node.innerHTML = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) {
        node.setAttribute(key, '');
      } else {
        node.setAttribute(key, value);
      }
    }
  }
  append(node, children);
  return node;
}

function append(node, child) {
  if (child == null || child === false) return;
  if (Array.isArray(child)) { for (const c of child) append(node, c); return; }
  node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
}

/** Replace all children of `node` with `children`. */
function swap(node, ...children) {
  node.textContent = '';
  append(node, children);
  return node;
}

/** Conditional class string helper: cx('a', cond && 'b') */
const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ─── Icons ──────────────────────────────────────────────────────────────── */

/**
 * Render a lucide icon: 24x24 viewBox, stroke=currentColor, stroke-width 2,
 * round caps/joins, fill none, sized via width/height.
 */
function icon(name, size = 16, props = {}) {
  const nodes = ICONS[name];
  const { strokeWidth = 2, class: klass, ...rest } = props;
  const svg = el('svg', {
    xmlns: SVG_NS,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: cx('k-icon', `k-icon-${name}`, klass),
    'aria-hidden': 'true',
    ...rest,
  });
  if (!nodes) return svg;
  for (const [tag, attrs] of nodes) svg.appendChild(el(tag, attrs));
  return svg;
}

/* ─── Stores (observable state) ──────────────────────────────────────────── */

class Store {
  #value;
  #subs = new Set();
  constructor(value) { this.#value = value; }
  get() { return this.#value; }
  set(value) {
    if (value === this.#value) return;
    this.#value = value;
    for (const fn of [...this.#subs]) fn(value);
  }
  update(fn) { this.set(fn(this.#value)); }
  /** Subscribe; runs immediately with the current value. Returns unsubscribe. */
  subscribe(fn) {
    this.#subs.add(fn);
    fn(this.#value);
    return () => this.#subs.delete(fn);
  }
  /** Subscribe without the initial call. */
  watch(fn) {
    this.#subs.add(fn);
    return () => this.#subs.delete(fn);
  }
}

/** A read-only store derived from one or more stores. */
function computed(stores, fn) {
  const list = Array.isArray(stores) ? stores : [stores];
  const out = new Store(fn(...list.map((s) => s.get())));
  for (const s of list) s.watch(() => out.set(fn(...list.map((x) => x.get()))));
  return out;
}

/* ─── Pub/sub bus ────────────────────────────────────────────────────────── */

const events = (() => {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type)?.delete(fn);
    },
    emit(type, payload) {
      for (const fn of [...(map.get(type) ?? [])]) fn(payload);
    },
  };
})();

/* ─── Component ──────────────────────────────────────────────────────────── */

/**
 * Minimal class component. Subclasses implement render() returning a DOM
 * node. setState()/bind() trigger re-render in place. Cleanups registered
 * with onCleanup() run on every re-render and on destroy().
 */
class Component {
  constructor(props = {}) {
    this.props = props;
    this.state = {};
    this.node = null;
    this._cleanups = [];
  }
  /** Register a disposer that runs before the next render / on destroy. */
  onCleanup(fn) { this._cleanups.push(fn); }
  /**
   * Subscribe to a store for the lifetime of the current render.
   * With a callback: runs immediately AND on change (keeps DOM in sync).
   * Without: schedules a re-render on change only.
   */
  bind(store, fn) { this.onCleanup(fn ? store.subscribe(fn) : store.watch(() => this.refresh())); }
  setState(patch) {
    Object.assign(this.state, patch);
    this.refresh();
  }
  refresh() {
    if (!this.node) return;
    const next = this._render();
    this.node.replaceWith(next);
    this.node = next;
  }
  _render() {
    for (const fn of this._cleanups.splice(0)) fn();
    return this.render();
  }
  mount(parent) {
    this.node = this._render();
    if (parent) parent.appendChild(this.node);
    return this.node;
  }
  destroy() {
    for (const fn of this._cleanups.splice(0)) fn();
    this.node?.remove();
    this.node = null;
  }
  render() { return el('div'); }
}

/* ─── Escape stack ───────────────────────────────────────────────────────── */

/** LIFO stack so Escape always closes the top-most overlay only. */
const escapes = {
  _stack: [],
  push(fn) {
    this._stack.push(fn);
    return () => { const i = this._stack.indexOf(fn); if (i >= 0) this._stack.splice(i, 1); };
  },
  pop() {
    const fn = this._stack.pop();
    if (fn) { fn(); return true; }
    return false;
  },
  get depth() { return this._stack.length; },
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && escapes._stack.length > 0) {
    e.preventDefault();
    escapes.pop();
  }
});

/* ─── Hotkeys ────────────────────────────────────────────────────────────── */

/**
 * hotkeys({ 'mod+k': fn, 'mod+n': fn }) — 'mod' = Ctrl (or Cmd on mac).
 * Returns an unbind function.
 */
function hotkeys(map) {
  const handler = (e) => {
    const combo = [
      (e.ctrlKey || e.metaKey) && 'mod',
      e.shiftKey && 'shift',
      e.altKey && 'alt',
      e.key.toLowerCase(),
    ].filter(Boolean).join('+');
    const fn = map[combo];
    if (fn) { e.preventDefault(); fn(e); }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}

/* ─── Floating primitives ────────────────────────────────────────────────── */

let openDropdown = null;

/**
 * Open a dropdown anchored to `anchor`. `build(close)` returns the panel
 * contents. Closes on outside click, Escape, or a second call. Options:
 *   align: 'left' | 'right'   placement: 'bottom' | 'top'   width: px
 */
function dropdown(anchor, build, opts = {}) {
  if (openDropdown?.anchor === anchor) { openDropdown.close(); return null; }
  openDropdown?.close();

  const { align = 'left', placement = 'bottom', width, offset = 4, class: klass } = opts;
  const panel = el('div', { class: cx('k-dropdown', klass), role: 'menu' });
  if (width) panel.style.minWidth = width + 'px';

  const state = { anchor, close };
  let popEscape;
  let outsideTimer;

  function close() {
    if (openDropdown !== state) return;
    openDropdown = null;
    popEscape?.();
    clearTimeout(outsideTimer);
    document.removeEventListener('pointerdown', onOutside, true);
    panel.remove();
    opts.onClose?.();
  }

  function onOutside(e) {
    if (!panel.contains(e.target) && !anchor.contains(e.target)) close();
  }

  append(panel, [build(close)]);
  document.body.appendChild(panel);

  const r = anchor.getBoundingClientRect();
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  let left = align === 'right' ? r.right - pw : r.left;
  let top = placement === 'top' ? r.top - ph - offset : r.bottom + offset;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';

  popEscape = escapes.push(close);
  // Defer outside-click arming so the opening click doesn't instantly close.
  outsideTimer = setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);

  openDropdown = state;
  return state;
}

/** A standard dropdown menu item. */
function menuItem(label, onclick, opts = {}) {
  return el('button', {
    type: 'button',
    class: cx('k-menu-item', opts.muted && 'is-muted', opts.class),
    role: 'menuitem',
    onclick,
  }, label, opts.trail ?? null);
}

const menuDivider = () => el('div', { class: 'k-menu-divider' });
const menuLabel = (text) => el('div', { class: 'k-menu-label' }, text);

/**
 * Open a modal. `build(close)` returns the dialog contents (the panel chrome
 * is up to the caller). Closes on Escape or backdrop click.
 */
function modal(build, opts = {}) {
  const overlay = el('div', { class: cx('k-modal-overlay', opts.class) });
  let popEscape;
  function close() {
    popEscape?.();
    overlay.remove();
    opts.onClose?.();
  }
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay && opts.backdropClose !== false) close();
  });
  append(overlay, [build(close)]);
  document.body.appendChild(overlay);
  popEscape = escapes.push(close);
  return { close, overlay };
}

/** Confirmation dialog matching the app's dialog chrome. */
function confirm({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    // Resolve BEFORE close(): close() fires onClose, which resolves false as
    // the backdrop/Escape path — a promise only settles once, so the explicit
    // button choice must land first.
    modal((close) => el('div', { class: 'k-dialog' },
      el('div', { class: 'k-dialog-header' }, el('div', { class: 'k-dialog-title' }, title)),
      el('div', { class: 'k-dialog-body' }, message),
      el('div', { class: 'k-dialog-footer' },
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { resolve(false); close(); } }, cancelLabel),
        el('button', { type: 'button', class: cx('btn', danger ? 'btn-danger' : 'btn-primary'), onclick: () => { resolve(true); close(); } }, confirmLabel),
      ),
    ), { onClose: () => resolve(false) });
  });
}

/* ─── Tooltip ────────────────────────────────────────────────────────────── */

let tipNode = null;
let tipTimer = 0;

/** Attach a hover tooltip to a node. */
function tooltip(node, text, { delay = 500 } = {}) {
  node.addEventListener('mouseenter', () => {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      tipNode?.remove();
      tipNode = el('div', { class: 'k-tooltip' }, typeof text === 'function' ? text() : text);
      document.body.appendChild(tipNode);
      const r = node.getBoundingClientRect();
      const tw = tipNode.offsetWidth;
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));
      let top = r.top - tipNode.offsetHeight - 6;
      if (top < 6) top = r.bottom + 6;
      tipNode.style.left = left + 'px';
      tipNode.style.top = top + 'px';
    }, delay);
  });
  const hide = () => { clearTimeout(tipTimer); tipNode?.remove(); tipNode = null; };
  node.addEventListener('mouseleave', hide);
  node.addEventListener('pointerdown', hide);
  return node;
}

/* ─── Misc helpers ───────────────────────────────────────────────────────── */

/** Format a timestamp like the sidebar: "10:29 PM" today, "Mar 7" otherwise. */
function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** HH:MM:SS for feed rows. */
function formatClock(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}

const uid = () => Math.random().toString(36).slice(2, 10);

/* ─── Export ─────────────────────────────────────────────────────────────── */

export const K = {
  el, append, swap, cx,
  icon,
  Store, computed,
  events,
  Component,
  escapes, hotkeys,
  dropdown, menuItem, menuDivider, menuLabel,
  modal, confirm, tooltip,
  formatTime, formatClock, uid,
};

export default K;
