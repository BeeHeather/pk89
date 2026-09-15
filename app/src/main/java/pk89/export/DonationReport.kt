package pk89.export

import pk89.data.Donation
import pk89.data.RU
import pk89.data.isoToDate
import java.io.File
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Финансовая отчётность по пожертвованиям: три листа — реестр, сводка по месяцам, срез по жертвователям.
 * Суммы и итоги записаны формулами, поэтому файл остаётся живым документом после выгрузки.
 */
object DonationReport {

    const val ORGANIZATION = "Полевая кухня 89"

    private val MONTH_TITLE = DateTimeFormatter.ofPattern("LLLL yyyy", RU)
    private val UI_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy", RU)

    fun fileName(today: LocalDate = LocalDate.now()): String =
        "Пожертвования_${today.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))}.xlsx"

    fun build(target: File, donations: List<Donation>, currency: String) {
        val rows = donations
            .map { Row(it, isoToDate(it.date)) }
            .sortedWith(compareBy({ it.date ?: LocalDate.MAX }, { it.donation.createdAt }))

        val wb = XlsxWorkbook()
        buildRegistry(wb, rows, currency)
        buildMonthly(wb, rows, currency)
        buildDonors(wb, rows, currency)
        wb.writeTo(target)
    }

    private class Row(val donation: Donation, val date: LocalDate?)

    // ---------- лист 1: реестр ----------

    private fun buildRegistry(wb: XlsxWorkbook, rows: List<Row>, currency: String) {
        val sheet = wb.sheet("Реестр пожертвований")
        sheet.landscape = true
        sheet.fitToWidth = true

        val lastCol = 5
        listOf(6.0, 13.0, 34.0, 44.0, 18.0, 26.0).forEachIndexed { i, w -> sheet.width(i, w) }

        val today = LocalDate.now()
        val dated = rows.mapNotNull { it.date }
        val period = when {
            dated.isEmpty() -> "период не определён"
            else -> "${dated.min().format(UI_DATE)} — ${dated.max().format(UI_DATE)}"
        }

        sheet.text(0, 0, ORGANIZATION.uppercase(RU), S.TITLE)
        sheet.merge(0, 0, lastCol)

        sheet.text(1, 0, "Отчёт о поступлении пожертвований", S.SUBTITLE)
        sheet.merge(1, 0, lastCol)

        sheet.text(2, 0, "Период: $period", S.META)
        sheet.merge(2, 0, lastCol)

        sheet.text(3, 0, "Составлен: ${today.format(UI_DATE)}   ·   Валюта: $currency", S.META)
        sheet.merge(3, 0, lastCol)

        val headerRow = 5
        val headers = listOf("№", "Дата", "Жертвователь", "Назначение / комментарий", "Сумма, $currency", "Нарастающим итогом")
        headers.forEachIndexed { i, h -> sheet.text(headerRow, i, h, S.HEADER) }

        val first = headerRow + 1
        var running = 0.0
        rows.forEachIndexed { index, row ->
            val r = first + index
            running += row.donation.amount

            sheet.number(r, 0, (index + 1).toDouble(), S.INT_CENTER)
            if (row.date != null) sheet.date(r, 1, row.date) else sheet.text(r, 1, row.donation.date, S.TEXT)
            sheet.text(r, 2, row.donation.donor.ifBlank { "Без имени" }, S.TEXT)
            sheet.text(r, 3, row.donation.note, S.TEXT)
            sheet.number(r, 4, row.donation.amount, S.MONEY)

            val cumulative = if (index == 0) ref(r, 4) else "${ref(r - 1, 5)}+${ref(r, 4)}"
            sheet.formula(r, 5, cumulative, running, S.MONEY)
        }

        val total = rows.sumOf { it.donation.amount }
        val totalRow = if (rows.isEmpty()) first else first + rows.size

        sheet.blankRange(totalRow, 0, lastCol, S.TOTAL_LABEL)
        sheet.text(totalRow, 0, "ИТОГО ЗА ПЕРИОД", S.TOTAL_LABEL)
        sheet.merge(totalRow, 0, 3)
        if (rows.isEmpty()) {
            sheet.number(totalRow, 4, 0.0, S.TOTAL_MONEY)
            sheet.number(totalRow, 5, 0.0, S.TOTAL_MONEY)
        } else {
            sheet.formula(totalRow, 4, "SUM(${ref(first, 4)}:${ref(first + rows.size - 1, 4)})", total, S.TOTAL_MONEY)
            sheet.formula(totalRow, 5, ref(first + rows.size - 1, 5), total, S.TOTAL_MONEY)
        }

        var r = totalRow + 2
        val count = rows.size
        val average = if (count == 0) 0.0 else total / count
        val largest = rows.maxOfOrNull { it.donation.amount } ?: 0.0

        sheet.text(r, 2, "Количество поступлений", S.STAT_LABEL)
        sheet.number(r, 4, count.toDouble(), S.STAT_INT)
        r++
        sheet.text(r, 2, "Средний размер пожертвования", S.STAT_LABEL)
        if (count == 0) sheet.number(r, 4, 0.0, S.STAT_MONEY)
        else sheet.formula(r, 4, "${ref(totalRow, 4)}/$count", average, S.STAT_MONEY)
        r++
        sheet.text(r, 2, "Наибольшее пожертвование", S.STAT_LABEL)
        if (count == 0) sheet.number(r, 4, 0.0, S.STAT_MONEY)
        else sheet.formula(r, 4, "MAX(${ref(first, 4)}:${ref(first + rows.size - 1, 4)})", largest, S.STAT_MONEY)

        r += 3
        sheet.text(r, 0, "Ответственный за приём пожертвований", S.SIGNATURE)
        sheet.text(r, 4, "___________________ / _________________", S.SIGNATURE)
        r++
        sheet.text(r, 4, "подпись, расшифровка", S.SIGNATURE)

        sheet.freezeRows = headerRow + 1
        sheet.repeatHeaderRow = headerRow + 1
    }

