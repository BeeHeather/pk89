import { button, card, emptyState, field, h, header, openSheet } from '../ui.js';
import { countOf, formatDateTime, gramsPretty, parseNumber, pretty } from '../format.js';
import { applyStockChange, stockKey } from '../model.js';

export function renderAccounting(ctx) {
  const { state } = ctx;
  const items = collectItems(state);

  if (items.length === 0) {
    return h('div', { class: 'screen' },
      header({ title: 'Учёт' }),
      h('div', { class: 'scroll' },
        emptyState('📦', 'Пока нечего учитывать',
          'Добавьте продукцию с ингредиентами — список склада соберётся сам.'),
      ),
    );
  }

  const total = items.reduce((sum, item) => sum + item.grams, 0);

  const list = card({},
    ...items.map((item) => h('div', {
      class: 'recipe-line',
      style: { padding: '10px 0', cursor: 'pointer' },
      onclick: () => openStockSheet(ctx, item.name),
    },
    h('span', { class: 'name', text: item.name }),
    h('span', {
      class: 'g',
      style: item.grams < 0 ? { color: '#C62828' } : null,
      text: gramsPretty(item.grams),
    }),
    )),
    h('div', { class: 'total-line' },
      h('span', { class: 'name', text: 'Всего на складе' }),
      h('span', { class: 'value', text: gramsPretty(total) }),
    ),
  );

  return h('div', { class: 'screen' },
    header({
      title: 'Учёт',
      subtitle: countOf(items.length, 'позиция', 'позиции', 'позиций'),
    }),
    h('div', { class: 'scroll', style: { paddingTop: '14px' } },
      h('p', { class: 'hint', style: { margin: '0 4px 10px' } },
        'Остатки по ингредиентам. Новая коробка на фасовке списывает их сама; нажмите на позицию, чтобы поправить остаток или посмотреть историю.'),
      list,
    ),
  );
}

/**
 * Сводный список: все позиции склада плюс ингредиенты из рецептов,
 * которых на складе ещё нет (они показываются с нулевым остатком).
 */
function collectItems(state) {
  const map = new Map();

  for (const entry of state.stock) {
    map.set(stockKey(entry.name), { name: entry.name, grams: entry.grams });
  }

  for (const product of state.products) {
    for (const ingredient of product.ingredients) {
      const key = stockKey(ingredient.name);
      if (!key || map.has(key)) continue;
      map.set(key, { name: ingredient.name.trim(), grams: 0 });
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function openStockSheet(ctx, name) {
  const entry = ctx.state.stock.find((s) => stockKey(s.name) === stockKey(name));
  const grams = entry?.grams ?? 0;
  const history = [...(entry?.history ?? [])].reverse();

  openSheet(name, (close) => {
    const gramsField = field({
      value: pretty(grams, 1),
      inputmode: 'decimal',
      suffix: 'г',
    });

    const save = () => {
      const value = parseNumber(gramsField.input.value);
      if (value == null) {
        ctx.toast('Не понимаю число — например: 1500 или 2,5', { error: true });
        return;
      }
      const delta = Math.round((value - grams) * 100) / 100;
      if (delta !== 0) {
        ctx.update((s) => applyStockChange(s, name, delta, 'Правка вручную'));
      }
      close();
    };

    return [
      h('div', { class: 'block' },
        h('p', { class: 'label', text: 'Остаток на складе, граммы' }),
        gramsField,
      ),
      button('Сохранить', save, { primary: true, wide: true }),
      h('div', { class: 'block', style: { marginTop: '18px' } },
        h('p', { class: 'label', text: 'История изменений' }),
        history.length === 0
          ? h('p', { class: 'hint' }, 'Изменений пока не было.')
          : card({}, ...history.map(historyLine)),
      ),
    ];
  });
}

function historyLine(event) {
  const sign = event.delta > 0 ? '+' : '−';
  return h('div', { class: 'recipe-line', style: { alignItems: 'baseline' } },
    h('span', { class: 'name' },
      h('div', { text: event.note || 'Изменение' }),
      h('div', { class: 'hint', text: formatDateTime(event.at) }),
    ),
    h('span', { class: 'g', text: `${sign}${gramsPretty(Math.abs(event.delta))}` }),
    h('span', { class: 'tsp', text: `→ ${gramsPretty(event.after)}` }),
  );
}
