package com.masarifi.smsinbox

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import androidx.work.Configuration
import androidx.work.testing.WorkManagerTestInitHelper
import androidx.work.testing.TestWorkerBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.Executor
import java.security.Provider
import java.security.Security
import java.security.SecureRandom
import java.security.spec.AlgorithmParameterSpec
import android.security.keystore.KeyGenParameterSpec
import javax.crypto.KeyGeneratorSpi
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** The generated key remains inside the synthetic host key store, as on Android. */
class PartitionKeyGenerator : KeyGeneratorSpi() {
  private lateinit var alias: String
  override fun engineInit(random: SecureRandom?) = error("Key parameters required")
  override fun engineInit(size: Int, random: SecureRandom?) = error("Key parameters required")
  override fun engineInit(parameters: AlgorithmParameterSpec, random: SecureRandom?) {
    alias = (parameters as KeyGenParameterSpec).keystoreAlias
  }
  override fun engineGenerateKey(): SecretKey {
    val key = SecretKeySpec(ByteArray(32).also { SecureRandom().nextBytes(it) }, "AES")
    DeletionKeyStore.entries[alias] = key
    return key
  }
}

/** Real preferences/AES; only AndroidKeyStore's unavailable host boundary is supplied. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class TrackingPartitionAdmissionTest {
  @Test fun sourceRevocationCanFinishWhileIdentityAdmissionStaysSuspended() {
    TrackingOwnerPartitions.prepare(context,TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context,leaseA)
    TrackingOwner.suspend(context)
    TrackingOwnerPartitions.configure(context,leaseA,JSONObject().put("sms",false).put("notification",false))
    assertTrue(TrackingOwner.isSuspended(context))
    assertFalse(TrackingOwner.active(context))
    expectRejected("tracking_owner_lease_stale") {
      TrackingOwnerPartitions.configure(context,leaseB,JSONObject().put("sms",false).put("notification",false))
    }
  }
  private lateinit var context: Context
  private val ownerA = "a".repeat(64)
  private val ownerB = "b".repeat(64)
  private val generationA = "11111111-1111-4111-8111-111111111111"
  private val generationB = "22222222-2222-4222-8222-222222222222"
  private val leaseA get() = TrackingPartitionLease(ownerA, generationA)
  private val leaseB get() = TrackingPartitionLease(ownerB, generationB)
  private fun prefs(name: String) = context.getSharedPreferences(name, Context.MODE_PRIVATE)

  @Before fun setup() {
    context = object : ContextWrapper(RuntimeEnvironment.getApplication()) {
      override fun getPackageName() = "com.masarifi.mobile"
    }
    WorkManagerTestInitHelper.initializeTestWorkManager(context, Configuration.Builder().build())
    Security.insertProviderAt(object : Provider("AndroidKeyStore", 1.0, "Synthetic key boundary") {
      init {
        put("KeyStore.AndroidKeyStore", DeletionKeyStore::class.java.name)
        put("KeyGenerator.AES", PartitionKeyGenerator::class.java.name)
      }
    }, 1)
    for (owner in listOf(ownerA, ownerB)) {
      DeletionKeyStore.entries["masarifi.tracking." + owner] = SecretKeySpec(ByteArray(32) { 1 }, "AES")
      DeletionKeyStore.entries["masarifi.tracking.v3." + owner] = SecretKeySpec(ByteArray(32) { 2 }, "AES")
    }
  }

  @After fun cleanup() {
    Security.removeProvider("AndroidKeyStore")
    DeletionKeyStore.entries.clear()
  }

  private fun seedLegacy(owner: String, generation: String): String {
    val retained = JSONObject().put("owner", owner).put("generation", generation)
      .put("sms", true).put("notification", true).toString()
    prefs("masarifi_tracking_owner_v2").edit().putString("context", retained).commit()
    prefs("masarifi_notification_queue_v2_" + owner).edit().putString("ciphertext", "opaque foreign sentinel").commit()
    prefs("masarifi_notification_queue_v1").edit().putString("records", "unattributed sentinel").commit()
    return retained
  }

  @Test fun currentOwnerCanCommitAnEmptyPartitionWithoutOpeningOrChangingForeignLegacyData() {
    val retained = seedLegacy(ownerB, generationB)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    assertTrue(TrackingOwner.isSuspended(context))
    assertFalse(TrackingOwner.active(context))
    TrackingOwnerPartitions.commit(context, leaseA)
    assertEquals(ownerA, TrackingOwner.read(context).getString("owner"))
    assertFalse(TrackingOwner.active(context))
    assertEquals("[]", TrackingEncryptedStore(context, "masarifi_notification_queue_v2").read() ?: "[]")
    assertEquals(retained, prefs("masarifi_tracking_owner_v2").getString("context", null))
    assertEquals("opaque foreign sentinel", prefs("masarifi_notification_queue_v2_" + ownerB).getString("ciphertext", null))
    assertEquals("unattributed sentinel", prefs("masarifi_notification_queue_v1").getString("records", null))
    assertTrue(DeletionKeyStore.entries.containsKey("masarifi.tracking." + ownerB))
  }

  @Test fun preparationSurvivesRestartWithoutAllowingQueueReadsBeforeAcknowledgement() {
    seedLegacy(ownerB, generationB)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    val restarted = object : ContextWrapper(context) {}
    expectRejected("tracking_suspended") { NotificationQueue(restarted).read(1) }
    assertFalse(TrackingOwner.active(restarted))
    TrackingOwnerPartitions.prepare(restarted, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(restarted, leaseA)
    assertEquals(ownerA, TrackingOwner.read(restarted).getString("owner"))
  }

  @Test fun supersededOwnerCannotCommitReadOrClearTheNewOwnersPartition() {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseB))
    expectRejected("tracking_owner_transition_stale") { TrackingOwnerPartitions.commit(context, leaseA) }
    TrackingOwnerPartitions.commit(context, leaseB)
    expectRejected("tracking_owner_lease_stale") { TrackingOwnerPartitions.assertCurrent(context, leaseA) }
    expectRejected("tracking_owner_lease_stale") { TrackingOwnerPartitions.clear(context, leaseA) }
    assertEquals(ownerB, TrackingOwner.read(context).getString("owner"))
  }

  @Test fun matchingLegacyOwnerCopiesPendingPayloadWithoutChangingItsOriginalCiphertext() {
    val retained = seedLegacy(ownerA, generationA)
    val queue = "[{\"key\":\"public-pending-operation\",\"postedAt\":1}]"
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2", ownerA).write(queue)
    val originalCiphertext = prefs("masarifi_notification_queue_v2_" + ownerA).getString("ciphertext", null)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA, legacyGeneration = generationA))
    TrackingOwnerPartitions.commit(context, leaseA)
    assertEquals(queue, TrackingEncryptedStore(context, "masarifi_notification_queue_v2").read())
    assertEquals(originalCiphertext, prefs("masarifi_notification_queue_v2_" + ownerA).getString("ciphertext", null))
    assertEquals(retained, prefs("masarifi_tracking_owner_v2").getString("context", null))
    assertNotNull(prefs("masarifi_notification_queue_v3_" + ownerA).getString("ciphertext", null))
  }

  @Test fun failedCommitRemainsSuspendedAndCanReconcileTheSamePreparedGeneration() {
    assertInterruptedCommit("masarifi_tracking_owner_v3_" + ownerA)
  }

  @Test fun failedAdmissionCommitCannotActivateAnAlreadyWrittenOwnerContext() {
    assertInterruptedCommit("masarifi_tracking_admission_v3")
  }

  private fun assertInterruptedCommit(failedPreferences: String) {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    val failing = failingContext(failedPreferences)
    expectRejected("tracking_owner_storage_failed") { TrackingOwnerPartitions.commit(failing, leaseA) }
    assertTrue(TrackingOwner.isSuspended(context))
    assertFalse(TrackingOwner.active(context))
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    assertEquals(ownerA, TrackingOwner.read(context).getString("owner"))
  }

  private fun failingContext(failedPreferences: String): Context = object : ContextWrapper(context) {
      override fun getSharedPreferences(name: String, mode: Int): SharedPreferences {
        val storage = super.getSharedPreferences(name, mode)
        if (name != failedPreferences) return storage
        return object : SharedPreferences by storage {
          override fun edit(): SharedPreferences.Editor {
            val editor = storage.edit()
            return object : SharedPreferences.Editor by editor {
              override fun putString(key: String, value: String?): SharedPreferences.Editor {
                editor.putString(key, value)
                return this
              }
              override fun putBoolean(key: String, value: Boolean): SharedPreferences.Editor {
                editor.putBoolean(key, value)
                return this
              }
              override fun clear(): SharedPreferences.Editor { editor.clear(); return this }
              override fun remove(key: String): SharedPreferences.Editor { editor.remove(key); return this }
              override fun commit() = false
            }
          }
        }
      }
  }

  @Test fun staleLegacyCleanupCannotEraseCommittedPartitionOrForeignNamespaces() {
    val retained = seedLegacy(ownerB, generationB)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2").write("[public current work]")
    expectRejected("tracking_owner_transition_required") { TrackingOwner.clear(context) }
    expectRejected("tracking_owner_transition_required") { TrackingOwner.purgeOwner(context, ownerB) }
    assertEquals("[public current work]", TrackingEncryptedStore(context, "masarifi_notification_queue_v2").read())
    TrackingOwnerPartitions.clear(context, leaseA)
    assertTrue(TrackingOwner.isSuspended(context))
    assertEquals(retained, prefs("masarifi_tracking_owner_v2").getString("context", null))
    assertEquals("opaque foreign sentinel", prefs("masarifi_notification_queue_v2_" + ownerB).getString("ciphertext", null))
  }

  @Test fun unknownTargetCiphertextCannotBeAdoptedAsANewPartition() {
    prefs("masarifi_notification_queue_v3_" + ownerA).edit().putString("ciphertext", "unbound sentinel").commit()
    expectRejected("tracking_owner_partition_unavailable") {
      TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    }
    assertFalse(TrackingOwner.active(context))
    assertEquals("unbound sentinel", prefs("masarifi_notification_queue_v3_" + ownerA).getString("ciphertext", null))
  }

  @Test fun sourceSettingsAndAcknowledgementsNeverConsumeLegacyPreferences() {
    seedLegacy(ownerB, generationB)
    val legacy = prefs("masarifi_notification_queue_v1")
    legacy.edit().putString("captureIssue", "legacy issue").putLong("overflowCount", 9).commit()
    prefs("masarifi_notification_capture_v1").edit().putBoolean("enabled", true).commit()
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    assertFalse(NotificationCaptureState.isEnabled(context))
    NotificationCaptureState.setEnabled(context, true)
    NotificationQueue(context).acknowledge(emptySet())
    assertEquals("legacy issue", legacy.getString("captureIssue", null))
    assertEquals(9L, legacy.getLong("overflowCount", 0))
    assertEquals("unattributed sentinel", legacy.getString("records", null))
    assertTrue(prefs("masarifi_notification_capture_v1").getBoolean("enabled", false))
  }

  @Test fun corruptedAdmissionNeverExposesAnActiveNativeOwner() {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    for (generation in listOf("?", generationB)) {
      val wrong = JSONObject().put("owner", ownerA).put("generation", generation).put("phase", "committed")
      prefs("masarifi_tracking_admission_v3").edit().putString("journal", wrong.toString()).putBoolean("suspended", false).commit()
      assertTrue(TrackingOwner.isSuspended(context))
      assertFalse(TrackingOwner.active(context))
      assertEquals("", TrackingOwner.read(context).optString("owner"))
    }
  }

  @Test fun sameOwnerMigrationCreatesOnlyTheCurrentPartitionsMissingKey() {
    seedLegacy(ownerA, generationA)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2", ownerA).write("[public owned operation]")
    DeletionKeyStore.entries.remove("masarifi.tracking.v3." + ownerA)
    val foreignKey = DeletionKeyStore.entries["masarifi.tracking." + ownerB]
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA, legacyGeneration = generationA))
    TrackingOwnerPartitions.commit(context, leaseA)
    assertEquals("[public owned operation]", TrackingEncryptedStore(context, "masarifi_notification_queue_v2").read())
    assertNotNull(DeletionKeyStore.entries["masarifi.tracking.v3." + ownerA])
    assertSame(foreignKey, DeletionKeyStore.entries["masarifi.tracking." + ownerB])
  }

  @Test fun returningToAnAdmittedOwnerNeverRecopiesLegacyOverNewPendingWork() {
    seedLegacy(ownerA, generationA)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2", ownerA).write("[public legacy operation]")
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA, legacyGeneration = generationA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2").write("[public newer operation]")
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseB))
    TrackingOwnerPartitions.commit(context, leaseB)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    assertEquals("[public newer operation]", TrackingEncryptedStore(context, "masarifi_notification_queue_v2").read())
    val next = TrackingPartitionLease(ownerA, generationB)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(next, previousGeneration = generationA))
    TrackingOwnerPartitions.commit(context, next)
    expectRejected("tracking_owner_lease_stale") { TrackingOwnerPartitions.assertCurrent(context, leaseA) }
    assertEquals("[public newer operation]", TrackingEncryptedStore(context, "masarifi_notification_queue_v2").read())
  }

  @Test fun missingRetainedPartitionKeyCannotBeRecreatedOrOverwritePendingCiphertext() {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    val queue = TrackingEncryptedStore(context, "masarifi_notification_queue_v2")
    queue.write("[public retained operation]")
    val retained = prefs("masarifi_notification_queue_v3_" + ownerA).getString("ciphertext", null)
    DeletionKeyStore.entries.remove("masarifi.tracking.v3." + ownerA)
    expectRejected("tracking_owner_key_missing") { queue.read() }
    expectRejected("tracking_owner_key_missing") { queue.write("[public replacement]") }
    assertFalse(DeletionKeyStore.entries.containsKey("masarifi.tracking.v3." + ownerA))
    assertEquals(retained, prefs("masarifi_notification_queue_v3_" + ownerA).getString("ciphertext", null))
  }

  @Test fun explicitCurrentOwnerPurgeRetainsEveryOtherOwnersContextQueueAndKeys() {
    val retained = seedLegacy(ownerB, generationB)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2", ownerA).write("[public A legacy]")
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2").write("[public A current]")
    expectRejected("tracking_owner_lease_stale") { TrackingOwnerPartitions.purge(context, leaseB) }
    TrackingOwnerPartitions.purge(context, leaseA)
    assertFalse(DeletionKeyStore.entries.containsKey("masarifi.tracking.v3." + ownerA))
    assertFalse(DeletionKeyStore.entries.containsKey("masarifi.tracking." + ownerA))
    assertFalse(prefs("masarifi_notification_queue_v3_" + ownerA).contains("ciphertext"))
    assertFalse(prefs("masarifi_notification_queue_v2_" + ownerA).contains("ciphertext"))
    assertEquals(retained, prefs("masarifi_tracking_owner_v2").getString("context", null))
    assertEquals("opaque foreign sentinel", prefs("masarifi_notification_queue_v2_" + ownerB).getString("ciphertext", null))
    assertTrue(DeletionKeyStore.entries.containsKey("masarifi.tracking." + ownerB))
    assertTrue(DeletionKeyStore.entries.containsKey("masarifi.tracking.v3." + ownerB))
  }

  @Test fun interruptedCurrentOwnerPurgeCanFinishWithoutUnlockingOrTouchingForeignData() {
    val retained = seedLegacy(ownerB, generationB)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2").write("[public A current]")
    expectRejected("tracking_owner_storage_failed") {
      TrackingOwnerPartitions.purge(failingContext("masarifi_tracking_owner_v3_" + ownerA), leaseA)
    }
    assertFalse(TrackingOwner.active(context))
    TrackingOwnerPartitions.purge(context, leaseA)
    TrackingOwnerPartitions.purge(context, leaseA)
    assertFalse(DeletionKeyStore.entries.containsKey("masarifi.tracking.v3." + ownerA))
    assertEquals(retained, prefs("masarifi_tracking_owner_v2").getString("context", null))
    assertEquals("opaque foreign sentinel", prefs("masarifi_notification_queue_v2_" + ownerB).getString("ciphertext", null))
  }

  @Test fun completedPurgeGenerationCannotBePreparedAgainAfterProcessReconstruction() {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingOwnerPartitions.purge(context, leaseA)
    expectRejected("tracking_owner_partition_unavailable") {
      TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    }
    assertTrue(prefs("masarifi_tracking_owner_v3_" + ownerA).all.isEmpty())
    assertFalse(TrackingOwner.active(context))
  }

  @Test fun cleanupRecoveryResumesDurablePurgeWithoutOrdinaryAdmission() {
    val retained = seedLegacy(ownerB, generationB)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2").write("[public retained A]")
    expectRejected("tracking_owner_storage_failed") {
      TrackingOwnerPartitions.purge(failingContext("masarifi_tracking_owner_v3_" + ownerA), leaseA)
    }
    expectRejected("tracking_owner_partition_unavailable") { TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA)) }
    expectRejected("tracking_owner_lease_stale") { TrackingOwnerPartitions.resumePurge(context, ownerB, generationB) }
    TrackingOwnerPartitions.resumePurge(context, ownerA, generationA)
    TrackingOwnerPartitions.resumePurge(context, ownerA, generationA)
    TrackingOwnerPartitions.resumePurge(context, ownerA, null)
    assertTrue(prefs("masarifi_tracking_owner_v3_" + ownerA).all.isEmpty())
    assertFalse(TrackingOwner.active(context))
    assertEquals(retained, prefs("masarifi_tracking_owner_v2").getString("context", null))
    assertEquals("opaque foreign sentinel", prefs("masarifi_notification_queue_v2_" + ownerB).getString("ciphertext", null))
    // A later admission may use a new generation, never the completed one.
    val successor = TrackingPartitionLease(ownerA, generationB)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(successor))
    TrackingOwnerPartitions.commit(context, successor)
    expectRejected("tracking_owner_lease_stale") { TrackingOwnerPartitions.resumePurge(context, ownerA, generationA) }
    expectRejected("tracking_owner_lease_stale") { TrackingOwnerPartitions.resumePurge(context, ownerA, null) }
    TrackingOwnerPartitions.assertCurrent(context, successor)
  }

  @Test fun pinnedCleanupCanPurgeAnExistingCommittedPartitionWhileCaptureRemainsSuspended() {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingOwner.suspend(context)
    expectRejected("tracking_owner_lease_stale") { TrackingOwnerPartitions.resumePurge(context, ownerA, generationB) }
    TrackingOwnerPartitions.resumePurge(context, ownerA, generationA)
    assertTrue(prefs("masarifi_tracking_owner_v3_" + ownerA).all.isEmpty())
    assertFalse(TrackingOwner.active(context))
  }

  @Test fun captureRequiresAPolicyAndAValidExplicitConsentBoundary() {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    val policy = JSONObject(javaClass.getResource("/financial-discovery-policy.json")!!.readText())
      .put("nominal", true).put("sourceAdmissionPolicy", "financial_content_v1").toString()
    val now = System.currentTimeMillis()
    for (boundary in listOf(0L, -1L, now + 60_000L)) {
      val configuration = JSONObject().put("sms", false).put("notification", true)
        .put("notificationActivatedAt", boundary).put("discoveryPolicy", policy)
      try { TrackingOwnerPartitions.configure(context, leaseA, configuration); fail("Invalid consent boundary must reject") }
      catch (expected: IllegalArgumentException) { assertEquals("tracking_activation_boundary_required", expected.message) }
      assertFalse(TrackingOwner.active(context))
    }
    val configuration = JSONObject().put("sms", false).put("notification", true).put("notificationActivatedAt", now)
    try { TrackingOwnerPartitions.configure(context, leaseA, configuration); fail("Missing policy must reject") }
    catch (expected: IllegalArgumentException) { assertEquals("tracking_policy_unavailable", expected.message) }
    configuration.put("discoveryPolicy", policy)
    TrackingOwnerPartitions.configure(context, leaseA, configuration)
    assertTrue(TrackingOwner.active(context))
  }

  @Test fun absentCommitReceiptCannotExposeAQueueEvenWithWellFormedContext() {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    prefs("masarifi_tracking_admission_v3").edit().remove("committed:" + ownerA).commit()
    assertTrue(TrackingOwner.isSuspended(context))
    expectRejected("tracking_suspended") { NotificationQueue(context).read(1) }
  }

  @Test fun malformedSelectorCannotResolveAnUnscopedPreferencesPath() {
    val malformed = JSONObject().put("owner", "../unscoped").put("generation", generationA).put("phase", "committed")
    prefs("masarifi_tracking_admission_v3").edit().putString("journal", malformed.toString()).putBoolean("suspended", false).commit()
    assertTrue(TrackingOwner.isSuspended(context))
    assertFalse(TrackingOwner.active(context))
  }

  @Test fun changedPreparedContextCannotCommitAnotherOwnerGenerationOrUnapprovedCapture() {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    val storage = prefs("masarifi_tracking_owner_v3_" + ownerA)
    val original = storage.getString("prepared", null)!!
    for ((field, changed) in listOf("owner" to ownerB, "generation" to generationB, "sms" to true, "notification" to true)) {
      val prepared = JSONObject(original)
      val next = JSONObject(prepared.getString("nextContext")).put(field, changed)
      prepared.put("nextContext", next.toString())
      storage.edit().putString("prepared", prepared.toString()).commit()
      expectRejected("tracking_owner_transition_stale") { TrackingOwnerPartitions.commit(context, leaseA) }
      assertFalse(storage.contains("context"))
      assertTrue(TrackingOwner.isSuspended(context))
    }
  }

  @Test fun changedLegacyProofCannotAdoptUnattributedTargetCiphertext() {
    val foreign = seedLegacy(ownerB, generationB)
    prefs("masarifi_notification_queue_v2_" + ownerA).edit().putString("ciphertext", "unattributed target sentinel").commit()
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    val storage = prefs("masarifi_tracking_owner_v3_" + ownerA)
    val changed = JSONObject(storage.getString("prepared", null)!!).put("legacyContext", foreign)
    storage.edit().putString("prepared", changed.toString()).commit()
    expectRejected("tracking_owner_transition_stale") { TrackingOwnerPartitions.commit(context, leaseA) }
    assertFalse(prefs("masarifi_notification_queue_v3_" + ownerA).contains("ciphertext"))
    assertEquals("unattributed target sentinel", prefs("masarifi_notification_queue_v2_" + ownerA).getString("ciphertext", null))
    assertEquals(foreign, prefs("masarifi_tracking_owner_v2").getString("context", null))
  }

  private fun admitOwnerB(source: String) {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseB))
    TrackingOwnerPartitions.commit(context, leaseB)
    val policy = JSONObject(javaClass.getResource("/financial-discovery-policy.json")!!.readText())
      .put("nominal", true).put("sourceAdmissionPolicy", "financial_content_v1").toString()
    val configuration = JSONObject().put("sms", source == "sms").put("notification", source == "notification")
      .put(source + "ActivatedAt", System.currentTimeMillis()).put("discoveryPolicy", policy)
    TrackingOwnerPartitions.configure(context, leaseB, configuration)
  }

  @Test fun staleNotificationDrainCannotReadRewriteOrScheduleTheCurrentOwnersQueue() {
    admitOwnerB("notification")
    NotificationQueue(context).add(CapturedNotification("public-B", "com.bank.app", "title", "public text", System.currentTimeMillis()))
    val retained = prefs("masarifi_notification_queue_v3_" + ownerB).getString("ciphertext", null)
    val stale = TestWorkerBuilder.from(context, NotificationDrainWorker::class.java, Executor { it.run() })
      .setInputData(workDataOf("ownerDigest" to ownerA, "generation" to generationA)).build()
    stale.doWork()
    assertEquals(retained, prefs("masarifi_notification_queue_v3_" + ownerB).getString("ciphertext", null))
    assertTrue(WorkManager.getInstance(context).getWorkInfosForUniqueWork("masarifi-tracking-incoming").get().isEmpty())
  }

  @Test fun staleSmsContinuationCannotRestartTheCurrentOwnersCancelledWatch() {
    admitOwnerB("sms")
    val manager = WorkManager.getInstance(context)
    val watchName = "masarifi-tracking-sms-v2-" + generationB
    manager.cancelUniqueWork(watchName).result.get()
    val stale = TestWorkerBuilder.from(context, SmsWatchWorker::class.java, Executor { it.run() })
      .setInputData(workDataOf("ownerDigest" to ownerA, "generation" to generationA)).build()
    stale.doWork()
    assertTrue(manager.getWorkInfosForUniqueWork(watchName).get().none { !it.state.isFinished })
  }

  @Test fun interruptedCallerCanRepeatItsCompletedCurrentOwnerCleanup() {
    val retained = seedLegacy(ownerB, generationB)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2").write("[public A current]")
    TrackingOwnerPartitions.clear(context, leaseA)
    TrackingOwnerPartitions.clear(context, leaseA)
    assertTrue(TrackingOwner.isSuspended(context))
    assertFalse(prefs("masarifi_notification_queue_v3_" + ownerA).contains("ciphertext"))
    assertEquals(retained, prefs("masarifi_tracking_owner_v2").getString("context", null))
    assertEquals("opaque foreign sentinel", prefs("masarifi_notification_queue_v2_" + ownerB).getString("ciphertext", null))
  }

  @Test fun cleanupAfterCompletedPurgeDoesNotAffectALaterAdmittedOwner() {
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseA))
    TrackingOwnerPartitions.commit(context, leaseA)
    TrackingOwnerPartitions.purge(context, leaseA)
    TrackingOwnerPartitions.prepare(context, TrackingPartitionTransition(leaseB))
    TrackingOwnerPartitions.commit(context, leaseB)
    TrackingEncryptedStore(context, "masarifi_notification_queue_v2").write("[public B current]")
    val retained = prefs("masarifi_notification_queue_v3_" + ownerB).getString("ciphertext", null)
    TrackingOwnerPartitions.clear(context, leaseA)
    assertEquals(retained, prefs("masarifi_notification_queue_v3_" + ownerB).getString("ciphertext", null))
    assertEquals(ownerB, TrackingOwner.read(context).getString("owner"))
    assertFalse(TrackingOwner.isSuspended(context))
  }

  private fun expectRejected(reason: String, operation: () -> Unit) {
    try { operation(); fail("Operation must reject: " + reason) }
    catch (expected: IllegalStateException) { assertEquals(reason, expected.message) }
  }
}
