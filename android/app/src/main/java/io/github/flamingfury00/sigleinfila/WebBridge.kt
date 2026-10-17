package io.github.flamingfury00.sigleinfila

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface

/**
 * Native helpers exposed to the web app as `window.SigleBridge` (see src/lib/platform.ts).
 * Every method is invoked on a WebView background thread.
 */
class WebBridge(private val activity: MainActivity) {

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    @JavascriptInterface
    fun vibrate(ms: Int) {
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        val duration = ms.coerceIn(1, 1000).toLong()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(duration)
        }
    }

    /** Pattern as comma separated milliseconds: on, off, on, ... */
    @JavascriptInterface
    fun vibratePattern(pattern: String) {
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        val steps = pattern.split(',').mapNotNull { it.trim().toLongOrNull()?.coerceIn(0, 1000) }.take(16)
        if (steps.isEmpty()) return
        // Android patterns start with an initial delay.
        val timings = longArrayOf(0) + steps.toLongArray()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createWaveform(timings, -1))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(timings, -1)
        }
    }

    @JavascriptInterface
    fun keepScreenOn(on: Boolean) = activity.setKeepScreenOn(on)

    @JavascriptInterface
    fun openExternal(url: String) = activity.openExternal(url)

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME
}
