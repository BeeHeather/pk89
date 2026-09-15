// Финансовая отчётность: реестр, сводка по месяцам, срез по жертвователям.
// Итоги записаны формулами, поэтому выгрузка остаётся живым документом.

import { S, Workbook, ref } from './xlsx.js';
import { isoToEpochDay, isoToUi, isoMonthKey, monthTitle, todayIso } from './format.js';

export const ORGANIZATION = 'Полевая кухня 89';

export function reportFileName(iso = todayIso()) {
  return `Пожертвования_${iso}.xlsx`;
}

export function buildReport(donations, currency) {
  const rows = donations
    .map((d) => ({ donation: d, day: isoToEpochDay(d.date) }))
    .sort((a, b) => {
      const ad = a.day ?? Number.MAX_SAFE_INTEGER;
      const bd = b.day ?? Number.MAX_SAFE_INTEGER;
      if (ad !== bd) return ad - bd;
      return (a.donation.createdAt || 0) - (b.donation.createdAt || 0);
    });

  const wb = new Workbook();
  buildRegistry(wb, rows, currency);
  buildMonthly(wb, rows, currency);
  buildDonors(wb, rows, currency);
  return wb.toBlob();
}

// ---------- лист 1: реестр ----------

function buildRegistry(wb, rows, currency) {
  const sheet = wb.sheet('Реестр пожертвований');
  sheet.landscape = true;
  sheet.fitToWidth = true;

  const lastCol = 5;
  [6, 13, 34, 44, 18, 26].forEach((w, i) => sheet.width(i, w));

  const dated = rows.filter((r) => r.day != null);
  const period = dated.length
    ? `${isoToUi(dated[0].donation.date)} — ${isoToUi(dated[dated.length - 1].donation.date)}`
    : 'период не определён';

  sheet.text(0, 0, ORGANIZATION.toUpperCase(), S.TITLE);
  sheet.merge(0, 0, lastCol);

  sheet.text(1, 0, 'Отчёт о поступлении пожертвований', S.SUBTITLE);
  sheet.merge(1, 0, lastCol);

  sheet.text(2, 0, `Период: ${period}`, S.META);
  sheet.merge(2, 0, lastCol);

  sheet.text(3, 0, `Составлен: ${isoToUi(todayIso())}   ·   Валюта: ${currency}`, S.META);
  sheet.merge(3, 0, lastCol);

  const headerRow = 5;
  ['№', 'Дата', 'Жертвователь', 'Назначение / комментарий', `Сумма, ${currency}`, 'Нарастающим итогом']
    .forEach((h, i) => sheet.text(headerRow, i, h, S.HEADER));

  const first = headerRow + 1;
  let running = 0;

  rows.forEach((row, index) => {
    const r = first + index;
    running += row.donation.amount;

    sheet.number(r, 0, index + 1, S.INT_CENTER);
    if (row.day != null) sheet.date(r, 1, row.day);
    else sheet.text(r, 1, row.donation.date, S.TEXT);
    sheet.text(r, 2, row.donation.donor.trim() || 'Без имени', S.TEXT);
    sheet.text(r, 3, row.donation.note, S.TEXT);
    sheet.number(r, 4, row.donation.amount, S.MONEY);

    const cumulative = index === 0 ? ref(r, 4) : `${ref(r - 1, 5)}+${ref(r, 4)}`;
    sheet.formula(r, 5, cumulative, running, S.MONEY);
  });

  const total = rows.reduce((s, r) => s + r.donation.amount, 0);
  const totalRow = rows.length === 0 ? first : first + rows.length;

  sheet.blankRange(totalRow, 0, lastCol, S.TOTAL_LABEL);
  sheet.text(totalRow, 0, 'ИТОГО ЗА ПЕРИОД', S.TOTAL_LABEL);
  sheet.merge(totalRow, 0, 3);

  if (rows.length === 0) {
    sheet.number(totalRow, 4, 0, S.TOTAL_MONEY);
    sheet.number(totalRow, 5, 0, S.TOTAL_MONEY);
  } else {
    sheet.formula(totalRow, 4, `SUM(${ref(first, 4)}:${ref(first + rows.length - 1, 4)})`, total, S.TOTAL_MONEY);
    sheet.formula(totalRow, 5, ref(first + rows.length - 1, 5), total, S.TOTAL_MONEY);
  }

  let r = totalRow + 2;
  const count = rows.length;
  const average = count === 0 ? 0 : total / count;
  const largest = count === 0 ? 0 : Math.max(...rows.map((x) => x.donation.amount));

  sheet.text(r, 2, 'Количество поступлений', S.STAT_LABEL);
  sheet.number(r, 4, count, S.STAT_INT);
  r++;
  sheet.text(r, 2, 'Средний размер пожертвования', S.STAT_LABEL);
  if (count === 0) sheet.number(r, 4, 0, S.STAT_MONEY);
  else sheet.formula(r, 4, `${ref(totalRow, 4)}/${count}`, average, S.STAT_MONEY);
  r++;
  sheet.text(r, 2, 'Наибольшее пожертвование', S.STAT_LABEL);
  if (count === 0) sheet.number(r, 4, 0, S.STAT_MONEY);
  else sheet.formula(r, 4, `MAX(${ref(first, 4)}:${ref(first + rows.length - 1, 4)})`, largest, S.STAT_MONEY);

  r += 3;
  sheet.text(r, 0, 'Ответственный за приём пожертвований', S.SIGNATURE);
  sheet.text(r, 4, '___________________ / _________________', S.SIGNATURE);
  r++;
  sheet.text(r, 4, 'подпись, расшифровка', S.SIGNATURE);

  sheet.freezeRows = headerRow + 1;
  sheet.repeatHeaderRow = headerRow + 1;
}

