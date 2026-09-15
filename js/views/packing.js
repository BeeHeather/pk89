import {
  button, card, chip, confirmDialog, emptyState, field, h, header,
  iconButton, openSheet, pill, progress,
} from '../ui.js';
import { countOf, formatDateTime, gramsPretty, plural, pretty } from '../format.js';
import {
  boxIsClosed, boxIsFull, boxProgress, consumeStockForBox, ingredientGrams,
  newId, portionGrams, productShortName,
} from '../model.js';
import { batchCalculator } from './recipe.js';

// Какой продукт выбран — живёт между перерисовками, но не в сохраняемых данных.
let selectedProductId = null;

export function renderPacking(ctx) {
  const { state } = ctx;

  if (state.products.length === 0) {
    return h('div', { class: 'screen' },
      header({ title: 'Фасовка' }),
      h('div', { class: 'scroll' },
        emptyState('📦', 'Сначала нужна продукция',
          'Заведите карточку на вкладке «Продукция» — потом здесь появятся коробки.'),
      ),
    );
  }

  if (!state.products.some((p) => p.id === selectedProductId)) {
    selectedProductId = state.products[0].id;
  }

  const product = state.products.find((p) => p.id === selectedProductId);
  const boxes = state.boxes
    .filter((b) => b.productId === selectedProductId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const openCount = boxes.filter((b) => !boxIsClosed(b)).length;

  const productChips = h('div', { class: 'chips scroll-x' },
    state.products.map((p) => chip(`${p.emoji}  ${productShortName(p)}`, {
      on: p.id === selectedProductId,
      onclick: () => {
        selectedProductId = p.id;
        ctx.render();
      },
    })),
  );

  const scroll = h('div', { class: 'scroll', style: { paddingTop: '14px' } });

  if (boxes.length === 0) {
    scroll.appendChild(card({},
      h('p', { class: 'hint' }, 'Коробок по этой продукции пока нет. Создайте первую — укажете, сколько порций в неё идёт.'),
    ));
  } else {
    for (const box of boxes) scroll.appendChild(boxCard(ctx, box));
  }

  scroll.appendChild(batchCalculator(product, 'Норма на коробку', boxes[0]?.targetPortions ?? 50));

  const fab = button('Новая коробка', () => openNewBox(ctx, product), { primary: true, icon: '＋' });
  fab.classList.add('fab');

  return h('div', { class: 'screen' },
    header({
      title: 'Фасовка',
      subtitle: openCount === 0
        ? 'Открытых коробок нет'
        : `${countOf(openCount, 'коробка', 'коробки', 'коробок')} в работе`,
    }),
    productChips,
    scroll,
    fab,
  );
}

function boxCard(ctx, box) {
  const closed = boxIsClosed(box);
  const full = boxIsFull(box);

  const status = closed ? pill('Закрыта', 'closed')
    : full ? pill('Заполнена', 'done')
      : box.packedPortions > 0 ? pill('В работе', 'work')
        : pill('Новая', 'new');

  const action = closed
    ? button('Открыть снова', () => {
      ctx.update((s) => {
        const target = s.boxes.find((b) => b.id === box.id);
        if (target) target.closedAt = null;
      });
    })
    : button(box.packedPortions > 0 ? 'Продолжить' : 'Начать фасовку',
      () => ctx.startPacking(box.id), { primary: true });

  action.style.flex = '1';

  return card({},
    h('div', { class: 'row' },
      h('div', { class: 'strong grow ellipsis', style: { fontSize: '17px' }, text: box.label || 'Коробка' }),
      status,
    ),
    h('div', { class: 'row', style: { alignItems: 'baseline', marginTop: '12px' } },
      h('span', { class: 'big-num', text: String(box.packedPortions) }),
      h('span', { class: 'hint', text: `из ${box.targetPortions} ${plural(box.targetPortions, 'порции', 'порций', 'порций')}` }),
    ),
    h('div', { style: { marginTop: '10px' } },
      progress(boxProgress(box), closed ? 'closed' : full ? 'done' : null)),
    h('p', {
      class: 'hint',
      style: { marginTop: '8px' },
      text: closed && box.closedAt
        ? `Закрыта ${formatDateTime(box.closedAt)}`
        : `Создана ${formatDateTime(box.createdAt)}`,
    }),
    h('div', { class: 'row', style: { marginTop: '14px' } },
      action,
      iconButton('🗑', async () => {
        const ok = await confirmDialog({
          title: 'Удалить коробку?',
          message: `${box.label || 'Коробка'} · собрано ${box.packedPortions} из ${box.targetPortions}. Действие нельзя отменить.`,
          confirmText: 'Удалить',
        });
        if (!ok) return;
        ctx.update((s) => { s.boxes = s.boxes.filter((b) => b.id !== box.id); });
      }, { danger: true, label: 'Удалить коробку' }),
    ),
  );
}

function openNewBox(ctx, product) {
  const nextIndex = ctx.state.boxes.filter((b) => b.productId === product.id).length + 1;
  const draft = { label: `Коробка №${nextIndex}`, target: 50 };

  openSheet('Новая коробка', (close) => {
    const labelField = field({
      value: draft.label,
      placeholder: `Коробка №${nextIndex}`,
      oninput: () => { draft.label = labelField.input.value; },
    });

    const targetField = field({
      value: String(draft.target),
      inputmode: 'numeric',
      suffix: plural(draft.target, 'порция', 'порции', 'порций'),
      oninput: () => {
        const digits = targetField.input.value.replace(/\D/g, '').slice(0, 6);
        if (digits !== targetField.input.value) targetField.input.value = digits;
        draft.target = Number(digits) || 0;
        redraw();
      },
    });

    const targetChips = h('div', { class: 'chips', style: { marginTop: '10px' } },
      [20, 30, 50, 100, 200].map((n) => chip(String(n), {
        onclick: () => {
          draft.target = n;
          targetField.input.value = String(n);
          redraw();
        },
      })),
    );

    const preview = h('div', {});

    function redraw() {
      targetField.querySelector('.suffix').textContent =
        plural(draft.target, 'порция', 'порции', 'порций');

      for (const node of [...targetChips.children]) {
        node.className = node.textContent === String(draft.target) ? 'chip on' : 'chip';
      }

      if (product.ingredients.length === 0) {
        preview.replaceChildren();
        return;
      }

      preview.replaceChildren(card({ tint: 'sky' },
        h('p', { class: 'label', text: 'Понадобится на коробку' }),
        ...product.ingredients.map((ingredient) => h('div', { class: 'recipe-line' },
          h('span', { class: 'name', text: ingredient.name || 'Без названия' }),
          h('span', { class: 'tsp', text: `${pretty(ingredient.teaspoons * draft.target, 1)} ч. л.` }),
          h('span', { class: 'g', text: gramsPretty(ingredientGrams(ingredient) * draft.target) }),
        )),
        h('div', { class: 'total-line' },
          h('span', { class: 'name', text: 'Всего смеси' }),
          h('span', { class: 'value', text: gramsPretty(portionGrams(product) * draft.target) }),
        ),
      ));
    }

    redraw();

    const create = (startNow) => {
      const box = {
        id: newId(),
        productId: product.id,
        label: draft.label.trim() || `Коробка №${nextIndex}`,
        targetPortions: Math.max(1, draft.target),
        packedPortions: 0,
        createdAt: Date.now(),
        closedAt: null,
      };
      ctx.update((s) => {
        s.boxes.push(box);
        const owner = s.products.find((p) => p.id === box.productId);
        if (owner) consumeStockForBox(s, owner, box);
      });
      close();
      if (startNow) ctx.startPacking(box.id);
    };

    return [
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Название' }), labelField),
      h('div', { class: 'block' },
        h('p', { class: 'label', text: 'Сколько порций в коробке' }),
        targetField,
        targetChips,
      ),
      h('div', { class: 'block' }, preview),
      button('Создать и начать фасовку', () => create(true), { primary: true, wide: true }),
      h('div', { style: { height: '10px' } }),
      button('Просто создать', () => create(false), { wide: true }),
    ];
  });
}