    // ---------- лист 2: по месяцам ----------

    private fun buildMonthly(wb: XlsxWorkbook, rows: List<Row>, currency: String) {
        val sheet = wb.sheet("Сводка по месяцам")
        listOf(22.0, 16.0, 20.0, 14.0).forEachIndexed { i, w -> sheet.width(i, w) }

        sheet.text(0, 0, "Поступления по месяцам", S.SUBTITLE)
        sheet.merge(0, 0, 3)

        val headerRow = 2
        listOf("Месяц", "Количество", "Сумма, $currency", "Доля")
            .forEachIndexed { i, h -> sheet.text(headerRow, i, h, S.HEADER) }

        val grouped = rows
            .filter { it.date != null }
            .groupBy { it.date!!.withDayOfMonth(1) }
            .toSortedMap()

        val total = rows.sumOf { it.donation.amount }
        val first = headerRow + 1
        var index = 0

        grouped.forEach { (month, monthRows) ->
            val r = first + index
            val sum = monthRows.sumOf { it.donation.amount }
            sheet.text(r, 0, month.format(MONTH_TITLE).replaceFirstChar { it.titlecase(RU) }, S.TEXT)
            sheet.number(r, 1, monthRows.size.toDouble(), S.INT_CENTER)
            sheet.number(r, 2, sum, S.MONEY)
            sheet.number(r, 3, if (total == 0.0) 0.0 else sum / total, S.PERCENT)
            index++
        }

        val totalRow = first + index
        sheet.blankRange(totalRow, 0, 3, S.TOTAL_LABEL)
        sheet.text(totalRow, 0, "ИТОГО", S.TOTAL_LABEL)
        if (index == 0) {
            sheet.number(totalRow, 1, 0.0, S.TOTAL_INT)
            sheet.number(totalRow, 2, 0.0, S.TOTAL_MONEY)
            sheet.number(totalRow, 3, 0.0, S.TOTAL_PERCENT)
        } else {
            sheet.formula(totalRow, 1, "SUM(${ref(first, 1)}:${ref(totalRow - 1, 1)})", rows.count { it.date != null }.toDouble(), S.TOTAL_INT)
            sheet.formula(totalRow, 2, "SUM(${ref(first, 2)}:${ref(totalRow - 1, 2)})", grouped.values.sumOf { g -> g.sumOf { it.donation.amount } }, S.TOTAL_MONEY)
            sheet.formula(totalRow, 3, "SUM(${ref(first, 3)}:${ref(totalRow - 1, 3)})", 1.0, S.TOTAL_PERCENT)
        }

        sheet.freezeRows = headerRow + 1
    }

    // ---------- лист 3: по жертвователям ----------

    private fun buildDonors(wb: XlsxWorkbook, rows: List<Row>, currency: String) {
        val sheet = wb.sheet("По жертвователям")
        listOf(34.0, 14.0, 20.0, 20.0, 20.0).forEachIndexed { i, w -> sheet.width(i, w) }

        sheet.text(0, 0, "Поступления по жертвователям", S.SUBTITLE)
        sheet.merge(0, 0, 4)

        val headerRow = 2
        listOf("Жертвователь", "Записей", "Сумма, $currency", "Первое поступление", "Последнее поступление")
            .forEachIndexed { i, h -> sheet.text(headerRow, i, h, S.HEADER) }

        val grouped = rows
            .groupBy { it.donation.donor.trim().ifBlank { "Без имени" } }
            .entries
            .sortedByDescending { entry -> entry.value.sumOf { it.donation.amount } }

        val first = headerRow + 1
        grouped.forEachIndexed { index, entry ->
            val r = first + index
            val dates = entry.value.mapNotNull { it.date }
            sheet.text(r, 0, entry.key, S.TEXT)
            sheet.number(r, 1, entry.value.size.toDouble(), S.INT_CENTER)
            sheet.number(r, 2, entry.value.sumOf { it.donation.amount }, S.MONEY)
            if (dates.isEmpty()) {
                sheet.text(r, 3, "—", S.TEXT)
                sheet.text(r, 4, "—", S.TEXT)
            } else {
                sheet.date(r, 3, dates.min())
                sheet.date(r, 4, dates.max())
            }
        }

        val totalRow = first + grouped.size
        sheet.blankRange(totalRow, 0, 4, S.TOTAL_LABEL)
        sheet.text(totalRow, 0, "ИТОГО", S.TOTAL_LABEL)
        if (grouped.isEmpty()) {
            sheet.number(totalRow, 1, 0.0, S.TOTAL_INT)
            sheet.number(totalRow, 2, 0.0, S.TOTAL_MONEY)
        } else {
            sheet.formula(totalRow, 1, "SUM(${ref(first, 1)}:${ref(totalRow - 1, 1)})", rows.size.toDouble(), S.TOTAL_INT)
            sheet.formula(totalRow, 2, "SUM(${ref(first, 2)}:${ref(totalRow - 1, 2)})", rows.sumOf { it.donation.amount }, S.TOTAL_MONEY)
        }

        sheet.freezeRows = headerRow + 1
    }
}
