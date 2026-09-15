package pk89.export

import java.io.File
import java.io.OutputStream
import java.time.LocalDate
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Минимальный генератор .xlsx на чистом Kotlin.
 *
 * Apache POI на Android не живёт: тянет javax.xml, упирается в лимиты dex и весит десятки мегабайт.
 * Здесь вручную собирается тот же OOXML-пакет, но только то, что нужно отчёту: числовые форматы,
 * границы, заливки, объединённые ячейки, закреплённая шапка, печать и формулы.
 *
 * Формулы пишутся вместе с посчитанным значением, поэтому файл читается и теми программами,
 * которые не умеют пересчитывать (простые мобильные просмотрщики), и Excel пересчитает его сам.
 */

/** Индексы стилей из [XlsxStyles]. Держим их константами, чтобы не путаться в числах. */
object S {
    const val DEFAULT = 0
    const val TITLE = 1
    const val SUBTITLE = 2
    const val META = 3
    const val HEADER = 4
    const val TEXT = 5
    const val INT_CENTER = 6
    const val DATE = 7
    const val MONEY = 8
    const val PERCENT = 9
    const val TOTAL_LABEL = 10
    const val TOTAL_MONEY = 11
    const val TOTAL_INT = 12
    const val TOTAL_PERCENT = 13
    const val STAT_LABEL = 14
    const val STAT_MONEY = 15
    const val STAT_INT = 16
    const val SIGNATURE = 17
}

sealed interface CellValue {
    data class Str(val value: String) : CellValue
    data class Num(val value: Double) : CellValue
    data class Date(val value: LocalDate) : CellValue
    /** [expression] без знака «=», [cached] — заранее посчитанный результат. */
    data class Formula(val expression: String, val cached: Double) : CellValue
}

private class Cell(val value: CellValue, val style: Int)

class XlsxSheet(val name: String) {

    private val rows = LinkedHashMap<Int, LinkedHashMap<Int, Cell>>()
    private val widths = LinkedHashMap<Int, Double>()
    private val merges = mutableListOf<String>()

    var freezeRows: Int = 0
    var repeatHeaderRow: Int? = null
    var landscape: Boolean = false
    var fitToWidth: Boolean = false

    internal val maxRow: Int get() = rows.keys.maxOrNull() ?: 0
    internal val maxCol: Int get() = rows.values.mapNotNull { it.keys.maxOrNull() }.maxOrNull() ?: 0

    fun width(column: Int, chars: Double) {
        widths[column] = chars
    }

    fun merge(row: Int, firstCol: Int, lastCol: Int, lastRow: Int = row) {
        merges += "${ref(row, firstCol)}:${ref(lastRow, lastCol)}"
    }

    fun put(row: Int, column: Int, value: CellValue, style: Int = S.DEFAULT) {
        rows.getOrPut(row) { LinkedHashMap() }[column] = Cell(value, style)
    }

    fun text(row: Int, column: Int, value: String, style: Int = S.TEXT) =
        put(row, column, CellValue.Str(value), style)

    fun number(row: Int, column: Int, value: Double, style: Int = S.MONEY) =
        put(row, column, CellValue.Num(value), style)

    fun date(row: Int, column: Int, value: LocalDate, style: Int = S.DATE) =
        put(row, column, CellValue.Date(value), style)

    fun formula(row: Int, column: Int, expression: String, cached: Double, style: Int = S.MONEY) =
        put(row, column, CellValue.Formula(expression, cached), style)

    /** Заливает диапазон пустыми ячейками с заданным стилем — чтобы рамка объединённой строки была сплошной. */
    fun blankRange(row: Int, firstCol: Int, lastCol: Int, style: Int) {
        for (c in firstCol..lastCol) put(row, c, CellValue.Str(""), style)
    }

