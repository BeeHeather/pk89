package pk89.ui.finance

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pk89.data.AppData
import pk89.data.CURRENCIES
import pk89.data.Donation
import pk89.data.Repository
import pk89.data.countOf
import pk89.data.isoToDate
import pk89.data.isoToUi
import pk89.data.money
import pk89.data.parseUiDate
import pk89.data.toRuDoubleOrNull
import pk89.data.toUi
import pk89.export.ReportSharing
import pk89.ui.BottomBarSpace
import pk89.ui.ConfirmDialog
import pk89.ui.EmptyState
import pk89.ui.FieldLabel
import pk89.ui.GlassButton
import pk89.ui.GlassCard
import pk89.ui.GlassChip
import pk89.ui.GlassField
import pk89.ui.GlassIconButton
import pk89.ui.GlassSheet
import pk89.ui.Hint
import pk89.ui.Palette
import pk89.ui.ScreenHeader
import pk89.ui.SectionTitle
import pk89.ui.StatTile
import java.time.LocalDate
import java.time.YearMonth

@Composable
fun FinanceScreen(data: AppData, repo: Repository) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var adding by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<Donation?>(null) }
    var pickingCurrency by remember { mutableStateOf(false) }
    var banner by remember { mutableStateOf<String?>(null) }
    var exporting by remember { mutableStateOf(false) }

    val currency = data.currency
    val sorted = remember(data.donations) {
        data.donations.sortedWith(compareByDescending<Donation> { it.date }.thenByDescending { it.createdAt })
    }
    val total = remember(data.donations) { data.donations.sumOf { it.amount } }
    val thisMonth = remember(data.donations) {
        val now = YearMonth.now()
        data.donations.filter { d -> isoToDate(d.date)?.let { YearMonth.from(it) == now } == true }.sumOf { it.amount }
    }

    LaunchedEffect(banner) {
        if (banner != null) {
            delay(5000)
            banner = null
        }
    }

    fun export() {
        if (exporting || data.donations.isEmpty()) return
        exporting = true
        scope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    ReportSharing.prepare(context, data.donations, currency)
                }
            }
            exporting = false
            result
                .onSuccess { file ->
                    runCatching { context.startActivity(ReportSharing.shareIntent(context, file)) }
                        .onFailure { banner = "Отчёт готов, но не нашлось приложения, куда его отправить." }
                }
                .onFailure { banner = "Не удалось собрать отчёт: ${it.message ?: "неизвестная ошибка"}" }
        }
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader(
                title = "Финансы",
                subtitle = countOf(data.donations.size, "запись", "записи", "записей"),
                actions = {
                    GlassChip(text = "Валюта: $currency", selected = false, onClick = { pickingCurrency = true })
                },
            )

            LazyColumn(
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = BottomBarSpace),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                item(key = "summary") {
                    Column {
                        StatTile(
                            label = "Всего собрано",
                            value = total.money(currency),
                            modifier = Modifier.fillMaxWidth(),
                            tint = Palette.glassTint(Palette.Mint, 0.45f),
                        )
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatTile(
                                label = "За текущий месяц",
                                value = thisMonth.money(currency),
                                modifier = Modifier.weight(1f),
                                tint = Palette.glassTint(Palette.Sky, 0.45f),
                            )
                            StatTile(
                                label = "Жертвователей",
                                value = data.donations
                                    .map { it.donor.trim().lowercase() }
                                    .filter { it.isNotBlank() }
                                    .distinct().size.toString(),
                                modifier = Modifier.weight(1f),
                                tint = Palette.glassTint(Palette.Lilac, 0.45f),
                            )
                        }
                    }
                }

                item(key = "export") {
                    GlassButton(
                        text = if (exporting) "Собираю отчёт…" else "Выгрузить отчёт в Excel",
                        icon = Icons.Default.Share,
                        primary = true,
                        enabled = data.donations.isNotEmpty() && !exporting,
                        onClick = { export() },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                if (sorted.isEmpty()) {
                    item(key = "empty") {
                        EmptyState(
                            emoji = "🤝",
                            title = "Записей пока нет",
                            hint = "Добавьте первое пожертвование — кто, сколько и когда. Отчёт соберётся из этих записей.",
                        )
                    }
                } else {
                    item(key = "journal-title") {
                        SectionTitle("Журнал", Modifier.padding(top = 8.dp, start = 4.dp))
                    }
                    items(sorted, key = { it.id }) { donation ->
                        DonationCard(
                            donation = donation,
                            currency = currency,
                            onDelete = { deleting = donation },
                        )
                    }
                }
            }
        }

        GlassButton(
            text = "Добавить",
            icon = Icons.Default.Add,
            primary = true,
            onClick = { adding = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(end = 16.dp, bottom = BottomBarSpace),
        )

        AnimatedVisibility(
            visible = banner != null,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(start = 16.dp, end = 16.dp, bottom = BottomBarSpace + 60.dp),
        ) {
            GlassCard(Modifier.fillMaxWidth(), tint = Palette.glassTint(Palette.Peach, 0.5f)) {
                Hint(banner.orEmpty(), color = Palette.Ink)
            }
        }
    }

    if (adding) {
        DonationSheet(
            currency = currency,
            onDismiss = { adding = false },
            onSave = { repo.addDonation(it); adding = false },
        )
    }

    if (pickingCurrency) {
        CurrencySheet(
            current = currency,
            onDismiss = { pickingCurrency = false },
            onSelect = { repo.setCurrency(it); pickingCurrency = false },
        )
    }

    deleting?.let { donation ->
        ConfirmDialog(
            title = "Удалить запись?",
            message = "${donation.donor.ifBlank { "Без имени" }} · ${donation.amount.money(currency)} · ${isoToUi(donation.date)}.",
            confirmText = "Удалить",
            onConfirm = { repo.deleteDonation(donation.id) },
            onDismiss = { deleting = null },
        )
    }
}

