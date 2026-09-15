package pk89.ui.products

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pk89.data.AppData
import pk89.data.Product
import pk89.data.Repository
import pk89.data.countOf
import pk89.data.gramsPretty
import pk89.ui.BottomBarSpace
import pk89.ui.ConfirmDialog
import pk89.ui.EmptyState
import pk89.ui.FieldLabel
import pk89.ui.GlassButton
import pk89.ui.GlassCard
import pk89.ui.GlassChip
import pk89.ui.GlassField
import pk89.ui.GlassSheet
import pk89.ui.Palette
import pk89.ui.ScreenHeader
import pk89.ui.SectionTitle
import pk89.ui.glass

private val EMOJIS = listOf("🥣", "🫐", "🍒", "🍓", "🍎", "🌾", "🥔", "🧅", "🥕", "🌽", "🍲", "☕", "🍵", "🍫", "🥛", "🧂")

@Composable
fun ProductsScreen(
    data: AppData,
    repo: Repository,
    onOpenProduct: (Product) -> Unit,
) {
    var editing by remember { mutableStateOf<Product?>(null) }
    var creating by remember { mutableStateOf(false) }

    val grouped = remember(data.products) {
        data.products
            .sortedWith(compareBy({ it.category.lowercase() }, { it.kind.lowercase() }))
            .groupBy { it.category.ifBlank { "Без категории" } }
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader(
                title = "«Рецептура»",
                subtitle = countOf(data.products.size, "карточка", "карточки", "карточек"),
            )

            if (data.products.isEmpty()) {
                EmptyState(
                    emoji = "🥣",
                    title = "Пока ничего нет",
                    hint = "Добавьте первый вид продукции — например, кисель смородиновый. Рецепт заполните внутри карточки.",
                )
            } else {
                LazyColumn(
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(
                        start = 16.dp,
                        end = 16.dp,
                        top = 4.dp,
                        bottom = BottomBarSpace,
                    ),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    grouped.forEach { (category, products) ->
                        item(key = "header-$category") {
                            Text(
                                category,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Palette.InkSoft,
                                modifier = Modifier.padding(start = 4.dp, top = 10.dp, bottom = 2.dp),
                            )
                        }
                        items(products, key = { it.id }) { product ->
                            ProductCard(
                                product = product,
                                onOpen = { onOpenProduct(product) },
                                onEdit = { editing = product },
                            )
                        }
                    }
                }
            }
        }

        GlassButton(
            text = "Добавить",
            icon = Icons.Default.Add,
            primary = true,
            onClick = { creating = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(end = 16.dp, bottom = BottomBarSpace),
        )
    }

    if (creating) {
        ProductEditorSheet(
            initial = null,
            knownCategories = data.products.map { it.category }.filter { it.isNotBlank() }.distinct(),
            onDismiss = { creating = false },
            onSave = { repo.upsertProduct(it); creating = false },
            onDelete = null,
        )
    }

    editing?.let { product ->
        ProductEditorSheet(
            initial = product,
            knownCategories = data.products.map { it.category }.filter { it.isNotBlank() }.distinct(),
            onDismiss = { editing = null },
            onSave = { repo.upsertProduct(it); editing = null },
            onDelete = { repo.deleteProduct(product.id); editing = null },
        )
    }
}

@Composable
private fun ProductCard(
    product: Product,
    onOpen: () -> Unit,
    onEdit: () -> Unit,
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        tint = Palette.glassTint(Palette.pastelFor(product.id), 0.30f),
        onClick = onOpen,
        contentPadding = 14.dp,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(52.dp)
                    .glass(shape = RoundedCornerShape(16.dp), alpha = 0.6f, elevation = 0.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(product.emoji, fontSize = 26.sp)
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    product.kind.ifBlank { product.category },
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Palette.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(3.dp))
                Text(
                    if (product.ingredients.isEmpty()) "Рецепт не заполнен"
                    else "${countOf(product.ingredients.size, "ингредиент", "ингредиента", "ингредиентов")} · ${product.gramsPerPortion.gramsPretty()} на порцию",
                    fontSize = 13.sp,
                    color = Palette.InkSoft,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(8.dp))
            GlassChip(text = "Изменить", selected = false, onClick = onEdit)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProductEditorSheet(
    initial: Product?,
    knownCategories: List<String>,
    onDismiss: () -> Unit,
    onSave: (Product) -> Unit,
    onDelete: (() -> Unit)?,
) {
    var category by remember { mutableStateOf(initial?.category ?: "") }
    var kind by remember { mutableStateOf(initial?.kind ?: "") }
    var emoji by remember { mutableStateOf(initial?.emoji ?: "🥣") }
    var note by remember { mutableStateOf(initial?.note ?: "") }
    var confirmDelete by remember { mutableStateOf(false) }

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
            SectionTitle(if (initial == null) "Новая продукция" else "Карточка продукции")
            Spacer(Modifier.height(16.dp))

            FieldLabel("Категория")
            Spacer(Modifier.height(6.dp))
            GlassField(
                value = category,
                onValueChange = { category = it },
                placeholder = "Кисель",
                modifier = Modifier.fillMaxWidth(),
            )
            if (knownCategories.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    knownCategories.forEach { c ->
                        GlassChip(text = c, selected = c == category, onClick = { category = c })
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            FieldLabel("Вид")
            Spacer(Modifier.height(6.dp))
            GlassField(
                value = kind,
                onValueChange = { kind = it },
                placeholder = "Смородиновый",
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(16.dp))
            FieldLabel("Значок")
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                EMOJIS.forEach { e ->
                    GlassChip(text = e, selected = e == emoji, onClick = { emoji = e })
                }
            }

            Spacer(Modifier.height(16.dp))
            FieldLabel("Как готовить")
            Spacer(Modifier.height(6.dp))
            GlassField(
                value = note,
                onValueChange = { note = it },
                placeholder = "Залить 200 мл кипятка, размешать",
                singleLine = false,
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(22.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GlassButton(
                    text = "Сохранить",
                    primary = true,
                    enabled = category.isNotBlank() || kind.isNotBlank(),
                    onClick = {
                        val base = initial ?: Product()
                        onSave(
                            base.copy(
                                category = category.trim(),
                                kind = kind.trim(),
                                emoji = emoji,
                                note = note.trim(),
                            )
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
                if (onDelete != null) {
                    GlassButton(
                        text = "Удалить",
                        danger = true,
                        onClick = { confirmDelete = true },
                    )
                }
            }
        }
    }

    if (confirmDelete && onDelete != null) {
        ConfirmDialog(
            title = "Удалить карточку?",
            message = "Вместе с ней исчезнут рецепт и все коробки этой продукции. Действие нельзя отменить.",
            confirmText = "Удалить",
            onConfirm = onDelete,
            onDismiss = { confirmDelete = false },
        )
    }
}
