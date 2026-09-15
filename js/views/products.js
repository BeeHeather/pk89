import {
  button, card, chip, confirmDialog, emptyState, field, h, header, openSheet,
} from '../ui.js';
import { countOf, gramsPretty } from '../format.js';
import { EMOJIS } from '../presets.js';
import { newId, portionGrams, productShortName } from '../model.js';

export function renderProducts(ctx) {
  const { state } = ctx;

  const grouped = new Map();
  for (const product of [...state.products].sort(byCategoryThenKind)) {
    const key = product.category.trim() || 'Без категории';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(product);
  }

  const scroll = h('div', { class: 'scroll' });

  if (state.products.length === 0) {
    scroll.appendChild(emptyState(
      '🥣',
      'Пока ничего нет',
      'Добавьте первый вид продукции — например, кисель смородиновый. Рецепт заполните внутри карточки.',
    ));
  } else {
    for (const [category, products] of grouped) {
      scroll.appendChild(h('div', { class: 'group-label', text: category }));
      for (const product of products) {
        scroll.appendChild(productCard(ctx, product));
      }
    }
  }

  const fab = button('Добавить', () => openEditor(ctx, null), { primary: true, icon: '＋' });
  fab.classList.add('fab');

  return h('div', { class: 'screen' },
    header({
      title: 'Продукция',
      subtitle: countOf(state.products.length, 'карточка', 'карточки', 'карточек'),
    }),
    scroll,
    fab,
  );
}

function byCategoryThenKind(a, b) {
  const byCategory = a.category.localeCompare(b.category, 'ru');
  return byCategory !== 0 ? byCategory : a.kind.localeCompare(b.kind, 'ru');
}

function productCard(ctx, product) {
  const grams = portionGrams(product);
  const subtitle = product.ingredients.length === 0
    ? 'Рецепт не заполнен'
    : `${countOf(product.ingredients.length, 'ингредиент', 'ингредиента', 'ингредиентов')} · ${gramsPretty(grams)} на порцию`;

  return card({ onclick: () => ctx.openProduct(product.id) },
    h('div', { class: 'row' },
      h('div', { class: 'emoji-badge', text: product.emoji }),
      h('div', { class: 'grow' },
        h('div', { class: 'strong ellipsis', text: productShortName(product) }),
        h('div', { class: 'hint ellipsis', text: subtitle }),
      ),
      chip('Изменить', {
        onclick: (event) => {
          event.stopPropagation();
          openEditor(ctx, product);
        },
      }),
    ),
  );
}

function openEditor(ctx, existing) {
  const knownCategories = [...new Set(
    ctx.state.products.map((p) => p.category.trim()).filter(Boolean),
  )];

  const draft = {
    category: existing?.category ?? '',
    kind: existing?.kind ?? '',
    emoji: existing?.emoji ?? '🥣',
    note: existing?.note ?? '',
  };

  openSheet(existing ? 'Карточка продукции' : 'Новая продукция', (close) => {
    const categoryField = field({
      value: draft.category,
      placeholder: 'Кисель',
      oninput: () => { draft.category = categoryField.input.value; refreshSave(); },
    });

    const kindField = field({
      value: draft.kind,
      placeholder: 'Смородиновый',
      oninput: () => { draft.kind = kindField.input.value; refreshSave(); },
    });

    const noteField = field({
      value: draft.note,
      placeholder: 'Залить 200 мл кипятка, размешать',
      multiline: true,
      rows: 3,
      oninput: () => { draft.note = noteField.input.value; },
    });

    const categoryChips = h('div', { class: 'chips', style: { marginTop: '8px' } },
      knownCategories.map((name) => chip(name, {
        onclick: () => {
          draft.category = name;
          categoryField.input.value = name;
          refreshSave();
        },
      })),
    );

    const emojiChips = h('div', { class: 'chips' },
      EMOJIS.map((emoji) => {
        const node = chip(emoji, {
          on: emoji === draft.emoji,
          onclick: () => {
            draft.emoji = emoji;
            for (const other of emojiChips.children) other.className = 'chip';
            node.className = 'chip on';
          },
        });
        return node;
      }),
    );

    const saveButton = button('Сохранить', () => {
      const payload = {
        category: draft.category.trim(),
        kind: draft.kind.trim(),
        emoji: draft.emoji,
        note: draft.note.trim(),
      };

      ctx.update((s) => {
        if (existing) {
          const target = s.products.find((p) => p.id === existing.id);
          if (target) Object.assign(target, payload);
        } else {
          s.products.push({ id: newId(), ingredients: [], ...payload });
        }
      });
      close();
    }, { primary: true });

    function refreshSave() {
      saveButton.disabled = !draft.category.trim() && !draft.kind.trim();
    }
    refreshSave();

    const actions = h('div', { class: 'btn-row' }, saveButton);

    if (existing) {
      actions.appendChild(button('Удалить', async () => {
        const ok = await confirmDialog({
          title: 'Удалить карточку?',
          message: 'Вместе с ней исчезнут рецепт и все коробки этой продукции. Действие нельзя отменить.',
          confirmText: 'Удалить',
        });
        if (!ok) return;
        ctx.update((s) => {
          s.products = s.products.filter((p) => p.id !== existing.id);
          s.boxes = s.boxes.filter((b) => b.productId !== existing.id);
        });
        close();
      }, { danger: true }));
    }

    return [
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Категория' }), categoryField,
        knownCategories.length ? categoryChips : null),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Вид' }), kindField),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Значок' }), emojiChips),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Как готовить' }), noteField),
      actions,
    ];
  });
}
