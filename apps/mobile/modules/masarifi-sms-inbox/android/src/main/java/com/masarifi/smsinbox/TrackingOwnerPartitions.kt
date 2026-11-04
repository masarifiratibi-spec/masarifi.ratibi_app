package com.masarifi.smsinbox

import android.content.Context
import org.json.JSONException
import org.json.JSONObject

internal data class TrackingPartitionLease(val owner: String, val generation: String) {
  init { require(owner.matches(Regex("[a-f0-9]{64}")) && generation.length in 16..80) }
}

internal data class TrackingPartitionTransition(
  val lease: TrackingPartitionLease,
  val previousGeneration: String? = null,
  val legacyGeneration: String? = null
)

internal object TrackingOwnerPartitions {
  private const val ADMISSION = "masarifi_tracking_admission_v3"
  private const val OWNER_PREFIX = "masarifi_tracking_owner_v3_"
  private val encryptedNamespaces = listOf("masarifi_notification_queue_v2", "masarifi_tracking_presentations_v2")
  private fun admission(context: Context) = context.getSharedPreferences(ADMISSION, Context.MODE_PRIVATE)
  private fun ownerStorage(context: Context, owner: String) = context.getSharedPreferences(OWNER_PREFIX + owner, Context.MODE_PRIVATE)
  private fun parsed(raw: String?): JSONObject? = try { raw?.let(::JSONObject) } catch (_: JSONException) { null }
  private fun journal(context: Context) = parsed(admission(context).getString("journal", null))
  private fun matches(record: JSONObject?, lease: TrackingPartitionLease) =
    record?.optString("owner") == lease.owner && record.optString("generation") == lease.generation
  private fun leaseFields(record: JSONObject?): Boolean = record != null &&
    record.opt("owner") is String && record.optString("owner").matches(Regex("[a-f0-9]{64}")) &&
    record.opt("generation") is String && record.optString("generation").length in 16..80
  private fun leaseContext(record: JSONObject?): Boolean = leaseFields(record) &&
    record != null &&
    record.opt("sms") is Boolean && record.opt("notification") is Boolean

  fun exists(context: Context) = admission(context).contains("journal")

  private fun selectedContext(context: Context): JSONObject? {
    val selected = journal(context) ?: return null
    if (!leaseFields(selected) || admission(context).getString("committed:" + selected.getString("owner"), null) != selected.getString("generation"))
      return null
    val scoped = parsed(ownerStorage(context, selected.optString("owner")).getString("context", null))
    return scoped?.takeIf { leaseContext(it) && it.optString("owner") == selected.optString("owner") &&
      it.optString("generation") == selected.optString("generation") }
  }

  // Conservative native readers expose no active capability for corrupt or incomplete admission.
  fun isSuspended(context: Context): Boolean {
    val selected = journal(context)
    return admission(context).getBoolean("suspended", true) || selected?.optString("phase") != "committed" ||
      selectedContext(context) == null
  }

  fun read(context: Context): JSONObject {
    val scoped = selectedContext(context) ?: return JSONObject()
    return scoped.also { if (isSuspended(context)) it.put("sms", false).put("notification", false) }
  }

  fun ownerPreferences(context: Context, legacyName: String, partitionName: String): android.content.SharedPreferences {
    if (!exists(context)) return context.getSharedPreferences(legacyName, Context.MODE_PRIVATE)
    check(!isSuspended(context)) { "tracking_owner_lease_stale" }
    return context.getSharedPreferences(partitionName + "_" + read(context).getString("owner"), Context.MODE_PRIVATE)
  }

  fun permitsKeyCreation(context: Context, owner: String): Boolean {
    val selected = journal(context) ?: return false
    if (selected.optString("owner") != owner) return false
    if (selected.optString("phase") == "committed") return !isSuspended(context) && selectedContext(context) != null
    if (selected.optString("phase") != "prepared") return false
    val prepared = parsed(ownerStorage(context, owner).getString("prepared", null)) ?: return false
    return prepared.optString("owner") == owner && prepared.optString("generation") == selected.optString("generation") &&
      leaseContext(parsed(prepared.optString("nextContext")))
  }

