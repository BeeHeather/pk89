// Серверная часть «Полевой кухни 89» — веб-приложение Google Apps Script.
// Обязанности: 1) резервная копия письмом (POST без параметров),
// 2) общие заявки (?data=requests), 3) общий журнал фасовок (?data=packings).
// Данные лежат в Google-таблице «Полевая кухня 89 — общие данные» (создаётся сама).
//
// После правок деплоить так: «Развернуть» → «Управление развёртываниями» →
// карандаш → «Версия: новая» → «Развернуть» — тогда URL не меняется.

const SHEETS = {
  requests: {
    name: 'requests',
    columns: ['id', 'date', 'to', 'via', 'boxes', 'doneAt', 'deleted', 'updatedAt', 'createdAt'],
    toRow: function (r) {
      return [String(r.id), "'" + String(r.date || ''), String(r.to || ''), String(r.via || ''),
        Number(r.boxes) || 1, r.doneAt == null ? '' : Number(r.doneAt),
        r.deleted ? 1 : '', Number(r.updatedAt) || 0, Number(r.createdAt) || 0];
    },
    fromRow: function (row) {
      return {
        id: String(row[0]),
        date: asIsoDate(row[1]),
        to: String(row[2] || ''),
        via: String(row[3] || ''),
        boxes: Number(row[4]) || 1,
        doneAt: row[5] === '' || row[5] == null ? null : Number(row[5]),
        deleted: !!row[6],
        updatedAt: Number(row[7]) || 0,
        createdAt: Number(row[8]) || 0,
      };
    },
  },
  packings: {
    name: 'packings',
    columns: ['id', 'date', 'entries', 'deleted', 'updatedAt', 'createdAt'],
    toRow: function (p) {
      return [String(p.id), "'" + String(p.date || ''), JSON.stringify(p.entries || []),
        p.deleted ? 1 : '', Number(p.updatedAt) || 0, Number(p.createdAt) || 0];
    },
    fromRow: function (row) {
      let entries = [];
      try { entries = JSON.parse(row[2] || '[]'); } catch (e) { /* битая строка — пропускаем */ }
      return {
        id: String(row[0]),
        date: asIsoDate(row[1]),
        entries: entries,
        deleted: !!row[3],
        updatedAt: Number(row[4]) || 0,
        createdAt: Number(row[5]) || 0,
      };
    },
  },
};

// GET — для проверки в браузере: /exec?data=requests или ?data=packings
function doGet(e) {
  const params = (e && e.parameter) || {};
  const config = SHEETS[params.data];
  if (config) {
    return ContentService.createTextOutput(JSON.stringify(readAll(config)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('ok');
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  if (!e || !e.postData) {
    // запуск кнопкой «Выполнить» в редакторе — сюда приходят только HTTP-запросы
    return ContentService.createTextOutput('нет данных — вызывается по URL');
  }

  const config = SHEETS[params.data];
  if (config) {
    mergeRows(config, JSON.parse(e.postData.contents));
    return ContentService.createTextOutput(JSON.stringify(readAll(config)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // без параметра — резервная копия письмом
  MailApp.sendEmail({
    to: 'ваша@почта.ру',
    subject: 'Полевая кухня 89 — копия ' + new Date().toLocaleString('ru-RU'),
    body: 'Автоматическая резервная копия. Файл во вложении — его можно загрузить через «Настройки → Загрузить из резервной копии».',
    attachments: [Utilities.newBlob(e.postData.contents, 'application/json', 'pk89-backup.json')],
  });
  return ContentService.createTextOutput('ok');
}

function spreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('sheetId');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create('Полевая кухня 89 — общие данные');
  props.setProperty('sheetId', ss.getId());
  return ss;
}

function sheetFor(config) {
  const ss = spreadsheet();
  let sh = ss.getSheetByName(config.name);
  if (!sh) {
    sh = ss.insertSheet(config.name);
    sh.appendRow(config.columns);
  }
  return sh;
}

function asIsoDate(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '');
}

function readAll(config) {
  const rows = sheetFor(config).getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push(config.fromRow(rows[i]));
  }
  return out;
}

function mergeRows(config, incoming) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheetFor(config);
    const data = sh.getDataRange().getValues();
    const updatedCol = config.columns.indexOf('updatedAt');
    const rowById = {};
    for (let i = 1; i < data.length; i++) rowById[String(data[i][0])] = i + 1;

    for (const item of (incoming || [])) {
      if (!item || !item.id) continue;
      const values = config.toRow(item);
      const rowIndex = rowById[String(item.id)];
      if (rowIndex) {
        const current = Number(data[rowIndex - 1][updatedCol]) || 0;
        if ((Number(item.updatedAt) || 0) > current) {
          sh.getRange(rowIndex, 1, 1, config.columns.length).setValues([values]);
        }
      } else {
        sh.appendRow(values);
        rowById[String(item.id)] = sh.getLastRow();
      }
    }
  } finally {
    lock.releaseLock();
  }
}
