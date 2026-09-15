package pk89.data

import android.content.Context
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

/**
 * Единственный источник данных приложения.
 *
 * Всё лежит в одном JSON-файле во внутренней памяти приложения. Запись атомарная (через .tmp)
 * и выполняется на фоновом потоке с коалесценцией: частые нажатия кликера в режиме фасовки
 * не превращаются в сотни обращений к диску.
 */
class Repository(private val file: File) {

    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val _data = MutableStateFlow(load())
    val data: StateFlow<AppData> get() = _data

    private val pending = AtomicReference<AppData?>(null)
    private val saver = Executors.newSingleThreadExecutor { r ->
        Thread(r, "pk89-saver").apply { isDaemon = true }
    }

    val dataFile: File get() = file

    // ---------- базовые операции ----------

    fun update(transform: (AppData) -> AppData) {
        val next = transform(_data.value)
        _data.value = next
        pending.set(next)
        saver.execute {
            val snapshot = pending.getAndSet(null) ?: return@execute
            writeNow(snapshot)
        }
    }

    /** Синхронно дописать последнее состояние. Вызывается, когда приложение уходит в фон. */
    fun flush() {
        val snapshot = pending.getAndSet(null) ?: return
        writeNow(snapshot)
    }

    // ---------- Рецептура ----------

    fun upsertProduct(product: Product) = update { d ->
        val exists = d.products.any { it.id == product.id }
        d.copy(
            products = if (exists) d.products.map { if (it.id == product.id) product else it }
            else d.products + product
        )
    }

    fun deleteProduct(productId: String) = update { d ->
        d.copy(
            products = d.products.filterNot { it.id == productId },
            boxes = d.boxes.filterNot { it.productId == productId },
        )
    }

    fun updateIngredients(productId: String, transform: (List<Ingredient>) -> List<Ingredient>) = update { d ->
        d.copy(products = d.products.map { p -> if (p.id == productId) p.copy(ingredients = transform(p.ingredients)) else p })
    }

    fun updateProductNote(productId: String, note: String) = update { d ->
        d.copy(products = d.products.map { p -> if (p.id == productId) p.copy(note = note) else p })
    }

    // ---------- фасовка ----------

    fun addBox(box: PackBox) = update { d -> d.copy(boxes = d.boxes + box) }

    fun updateBox(boxId: String, transform: (PackBox) -> PackBox) = update { d ->
        d.copy(boxes = d.boxes.map { if (it.id == boxId) transform(it) else it })
    }

    fun deleteBox(boxId: String) = update { d -> d.copy(boxes = d.boxes.filterNot { it.id == boxId }) }

    // ---------- финансы ----------

    fun addDonation(donation: Donation) = update { d -> d.copy(donations = d.donations + donation) }

    fun deleteDonation(donationId: String) = update { d ->
        d.copy(donations = d.donations.filterNot { it.id == donationId })
    }

    fun setCurrency(currency: String) = update { d -> d.copy(currency = currency) }

    // ---------- файл ----------

    private fun load(): AppData {
        if (!file.exists()) return SeedData.initial()
        return try {
            json.decodeFromString(AppData.serializer(), file.readText(Charsets.UTF_8))
        } catch (e: Exception) {
            Log.e(TAG, "Не удалось прочитать ${file.absolutePath}", e)
            runCatching {
                val backup = File(file.parentFile, "data.broken-${System.currentTimeMillis()}.json")
                file.renameTo(backup)
            }
            SeedData.initial()
        }
    }

    private fun writeNow(data: AppData) {
        try {
            file.parentFile?.mkdirs()
            val tmp = File(file.parentFile, file.name + ".tmp")
            tmp.writeText(json.encodeToString(AppData.serializer(), data), Charsets.UTF_8)
            if (!tmp.renameTo(file)) {
                // renameTo не перезаписывает на части файловых систем — падаем на копирование
                tmp.copyTo(file, overwrite = true)
                tmp.delete()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка сохранения ${file.absolutePath}", e)
        }
    }

    companion object {
        private const val TAG = "pk89.Repository"

        @Volatile
        private var instance: Repository? = null

        /** Один репозиторий на процесс: пересоздание при повороте экрана не теряет данные. */
        fun get(context: Context): Repository =
            instance ?: synchronized(this) {
                instance ?: Repository(File(context.applicationContext.filesDir, "data.json")).also { instance = it }
            }
    }
}
