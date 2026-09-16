// Синхронизация общих разделов между телефонами через тот же Apps Script,
// что и почтовые копии. Телефон отправляет свой список, скрипт сливает его
// с общей таблицей (по id, побеждает поздняя правка) и возвращает полный
// список — его подмешиваем к местным данным. Общие разделы: заявки и учёт.

import { BACKUP_URL } from './backup.js';
import { mergePackings, mergeRequests } from './model.js';

const inFlight = { requests: false, packings: false };

/** Идёт ли обмен по заявкам — для лоадера на вкладке «Заявки». */
export function isSyncing() {
  return inFlight.requests;
}

/** Идёт ли обмен по журналу фасовок — для лоадера на «Учёте». */
export function isSyncingPackings() {
  return inFlight.packings;
}

async function syncList(ctx, kind, merge) {
  if (inFlight[kind]) return;
  if (navigator.onLine === false) return; // офлайн — дольём при следующем запуске
  inFlight[kind] = true;
  ctx.render(); // показать лоадер

  try {
    const response = await fetch(`${BACKUP_URL}?data=${kind}`, {
      method: 'POST',
      body: JSON.stringify(ctx.state[kind]),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const remote = await response.json();

    const merged = merge(ctx.state[kind], remote);
    if (snapshot(merged) !== snapshot(ctx.state[kind])) {
      ctx.update((s) => { s[kind] = merged; });
    }
  } catch (error) {
    // нет сети или скрипт ещё не обновлён — работаем локально, не мешаем
    console.warn(`Не удалось синхронизировать ${kind}`, error);
  } finally {
    inFlight[kind] = false;
    ctx.render(); // убрать лоадер и показать свежий список
  }
}

export function syncRequests(ctx) {
  return syncList(ctx, 'requests', mergeRequests);
}

export function syncPackings(ctx) {
  return syncList(ctx, 'packings', mergePackings);
}

function snapshot(list) {
  return JSON.stringify([...list].sort((a, b) => a.id.localeCompare(b.id)));
}