    internal fun toXml(): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""")

        if (fitToWidth) append("""<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>""")

        append("""<dimension ref="A1:${ref(maxRow, maxCol)}"/>""")

        append("""<sheetViews><sheetView showGridLines="0" workbookViewId="0">""")
        if (freezeRows > 0) {
            append("""<pane ySplit="$freezeRows" topLeftCell="${ref(freezeRows, 0)}" activePane="bottomLeft" state="frozen"/>""")
        }
        append("""</sheetView></sheetViews>""")

        append("""<sheetFormatPr defaultRowHeight="15"/>""")

        if (widths.isNotEmpty()) {
            append("<cols>")
            widths.toSortedMap().forEach { (col, w) ->
                append("""<col min="${col + 1}" max="${col + 1}" width="$w" customWidth="1"/>""")
            }
            append("</cols>")
        }

        append("<sheetData>")
        rows.toSortedMap().forEach { (rowIndex, cells) ->
            append("""<row r="${rowIndex + 1}">""")
            cells.toSortedMap().forEach { (colIndex, cell) ->
                append(cellXml(rowIndex, colIndex, cell))
            }
            append("</row>")
        }
        append("</sheetData>")

        if (merges.isNotEmpty()) {
            append("""<mergeCells count="${merges.size}">""")
            merges.forEach { append("""<mergeCell ref="$it"/>""") }
            append("</mergeCells>")
        }

        append("""<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>""")
        val orientation = if (landscape) "landscape" else "portrait"
        if (fitToWidth) {
            append("""<pageSetup paperSize="9" orientation="$orientation" fitToWidth="1" fitToHeight="0"/>""")
        } else {
            append("""<pageSetup paperSize="9" orientation="$orientation"/>""")
        }

        append("</worksheet>")
    }

    private fun cellXml(row: Int, col: Int, cell: Cell): String {
        val r = ref(row, col)
        val s = cell.style
        return when (val v = cell.value) {
            is CellValue.Str ->
                if (v.value.isEmpty()) """<c r="$r" s="$s"/>"""
                else """<c r="$r" s="$s" t="inlineStr"><is><t xml:space="preserve">${escape(v.value)}</t></is></c>"""

            is CellValue.Num -> """<c r="$r" s="$s"><v>${num(v.value)}</v></c>"""

            is CellValue.Date -> """<c r="$r" s="$s"><v>${serialDate(v.value)}</v></c>"""

            is CellValue.Formula ->
                """<c r="$r" s="$s"><f>${escape(v.expression)}</f><v>${num(v.cached)}</v></c>"""
        }
    }
}

class XlsxWorkbook {

    private val sheets = mutableListOf<XlsxSheet>()

    fun sheet(name: String): XlsxSheet = XlsxSheet(name).also { sheets += it }

    fun writeTo(file: File) {
        file.parentFile?.mkdirs()
        file.outputStream().use { writeTo(it) }
    }

    fun writeTo(out: OutputStream) {
        ZipOutputStream(out).use { zip ->
            zip.entry("[Content_Types].xml", contentTypes())
            zip.entry("_rels/.rels", rootRels())
            zip.entry("xl/workbook.xml", workbookXml())
            zip.entry("xl/_rels/workbook.xml.rels", workbookRels())
            zip.entry("xl/styles.xml", XlsxStyles.xml())
            sheets.forEachIndexed { i, sheet ->
                zip.entry("xl/worksheets/sheet${i + 1}.xml", sheet.toXml())
            }
        }
    }

    private fun ZipOutputStream.entry(name: String, content: String) {
        putNextEntry(ZipEntry(name))
        write(content.toByteArray(Charsets.UTF_8))
        closeEntry()
    }

    private fun contentTypes(): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">""")
        append("""<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>""")
        append("""<Default Extension="xml" ContentType="application/xml"/>""")
        append("""<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>""")
        append("""<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>""")
        sheets.indices.forEach { i ->
            append("""<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>""")
        }
        append("</Types>")
    }

    private fun rootRels(): String =
        """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""" +
            """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">""" +
            """<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>""" +
            """</Relationships>"""

    private fun workbookRels(): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">""")
        sheets.indices.forEach { i ->
            append("""<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>""")
        }
        append("""<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>""")
        append("</Relationships>")
    }

    private fun workbookXml(): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" """)
        append("""xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">""")

        append("<sheets>")
        sheets.forEachIndexed { i, sheet ->
            append("""<sheet name="${escape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>""")
        }
        append("</sheets>")

        val repeats = sheets.withIndex().filter { it.value.repeatHeaderRow != null }
        if (repeats.isNotEmpty()) {
            append("<definedNames>")
            repeats.forEach { (i, sheet) ->
                val row = sheet.repeatHeaderRow!!
                append("""<definedName name="_xlnm.Print_Titles" localSheetId="$i">'${escape(sheet.name)}'!${'$'}$row:${'$'}$row</definedName>""")
            }
            append("</definedNames>")
        }

        append("""<calcPr calcId="0" fullCalcOnLoad="1"/>""")
        append("</workbook>")
    }
}

