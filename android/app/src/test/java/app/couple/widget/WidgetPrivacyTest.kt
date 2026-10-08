package app.couple.widget

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetPrivacyTest {
    @Test fun hidesSensitiveContentWheneverTheKeyguardIsShowing() {
        assertTrue(WidgetPrivacy.shouldHideSensitive(true, true))
        assertFalse(WidgetPrivacy.shouldHideSensitive(true, false))
        assertFalse(WidgetPrivacy.shouldHideSensitive(false, true))
    }
}
