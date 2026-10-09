package com.masarifi.smsinbox

import android.content.Context
import androidx.core.app.NotificationManagerCompat
import expo.modules.notifications.notifications.model.Notification
import expo.modules.notifications.notifications.model.NotificationContent
import expo.modules.notifications.notifications.model.NotificationRequest
import expo.modules.notifications.notifications.model.NotificationBehaviorRecord
import expo.modules.notifications.service.delegates.ExpoPresentationDelegate
import kotlinx.coroutines.runBlocking
import org.json.JSONObject

internal object CaptureConfirmation {
  fun present(context:Context,ownerId:String,notificationId:String,title:String,body:String):Boolean = synchronized(TrackingOwner) {
    if(TrackingOwner.read(context).optString("owner")!=trackingDigest(ownerId) || !NotificationManagerCompat.from(context).areNotificationsEnabled()) return@synchronized false
    require(notificationId.matches(Regex("[a-fA-F0-9-]{36}")) && title.length<=120 && body.length<=240)
    val store=TrackingEncryptedStore(context,"masarifi_tracking_presentations_v2")
    val state=JSONObject(store.read()?:"{}")
    if(state.has(notificationId)) return@synchronized false
    val content=NotificationContent.Builder().setTitle(title).setText(body).setCategoryId("financial-change")
      .setBody(JSONObject().put("notificationId",notificationId)).setAutoDismiss(true).build()
    val notification=Notification(NotificationRequest(notificationId,content,null))
    val androidNotification=runBlocking {CapturePresentation(context).build(notification)}
    // notify is synchronous. A crash before checkpoint repeats the stable tag with onlyAlertOnce.
    NotificationManagerCompat.from(context).notify(notificationId,0,androidNotification)
    state.put(notificationId,System.currentTimeMillis())
    val cutoff=System.currentTimeMillis()-90L*86400000
    state.keys().asSequence().toList().filter {state.optLong(it)<cutoff}.forEach {state.remove(it)}
    store.write(state.toString())
    true
  }
  private class CapturePresentation(context:Context):ExpoPresentationDelegate(context) {
    suspend fun build(notification:Notification):android.app.Notification {
      val built=createNotification(notification,NotificationBehaviorRecord(shouldShowBanner=true,shouldShowList=true))
      return android.app.Notification.Builder.recoverBuilder(context,built).setOnlyAlertOnce(true).build()
    }
  }
}
