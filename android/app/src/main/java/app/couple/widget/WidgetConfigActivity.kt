package app.couple.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class WidgetConfigActivity : Activity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private var background: Uri? = null
    private lateinit var privacy: CheckBox
    private lateinit var photoStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)
        widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }
        val type = providerType()
        val preferences = getSharedPreferences("widget_instances", MODE_PRIVATE)
        background = preferences.getString("background_$widgetId", null)?.let(Uri::parse)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(28, 32, 28, 24) }
        layout.addView(TextView(this).apply { text = "Set up ${WidgetData.title(type)}"; textSize = 22f })
        photoStatus = TextView(this).apply { text = if (background == null) "Using the love theme" else "A photo is selected"; setPadding(0, 18, 0, 8) }
        layout.addView(photoStatus)
        layout.addView(Button(this).apply { text = getString(app.couple.R.string.pick_background); setOnClickListener { pickPhoto() } })
        layout.addView(Button(this).apply { text = "Use the love theme"; setOnClickListener { background = null; photoStatus.text = "Using the love theme" } })
        privacy = CheckBox(this).apply {
            text = getString(app.couple.R.string.hide_when_locked)
            isChecked = preferences.getBoolean("hide_locked_$widgetId", true)
            setPadding(0, 10, 0, 10)
        }
        layout.addView(privacy)
        layout.addView(Button(this).apply { text = "Add widget"; setOnClickListener { save() } })
        setContentView(layout, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    private fun providerType(): String {
        val component = AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId)?.provider?.className.orEmpty()
        return RelationshipWidgetProvider.providers.firstOrNull { component.endsWith(it.simpleName) }?.getDeclaredConstructor()?.newInstance()?.type ?: "note"
    }

    private fun pickPhoto() {
        startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE), 1)
    }

    @Deprecated("Widget configuration returns its selected photo through the activity result")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 1 || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val options = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
            contentResolver.openInputStream(uri)?.use { android.graphics.BitmapFactory.decodeStream(it, null, options) }
            require(options.outWidth > 0 && options.outHeight > 0)
            background = uri
            photoStatus.text = "A photo is selected"
        } catch (_: Exception) {
            background = null
            photoStatus.text = "Using the love theme"
            Toast.makeText(this, "That photo can't be used. Choose another one.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun save() {
        getSharedPreferences("widget_instances", MODE_PRIVATE).edit()
            .putBoolean("hide_locked_$widgetId", privacy.isChecked)
            .putString("background_$widgetId", background?.toString()).apply()
        val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        setResult(RESULT_OK, result)
        RelationshipWidgetProvider.providers.firstOrNull { provider ->
            AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId)?.provider?.className?.endsWith(provider.simpleName) == true
        }?.let { RelationshipWidgetProvider.update(this, it) }
        finish()
    }
}
