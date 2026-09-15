// Формат данных тот же, что в настольной и Android-версиях, — JSON переносится между ними без правок.

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ingredientGrams(ingredient) {
  return (ingredient.teaspoons || 0) * (ingredient.gramsPerTeaspoon || 0);
}

export function portionGrams(product) {
  return (product.ingredients || []).reduce((sum, i) => sum + ingredientGrams(i), 0);
}

export function portionTeaspoons(product) {
  return (product.ingredients || []).reduce((sum, i) => sum + (i.teaspoons || 0), 0);
}

export function productTitle(product) {
  return [product.category, product.kind].filter((s) => s && s.trim()).join(' ');
}

/** Короткое имя для карточки: вид, а если его нет — категория. */
export function productShortName(product) {
  return (product.kind || '').trim() || (product.category || '').trim() || 'Без названия';
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

// ---------- склад ингредиентов ----------

/** Ключ ингредиента на складе: одно и то же имя в разных продуктах — одна позиция. */
export function stockKey(name) {
  return String(name || '').trim().toLowerCase();
}

const STOCK_HISTORY_LIMIT = 100;

/**
 * Изменить остаток и записать это в историю позиции.
 * Положительная delta — приход, отрицательная — расход. Остаток может уйти
 * в минус: это сигнал, что склад не оприходован, а не повод терять расход.
 */
export function applyStockChange(state, name, delta, note) {
  const key = stockKey(name);
  if (!key || !delta) return;

  let entry = state.stock.find((s) => stockKey(s.name) === key);
  if (!entry) {
    entry = { id: newId(), name: String(name).trim(), grams: 0, history: [] };
    state.stock.push(entry);
  }

  entry.grams = Math.round((entry.grams + delta) * 100) / 100;
  entry.history.push({ at: Date.now(), delta, after: entry.grams, note: String(note || '') });
  if (entry.history.length > STOCK_HISTORY_LIMIT) {
    entry.history.splice(0, entry.history.length - STOCK_HISTORY_LIMIT);
  }
}

/** Списать со склада всё, что уходит на новую коробку. */
export function consumeStockForBox(state, product, box) {
  for (const ingredient of product.ingredients || []) {
    const grams = ingredientGrams(ingredient) * box.targetPortions;
    if (grams > 0) {
      applyStockChange(state, ingredient.name, -grams,
        `Фасовка: ${box.label || 'коробка'} (${box.targetPortions} порц.)`);
    }
  }
}

export function emptyState() {
  return { products: [], boxes: [], donations: [], stock: [], currency: '₸' };
}

/** Приводит прочитанные данные к ожидаемой форме: чужой или старый файл не должен ронять приложение. */
export function normalize(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;

  const products = Array.isArray(raw.products) ? raw.products.map((p) => ({
    id: p.id || newId(),
    category: String(p.category ?? ''),
    kind: String(p.kind ?? ''),
    emoji: String(p.emoji ?? '🥣'),
    note: String(p.note ?? ''),
    ingredients: Array.isArray(p.ingredients) ? p.ingredients.map((i) => ({
      id: i.id || newId(),
      name: String(i.name ?? ''),
      teaspoons: Number(i.teaspoons) || 0,
      gramsPerTeaspoon: Number(i.gramsPerTeaspoon) || 0,
    })) : [],
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
      grams: Number(s.grams) || 0,
      history: Array.isArray(s.history) ? s.history.map((e) => ({
        at: Number(e.at) || Date.now(),
        delta: Number(e.delta) || 0,
        after: Number(e.after) || 0,
        note: String(e.note ?? ''),
      })) : [],
    }))
    .filter((s) => s.name) : [];

  return {
    products,
    boxes,
    donations,
    stock,
    currency: typeof raw.currency === 'string' && raw.currency ? raw.currency : '₸',
  };
}

/** Примерные карточки, чтобы приложение не открывалось пустым. */
export function seedState() {
  const now = Date.now();
  const ing = (name, teaspoons, gramsPerTeaspoon) => ({ id: newId(), name, teaspoons, gramsPerTeaspoon });

  return {
    products: [
      {
        id: newId(),
        category: 'Кисель',
        kind: 'Смородиновый',
        emoji: '🫐',
        note: 'Залить 200 мл горячей воды, размешать, дать постоять 2 минуты.',
        ingredients: [
          ing('Крахмал картофельный', 2, 6),
          ing('Сахар', 3, 5),
          ing('Ягодный порошок (смородина)', 1, 3),
          ing('Лимонная кислота', 0.25, 5),
        ],
      },
      {
        id: newId(),
        category: 'Кисель',
        kind: 'Брусничный',
        emoji: '🍒',
        note: 'Залить 200 мл горячей воды, размешать, дать постоять 2 минуты.',
        ingredients: [
          ing('Крахмал картофельный', 2, 6),
          ing('Сахар', 3.5, 5),
          ing('Ягодный порошок (брусника)', 1, 3),
        ],
      },
      {
        id: newId(),
        category: 'Суп',
        kind: 'Гороховый',
        emoji: '🥣',
        note: 'Залить 250 мл кипятка, накрыть, через 5 минут перемешать.',
        ingredients: [
          ing('Мука гороховая', 4, 4),
          ing('Сушёные овощи', 1, 2),
          ing('Сушёный лук', 1, 2),
          ing('Бульонная основа', 1, 5),
          ing('Соль', 0.5, 7),
          ing('Сухая зелень', 0.5, 1),
          ing('Паприка', 0.25, 3),
          ing('Перец чёрный молотый', 0.25, 3),
        ],
      },
    ],
    boxes: [],
    donations: [],
    stock: [],
    currency: '₸',
    createdAt: now,
  };
}