  fun suspend(context: Context) {
    check(admission(context).edit().putBoolean("suspended", true).commit()) { "tracking_owner_storage_failed" }
  }

  fun prepare(context: Context, transition: TrackingPartitionTransition): Unit = synchronized(TrackingOwner) {
    TrackingOwner.suspend(context)
    val lease = transition.lease
    check(!admission(context).contains("purging:" + lease.owner)) { "tracking_owner_partition_unavailable" }
    val next = preparedRecord(context, transition)
    check(ownerStorage(context, lease.owner).edit().putString("prepared", next.toString()).commit()) { "tracking_owner_storage_failed" }
    select(context, lease, "prepared", true)
  }

  private data class PartitionSnapshot(val raw: String?, val stored: JSONObject?, val committed: Boolean, val prepared: JSONObject?)

  private fun partitionSnapshot(context: Context, owner: String): PartitionSnapshot {
    val storage = ownerStorage(context, owner)
    val raw = storage.getString("context", null)
    val stored = parsed(raw)
    val committed = leaseContext(stored) && admission(context).getString("committed:" + owner, null) == stored!!.optString("generation")
    return PartitionSnapshot(raw, stored, committed, parsed(storage.getString("prepared", null)))
  }

  private fun preparedRecord(context: Context, transition: TrackingPartitionTransition): JSONObject {
    val lease = transition.lease
    val snapshot = partitionSnapshot(context, lease.owner)
    val prepared = snapshot.prepared
    if (!snapshot.committed && matches(prepared, lease)) {
      check(snapshot.raw == prepared!!.opt("previousContext") as? String || snapshot.raw == prepared.getString("nextContext")) {
        "tracking_owner_partition_unavailable"
      }
      return prepared
    }
    requireTransitionTarget(context, transition, snapshot)
    return transitionRecord(context, transition, snapshot.raw, snapshot.committed)
  }

  private fun requireTransitionTarget(context: Context, transition: TrackingPartitionTransition, snapshot: PartitionSnapshot) {
    val lease = transition.lease
    check(snapshot.committed || snapshot.raw == null && snapshot.prepared == null && !hasUnboundCiphertext(context, lease.owner)) {
      "tracking_owner_partition_unavailable"
    }
    if (!snapshot.committed) return
    val stored = snapshot.stored!!
    check(stored.optString("owner") == lease.owner &&
      (stored.optString("generation") == lease.generation || stored.optString("generation") == transition.previousGeneration)) {
      "tracking_owner_partition_unavailable"
    }
  }

  private fun hasUnboundCiphertext(context: Context, owner: String) = encryptedNamespaces.any {
    context.getSharedPreferences(it.removeSuffix("_v2") + "_v3_" + owner, Context.MODE_PRIVATE).contains("ciphertext")
  }

  private fun transitionRecord(context: Context, transition: TrackingPartitionTransition, previous: String?, committed: Boolean): JSONObject {
    val lease = transition.lease
    val legacy = if (!committed && transition.legacyGeneration != null) verifiedLegacy(context, transition) else null
    val next = parsed(previous ?: legacy) ?: JSONObject()
    next.put("owner", lease.owner).put("generation", lease.generation).put("sms", false).put("notification", false)
    return JSONObject().put("owner", lease.owner).put("generation", lease.generation)
      .put("previousContext", previous ?: JSONObject.NULL).put("nextContext", next.toString())
      .put("legacyContext", legacy ?: JSONObject.NULL)
  }

  private fun verifiedLegacy(context: Context, transition: TrackingPartitionTransition): String {
    val raw = context.getSharedPreferences("masarifi_tracking_owner_v2", Context.MODE_PRIVATE).getString("context", null)
    val retained = parsed(raw)
    check(leaseContext(retained) && retained!!.optString("owner") == transition.lease.owner &&
      retained.optString("generation") == transition.legacyGeneration) { "tracking_owner_partition_unavailable" }
    return raw!!
  }

