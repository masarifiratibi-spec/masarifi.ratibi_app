package com.masarifi.smsinbox

import android.content.Context
import android.app.NotificationChannel
import android.app.NotificationManager
import android.graphics.Color
import android.media.AudioAttributes
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.notifications.notifications.model.Notification
import expo.modules.notifications.notifications.model.NotificationContent
import expo.modules.notifications.notifications.model.NotificationRequest
import expo.modules.notifications.notifications.model.NotificationBehaviorRecord
import expo.modules.notifications.service.delegates.ExpoPresentationDelegate
import expo.modules.notifications.notifications.triggers.ChannelAwareTrigger
import kotlinx.coroutines.runBlocking
import org.json.JSONObject

internal object CaptureConfirmation {
  private const val SAVED_CHANNEL_ID = "masarifi-tracking-saved-v1"
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
      val isDev=context.packageName=="com.masarifi.mobile.dev"
      val request=notification.notificationRequest
      val prepared=if(isDev) {
        ensureSavedChannel()
        Notification(NotificationRequest(request.identifier,request.content,ChannelAwareTrigger(SAVED_CHANNEL_ID)))
      } else notification
      val built=createNotification(prepared,NotificationBehaviorRecord(
        shouldShowBanner=true,shouldShowList=true,shouldPlaySound=isDev))
      // Recovered builders retain the built actions even when setActions() is empty.
      if(isDev) built.actions=null
      val builder=android.app.Notification.Builder.recoverBuilder(context,built).setOnlyAlertOnce(true)
      if(isDev) {
        // Android supplies the app icon and mirrors its placement with the system locale.
        builder.setSmallIcon(R.drawable.masarifi_stat_wallet)
          .setLargeIcon(null as android.graphics.Bitmap?)
          .setColor(Color.rgb(5,84,87)).setVisibility(android.app.Notification.VISIBILITY_PRIVATE)
        if(Build.VERSION.SDK_INT<26) builder.setDefaults(android.app.Notification.DEFAULT_ALL)
      }
      return builder.build()
    }
    private fun ensureSavedChannel() {
      if(Build.VERSION.SDK_INT<26) return
      val manager=context.getSystemService(NotificationManager::class.java)
      // Never recreate a channel whose alert preferences the user has changed.
      if(manager.getNotificationChannel(SAVED_CHANNEL_ID)!=null) return
      val channel=NotificationChannel(SAVED_CHANNEL_ID,
        context.getString(R.string.masarifi_tracking_saved_channel_name),NotificationManager.IMPORTANCE_HIGH)
      channel.enableVibration(true)
      channel.lockscreenVisibility=android.app.Notification.VISIBILITY_PRIVATE
      channel.setSound(Settings.System.DEFAULT_NOTIFICATION_URI,AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
      manager.createNotificationChannel(channel)
    }
  }
}
