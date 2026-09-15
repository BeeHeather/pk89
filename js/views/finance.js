import {
  button, card, chip, confirmDialog, downloadBlob, emptyState, field, h, header,
  iconButton, openSheet, shareOrDownload, tile, toast,
} from '../ui.js';
import {
  CURRENCIES, countOf, isoToUi, isoMonthKey, money, parseNumber, parseUiDate, todayIso, daysAgoIso,
} from '../format.js';
import { newId } from '../model.js';
import { buildReport, reportFileName } from '../report.js';
import { exportJson, importJson } from '../store.js';

export function renderFinance(ctx) {
  const { state } = ctx;
  const currency = state.currency;

  const sorted = [...state.donations].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const total = state.donations.reduce((sum, d) => sum + d.amount, 0);
  const monthKey = isoMonthKey(todayIso());
  const thisMonth = state.donations
    .filter((d) => isoMonthKey(d.date) === monthKey)
    .reduce((sum, d) => sum + d.amount, 0);
  const donors = new Set(
    state.donations.map((d) => d.donor.trim().toLowerCase()).filter(Boolean),
  ).size;

  const scroll = h('div', { class: 'scroll' });

  scroll.appendChild(tile('Всего собрано', money(total, currency), 'mint'));
  scroll.appendChild(h('div', { class: 'tiles', style: { marginBottom: '10px' } },
    tile('За текущий месяц', money(thisMonth, currency), 'sky'),
    tile('Жертвователей', String(donors), 'lilac'),
  ));

  const exportButton = button('Выгрузить отчёт в Excel', async () => {
    if (state.donations.length === 0) return;
    exportButton.disabled = true;
    exportButton.textContent = 'Собираю отчёт…';
    try {
      const blob = buildReport(state.donations, currency);
      const result = await shareOrDownload(blob, reportFileName(), 'Отчёт о пожертвованиях');
      if (result === 'downloaded') toast('Отчёт сохранён в загрузки');
    } catch (error) {
      console.error(error);
      toast(`Не удалось собрать отчёт: ${error?.message || error}`, { error: true });
    } finally {
      exportButton.disabled = state.donations.length === 0;
      exportButton.textContent = 'Выгрузить отчёт в Excel';
    }
  }, { primary: true, wide: true, disabled: state.donations.length === 0 });

  scroll.appendChild(exportButton);
  scroll.appendChild(h('div', { style: { height: '10px' } }));

  if (sorted.length === 0) {
    scroll.appendChild(emptyState('🤝', 'Записей пока нет',
      'Добавьте первое пожертвование — кто, сколько и когда. Отчёт соберётся из этих записей.'));
  } else {
    scroll.appendChild(h('h2', { class: 'section', style: { margin: '18px 0 8px 4px' }, text: 'Журнал' }));
    for (const donation of sorted) {
      scroll.appendChild(donationCard(ctx, donation, currency));
    }
  }

  scroll.appendChild(backupCard(ctx));

  const fab = button('Добавить', () => openDonation(ctx, currency), { primary: true, icon: '＋' });
  fab.classList.add('fab');

  return h('div', { class: 'screen' },
    header({
      title: 'Финансы',
      subtitle: countOf(state.donations.length, 'запись', 'записи', 'записей'),
      actions: chip(`Валюта: ${currency}`, { onclick: () => openCurrency(ctx, currency) }),
    }),
    scroll,
    fab,
  );
}

function donationCard(ctx, donation, currency) {
  const subtitle = donation.note.trim()
    ? `${isoToUi(donation.date)} · ${donation.note}`
    : isoToUi(donation.date);

  return card({},
    h('div', { class: 'row' },
      h('div', { class: 'grow' },
        h('div', { class: 'strong ellipsis', text: donation.donor.trim() || 'Без имени' }),
        h('div', { class: 'hint', text: subtitle }),
      ),
      h('div', { class: 'strong', text: money(donation.amount, currency) }),
      iconButton('🗑', async () => {
        const ok = await confirmDialog({
          title: 'Удалить запись?',
          message: `${donation.donor.trim() || 'Без имени'} · ${money(donation.amount, currency)} · ${isoToUi(donation.date)}.`,
          confirmText: 'Удалить',
        });
        if (!ok) return;
        ctx.update((s) => { s.donations = s.donations.filter((d) => d.id !== donation.id); });
      }, { danger: true, small: true, label: 'Удалить запись' }),
    ),
  );
}

