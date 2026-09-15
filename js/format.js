// Форматирование под русский цех: запятая в дробях, склонения, даты дд.мм.гггг.

export const CURRENCIES = ['₸', '₽', '$', '€', 'сом', '₴'];

/** 12.5 -> "12,5"; 12.0 -> "12"; 0.333 -> "0,33". Без хвостовых нулей. */
export function pretty(value, maxDecimals = 2) {
  if (!Number.isFinite(value)) return '—';
  const fixed = value.toFixed(maxDecimals);
  let plain = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  if (plain === '-0') plain = '0';
  return plain.replace('.', ',');
}

/** Граммы; от килограмма — в килограммах. */
export function gramsPretty(value) {
  return Math.abs(value) >= 1000
    ? `${pretty(value / 1000, 2)} кг`
    : `${pretty(value, 1)} г`;
}

export function money(value, currency) {
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
  return `${formatted} ${currency}`;
}

/** Принимает и "12,5", и "12.5", и "1 200" (с обычным и неразрывным пробелом). */
export function parseNumber(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
  if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const DATE_PATTERNS = [
  /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/, // 31.12.2026
  /^(\d{4})-(\d{1,2})-(\d{1,2})$/,         // 2026-12-31 (порядок обратный)
];

/** Возвращает ISO-строку yyyy-mm-dd либо null. */
export function parseUiDate(text) {
  const t = (text || '').trim();
  if (!t) return null;

  let y, m, d;
  const dotted = t.match(DATE_PATTERNS[0]);
  const iso = t.match(DATE_PATTERNS[1]);
  if (dotted) {
    [, d, m, y] = dotted;
  } else if (iso) {
    [, y, m, d] = iso;
  } else {
    return null;
  }

  y = Number(y); m = Number(m); d = Number(d);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  // проверяем, что дата существует: 31.02 не должно проскочить
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return toIso(y, m, d);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function toIso(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function todayIso() {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function daysAgoIso(days) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** "2026-12-31" -> "31.12.2026". Непонятную строку возвращает как есть. */
export function isoToUi(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || '');
}

/** Дни от эпохи — для сортировки и расчёта серийной даты Excel. */
export function isoToEpochDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
}

export function isoMonthKey(iso) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso || '');
  return m ? `${m[1]}-${m[2]}` : null;
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** "2026-01" -> "Январь 2026" */
export function monthTitle(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(key || '');
  return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : (key || '');
}

export function formatDateTime(millis) {
  const d = new Date(millis);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** plural(3, "порция", "порции", "порций") -> "порции" */
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a >= 11 && a <= 19) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

export function countOf(n, one, few, many) {
  return `${n} ${plural(n, one, few, many)}`;
}
