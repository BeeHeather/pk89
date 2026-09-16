// Формат данных тот же, что в настольной и Android-версиях, — JSON переносится между ними без правок.

import { gramsPretty, pretty } from './format.js';

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Единицы измерения ингредиента. Ложки в граммы не пересчитываются:
// каждый ингредиент живёт в своей единице — и в рецепте, и на складе.
export const UNITS = [
  { id: 'g', label: 'г' },
  { id: 'tsp', label: 'ч. л.' },
  { id: 'tbsp', label: 'ст. л.' },
];

export function unitInfo(id) {
  return UNITS.find((u) => u.id === id) || UNITS[0];
}

/** «600 г» / «1,5 кг» / «3 ч. л.» — количество в родной единице. */
export function amountText(amount, unit) {
  return (unit || 'g') === 'g'
    ? gramsPretty(amount)
    : `${pretty(amount, 2)} ${unitInfo(unit).label}`;
}

/**
 * Итог по рецепту в родных единицах: [{unit, amount}], только ненулевые.
 * Общего веса нет намеренно — граммы и ложки не складываются друг с другом.
 */
export function portionTotals(product, portions = 1) {
  return UNITS
    .map((u) => ({
      unit: u.id,
      amount: (product.ingredients || [])
        .filter((i) => (i.unit || 'g') === u.id)
        .reduce((sum, i) => sum + (i.amount || 0), 0) * portions,
    }))
    .filter((t) => t.amount > 0);
}

/** «42 г + 3 ч. л.» — итог рецепта одной строкой. */
export function totalsText(product, portions = 1) {
  const totals = portionTotals(product, portions);
  if (totals.length === 0) return '—';
  return totals.map((t) => amountText(t.amount, t.unit)).join(' + ');
}

/** Имя карточки продукции. Категорий нет — всё пишется прямо в названии. */
export function productShortName(product) {
  return (product.name || '').trim() || 'Без названия';
}

// Стартовое меню цеха. Версия растёт, когда набор меняется: недостающие
// позиции доливаются в существующие данные один раз, удалённые не возвращаются.
const SEED_VERSION = 3;

export const DEFAULT_PRODUCTS = [
  { name: 'Борщ', emoji: '🍝' },
  { name: 'Кисель', emoji: '🫐' },
];

// Что доливала версия 2 и что из этого больше не дефолт: при обновлении
// вычищаем, если карточку не трогали и на неё ничего не ссылается.
const RETIRED_DEFAULTS = [
  'Уха', 'Харчо', 'Лапша', 'Картошка с мясом', 'Молочная каша',
  'Гречка с мясом', 'Гор.кружка борщ', 'Гор.кружка гороховый', 'Гор.кружка вермишель',
];

function defaultProduct(item) {
  return { id: newId(), name: item.name, emoji: item.emoji, note: '', ingredients: [] };
}

export function boxIsClosed(box) {
  return box.closedAt != null;
}

export function boxIsFull(box) {
  return box.targetPortions > 0 && box.packedPortions >= box.targetPortions;
}

export function boxRemaining(box) {
  return Math.max(0, (box.targetPortions || 0) - (box.packedPortions || 0));
}

export function boxProgress(box) {
  if (!box.targetPortions || box.targetPortions <= 0) return 0;
  return Math.min(1, Math.max(0, box.packedPortions / box.targetPortions));
}

// ---------- склад ингредиентов (устаревшее) ----------
// Данные stock сохраняются при чтении/записи для совместимости со старыми
// резервными копиями, но интерфейса у них больше нет.

export function emptyState() {
  return {
    products: [], boxes: [], donations: [], stock: [], requests: [], packings: [],
    session: null, currency: '₸',
  };
}

/**
 * Заявка из хранилища или из синка. Возвращает null, если это не заявка.
 * deleted — мягкое удаление: пометка нужна, чтобы удаление разошлось
 * по всем телефонам и заявка не «воскресла» при следующем слиянии.
 */
