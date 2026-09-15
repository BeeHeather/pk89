package pk89.export

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import pk89.data.Donation
import java.io.File

/**
 * На телефоне нет привычного «Сохранить как…», поэтому отчёт кладётся во внутренний кеш
 * и сразу уходит в системное меню «Поделиться»: почта, мессенджер, облако или «Сохранить в файлы».
 */
object ReportSharing {

    private const val MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    /** Готовит файл отчёта. Тяжёлую часть вызывающий код выполняет вне главного потока. */
    fun prepare(context: Context, donations: List<Donation>, currency: String): File {
        val dir = File(context.cacheDir, "reports")
        dir.mkdirs()
        // старые выгрузки не копим — каждый раз актуальная
        dir.listFiles()?.forEach { it.delete() }

        val target = File(dir, DonationReport.fileName())
        DonationReport.build(target, donations, currency)
        return target
    }

    fun shareIntent(context: Context, file: File): Intent {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = MIME
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Отчёт о пожертвованиях · ${DonationReport.ORGANIZATION}")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return Intent.createChooser(send, "Отправить отчёт").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }
}
