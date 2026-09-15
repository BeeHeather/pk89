import {
  button, card, chip, confirmDialog, emptyState, field, h, header, iconButton, openSheet, stepper,
} from '../ui.js';
import { countOf } from '../format.js';
import { EMOJIS, PRESETS } from '../presets.js';
import {
  UNITS, amountText, newId, productShortName, totalsText, unitInfo,
} from '../model.js';
import { openSettings } from './settings.js';

export function renderProducts(ctx) {
  const { state } = ctx;

  const scroll = h('div', { class: 'scroll' });

  if (state.products.length === 0) {
    scroll.appendChild(emptyState(
      '🥣',
      'Пока ничего нет',
      'Добавьте первый вид продукции — например, кисель смородиновый. Рецепт заполняется в этой же форме.',
    ));
  } else {
    const sorted = [...state.products].sort((a, b) =>
      productShortName(a).localeCompare(productShortName(b), 'ru'));
    for (const product of sorted) {
      scroll.appendChild(productCard(ctx, product));
    }
  }

  const fab = button('Добавить', () => openEditor(ctx, null), { primary: true, icon: '＋' });
  fab.classList.add('fab');

  return h('div', { class: 'screen' },
    header({
      title: 'Продукция',
      subtitle: countOf(state.products.length, 'карточка', 'карточки', 'карточек'),
      actions: iconButton('⚙️', () => openSettings(ctx), { label: 'Настройки' }),
    }),
    scroll,
    fab,
  );
}

function productCard(ctx, product) {
  const subtitle = product.ingredients.length === 0
    ? 'Рецепт не заполнен'
    : `${countOf(product.ingredients.length, 'ингредиент', 'ингредиента', 'ингредиентов')} · ${totalsText(product)} на порцию`;

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
  const draft = {
    name: existing?.name ?? '',
    emoji: existing?.emoji ?? '🥣',
    note: existing?.note ?? '',
    // рецепт правится в черновике и попадает в данные только по «Сохранить»
    ingredients: structuredClone(existing?.ingredients ?? []),
  };

  openSheet(existing ? 'Карточка продукции' : 'Новая продукция', (close) => {
    const nameField = field({
      value: draft.name,
      placeholder: 'Кисель смородиновый',
      oninput: () => { draft.name = nameField.input.value; refreshSave(); },
    });

    const noteField = field({
      value: draft.note,
      placeholder: 'Залить 200 мл кипятка, размешать',
      multiline: true,
      rows: 3,
      oninput: () => { draft.note = noteField.input.value; },
    });

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

    const recipeList = h('div', {});

    function redrawRecipe() {
      const rows = draft.ingredients.map((ingredient) => h('div', {
        class: 'recipe-line',
        style: { padding: '8px 0', cursor: 'pointer' },
        onclick: () => openIngredientSheet(ingredient, {
          onSave: (data) => {
            Object.assign(ingredient, data);
            redrawRecipe();
          },
          onDelete: () => {
            draft.ingredients = draft.ingredients.filter((i) => i !== ingredient);
            redrawRecipe();
          },
        }),
      },
      h('span', { class: 'name', text: ingredient.name || 'Без названия' }),
      h('span', { class: 'g', text: amountText(ingredient.amount, ingredient.unit) }),
      ));

      recipeList.replaceChildren(
        draft.ingredients.length === 0
          ? h('p', { class: 'hint', text: 'Ингредиентов пока нет — добавьте первый.' })
          : h('div', {}, ...rows,
            h('div', { class: 'total-line' },
              h('span', { class: 'name', text: 'На порцию' }),
              h('span', { class: 'value', text: totalsText(draft) }),
            )),
        h('div', { style: { marginTop: '10px' } },
          button('＋ Добавить ингредиент', () => openIngredientSheet(null, {
            onSave: (data) => {
              draft.ingredients.push({ id: newId(), ...data });
              redrawRecipe();
            },
          }), { wide: true })),
      );
    }

    redrawRecipe();

    const saveButton = button('Сохранить', () => {
      const payload = {
        name: draft.name.trim(),
        emoji: draft.emoji,
        note: draft.note.trim(),
        ingredients: draft.ingredients,
      };

      ctx.update((s) => {
        if (existing) {
          const target = s.products.find((p) => p.id === existing.id);
          if (target) Object.assign(target, payload);
        } else {
          s.products.push({ id: newId(), ...payload });
        }
      });
      close();
    }, { primary: true });

    function refreshSave() {
      saveButton.disabled = !draft.name.trim();
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
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Название' }), nameField),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Значок' }), emojiChips),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Рецепт на одну порцию' }), recipeList),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Как готовить' }), noteField),
      actions,
    ];
  });
}