  fun commit(context: Context, lease: TrackingPartitionLease): Unit = synchronized(TrackingOwner) {
    val selected = journal(context)
    check(matches(selected, lease)) { "tracking_owner_transition_stale" }
    if (selected!!.optString("phase") == "committed") {
      assertCurrent(context, lease)
      return@synchronized
    }
    check(selected.optString("phase") == "prepared") { "tracking_owner_transition_stale" }
    val storage = ownerStorage(context, lease.owner)
    val prepared = parsed(storage.getString("prepared", null))
    check(matches(prepared, lease)) { "tracking_owner_transition_stale" }
    val nextContext = preparedContext(prepared!!, lease)
    val rawContext = storage.getString("context", null)
    check(rawContext == prepared.opt("previousContext") as? String || rawContext == nextContext) { "tracking_owner_transition_stale" }
    copyVerifiedLegacy(context, lease, prepared.opt("legacyContext") as? String)
    check(storage.edit().putString("context", nextContext).commit()) { "tracking_owner_storage_failed" }
    select(context, lease, "committed", false)
  }

  private fun preparedContext(prepared: JSONObject, lease: TrackingPartitionLease): String {
    val raw = prepared.opt("nextContext") as? String
    val next = parsed(raw)
    check(leaseContext(next) && matches(next, lease) && !next!!.getBoolean("sms") && !next.getBoolean("notification")) {
      "tracking_owner_transition_stale"
    }
    val previousRaw = prepared.opt("previousContext") as? String
    if (previousRaw != null) {
      val previous = parsed(previousRaw)
      check(leaseContext(previous) && previous!!.optString("owner") == lease.owner) { "tracking_owner_transition_stale" }
    }
    return raw!!
  }

  private fun copyVerifiedLegacy(context: Context, lease: TrackingPartitionLease, legacy: String?) {
    if (legacy == null) return
    val source = parsed(legacy)
    check(leaseContext(source) && source!!.optString("owner") == lease.owner &&
      context.getSharedPreferences("masarifi_tracking_owner_v2", Context.MODE_PRIVATE).getString("context", null) == legacy) {
      "tracking_owner_transition_stale"
    }
    for (namespace in encryptedNamespaces) {
      val retained = TrackingEncryptedStore(context, namespace, lease.owner, 2).read() ?: continue
      val destination = TrackingEncryptedStore(context, namespace, lease.owner, 3)
      val copied = destination.read()
      check(copied == null || copied == retained) { "tracking_owner_partition_unavailable" }
      if (copied == null) destination.write(retained)
    }
  }

  private fun select(context: Context, lease: TrackingPartitionLease, phase: String, suspended: Boolean) {
    val selected = JSONObject().put("owner", lease.owner).put("generation", lease.generation).put("phase", phase)
    val editor = admission(context).edit().putString("journal", selected.toString()).putBoolean("suspended", suspended)
    if (phase == "committed") editor.putString("committed:" + lease.owner, lease.generation)
    check(editor.commit()) { "tracking_owner_storage_failed" }
  }

  fun assertCurrent(context: Context, lease: TrackingPartitionLease) {
    check(matches(journal(context), lease) && !isSuspended(context) && matches(read(context), lease)) {
      "tracking_owner_lease_stale"
    }
  }

  fun configure(context: Context, lease: TrackingPartitionLease, configuration: JSONObject): Unit = synchronized(TrackingOwner) {
    assertCurrent(context, lease)
    require(configuration.opt("sms") is Boolean && configuration.opt("notification") is Boolean)
    val enabledSources = listOf("sms", "notification").filter { configuration.getBoolean(it) }
    val now = System.currentTimeMillis()
    require(enabledSources.all { configuration.optLong(it + "ActivatedAt", 0) in 1..now }) { "tracking_activation_boundary_required" }
    val policy = FinancialDiscoveryPolicy.parse(configuration.optString("discoveryPolicy"))
    require(enabledSources.isEmpty() || policy != null) { "tracking_policy_unavailable" }
    require(policy?.contentAdmission != true || supportsFinancialContentCapture(context))
    val scoped = JSONObject(configuration.toString()).put("owner", lease.owner).put("generation", lease.generation)
    check(ownerStorage(context, lease.owner).edit().putString("context", scoped.toString()).commit()) { "tracking_owner_storage_failed" }
    TrackingScheduler.configure(context)
  }

