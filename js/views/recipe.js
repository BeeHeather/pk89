import {
  button, card, chip, dismissTop, field, h, header, openSheet, tile,
} from '../ui.js';
import { plural } from '../format.js';
import { amountText, productShortName, totalsText } from '../model.js';

export function renderRecipe(ctx, product) {
  const scroll = h('div', { class: 'scroll no-bar' });

  scroll.appendChild(h('div', { class: 'tiles', style: { marginBottom: '10px' } },
    tile('На порцию', totalsText(product), 'mint'),
    tile('Ингредиентов', String(product.ingredients.length), 'lilac'),
  ));

  scroll.appendChild(batchCalculator(product, 'Расчёт партии', 30));
  scroll.appendChild(noteCard(ctx, product));

  return h('div', { class: 'screen' },
    header({
      title: productShortName(product),
      back: () => dismissTop(),
      actions: h('div', { class: 'emoji-badge small', text: product.emoji }),
    }),
    scroll,
  );
}

function noteCard(ctx, product) {
  return card({ onclick: () => openNote(ctx, product) },
    h('h2', { class: 'section', text: 'Как готовить' }),
    h('p', {
      class: product.note.trim() ? 'hint' : 'hint faint',
      text: product.note.trim() || 'Нажмите, чтобы добавить описание приготовления.',
    }),
  );
}

/** Пересчёт рецепта на партию: расход по каждому ингредиенту. */
export function batchCalculator(product, title, initialPortions) {
  let portions = initialPortions;

  const lines = h('div', {});
  const totalValue = h('span', { class: 'value' });

  const input = field({
    value: String(portions),
    inputmode: 'numeric',
    suffix: plural(portions, 'порция', 'порции', 'порций'),
    oninput: () => {
      const digits = input.input.value.replace(/\D/g, '').slice(0, 6);
      if (digits !== input.input.value) input.input.value = digits;
      portions = Number(digits) || 0;
      redraw();
    },
  });

  const presetChips = h('div', { class: 'chips', style: { marginTop: '10px' } },
    [10, 20, 30, 50, 100].map((n) => chip(String(n), {
      onclick: () => {
        portions = n;
        input.input.value = String(n);
        redraw();
      },
    })),
  );

  function redraw() {
    input.querySelector('.suffix').textContent = plural(portions, 'порция', 'порции', 'порций');

    for (const node of [...presetChips.children]) {
      node.className = node.textContent === String(portions) ? 'chip on' : 'chip';
    }

    lines.replaceChildren(...product.ingredients.map((ingredient) => h('div', { class: 'recipe-line' },
      h('span', { class: 'name', text: ingredient.name || 'Без названия' }),
      h('span', { class: 'g', text: amountText((ingredient.amount || 0) * portions, ingredient.unit) }),
    )));

    totalValue.textContent = totalsText(product, portions);
  }

  redraw();

  const body = [
    h('h2', { class: 'section', text: title }),
    h('p', { class: 'hint' }, 'Укажите, сколько порций готовите — пересчитаю весь рецепт.'),
    h('div', { style: { marginTop: '14px' } }, input),
    presetChips,
  ];

  if (product.ingredients.length === 0) {
    body.push(h('p', { class: 'hint', style: { marginTop: '14px' } },
      'Рецепт пока пуст — заполните его через «Изменить» на вкладке «Рецептура», и здесь появится расход.'));
  } else {
    body.push(h('div', { style: { marginTop: '16px' } }, lines));
    body.push(h('div', { class: 'total-line' },
      h('span', { class: 'name', text: 'Всего смеси' }),
      totalValue,
    ));
  }

  return card({}, ...body);
}

function openNote(ctx, product) {
  openSheet('Как готовить', (close) => {
    const noteField = field({
      value: product.note,
      placeholder: 'Залить 200 мл кипятка, размешать, дать постоять 2 минуты',
      multiline: true,
      rows: 4,
    });

    return [
      h('div', { class: 'block' }, noteField),
      button('Сохранить', () => {
        const value = noteField.input.value.trim();
        ctx.update((s) => {
          const target = s.products.find((p) => p.id === product.id);
          if (target) target.note = value;
        });
        close();
      }, { primary: true, wide: true }),
    ];
  });
}
