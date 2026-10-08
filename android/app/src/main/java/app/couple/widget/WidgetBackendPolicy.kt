package app.couple.widget

import java.net.URI

internal object WidgetBackendPolicy {
    fun allows(rawUrl: String, debug: Boolean): Boolean = runCatching {
        val uri = URI(rawUrl)
        uri.rawUserInfo == null && uri.host != null && (
            uri.scheme == "https" ||
                (debug && uri.scheme == "http" && uri.host == "10.0.2.2" && uri.port == 54321 && uri.rawPath.isNullOrEmpty())
            )
    }.getOrDefault(false)
}
