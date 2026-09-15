package pk89.data

import kotlinx.serialization.Serializable
import java.util.UUID

fun newId(): String = UUID.randomUUID().toString()

/** Пункт рецепта. Заполняется в чайных ложках, граммы считаются через коэффициент г/ч.л. */
@Serializable
data class Ingredient(
    val id: String = newId(),
    val name: String = "",
    val teaspoons: Double = 1.0,
    val gramsPerTeaspoon: Double = 5.0,
) {
    val grams: Double get() = teaspoons * gramsPerTeaspoon
}

/**
 * Карточка продукции. `category` — общее название (Кисель, Суп гороховый),
 * `kind` — разновидность (Смородиновый, Брусничный). Рецепт указан на одну порцию.
 */
@Serializable
data class Product(
    val id: String = newId(),
    val category: String = "",
    val kind: String = "",
    val emoji: String = "🥣",
    val note: String = "",
    val ingredients: List<Ingredient> = emptyList(),
) {
    val title: String get() = listOf(category, kind).filter { it.isNotBlank() }.joinToString(" ")
    val teaspoonsPerPortion: Double get() = ingredients.sumOf { it.teaspoons }
    val gramsPerPortion: Double get() = ingredients.sumOf { it.grams }
}

/** Коробка на фасовке: план по порциям и фактически упаковано. */
@Serializable
data class PackBox(
    val id: String = newId(),
    val productId: String,
    val label: String = "",
    val targetPortions: Int = 50,
    val packedPortions: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val closedAt: Long? = null,
) {
    val isClosed: Boolean get() = closedAt != null
    val isFull: Boolean get() = targetPortions > 0 && packedPortions >= targetPortions
    val remaining: Int get() = (targetPortions - packedPortions).coerceAtLeast(0)
    val progress: Float
        get() = if (targetPortions <= 0) 0f else (packedPortions.toFloat() / targetPortions).coerceIn(0f, 1f)
}

/** Пожертвование. Дата хранится в ISO-формате (yyyy-MM-dd). */
@Serializable
data class Donation(
    val id: String = newId(),
    val donor: String = "",
    val amount: Double = 0.0,
    val date: String = "",
    val note: String = "",
    val createdAt: Long = System.currentTimeMillis(),
)

@Serializable
data class AppData(
    val products: List<Product> = emptyList(),
    val boxes: List<PackBox> = emptyList(),
    val donations: List<Donation> = emptyList(),
    val currency: String = "₸",
)

val CURRENCIES: List<String> = listOf("₸", "₽", "$", "€", "сом", "₴")