function openDonation(ctx, currency) {
  openSheet('Новое пожертвование', (close) => {
    const donorField = field({ placeholder: 'Иван Петрович' });
    const amountField = field({ placeholder: '5000', inputmode: 'decimal', suffix: currency });
    const dateField = field({ value: isoToUi(todayIso()), placeholder: 'дд.мм.гггг', inputmode: 'numeric' });
    const noteField = field({ placeholder: 'На закупку крупы', multiline: true, rows: 2 });

    const amountError = h('p', { class: 'hint danger', style: { display: 'none', marginTop: '5px' } },
      'Введите сумму больше нуля');
    const dateError = h('p', { class: 'hint danger', style: { display: 'none', marginTop: '5px' } },
      'Дата в формате 31.12.2026');

    return [
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'От кого' }), donorField),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Сумма' }), amountField, amountError),
      h('div', { class: 'block' },
        h('p', { class: 'label', text: 'Дата' }),
        dateField,
        dateError,
        h('div', { class: 'chips', style: { marginTop: '8px' } },
          chip('Сегодня', { onclick: () => { dateField.input.value = isoToUi(todayIso()); } }),
          chip('Вчера', { onclick: () => { dateField.input.value = isoToUi(daysAgoIso(1)); } }),
        ),
      ),
      h('div', { class: 'block' }, h('p', { class: 'label', text: 'Комментарий' }), noteField),
      button('Добавить запись', () => {
        const amount = parseNumber(amountField.input.value);
        const date = parseUiDate(dateField.input.value);

        amountError.style.display = (amount == null || amount <= 0) ? 'block' : 'none';
        dateError.style.display = date == null ? 'block' : 'none';
        if (amount == null || amount <= 0 || date == null) return;

        ctx.update((s) => {
          s.donations.push({
            id: newId(),
            donor: donorField.input.value.trim(),
            amount,
            date,
            note: noteField.input.value.trim(),
            createdAt: Date.now(),
          });
        });
        close();
      }, { primary: true, wide: true }),
    ];
  });
}

function openCurrency(ctx, current) {
  openSheet('Валюта', (close) => [
    h('p', { class: 'hint' }, 'Подставляется в суммы и в заголовок отчёта.'),
    h('div', { class: 'chips', style: { marginTop: '16px' } },
      CURRENCIES.map((c) => chip(c, {
        on: c === current,
        onclick: () => {
          ctx.update((s) => { s.currency = c; });
          close();
        },
      })),
    ),
  ]);
}

/**
 * Данные живут в браузере, поэтому резервная копия — не роскошь.
 * Формат тот же JSON, что у настольной версии: файл переносится между ними.
 */
function backupCard(ctx) {
  const picker = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });

  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;

    const ok = await confirmDialog({
      title: 'Заменить все данные?',
      message: 'Продукция, коробки и записи из файла полностью заменят текущие. Отменить это будет нельзя.',
      confirmText: 'Заменить',
    });
    if (!ok) return;

    try {
      const imported = await importJson(file);
      ctx.update((s) => {
        s.products = imported.products;
        s.boxes = imported.boxes;
        s.donations = imported.donations;
        s.currency = imported.currency;
      });
      toast('Данные загружены');
    } catch (error) {
      console.error(error);
      toast('Не удалось прочитать файл — похоже, это не копия приложения', { error: true });
    }
  });

  return card({ tint: 'lemon' },
    h('h2', { class: 'section', text: 'Резервная копия' }),
    h('p', { class: 'hint' },
      'Всё хранится на этом телефоне. Сохраните копию, если меняете устройство или чистите браузер.'),
    h('div', { class: 'btn-row', style: { marginTop: '14px' } },
      button('Сохранить копию', () => {
        downloadBlob(exportJson(ctx.state), `polevaya-kuhnya-89-${todayIso()}.json`);
        toast('Копия сохранена в загрузки');
      }),
      button('Загрузить копию', () => picker.click()),
    ),
    picker,
  );
}