@Composable
private fun DonationCard(donation: Donation, currency: String, onDelete: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), contentPadding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    donation.donor.ifBlank { "Без имени" },
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Palette.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(3.dp))
                Text(
                    if (donation.note.isBlank()) isoToUi(donation.date)
                    else "${isoToUi(donation.date)} · ${donation.note}",
                    fontSize = 13.sp,
                    color = Palette.InkSoft,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(10.dp))
            Text(
                donation.amount.money(currency),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Palette.Ink,
            )
            Spacer(Modifier.width(6.dp))
            GlassIconButton(
                icon = Icons.Default.Delete,
                onClick = onDelete,
                tint = Palette.Danger,
                size = 38.dp,
                description = "Удалить запись",
            )
        }
    }
}

@Composable
private fun DonationSheet(
    currency: String,
    onDismiss: () -> Unit,
    onSave: (Donation) -> Unit,
) {
    var donor by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(LocalDate.now().toUi()) }
    var note by remember { mutableStateOf("") }
    var touched by remember { mutableStateOf(false) }

    val parsedAmount = amount.toRuDoubleOrNull()
    val parsedDate = parseUiDate(date)
    val amountError = touched && (parsedAmount == null || parsedAmount <= 0.0)
    val dateError = touched && parsedDate == null

    GlassSheet(onDismiss = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
        ) {
            SectionTitle("Новое пожертвование")
            Spacer(Modifier.height(16.dp))

            FieldLabel("От кого")
            Spacer(Modifier.height(6.dp))
            GlassField(
                value = donor,
                onValueChange = { donor = it },
                placeholder = "Иван Петрович",
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(16.dp))
            FieldLabel("Сумма")
            Spacer(Modifier.height(6.dp))
            GlassField(
                value = amount,
                onValueChange = { amount = it },
                placeholder = "5000",
                keyboardType = KeyboardType.Decimal,
                suffix = currency,
                modifier = Modifier.fillMaxWidth(),
            )
            if (amountError) {
                Spacer(Modifier.height(5.dp))
                Hint("Введите сумму больше нуля", color = Palette.Danger)
            }

            Spacer(Modifier.height(16.dp))
            FieldLabel("Дата")
            Spacer(Modifier.height(6.dp))
            GlassField(
                value = date,
                onValueChange = { date = it },
                placeholder = "дд.мм.гггг",
                keyboardType = KeyboardType.Number,
                modifier = Modifier.fillMaxWidth(),
            )
            if (dateError) {
                Spacer(Modifier.height(5.dp))
                Hint("Дата в формате 31.12.2026", color = Palette.Danger)
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassChip("Сегодня", selected = false, onClick = { date = LocalDate.now().toUi() })
                GlassChip("Вчера", selected = false, onClick = { date = LocalDate.now().minusDays(1).toUi() })
            }

            Spacer(Modifier.height(16.dp))
            FieldLabel("Комментарий")
            Spacer(Modifier.height(6.dp))
            GlassField(
                value = note,
                onValueChange = { note = it },
                placeholder = "На закупку крупы",
                singleLine = false,
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(22.dp))
            GlassButton(
                text = "Добавить запись",
                primary = true,
                onClick = {
                    touched = true
                    val value = amount.toRuDoubleOrNull()
                    val day = parseUiDate(date)
                    if (value != null && value > 0.0 && day != null) {
                        onSave(
                            Donation(
                                donor = donor.trim(),
                                amount = value,
                                date = day.toString(),
                                note = note.trim(),
                            )
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CurrencySheet(
    current: String,
    onDismiss: () -> Unit,
    onSelect: (String) -> Unit,
) {
    GlassSheet(onDismiss = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
        ) {
            SectionTitle("Валюта")
            Spacer(Modifier.height(4.dp))
            Hint("Подставляется в суммы и в заголовок отчёта.")
            Spacer(Modifier.height(16.dp))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                CURRENCIES.forEach { c ->
                    GlassChip(text = c, selected = c == current, onClick = { onSelect(c) })
                }
            }
        }
    }
}
