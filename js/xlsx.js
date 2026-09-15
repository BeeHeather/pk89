// Генератор .xlsx без библиотек: тот же OOXML, что в Kotlin-версии, слово в слово.
// Поддержано ровно то, что нужно отчётности: числовые форматы, границы, заливки,
// объединённые ячейки, закреплённая шапка, настройки печати и формулы.

import { buildZip } from './zip.js';

/** Индексы стилей из styles.xml. */
export const S = {
  DEFAULT: 0,
  TITLE: 1,
  SUBTITLE: 2,
  META: 3,
  HEADER: 4,
  TEXT: 5,
  INT_CENTER: 6,
  DATE: 7,
  MONEY: 8,
  PERCENT: 9,
  TOTAL_LABEL: 10,
  TOTAL_MONEY: 11,
  TOTAL_INT: 12,
  TOTAL_PERCENT: 13,
  STAT_LABEL: 14,
  STAT_MONEY: 15,
  STAT_INT: 16,
  SIGNATURE: 17,
};

/** Excel считает дни от 1899-12-30 — с поправкой на его несуществующее 29 февраля 1900 года. */
const EXCEL_EPOCH_OFFSET = 25569;

export function columnName(index) {
  let n = index;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

export function ref(row, column) {
  return `${columnName(column)}${row + 1}`;
}

function escapeXml(text) {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (ch === '&') out += '&amp;';
    else if (ch === '<') out += '&lt;';
    else if (ch === '>') out += '&gt;';
    else if (ch === '"') out += '&quot;';
    else if (ch === "'") out += '&apos;';
    else if (code >= 0x20 || ch === '\n' || ch === '\t') out += ch;
  }
  return out;
}

function num(value) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 1e6) / 1e6;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

export class Sheet {
  constructor(name) {
    this.name = name;
    this.rows = new Map();     // индекс строки -> Map(колонка -> ячейка)
    this.widths = new Map();
    this.merges = [];
    this.freezeRows = 0;
    this.repeatHeaderRow = null;
    this.landscape = false;
    this.fitToWidth = false;
  }

  width(column, chars) {
    this.widths.set(column, chars);
  }

  merge(row, firstCol, lastCol, lastRow = row) {
    this.merges.push(`${ref(row, firstCol)}:${ref(lastRow, lastCol)}`);
  }

  put(row, column, cell) {
    if (!this.rows.has(row)) this.rows.set(row, new Map());
    this.rows.get(row).set(column, cell);
  }

  text(row, column, value, style = S.TEXT) {
    this.put(row, column, { kind: 'str', value, style });
  }

  number(row, column, value, style = S.MONEY) {
    this.put(row, column, { kind: 'num', value, style });
  }

  /** epochDay — дни от 1970-01-01, как отдаёт isoToEpochDay. */
  date(row, column, epochDay, style = S.DATE) {
    this.put(row, column, { kind: 'date', value: epochDay, style });
  }

  formula(row, column, expression, cached, style = S.MONEY) {
    this.put(row, column, { kind: 'formula', value: expression, cached, style });
  }

  /** Пустые ячейки со стилем — чтобы рамка объединённой строки была сплошной. */
  blankRange(row, firstCol, lastCol, style) {
    for (let c = firstCol; c <= lastCol; c++) this.text(row, c, '', style);
  }

  get maxRow() {
    return this.rows.size ? Math.max(...this.rows.keys()) : 0;
  }

  get maxCol() {
    let max = 0;
    for (const cells of this.rows.values()) {
      for (const col of cells.keys()) if (col > max) max = col;
    }
    return max;
  }

