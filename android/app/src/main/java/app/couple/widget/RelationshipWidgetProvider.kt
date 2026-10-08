package app.couple.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.app.KeyguardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import app.couple.MainActivity
import app.couple.R
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.util.concurrent.Executors

abstract class RelationshipWidgetProvider : AppWidgetProvider() {
    abstract val type: String

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { render(context, manager, it, WidgetPreview(WidgetData.title(type), "Refreshing…", "us")) }
        val pending = goAsync()
        widgetExecutor.execute {
            try {
                appWidgetIds.forEach { id -> render(context, manager, id, WidgetData.load(context, type)) }
            } finally { pending.finish() }
        }
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle) {
        onUpdate(context, manager, intArrayOf(appWidgetId))
    }

    private fun render(context: Context, manager: AppWidgetManager, id: Int, preview: WidgetPreview) {
        val preferences = context.getSharedPreferences("widget_instances", Context.MODE_PRIVATE)
        val keyguardShowing = (context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
        val hideWhileLocked = WidgetPrivacy.shouldHideSensitive(preferences.getBoolean("hide_locked_$id", true), keyguardShowing)
        val session = WidgetSessionStore(context).read()
        val sessionChanged = preview.accountId != null && !WidgetData.belongsToCurrentSession(
            preview.accountId,
            preview.sessionExpiresAt,
            session?.let { WidgetData.userId(it.accessToken) },
            session?.expiresAt,
            System.currentTimeMillis() / 1000L,
        )
        val hideContent = hideWhileLocked || sessionChanged
        val options = manager.getAppWidgetOptions(id)
        val compact = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) < 190
            || options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT) < 150
        val views = RemoteViews(context.packageName, R.layout.widget_preview)
        views.setTextViewText(R.id.widget_title, if (hideContent) "Our Little Hub" else preview.title)
        val body = when {
            hideWhileLocked -> "Open the app to see this widget"
            sessionChanged && session == null -> "Open the app to sign in"
            sessionChanged -> "Open the app to refresh this widget"
            else -> preview.body
        }
        views.setTextViewText(R.id.widget_body, body.take(if (compact) 86 else 260))
        views.setTextViewTextSize(R.id.widget_body, android.util.TypedValue.COMPLEX_UNIT_SP, if (compact) 15f else 18f)
        views.setViewVisibility(R.id.widget_art, if (!hideContent && preview.strokes != null) View.VISIBLE else View.GONE)
        if (!hideContent && preview.strokes != null) views.setImageViewBitmap(R.id.widget_art, WidgetData.renderBoard(preview.strokes, 250))
        val image = preferences.getString("background_$id", null)
        val photo = image?.takeIf(String::isNotBlank)?.let { value -> runCatching {
            val uri = Uri.parse(value)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            val sample = WidgetBackground.sampleSize(bounds.outWidth, bounds.outHeight)
            context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) }
        }.getOrNull() }
        if (!hideContent && photo != null) {
            views.setViewVisibility(R.id.widget_background, View.VISIBLE)
            views.setImageViewBitmap(R.id.widget_background, photo)
            views.setInt(R.id.widget_content, "setBackgroundColor", android.graphics.Color.argb(128, 243, 249, 252))
        } else {
            views.setViewVisibility(R.id.widget_background, View.GONE)
            if (!image.isNullOrBlank() && photo == null) preferences.edit().remove("background_$id").apply()
        }
        val openApp = Intent(context, MainActivity::class.java).putExtra("widget_section", preview.route).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val tap = PendingIntent.getActivity(context, id, openApp, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        views.setOnClickPendingIntent(R.id.widget_root, tap)
        manager.updateAppWidget(id, views)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val preferences = context.getSharedPreferences("widget_instances", Context.MODE_PRIVATE)
        appWidgetIds.forEach { id ->
            preferences.getString("background_$id", null)?.let { uri ->
                runCatching { context.contentResolver.releasePersistableUriPermission(Uri.parse(uri), Intent.FLAG_GRANT_READ_URI_PERMISSION) }
            }
            preferences.edit().remove("background_$id").remove("hide_locked_$id").apply()
        }
    }

    companion object {
        private val widgetExecutor = Executors.newSingleThreadExecutor()
        val providers = listOf(
            CalendarAgendaWidget::class.java, UpcomingPlansWidget::class.java, LoveNoteWidget::class.java,
            VoiceMemoWidget::class.java, SharedMoodWidget::class.java, SharedLocationWidget::class.java,
            CountdownWidget::class.java, LoveBoardWidget::class.java,
        )
        fun update(context: Context, type: Class<out RelationshipWidgetProvider>) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, type))
            if (ids.isNotEmpty()) context.sendBroadcast(Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                .setComponent(ComponentName(context, type)).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids))
        }
    }
}

internal object WidgetBackground {
    fun sampleSize(width: Int, height: Int, maxDimension: Int = 384): Int {
        var sample = 1
        while (width / sample > maxDimension || height / sample > maxDimension) sample *= 2
        return sample
    }
}

internal object WidgetPrivacy {
    fun shouldHideSensitive(hideWhileLocked: Boolean, keyguardShowing: Boolean) = hideWhileLocked && keyguardShowing
}

class CalendarAgendaWidget : RelationshipWidgetProvider() { override val type = "calendar" }
class UpcomingPlansWidget : RelationshipWidgetProvider() { override val type = "plans" }
class LoveNoteWidget : RelationshipWidgetProvider() { override val type = "note" }
class VoiceMemoWidget : RelationshipWidgetProvider() { override val type = "voice" }
class SharedMoodWidget : RelationshipWidgetProvider() { override val type = "mood" }
class SharedLocationWidget : RelationshipWidgetProvider() { override val type = "location" }
class CountdownWidget : RelationshipWidgetProvider() { override val type = "countdown" }
class LoveBoardWidget : RelationshipWidgetProvider() { override val type = "board" }
