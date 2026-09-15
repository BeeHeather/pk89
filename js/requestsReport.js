// Статистика по заявкам: реестр, сводка по месяцам, срез по получателям.

import { S, Workbook, ref } from './xlsx.js';
import { isoToEpochDay, isoToUi, isoMonthKey, monthTitle, todayIso } from './format.js';
import { ORGANIZATION } from './report.js';

export function requestsReportFileName(iso = todayIso()) {
  return `Заявки_${iso}.xlsx`;
}

export function buildRequestsReport(requests) {
  const rows = requests
    .map((request) => ({ request, day: isoToEpochDay(request.date) }))
    .sort((a, b) => {
      const ad = a.day ?? Number.MAX_SAFE_INTEGER;
      const bd = b.day ?? Number.MAX_SAFE_INTEGER;
      if (ad !== bd) return ad - bd;
      return (a.request.createdAt || 0) - (b.request.createdAt || 0);
    });

  const wb = new Workbook();
  buildRegistry(wb, rows);
  buildMonthly(wb, rows);
  buildRecipients(wb, rows);
  return wb.toBlob();
}

function statusText(request) {
  return request.doneAt ? 'Исполнена' : 'В ожидании';
}

// ---------- лист 1: реестр ----------

function buildRegistry(wb, rows) {
  const sheet = wb.sheet('Реестр заявок');
  sheet.landscape = true;
  sheet.fitToWidth = true;

  const lastCol = 5;
  [6, 13, 34, 26, 12, 16].forEach((w, i) => sheet.width(i, w));

  const dated = rows.filter((r) => r.day != null);
  const period = dated.length
    ? `${isoToUi(dated[0].request.date)} — ${isoToUi(dated[dated.length - 1].request.date)}`
    : 'период не определён';

  sheet.text(0, 0, ORGANIZATION.toUpperCase(), S.TITLE);
  sheet.merge(0, 0, lastCol);

  sheet.text(1, 0, 'Статистика', S.SUBTITLE);
  sheet.merge(1, 0, lastCol);

  sheet.text(2, 0, `Период: ${period}`, S.META);
  sheet.merge(2, 0, lastCol);

  sheet.text(3, 0, `Составлен: ${isoToUi(todayIso())}`, S.META);
  sheet.merge(3, 0, lastCol);

  const headerRow = 5;
  ['№', 'Дата', 'Кому', 'Через кого', 'Коробок', 'Статус']
    .forEach((title, i) => sheet.text(headerRow, i, title, S.HEADER));

  const first = headerRow + 1;

  rows.forEach((row, index) => {
    const r = first + index;
    sheet.number(r, 0, index + 1, S.INT_CENTER);
    if (row.day != null) sheet.date(r, 1, row.day);
    else sheet.text(r, 1, row.request.date, S.TEXT);
    sheet.text(r, 2, row.request.to.trim() || 'Без получателя', S.TEXT);
    sheet.text(r, 3, row.request.via.trim() || '—', S.TEXT);
    sheet.number(r, 4, row.request.boxes, S.INT_CENTER);
    sheet.text(r, 5, statusText(row.request), S.TEXT);
  });

  const totalBoxes = rows.reduce((s, r) => s + r.request.boxes, 0);
  const totalRow = rows.length === 0 ? first : first + rows.length;

  sheet.blankRange(totalRow, 0, lastCol, S.TOTAL_LABEL);
  sheet.text(totalRow, 0, 'ИТОГО КОРОБОК', S.TOTAL_LABEL);
  sheet.merge(totalRow, 0, 3);

  if (rows.length === 0) {
    sheet.number(totalRow, 4, 0, S.TOTAL_INT);
  } else {
    sheet.formula(totalRow, 4,
      `SUM(${ref(first, 4)}:${ref(first + rows.length - 1, 4)})`, totalBoxes, S.TOTAL_INT);
  }

  const done = rows.filter((r) => r.request.doneAt);
  const pending = rows.filter((r) => !r.request.doneAt);

  let r = totalRow + 2;
  sheet.text(r, 2, 'Всего заявок', S.STAT_LABEL);
  sheet.number(r, 4, rows.length, S.STAT_INT);
  r++;
  sheet.text(r, 2, 'Исполнено', S.STAT_LABEL);
  sheet.number(r, 4, done.length, S.STAT_INT);
  r++;
  sheet.text(r, 2, 'В ожидании', S.STAT_LABEL);
  sheet.number(r, 4, pending.length, S.STAT_INT);
  r++;
  sheet.text(r, 2, 'Коробок исполнено', S.STAT_LABEL);
  sheet.number(r, 4, done.reduce((s, x) => s + x.request.boxes, 0), S.STAT_INT);
  r++;
  sheet.text(r, 2, 'Коробок в ожидании', S.STAT_LABEL);
  sheet.number(r, 4, pending.reduce((s, x) => s + x.request.boxes, 0), S.STAT_INT);

  sheet.freezeRows = headerRow + 1;
  sheet.repeatHeaderRow = headerRow + 1;
}

