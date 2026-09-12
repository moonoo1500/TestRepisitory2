/* =========================================================
   Тестовые заглушки DOM/Canvas для headless-прогона игры.
   2D-канвас настоящий (@napi-rs/canvas) — миникарта и туман
   войны выполняются по-настоящему.
   ========================================================= */
import { createCanvas } from '@napi-rs/canvas';

/**
 * Настоящий canvas (@napi-rs/canvas) с добавленными DOM-свойствами.
 * Так drawImage/createImageData работают по-настоящему, а HUD-код не падает.
 */
export function makeCanvas(w = 300, h = 150) {
  const el = createCanvas(w, h);
  el.tagName = 'CANVAS';
  el.style = makeStyle();
  el.classList = makeClassList();
  el.dataset = {};
  el.onclick = null;
  el.children = [];
  if (!el.addEventListener) el.addEventListener = function () {};
  if (!el.removeEventListener) el.removeEventListener = function () {};
  el.appendChild = function () {};
  el.removeChild = function () {};
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: el.width, height: el.height, right: el.width, bottom: el.height });
  return el;
}

function makeStyle() {
  return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : ''),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

function makeClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (...c) => c.forEach((x) => set.add(x)),
    remove: (...c) => c.forEach((x) => set.delete(x)),
    toggle: (c, force) => {
      const on = force === undefined ? !set.has(c) : !!force;
      if (on) set.add(c); else set.delete(c);
      return on;
    },
    contains: (c) => set.has(c),
    _set: set,
  };
}

const GENERIC_CHILD = () => makeElement('div');

export function makeElement(tag = 'div', id = '') {
  const children = [];
  const el = {
    tagName: tag.toUpperCase(),
    id,
    _text: '',
    _html: '',
    style: makeStyle(),
    classList: makeClassList(),
    dataset: {},
    children,
    childNodes: children,
    onclick: null, onmouseenter: null, onmousemove: null, onmouseleave: null, onmousedown: null,
    value: '', title: '',
    width: 300, height: 150,
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); children.length = 0; },
    get firstChild() { return children[0] || null; },
    get lastChild() { return children[children.length - 1] || null; },
    appendChild(c) { children.push(c); return c; },
    removeChild(c) { const i = children.indexOf(c); if (i >= 0) children.splice(i, 1); return c; },
    remove() { /* noop */ },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 150, right: 300, bottom: 150 }),
    querySelector: () => GENERIC_CHILD(),
    querySelectorAll: () => [],
    focus() {}, blur() {},
    getContext: (k) => (k === '2d' ? createCanvas(300, 150).getContext('2d') : null),
  };
  return el;
}

/** Устанавливает глобальный псевдо-DOM. Возвращает реестр элементов. */
export function installDom({ width = 1600, height = 900 } = {}) {
  const registry = new Map();
  const get = (id) => {
    if (!registry.has(id)) registry.set(id, id === 'minimap' || id === 'scene' ? makeCanvas(240, 240) : makeElement('div', id));
    return registry.get(id);
  };

  const document = {
    createElement: (tag) => (tag === 'canvas' ? makeCanvas(300, 150) : makeElement(tag)),
    createElementNS: (ns, tag) => makeElement(tag),
    getElementById: get,
    querySelector: (sel) => get(`q:${sel}`),
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    body: makeElement('body'),
    documentElement: makeElement('html'),
    hidden: false,
  };

  const listeners = new Map();
  const window = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 1,
    document,
    addEventListener: (k, fn) => { if (!listeners.has(k)) listeners.set(k, []); listeners.get(k).push(fn); },
    removeEventListener() {},
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    AudioContext: undefined,
    webkitAudioContext: undefined,
  };

  globalThis.window = window;
  globalThis.document = document;
  globalThis.innerWidth = width;
  globalThis.innerHeight = height;
  globalThis.devicePixelRatio = 1;
  globalThis.requestAnimationFrame = window.requestAnimationFrame;
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.addEventListener = window.addEventListener;

  return { document, window, registry, get, listeners };
}
