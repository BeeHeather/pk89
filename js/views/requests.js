import {
  button, card, chip, confirmDialog, emptyState, field, h, header,
  iconButton, openSheet, pill, shareOrDownload, stepper,
} from '../ui.js';
import {
  countOf, daysAgoIso, isoToUi, monthTitle, parseUiDate, plural, todayIso,
} from '../format.js';
import { newId } from '../model.js';
import { isSyncing } from '../sync.js';
import { buildRequestsReport, requestsReportFileName } from '../requestsReport.js';

export function renderRequests(ctx) {
  const { state } = ctx;

  // помеченные удалёнными живут в данных ради синка, но в списках их нет
  const visible = state.requests.filter((r) => !r.deleted);

  const pending = visible
    .filter((r) => !r.doneAt)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const done = visible
    .filter((r) => r.doneAt)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  const scroll = h('div', { class: 'scroll', style: { paddingTop: '14px' } });

  if (isSyncing()) {
    // идёт обмен с сервером: список спрятан, но создать заявку можно
    scroll.appendChild(h('div', { class: 'sync-loader' },
      h('div', { class: 'ring' }),
      h('p', { text: 'Обновление информации…' }),
    ));
  } else if (visible.length === 0) {
    scroll.appendChild(emptyState('📮', 'Заявок пока нет',
      'Создайте первую — дата, кому передать и сколько коробок нужно.'));
  } else {
    scroll.appendChild(h('div', {
      class: 'row',
      style: { justifyContent: 'flex-end', marginBottom: '10px' },
    }, statsButton(ctx)));

    if (pending.length > 0) {
      scroll.appendChild(h('div', { class: 'group-label', text: 'В ожидании' }));
      for (const request of pending) scroll.appendChild(requestCard(ctx, request));
    }
    if (done.length > 0) {
      scroll.appendChild(h('div', { class: 'group-label', text: 'Исполненные' }));
      for (const request of done) scroll.appendChild(requestCard(ctx, request));
    }
  }

  const fab = button('Создать заявку', () => openRequest(ctx, null), { primary: true, icon: '＋' });
  fab.classList.add('fab');

  return h('div', { class: 'screen' },
    header({
      title: 'Заявки',
      subtitle: pending.length === 0
        ? 'В ожидании ничего нет'
        : `${countOf(pending.length, 'заявка', 'заявки', 'заявок')} в ожидании`,
      actions: iconButton('📅', () => openCalendar(ctx), { label: 'Календарь заявок' }),
    }),
    scroll,
    fab,
  );
}

function requestCard(ctx, request) {
  const isDone = !!request.doneAt;

  const toggle = button(isDone ? 'Вернуть в ожидание' : 'Исполнена', (event) => {
    event.stopPropagation();
    ctx.update((s) => {
      const target = s.requests.find((r) => r.id === request.id);
      if (target) {
        target.doneAt = isDone ? null : Date.now();
        target.updatedAt = Date.now();
      }
    });
    ctx.syncRequests();
  }, { primary: !isDone });
  toggle.classList.add('small');

  const line = (label, value) => h('div', { style: { marginTop: '6px', fontSize: '15px' } },
    h('span', { class: 'hint', text: `${label}: ` }),
    h('span', { class: 'strong', text: value }),
  );

  return card({ onclick: () => openRequest(ctx, request) },
    h('div', { class: 'row' },
      h('div', { class: 'strong grow', style: { fontSize: '18px' }, text: isoToUi(request.date) }),
      isDone ? pill('Исполнена', 'done') : pill('В ожидании', 'closed'),
    ),
    h('div', { style: { marginTop: '6px' } },
      request.to.trim() && line('Кому', request.to.trim()),
      request.via.trim() && line('Через кого', request.via.trim()),
    ),
    h('div', { class: 'row', style: { alignItems: 'center', marginTop: '10px' } },
      h('div', { class: 'grow', style: { display: 'flex', alignItems: 'baseline', gap: '8px' } },
        h('span', { class: 'big-num', text: String(request.boxes) }),
        h('span', { class: 'hint', text: plural(request.boxes, 'коробка', 'коробки', 'коробок') }),
      ),
      toggle,
    ),
  );
}

// ---------- выгрузка статистики ----------

