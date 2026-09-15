package pk89.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pk89.data.pretty
import pk89.data.toRuDoubleOrNull

// ---------- контейнеры ----------

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    tint: Color = Color.White,
    shape: Shape = RoundedCornerShape(22.dp),
    contentPadding: Dp = 16.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val base = modifier.glass(shape = shape, alpha = 0.58f, elevation = 10.dp, tint = tint)
    val clickable = if (onClick != null) base.clickable(onClick = onClick) else base
    Column(clickable.padding(contentPadding), content = content)
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = modifier,
        fontSize = 17.sp,
        fontWeight = FontWeight.Bold,
        color = Palette.Ink,
    )
}

@Composable
fun FieldLabel(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier = modifier, fontSize = 13.sp, color = Palette.InkSoft)
}

@Composable
fun Hint(text: String, modifier: Modifier = Modifier, color: Color = Palette.InkSoft) {
    Text(text, modifier = modifier, fontSize = 13.sp, color = color, lineHeight = 18.sp)
}

// ---------- кнопки ----------

@Composable
fun GlassButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    primary: Boolean = false,
    danger: Boolean = false,
    enabled: Boolean = true,
    icon: ImageVector? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, spring(), label = "press")

    val container = when {
        !enabled -> Palette.InkFaint.copy(alpha = 0.22f)
        danger -> Palette.Danger
        primary -> Palette.Accent
        else -> Color.White.copy(alpha = 0.72f)
    }
    val content = when {
        !enabled -> Palette.InkFaint
        danger || primary -> Color.White
        else -> Palette.Ink
    }
    val background by animateColorAsState(container, label = "bg")

    Row(
        modifier
            .scale(scale)
            .clip(RoundedCornerShape(16.dp))
            .background(background)
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                onClick = onClick,
            )
            .heightIn(min = 52.dp)
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))
        }
        Text(text, color = content, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun GlassIconButton(
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = Palette.InkSoft,
    description: String? = null,
    size: Dp = 44.dp,
) {
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(Color.White.copy(alpha = 0.66f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = description, tint = tint, modifier = Modifier.size(size * 0.46f))
    }
}

@Composable
fun GlassChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val background by animateColorAsState(
        if (selected) Palette.Accent else Color.White.copy(alpha = 0.66f),
        label = "chip",
    )
    Box(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(background)
            .clickable(onClick = onClick)
            .heightIn(min = 40.dp)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            color = if (selected) Color.White else Palette.Ink,
            fontSize = 14.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

// ---------- поля ввода ----------

@Composable
fun GlassField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    minLines: Int = 1,
    textAlign: TextAlign = TextAlign.Start,
    suffix: String? = null,
    enabled: Boolean = true,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.78f))
            .heightIn(min = 52.dp)
            .padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty() && placeholder.isNotEmpty()) {
                Text(placeholder, color = Palette.InkFaint, fontSize = 15.sp, textAlign = textAlign)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                singleLine = singleLine,
                minLines = minLines,
                textStyle = androidx.compose.ui.text.TextStyle(
                    color = Palette.Ink,
                    fontSize = 15.sp,
                    textAlign = textAlign,
                ),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                cursorBrush = androidx.compose.ui.graphics.SolidColor(Palette.Accent),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (suffix != null) {
            Spacer(Modifier.width(8.dp))
            Text(suffix, color = Palette.InkSoft, fontSize = 14.sp)
        }
        if (trailing != null) {
            Spacer(Modifier.width(4.dp))
            trailing()
        }
    }
}

/**
 * Дробное поле (чайные ложки, граммы, суммы). Держит собственный текст, чтобы
 * «0,» и «1,5» набирались без рывков, и отдаёт число наружу по мере ввода.
 */
@Composable
fun DecimalField(
    value: Double,
    onValueChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "0",
    suffix: String? = null,
    textAlign: TextAlign = TextAlign.Start,
) {
    var text by remember { mutableStateOf(value.pretty(3)) }
    LaunchedEffect(value) {
        if (text.toRuDoubleOrNull() != value) text = value.pretty(3)
    }
    GlassField(
        value = text,
        onValueChange = { raw ->
            text = raw
            raw.toRuDoubleOrNull()?.let(onValueChange)
        },
        modifier = modifier,
        placeholder = placeholder,
        keyboardType = KeyboardType.Decimal,
        suffix = suffix,
        textAlign = textAlign,
    )
}

