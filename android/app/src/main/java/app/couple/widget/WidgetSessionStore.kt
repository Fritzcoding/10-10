package app.couple.widget

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class WidgetSession(val accessToken: String, val refreshToken: String, val expiresAt: Long)

class WidgetSessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("widget_secure_session", Context.MODE_PRIVATE)
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    private val alias = "couple.widget.session.v1"

    fun save(accessToken: String, refreshToken: String, expiresAt: Long) {
        require(isValidSession(accessToken, refreshToken, expiresAt, System.currentTimeMillis() / 1000L))
        val value = JSONObject().put("access", accessToken).put("refresh", refreshToken).put("expires", expiresAt).toString().toByteArray()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(value)
        prefs.edit().putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString("value", Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply()
    }

    fun read(): WidgetSession? {
        val iv = prefs.getString("iv", null) ?: return null
        val value = prefs.getString("value", null) ?: return null
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
            val json = JSONObject(String(cipher.doFinal(Base64.decode(value, Base64.NO_WRAP))))
            WidgetSession(json.getString("access"), json.getString("refresh"), json.getLong("expires"))
        } catch (_: Exception) {
            clear()
            null
        }
    }

    fun clear() {
        prefs.edit().clear().apply()
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }

    private fun key(): SecretKey {
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build())
            generateKey()
        }
    }

    companion object {
        internal fun isValidSession(accessToken: String, refreshToken: String, expiresAt: Long, now: Long) =
            accessToken.length in 16..8192 && refreshToken.isNotBlank() && refreshToken.length <= 8192 && expiresAt > now
    }
}
