// Синхронизация заявок между телефонами через тот же Apps Script, что
// и почтовые копии. Телефон отправляет все свои заявки, скрипт сливает их
// с общей таблицей (по id, побеждает поздняя правка) и возвращает полный
// список — его подмешиваем к местным данным. Остальные разделы локальные.

import { BACKUP_URL } from './backup.js';
import { mergeRequests } from './model.js';

let inFlight = false;

export async function syncRequests(ctx) {
  if (inFlight) return;
  if (navigator.onLine === false) return; // офлайн — дольём при следующем запуске
  inFlight = true;

  try {
    const response = await fetch(`${BACKUP_URL}?data=requests`, {
      method: 'POST',
      body: JSON.stringify(ctx.state.requests),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const remote = await response.json();

    const merged = mergeRequests(ctx.state.requests, remote);
    if (snapshot(merged) !== snapshot(ctx.state.requests)) {
      ctx.update((s) => { s.requests = merged; });
    }
  } catch (error) {
    // нет сети или скрипт ещё не обновлён — работаем локально, не мешаем
    console.warn('Не удалось синхронизировать заявки', error);
  } finally {
    inFlight = false;
  }
}

function snapshot(requests) {
  return JSON.stringify([...requests].sort((a, b) => a.id.localeCompare(b.id)));
}
