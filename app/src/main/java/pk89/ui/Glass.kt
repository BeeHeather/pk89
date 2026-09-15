package pk89.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** Палитра приложения: тёмно-синие «чернила» на светлом стекле, один акцент. */
object Palette {
    val Ink = Color(0xFF1C2140)
    val InkSoft = Color(0xFF5C6284)
    val InkFaint = Color(0xFF9A9FBE)

    val Accent = Color(0xFF5B7CFA)
    val AccentDeep = Color(0xFF3F5FE0)

    val Mint = Color(0xFF8EE3CF)
    val Peach = Color(0xFFFFC6A5)
    val Sky = Color(0xFFA9D4FF)
    val Lilac = Color(0xFFCDB8FF)
    val Rose = Color(0xFFFFB8D1)
    val Lemon = Color(0xFFFFE9A3)

    val Success = Color(0xFF2FB37B)
    val Danger = Color(0xFFE4566B)

    val Base1 = Color(0xFFF1F3FB)
    val Base2 = Color(0xFFE2E7F6)

    private val pastels = listOf(Mint, Peach, Sky, Lilac, Rose, Lemon)

    /** Стабильный пастельный оттенок для карточки по её id. */
    fun pastelFor(key: String): Color = pastels[(key.hashCode() and 0x7fffffff) % pastels.size]

    /** Оттенок стекла: белое с лёгкой примесью пастели. */
    fun glassTint(pastel: Color, amount: Float = 0.35f): Color = lerp(Color.White, pastel, amount)
}

/**
 * «Жидкое стекло»: мягкая тень, полупрозрачная градиентная заливка,
 * блик в левом верхнем углу и светлая градиентная кромка.
 */
fun Modifier.glass(
    shape: Shape = RoundedCornerShape(24.dp),
    alpha: Float = 0.55f,
    elevation: Dp = 18.dp,
    tint: Color = Color.White,
): Modifier {
    val top = tint.copy(alpha = (alpha + 0.18f).coerceIn(0f, 1f))
    val bottom = tint.copy(alpha = (alpha - 0.08f).coerceIn(0f, 1f))
    return this
        .shadow(
            elevation = elevation,
            shape = shape,
            ambientColor = Palette.Ink.copy(alpha = 0.10f),
            spotColor = Palette.Ink.copy(alpha = 0.18f),
        )
        .clip(shape)
        .drawBehind {
            drawRect(Brush.verticalGradient(listOf(top, bottom)))
            if (size.width > 0f && size.height > 0f) {
                drawRect(
                    Brush.radialGradient(
                        colors = listOf(Color.White.copy(alpha = 0.55f), Color.White.copy(alpha = 0f)),
                        center = Offset(size.width * 0.18f, 0f),
                        radius = size.maxDimension * 0.75f,
                    ),
                )
            }
        }
        .border(
            BorderStroke(
                1.dp,
                Brush.linearGradient(
                    listOf(
                        Color.White.copy(alpha = 0.95f),
                        Color.White.copy(alpha = 0.25f),
                        Color.White.copy(alpha = 0.65f),
                    ),
                ),
            ),
            shape,
        )
}

private class Blob(
    val color: Color,
    val cx: Float,
    val cy: Float,
    val radius: Float,
    val ax: Float,
    val ay: Float,
    val phase: Float,
    val speed: Float,
)

/** Фон: медленно дрейфующие цветные пятна под стеклом. */
@Composable
fun LiquidBackground(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "liquid")
    val t by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(24_000, easing = LinearEasing), RepeatMode.Restart),
        label = "t",
    )
    val blobs = remember {
        listOf(
            Blob(Palette.Sky, 0.14f, 0.18f, 0.46f, 0.08f, 0.06f, 0.0f, 1f),
            Blob(Palette.Lilac, 0.86f, 0.14f, 0.40f, 0.06f, 0.09f, 2.1f, 1f),
            Blob(Palette.Mint, 0.78f, 0.86f, 0.44f, 0.09f, 0.05f, 4.2f, 1f),
            Blob(Palette.Peach, 0.18f, 0.92f, 0.38f, 0.07f, 0.08f, 1.3f, 2f),
            Blob(Palette.Rose, 0.52f, 0.52f, 0.30f, 0.10f, 0.10f, 3.0f, 1f),
        )
    }
    Canvas(modifier.fillMaxSize()) {
        drawRect(Brush.verticalGradient(listOf(Palette.Base1, Palette.Base2)))
        val angle = t * 2f * PI.toFloat()
        val minDim = size.minDimension
        if (minDim <= 0f) return@Canvas
        for (b in blobs) {
            val cx = (b.cx + b.ax * sin(angle * b.speed + b.phase)) * size.width
            val cy = (b.cy + b.ay * cos(angle * b.speed + b.phase)) * size.height
            val r = b.radius * minDim
            if (r <= 0f) continue
            val center = Offset(cx, cy)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(b.color.copy(alpha = 0.62f), b.color.copy(alpha = 0f)),
                    center = center,
                    radius = r,
                ),
                radius = r,
                center = center,
            )
        }
    }
}
