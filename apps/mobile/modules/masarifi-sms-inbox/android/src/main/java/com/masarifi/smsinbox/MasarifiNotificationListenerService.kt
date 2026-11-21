package com.masarifi.smsinbox

import android.app.Notification
import android.content.Context
import android.content.ComponentName
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
  val capturePolicy: String = "legacy",
  val sourceDisplayName: String? = null,
  val captureGeneration: String? = null
)

private fun normalizedSourceDisplayName(label: String?): String? = label
  ?.filterNot { it.isISOControl() }?.trim()?.take(100)?.takeIf { it.isNotBlank() }

// App labels are optional metadata: package visibility or an uninstall must not block retention.
private fun applicationSourceDisplayName(context: Context, packageName: String): String? = runCatching {
  val application=context.packageManager.getApplicationInfo(packageName,0)
  normalizedSourceDisplayName(context.packageManager.getApplicationLabel(application).toString())
}.getOrNull()

object NotificationCaptureState {
  private const val PREFERENCES = "masarifi_notification_capture_v1"
  private const val ENABLED = "enabled"

  private fun preferences(context: Context) = TrackingOwnerPartitions.ownerPreferences(context, PREFERENCES, "masarifi_notification_capture_v3")

  fun isEnabled(context: Context): Boolean = synchronized(TrackingOwner) {
    if (TrackingOwnerPartitions.exists(context) && TrackingOwner.isSuspended(context)) return@synchronized false
    preferences(context).getBoolean(ENABLED, false)
  }

  fun setEnabled(context: Context, enabled: Boolean) = synchronized(TrackingOwner) {
    check(preferences(context).edit().putBoolean(ENABLED, enabled).commit()) { "tracking_owner_storage_failed" }
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
  private fun assertGeneration(generation: String) {
    check(!TrackingOwner.isSuspended(context)) {"tracking_suspended"}
    check(generation.length in 16..80 && TrackingOwner.read(context).optString("generation")==generation) {
      "tracking_notification_generation_stale"
    }
  }
  fun readCurrent(limit: Int,generation: String): List<CapturedNotification> = synchronized(TrackingOwner) {
    assertGeneration(generation)
    readStored().filter {it.captureGeneration==generation}.sortedBy {it.postedAt}.take(limit.coerceIn(1,100))
  }
  fun acknowledgeCurrent(keys: Set<String>,generation: String) = synchronized(TrackingOwner) {
    assertGeneration(generation)
    val records=JSONArray(encrypted.read() ?: "[]")
    val retained=JSONArray()
    for(index in 0 until records.length()) {
      val row=records.optJSONObject(index)
      if(row?.opt("captureGeneration")!=generation || row.opt("key") !in keys) retained.put(records.get(index))
    }
    encrypted.write(retained.toString())
    preferences.edit().remove("captureIssue").commit()
  }
  fun retainedCount(): Int = synchronized(TrackingOwner) {
    check(!TrackingOwner.isSuspended(context)) {"tracking_suspended"}
    JSONArray(encrypted.read() ?: "[]").length()
  }
  private val encrypted = TrackingEncryptedStore(context,"masarifi_notification_queue_v2")
  private val preferences: SharedPreferences get() = TrackingOwnerPartitions.ownerPreferences(
    context, "masarifi_notification_queue_v1", "masarifi_notification_queue_metadata_v3")

  fun add(record: CapturedNotification) = synchronized(TrackingOwner) {
    check(!TrackingOwner.isSuspended(context)) {"tracking_suspended"}
    val records=JSONArray(encrypted.read() ?: "[]")
    if((0 until records.length()).any {index -> records.optJSONObject(index)?.let {
        it.opt("key")==record.key && (it.opt("captureGeneration") as? String)==record.captureGeneration
      }==true}) return@synchronized
    if(records.length()>=10000) {
      preferences.edit().putLong("overflowCount",preferences.getLong("overflowCount",0)+1).commit()
      throw IllegalStateException("tracking_notification_queue_full")
    }
    records.put(encodeRecord(record))
    encrypted.write(records.toString())
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
            item.optString("capturePolicy","legacy"),
            normalizedSourceDisplayName(item.opt("sourceDisplayName") as? String)
              ?: applicationSourceDisplayName(context,packageName),
            item.opt("captureGeneration") as? String
          )
        )
      }
    }
  }

  private fun write(records: List<CapturedNotification>) {
    val array = JSONArray()
    records.forEach { record -> array.put(encodeRecord(record)) }
    encrypted.write(array.toString())
    preferences.edit().remove("records").commit()
  }

  private fun encodeRecord(record: CapturedNotification): JSONObject = JSONObject()
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
          .put("sourceDisplayName",normalizedSourceDisplayName(record.sourceDisplayName))
          .put("captureGeneration",record.captureGeneration)

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
  override fun onListenerConnected() {
    super.onListenerConnected()
    if (!NotificationCaptureState.isEnabled(this)) return
    // Reuse the consent boundary, content filter and durable identities on reconnect.
    runCatching { activeNotifications.orEmpty() }.getOrDefault(emptyArray()).forEach {
      runCatching { onNotificationPosted(it) }.onFailure {
        android.util.Log.w("MasarifiTracking","Active notification recovery unavailable")
      }
    }
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    val state=TrackingOwner.read(this)
    if (NotificationCaptureState.isEnabled(this) && state.optBoolean("notification") && state.optString("owner").isNotBlank())
      runCatching { requestRebind(ComponentName(this,MasarifiNotificationListenerService::class.java)) }
  }

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
    val title = extras.getCharSequence(Notification.EXTRA_TITLE_BIG)?.toString()?.takeIf { it.isNotBlank() }
      ?: extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    // Expanded styles carry the details while compact text can be only a summary.
    val text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.takeIf { it.isNotBlank() }
      ?: extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
        ?.filterNot { it.isNullOrBlank() }?.joinToString("\n")?.takeIf { it.isNotBlank() }
      ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    if (title.isBlank() && text.isBlank()) return@synchronized
    val oversized=title.length+text.length>8000
    val policy=TrackingOwner.policy(state)
    val admission=notificationAdmission(notification.packageName,packageName,true,packages("packages"),blocked,
      policy,title+"\n"+text,
      extras.containsKey(Notification.EXTRA_MESSAGES) || extras.getString(Notification.EXTRA_TEMPLATE)=="android.app.Notification\u0024MessagingStyle")
    val counters=TrackingOwnerPartitions.ownerPreferences(this,"masarifi_tracking_admission_counters","masarifi_tracking_admission_counters_v3")
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
        if(policy?.nominal==true) "default_account_nominal_v1" else "legacy",
        applicationSourceDisplayName(this,notification.packageName),
        state.optString("generation").takeIf {it.length in 16..80}
      ), admission, {NotificationQueue(this).add(it)}, {TrackingScheduler.incoming(this)}
    )} catch(error:Exception) {
      TrackingOwnerPartitions.ownerPreferences(this,"masarifi_notification_queue_v1","masarifi_notification_queue_metadata_v3").edit()
        .putString("captureIssue",if(error.message=="tracking_notification_queue_full") error.message else "tracking_notification_storage_failed").commit()
      android.util.Log.w("MasarifiTracking","Notification retention unavailable")
      TrackingScheduler.incoming(this)
      return@synchronized
    }
    counters.edit().putLong("admitted",counters.getLong("admitted",0)+1).apply()
  }
}
