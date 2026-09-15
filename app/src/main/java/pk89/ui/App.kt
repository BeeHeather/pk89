package pk89.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import pk89.data.Repository
import pk89.ui.finance.FinanceScreen
import pk89.ui.packing.PackingModeScreen
import pk89.ui.packing.PackingScreen
import pk89.ui.products.ProductsScreen
import pk89.ui.products.RecipeScreen

/** Куда уходят нажатия физических клавиш, когда открыт режим фасовки. */
object HardwareKeys {
    /** Возвращает true, если событие обработано. Параметр: нажата ли «громче». */
    var onVolumeKey: ((Boolean) -> Unit)? = null
}

enum class AppTab(val title: String) {
    Products("Рецептура"),
    Packing("Фасовка"),
    Finance("Финансы"),
}

@Composable
fun App(repo: Repository) {
    val data by repo.data.collectAsStateWithLifecycle()

    var tab by remember { mutableStateOf(AppTab.Products) }
    var openProductId by remember { mutableStateOf<String?>(null) }
    var activeBoxId by remember { mutableStateOf<String?>(null) }

    val openProduct = openProductId?.let { id -> data.products.firstOrNull { it.id == id } }
    val activeBox = activeBoxId?.let { id -> data.boxes.firstOrNull { it.id == id } }
    val activeBoxProduct = activeBox?.let { b -> data.products.firstOrNull { it.id == b.productId } }

    // карточку могли удалить, пока экран открыт
    LaunchedEffect(openProductId, openProduct) {
        if (openProductId != null && openProduct == null) openProductId = null
    }
    LaunchedEffect(activeBoxId, activeBox, activeBoxProduct) {
        if (activeBoxId != null && (activeBox == null || activeBoxProduct == null)) activeBoxId = null
    }

    Box(Modifier.fillMaxSize()) {
        AppBackground()

        when {
            activeBox != null && activeBoxProduct != null -> {
                BackHandler { activeBoxId = null }
                PackingModeScreen(
                    box = activeBox,
                    product = activeBoxProduct,
                    repo = repo,
                    onExit = { activeBoxId = null },
                )
            }

            openProduct != null -> {
                BackHandler { openProductId = null }
                RecipeScreen(
                    product = openProduct,
                    repo = repo,
                    onBack = { openProductId = null },
                )
            }

            else -> {
                BackHandler(enabled = tab != AppTab.Products) { tab = AppTab.Products }
                Box(Modifier.fillMaxSize()) {
                    AnimatedContent(
                        targetState = tab,
                        transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(140)) },
                        label = "tab",
                    ) { current ->
                        when (current) {
                            AppTab.Products -> ProductsScreen(
                                data = data,
                                repo = repo,
                                onOpenProduct = { openProductId = it.id },
                            )

                            AppTab.Packing -> PackingScreen(
                                data = data,
                                repo = repo,
                                onStartPacking = { activeBoxId = it.id },
                            )

                            AppTab.Finance -> FinanceScreen(data = data, repo = repo)
                        }
                    }

                    BottomTabs(
                        current = tab,
                        onSelect = { tab = it },
                        modifier = Modifier.align(Alignment.BottomCenter),
                    )
                }
            }
        }
    }
}

/** Нижняя панель: стеклянная плашка с подсвеченной активной вкладкой. */
@Composable
private fun BottomTabs(
    current: AppTab,
    onSelect: (AppTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .glass(shape = RoundedCornerShape(20.dp), alpha = 0.72f, elevation = 16.dp)
                .padding(5.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            AppTab.entries.forEach { entry ->
                val selected = entry == current
                Box(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (selected) Palette.Accent else Color.Transparent)
                        .clickable { onSelect(entry) }
                        .heightIn(min = 48.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    androidx.compose.material3.Text(
                        entry.title,
                        color = if (selected) Color.White else Palette.InkSoft,
                        fontSize = 14.sp,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                    )
                }
            }
        }
    }
}

/** Высота нижней панели: экраны добавляют её как отступ снизу, чтобы список не уезжал под плашку. */
val BottomBarSpace = 96.dp
