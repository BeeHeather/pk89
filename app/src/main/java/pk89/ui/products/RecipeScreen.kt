package pk89.ui.products

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import pk89.data.Ingredient
import pk89.data.Presets
import pk89.data.Product
import pk89.data.Repository
import pk89.data.gramsPretty
import pk89.data.newId
import pk89.data.pretty
import pk89.ui.BatchCalculatorCard
import pk89.ui.ConfirmDialog
import pk89.ui.FieldLabel
import pk89.ui.GlassButton
import pk89.ui.GlassCard
import pk89.ui.GlassChip
import pk89.ui.GlassField
import pk89.ui.GlassIconButton
import pk89.ui.GlassSheet
import pk89.ui.Hint
import pk89.ui.Palette
import pk89.ui.PortionSummaryCard
import pk89.ui.ScreenHeader
import pk89.ui.SectionTitle
import pk89.ui.StepperRow
import pk89.ui.glass

@Composable
fun RecipeScreen(
    product: Product,
    repo: Repository,
    onBack: () -> Unit,
) {
    var editing by remember { mutableStateOf<Ingredient?>(null) }
    var adding by remember { mutableStateOf(false) }
    var editingNote by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize()) {
        ScreenHeader(
            title = product.kind.ifBlank { product.category },
            subtitle = product.category.takeIf { it.isNotBlank() && product.kind.isNotBlank() },
            leading = {
                GlassIconButton(
                    icon = Icons.AutoMirrored.Filled.ArrowBack,
                    onClick = onBack,
                    description = "Назад",
                )
            },
            actions = {
                Box(
                    Modifier
                        .size(44.dp)
                        .glass(shape = RoundedCornerShape(14.dp), alpha = 0.6f, elevation = 0.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(product.emoji, fontSize = 22.sp)
                }
            },
        )

        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.navigationBarsPadding(),
        ) {
            item(key = "summary") {
                PortionSummaryCard(product)
            }

            item(key = "recipe-title") {
                Row(
                    Modifier.fillMaxWidth().padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SectionTitle("Рецепт на одну порцию", Modifier.weight(1f))
                    GlassIconButton(
                        icon = Icons.Default.Add,
                        onClick = { adding = true },
                        tint = Palette.Accent,
                        description = "Добавить ингредиент",
                    )
                }
            }

            if (product.ingredients.isEmpty()) {
                item(key = "recipe-empty") {
                    GlassCard(Modifier.fillMaxWidth()) {
                        Hint("Рецепт пока пуст. Нажмите «плюс» и добавьте первый ингредиент — количество указывается в чайных ложках, граммы посчитаются сами.")
                    }
                }
            } else {
                items(product.ingredients, key = { it.id }) { ingredient ->
                    IngredientCard(ingredient = ingredient, onClick = { editing = ingredient })
                }
            }

            item(key = "batch") {
                Spacer(Modifier.height(4.dp))
                BatchCalculatorCard(product)
            }

            item(key = "note") {
                GlassCard(Modifier.fillMaxWidth(), onClick = { editingNote = true }) {
                    SectionTitle("Как готовить")
                    Spacer(Modifier.height(6.dp))
                    Hint(
                        product.note.ifBlank { "Нажмите, чтобы добавить описание приготовления." },
                        color = if (product.note.isBlank()) Palette.InkFaint else Palette.InkSoft,
                    )
                }
            }
        }
    }

    if (adding) {
        IngredientSheet(
            initial = null,
            onDismiss = { adding = false },
            onSave = { updated ->
                repo.updateIngredients(product.id) { it + updated }
                adding = false
            },
            onDelete = null,
        )
    }

    editing?.let { ingredient ->
        IngredientSheet(
            initial = ingredient,
            onDismiss = { editing = null },
            onSave = { updated ->
                repo.updateIngredients(product.id) { list ->
                    list.map { if (it.id == updated.id) updated else it }
                }
                editing = null
            },
            onDelete = {
                repo.updateIngredients(product.id) { list -> list.filterNot { it.id == ingredient.id } }
                editing = null
            },
        )
    }

    if (editingNote) {
        NoteSheet(
            initial = product.note,
            onDismiss = { editingNote = false },
            onSave = {
                repo.updateProductNote(product.id, it)
                editingNote = false
            },
        )
    }
}

