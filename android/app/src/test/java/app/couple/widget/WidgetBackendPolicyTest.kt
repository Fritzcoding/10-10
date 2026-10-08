package app.couple.widget

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetBackendPolicyTest {
    @Test fun releaseBuildAcceptsHttps() {
        assertTrue(WidgetBackendPolicy.allows("https://example.supabase.co", false))
    }

    @Test fun debugBuildAcceptsOnlyTheEmulatorHostLocalSupabaseEndpoint() {
        assertTrue(WidgetBackendPolicy.allows("http://10.0.2.2:54321", true))
        assertFalse(WidgetBackendPolicy.allows("http://10.0.2.2:54321", false))
        assertFalse(WidgetBackendPolicy.allows("http://192.168.1.20:54321", true))
        assertFalse(WidgetBackendPolicy.allows("http://10.0.2.2:54321.evil.test", true))
        assertFalse(WidgetBackendPolicy.allows("http://10.0.2.2:54321/path", true))
    }
}
