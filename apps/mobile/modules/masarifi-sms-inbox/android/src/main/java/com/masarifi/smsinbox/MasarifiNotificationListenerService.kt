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
  val nativeKey: String = key
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
  private const val MAX_RECORDS = 200

  fun prune(records: List<CapturedNotification>, now: Long): List<CapturedNotification> =
    records
      .filter { it.postedAt in (now - MAX_AGE_MS)..now }
      .asReversed()
      .distinctBy { it.key }
      .sortedByDescending { it.postedAt }
      .take(MAX_RECORDS)

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
    val stored=readStored()+record
    val pruned=NotificationQueuePolicy.prune(stored,System.currentTimeMillis())
    if(stored.count {it.postedAt>=System.currentTimeMillis()-NotificationQueuePolicy.MAX_AGE_MS}>200) {
      preferences.edit().putLong("overflowCount",preferences.getLong("overflowCount",0)+1).commit()
    }
    write(pruned)
  }

  fun read(limit: Int): List<CapturedNotification> = synchronized(TrackingOwner) {
    val records = NotificationQueuePolicy.prune(readStored(), System.currentTimeMillis())
    write(records)
    records.sortedBy { it.postedAt }.take(limit.coerceIn(1, 100))
  }

  fun acknowledge(keys: Set<String>) = synchronized(TrackingOwner) {
    write(NotificationQueuePolicy.acknowledge(readStored(), keys))
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
            item.optString("nativeKey",key)
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
      )
    }
    encrypted.write(array.toString())
    preferences.edit().remove("records").commit()
  }

  private companion object {
    val lock = Any()
  }
}

class MasarifiNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(notification: StatusBarNotification) = synchronized(TrackingOwner) {
    if (!NotificationCaptureState.isEnabled(this)) return@synchronized
    if (notification.packageName == packageName || !TrackingOwner.allows(this,notification.packageName)) return@synchronized
    val extras = notification.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = (
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)
      )?.toString().orEmpty()
    if ((title.isBlank() && text.isBlank()) || title.length+text.length>8000) return@synchronized
    NotificationQueue(this).add(
      CapturedNotification(
        notification.key+":"+notification.postTime+":"+trackingDigest(title+"\n"+text),
        notification.packageName,
        title,
        text,
        notification.postTime,
        notification.key
      )
    )
    TrackingScheduler.incoming(this)
  }
}
