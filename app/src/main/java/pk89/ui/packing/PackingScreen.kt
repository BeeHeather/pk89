package pk89.ui.packing

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pk89.data.AppData
import pk89.data.PackBox
import pk89.data.Product
import pk89.data.Repository
import pk89.data.countOf
import pk89.data.formatDateTime
import pk89.data.gramsPretty
import pk89.data.plural
import pk89.data.pretty
import pk89.ui.BatchCalculatorCard
import pk89.ui.BottomBarSpace
import pk89.ui.ConfirmDialog
import pk89.ui.EmptyState
import pk89.ui.FieldLabel
import pk89.ui.GlassButton
import pk89.ui.GlassCard
import pk89.ui.GlassChip
import pk89.ui.GlassField
import pk89.ui.GlassIconButton
import pk89.ui.GlassProgress
import pk89.ui.GlassSheet
import pk89.ui.Hint
import pk89.ui.IntField
import pk89.ui.Palette
import pk89.ui.ScreenHeader
import pk89.ui.SectionTitle
import pk89.ui.StatusPill

@Composable
fun PackingScreen(
    data: AppData,
    repo: Repository,
    onStartPacking: (PackBox) -> Unit,
) {
    var selectedProductId by remember { mutableStateOf(data.products.firstOrNull()?.id) }
    var creating by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<PackBox?>(null) }

    LaunchedEffect(data.products) {
        if (data.products.none { it.id == selectedProductId }) {
            selectedProductId = data.products.firstOrNull()?.id
        }
    }

    val product = data.products.firstOrNull { it.id == selectedProductId }
    val boxes = remember(data.boxes, selectedProductId) {
        data.boxes.filter { it.productId == selectedProductId }.sortedByDescending { it.createdAt }
    }

    if (data.products.isEmpty()) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader(title = "Фасовка")
            EmptyState(
                emoji = "📦",
                title = "Сначала нужна продукция",
                hint = "Заведите карточку на вкладке «Продукция» — потом здесь появятся коробки.",
            )
        }
        return
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader(
                title = "Фасовка",
                subtitle = product?.let { p ->
                    val open = boxes.count { !it.isClosed }
                    if (open == 0) "Открытых коробок нет" else "${countOf(open, "коробка", "коробки", "коробок")} в работе"
                },
            )

            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(data.products, key = { it.id }) { p ->
                    GlassChip(
                        text = "${p.emoji}  ${p.kind.ifBlank { p.category }}",
                        selected = p.id == selectedProductId,
                        onClick = { selectedProductId = p.id },
                    )
                }
            }

            LazyColumn(
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 14.dp, bottom = BottomBarSpace),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (boxes.isEmpty()) {
                    item(key = "empty") {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Hint("Коробок по этой продукции пока нет. Создайте первую — укажете, сколько порций в неё идёт.")
                        }
                    }
                } else {
                    items(boxes, key = { it.id }) { box ->
                        BoxCard(
                            box = box,
                            onStart = { onStartPacking(box) },
                            onReopen = { repo.updateBox(box.id) { it.copy(closedAt = null) } },
                            onDelete = { deleting = box },
                        )
                    }
                }

                if (product != null) {
                    item(key = "batch") {
                        Spacer(Modifier.height(6.dp))
                        BatchCalculatorCard(
                            product = product,
                            title = "Норма на коробку",
                            initialPortions = boxes.firstOrNull()?.targetPortions ?: 50,
                        )
                    }
                }
            }
        }

        GlassButton(
            text = "Новая коробка",
            icon = Icons.Default.Add,
            primary = true,
            onClick = { creating = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(end = 16.dp, bottom = BottomBarSpace),
        )
    }

    if (creating && product != null) {
        NewBoxSheet(
            product = product,
            nextIndex = data.boxes.count { it.productId == product.id } + 1,
            onDismiss = { creating = false },
            onCreate = { box, startNow ->
                repo.addBox(box)
                creating = false
                if (startNow) onStartPacking(box)
            },
        )
    }

    deleting?.let { box ->
        ConfirmDialog(
            title = "Удалить коробку?",
            message = "${box.label.ifBlank { "Коробка" }} · собрано ${box.packedPortions} из ${box.targetPortions}. Действие нельзя отменить.",
            confirmText = "Удалить",
            onConfirm = { repo.deleteBox(box.id) },
            onDismiss = { deleting = null },
        )
    }
}