// ---------- лист 2: по месяцам ----------

function buildMonthly(wb, rows) {
  const sheet = wb.sheet('Сводка по месяцам');
  [22, 12, 12, 14, 14].forEach((w, i) => sheet.width(i, w));

  sheet.text(0, 0, 'Заявки по месяцам', S.SUBTITLE);
  sheet.merge(0, 0, 4);

  const headerRow = 2;
  ['Месяц', 'Заявок', 'Коробок', 'Исполнено', 'В ожидании']
    .forEach((title, i) => sheet.text(headerRow, i, title, S.HEADER));

  const groups = new Map();
  for (const row of rows) {
    const key = isoMonthKey(row.request.date);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const keys = [...groups.keys()].sort();
  const first = headerRow + 1;

  keys.forEach((key, index) => {
    const r = first + index;
    const group = groups.get(key);
    sheet.text(r, 0, monthTitle(key), S.TEXT);
    sheet.number(r, 1, group.length, S.INT_CENTER);
    sheet.number(r, 2, group.reduce((s, x) => s + x.request.boxes, 0), S.INT_CENTER);
    sheet.number(r, 3, group.filter((x) => x.request.doneAt).length, S.INT_CENTER);
    sheet.number(r, 4, group.filter((x) => !x.request.doneAt).length, S.INT_CENTER);
  });

  const totalRow = first + keys.length;
  sheet.blankRange(totalRow, 0, 4, S.TOTAL_LABEL);
  sheet.text(totalRow, 0, 'ИТОГО', S.TOTAL_LABEL);

  const all = keys.flatMap((key) => groups.get(key));
  const totals = [
    all.length,
    all.reduce((s, x) => s + x.request.boxes, 0),
    all.filter((x) => x.request.doneAt).length,
    all.filter((x) => !x.request.doneAt).length,
  ];
  totals.forEach((value, i) => {
    const col = i + 1;
    if (keys.length === 0) {
      sheet.number(totalRow, col, 0, S.TOTAL_INT);
    } else {
      sheet.formula(totalRow, col,
        `SUM(${ref(first, col)}:${ref(first + keys.length - 1, col)})`, value, S.TOTAL_INT);
    }
  });

  sheet.freezeRows = headerRow + 1;
}

// ---------- лист 3: по получателям ----------

function buildRecipients(wb, rows) {
  const sheet = wb.sheet('По получателям');
  [34, 12, 12, 20, 20].forEach((w, i) => sheet.width(i, w));

  sheet.text(0, 0, 'Заявки по получателям', S.SUBTITLE);
  sheet.merge(0, 0, 4);

  const headerRow = 2;
  ['Кому', 'Заявок', 'Коробок', 'Первая заявка', 'Последняя заявка']
    .forEach((title, i) => sheet.text(headerRow, i, title, S.HEADER));

  const groups = new Map();
  for (const row of rows) {
    const key = row.request.to.trim() || 'Без получателя';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const ordered = [...groups.entries()].sort((a, b) => {
    const sa = a[1].reduce((s, x) => s + x.request.boxes, 0);
    const sb = b[1].reduce((s, x) => s + x.request.boxes, 0);
    return sb - sa;
  });

  const first = headerRow + 1;
  ordered.forEach(([name, group], index) => {
    const r = first + index;
    const days = group.map((x) => x.day).filter((d) => d != null);
    sheet.text(r, 0, name, S.TEXT);
    sheet.number(r, 1, group.length, S.INT_CENTER);
    sheet.number(r, 2, group.reduce((s, x) => s + x.request.boxes, 0), S.INT_CENTER);
    if (days.length === 0) {
      sheet.text(r, 3, '—', S.TEXT);
      sheet.text(r, 4, '—', S.TEXT);
    } else {
      sheet.date(r, 3, Math.min(...days));
      sheet.date(r, 4, Math.max(...days));
    }
  });

  const totalRow = first + ordered.length;
  sheet.blankRange(totalRow, 0, 4, S.TOTAL_LABEL);
  sheet.text(totalRow, 0, 'ИТОГО', S.TOTAL_LABEL);

  if (ordered.length === 0) {
    sheet.number(totalRow, 1, 0, S.TOTAL_INT);
    sheet.number(totalRow, 2, 0, S.TOTAL_INT);
  } else {
    sheet.formula(totalRow, 1, `SUM(${ref(first, 1)}:${ref(totalRow - 1, 1)})`, rows.length, S.TOTAL_INT);
    sheet.formula(totalRow, 2, `SUM(${ref(first, 2)}:${ref(totalRow - 1, 2)})`,
      rows.reduce((s, x) => s + x.request.boxes, 0), S.TOTAL_INT);
  }

  sheet.freezeRows = headerRow + 1;
}
