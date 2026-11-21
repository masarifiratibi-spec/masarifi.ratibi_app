package com.masarifi.smsinbox

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.ContextWrapper
import expo.modules.notifications.notifications.model.NotificationContent
import expo.modules.notifications.notifications.model.NotificationAction
import expo.modules.notifications.notifications.model.NotificationCategory
import expo.modules.notifications.service.delegates.ExpoCategoriesDelegate
import expo.modules.notifications.notifications.model.NotificationRequest
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import kotlin.coroutines.Continuation
import kotlin.coroutines.intrinsics.suspendCoroutineUninterceptedOrReturn

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class CapturePresentationTest {
  private val channelId = "masarifi-tracking-saved-v1"
  private fun context(packageName: String = "com.masarifi.mobile.dev"): Context =
    object : ContextWrapper(RuntimeEnvironment.getApplication()) {
      override fun getPackageName() = packageName
    }

  @Test fun devSavedNoticeUsesOnlyTheSystemAppIconAndItsOwnAlertChannel() {
    val context = context()
    val notification = build(context)
    assertEquals(channelId, notification.channelId)
    assertEquals("masarifi_stat_brand", context.resources.getResourceEntryName(notification.smallIcon.resId))
    assertNull("Android owns the single app icon and its RTL/LTR placement", notification.getLargeIcon())
    assertTrue("Only transaction text is shown", notification.actions.isNullOrEmpty())
    assertEquals("تم تسجيل مصروف", notification.extras.getString(Notification.EXTRA_TITLE))
    assertNotNull("Preserve Expo's existing response navigation", notification.contentIntent)
    assertTrue(notification.flags and Notification.FLAG_ONLY_ALERT_ONCE != 0)
    assertTrue(notification.flags and Notification.FLAG_AUTO_CANCEL != 0)
    assertEquals(Notification.VISIBILITY_PRIVATE, notification.visibility)
    assertNotEquals("silent", notification.group)
    val channel = context.getSystemService(NotificationManager::class.java).getNotificationChannel(channelId)
    assertEquals(NotificationManager.IMPORTANCE_HIGH, channel.importance)
    assertNotNull(channel.sound)
  }

  @Test fun renderingDoesNotOverrideTheUsersSavedChannelSettings() {
    val context = context()
    val manager = context.getSystemService(NotificationManager::class.java)
    val muted = NotificationChannel(channelId, "My quiet transactions", NotificationManager.IMPORTANCE_NONE)
    muted.setSound(null, null)
    muted.enableVibration(false)
    manager.createNotificationChannel(muted)
    assertEquals(channelId, build(context).channelId)
    val retained = manager.getNotificationChannel(channelId)
    assertEquals(NotificationManager.IMPORTANCE_NONE, retained.importance)
    assertEquals("My quiet transactions", retained.name)
    assertNull(retained.sound)
    assertFalse(retained.shouldVibrate())
  }

  @Test fun ordinarySavedNoticeUsesTheDedicatedAlertChannel() {
    val context = context("com.masarifi.mobile")
    val notification = build(context)
    assertEquals(channelId, notification.channelId)
    assertEquals("masarifi_stat_brand", context.resources.getResourceEntryName(notification.smallIcon.resId))
    assertNull(notification.getLargeIcon())
    assertTrue(notification.actions.isNullOrEmpty())
    val channel = context.getSystemService(NotificationManager::class.java).getNotificationChannel(channelId)
    assertEquals(NotificationManager.IMPORTANCE_HIGH, channel.importance)
    assertNotNull(channel.sound)
  }

  private fun build(context: Context): Notification = runBlocking {
    ExpoCategoriesDelegate(context).setCategory(NotificationCategory("financial-change", listOf(
      NotificationAction("view", "عرض", true),
      NotificationAction("edit", "تعديل", true),
      NotificationAction("undo", "تراجع", true)
    )))
    val type = Class.forName("com.masarifi.smsinbox.CaptureConfirmation\$CapturePresentation")
    val constructor = type.getDeclaredConstructor(Context::class.java).apply { isAccessible = true }
    val instance = constructor.newInstance(context)
    val content = NotificationContent.Builder().setTitle("تم تسجيل مصروف")
      .setText("1.00 SAR · متجر الاختبار").setCategoryId("financial-change").setAutoDismiss(true).build()
    val request = expo.modules.notifications.notifications.model.Notification(
      NotificationRequest("20000000-0000-4000-8000-000000000019", content, null)
    )
    val method = type.getDeclaredMethod("build", request.javaClass, Continuation::class.java).apply { isAccessible = true }
    suspendCoroutineUninterceptedOrReturn { continuation -> method.invoke(instance, request, continuation) }
  }
}