@Composable
private fun IngredientCard(ingredient: Ingredient, onClick: () -> Unit) {
    GlassCard(
        Modifier.fillMaxWidth(),
        contentPadding = 14.dp,
        shape = RoundedCornerShape(18.dp),
        onClick = onClick,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    ingredient.name.ifBlank { "Без названия" },
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Palette.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(3.dp))
                Text(
                    "${ingredient.teaspoons.pretty(2)} ч. л.  ·  ${ingredient.gramsPerTeaspoon.pretty(1)} г в ложке",
                    fontSize = 13.sp,
                    color = Palette.InkSoft,
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                ingredient.grams.gramsPretty(),
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Palette.Accent,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IngredientSheet(
    initial: Ingredient?,
    onDismiss: () -> Unit,
    onSave: (Ingredient) -> Unit,
    onDelete: (() -> Unit)?,
) {
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var teaspoons by remember { mutableStateOf(initial?.teaspoons ?: 1.0) }
    var gramsPerTeaspoon by remember { mutableStateOf(initial?.gramsPerTeaspoon ?: 5.0) }
    var confirmDelete by remember { mutableStateOf(false) }

    val suggestions = remember(name) {
        val query = name.trim().lowercase()
        if (query.isEmpty()) Presets.all.take(6)
        else Presets.all.filter { it.name.lowercase().contains(query) }.take(6)
    }

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
            SectionTitle(if (initial == null) "Новый ингредиент" else "Ингредиент")
            Spacer(Modifier.height(16.dp))

            FieldLabel("Название")
            Spacer(Modifier.height(6.dp))
            GlassField(
                value = name,
                onValueChange = { name = it },
                placeholder = "Сахар",
                modifier = Modifier.fillMaxWidth(),
            )

            if (suggestions.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    suggestions.forEach { preset ->
                        GlassChip(
                            text = preset.name,
                            selected = preset.name.equals(name.trim(), ignoreCase = true),
                            onClick = {
                                name = preset.name
                                gramsPerTeaspoon = preset.gramsPerTeaspoon
                            },
                        )
                    }
                }
            }

            Spacer(Modifier.height(18.dp))
            FieldLabel("Чайных ложек на порцию")
            Spacer(Modifier.height(6.dp))
            StepperRow(
                value = teaspoons,
                onValueChange = { teaspoons = it },
                step = 0.25,
                suffix = "ч. л.",
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(18.dp))
            FieldLabel("Грамм в одной чайной ложке")
            Spacer(Modifier.height(6.dp))
            StepperRow(
                value = gramsPerTeaspoon,
                onValueChange = { gramsPerTeaspoon = it },
                step = 0.5,
                suffix = "г",
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(6.dp))
            Hint("Значение справочное. Взвесьте свою ложку один раз и поставьте точное число.")

            Spacer(Modifier.height(18.dp))
            GlassCard(Modifier.fillMaxWidth(), tint = Palette.glassTint(Palette.Mint, 0.4f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Выходит на порцию", Modifier.weight(1f), fontSize = 15.sp, color = Palette.Ink)
                    Text(
                        (teaspoons * gramsPerTeaspoon).gramsPretty(),
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Palette.Ink,
                    )
                }
            }

            Spacer(Modifier.height(22.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GlassButton(
                    text = "Сохранить",
                    primary = true,
                    enabled = name.isNotBlank(),
                    onClick = {
                        onSave(
                            Ingredient(
                                id = initial?.id ?: newId(),
                                name = name.trim(),
                                teaspoons = teaspoons,
                                gramsPerTeaspoon = gramsPerTeaspoon,
                            )
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
                if (onDelete != null) {
                    GlassButton(text = "Удалить", danger = true, onClick = { confirmDelete = true })
                }
            }
        }
    }

    if (confirmDelete && onDelete != null) {
        ConfirmDialog(
            title = "Убрать ингредиент?",
            message = "Строка исчезнет из рецепта и из расчёта партии.",
            confirmText = "Убрать",
            onConfirm = onDelete,
            onDismiss = { confirmDelete = false },
        )
    }
}

@Composable
private fun NoteSheet(
    initial: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    var note by remember { mutableStateOf(initial) }

    GlassSheet(onDismiss = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
        ) {
            SectionTitle("Как готовить")
            Spacer(Modifier.height(14.dp))
            GlassField(
                value = note,
                onValueChange = { note = it },
                placeholder = "Залить 200 мл кипятка, размешать, дать постоять 2 минуты",
                singleLine = false,
                minLines = 4,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(20.dp))
            GlassButton(
                text = "Сохранить",
                primary = true,
                onClick = { onSave(note.trim()) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
