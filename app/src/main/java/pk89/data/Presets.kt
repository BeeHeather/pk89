package pk89.data

/** Справочное значение г/ч.л. (чайная ложка без горки, приблизительно). Коэффициент можно править в рецепте. */
data class IngredientPreset(val name: String, val gramsPerTeaspoon: Double)

object Presets {
    val all: List<IngredientPreset> = listOf(
        IngredientPreset("Сахар", 5.0),
        IngredientPreset("Соль", 7.0),
        IngredientPreset("Крахмал картофельный", 6.0),
        IngredientPreset("Крахмал кукурузный", 5.0),
        IngredientPreset("Мука пшеничная", 4.0),
        IngredientPreset("Мука гороховая", 4.0),
        IngredientPreset("Горох колотый молотый", 5.0),
        IngredientPreset("Сухое молоко", 5.0),
        IngredientPreset("Сухие сливки", 4.0),
        IngredientPreset("Какао", 4.0),
        IngredientPreset("Лимонная кислота", 5.0),
        IngredientPreset("Ягодный порошок", 3.0),
        IngredientPreset("Сушёные овощи", 2.0),
        IngredientPreset("Сушёный лук", 2.0),
        IngredientPreset("Сушёная морковь", 2.0),
        IngredientPreset("Паприка", 3.0),
        IngredientPreset("Перец чёрный молотый", 3.0),
        IngredientPreset("Сухая зелень", 1.0),
        IngredientPreset("Бульонная основа", 5.0),
        IngredientPreset("Ванилин", 4.0),
    )

    fun find(name: String): IngredientPreset? =
        all.firstOrNull { it.name.equals(name.trim(), ignoreCase = true) }
}
