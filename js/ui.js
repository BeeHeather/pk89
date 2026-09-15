// Мелкие помощники для сборки DOM. Никакого фреймворка: экранов немного,
// а обычные узлы дешевле и предсказуемее в офлайне.

/**
 * h('div', { class: 'card' }, child, 'текст')
 * Обработчики передаются как onclick / oninput.
 */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else if (key === 'class') {
      node.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key in node && key !== 'list') {
      node[key] = value;
    } else {
      node.setAttribute(key, value);
    }
  }

  appendAll(node, children);
  return node;
}

function appendAll(node, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) appendAll(node, child);
    else if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// ---------- готовые куски интерфейса ----------

export function header({ title, subtitle, back, actions }) {
  return h('div', { class: 'header' },
    back && h('button', { class: 'icon-btn', onclick: back, 'aria-label': 'Назад' }, '←'),
    h('div', { class: 'grow' },
      h('h1', { text: title }),
      subtitle && h('p', { class: 'sub', text: subtitle }),
    ),
    actions,
  );
}

export function card(attrs, ...children) {
  const { tint, onclick, class: extra, ...rest } = attrs || {};
  const classes = ['card'];
  if (tint) classes.push(`tint-${tint}`);
  if (onclick) classes.push('tap');
  if (extra) classes.push(extra);
  return h('div', { class: classes.join(' '), onclick, ...rest }, ...children);
}

export function button(label, onclick, { primary, danger, wide, disabled, icon } = {}) {
  const classes = ['btn'];
  if (primary) classes.push('primary');
  if (danger) classes.push('danger');
  if (wide) classes.push('wide');
  return h('button', { class: classes.join(' '), onclick, disabled: !!disabled, type: 'button' },
    icon && h('span', { text: icon }),
    label,
  );
}

export function iconButton(glyph, onclick, { danger, accent, small, label } = {}) {
  const classes = ['icon-btn'];
  if (danger) classes.push('danger');
  if (accent) classes.push('accent');
  if (small) classes.push('small');
  return h('button', { class: classes.join(' '), onclick, type: 'button', 'aria-label': label || glyph }, glyph);
}

export function chip(label, { on, onclick } = {}) {
  return h('button', { class: on ? 'chip on' : 'chip', onclick, type: 'button' }, label);
}

export function field({ value = '', placeholder = '', suffix, multiline, rows = 3, inputmode, center, oninput }) {
  const input = multiline
    ? h('textarea', { placeholder, rows, oninput })
    : h('input', { type: 'text', value, placeholder, oninput });

  if (!multiline && inputmode) input.setAttribute('inputmode', inputmode);
  if (multiline) input.value = value;

  const wrap = h('div', { class: center ? 'field center' : 'field' },
    input,
    suffix && h('span', { class: 'suffix', text: suffix }),
  );
  wrap.input = input;
  return wrap;
}

/** Поле с кнопками −/+ : попасть пальцем проще, чем в цифровую клавиатуру. */
export function stepper({ value, step, suffix, min = 0, onchange }) {
  const box = field({
    value: formatLocal(value),
    inputmode: 'decimal',
    suffix,
    center: true,
    oninput: () => {
      const parsed = parseLocal(box.input.value);
      if (parsed != null) onchange(Math.max(min, parsed));
    },
  });

  const apply = (next) => {
    const clamped = Math.max(min, Math.round(next * 1000) / 1000);
    box.input.value = formatLocal(clamped);
    onchange(clamped);
  };

  return h('div', { class: 'stepper' },
    h('button', { class: 'step-btn', type: 'button', onclick: () => apply((parseLocal(box.input.value) ?? 0) - step) }, '−'),
    box,
    h('button', { class: 'step-btn', type: 'button', onclick: () => apply((parseLocal(box.input.value) ?? 0) + step) }, '+'),
  );

  function formatLocal(v) {
    return String(v).replace('.', ',');
  }
  function parseLocal(text) {
    const cleaned = String(text).trim().replace(',', '.');
    const n = Number(cleaned);
    return cleaned !== '' && Number.isFinite(n) ? n : null;
  }
}

