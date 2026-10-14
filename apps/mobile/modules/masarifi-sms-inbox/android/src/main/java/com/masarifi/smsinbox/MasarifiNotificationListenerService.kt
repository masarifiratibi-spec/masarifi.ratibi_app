package com.masarifi.smsinbox

import android.app.Notification
import android.content.Context
import android.content.SharedPreferences
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

data class CapturedNotification(
  val key: String,
  val packageName: String,
  val title: String,
  val text: String,
  val postedAt: Long,
  val nativeKey: String = key,
  val discovered: Boolean = false,
  val observedAt: Long = postedAt,
  val captureActivatedAt: Long = 0,
  val capturePolicy: String = "legacy"
)

object NotificationCaptureState {
  private const val PREFERENCES = "masarifi_notification_capture_v1"
  private const val ENABLED = "enabled"

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      .getBoolean(ENABLED, false)

  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(ENABLED, enabled)
      .apply()
  }
}

object NotificationQueuePolicy {
  const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000
  const val DISCOVERY_MAX_AGE_MS = 24L * 60 * 60 * 1000
  private const val MAX_RECORDS = 200

  fun append(records:List<CapturedNotification>,record:CapturedNotification,capacity:Int=10000):List<CapturedNotification> {
    val next=prune(records+record,System.currentTimeMillis())
    check(next.size<=capacity) {"tracking_notification_queue_full"}
    return next
  }

  fun prune(records: List<CapturedNotification>, now: Long): List<CapturedNotification> {
    return records.asReversed()
      .distinctBy { it.key }
      .sortedByDescending { it.postedAt }
  }

  fun acknowledge(
    records: List<CapturedNotification>,
    keys: Set<String>
  ): List<CapturedNotification> = records.filterNot { it.key in keys }
}

internal class NotificationQueue(private val context: Context) {
  private val encrypted = TrackingEncryptedStore(context,"masarifi_notification_queue_v2")
  private val preferences: SharedPreferences = context.getSharedPreferences(
    "masarifi_notification_queue_v1",
    Context.MODE_PRIVATE
  )

  fun add(record: CapturedNotification) = synchronized(TrackingOwner) {
    check(!TrackingOwner.isSuspended(context)) {"tracking_suspended"}
    val pruned=try {NotificationQueuePolicy.append(readStored(),record)} catch(error:IllegalStateException) {
      preferences.edit().putLong("overflowCount",preferences.getLong("overflowCount",0)+1).commit()
      throw error
    }
    write(pruned)
  }

  fun read(limit: Int): List<CapturedNotification> = synchronized(TrackingOwner) {
    check(!TrackingOwner.isSuspended(context)) {"tracking_suspended"}
    val records = NotificationQueuePolicy.prune(readStored(), System.currentTimeMillis())
    write(records)
    records.sortedBy { it.postedAt }.take(limit.coerceIn(1, 100))
  }

  fun acknowledge(keys: Set<String>) = synchronized(TrackingOwner) {
    check(!TrackingOwner.isSuspended(context)) {"tracking_suspended"}
    write(NotificationQueuePolicy.acknowledge(readStored(), keys))
    preferences.edit().remove("captureIssue").commit()
  }

  fun clear() = synchronized(TrackingOwner) {
    encrypted.clear()
    preferences.edit().remove("records").commit()
  }

  private fun readStored(): List<CapturedNotification> {
    val array = JSONArray(encrypted.read() ?: "[]")
    return buildList {
      for (index in 0 until array.length()) {
        val item = array.optJSONObject(index) ?: continue
        val key = item.optString("key")
        val packageName = item.optString("packageName")
        val postedAt = item.optLong("postedAt", -1)
        if (key.isBlank() || packageName.isBlank() || postedAt < 0) continue
        add(
          CapturedNotification(
            key,
            packageName,
            item.optString("title"),
            item.optString("text"),
            postedAt,
            item.optString("nativeKey",key),
            item.optBoolean("discovered",false),
            item.optLong("observedAt",postedAt),
            item.optLong("captureActivatedAt",0),
            item.optString("capturePolicy","legacy")
          )
        )
      }
    }
  }

