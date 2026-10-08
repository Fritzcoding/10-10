package app.couple.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Color
import android.net.Uri
import android.util.Base64
import android.util.Log
import app.couple.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

data class WidgetPreview(
    val title: String,
    val body: String,
    val route: String,
    val strokes: JSONArray? = null,
    val accountId: String? = null,
    val sessionExpiresAt: Long? = null,
)

object WidgetData {
    private data class Backend(val url: String, val anonKey: String)

    fun load(context: Context, type: String): WidgetPreview {
        val backendPrefs = context.getSharedPreferences("widget_backend", Context.MODE_PRIVATE)
        val backend = Backend(backendPrefs.getString("url", "") ?: "", backendPrefs.getString("anon_key", "") ?: "")
        if (!WidgetBackendPolicy.allows(backend.url, BuildConfig.DEBUG) || backend.anonKey.isBlank()) {
            Log.w(TAG, "Widget backend is not configured: allowed=${WidgetBackendPolicy.allows(backend.url, BuildConfig.DEBUG)} anonKeyPresent=${backend.anonKey.isNotBlank()}")
            return empty(type, "Open the app to sign in")
        }
        val store = WidgetSessionStore(context)
        var session = store.read() ?: run {
            Log.i(TAG, "Widget has no stored session")
            return empty(type, "Open the app to sign in")
        }
        if (session.expiresAt <= System.currentTimeMillis() / 1000L + 60) {
            session = refreshSession(backend, session.refreshToken) ?: run {
                Log.w(TAG, "Widget session refresh was rejected")
                store.clear()
                return empty(type, "Open the app to sign in")
            }
            store.save(session.accessToken, session.refreshToken, session.expiresAt)
        }
        return try { queryPreview(backend, session, type) } catch (error: Exception) {
            Log.e(TAG, "Widget data request failed: type=$type error=${error.javaClass.simpleName}")
            empty(type, "Open the app to refresh")
        }
    }

    private fun queryPreview(backend: Backend, session: WidgetSession, type: String): WidgetPreview {
        val route = type
        val row = when (type) {
            "calendar" -> getRows(backend, session, "relationship_events", listOf(
                "select" to "title,event_date,starts_at",
                "or" to "(event_date.gte.${LocalDate.now()},starts_at.gte.${Instant.now()})",
                "order" to "event_date.asc.nullslast,starts_at.asc.nullslast", "limit" to "1",
            )).firstOrNull()?.let { WidgetPreview("Calendar agenda", formatEvent(it), route) }
            "plans" -> getRows(backend, session, "relationship_events", listOf(
                "select" to "title,event_date,starts_at",
                "or" to "(event_date.gte.${LocalDate.now()},starts_at.gte.${Instant.now()})",
                "order" to "event_date.asc.nullslast,starts_at.asc.nullslast", "limit" to "1",
            )).firstOrNull()?.let { WidgetPreview("Upcoming plans", formatEvent(it), route) }
            "note" -> getRows(backend, session, "love_notes", listOf("select" to "content", "order" to "created_at.desc", "limit" to "1"))
                .firstOrNull()?.let { WidgetPreview("A little note", it.optString("content", "No notes yet"), route) }
            "voice" -> getRows(backend, session, "love_notes", listOf("select" to "content,audio_duration_ms", "audio_path" to "not.is.null", "order" to "created_at.desc", "limit" to "1"))
                .firstOrNull()?.let { WidgetPreview("Voice memo", "${it.optString("content", "A note from your partner")} · ${it.optInt("audio_duration_ms") / 1000}s", route) }
            "mood" -> getRows(backend, session, "relationship_mood_checkins", listOf("select" to "mood,note", "shared" to "eq.true", "order" to "created_at.desc", "limit" to "1"))
                .firstOrNull()?.let { WidgetPreview("Shared mood", "${it.optString("mood").replaceFirstChar(Char::uppercase)}${it.optString("note").takeIf(String::isNotBlank)?.let { note -> " · $note" } ?: ""}", route) }
            "location" -> getRows(backend, session, "temporary_location_shares", listOf("select" to "shared_by,expires_at", "expires_at" to "gt.${Instant.now()}", "shared_by" to "neq.${userId(session.accessToken)}", "limit" to "1"))
                .firstOrNull()?.let { WidgetPreview("Partner location", "Sharing until ${formatTime(it.optString("expires_at"))}", route) }
            "countdown" -> getRows(backend, session, "relationship_milestones", listOf("select" to "title,milestone_date,annual", "featured" to "eq.true", "limit" to "1"))
                .firstOrNull()?.let { milestone ->
                    val target = LocalDate.parse(milestone.getString("milestone_date"))
                    val today = LocalDate.now()
                    val occurrence = if (milestone.optBoolean("annual")) {
                        fun inYear(year: Int) = try { target.withYear(year) } catch (_: Exception) { LocalDate.of(year, 2, 28) }
                        inYear(today.year).let { if (it.isBefore(today)) inYear(today.year + 1) else it }
                    } else target
                    val days = ChronoUnit.DAYS.between(today, occurrence)
                    WidgetPreview(milestone.optString("title", "Our next date"), "$days days to go", route)
                }
            "board" -> {
                val board = getRows(backend, session, "love_boards", listOf("select" to "generation", "limit" to "1")).firstOrNull()
                val generation = board?.optInt("generation") ?: 0
                if (generation == 0) null else {
                    val strokes = getRows(backend, session, "love_board_strokes", listOf("select" to "points,color,width", "generation" to "eq.$generation", "order" to "created_at.asc", "limit" to "120"))
                    WidgetPreview("Love Board", if (strokes.isEmpty()) "Draw something together" else "Your shared drawing", route, JSONArray(strokes))
                }
            }
            else -> null
        }
        return row?.copy(accountId = userId(session.accessToken), sessionExpiresAt = session.expiresAt)
            ?: empty(type, when (type) { "location" -> "No active location share"; "countdown" -> "Choose a countdown in the app"; else -> "Nothing to show yet" })
    }