  cellXml(row, col, cell) {
    const r = ref(row, col);
    const s = cell.style;
    switch (cell.kind) {
      case 'str':
        return cell.value === ''
          ? `<c r="${r}" s="${s}"/>`
          : `<c r="${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
      case 'num':
        return `<c r="${r}" s="${s}"><v>${num(cell.value)}</v></c>`;
      case 'date':
        return `<c r="${r}" s="${s}"><v>${cell.value + EXCEL_EPOCH_OFFSET}</v></c>`;
      case 'formula':
        return `<c r="${r}" s="${s}"><f>${escapeXml(cell.value)}</f><v>${num(cell.cached)}</v></c>`;
      default:
        return `<c r="${r}" s="${s}"/>`;
    }
  }

  toXml() {
    let out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    out += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

    if (this.fitToWidth) out += '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';

    out += `<dimension ref="A1:${ref(this.maxRow, this.maxCol)}"/>`;

    out += '<sheetViews><sheetView showGridLines="0" workbookViewId="0">';
    if (this.freezeRows > 0) {
      out += `<pane ySplit="${this.freezeRows}" topLeftCell="${ref(this.freezeRows, 0)}" activePane="bottomLeft" state="frozen"/>`;
    }
    out += '</sheetView></sheetViews>';

    out += '<sheetFormatPr defaultRowHeight="15"/>';

    if (this.widths.size) {
      out += '<cols>';
      for (const col of [...this.widths.keys()].sort((a, b) => a - b)) {
        out += `<col min="${col + 1}" max="${col + 1}" width="${this.widths.get(col)}" customWidth="1"/>`;
      }
      out += '</cols>';
    }

    out += '<sheetData>';
    for (const rowIndex of [...this.rows.keys()].sort((a, b) => a - b)) {
      const cells = this.rows.get(rowIndex);
      out += `<row r="${rowIndex + 1}">`;
      for (const col of [...cells.keys()].sort((a, b) => a - b)) {
        out += this.cellXml(rowIndex, col, cells.get(col));
      }
      out += '</row>';
    }
    out += '</sheetData>';

    if (this.merges.length) {
      out += `<mergeCells count="${this.merges.length}">`;
      for (const m of this.merges) out += `<mergeCell ref="${m}"/>`;
      out += '</mergeCells>';
    }

    out += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
    const orientation = this.landscape ? 'landscape' : 'portrait';
    out += this.fitToWidth
      ? `<pageSetup paperSize="9" orientation="${orientation}" fitToWidth="1" fitToHeight="0"/>`
      : `<pageSetup paperSize="9" orientation="${orientation}"/>`;

    out += '</worksheet>';
    return out;
  }
}

export class Workbook {
  constructor() {
    this.sheets = [];
  }

  sheet(name) {
    const s = new Sheet(name);
    this.sheets.push(s);
    return s;
  }

  toBlob() {
    const entries = [
      { name: '[Content_Types].xml', text: this.contentTypes() },
      { name: '_rels/.rels', text: rootRels() },
      { name: 'xl/workbook.xml', text: this.workbookXml() },
      { name: 'xl/_rels/workbook.xml.rels', text: this.workbookRels() },
      { name: 'xl/styles.xml', text: stylesXml() },
    ];
    this.sheets.forEach((sheet, i) => {
      entries.push({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheet.toXml() });
    });
    return buildZip(entries);
  }

  contentTypes() {
    let out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    out += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
    out += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
    out += '<Default Extension="xml" ContentType="application/xml"/>';
    out += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
    out += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    this.sheets.forEach((_, i) => {
      out += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    });
    out += '</Types>';
    return out;
  }

  workbookRels() {
    let out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    out += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    this.sheets.forEach((_, i) => {
      out += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
    });
    out += '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    out += '</Relationships>';
    return out;
  }

  workbookXml() {
    let out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    out += '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ';
    out += 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';

    out += '<sheets>';
    this.sheets.forEach((sheet, i) => {
      out += `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
    });
    out += '</sheets>';

    const repeats = this.sheets
      .map((sheet, i) => ({ sheet, i }))
      .filter(({ sheet }) => sheet.repeatHeaderRow != null);

    if (repeats.length) {
      out += '<definedNames>';
      for (const { sheet, i } of repeats) {
        const row = sheet.repeatHeaderRow;
        out += `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${escapeXml(sheet.name)}'!$${row}:$${row}</definedName>`;
      }
      out += '</definedNames>';
    }

    out += '<calcPr calcId="0" fullCalcOnLoad="1"/>';
    out += '</workbook>';
    return out;
  }
}

function rootRels() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';
}

const INK = 'FF1C2140';
const MUTED = 'FF6E7593';
const LINE = 'FFB9C0D8';

function font({ size, bold = false, italic = false, color = INK }) {
  let out = '<font>';
  if (bold) out += '<b/>';
  if (italic) out += '<i/>';
  out += `<sz val="${size}"/><color rgb="${color}"/><name val="Arial"/><family val="2"/>`;
  out += '</font>';
  return out;
}