  private fun write(records: List<CapturedNotification>) {
    val array = JSONArray()
    records.forEach { record ->
      array.put(
        JSONObject()
          .put("key", record.key)
          .put("packageName", record.packageName)
          .put("title", record.title)
          .put("text", record.text)
          .put("postedAt", record.postedAt)
          .put("nativeKey",record.nativeKey)
          .put("discovered",record.discovered)
          .put("observedAt",record.observedAt)
          .put("captureActivatedAt",record.captureActivatedAt)
          .put("capturePolicy",record.capturePolicy)
      )
    }
    encrypted.write(array.toString())
    preferences.edit().remove("records").commit()
  }

  private companion object {
    val lock = Any()
  }
}

internal fun retainAdmittedNotification(
  record: CapturedNotification, admission: NotificationAdmission,
  persist: (CapturedNotification) -> Unit, wake: () -> Unit
): Boolean {
  if(admission==NotificationAdmission.DISCARD) return false
  persist(record.copy(discovered=admission==NotificationAdmission.DISCOVERED))
  wake()
  return true
}

class MasarifiNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(notification: StatusBarNotification) = synchronized(TrackingOwner) {
    if (!NotificationCaptureState.isEnabled(this)) return@synchronized
    val state=TrackingOwner.read(this)
    if (!state.optBoolean("notification") || state.optString("owner").isBlank() || notification.packageName == packageName) return@synchronized
    val boundary=state.optLong("notificationActivatedAt",0)
    if(notification.postTime<boundary || notification.postTime>System.currentTimeMillis()) return@synchronized
    fun packages(field:String): Set<String> = state.optJSONArray(field)?.let { values ->
      (0 until values.length()).map { values.optString(it) }.toSet()
    } ?: emptySet()
    val blocked=packages("blockedPackages")
    if(notification.packageName in blocked) return@synchronized
    val extras = notification.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = (
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)
      )?.toString().orEmpty()
    if (title.isBlank() && text.isBlank()) return@synchronized
    val oversized=title.length+text.length>8000
    val admission=notificationAdmission(notification.packageName,packageName,true,packages("packages"),blocked,
      FinancialDiscoveryPolicy.parse(state.optString("discoveryPolicy")),title+"\n"+text)
    val counters=getSharedPreferences("masarifi_tracking_admission_counters",Context.MODE_PRIVATE)
    if(admission==NotificationAdmission.DISCARD) {
      counters.edit().putLong("discarded",counters.getLong("discarded",0)+1).apply()
      return@synchronized
    }
    try {retainAdmittedNotification(
      CapturedNotification(
        notification.key+":"+notification.postTime+":"+trackingDigest(title+"\n"+text),
        notification.packageName,
        if(oversized) title.take(1000) else title,
        if(oversized) text.take(6900)+"\n[tracking_input_too_large]" else text,
        notification.postTime,
        notification.key,
        admission==NotificationAdmission.DISCOVERED,
        System.currentTimeMillis(),boundary,
        if(FinancialDiscoveryPolicy.parse(state.optString("discoveryPolicy"))?.nominal==true) "default_account_nominal_v1" else "legacy"
      ), admission, {NotificationQueue(this).add(it)}, {TrackingScheduler.incoming(this)}
    )} catch(error:Exception) {
      getSharedPreferences("masarifi_notification_queue_v1",Context.MODE_PRIVATE).edit()
        .putString("captureIssue",if(error.message=="tracking_notification_queue_full") error.message else "tracking_notification_storage_failed").commit()
      android.util.Log.w("MasarifiTracking","Notification retention unavailable")
      TrackingScheduler.incoming(this)
      return@synchronized
    }
    counters.edit().putLong("admitted",counters.getLong("admitted",0)+1).apply()
  }
}