    private fun getRows(backend: Backend, session: WidgetSession, table: String, query: List<Pair<String, String>>): List<JSONObject> {
        val uri = Uri.parse("${backend.url}/rest/v1/$table").buildUpon().apply { query.forEach { appendQueryParameter(it.first, it.second) } }.build()
        val connection = URL(uri.toString()).openConnection() as HttpURLConnection
        connection.connectTimeout = 2500
        connection.readTimeout = 2500
        connection.setRequestProperty("apikey", backend.anonKey)
        connection.setRequestProperty("Authorization", "Bearer ${session.accessToken}")
        connection.setRequestProperty("Accept", "application/json")
        try {
            if (connection.responseCode !in 200..299) {
                Log.e(TAG, "Widget REST request rejected: table=$table status=${connection.responseCode}")
                throw IllegalStateException("Supabase request failed")
            }
            val json = JSONArray(connection.inputStream.bufferedReader().use { it.readText() })
            if (BuildConfig.DEBUG) Log.d(TAG, "Widget REST request succeeded: table=$table rows=${json.length()}")
            return (0 until json.length()).map { json.getJSONObject(it) }
        } finally { connection.disconnect() }
    }

    private fun refreshSession(backend: Backend, refreshToken: String): WidgetSession? {
        val connection = URL("${backend.url}/auth/v1/token?grant_type=refresh_token").openConnection() as HttpURLConnection
        connection.connectTimeout = 2500
        connection.readTimeout = 2500
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.setRequestProperty("apikey", backend.anonKey)
        connection.setRequestProperty("Content-Type", "application/json")
        return try {
            connection.outputStream.use { it.write(JSONObject().put("refresh_token", refreshToken).toString().toByteArray()) }
            if (connection.responseCode !in 200..299) {
                Log.w(TAG, "Widget refresh endpoint rejected request: status=${connection.responseCode}")
                return null
            }
            val result = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            WidgetSession(result.getString("access_token"), result.getString("refresh_token"), System.currentTimeMillis() / 1000L + result.getLong("expires_in"))
        } catch (_: Exception) { null } finally { connection.disconnect() }
    }

    fun renderBoard(strokes: JSONArray, size: Int = 400): Bitmap {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        for (index in 0 until strokes.length()) {
            val stroke = strokes.getJSONObject(index)
            val points = stroke.getJSONArray("points")
            val path = Path()
            for (pointIndex in 0 until points.length()) {
                val point = points.getJSONObject(pointIndex)
                val x = point.getDouble("x").toFloat() * size / 1000f
                val y = point.getDouble("y").toFloat() * size / 1000f
                if (pointIndex == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = try { Color.parseColor(stroke.getString("color")) } catch (_: Exception) { Color.GRAY }
                strokeWidth = stroke.optInt("width", 5).coerceIn(2, 20) * size / 1000f
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }
            canvas.drawPath(path, paint)
        }
        return bitmap
    }

    internal fun userId(token: String): String = try {
        val payload = token.split('.')[1]
        JSONObject(String(Base64.decode(payload, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING))).getString("sub")
    } catch (_: Exception) { "" }

    internal fun belongsToCurrentSession(
        previewAccountId: String?,
        previewExpiresAt: Long?,
        currentAccountId: String?,
        currentExpiresAt: Long?,
        now: Long,
    ): Boolean = !previewAccountId.isNullOrBlank() && previewAccountId == currentAccountId
        && previewExpiresAt != null && previewExpiresAt == currentExpiresAt && currentExpiresAt > now

    private fun formatTime(value: String): String = try {
        DateTimeFormatter.ofPattern("h:mm a").withZone(ZoneId.systemDefault()).format(Instant.parse(value))
    } catch (_: Exception) { "soon" }

    private fun formatEvent(row: JSONObject): String {
        val date = row.optString("event_date")
        val startsAt = row.optString("starts_at")
        val whenText = when {
            date.isNotBlank() -> runCatching { LocalDate.parse(date).format(DateTimeFormatter.ofPattern("EEE, MMM d")) }.getOrNull()
            startsAt.isNotBlank() -> runCatching { DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a").withZone(ZoneId.systemDefault()).format(Instant.parse(startsAt)) }.getOrNull()
            else -> null
        }
        return listOfNotNull(row.optString("title").takeIf(String::isNotBlank), whenText).joinToString(" · ").ifBlank { "No upcoming plans" }
    }

    private fun empty(type: String, body: String) = WidgetPreview(title(type), body, "us")
    private const val TAG = "CoupleWidgetData"
    fun title(type: String) = when (type) {
        "calendar" -> "Calendar agenda"; "plans" -> "Upcoming plans"; "note" -> "A little note"; "voice" -> "Voice memo"
        "mood" -> "Shared mood"; "location" -> "Partner location"; "countdown" -> "Our countdown"; else -> "Love Board"
    }
}
