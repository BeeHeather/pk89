import {
  button, card, chip, confirmDialog, emptyState, field, h, header,
  iconButton, openSheet, shareOrDownload, tile,
} from '../ui.js';
import { countOf, daysAgoIso, isoToUi, plural, todayIso } from '../format.js';
import { newId, productShortName } from '../model.js';
import { EMOJIS } from '../presets.js';
import { buildPackingsReport, packingsReportFileName } from '../packingsReport.js';

/** «🍝 Борщ» — имя с эмодзи для списков на экране. */
function itemLabel(name, emoji) {
  return emoji ? `${emoji} ${name}` : name;
}

export function renderAccounting(ctx) {
  const { state } = ctx;

  const totals = new Map(); // имя -> { portions, emoji }
  let todayTotal = 0;
  const today = todayIso();
  for (const rec of state.packings) {
    for (const entry of rec.entries) {
      const item = totals.get(entry.name) || { portions: 0, emoji: '' };
      item.portions += entry.portions;
      if (entry.emoji) item.emoji = entry.emoji;
      totals.set(entry.name, item);
      if (rec.date === today) todayTotal += entry.portions;
    }
  }
  const totalAll = [...totals.values()].reduce((s, item) => s + item.portions, 0);

  const scroll = h('div', { class: 'scroll', style: { paddingTop: '14px' } });

  if (state.packings.length === 0) {
    scroll.appendChild(emptyState('🧾', 'Фасовок пока нет',
      'Нажмите «Добавить фасовку» и запишите, что и сколько порций нафасовали.'));
  } else {
    scroll.appendChild(h('div', {
      class: 'row',
      style: { justifyContent: 'flex-end', marginBottom: '10px' },
    }, statsButton(ctx), postButton(ctx)));

    const byProduct = [...totals.entries()].sort((a, b) => b[1].portions - a[1].portions);

    scroll.appendChild(h('div', { class: 'group-label', text: 'Журнал фасовок' }));
    const journal = [...state.packings].sort((a, b) =>
      b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    for (const rec of journal) scroll.appendChild(packingCard(ctx, rec));
  }

  const fab = button('Добавить фасовку', () => openPacking(ctx, null), { primary: true, icon: '＋' });
  fab.classList.add('fab');

  return h('div', { class: 'screen' },
    header({
      title: 'Учёт',
      subtitle: state.packings.length === 0
        ? 'Результаты фасовки'
        : `${countOf(totalAll, 'порция', 'порции', 'порций')} готово за все время`,
    }),
    scroll,
    fab,
  );
}

function packingCard(ctx, rec) {
  const total = rec.entries.reduce((s, e) => s + e.portions, 0);

  return card({ onclick: () => openPacking(ctx, rec) },
    h('div', { class: 'row' },
      h('div', { class: 'strong grow', style: { fontSize: '17px' }, text: isoToUi(rec.date) }),
      h('div', { class: 'strong accent', text: countOf(total, 'порция', 'порции', 'порций') }),
    ),
    h('div', { style: { marginTop: '6px' } },
      rec.entries.map((entry) => h('div', { class: 'recipe-line' },
        h('span', { class: 'name', text: itemLabel(entry.name, entry.emoji) }),
        h('span', { class: 'g', text: String(entry.portions) }),
      ))),
  );
}

// ---------- пост для соцсетей ----------

function statsButton(ctx) {
  const label = '📊 Статистика';
  const node = button(label, async () => {
    node.disabled = true;
    node.textContent = 'Собираю…';
    try {
      const blob = buildPackingsReport(ctx.state.packings);
      const result = await shareOrDownload(blob, packingsReportFileName(), 'Учёт фасовки');
      if (result === 'downloaded') ctx.toast('Файл сохранён в загрузки');
    } catch (error) {
      console.error(error);
      ctx.toast(`Не удалось собрать статистику: ${error?.message || error}`, { error: true });
    } finally {
      node.disabled = false;
      node.textContent = label;
    }
  });
  node.classList.add('small');
  return node;
}

function postButton(ctx) {
  const node = button('📝 Создать пост', () => openPostSheet(ctx));
  node.classList.add('small');
  return node;
}

function openPostSheet(ctx) {
  openSheet('Пост о фасовке', (close) => {
    const fromField = field({
      value: daysAgoIso(7),
      type: 'date',
    });
    const toField = field({
      value: todayIso(),
      type: 'date',
    });

    const boxesField = field({
      value: '',
      placeholder: '0',
      inputmode: 'numeric',
      suffix: 'коробок',
      oninput: () => {
        const digits = boxesField.input.value.replace(/\D/g, '').slice(0, 5);
        if (digits !== boxesField.input.value) boxesField.input.value = digits;
      },
    });

    const create = button('Создать', async () => {
      let from = fromField.input.value;
      let to = toField.input.value;
      if (!from || !to) {
        ctx.toast('Укажите обе даты периода', { error: true });
        return;
      }
      if (from > to) [from, to] = [to, from];

      if (boxesField.input.value.trim() === '') {
        ctx.toast('Укажите, сколько коробок приготовили за период', { error: true });
        return;
      }
      const boxes = Number(boxesField.input.value) || 0;

      const text = buildPostText(ctx.state, from, to, boxes);
      if (!text) {
        ctx.toast('За этот период фасовок не записано', { error: true });
        return;
      }

      if (await copyText(text)) {
        ctx.toast('Пост скопирован в буфер обмена');
        close();
      } else {
        ctx.toast('Не удалось скопировать — разрешите доступ к буферу', { error: true });
      }
    }, { primary: true });

    return [
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'С даты' }), fromField),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'По дату' }), toField),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Приготовлено коробок за период' }), boxesField),
      h('p', { class: 'hint', style: { margin: '0 0 14px' } },
        'Порции по продукции возьмутся из журнала фасовок за период.'),
      h('div', { class: 'btn-row' },
        create,
        button('Отменить', () => close()),
      ),
    ];
  });
}