export function tile(label, value, tint) {
  return card({ tint },
    h('div', { class: 'tile-value', text: value }),
    h('div', { class: 'tile-label', text: label }),
  );
}

export function progress(value, variant) {
  const classes = ['progress'];
  if (variant) classes.push(variant);
  return h('div', { class: classes.join(' ') },
    h('i', { style: { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` } }),
  );
}

export function pill(text, variant) {
  return h('span', { class: `pill ${variant}`, text });
}

export function emptyState(emoji, title, hint) {
  return h('div', { class: 'empty' },
    h('div', { class: 'e', text: emoji }),
    h('h3', { text: title }),
    h('p', { text: hint }),
  );
}

// ---------- слои поверх экрана ----------

const overlays = [];

/**
 * Слои (панели и диалоги) кладутся в стек и добавляют запись в историю,
 * чтобы системная кнопка «назад» на Android закрывала верхний слой,
 * а не выбрасывала из приложения.
 */
export function pushOverlay(close) {
  overlays.push(close);
  history.pushState({ pk89: overlays.length }, '');
}

/** Вызывается из обработчика popstate. */
export function handlePop() {
  const close = overlays.pop();
  if (close) {
    close();
    return true;
  }
  return false;
}

/** Программное закрытие верхнего слоя — через историю, чтобы записи не копились. */
export function dismissTop() {
  if (overlays.length) history.back();
}

export function overlayDepth() {
  return overlays.length;
}

/** Выдвижная панель снизу. builder получает функцию закрытия. */
export function openSheet(title, builder) {
  const scrim = h('div', { class: 'scrim' });
  const sheet = h('div', { class: 'sheet' },
    h('div', { class: 'grabber' }),
    title && h('h2', { text: title }),
  );

  scrim.addEventListener('click', (event) => {
    if (event.target === scrim) dismissTop();
  });

  appendAll(sheet, [builder(dismissTop)]);
  scrim.appendChild(sheet);
  document.body.appendChild(scrim);

  pushOverlay(() => scrim.remove());
}

export function confirmDialog({ title, message, confirmText = 'Удалить' }) {
  return new Promise((resolve) => {
    let confirmed = false;

    const scrim = h('div', { class: 'scrim', style: { alignItems: 'center' } });
    const dialog = h('div', { class: 'dialog' },
      h('h3', { text: title }),
      h('p', { text: message }),
      h('div', { class: 'actions' },
        h('button', { type: 'button', onclick: () => dismissTop() }, 'Отмена'),
        h('button', {
          type: 'button',
          class: 'confirm',
          onclick: () => { confirmed = true; dismissTop(); },
        }, confirmText),
      ),
    );

    scrim.addEventListener('click', (event) => {
      if (event.target === scrim) dismissTop();
    });

    scrim.appendChild(dialog);
    document.body.appendChild(scrim);

    pushOverlay(() => {
      scrim.remove();
      resolve(confirmed);
    });
  });
}

let toastTimer = null;

export function toast(message, { error } = {}) {
  document.querySelector('.toast')?.remove();
  const node = h('div', { class: error ? 'toast error' : 'toast', text: message });
  document.body.appendChild(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 5000);
}

// ---------- уборка за экраном ----------

let cleanups = [];

/** Экран может занять системный ресурс (например, Wake Lock) — здесь он его и освобождает. */
export function registerCleanup(fn) {
  cleanups.push(fn);
}

export function runCleanups() {
  const list = cleanups;
  cleanups = [];
  for (const fn of list) {
    try { fn(); } catch (error) { console.warn('Ошибка при закрытии экрана', error); }
  }
}

// ---------- прочее ----------

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // вибрации может не быть — это не повод падать
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Пробуем системное «Поделиться»; если нельзя — обычное скачивание. */
export async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
