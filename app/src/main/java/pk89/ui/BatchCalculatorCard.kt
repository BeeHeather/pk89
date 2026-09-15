package pk89.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pk89.data.Product
import pk89.data.gramsPretty
import pk89.data.plural
import pk89.data.pretty

/**
 * «Сколько всего сыпать на партию»: количество порций умножается на рецепт,
 * каждая строка показана и в ложках, и в граммах.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BatchCalculatorCard(
    product: Product,
    modifier: Modifier = Modifier,
    title: String = "Расчёт партии",
    initialPortions: Int = 30,
) {
    var portions by remember(product.id) { mutableIntStateOf(initialPortions) }

    GlassCard(modifier.fillMaxWidth(), contentPadding = 16.dp) {
        SectionTitle(title)
        Spacer(Modifier.height(4.dp))
        Hint("Укажите, сколько порций готовите — пересчитаю весь рецепт.")

        Spacer(Modifier.height(14.dp))
        IntField(
            value = portions,
            onValueChange = { portions = it },
            suffix = plural(portions, "порция", "порции", "порций"),
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(10.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(10, 20, 30, 50, 100).forEach { n ->
                GlassChip(text = n.toString(), selected = n == portions, onClick = { portions = n })
            }
        }

        if (product.ingredients.isEmpty()) {
            Spacer(Modifier.height(14.dp))
            Hint("Рецепт пока пуст — добавьте ингредиенты, и здесь появится расход.")
            return@GlassCard
        }

        Spacer(Modifier.height(16.dp))
        product.ingredients.forEach { ingredient ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    ingredient.name.ifBlank { "Без названия" },
                    modifier = Modifier.weight(1f),
                    fontSize = 14.sp,
                    color = Palette.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    "${(ingredient.teaspoons * portions).pretty(1)} ч. л.",
                    fontSize = 13.sp,
                    color = Palette.InkSoft,
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    (ingredient.grams * portions).gramsPretty(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Palette.Ink,
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Всего смеси", modifier = Modifier.weight(1f), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Palette.Ink)
            Text(
                (product.gramsPerPortion * portions).gramsPretty(),
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = Palette.Accent,
            )
        }
    }
}

/** Сводка на одну порцию. */
@Composable
fun PortionSummaryCard(product: Product, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatTile(
            label = "Вес порции",
            value = product.gramsPerPortion.gramsPretty(),
            modifier = Modifier.weight(1f),
            tint = Palette.glassTint(Palette.Mint, 0.45f),
        )
        StatTile(
            label = "Всего ложек",
            value = product.teaspoonsPerPortion.pretty(2),
            modifier = Modifier.weight(1f),
            tint = Palette.glassTint(Palette.Sky, 0.45f),
        )
        StatTile(
            label = "Ингредиентов",
            value = product.ingredients.size.toString(),
            modifier = Modifier.weight(1f),
            tint = Palette.glassTint(Palette.Lilac, 0.45f),
        )
    }
}