  fun clear(context: Context, lease: TrackingPartitionLease): Unit = synchronized(TrackingOwner) {
    val registry = admission(context)
    if (registry.getString("purged:" + lease.owner, null) == lease.generation) return@synchronized
    val selected = journal(context)
    check(matches(selected, lease) && selected!!.optString("phase") == "committed" &&
      matches(selectedContext(context), lease) && !registry.contains("purging:" + lease.owner)) { "tracking_owner_lease_stale" }
    check(context.getSharedPreferences("masarifi_notification_capture_v3_" + lease.owner, Context.MODE_PRIVATE)
      .edit().putBoolean("enabled", false).commit()) { "tracking_owner_storage_failed" }
    suspend(context)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2", lease.owner, 3).clear()
    val scoped = parsed(ownerStorage(context, lease.owner).getString("context", null))!!
    scoped.put("sms", false).put("notification", false)
    check(ownerStorage(context, lease.owner).edit().putString("context", scoped.toString()).commit()) { "tracking_owner_storage_failed" }
    androidx.work.WorkManager.getInstance(context).cancelAllWorkByTag("masarifi-tracking")
  }

  fun purge(context: Context, lease: TrackingPartitionLease): Unit = synchronized(TrackingOwner) {
    check(context.packageName in listOf("com.masarifi.mobile", "com.masarifi.mobile.dev", "com.masarifi.mobile.dev.privacy")) {
      "privacy_development_required"
    }
    val registry = admission(context)
    if (registry.getString("purged:" + lease.owner, null) == lease.generation) return@synchronized
    check(matches(journal(context), lease)) { "tracking_owner_lease_stale" }
    if (registry.getString("purging:" + lease.owner, null) != lease.generation) assertCurrent(context, lease)
    check(registry.edit().putString("purging:" + lease.owner, lease.generation).putBoolean("suspended", true).commit()) {
      "tracking_owner_storage_failed"
    }
    eraseOwnerPartition(context, lease.owner)
    finishOwnerPurge(context, lease)
    androidx.work.WorkManager.getInstance(context).cancelAllWorkByTag("masarifi-tracking")
  }

  private fun eraseOwnerPartition(context: Context, owner: String) {
    cancelPresentations(context, owner)
    TrackingOwner.purgeLegacyOwner(context, owner)
    for (namespace in encryptedNamespaces) TrackingEncryptedStore(context, namespace, owner, 3).clear()
    for (prefix in listOf("masarifi_notification_capture_v3_", "masarifi_notification_queue_metadata_v3_", "masarifi_tracking_admission_counters_v3_")) {
      check(context.getSharedPreferences(prefix + owner, Context.MODE_PRIVATE).edit().clear().commit()) { "tracking_owner_storage_failed" }
    }
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    keys.deleteEntry("masarifi.tracking.v3." + owner)
    check(!keys.containsAlias("masarifi.tracking.v3." + owner)) { "tracking_owner_storage_failed" }
  }

  private fun finishOwnerPurge(context: Context, lease: TrackingPartitionLease) {
    check(ownerStorage(context, lease.owner).edit().clear().commit()) { "tracking_owner_storage_failed" }
    val closed = JSONObject().put("owner", lease.owner).put("generation", lease.generation).put("phase", "purged")
    check(admission(context).edit().putString("journal", closed.toString()).putString("purged:" + lease.owner, lease.generation)
      .remove("purging:" + lease.owner).remove("committed:" + lease.owner).putBoolean("suspended", true).commit()) { "tracking_owner_storage_failed" }
  }

  private fun cancelPresentations(context: Context, owner: String) {
    val retained = TrackingEncryptedStore(context, "masarifi_tracking_presentations_v2", owner, 3).read() ?: return
    val identifiers = JSONObject(retained).keys().asSequence().toList()
    require(identifiers.all { it.matches(Regex("[a-fA-F0-9-]{36}")) })
    val notifications = context.getSystemService(android.app.NotificationManager::class.java)
    identifiers.forEach { notifications.cancel(it, 0) }
  }
}