@Composable
private fun BoxCard(
    box: PackBox,
    onStart: () -> Unit,
    onReopen: () -> Unit,
    onDelete: () -> Unit,
) {
    val statusText: String
    val statusColor: Color
    when {
        box.isClosed -> { statusText = "Закрыта"; statusColor = Palette.InkSoft }
        box.isFull -> { statusText = "Заполнена"; statusColor = Palette.Success }
        box.packedPortions > 0 -> { statusText = "В работе"; statusColor = Palette.Accent }
        else -> { statusText = "Новая"; statusColor = Palette.InkFaint }
    }

    GlassCard(Modifier.fillMaxWidth(), contentPadding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                box.label.ifBlank { "Коробка" },
                Modifier.weight(1f),
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = Palette.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            StatusPill(statusText, statusColor)
        }

        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                box.packedPortions.toString(),
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                color = Palette.Ink,
            )
            Text(
                "  из ${box.targetPortions} ${plural(box.targetPortions, "порции", "порций", "порций")}",
                fontSize = 14.sp,
                color = Palette.InkSoft,
                modifier = Modifier.padding(bottom = 5.dp),
            )
        }

        Spacer(Modifier.height(10.dp))
        GlassProgress(
            progress = box.progress,
            color = if (box.isClosed) Palette.InkFaint else if (box.isFull) Palette.Success else Palette.Accent,
        )

        Spacer(Modifier.height(8.dp))
        Hint(
            if (box.isClosed && box.closedAt != null) "Закрыта ${formatDateTime(box.closedAt)}"
            else "Создана ${formatDateTime(box.createdAt)}",
        )

        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (box.isClosed) {
                GlassButton(text = "Открыть снова", onClick = onReopen, modifier = Modifier.weight(1f))
            } else {
                GlassButton(
                    text = if (box.packedPortions > 0) "Продолжить" else "Начать фасовку",
                    primary = true,
                    onClick = onStart,
                    modifier = Modifier.weight(1f),
                )
            }
            Spacer(Modifier.width(10.dp))
            GlassIconButton(
                icon = Icons.Default.Delete,
                onClick = onDelete,
                tint = Palette.Danger,
                description = "Удалить коробку",
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NewBoxSheet(
    product: Product,
    nextIndex: Int,
    onDismiss: () -> Unit,
    onCreate: (PackBox, Boolean) -> Unit,
) {
    var label by remember { mutableStateOf("Коробка №$nextIndex") }
    var target by remember { mutableStateOf(50) }

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
            SectionTitle("Новая коробка")
            Spacer(Modifier.height(4.dp))
            Hint("${product.emoji}  ${product.kind.ifBlank { product.category }}")

            Spacer(Modifier.height(18.dp))
            FieldLabel("Название")
            Spacer(Modifier.height(6.dp))
            GlassField(
                value = label,
                onValueChange = { label = it },
                placeholder = "Коробка №$nextIndex",
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(18.dp))
            FieldLabel("Сколько порций в коробке")
            Spacer(Modifier.height(6.dp))
            IntField(
                value = target,
                onValueChange = { target = it },
                suffix = plural(target, "порция", "порции", "порций"),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(20, 30, 50, 100, 200).forEach { n ->
                    GlassChip(text = n.toString(), selected = n == target, onClick = { target = n })
                }
            }

            if (product.ingredients.isNotEmpty()) {
                Spacer(Modifier.height(18.dp))
                GlassCard(Modifier.fillMaxWidth(), tint = Palette.glassTint(Palette.Sky, 0.4f)) {
                    FieldLabel("Понадобится на коробку")
                    Spacer(Modifier.height(10.dp))
                    product.ingredients.forEach { ingredient ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                            Text(
                                ingredient.name,
                                Modifier.weight(1f),
                                fontSize = 14.sp,
                                color = Palette.Ink,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                "${(ingredient.teaspoons * target).pretty(1)} ч. л.",
                                fontSize = 13.sp,
                                color = Palette.InkSoft,
                            )
                            Spacer(Modifier.width(12.dp))
                            Text(
                                (ingredient.grams * target).gramsPretty(),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Palette.Ink,
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth()) {
                        Text("Всего смеси", Modifier.weight(1f), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Palette.Ink)
                        Text(
                            (product.gramsPerPortion * target).gramsPretty(),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Palette.Accent,
                        )
                    }
                }
            }

            Spacer(Modifier.height(22.dp))
            val build = {
                PackBox(
                    productId = product.id,
                    label = label.trim().ifBlank { "Коробка №$nextIndex" },
                    targetPortions = target.coerceAtLeast(1),
                )
            }
            GlassButton(
                text = "Создать и начать фасовку",
                primary = true,
                onClick = { onCreate(build(), true) },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            GlassButton(
                text = "Просто создать",
                onClick = { onCreate(build(), false) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
