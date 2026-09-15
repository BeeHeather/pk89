package pk89.data

/** Примерные карточки, чтобы приложение не открывалось пустым. Значения ориентировочные — редактируются в рецепте. */
object SeedData {

    fun initial(): AppData = AppData(
        products = listOf(
            Product(
                category = "Кисель",
                kind = "Смородиновый",
                emoji = "🫐",
                note = "Залить 200 мл горячей воды, размешать, дать постоять 2 минуты.",
                ingredients = listOf(
                    Ingredient(name = "Крахмал картофельный", teaspoons = 2.0, gramsPerTeaspoon = 6.0),
                    Ingredient(name = "Сахар", teaspoons = 3.0, gramsPerTeaspoon = 5.0),
                    Ingredient(name = "Ягодный порошок (смородина)", teaspoons = 1.0, gramsPerTeaspoon = 3.0),
                    Ingredient(name = "Лимонная кислота", teaspoons = 0.25, gramsPerTeaspoon = 5.0),
                ),
            ),
            Product(
                category = "Кисель",
                kind = "Брусничный",
                emoji = "🍒",
                note = "Залить 200 мл горячей воды, размешать, дать постоять 2 минуты.",
                ingredients = listOf(
                    Ingredient(name = "Крахмал картофельный", teaspoons = 2.0, gramsPerTeaspoon = 6.0),
                    Ingredient(name = "Сахар", teaspoons = 3.5, gramsPerTeaspoon = 5.0),
                    Ingredient(name = "Ягодный порошок (брусника)", teaspoons = 1.0, gramsPerTeaspoon = 3.0),
                ),
            ),
            Product(
                category = "Суп",
                kind = "Гороховый",
                emoji = "🥣",
                note = "Залить 250 мл кипятка, накрыть, через 5 минут перемешать.",
                ingredients = listOf(
                    Ingredient(name = "Мука гороховая", teaspoons = 4.0, gramsPerTeaspoon = 4.0),
                    Ingredient(name = "Сушёные овощи", teaspoons = 1.0, gramsPerTeaspoon = 2.0),
                    Ingredient(name = "Сушёный лук", teaspoons = 1.0, gramsPerTeaspoon = 2.0),
                    Ingredient(name = "Бульонная основа", teaspoons = 1.0, gramsPerTeaspoon = 5.0),
                    Ingredient(name = "Соль", teaspoons = 0.5, gramsPerTeaspoon = 7.0),
                    Ingredient(name = "Сухая зелень", teaspoons = 0.5, gramsPerTeaspoon = 1.0),
                    Ingredient(name = "Паприка", teaspoons = 0.25, gramsPerTeaspoon = 3.0),
                    Ingredient(name = "Перец чёрный молотый", teaspoons = 0.25, gramsPerTeaspoon = 3.0),
                ),
            ),
        ),
    )
}
