package app.couple.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class WidgetRefreshReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = refreshAll(context)

    companion object {
        fun refreshAll(context: Context) = RelationshipWidgetProvider.providers.forEach { RelationshipWidgetProvider.update(context, it) }
    }
}

class WidgetPrivacyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = WidgetRefreshReceiver.refreshAll(context)
}
