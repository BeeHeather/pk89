// Автокопия: раз в сутки при открытии приложение отправляет свои данные
// на зашитый адрес (веб-приложение Google Apps Script, которое пересылает
// их письмом). Чистый PWA без сервера сам по расписанию в фоне работать
// не может — поэтому отправка привязана к открытию.

export const BACKUP_URL = 'https://script.google.com/macros/s/AKfycbwNUmok3UM0NoStDf3FJowMPs2wzubxDYCL0IbFdtl1EwnfuDJ1kSZ8hoB5ML8Oc0O4AQ/exec';

const LAST_KEY = 'pk89-backup-sent';

// «раз в сутки» с запасом: приложение открывают в разное время
const MIN_INTERVAL = 20 * 60 * 60 * 1000;

/** Отправить копию состояния. Тело — тот же JSON, что и файл резервной копии. */
export function sendBackup(state) {
  // mode: 'no-cors' — Apps Script не отдаёт CORS-заголовки; ответ не читаем,
  // но письмо уходит. Content-Type не ставим, чтобы не было preflight.
  return fetch(BACKUP_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify(state, null, 2),
  });
}

/** Вызывается при старте приложения: шлёт копию, если за сутки ещё не слали. */
export function maybeSendDailyBackup(state) {
  let last = 0;
  try { last = Number(localStorage.getItem(LAST_KEY)) || 0; } catch { /* приватный режим */ }
  if (Date.now() - last < MIN_INTERVAL) return;

  sendBackup(state)
    .then(() => {
      try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* не страшно */ }
    })
    .catch((error) => console.warn('Автокопия не отправилась', error));
}
