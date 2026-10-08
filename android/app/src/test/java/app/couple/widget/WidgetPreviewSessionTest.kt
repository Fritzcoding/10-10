package app.couple.widget

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetPreviewSessionTest {
    @Test fun privatePreviewRequiresItsOriginalLiveSession() {
        assertTrue(WidgetData.belongsToCurrentSession("account-a", 200, "account-a", 200, 100))
        assertFalse(WidgetData.belongsToCurrentSession("account-a", 200, "account-b", 300, 100))
        assertFalse(WidgetData.belongsToCurrentSession("account-a", 200, null, null, 100))
        assertFalse(WidgetData.belongsToCurrentSession("account-a", 200, "account-a", 300, 100))
        assertFalse(WidgetData.belongsToCurrentSession("account-a", 200, "account-a", 200, 200))
    }
}