/** Текст поста: шаблон фиксированный, меняются только числа и список продукции. */
function buildPostText(state, from, to, boxes) {
  const totals = new Map(); // имя -> { portions, emoji }, в порядке первого появления
  let total = 0;

  const period = [...state.packings]
    .filter((rec) => rec.date >= from && rec.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  for (const rec of period) {
    for (const entry of rec.entries) {
      const item = totals.get(entry.name) || { portions: 0, emoji: '' };
      item.portions += entry.portions;
      if (entry.emoji) item.emoji = entry.emoji;
      totals.set(entry.name, item);
      total += entry.portions;
    }
  }
  if (total === 0) return null;

  const lines = [...totals.entries()]
    .map(([name, item]) => `${name}${item.emoji ? ` ${item.emoji}` : ''} ${item.portions}`)
    .join('\n');

  return `На этой неделе  нашим дружным коллективом Полевой кухни мы нафасовали ${total} ${plural(total, 'порцию', 'порции', 'порций')} и приготовили к отправке ${boxes} ${plural(boxes, 'коробку', 'коробки', 'коробок')} \n${lines}\n\n\nА также в каждой коробке пакетики с печеньем, бубликами и конфетами!\n\nНужно\nОгромное спасибо всем за помощь! `;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // нет разрешения или не защищённый контекст — пробуем старый способ
  }
  try {
    const area = h('textarea', {
      value: text,
      style: { position: 'fixed', opacity: '0', pointerEvents: 'none' },
    });
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

// ---------- форма фасовки ----------

function openPacking(ctx, existing) {
  // строки формы: выбранная продукция + порции
  const rows = existing
    ? existing.entries.map((e) => ({ name: e.name, emoji: e.emoji, portions: e.portions }))
    : [{ name: '', emoji: '', portions: 0 }];

  openSheet(existing ? 'Фасовка' : 'Новая фасовка', (close) => {
    const dateField = field({
      value: existing?.date ?? todayIso(),
      type: 'date',
    });

    const dateChips = h('div', { class: 'chips', style: { marginTop: '8px' } },
      chip('Сегодня', { onclick: () => { dateField.input.value = todayIso(); } }),
      chip('Вчера', { onclick: () => { dateField.input.value = daysAgoIso(1); } }),
    );

    const rowsBox = h('div', {});

    function rowNode(row) {
      const products = [...ctx.state.products].sort((a, b) =>
        productShortName(a).localeCompare(productShortName(b), 'ru'));

      const select = h('select', {
        onchange: () => {
          row.name = select.value;
          const product = products.find((p) => productShortName(p) === select.value);
          if (product) row.emoji = product.emoji;
        },
      },
      h('option', { value: '', text: 'Выберите продукцию…' }),
      // запись из журнала могла остаться от удалённой продукции — не теряем её
      row.name && !products.some((p) => productShortName(p) === row.name)
        ? h('option', { value: row.name, text: itemLabel(row.name, row.emoji) })
        : null,
      products.map((p) => h('option', {
        value: productShortName(p),
        text: itemLabel(productShortName(p), p.emoji),
      })),
      );
      select.value = row.name || '';

      const portionsField = field({
        value: row.portions ? String(row.portions) : '',
        placeholder: '0',
        inputmode: 'numeric',
        center: true,
        oninput: () => {
          const digits = portionsField.input.value.replace(/\D/g, '').slice(0, 6);
          if (digits !== portionsField.input.value) portionsField.input.value = digits;
          row.portions = Number(digits) || 0;
        },
      });
      portionsField.style.width = '90px';
      portionsField.style.flex = 'none';

      return h('div', { class: 'row', style: { marginTop: '8px' } },
        h('div', { class: 'field', style: { flex: '1', minWidth: '0' } }, select),
        portionsField,
        iconButton('✕', () => {
          rows.splice(rows.indexOf(row), 1);
          if (rows.length === 0) rows.push({ name: '', emoji: '', portions: 0 });
          redrawRows();
        }, { small: true, label: 'Убрать строку' }),
      );
    }

    function redrawRows() {
      const addRow = button('＋ Ещё строка', () => {
        rows.push({ name: '', emoji: '', portions: 0 });
        redrawRows();
      });
      addRow.classList.add('small');

      rowsBox.replaceChildren(
        ...rows.map(rowNode),
        h('div', { style: { marginTop: '10px' } }, addRow),
      );
    }

    redrawRows();

    const saveButton = button('Сохранить', () => {
      const date = dateField.input.value;
      if (!date) {
        ctx.toast('Укажите дату фасовки', { error: true });
        return;
      }
      // одинаковая продукция в нескольких строках складывается
      const merged = new Map();
      for (const row of rows) {
        const name = row.name.trim();
        if (!name || row.portions <= 0) continue;
        const entry = merged.get(name.toLowerCase()) || { name, emoji: row.emoji, portions: 0 };
        entry.portions += row.portions;
        if (row.emoji) entry.emoji = row.emoji;
        merged.set(name.toLowerCase(), entry);
      }
      const entries = [...merged.values()];
      if (entries.length === 0) {
        ctx.toast('Выберите продукцию и укажите порции', { error: true });
        return;
      }
      ctx.update((s) => {
        if (existing) {
          const target = s.packings.find((p) => p.id === existing.id);
          if (target) Object.assign(target, { date, entries });
        } else {
          s.packings.push({ id: newId(), date, entries, createdAt: Date.now() });
        }
      });
      close();
    }, { primary: true });

    const actions = h('div', { class: 'btn-row' }, saveButton);

    if (existing) {
      actions.appendChild(button('Удалить', async () => {
        const ok = await confirmDialog({
          title: 'Удалить фасовку?',
          message: `${isoToUi(existing.date)} · ${countOf(
            existing.entries.reduce((s, e) => s + e.portions, 0), 'порция', 'порции', 'порций')}. Действие нельзя отменить.`,
          confirmText: 'Удалить',
        });
        if (!ok) return;
        ctx.update((s) => { s.packings = s.packings.filter((p) => p.id !== existing.id); });
        close();
      }, { danger: true }));
    }

    return [
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Дата' }), dateField, dateChips),
      h('div', { class: 'block' },
        h('div', { class: 'row' },
          h('p', { class: 'label grow', text: 'Продукция и порции' }),
          iconButton('＋', () => openNewProductSheet(ctx, (product) => {
            const empty = rows.find((r) => !r.name);
            const row = empty || { name: '', emoji: '', portions: 0 };
            row.name = productShortName(product);
            row.emoji = product.emoji;
            if (!empty) rows.push(row);
            redrawRows();
          }), { accent: true, small: true, label: 'Добавить продукцию' }),
        ),
        rowsBox,
      ),
      actions,
    ];
  });
}

/** Плюсик в форме: новая продукция уходит прямо в раздел «Рецептура». */
function openNewProductSheet(ctx, onAdded) {
  let emoji = '';

  openSheet('Новая продукция', (close) => {
    const nameField = field({ value: '', placeholder: 'Борщ' });

    const emojiChips = h('div', { class: 'chips' },
      EMOJIS.map((candidate) => {
        const node = chip(candidate, {
          onclick: () => {
            // повторный тап по выбранному — убрать эмодзи
            emoji = emoji === candidate ? '' : candidate;
            for (const other of emojiChips.children) other.className = 'chip';
            if (emoji) node.className = 'chip on';
          },
        });
        return node;
      }),
    );

    return [
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Название продукции' }), nameField),
      h('div', { class: 'block' },
        h('p', { class: 'label', text: 'Эмодзи для поста' }),
        emojiChips,
      ),
      button('Добавить', () => {
        const name = nameField.input.value.trim();
        if (!name) return;
        const product = { id: newId(), name, emoji: emoji || '🥣', note: '', ingredients: [] };
        ctx.update((s) => { s.products.push(structuredClone(product)); });
        onAdded(product);
        close();
      }, { primary: true, wide: true }),
    ];
  });
}
