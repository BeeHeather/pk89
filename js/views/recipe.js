import {
  button, card, chip, confirmDialog, dismissTop, field, h, header,
  iconButton, openSheet, stepper, tile,
} from '../ui.js';
import { gramsPretty, plural, pretty } from '../format.js';
import { PRESETS, DEFAULT_GRAMS_PER_TSP } from '../presets.js';
import {
  ingredientGrams, newId, portionGrams, portionTeaspoons, productShortName,
} from '../model.js';

export function renderRecipe(ctx, product) {
  const scroll = h('div', { class: 'scroll no-bar' });

  scroll.appendChild(h('div', { class: 'tiles', style: { marginBottom: '10px' } },
    tile('Вес порции', gramsPretty(portionGrams(product)), 'mint'),
    tile('Всего ложек', pretty(portionTeaspoons(product), 2), 'sky'),
    tile('Ингредиентов', String(product.ingredients.length), 'lilac'),
  ));

  scroll.appendChild(h('div', { class: 'row', style: { margin: '18px 0 8px' } },
    h('h2', { class: 'section grow', text: 'Рецепт на одну порцию' }),
    iconButton('＋', () => openIngredient(ctx, product, null), { accent: true, label: 'Добавить ингредиент' }),
  ));

  if (product.ingredients.length === 0) {
    scroll.appendChild(card({},
      h('p', { class: 'hint' }, 'Рецепт пока пуст. Нажмите «плюс» и добавьте первый ингредиент — количество указывается в чайных ложках, граммы посчитаются сами.'),
    ));
  } else {
    for (const ingredient of product.ingredients) {
      scroll.appendChild(ingredientCard(ctx, product, ingredient));
    }
  }

  scroll.appendChild(batchCalculator(product, 'Расчёт партии', 30));
  scroll.appendChild(noteCard(ctx, product));

  return h('div', { class: 'screen' },
    header({
      title: productShortName(product),
      subtitle: product.category.trim() && product.kind.trim() ? product.category : null,
      back: () => dismissTop(),
      actions: h('div', { class: 'emoji-badge small', text: product.emoji }),
    }),
    scroll,
  );
}

function ingredientCard(ctx, product, ingredient) {
  return card({ onclick: () => openIngredient(ctx, product, ingredient) },
    h('div', { class: 'row' },
      h('div', { class: 'grow' },
        h('div', { class: 'strong ellipsis', text: ingredient.name || 'Без названия' }),
        h('div', {
          class: 'hint',
          text: `${pretty(ingredient.teaspoons, 2)} ч. л.  ·  ${pretty(ingredient.gramsPerTeaspoon, 1)} г в ложке`,
        }),
      ),
      h('div', { class: 'strong accent', style: { fontSize: '18px' }, text: gramsPretty(ingredientGrams(ingredient)) }),
    ),
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

/** Пересчёт рецепта на партию: ложки и граммы по каждому ингредиенту. */
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
      h('span', { class: 'tsp', text: `${pretty(ingredient.teaspoons * portions, 1)} ч. л.` }),
      h('span', { class: 'g', text: gramsPretty(ingredientGrams(ingredient) * portions) }),
    )));

    totalValue.textContent = gramsPretty(portionGrams(product) * portions);
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
      'Рецепт пока пуст — добавьте ингредиенты, и здесь появится расход.'));
  } else {
    body.push(h('div', { style: { marginTop: '16px' } }, lines));
    body.push(h('div', { class: 'total-line' },
      h('span', { class: 'name', text: 'Всего смеси' }),
      totalValue,
    ));
  }

  return card({}, ...body);
}

function openIngredient(ctx, product, existing) {
  const draft = {
    name: existing?.name ?? '',
    teaspoons: existing?.teaspoons ?? 1,
    gramsPerTeaspoon: existing?.gramsPerTeaspoon ?? DEFAULT_GRAMS_PER_TSP,
  };

  openSheet(existing ? 'Ингредиент' : 'Новый ингредиент', (close) => {
    const result = h('div', { class: 'row' },
      h('span', { class: 'grow', text: 'Выходит на порцию' }),
      h('span', { class: 'strong', style: { fontSize: '20px' } }),
    );
    const resultValue = result.lastChild;

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
        ? PRESETS.filter((p) => p.name.toLowerCase().includes(query))
        : PRESETS
      ).slice(0, 6);

      suggestions.replaceChildren(...matches.map((preset) => chip(preset.name, {
        on: preset.name.toLowerCase() === query,
        onclick: () => {
          draft.name = preset.name;
          draft.gramsPerTeaspoon = preset.gramsPerTeaspoon;
          nameField.input.value = preset.name;
          gramsInput.querySelector('input').value = String(preset.gramsPerTeaspoon).replace('.', ',');
          saveButton.disabled = false;
          redrawSuggestions();
          redrawResult();
        },
      })));
    }

    const teaspoonsInput = stepper({
      value: draft.teaspoons,
      step: 0.25,
      suffix: 'ч. л.',
      onchange: (value) => { draft.teaspoons = value; redrawResult(); },
    });

    const gramsInput = stepper({
      value: draft.gramsPerTeaspoon,
      step: 0.5,
      suffix: 'г',
      onchange: (value) => { draft.gramsPerTeaspoon = value; redrawResult(); },
    });

    function redrawResult() {
      resultValue.textContent = gramsPretty(draft.teaspoons * draft.gramsPerTeaspoon);
    }

    const saveButton = button('Сохранить', () => {
      ctx.update((s) => {
        const target = s.products.find((p) => p.id === product.id);
        if (!target) return;
        if (existing) {
          const item = target.ingredients.find((i) => i.id === existing.id);
          if (item) Object.assign(item, {
            name: draft.name.trim(),
            teaspoons: draft.teaspoons,
            gramsPerTeaspoon: draft.gramsPerTeaspoon,
          });
        } else {
          target.ingredients.push({
            id: newId(),
            name: draft.name.trim(),
            teaspoons: draft.teaspoons,
            gramsPerTeaspoon: draft.gramsPerTeaspoon,
          });
        }
      });
      close();
    }, { primary: true });

    saveButton.disabled = !draft.name.trim();
    redrawSuggestions();
    redrawResult();

    const actions = h('div', { class: 'btn-row' }, saveButton);

    if (existing) {
      actions.appendChild(button('Удалить', async () => {
        const ok = await confirmDialog({
          title: 'Убрать ингредиент?',
          message: 'Строка исчезнет из рецепта и из расчёта партии.',
          confirmText: 'Убрать',
        });
        if (!ok) return;
        ctx.update((s) => {
          const target = s.products.find((p) => p.id === product.id);
          if (target) target.ingredients = target.ingredients.filter((i) => i.id !== existing.id);
        });
        close();
      }, { danger: true }));
    }

    return [
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Название' }), nameField, suggestions),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Чайных ложек на порцию' }), teaspoonsInput),
      h('div', { class: 'block' },
        h('p', { class: 'label', text: 'Грамм в одной чайной ложке' }),
        gramsInput,
        h('p', { class: 'hint', style: { marginTop: '6px' } },
          'Значение справочное. Взвесьте свою ложку один раз и поставьте точное число.'),
      ),
      card({ tint: 'mint' }, result),
      actions,
    ];
  });
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
