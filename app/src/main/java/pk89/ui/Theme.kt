package pk89.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val Scheme = lightColorScheme(
    primary = Palette.Accent,
    onPrimary = Color.White,
    secondary = Palette.AccentDeep,
    onSecondary = Color.White,
    background = Palette.Base1,
    onBackground = Palette.Ink,
    surface = Color.White,
    onSurface = Palette.Ink,
    error = Palette.Danger,
    onError = Color.White,
)

/** Чуть крупнее системного: цех, руки заняты, на экран смотрят мельком. */
private val AppTypography = Typography().let { base ->
    base.copy(
        titleLarge = base.titleLarge.copy(fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Palette.Ink),
        titleMedium = base.titleMedium.copy(fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = Palette.Ink),
        bodyLarge = base.bodyLarge.copy(fontSize = 16.sp, color = Palette.Ink),
        bodyMedium = base.bodyMedium.copy(fontSize = 15.sp, color = Palette.Ink),
        labelLarge = base.labelLarge.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
    )
}

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = Scheme,
        typography = AppTypography,
    ) {
        CompositionLocalProvider(
            LocalContentColor provides Palette.Ink,
        ) {
            androidx.compose.material3.ProvideTextStyle(
                value = TextStyle(color = Palette.Ink, fontSize = 15.sp),
                content = content,
            )
        }
    }
}

/** Живой фон под всеми экранами. */
@Composable
fun AppBackground() {
    LiquidBackground(Modifier.fillMaxSize())
}