function statsButton(ctx) {
  const label = '📊 Статистика';
  const node = button(label, async () => {
    node.disabled = true;
    node.textContent = 'Собираю…';
    try {
      const blob = buildRequestsReport(ctx.state.requests.filter((r) => !r.deleted));
      const result = await shareOrDownload(blob, requestsReportFileName(), 'Статистика по заявкам');
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

// ---------- создание и правка ----------

/** Уникальные прошлые значения поля, свежие впереди, — для чипов-подсказок. */
function knownValues(requests, key) {
  const seen = new Set();
  const values = [];
  for (const r of [...requests].sort((a, b) => b.createdAt - a.createdAt)) {
    if (r.deleted) continue;
    const value = r[key].trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    values.push(value);
  }
  return values.slice(0, 8);
}

function openRequest(ctx, existing) {
  const draft = {
    to: existing?.to ?? '',
    via: existing?.via ?? '',
    boxes: existing?.boxes ?? 1,
  };

  openSheet(existing ? 'Заявка' : 'Новая заявка', (close) => {
    const dateField = field({
      value: isoToUi(existing?.date ?? todayIso()),
      placeholder: 'дд.мм.гггг',
      inputmode: 'numeric',
    });

    const dateChips = h('div', { class: 'chips', style: { marginTop: '8px' } },
      chip('Сегодня', { onclick: () => { dateField.input.value = isoToUi(todayIso()); } }),
      chip('Завтра', { onclick: () => { dateField.input.value = isoToUi(daysAgoIso(-1)); } }),
    );

    const toField = field({
      value: draft.to,
      oninput: () => {
        draft.to = toField.input.value;
        refreshSave();
      },
    });

    const viaField = field({
      value: draft.via,
      oninput: () => { draft.via = viaField.input.value; },
    });

    const suggest = (key, fieldNode) => {
      const values = knownValues(ctx.state.requests, key);
      if (values.length === 0) return null;
      return h('div', { class: 'chips', style: { marginTop: '8px' } },
        values.map((value) => chip(value, {
          onclick: () => {
            draft[key] = value;
            fieldNode.input.value = value;
            refreshSave();
          },
        })));
    };

    const boxesInput = stepper({
      value: draft.boxes,
      step: 1,
      suffix: 'шт.',
      min: 1,
      onchange: (value) => { draft.boxes = value; },
    });

    const saveButton = button('Сохранить', () => {
      const date = parseUiDate(dateField.input.value);
      if (!date) {
        ctx.toast('Не понимаю дату — нужен формат 31.12.2026', { error: true });
        return;
      }
      const payload = {
        date,
        to: draft.to.trim(),
        via: draft.via.trim(),
        boxes: Math.max(1, Math.round(draft.boxes) || 1),
        updatedAt: Date.now(),
      };
      ctx.update((s) => {
        if (existing) {
          const target = s.requests.find((r) => r.id === existing.id);
          if (target) Object.assign(target, payload);
        } else {
          s.requests.push({
            id: newId(), doneAt: null, deleted: false, createdAt: Date.now(), ...payload,
          });
        }
      });
      ctx.syncRequests();
      close();
    }, { primary: true });

    function refreshSave() {
      saveButton.disabled = !draft.to.trim();
    }
    refreshSave();

    const actions = h('div', { class: 'btn-row' }, saveButton);

    if (existing) {
      actions.appendChild(button('Удалить', async () => {
        const ok = await confirmDialog({
          title: 'Удалить заявку?',
          message: `${isoToUi(existing.date)} · ${existing.to || 'без получателя'} · ${countOf(existing.boxes, 'коробка', 'коробки', 'коробок')}. Действие нельзя отменить.`,
          confirmText: 'Удалить',
        });
        if (!ok) return;
        // мягкое удаление: пометка разойдётся по всем телефонам при синке
        ctx.update((s) => {
          const target = s.requests.find((r) => r.id === existing.id);
          if (target) {
            target.deleted = true;
            target.updatedAt = Date.now();
          }
        });
        ctx.syncRequests();
        close();
      }, { danger: true }));
    }

    return [
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Дата' }), dateField, dateChips),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Кому' }), toField,
        suggest('to', toField)),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Через кого' }), viaField,
        suggest('via', viaField)),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Сколько коробок' }), boxesInput),
      actions,
    ];
  });
}

// ---------- календарь ----------

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function openCalendar(ctx) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0—11

  openSheet('Календарь заявок', () => {
    const monthLabel = h('span', { class: 'month' });
    const grid = h('div', { class: 'cal-grid' });

    function shift(delta) {
      month += delta;
      if (month < 0) { month = 11; year -= 1; }
      if (month > 11) { month = 0; year += 1; }
      redraw();
    }

    function redraw() {
      monthLabel.textContent = monthTitle(`${year}-${pad2(month + 1)}`);

      // день -> статус: если хоть одна заявка ждёт, день серый; иначе зелёный
      const byDate = new Map();
      for (const r of ctx.state.requests) {
        if (r.deleted) continue;
        const prev = byDate.get(r.date);
        const status = r.doneAt ? 'done' : 'pending';
        byDate.set(r.date, prev === 'pending' ? 'pending' : status);
      }

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const offset = (new Date(year, month, 1).getDay() + 6) % 7; // неделя с понедельника
      const todayKey = todayIso();

      const cells = [];
      for (let i = 0; i < offset; i += 1) cells.push(h('div', {}));
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = `${year}-${pad2(month + 1)}-${pad2(day)}`;
        const classes = ['cal-day'];
        const status = byDate.get(key);
        if (status) classes.push(status);
        if (key === todayKey) classes.push('today');
        cells.push(h('div', { class: classes.join(' '), text: String(day) }));
      }
      grid.replaceChildren(...cells);
    }

    redraw();

    return [
      h('div', { class: 'cal-nav' },
        iconButton('←', () => shift(-1), { small: true, label: 'Предыдущий месяц' }),
        monthLabel,
        iconButton('→', () => shift(1), { small: true, label: 'Следующий месяц' }),
      ),
      h('div', { class: 'cal-head' }, WEEKDAYS.map((d) => h('span', { text: d }))),
      grid,
      h('div', { class: 'cal-legend' },
        h('span', {}, h('i', { class: 'dot pending' }), 'в ожидании'),
        h('span', {}, h('i', { class: 'dot done' }), 'исполненные'),
      ),
    ];
  });
}