private object XlsxStyles {

    fun xml(): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""")

        append("""<numFmts count="3">""")
        append("""<numFmt numFmtId="164" formatCode="#,##0.00"/>""")
        append("""<numFmt numFmtId="165" formatCode="DD\.MM\.YYYY"/>""")
        append("""<numFmt numFmtId="166" formatCode="0.0%"/>""")
        append("</numFmts>")

        append("""<fonts count="6">""")
        append(font(size = 10))
        append(font(size = 10, bold = true))
        append(font(size = 15, bold = true))
        append(font(size = 12, bold = true))
        append(font(size = 9, italic = true, color = MUTED))
        append(font(size = 9, color = MUTED))
        append("</fonts>")

        append("""<fills count="4">""")
        append("""<fill><patternFill patternType="none"/></fill>""")
        append("""<fill><patternFill patternType="gray125"/></fill>""")
        append("""<fill><patternFill patternType="solid"><fgColor rgb="FFE4E8F5"/><bgColor indexed="64"/></patternFill></fill>""")
        append("""<fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D6"/><bgColor indexed="64"/></patternFill></fill>""")
        append("</fills>")

        append("""<borders count="3">""")
        append("""<border><left/><right/><top/><bottom/><diagonal/></border>""")
        append(thinBorder(topStyle = "thin"))
        append(thinBorder(topStyle = "double"))
        append("</borders>")

        append("""<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>""")

        append("""<cellXfs count="18">""")
        append(xf())                                                                              // 0 DEFAULT
        append(xf(font = 2, align = "left", vertical = "center"))                                 // 1 TITLE
        append(xf(font = 3, align = "left", vertical = "center"))                                 // 2 SUBTITLE
        append(xf(font = 4, align = "left", vertical = "center"))                                 // 3 META
        append(xf(font = 1, fill = 2, border = 1, align = "center", vertical = "center", wrap = true)) // 4 HEADER
        append(xf(border = 1, align = "left", vertical = "center", wrap = true))                  // 5 TEXT
        append(xf(numFmt = 1, border = 1, align = "center", vertical = "center"))                 // 6 INT_CENTER
        append(xf(numFmt = 165, border = 1, align = "center", vertical = "center"))               // 7 DATE
        append(xf(numFmt = 164, border = 1, align = "right", vertical = "center"))                // 8 MONEY
        append(xf(numFmt = 166, border = 1, align = "right", vertical = "center"))                // 9 PERCENT
        append(xf(font = 1, fill = 3, border = 2, align = "left", vertical = "center"))           // 10 TOTAL_LABEL
        append(xf(numFmt = 164, font = 1, fill = 3, border = 2, align = "right", vertical = "center"))   // 11 TOTAL_MONEY
        append(xf(numFmt = 1, font = 1, fill = 3, border = 2, align = "center", vertical = "center"))    // 12 TOTAL_INT
        append(xf(numFmt = 166, font = 1, fill = 3, border = 2, align = "right", vertical = "center"))   // 13 TOTAL_PERCENT
        append(xf(font = 4, align = "left", vertical = "center"))                                 // 14 STAT_LABEL
        append(xf(numFmt = 164, font = 1, align = "right", vertical = "center"))                  // 15 STAT_MONEY
        append(xf(numFmt = 1, font = 1, align = "right", vertical = "center"))                    // 16 STAT_INT
        append(xf(font = 5, align = "left", vertical = "center"))                                 // 17 SIGNATURE
        append("</cellXfs>")

        append("""<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>""")
        append("</styleSheet>")
    }

    private const val INK = "FF1C2140"
    private const val MUTED = "FF6E7593"
    private const val LINE = "FFB9C0D8"

    private fun font(size: Int, bold: Boolean = false, italic: Boolean = false, color: String = INK): String =
        buildString {
            append("<font>")
            if (bold) append("<b/>")
            if (italic) append("<i/>")
            append("""<sz val="$size"/><color rgb="$color"/><name val="Arial"/><family val="2"/>""")
            append("</font>")
        }

    private fun thinBorder(topStyle: String): String =
        """<border>""" +
            """<left style="thin"><color rgb="$LINE"/></left>""" +
            """<right style="thin"><color rgb="$LINE"/></right>""" +
            """<top style="$topStyle"><color rgb="${if (topStyle == "double") INK else LINE}"/></top>""" +
            """<bottom style="thin"><color rgb="$LINE"/></bottom>""" +
            """<diagonal/></border>"""

    private fun xf(
        numFmt: Int = 0,
        font: Int = 0,
        fill: Int = 0,
        border: Int = 0,
        align: String? = null,
        vertical: String? = null,
        wrap: Boolean = false,
    ): String = buildString {
        append("""<xf numFmtId="$numFmt" fontId="$font" fillId="$fill" borderId="$border" xfId="0"""")
        append(""" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"""")
        if (align != null || vertical != null || wrap) {
            append(""" applyAlignment="1">""")
            append("<alignment")
            if (align != null) append(""" horizontal="$align"""")
            if (vertical != null) append(""" vertical="$vertical"""")
            if (wrap) append(""" wrapText="1"""")
            append("/>")
            append("</xf>")
        } else {
            append("/>")
        }
    }
}

// ---------- вспомогательное ----------

/** Excel считает дни от 1899-12-30 (с учётом его знаменитого несуществующего 29 февраля 1900 года). */
private const val EXCEL_EPOCH_OFFSET = 25569L

private fun serialDate(date: LocalDate): Long = date.toEpochDay() + EXCEL_EPOCH_OFFSET

private fun num(value: Double): String {
    if (!value.isFinite()) return "0"
    val rounded = Math.round(value * 1_000_000.0) / 1_000_000.0
    return if (rounded == Math.floor(rounded) && Math.abs(rounded) < 1e15) {
        rounded.toLong().toString()
    } else {
        java.math.BigDecimal(rounded).setScale(6, java.math.RoundingMode.HALF_UP)
            .stripTrailingZeros().toPlainString()
    }
}

/** A, B, ... Z, AA, AB ... */
fun columnName(index: Int): String {
    var n = index
    val sb = StringBuilder()
    while (n >= 0) {
        sb.append(('A' + n % 26))
        n = n / 26 - 1
    }
    return sb.reverse().toString()
}

fun ref(row: Int, column: Int): String = "${columnName(column)}${row + 1}"

private fun escape(text: String): String = buildString(text.length) {
    for (ch in text) {
        when (ch) {
            '&' -> append("&amp;")
            '<' -> append("&lt;")
            '>' -> append("&gt;")
            '"' -> append("&quot;")
            '\'' -> append("&apos;")
            // управляющие символы XML не допускает вовсе
            else -> if (ch.code >= 0x20 || ch == '\n' || ch == '\t') append(ch)
        }
    }
}
