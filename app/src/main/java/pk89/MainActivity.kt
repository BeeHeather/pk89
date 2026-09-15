package pk89

import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import pk89.data.Repository
import pk89.ui.App
import pk89.ui.AppTheme
import pk89.ui.HardwareKeys

class MainActivity : ComponentActivity() {

    private lateinit var repo: Repository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        repo = Repository.get(this)
        setContent {
            AppTheme {
                App(repo)
            }
        }
    }

    /** Уходим в фон — дописываем то, что ещё не успело лечь на диск. */
    override fun onStop() {
        super.onStop()
        repo.flush()
    }

    /**
     * В режиме фасовки кнопки громкости работают счётчиком порций: телефон может лежать
     * рядом экраном вверх, а нажать физическую клавишу проще, чем попасть по стеклу.
     * Вне этого режима громкость ведёт себя как обычно.
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val code = event.keyCode
        if (code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN) {
            val handler = HardwareKeys.onVolumeKey
            if (handler != null) {
                if (event.action == KeyEvent.ACTION_DOWN) {
                    handler(code == KeyEvent.KEYCODE_VOLUME_UP)
                }
                // гасим и ACTION_UP, иначе система всё равно покажет ползунок громкости
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }
}
