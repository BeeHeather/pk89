// Хранилище: одна запись в IndexedDB со всем состоянием.
// Формат тот же JSON, что и в настольной версии, — файл переносится между ними.

import { normalize, seedState } from './model.js';

const DB_NAME = 'pk89';
const DB_VERSION = 1;
const STORE = 'state';
const KEY = 'app';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

async function readRaw() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeRaw(value) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(value, KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Просит браузер не вычищать данные при нехватке места.
 * Установленному с домашнего экрана приложению Chrome обычно разрешает без вопросов.
 */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // не поддерживается — не страшно, работаем как есть
  }
  return false;
}

export async function loadState() {
  try {
    const raw = await readRaw();
    if (raw == null) {
      const seeded = seedState();
      await writeRaw(seeded);
      return seeded;
    }
    return normalize(raw);
  } catch (error) {
    console.error('Не удалось прочитать хранилище', error);
    return seedState();
  }
}

let pending = null;
let timer = null;
let lastError = null;

/**
 * Запись с коалесценцией: частые нажатия кликера не превращаются
 * в сотню транзакций, на диск уходит последнее состояние.
 */
export function saveState(state) {
  pending = state;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const snapshot = pending;
    pending = null;
    if (snapshot) {
      writeRaw(snapshot).catch((error) => {
        lastError = error;
        console.error('Не удалось сохранить', error);
      });
    }
  }, 250);
}

/** Дописать немедленно — при уходе вкладки в фон. */
export function flushState() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const snapshot = pending;
  pending = null;
  if (snapshot) {
    return writeRaw(snapshot).catch((error) => {
      lastError = error;
      console.error('Не удалось сохранить', error);
    });
  }
  return Promise.resolve();
}

export function lastSaveError() {
  return lastError;
}

/** Резервная копия: тот же JSON, что лежит в хранилище. */
export function exportJson(state) {
  return new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
}

export async function importJson(file) {
  const text = await file.text();
  return normalize(JSON.parse(text));
}
