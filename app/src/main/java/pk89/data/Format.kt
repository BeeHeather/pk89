package pk89.data

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale
import kotlin.math.abs

val RU: Locale = Locale.forLanguageTag("ru-RU")

private val UI_DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("dd.MM.yyyy")
private val UI_DATE_TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")
private val INPUT_DATE_PATTERNS = listOf("dd.MM.yyyy", "d.M.yyyy", "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "dd.MM.yy")

/** 12.5 -> "12,5"; 12.0 -> "12"; 0.333 -> "0,33". Без хвостовых нулей, десятичная запятая. */
fun Double.pretty(maxDecimals: Int = 2): String {
    if (!isFinite()) return "—"
    val bd = BigDecimal.valueOf(this).setScale(maxDecimals, RoundingMode.HALF_UP).stripTrailingZeros()
    val plain = if (bd.signum() == 0) "0" else bd.toPlainString()
    return plain.replace('.', ',')
}

/** Граммы; от килограмма — в кг. */
fun Double.gramsPretty(): String =
    if (abs(this) >= 1000.0) "${(this / 1000.0).pretty(2)} кг" else "${pretty(1)} г"

fun Double.money(currency: String): String {
    val nf = NumberFormat.getNumberInstance(RU).apply {
        minimumFractionDigits = 2
        maximumFractionDigits = 2
    }
    return "${nf.format(this)} $currency"
}

/** Принимает и "12,5", и "12.5", и "1 200". */
fun String.toRuDoubleOrNull(): Double? =
    trim().replace(" ", "").replace("\u00A0", "").replace("\u202F", "").replace(',', '.').toDoubleOrNull()

fun parseUiDate(text: String): LocalDate? {
    val t = text.trim()
    if (t.isEmpty()) return null
    for (pattern in INPUT_DATE_PATTERNS) {
        try {
            return LocalDate.parse(t, DateTimeFormatter.ofPattern(pattern))
        } catch (_: DateTimeParseException) {
            // пробуем следующий формат
        }
    }
    return null
}

fun LocalDate.toUi(): String = format(UI_DATE)

fun isoToDate(iso: String): LocalDate? = runCatching { LocalDate.parse(iso) }.getOrNull()

fun isoToUi(iso: String): String = isoToDate(iso)?.toUi() ?: iso

fun formatDateTime(millis: Long): String =
    Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).format(UI_DATE_TIME)

/** plural(3, "порция", "порции", "порций") -> "порции" */
fun plural(n: Int, one: String, few: String, many: String): String {
    val a = abs(n) % 100
    val b = a % 10
    return when {
        a in 11..19 -> many
        b == 1 -> one
        b in 2..4 -> few
        else -> many
    }
}

fun countOf(n: Int, one: String, few: String, many: String): String = "$n ${plural(n, one, few, many)}"
