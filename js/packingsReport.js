// Статистика по учёту фасовки: итоги за всё время, разбивка по годам, реестр.

import { S, Workbook, ref } from './xlsx.js';
import { isoToEpochDay, isoToUi, todayIso } from './format.js';
import { ORGANIZATION } from './report.js';

export function packingsReportFileName(iso = todayIso()) {
  return `Учёт_фасовки_${iso}.xlsx`;
}

/** «Борщ 🍝» — как в посте: имя, следом эмодзи. */
function label(name, emoji) {
  return emoji ? `${name} ${emoji}` : name;
}

export function buildPackingsReport(packings) {
  const sorted = [...packings].sort((a, b) =>
    a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  // имя -> { emoji, total, byYear: Map(год -> порций) } в порядке первого появления
  const products = new Map();
  const years = new Set();

  for (const rec of sorted) {
    const year = rec.date.slice(0, 4);
    years.add(year);
    for (const entry of rec.entries) {
      const key = entry.name.toLowerCase();
      const item = products.get(key) || { name: entry.name, emoji: '', total: 0, byYear: new Map() };
      item.total += entry.portions;
      item.byYear.set(year, (item.byYear.get(year) || 0) + entry.portions);
      if (entry.emoji) item.emoji = entry.emoji;
      products.set(key, item);
    }
  }

  const wb = new Workbook();
  buildTotals(wb, sorted, products);
  buildYears(wb, products, [...years].sort());
  buildRegistry(wb, sorted);
  return wb.toBlob();
}

// ---------- лист 1: за всё время ----------

function buildTotals(wb, sorted, products) {
  const sheet = wb.sheet('За всё время');
  [34, 14].forEach((w, i) => sheet.width(i, w));

  const period = sorted.length
    ? `${isoToUi(sorted[0].date)} — ${isoToUi(sorted[sorted.length - 1].date)}`
    : 'записей нет';

  sheet.text(0, 0, ORGANIZATION.toUpperCase(), S.TITLE);
  sheet.merge(0, 0, 1);
  sheet.text(1, 0, 'Учёт фасовки — итоги за всё время', S.SUBTITLE);
  sheet.merge(1, 0, 1);
  sheet.text(2, 0, `Период: ${period}   ·   Составлен: ${isoToUi(todayIso())}`, S.META);
  sheet.merge(2, 0, 1);

  const headerRow = 4;
  ['Продукция', 'Порций'].forEach((title, i) => sheet.text(headerRow, i, title, S.HEADER));

  const items = [...products.values()].sort((a, b) => b.total - a.total);
  const first = headerRow + 1;

  items.forEach((item, index) => {
    const r = first + index;
    sheet.text(r, 0, label(item.name, item.emoji), S.TEXT);
    sheet.number(r, 1, item.total, S.INT_CENTER);
  });

  const totalRow = items.length === 0 ? first : first + items.length;
  const total = items.reduce((s, item) => s + item.total, 0);

  sheet.blankRange(totalRow, 0, 1, S.TOTAL_LABEL);
  sheet.text(totalRow, 0, 'ИТОГО ПОРЦИЙ', S.TOTAL_LABEL);
  if (items.length === 0) {
    sheet.number(totalRow, 1, 0, S.TOTAL_INT);
  } else {
    sheet.formula(totalRow, 1,
      `SUM(${ref(first, 1)}:${ref(first + items.length - 1, 1)})`, total, S.TOTAL_INT);
  }

  let r = totalRow + 2;
  sheet.text(r, 0, 'Дней с фасовкой', S.STAT_LABEL);
  sheet.number(r, 1, new Set(sorted.map((rec) => rec.date)).size, S.STAT_INT);
  r++;
  sheet.text(r, 0, 'Видов продукции', S.STAT_LABEL);
  sheet.number(r, 1, items.length, S.STAT_INT);

  sheet.freezeRows = headerRow + 1;
}

// ---------- лист 2: по годам ----------

function buildYears(wb, products, years) {
  const sheet = wb.sheet('По годам');
  sheet.width(0, 34);
  years.forEach((_, i) => sheet.width(i + 1, 12));
  sheet.width(years.length + 1, 14);

  sheet.text(0, 0, 'Порции по годам', S.SUBTITLE);
  sheet.merge(0, 0, years.length + 1);

  const headerRow = 2;
  sheet.text(headerRow, 0, 'Продукция', S.HEADER);
  years.forEach((year, i) => sheet.text(headerRow, i + 1, year, S.HEADER));
  const totalCol = years.length + 1;
  sheet.text(headerRow, totalCol, 'Итого', S.HEADER);

  const items = [...products.values()].sort((a, b) => b.total - a.total);
  const first = headerRow + 1;

  items.forEach((item, index) => {
    const r = first + index;
    sheet.text(r, 0, label(item.name, item.emoji), S.TEXT);
    years.forEach((year, i) => {
      sheet.number(r, i + 1, item.byYear.get(year) || 0, S.INT_CENTER);
    });
    if (years.length === 0) {
      sheet.number(r, totalCol, item.total, S.INT_CENTER);
    } else {
      sheet.formula(r, totalCol,
        `SUM(${ref(r, 1)}:${ref(r, years.length)})`, item.total, S.INT_CENTER);
    }
  });

  const totalRow = items.length === 0 ? first : first + items.length;
  sheet.blankRange(totalRow, 0, totalCol, S.TOTAL_LABEL);
  sheet.text(totalRow, 0, 'ИТОГО', S.TOTAL_LABEL);

  for (let col = 1; col <= totalCol; col += 1) {
    const cached = items.reduce((s, item) => {
      if (col === totalCol) return s + item.total;
      return s + (item.byYear.get(years[col - 1]) || 0);
    }, 0);
    if (items.length === 0) {
      sheet.number(totalRow, col, 0, S.TOTAL_INT);
    } else {
      sheet.formula(totalRow, col,
        `SUM(${ref(first, col)}:${ref(first + items.length - 1, col)})`, cached, S.TOTAL_INT);
    }
  }

  sheet.freezeRows = headerRow + 1;
}

// ---------- лист 3: реестр ----------

function buildRegistry(wb, sorted) {
  const sheet = wb.sheet('Реестр');
  [6, 13, 34, 12].forEach((w, i) => sheet.width(i, w));

  sheet.text(0, 0, 'Журнал фасовок', S.SUBTITLE);
  sheet.merge(0, 0, 3);

  const headerRow = 2;
  ['№', 'Дата', 'Продукция', 'Порций'].forEach((title, i) => sheet.text(headerRow, i, title, S.HEADER));

  const first = headerRow + 1;
  let r = first;
  let index = 0;
  let total = 0;

  for (const rec of sorted) {
    const day = isoToEpochDay(rec.date);
    for (const entry of rec.entries) {
      index += 1;
      total += entry.portions;
      sheet.number(r, 0, index, S.INT_CENTER);
      if (day != null) sheet.date(r, 1, day);
      else sheet.text(r, 1, rec.date, S.TEXT);
      sheet.text(r, 2, label(entry.name, entry.emoji), S.TEXT);
      sheet.number(r, 3, entry.portions, S.INT_CENTER);
      r += 1;
    }
  }

  sheet.blankRange(r, 0, 3, S.TOTAL_LABEL);
  sheet.text(r, 0, 'ИТОГО', S.TOTAL_LABEL);
  sheet.merge(r, 0, 2);
  if (index === 0) {
    sheet.number(r, 3, 0, S.TOTAL_INT);
  } else {
    sheet.formula(r, 3, `SUM(${ref(first, 3)}:${ref(r - 1, 3)})`, total, S.TOTAL_INT);
  }

  sheet.freezeRows = headerRow + 1;
  sheet.repeatHeaderRow = headerRow + 1;
}