/**
 * Шторка одного ингредиента. Работает с колбэками, а не с состоянием:
 * рецепт лежит в черновике карточки, пока её не сохранили.
 */
function openIngredientSheet(existing, { onSave, onDelete }) {
  const draft = {
    name: existing?.name ?? '',
    amount: existing?.amount ?? 5,
    unit: existing?.unit ?? 'g',
  };

  const UNIT_TITLES = { g: 'Граммы', tsp: 'Чайные ложки', tbsp: 'Столовые ложки' };

  openSheet(existing ? 'Ингредиент' : 'Новый ингредиент', (close) => {
    const nameField = field({
      value: draft.name,
      placeholder: 'Сахар',
      oninput: () => {
        draft.name = nameField.input.value;
        saveButton.disabled = !draft.name.trim();
        redrawSuggestions();
      },
    });

    const suggestions = h('div', { class: 'chips', style: { marginTop: '8px' } });

    function redrawSuggestions() {
      const query = draft.name.trim().toLowerCase();
      const matches = (query
        ? PRESETS.filter((name) => name.toLowerCase().includes(query))
        : PRESETS
      ).slice(0, 6);

      suggestions.replaceChildren(...matches.map((name) => chip(name, {
        on: name.toLowerCase() === query,
        onclick: () => {
          draft.name = name;
          nameField.input.value = name;
          saveButton.disabled = false;
          redrawSuggestions();
        },
      })));
    }

    const unitChips = h('div', { class: 'chips' });
    const amountSlot = h('div', {});

    function redrawUnits() {
      unitChips.replaceChildren(...UNITS.map((u) => chip(UNIT_TITLES[u.id], {
        on: u.id === draft.unit,
        onclick: () => {
          if (draft.unit === u.id) return;
          draft.unit = u.id;
          redrawUnits();
          rebuildAmount();
        },
      })));
    }

    function rebuildAmount() {
      const unit = unitInfo(draft.unit);
      amountSlot.replaceChildren(stepper({
        value: draft.amount,
        step: draft.unit === 'g' ? 0.5 : 0.25,
        suffix: unit.label,
        onchange: (value) => { draft.amount = value; },
      }));
    }

    const saveButton = button('Сохранить', () => {
      onSave({ name: draft.name.trim(), amount: draft.amount, unit: draft.unit });
      close();
    }, { primary: true });

    saveButton.disabled = !draft.name.trim();
    redrawSuggestions();
    redrawUnits();
    rebuildAmount();

    const actions = h('div', { class: 'btn-row' }, saveButton);

    if (existing && onDelete) {
      actions.appendChild(button('Удалить', async () => {
        const ok = await confirmDialog({
          title: 'Убрать ингредиент?',
          message: 'Строка исчезнет из рецепта и из расчёта партии.',
          confirmText: 'Убрать',
        });
        if (!ok) return;
        onDelete();
        close();
      }, { danger: true }));
    }

    return [
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Название' }), nameField, suggestions),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Единица измерения' }), unitChips),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Количество на порцию' }), amountSlot),
      actions,
    ];
  });
}