// ---------- лист 2: по месяцам ----------

function buildMonthly(wb, rows, currency) {
  const sheet = wb.sheet('Сводка по месяцам');
  [22, 16, 20, 14].forEach((w, i) => sheet.width(i, w));

  sheet.text(0, 0, 'Поступления по месяцам', S.SUBTITLE);
  sheet.merge(0, 0, 3);

  const headerRow = 2;
  ['Месяц', 'Количество', `Сумма, ${currency}`, 'Доля']
    .forEach((h, i) => sheet.text(headerRow, i, h, S.HEADER));

  const groups = new Map();
  for (const row of rows) {
    const key = isoMonthKey(row.donation.date);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const keys = [...groups.keys()].sort();

  const total = rows.reduce((s, r) => s + r.donation.amount, 0);
  const first = headerRow + 1;

  keys.forEach((key, index) => {
    const r = first + index;
    const group = groups.get(key);
    const sum = group.reduce((s, x) => s + x.donation.amount, 0);
    sheet.text(r, 0, monthTitle(key), S.TEXT);
    sheet.number(r, 1, group.length, S.INT_CENTER);
    sheet.number(r, 2, sum, S.MONEY);
    sheet.number(r, 3, total === 0 ? 0 : sum / total, S.PERCENT);
  });

  const totalRow = first + keys.length;
  sheet.blankRange(totalRow, 0, 3, S.TOTAL_LABEL);
  sheet.text(totalRow, 0, 'ИТОГО', S.TOTAL_LABEL);

  if (keys.length === 0) {
    sheet.number(totalRow, 1, 0, S.TOTAL_INT);
    sheet.number(totalRow, 2, 0, S.TOTAL_MONEY);
    sheet.number(totalRow, 3, 0, S.TOTAL_PERCENT);
  } else {
    const datedCount = rows.filter((r) => r.day != null).length;
    const datedSum = keys.reduce((s, k) => s + groups.get(k).reduce((a, x) => a + x.donation.amount, 0), 0);
    sheet.formula(totalRow, 1, `SUM(${ref(first, 1)}:${ref(totalRow - 1, 1)})`, datedCount, S.TOTAL_INT);
    sheet.formula(totalRow, 2, `SUM(${ref(first, 2)}:${ref(totalRow - 1, 2)})`, datedSum, S.TOTAL_MONEY);
    sheet.formula(totalRow, 3, `SUM(${ref(first, 3)}:${ref(totalRow - 1, 3)})`, total === 0 ? 0 : datedSum / total, S.TOTAL_PERCENT);
  }

  sheet.freezeRows = headerRow + 1;
}

// ---------- лист 3: по жертвователям ----------

function buildDonors(wb, rows, currency) {
  const sheet = wb.sheet('По жертвователям');
  [34, 14, 20, 20, 20].forEach((w, i) => sheet.width(i, w));

  sheet.text(0, 0, 'Поступления по жертвователям', S.SUBTITLE);
  sheet.merge(0, 0, 4);

  const headerRow = 2;
  ['Жертвователь', 'Записей', `Сумма, ${currency}`, 'Первое поступление', 'Последнее поступление']
    .forEach((h, i) => sheet.text(headerRow, i, h, S.HEADER));

  const groups = new Map();
  for (const row of rows) {
    const key = row.donation.donor.trim() || 'Без имени';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const ordered = [...groups.entries()].sort((a, b) => {
    const sa = a[1].reduce((s, x) => s + x.donation.amount, 0);
    const sb = b[1].reduce((s, x) => s + x.donation.amount, 0);
    return sb - sa;
  });

  const first = headerRow + 1;
  ordered.forEach(([name, group], index) => {
    const r = first + index;
    const days = group.map((x) => x.day).filter((d) => d != null);
    sheet.text(r, 0, name, S.TEXT);
    sheet.number(r, 1, group.length, S.INT_CENTER);
    sheet.number(r, 2, group.reduce((s, x) => s + x.donation.amount, 0), S.MONEY);
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
    sheet.number(totalRow, 2, 0, S.TOTAL_MONEY);
  } else {
    sheet.formula(totalRow, 1, `SUM(${ref(first, 1)}:${ref(totalRow - 1, 1)})`, rows.length, S.TOTAL_INT);
    sheet.formula(
      totalRow, 2,
      `SUM(${ref(first, 2)}:${ref(totalRow - 1, 2)})`,
      rows.reduce((s, r) => s + r.donation.amount, 0),
      S.TOTAL_MONEY,
    );
  }

  sheet.freezeRows = headerRow + 1;
}