function normalizeRequest(r) {
  if (!r || typeof r !== 'object') return null;
  const date = String(r.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const createdAt = Number(r.createdAt) || Date.now();
  return {
    id: r.id || newId(),
    date,
    to: String(r.to ?? ''),
    via: String(r.via ?? ''),
    boxes: Math.max(1, Number(r.boxes) || 1),
    doneAt: r.doneAt == null || r.doneAt === '' ? null : Number(r.doneAt),
    deleted: !!r.deleted,
    createdAt,
    updatedAt: Number(r.updatedAt) || createdAt,
  };
}

/** Слить местные заявки с пришедшими из синка: по id, побеждает поздняя правка. */
export function mergeRequests(local, remote) {
  const map = new Map(local.map((r) => [r.id, r]));
  for (const raw of Array.isArray(remote) ? remote : []) {
    const r = normalizeRequest(raw);
    if (!r) continue;
    const mine = map.get(r.id);
    if (!mine || r.updatedAt > (mine.updatedAt || 0)) map.set(r.id, r);
  }
  return [...map.values()];
}

/** Запись журнала фасовок из хранилища или из синка. Null — если это мусор. */
function normalizePacking(p) {
  if (!p || typeof p !== 'object') return null;
  const date = String(p.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const entries = Array.isArray(p.entries) ? p.entries
    .map((e) => ({
      name: String(e.name ?? '').trim(),
      emoji: String(e.emoji ?? '').trim(),
      portions: Math.max(0, Math.round(Number(e.portions) || 0)),
    }))
    .filter((e) => e.name && e.portions > 0) : [];
  if (entries.length === 0 && !p.deleted) return null;

  const createdAt = Number(p.createdAt) || Date.now();
  return {
    id: p.id || newId(),
    date,
    entries,
    deleted: !!p.deleted,
    createdAt,
    updatedAt: Number(p.updatedAt) || createdAt,
  };
}

/** Слить журнал фасовок с пришедшим из синка — так же, как заявки. */
export function mergePackings(local, remote) {
  const map = new Map(local.map((p) => [p.id, p]));
  for (const raw of Array.isArray(remote) ? remote : []) {
    const p = normalizePacking(raw);
    if (!p) continue;
    const mine = map.get(p.id);
    if (!mine || p.updatedAt > (mine.updatedAt || 0)) map.set(p.id, p);
  }
  return [...map.values()];
}

/**
 * Старый формат хранил ложки и вес ложки — переводим в граммы,
 * чтобы вес порции и склад не изменились после обновления.
 */
function normalizeIngredient(i) {
  const base = { id: i.id || newId(), name: String(i.name ?? '') };

  if (i.unit == null && (i.teaspoons != null || i.gramsPerTeaspoon != null)) {
    const grams = (Number(i.teaspoons) || 0) * (Number(i.gramsPerTeaspoon) || 0);
    return { ...base, amount: Math.round(grams * 100) / 100, unit: 'g' };
  }

  return {
    ...base,
    amount: Number(i.amount) || 0,
    unit: UNITS.some((u) => u.id === i.unit) ? i.unit : 'g',
  };
}

/** Приводит прочитанные данные к ожидаемой форме: чужой или старый файл не должен ронять приложение. */
export function normalize(raw) {  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;

  const products = Array.isArray(raw.products) ? raw.products.map((p) => ({
    id: p.id || newId(),
    // раньше имя складывалось из категории и вида — склеиваем их при чтении
    name: p.name != null
      ? String(p.name)
      : [p.category, p.kind].map((s) => String(s ?? '').trim()).filter(Boolean).join(' '),
    emoji: String(p.emoji ?? '🥣'),
    note: String(p.note ?? ''),
    ingredients: Array.isArray(p.ingredients) ? p.ingredients.map(normalizeIngredient) : [],
  })) : [];

  const productIds = new Set(products.map((p) => p.id));

  const boxes = Array.isArray(raw.boxes) ? raw.boxes
    .filter((b) => productIds.has(b.productId))
    .map((b) => ({
      id: b.id || newId(),
      productId: b.productId,
      label: String(b.label ?? ''),
      targetPortions: Math.max(1, Number(b.targetPortions) || 1),
      packedPortions: Math.max(0, Number(b.packedPortions) || 0),
      createdAt: Number(b.createdAt) || Date.now(),
      closedAt: b.closedAt == null ? null : Number(b.closedAt),
    })) : [];

  const donations = Array.isArray(raw.donations) ? raw.donations.map((d) => ({
    id: d.id || newId(),
    donor: String(d.donor ?? ''),
    amount: Number(d.amount) || 0,
    date: String(d.date ?? ''),
    note: String(d.note ?? ''),
    createdAt: Number(d.createdAt) || Date.now(),
  })) : [];

  const stock = Array.isArray(raw.stock) ? raw.stock
    .map((s) => ({
      id: s.id || newId(),
      name: String(s.name ?? '').trim(),
      // прежний склад хранил grams — это те же граммы, просто под старым именем
      amount: Number(s.amount ?? s.grams) || 0,
      unit: UNITS.some((u) => u.id === s.unit) ? s.unit : 'g',
      history: Array.isArray(s.history) ? s.history.map((e) => ({
        at: Number(e.at) || Date.now(),
        delta: Number(e.delta) || 0,
        after: Number(e.after) || 0,
        note: String(e.note ?? ''),
      })) : [],
    }))
    .filter((s) => s.name) : [];

  const requests = Array.isArray(raw.requests)
    ? raw.requests.map(normalizeRequest).filter(Boolean)
    : [];

  // журнал результатов фасовки: что и сколько порций нафасовали за день
  const packings = Array.isArray(raw.packings)
    ? raw.packings.map(normalizePacking).filter(Boolean)
    : [];

  // текущая сессия кликера на «Фасовке» — переживает закрытие приложения
  const rawSession = raw.session;
  const session = rawSession && typeof rawSession === 'object' && String(rawSession.name ?? '').trim()
    ? {
      name: String(rawSession.name).trim(),
      emoji: String(rawSession.emoji ?? '').trim(),
      count: Math.max(0, Math.round(Number(rawSession.count) || 0)),
      active: !!rawSession.active,
    }
    : null;

  const seedVersion = Number(raw.seedVersion) || 0;

  // версия 2 доливала большое меню — убираем из него то, что больше не дефолт,
  // если карточку не редактировали и на неё не ссылаются коробки или журнал
  let cleaned = products;
  if (seedVersion === 2) {
    const usedNames = new Set();
    for (const p of packings) for (const e of p.entries) usedNames.add(e.name.toLowerCase());
    const usedIds = new Set(boxes.map((b) => b.productId));
    const retired = new Set(RETIRED_DEFAULTS.map((n) => n.toLowerCase()));
    cleaned = products.filter((p) =>
      !(retired.has(p.name.trim().toLowerCase())
        && p.ingredients.length === 0
        && !p.note.trim()
        && !usedIds.has(p.id)
        && !usedNames.has(p.name.trim().toLowerCase())));
  }

  // доливаем недостающие дефолты тем, кто начал раньше их появления
  if (seedVersion < SEED_VERSION) {
    const names = new Set(cleaned.map((p) => p.name.trim().toLowerCase()));
    for (const item of DEFAULT_PRODUCTS) {
      if (!names.has(item.name.toLowerCase())) cleaned.push(defaultProduct(item));
    }
  }

  return {
    products: cleaned,
    boxes,
    donations,
    stock,
    requests,
    packings,
    session,
    currency: typeof raw.currency === 'string' && raw.currency ? raw.currency : '₸',
    seedVersion: SEED_VERSION,
  };
}

/** Стартовое состояние: меню цеха с пустыми рецептами. */
export function seedState() {
  return {
    products: DEFAULT_PRODUCTS.map(defaultProduct),
    boxes: [],
    donations: [],
    stock: [],
    requests: [],
    packings: [],
    session: null,
    currency: '₸',
    seedVersion: SEED_VERSION,
    createdAt: Date.now(),
  };
}
