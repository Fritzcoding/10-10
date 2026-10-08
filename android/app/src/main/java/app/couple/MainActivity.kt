package app.couple

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.ValueCallback
import android.util.Log
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import app.couple.widget.WidgetRefreshReceiver
import app.couple.widget.WidgetBackendPolicy
import org.json.JSONObject
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val assetLoader by lazy {
        WebViewAssetLoader.Builder().addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this)).build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false
            settings.mixedContentMode = if (BuildConfig.DEBUG) android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                else android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url) ?: super.shouldInterceptRequest(view, request)

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
                    if (request.url.host == "appassets.androidplatform.net") return false
                    if (request.url.scheme == "https") startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    return true
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(view: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                    val chooserIntent = params?.createIntent() ?: return false
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = callback
                    return try {
                        startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST)
                        true
                    } catch (_: Exception) {
                        filePathCallback = null
                        false
                    }
                }
            }
        }
        setContentView(webView)
        installSessionBridge()
        loadApp(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadApp(intent)
    }

    @Deprecated("Deprecated in Android, retained for WebView file chooser callback compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != FILE_CHOOSER_REQUEST) return
        val selected = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
        filePathCallback?.onReceiveValue(selected)
        filePathCallback = null
    }

    private fun loadApp(intent: Intent?) {
        val section = intent?.getStringExtra("widget_section")
        val path = if (section.isNullOrBlank()) "" else "?widget=${Uri.encode(section)}"
        webView.loadUrl("https://appassets.androidplatform.net/index.html$path")
    }

    private fun installSessionBridge() {
        val messageListenerSupported = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
        val documentStartSupported = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        if (!messageListenerSupported || !documentStartSupported) {
            Log.e(TAG, "Widget session bridge unavailable: messageListener=$messageListenerSupported documentStart=$documentStartSupported")
            return
        }
        val origins = setOf("https://appassets.androidplatform.net")
        WebViewCompat.addWebMessageListener(webView, "coupleNative", origins) { _, message, sourceOrigin, isMainFrame, _ ->
            if (!isMainFrame || sourceOrigin.host != "appassets.androidplatform.net") return@addWebMessageListener
            val payload = try { JSONObject(message.data ?: "") } catch (_: Exception) { return@addWebMessageListener }
            val messageType = payload.optString("type")
            nativeExecutor.execute {
                val store = app.couple.widget.WidgetSessionStore(this)
                when (messageType) {
                    "configure" -> {
                        val url = payload.optString("url")
                        val key = payload.optString("anonKey")
                        if (WidgetBackendPolicy.allows(url, BuildConfig.DEBUG) && key.isNotBlank()) {
                            getSharedPreferences("widget_backend", MODE_PRIVATE).edit()
                                .putString("url", url.trimEnd('/')).putString("anon_key", key).apply()
                            Log.i(TAG, "Widget backend configured")
                        } else Log.e(TAG, "Widget backend rejected: allowed=${WidgetBackendPolicy.allows(url, BuildConfig.DEBUG)} keyPresent=${key.isNotBlank()}")
                    }
                    "session" -> try {
                        val accessToken = payload.optString("accessToken")
                        val refreshToken = payload.optString("refreshToken")
                        val expiresAt = payload.optLong("expiresAt")
                        val now = System.currentTimeMillis() / 1000L
                        Log.i(TAG, "Widget session candidate accessLength=${accessToken.length} refreshLength=${refreshToken.length} expiryValid=${expiresAt > now}")
                        store.save(accessToken, refreshToken, expiresAt)
                        Log.i(TAG, "Widget session stored")
                    } catch (error: Exception) {
                        store.clear()
                        Log.e(TAG, "Widget session rejected", error)
                    }
                    "clear" -> { store.clear(); Log.i(TAG, "Widget session cleared") }
                    "refresh" -> Unit
                    else -> return@execute
                }
                if (messageType == "clear" || messageType == "refresh" || messageType == "session") WidgetRefreshReceiver.refreshAll(this)
            }
        }
        WebViewCompat.addDocumentStartJavaScript(webView, """
            window.AndroidSession = {
              configureBackend: (url, anonKey) => coupleNative.postMessage(JSON.stringify({type:'configure', url, anonKey})),
              setSession: (accessToken, refreshToken, expiresAt) => coupleNative.postMessage(JSON.stringify({type:'session', accessToken, refreshToken, expiresAt})),
              clearSession: () => coupleNative.postMessage(JSON.stringify({type:'clear'})),
              refreshWidgets: () => coupleNative.postMessage(JSON.stringify({type:'refresh'}))
            };
        """.trimIndent(), origins)
        Log.i(TAG, "Widget session bridge installed")
    }

    companion object {
        private const val TAG = "CoupleWidgetBridge"
        private const val FILE_CHOOSER_REQUEST = 4017
        private val nativeExecutor = Executors.newSingleThreadExecutor()
    }
}
