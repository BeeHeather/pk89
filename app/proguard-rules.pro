# kotlinx.serialization: сохраняем сгенерированные сериализаторы моделей
-keepclassmembers class pk89.data.** {
    *** Companion;
}
-keepclasseswithmembers class pk89.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