@Composable
fun IntField(
    value: Int,
    onValueChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "0",
    suffix: String? = null,
    textAlign: TextAlign = TextAlign.Start,
) {
    var text by remember { mutableStateOf(value.toString()) }
    LaunchedEffect(value) {
        if (text.toIntOrNull() != value) text = value.toString()
    }
    GlassField(
        value = text,
        onValueChange = { raw ->
            val digits = raw.filter { it.isDigit() }.take(6)
            text = digits
            digits.toIntOrNull()?.let(onValueChange)
        },
        modifier = modifier,
        placeholder = placeholder,
        keyboardType = KeyboardType.Number,
        suffix = suffix,
        textAlign = textAlign,
    )
}

/** Поле с кнопками −/+ по бокам: попасть пальцем проще, чем в цифровую клавиатуру. */
@Composable
fun StepperRow(
    value: Double,
    onValueChange: (Double) -> Unit,
    step: Double,
    modifier: Modifier = Modifier,
    suffix: String? = null,
    min: Double = 0.0,
) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        StepperButton("−") { onValueChange((value - step).coerceAtLeast(min)) }
        Spacer(Modifier.width(10.dp))
        DecimalField(
            value = value,
            onValueChange = { onValueChange(it.coerceAtLeast(min)) },
            modifier = Modifier.weight(1f),
            suffix = suffix,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.width(10.dp))
        StepperButton("+") { onValueChange(value + step) }
    }
}

@Composable
private fun StepperButton(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(52.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.8f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Palette.Accent)
    }
}

// ---------- индикаторы ----------

@Composable
fun GlassProgress(
    progress: Float,
    modifier: Modifier = Modifier,
    height: Dp = 10.dp,
    color: Color = Palette.Accent,
) {
    val animated by animateFloatAsState(progress.coerceIn(0f, 1f), label = "progress")
    Box(
        modifier
            .fillMaxWidth()
            .height(height)
            .clip(CircleShape)
            .background(Palette.Ink.copy(alpha = 0.10f)),
    ) {
        Box(
            Modifier
                .fillMaxWidth(animated)
                .height(height)
                .clip(CircleShape)
                .background(color),
        )
    }
}

@Composable
fun StatusPill(text: String, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(color.copy(alpha = 0.16f))
            .padding(horizontal = 10.dp, vertical = 5.dp),
    ) {
        Text(text, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun StatTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    tint: Color = Color.White,
) {
    GlassCard(modifier, tint = tint, shape = RoundedCornerShape(16.dp), contentPadding = 14.dp) {
        Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Palette.Ink, maxLines = 1)
        Spacer(Modifier.height(2.dp))
        Text(label, fontSize = 12.sp, color = Palette.InkSoft, maxLines = 2)
    }
}

@Composable
fun EmptyState(
    emoji: String,
    title: String,
    hint: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier.fillMaxWidth().padding(vertical = 48.dp, horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(emoji, fontSize = 46.sp)
        Spacer(Modifier.height(12.dp))
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Palette.Ink, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(hint, fontSize = 14.sp, color = Palette.InkSoft, textAlign = TextAlign.Center, lineHeight = 20.sp)
    }
}

// ---------- диалоги и панели ----------

/**
 * Выдвижная панель снизу. Состояние создаётся внутри: экспериментальный SheetState
 * в публичной сигнатуре заставил бы каждый вызывающий файл писать свой @OptIn.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlassSheet(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Palette.Base1,
        contentColor = Palette.Ink,
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
        modifier = modifier,
        content = content,
    )
}

@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmText: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Palette.Base1,
        titleContentColor = Palette.Ink,
        textContentColor = Palette.InkSoft,
        shape = RoundedCornerShape(24.dp),
        title = { Text(title, fontWeight = FontWeight.Bold) },
        text = { Text(message, lineHeight = 20.sp) },
        confirmButton = {
            TextButton(onClick = { onConfirm(); onDismiss() }) {
                Text(confirmText, color = Palette.Danger, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Отмена", color = Palette.InkSoft)
            }
        },
    )
}

// ---------- шапка экрана ----------

@Composable
fun ScreenHeader(
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
    leading: @Composable (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Row(
        modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            leading()
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(
                title,
                fontSize = 23.sp,
                fontWeight = FontWeight.Bold,
                color = Palette.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (subtitle != null) {
                Spacer(Modifier.height(2.dp))
                Text(
                    subtitle,
                    fontSize = 13.sp,
                    color = Palette.InkSoft,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        actions()
    }
}

// ---------- мелочи компоновки ----------

@Composable
fun RowScope.Gap(width: Dp) = Spacer(Modifier.width(width))

@Composable
fun ColumnScope.Gap(height: Dp) = Spacer(Modifier.height(height))