function border(topStyle) {
  return '<border>'
    + `<left style="thin"><color rgb="${LINE}"/></left>`
    + `<right style="thin"><color rgb="${LINE}"/></right>`
    + `<top style="${topStyle}"><color rgb="${topStyle === 'double' ? INK : LINE}"/></top>`
    + `<bottom style="thin"><color rgb="${LINE}"/></bottom>`
    + '<diagonal/></border>';
}

function xf({ numFmt = 0, font: fontId = 0, fill = 0, border: borderId = 0, align = null, vertical = null, wrap = false }) {
  let out = `<xf numFmtId="${numFmt}" fontId="${fontId}" fillId="${fill}" borderId="${borderId}" xfId="0"`;
  out += ' applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"';
  if (align || vertical || wrap) {
    out += ' applyAlignment="1">';
    out += '<alignment';
    if (align) out += ` horizontal="${align}"`;
    if (vertical) out += ` vertical="${vertical}"`;
    if (wrap) out += ' wrapText="1"';
    out += '/>';
    out += '</xf>';
  } else {
    out += '/>';
  }
  return out;
}

function stylesXml() {
  let out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  out += '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

  out += '<numFmts count="3">';
  out += '<numFmt numFmtId="164" formatCode="#,##0.00"/>';
  out += '<numFmt numFmtId="165" formatCode="DD\\.MM\\.YYYY"/>';
  out += '<numFmt numFmtId="166" formatCode="0.0%"/>';
  out += '</numFmts>';

  out += '<fonts count="6">';
  out += font({ size: 10 });
  out += font({ size: 10, bold: true });
  out += font({ size: 15, bold: true });
  out += font({ size: 12, bold: true });
  out += font({ size: 9, italic: true, color: MUTED });
  out += font({ size: 9, color: MUTED });
  out += '</fonts>';

  out += '<fills count="4">';
  out += '<fill><patternFill patternType="none"/></fill>';
  out += '<fill><patternFill patternType="gray125"/></fill>';
  out += '<fill><patternFill patternType="solid"><fgColor rgb="FFE4E8F5"/><bgColor indexed="64"/></patternFill></fill>';
  out += '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D6"/><bgColor indexed="64"/></patternFill></fill>';
  out += '</fills>';

  out += '<borders count="3">';
  out += '<border><left/><right/><top/><bottom/><diagonal/></border>';
  out += border('thin');
  out += border('double');
  out += '</borders>';

  out += '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';

  out += '<cellXfs count="18">';
  out += xf({});                                                                                   // 0
  out += xf({ font: 2, align: 'left', vertical: 'center' });                                       // 1
  out += xf({ font: 3, align: 'left', vertical: 'center' });                                       // 2
  out += xf({ font: 4, align: 'left', vertical: 'center' });                                       // 3
  out += xf({ font: 1, fill: 2, border: 1, align: 'center', vertical: 'center', wrap: true });     // 4
  out += xf({ border: 1, align: 'left', vertical: 'center', wrap: true });                         // 5
  out += xf({ numFmt: 1, border: 1, align: 'center', vertical: 'center' });                        // 6
  out += xf({ numFmt: 165, border: 1, align: 'center', vertical: 'center' });                      // 7
  out += xf({ numFmt: 164, border: 1, align: 'right', vertical: 'center' });                       // 8
  out += xf({ numFmt: 166, border: 1, align: 'right', vertical: 'center' });                       // 9
  out += xf({ font: 1, fill: 3, border: 2, align: 'left', vertical: 'center' });                   // 10
  out += xf({ numFmt: 164, font: 1, fill: 3, border: 2, align: 'right', vertical: 'center' });     // 11
  out += xf({ numFmt: 1, font: 1, fill: 3, border: 2, align: 'center', vertical: 'center' });      // 12
  out += xf({ numFmt: 166, font: 1, fill: 3, border: 2, align: 'right', vertical: 'center' });     // 13
  out += xf({ font: 4, align: 'left', vertical: 'center' });                                       // 14
  out += xf({ numFmt: 164, font: 1, align: 'right', vertical: 'center' });                         // 15
  out += xf({ numFmt: 1, font: 1, align: 'right', vertical: 'center' });                           // 16
  out += xf({ font: 5, align: 'left', vertical: 'center' });                                       // 17
  out += '</cellXfs>';

  out += '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>';
  out += '</styleSheet>';
  return out;
}
