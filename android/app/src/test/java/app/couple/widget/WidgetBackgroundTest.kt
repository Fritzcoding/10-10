package app.couple.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetBackgroundTest {
    @Test fun downsamplesLargeImagesToWidgetSafeDimensions() {
        assertEquals(16, WidgetBackground.sampleSize(3120, 1440))
        assertEquals(1, WidgetBackground.sampleSize(384, 256))
        assertEquals(8, WidgetBackground.sampleSize(1600, 900))
    }
}
