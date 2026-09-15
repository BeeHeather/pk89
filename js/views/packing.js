import { button, h, header, openSheet, registerCleanup, vibrate } from '../ui.js';
import { plural, todayIso } from '../format.js';
import { newId, productShortName } from '../model.js';

// Вкладка «Фасовка» — один кликер. Начали, накликали порции, остановили —
// результат сам записался в «Учёт» под сегодняшней датой. Сессия хранится
// в состоянии, так что свёрнутое приложение продолжает с того же места.

export function renderPacking(ctx) {
  const { session } = ctx.state;
  return session ? clickerScreen(ctx, session) : idleScreen(ctx);
}

// ---------- до старта ----------

function idleScreen(ctx) {
  const start = h('button', { class: 'clicker', type: 'button', onclick: () => openStartSheet(ctx) },
    circleSvg(),
    h('div', { class: 'face' },
      h('div', {
        style: { fontSize: '22px', fontWeight: '700', color: 'var(--accent)' },
        text: 'Начать фасовку',
      }),
      h('div', { class: 'cta', text: 'Выберете продукт и вперёд' }),
    ),
  );

  return h('div', { class: 'screen' },
    header({ title: 'Фасовка' }),
    h('div', { class: 'packing' },
      h('div', { class: 'clicker-wrap' }, start),
    ),
  );
}

function openStartSheet(ctx) {
  openSheet('Что фасуем?', (close) => {
    const products = [...ctx.state.products].sort((a, b) =>
      productShortName(a).localeCompare(productShortName(b), 'ru'));

    if (products.length === 0) {
      return [
        h('p', { class: 'hint' },
          'Продукции пока нет — добавьте её на вкладке «Рецептура», и она появится здесь.'),
      ];
    }

    const select = h('select', {},
      h('option', { value: '', text: 'Выберите продукцию…' }),
      products.map((p) => h('option', {
        value: p.id,
        text: `${p.emoji}  ${productShortName(p)}`,
      })),
    );

    return [
      h('div', { class: 'block' },
        h('p', { class: 'label', text: 'Продукция' }),
        h('div', { class: 'field' }, select),
      ),
      button('Начать', () => {
        const product = products.find((p) => p.id === select.value);
        if (!product) {
          ctx.toast('Сначала выберите продукцию', { error: true });
          return;
        }
        ctx.update((s) => {
          s.session = {
            name: productShortName(product),
            emoji: product.emoji,
            count: 0,
            active: true,
          };
        });
        close();
      }, { primary: true, wide: true }),
    ];
  });
}

// ---------- кликер ----------

function clickerScreen(ctx, session) {
  let count = session.count;

  const countNode = h('div', { class: 'count', text: String(count) });
  const ctaNode = h('div', {
    class: 'cta',
    text: session.active ? 'Нажмите — плюс порция' : 'Фасовка остановлена',
  });

  const clicker = h('button', { class: 'clicker', type: 'button', disabled: !session.active },
    circleSvg(session.active),
    h('div', { class: 'face' },
      countNode,
      h('div', { class: 'of', text: plural(count, 'порция', 'порции', 'порций') }),
      ctaNode,
    ),
  );

  let bumpTimer = null;
  clicker.addEventListener('click', () => {
    count += 1;
    vibrate(12);
    ctx.updateQuiet((s) => { if (s.session) s.session.count = count; });

    countNode.textContent = String(count);
    clicker.querySelector('.of').textContent = plural(count, 'порция', 'порции', 'порций');
    clicker.classList.add('bump');
    clearTimeout(bumpTimer);
    bumpTimer = setTimeout(() => clicker.classList.remove('bump'), 110);
  });

  const controls = h('div', { class: 'btn-row', style: { justifyContent: 'center' } });

  if (session.active) {
    const stop = button('Стоп фасовки', () => {
      ctx.update((s) => {
        if (!s.session) return;
        s.session.active = false;
        if (s.session.count > 0) recordPacked(s, s.session);
      });
    });
    stop.classList.add('small');
    stop.style.flex = 'none';
    controls.appendChild(stop);
  } else {
    const reset = button('Сброс', () => {
      ctx.update((s) => { s.session = null; });
    }, { primary: true });
    reset.classList.add('small');
    reset.style.flex = 'none';
    controls.appendChild(reset);
  }

  if (session.active) keepScreenAwake();

  return h('div', { class: 'screen' },
    header({
      title: 'Фасовка',
      subtitle: `${session.emoji}  ${session.name}`,
    }),
    h('div', { class: 'packing' },
      h('div', { class: 'clicker-wrap' }, clicker),
      controls,
      h('p', { class: 'keys' },
        session.active
          ? 'Счёт сохраняется сразу — приложение можно свернуть и вернуться.'
          : 'Порции записаны в «Учёт» под сегодняшней датой. «Сброс» готовит кликер к новой фасовке.'),
    ),
  );
}

/** Дописать нафасованное в журнал учёта: под сегодняшней датой, той же строкой. */
function recordPacked(s, session) {
  const today = todayIso();
  let rec = s.packings.find((p) => p.date === today);
  if (!rec) {
    rec = { id: newId(), date: today, entries: [], createdAt: Date.now() };
    s.packings.push(rec);
  }
  const entry = rec.entries.find((e) => e.name.toLowerCase() === session.name.toLowerCase());
  if (entry) {
    entry.portions += session.count;
    if (session.emoji) entry.emoji = session.emoji;
  } else {
    rec.entries.push({ name: session.name, emoji: session.emoji, portions: session.count });
  }
}

// ---------- оформление и утилиты ----------

function circleSvg(active = true) {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');

  const circle = document.createElementNS(svgNs, 'circle');
  circle.setAttribute('cx', '50');
  circle.setAttribute('cy', '50');
  circle.setAttribute('r', '45');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke-width', '5.5');
  circle.setAttribute('stroke', active ? 'var(--accent)' : 'rgba(28,33,64,0.12)');
  svg.appendChild(circle);
  return svg;
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
