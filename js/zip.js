// Минимальный zip-упаковщик без сжатия (метод STORED).
//
// xlsx — это zip с XML внутри. Сжатие тут не нужно: отчёт весит десятки килобайт,
// а STORED избавляет от зависимости на библиотеку и от разницы в поддержке
// CompressionStream между браузерами.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Дата и время в формате MS-DOS — так их ждёт заголовок zip. */
function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2));
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xFFFF, date: day & 0xFFFF };
}

/**
 * @param {Array<{name: string, text: string}>} entries
 * @returns {Blob}
 */
export function buildZip(entries) {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(new Date());

  const prepared = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.text);
    return { nameBytes, dataBytes, crc: crc32(dataBytes), offset: 0 };
  });

  const LOCAL_HEADER = 30;
  const CENTRAL_HEADER = 46;
  const EOCD = 22;

  let localSize = 0;
  let centralSize = 0;
  for (const item of prepared) {
    localSize += LOCAL_HEADER + item.nameBytes.length + item.dataBytes.length;
    centralSize += CENTRAL_HEADER + item.nameBytes.length;
  }

  const buffer = new ArrayBuffer(localSize + centralSize + EOCD);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let pos = 0;

  const u16 = (v) => { view.setUint16(pos, v, true); pos += 2; };
  const u32 = (v) => { view.setUint32(pos, v >>> 0, true); pos += 4; };
  const raw = (arr) => { bytes.set(arr, pos); pos += arr.length; };

  // флаг 0x0800 — имена файлов в UTF-8
  const FLAGS = 0x0800;

  for (const item of prepared) {
    item.offset = pos;
    u32(0x04034B50);
    u16(20);
    u16(FLAGS);
    u16(0);            // method: stored
    u16(stamp.time);
    u16(stamp.date);
    u32(item.crc);
    u32(item.dataBytes.length);
    u32(item.dataBytes.length);
    u16(item.nameBytes.length);
    u16(0);
    raw(item.nameBytes);
    raw(item.dataBytes);
  }

  const centralStart = pos;

  for (const item of prepared) {
    u32(0x02014B50);
    u16(20);
    u16(20);
    u16(FLAGS);
    u16(0);
    u16(stamp.time);
    u16(stamp.date);
    u32(item.crc);
    u32(item.dataBytes.length);
    u32(item.dataBytes.length);
    u16(item.nameBytes.length);
    u16(0);
    u16(0);
    u16(0);
    u16(0);
    u32(0);
    u32(item.offset);
    raw(item.nameBytes);
  }

  // запоминаем размер до записи EOCD: дальше pos сдвинется и разность станет неверной
  const centralBytes = pos - centralStart;

  u32(0x06054B50);
  u16(0);
  u16(0);
  u16(prepared.length);
  u16(prepared.length);
  u32(centralBytes);
  u32(centralStart);
  u16(0);

  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
