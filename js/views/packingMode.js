import {
  button, confirmDialog, dismissTop, h, header, pill, registerCleanup, tile, vibrate,
} from '../ui.js';
import { plural } from '../format.js';
import { boxIsClosed, productShortName } from '../model.js';

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function renderPackingMode(ctx, box, product) {
  // Локальная копия счётчика: экран сам подкрашивает цифру и кольцо,
  // чтобы касание отзывалось мгновенно, без перестроения всего DOM.
  let packed = box.packedPortions;
  const target = box.targetPortions;

  const countNode = h('div', { class: 'count', text: String(packed) });
  const ctaNode = h('div', { class: 'cta' });
  // SVG-узлы обязаны создаваться в своём пространстве имён, иначе браузер
  // сделает неизвестный HTML-элемент и кольцо просто не нарисуется.
  const svgNs = 'http://www.w3.org/2000/svg';
  const makeCircle = (attrs) => {
    const node = document.createElementNS(svgNs, 'circle');
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  const base = {
    cx: '50',
    cy: '50',
    r: String(RADIUS),
    fill: 'none',
    'stroke-width': '5.5',
    'stroke-dasharray': String(CIRCUMFERENCE),
    transform: 'rotate(-90 50 50)',
  };

  const track = makeCircle({ ...base, stroke: 'rgba(28,33,64,0.08)', 'stroke-dashoffset': '0' });
  const ring = makeCircle({ ...base, 'stroke-linecap': 'round', stroke: 'var(--accent)' });

  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.appendChild(track);
  svg.appendChild(ring);

  const face = h('div', { class: 'face' },
    countNode,
    h('div', { class: 'of', text: `из ${target} ${plural(target, 'порции', 'порций', 'порций')}` }),
    ctaNode,
  );

  const clicker = h('button', { class: 'clicker', type: 'button' }, svg, face);

  const remainingTile = tile('Осталось', '0', 'peach');
  const packedTile = tile('Собрано', '0', 'mint');
  const percentTile = tile('Готовность', '0%', 'sky');

  const minusButton = button('−1 порция', () => tick(-1));
  const statusSlot = h('span', {});

  let bumpTimer = null;

  function paint() {
    const full = target > 0 && packed >= target;
    const progress = target > 0 ? Math.min(1, Math.max(0, packed / target)) : 0;

    countNode.textContent = String(packed);
    ring.setAttribute('stroke', full ? 'var(--success)' : 'var(--accent)');
    ring.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - progress)));

    ctaNode.textContent = full ? 'Норма собрана' : 'Нажмите — плюс порция';
    ctaNode.className = full ? 'cta done' : 'cta';

    remainingTile.querySelector('.tile-value').textContent = String(Math.max(0, target - packed));
    packedTile.querySelector('.tile-value').textContent = String(packed);
    percentTile.querySelector('.tile-value').textContent = `${Math.round(progress * 100)}%`;

    minusButton.disabled = packed <= 0;

    statusSlot.replaceChildren(
      boxIsClosed(box) ? pill('Закрыта', 'closed')
        : full ? pill('Норма собрана', 'done')
          : pill('В работе', 'work'),
    );
  }

  function tick(delta) {
    const next = Math.max(0, packed + delta);
    if (next === packed) return;
    packed = next;

    if (delta > 0) vibrate(12);

    ctx.updateQuiet((s) => {
      const stored = s.boxes.find((b) => b.id === box.id);
      if (stored) stored.packedPortions = packed;
    });

    clicker.classList.add('bump');
    clearTimeout(bumpTimer);
    bumpTimer = setTimeout(() => clicker.classList.remove('bump'), 110);

    paint();
  }

  clicker.addEventListener('click', () => tick(1));

  paint();

  keepScreenAwake();

  return h('div', { class: 'screen' },
    header({
      title: box.label || 'Коробка',
      subtitle: `${product.emoji}  ${productShortName(product)}`,
      back: () => dismissTop(),
      actions: statusSlot,
    }),
    h('div', { class: 'packing' },
      h('div', { class: 'clicker-wrap' }, clicker),
      h('div', { class: 'tiles' }, remainingTile, packedTile, percentTile),
      h('div', { class: 'btn-row' },
        minusButton,
        button('Закрыть коробку', async () => {
          const ok = await confirmDialog({
            title: 'Закрыть коробку?',
            message: `Собрано ${packed} из ${target}. Коробка пометится закрытой, её можно будет открыть снова.`,
            confirmText: 'Закрыть',
          });
          if (!ok) return;
          ctx.updateQuiet((s) => {
            const item = s.boxes.find((b) => b.id === box.id);
            if (item) item.closedAt = Date.now();
          });
          dismissTop();
        }, { primary: true }),
      ),
      h('p', { class: 'keys' },
        'Счёт сохраняется сразу — приложение можно свернуть и вернуться к этой же коробке.'),
    ),
  );
}

/** Экран не гаснет, пока идёт фасовка. */
function keepScreenAwake() {
  if (!('wakeLock' in navigator)) return;

  let sentinel = null;
  let active = true;

  const acquire = async () => {
    if (!active || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // батарея в режиме экономии или отказ системы — просто работаем без блокировки
    }
  };

  // после сворачивания браузер снимает блокировку сам, поэтому берём её заново
  const onVisibility = () => { if (document.visibilityState === 'visible') acquire(); };
  document.addEventListener('visibilitychange', onVisibility);

  acquire();

  registerCleanup(() => {
    active = false;
    document.removeEventListener('visibilitychange', onVisibility);
    sentinel?.release?.().catch(() => {});
    sentinel = null;
  });
}
