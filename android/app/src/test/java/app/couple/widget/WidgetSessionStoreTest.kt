package app.couple.widget

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetSessionStoreTest {
    @Test fun rejectsEmptyOrExpiredSessionMaterial() {
        assertFalse(WidgetSessionStore.isValidSession("", "refresh-token-value-123", 200, 100))
        assertFalse(WidgetSessionStore.isValidSession("access-token-value-123", "", 200, 100))
        assertFalse(WidgetSessionStore.isValidSession("access-token-value-123", "refresh-token-value-123", 100, 100))
    }

    @Test fun acceptsCurrentSessionMaterial() {
        assertTrue(WidgetSessionStore.isValidSession("access-token-value-123", "refresh-token-value-123", 101, 100))
    }

    @Test fun acceptsShortNonEmptyRefreshTokenFromSignedInSession() {
        assertTrue(WidgetSessionStore.isValidSession("a".repeat(32), "refresh-1234", 101, 100))
    }
}
