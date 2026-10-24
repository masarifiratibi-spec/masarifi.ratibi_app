package com.masarifi.smsinbox

import android.Manifest
import android.content.Context
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.provider.Telephony
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MasarifiSmsInboxModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MasarifiSmsInbox")
    AsyncFunction("financialContentAdmissionSupported") {
      appContext.reactContext?.let { supportsFinancialContentCapture(it) } ?: false
    }
    AsyncFunction("notificationCaptureIssue") {
      appContext.reactContext?.getSharedPreferences("masarifi_notification_queue_v1",Context.MODE_PRIVATE)?.getString("captureIssue",null)
    }

    AsyncFunction("smsActivationBoundary") {
      val context=appContext.reactContext ?: throw IllegalStateException("sms_context_unavailable")
      if(context.checkSelfPermission(Manifest.permission.READ_SMS)!=PackageManager.PERMISSION_GRANTED) throw SecurityException("sms_permission_required")
      val timestamp=System.currentTimeMillis()
      var afterId="0"
      context.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI,arrayOf("_id"),"date = ?",arrayOf(timestamp.toString()),"_id DESC")?.use { cursor ->
        if(cursor.moveToFirst()) afterId=cursor.getString(0)
      }
      mapOf("activatedAt" to timestamp,"afterId" to afterId)
    }

    AsyncFunction("readFinancialSmsPageV2") { since:Double,afterId:String,limit:Int,owner:String ->
      readFinancialPage(since,afterId,limit,owner)
    }
    AsyncFunction("readSmsPage") { since:Double,afterId:String,limit:Int ->
      readFinancialPage(since,afterId.ifBlank { "0" },limit,null)["messages"]
    }
    AsyncFunction("configureTrackingOwner") { owner:String,generation:String,sms:Boolean,notifications:Boolean,packages:List<String>,blocked:List<String>,policy:String? ->
      val context=appContext.reactContext ?: throw IllegalStateException("tracking_context_unavailable")
      TrackingOwner.configure(context,owner,generation,sms,notifications,
        packages.filter {it.matches(Regex("[a-zA-Z][\\w]*(\\.[\\w]+)+"))},
        blocked.filter {it.matches(Regex("[a-zA-Z][\\w]*(\\.[\\w]+)+"))},policy)
    }
    AsyncFunction("suspendTrackingOwner") {appContext.reactContext?.let {TrackingOwner.suspend(it)}}
    AsyncFunction("configureTrackingOwnerV3") { owner:String,generation:String,sms:Boolean,notifications:Boolean,packages:List<String>,blocked:List<String>,policy:String?,boundaries:String ->
      val context=appContext.reactContext ?: throw IllegalStateException("tracking_context_unavailable")
      val bounds=org.json.JSONObject(boundaries)
      val smsBoundary=bounds.getLong("smsActivatedAt"); val notificationBoundary=bounds.getLong("notificationActivatedAt")
      require(smsBoundary>=0 && notificationBoundary>=0)
      TrackingOwner.configure(context,owner,generation,sms,notifications,packages,blocked,policy,smsBoundary,notificationBoundary)
    }
    AsyncFunction("restoreTrackingOwner") { owner:String,generation:String? ->
      val context=appContext.reactContext ?: throw IllegalStateException("tracking_context_unavailable")
      TrackingOwner.restore(context,owner,generation)
    }
    AsyncFunction("clearTrackingOwner") {appContext.reactContext?.let {TrackingOwner.clear(it)}}
    AsyncFunction("purgeTrackingOwnerData") {owner:String ->
      val context=appContext.reactContext ?: throw IllegalStateException("tracking_context_unavailable")
      TrackingOwner.purgeOwner(context,owner)
    }
    AsyncFunction("finishTrackingWork") {workId:String,succeeded:Boolean -> TrackingWorker.finish(workId,succeeded)}
    AsyncFunction("scheduleTrackingFollowUp") {ownerDigest:String,generation:String ->
      val context=appContext.reactContext ?: throw IllegalStateException("Tracking context unavailable")
      TrackingScheduler.followUp(context,ownerDigest,generation)
    }
    AsyncFunction("presentCaptureConfirmation") {ownerId:String,notificationId:String,title:String,body:String ->
      val context=appContext.reactContext ?: throw IllegalStateException("tracking_context_unavailable")
      CaptureConfirmation.present(context,ownerId,notificationId,title,body)
    }

    AsyncFunction("readRecentSms") { since:Double,limit:Int ->
      readFinancialPage(since,"0",limit,null)["messages"]
    }

    AsyncFunction("isNetworkAvailable") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val connectivity =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      val network = connectivity.activeNetwork ?: return@AsyncFunction false
      val capabilities = connectivity.getNetworkCapabilities(network)
        ?: return@AsyncFunction false
      capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    AsyncFunction("isNotificationAccessEnabled") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
      ).orEmpty()
      enabled.split(':').any { value ->
        val component = ComponentName.unflattenFromString(value)
        component?.packageName == context.packageName &&
          component.className == MasarifiNotificationListenerService::class.java.name
      }
    }

    AsyncFunction("openNotificationAccessSettings") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("notification_context_unavailable")
      context.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    AsyncFunction("setNotificationCaptureEnabled") { enabled: Boolean ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("notification_context_unavailable")
      NotificationCaptureState.setEnabled(context, enabled)
    }

    AsyncFunction("readRecentNotifications") { requestedLimit: Int ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("notification_context_unavailable")
      NotificationQueue(context).read(requestedLimit).map { record ->
        mapOf(
          "key" to record.key,
          "packageName" to record.packageName,
          "title" to record.title,
          "text" to record.text,
          "postedAt" to record.postedAt,
          "observedAt" to record.observedAt,
          "discovered" to record.discovered,
          "captureActivatedAt" to record.captureActivatedAt,
          "capturePolicy" to record.capturePolicy,
          "nativeKey" to record.nativeKey
        ) + (record.sourceDisplayName?.let { mapOf("sourceDisplayName" to it) } ?: emptyMap())
      }
    }

    AsyncFunction("acknowledgeNotifications") { keys: List<String> ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("notification_context_unavailable")
      NotificationQueue(context).acknowledge(keys.filter { it.isNotBlank() }.toSet())
    }
  }
  private fun readFinancialPage(since:Double,afterId:String,limit:Int,expectedOwner:String?):Map<String,Any> = synchronized(TrackingOwner) {
    require(since.isFinite() && since>=0 && since%1.0==0.0 && since<=9007199254740991.0 && limit in 1..100)
    val id=afterId.toLongOrNull() ?: throw IllegalArgumentException("sms_cursor_invalid")
    require(id>=0)
    val context=appContext.reactContext ?: throw IllegalStateException("sms_context_unavailable")
    if(context.checkSelfPermission(Manifest.permission.READ_SMS)!=PackageManager.PERMISSION_GRANTED)
      throw SecurityException("sms_permission_required")
    val state=TrackingOwner.read(context)
    if(!state.optBoolean("sms") || state.optString("owner").isBlank() ||
        expectedOwner!=null && state.optString("owner")!=expectedOwner)
      throw IllegalStateException("sms_owner_unavailable")
    val policy=TrackingOwner.policy(state) ?: throw IllegalStateException("tracking_policy_unavailable")
    val observedAt=System.currentTimeMillis()
    val cursor=context.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI,arrayOf("_id","address","body","date"),
      "date > ? OR (date = ? AND _id > ?)",arrayOf(since.toLong().toString(),since.toLong().toString(),id.toString()),"date ASC, _id ASC")
      ?: throw IllegalStateException("sms_inbox_unavailable")
    cursor.use {
      val rows=sequence {
        while(cursor.moveToNext()) yield(SmsInboxRow(cursor.getLong(0).toString(),cursor.getString(1)?:"",cursor.getString(2)?:"",cursor.getLong(3)))
      }
      scanFinancialSmsPage(rows.iterator(),since.toLong(),afterId,limit,observedAt) { row ->
        if(policy.nominal) policy.isFinancial(row.body,row.sender,"android_sms")
        else policy.isStrong(row.body,row.sender,"android_sms")
      }
    }
  }

}
