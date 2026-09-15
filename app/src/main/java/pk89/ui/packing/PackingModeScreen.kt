package pk89.ui.packing

import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pk89.data.PackBox
import pk89.data.Product
import pk89.data.Repository
import pk89.data.plural
import pk89.ui.ConfirmDialog
import pk89.ui.GlassButton
import pk89.ui.GlassIconButton
import pk89.ui.HardwareKeys
import pk89.ui.Palette
import pk89.ui.ScreenHeader
import pk89.ui.StatTile
import pk89.ui.StatusPill

@Composable
fun PackingModeScreen(
    box: PackBox,
    product: Product,
    repo: Repository,
    onExit: () -> Unit,
) {
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val bump = remember { Animatable(1f) }
    var lastKeyAt by remember { mutableLongStateOf(0L) }
    var confirmClose by remember { mutableStateOf(false) }

    fun tick(delta: Int) {
        if (delta > 0) {
            view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        }
        repo.updateBox(box.id) {
            it.copy(packedPortions = (it.packedPortions + delta).coerceAtLeast(0))
        }
        scope.launch {
            bump.snapTo(if (delta > 0) 0.94f else 1.04f)
            bump.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))
        }
    }

    // экран не гаснет, пока идёт фасовка
    DisposableEffect(Unit) {
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = false }
    }

    // кнопки громкости становятся счётчиком
    DisposableEffect(box.id) {
        HardwareKeys.onVolumeKey = { up ->
            val now = System.currentTimeMillis()
            if (now - lastKeyAt > 90) {
                lastKeyAt = now
                tick(if (up) 1 else -1)
            }
        }
        onDispose { HardwareKeys.onVolumeKey = null }
    }

    val statusText: String
    val statusColor: Color
    when {
        box.isClosed -> { statusText = "Закрыта"; statusColor = Palette.InkSoft }
        box.isFull -> { statusText = "Норма собрана"; statusColor = Palette.Success }
        else -> { statusText = "В работе"; statusColor = Palette.Accent }
    }

    Column(
        Modifier
            .fillMaxSize()
            .navigationBarsPadding(),
    ) {
        ScreenHeader(
            title = box.label.ifBlank { "Коробка" },
            subtitle = "${product.emoji}  ${product.kind.ifBlank { product.category }}",
            leading = {
                GlassIconButton(
                    icon = Icons.AutoMirrored.Filled.ArrowBack,
                    onClick = onExit,
                    description = "Выйти из режима фасовки",
                )
            },
            actions = { StatusPill(statusText, statusColor) },
        )

        Box(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 28.dp),
            contentAlignment = Alignment.Center,
        ) {
            Clicker(
                packed = box.packedPortions,
                target = box.targetPortions,
                progress = box.progress,
                scale = bump.value,
                full = box.isFull,
                onClick = { tick(1) },
            )
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            StatTile(
                label = "Осталось",
                value = box.remaining.toString(),
                modifier = Modifier.weight(1f),
                tint = Palette.glassTint(Palette.Peach, 0.45f),
            )
            StatTile(
                label = "Собрано",
                value = box.packedPortions.toString(),
                modifier = Modifier.weight(1f),
                tint = Palette.glassTint(Palette.Mint, 0.45f),
            )
            StatTile(
                label = "Готовность",
                value = "${(box.progress * 100).toInt()}%",
                modifier = Modifier.weight(1f),
                tint = Palette.glassTint(Palette.Sky, 0.45f),
            )
        }

        Spacer(Modifier.height(14.dp))

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            GlassButton(
                text = "−1 порция",
                onClick = { tick(-1) },
                enabled = box.packedPortions > 0,
                modifier = Modifier.weight(1f),
            )
            GlassButton(
                text = "Закрыть коробку",
                primary = true,
                onClick = { confirmClose = true },
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(10.dp))
        Text(
            "Кнопки громкости тоже считают: «громче» — плюс порция, «тише» — минус. Экран не погаснет.",
            Modifier.fillMaxWidth().padding(horizontal = 24.dp),
            fontSize = 12.sp,
            color = Palette.InkSoft,
            textAlign = TextAlign.Center,
            lineHeight = 17.sp,
        )
        Spacer(Modifier.height(16.dp))
    }

    if (confirmClose) {
        ConfirmDialog(
            title = "Закрыть коробку?",
            message = "Собрано ${box.packedPortions} из ${box.targetPortions}. Коробка пометится закрытой, её можно будет открыть снова.",
            confirmText = "Закрыть",
            onConfirm = {
                repo.updateBox(box.id) { it.copy(closedAt = System.currentTimeMillis()) }
                onExit()
            },
            onDismiss = { confirmClose = false },
        )
    }
}

@Composable
private fun Clicker(
    packed: Int,
    target: Int,
    progress: Float,
    scale: Float,
    full: Boolean,
    onClick: () -> Unit,
) {
    val animatedProgress by animateFloatAsState(progress, tween(260), label = "ring")
    val ringColor = if (full) Palette.Success else Palette.Accent
    val interaction = remember { MutableInteractionSource() }

    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .scale(scale),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = size.minDimension * 0.055f
            val inset = stroke / 2f
            val arcSize = Size(size.width - stroke, size.height - stroke)

            drawArc(
                color = Palette.Ink.copy(alpha = 0.08f),
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
            if (animatedProgress > 0f) {
                drawArc(
                    color = ringColor,
                    startAngle = -90f,
                    sweepAngle = 360f * animatedProgress.coerceIn(0f, 1f),
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }
        }

        Box(
            Modifier
                .fillMaxSize()
                .padding(22.dp)
                .clip(CircleShape)
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color.White.copy(alpha = 0.92f),
                            Color.White.copy(alpha = 0.72f),
                        )
                    )
                )
                .clickable(interactionSource = interaction, indication = null, onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    packed.toString(),
                    fontSize = 76.sp,
                    fontWeight = FontWeight.Bold,
                    color = Palette.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Clip,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    "из $target ${plural(target, "порции", "порций", "порций")}",
                    fontSize = 15.sp,
                    color = Palette.InkSoft,
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    if (full) "Норма собрана" else "Нажмите — плюс порция",
                    fontSize = 13.sp,
                    color = if (full) Palette.Success else Palette.InkFaint,
                )
            }
        }
    }
}
