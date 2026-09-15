// Справочные г/ч. л. — чайная ложка без горки, приблизительно.
// Коэффициент правится прямо в рецепте, здесь только стартовое значение.

export const PRESETS = [
  { name: 'Сахар', gramsPerTeaspoon: 5 },
  { name: 'Соль', gramsPerTeaspoon: 7 },
  { name: 'Крахмал картофельный', gramsPerTeaspoon: 6 },
  { name: 'Крахмал кукурузный', gramsPerTeaspoon: 5 },
  { name: 'Мука пшеничная', gramsPerTeaspoon: 4 },
  { name: 'Мука гороховая', gramsPerTeaspoon: 4 },
  { name: 'Горох колотый молотый', gramsPerTeaspoon: 5 },
  { name: 'Сухое молоко', gramsPerTeaspoon: 5 },
  { name: 'Сухие сливки', gramsPerTeaspoon: 4 },
  { name: 'Какао', gramsPerTeaspoon: 4 },
  { name: 'Лимонная кислота', gramsPerTeaspoon: 5 },
  { name: 'Ягодный порошок', gramsPerTeaspoon: 3 },
  { name: 'Сушёные овощи', gramsPerTeaspoon: 2 },
  { name: 'Сушёный лук', gramsPerTeaspoon: 2 },
  { name: 'Сушёная морковь', gramsPerTeaspoon: 2 },
  { name: 'Паприка', gramsPerTeaspoon: 3 },
  { name: 'Перец чёрный молотый', gramsPerTeaspoon: 3 },
  { name: 'Сухая зелень', gramsPerTeaspoon: 1 },
  { name: 'Бульонная основа', gramsPerTeaspoon: 5 },
  { name: 'Ванилин', gramsPerTeaspoon: 4 },
];

export const DEFAULT_GRAMS_PER_TSP = 5;

export const EMOJIS = ['🥣', '🫐', '🍒', '🍓', '🍎', '🌾', '🥔', '🧅', '🥕', '🌽', '🍲', '☕', '🍵', '🍫', '🥛', '🧂'];

export function findPreset(name) {
  const needle = (name || '').trim().toLowerCase();
  return PRESETS.find((p) => p.name.toLowerCase() === needle) || null;
}
