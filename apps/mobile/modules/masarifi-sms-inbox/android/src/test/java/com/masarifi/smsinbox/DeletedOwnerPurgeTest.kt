package com.masarifi.smsinbox

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import androidx.work.Configuration
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.testing.WorkManagerTestInitHelper
import java.io.InputStream
import java.io.OutputStream
import java.security.Key
import java.security.KeyStore
import java.security.KeyStoreSpi
import java.security.Provider
import java.security.Security
import java.security.cert.Certificate
import java.util.Collections
import java.util.Date
import java.util.Enumeration
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
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

/** AndroidKeyStore is unavailable on the host JVM; emulate only that system boundary. */
class DeletionKeyStore : KeyStoreSpi() {
  companion object { val entries = mutableMapOf<String, Key>() }
  override fun engineGetKey(alias: String, password: CharArray?): Key? = entries[alias]
  override fun engineSetKeyEntry(alias: String, key: Key, password: CharArray?, chain: Array<out Certificate>?) { entries[alias] = key }
  override fun engineSetKeyEntry(alias: String, key: ByteArray, chain: Array<out Certificate>?) = error("unsupported")
  override fun engineDeleteEntry(alias: String) { entries.remove(alias) }
  override fun engineContainsAlias(alias: String) = entries.containsKey(alias)
  override fun engineAliases(): Enumeration<String> = Collections.enumeration(entries.keys)
  override fun engineSize() = entries.size
  override fun engineIsKeyEntry(alias: String) = entries.containsKey(alias)
  override fun engineIsCertificateEntry(alias: String) = false
  override fun engineGetCertificate(alias: String): Certificate? = null
  override fun engineGetCertificateChain(alias: String): Array<Certificate>? = null
  override fun engineGetCertificateAlias(certificate: Certificate): String? = null
  override fun engineGetCreationDate(alias: String): Date? = null
  override fun engineSetCertificateEntry(alias: String, certificate: Certificate) = error("unsupported")
  override fun engineLoad(stream: InputStream?, password: CharArray?) {}
  override fun engineStore(stream: OutputStream?, password: CharArray?) {}
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class DeletedOwnerPurgeTest {
  private lateinit var context: Context
  private val deleted = "a".repeat(64)
  private val foreign = "b".repeat(64)
  private val notificationA = "11111111-1111-4111-8111-111111111111"
  private val notificationB = "22222222-2222-4222-8222-222222222222"
  private fun prefs(name: String) = context.getSharedPreferences(name, Context.MODE_PRIVATE)
  private fun queue(owner: String) = prefs("masarifi_notification_queue_v2_" + owner)
  private fun presentations(owner: String) = prefs("masarifi_tracking_presentations_v2_" + owner)
  private fun ownerContext(owner: String) = JSONObject().put("owner", owner).put("generation", "12345678-1234-1234-1234-123456789012")
    .put("sms", true).put("notification", true).toString()
  private fun encrypted(owner: String, json: String): String {
    val key = SecretKeySpec(ByteArray(32) { if (owner == deleted) 1 else 2 }, "AES")
    DeletionKeyStore.entries["masarifi.tracking." + owner] = key
    val iv = ByteArray(12) { 1 }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
    return java.util.Base64.getEncoder().encodeToString(iv + cipher.doFinal(json.toByteArray()))
  }
  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
    WorkManagerTestInitHelper.initializeTestWorkManager(context, Configuration.Builder().build())
    Security.insertProviderAt(object : Provider("DeletionAndroidKeyStore", 1.0, "Test AndroidKeyStore boundary") {
      init { put("KeyStore.AndroidKeyStore", DeletionKeyStore::class.java.name) }
    }, 1)
    queue(deleted).edit().putString("ciphertext", encrypted(deleted, "[public synthetic A]")).commit()
    queue(foreign).edit().putString("ciphertext", encrypted(foreign, "[public synthetic B]")).commit()
    presentations(deleted).edit().putString("ciphertext", encrypted(deleted, JSONObject().put(notificationA, 1).toString())).commit()
    presentations(foreign).edit().putString("ciphertext", encrypted(foreign, JSONObject().put(notificationB, 1).toString())).commit()
    prefs("masarifi_notification_queue_v1").edit().putString("records", "[unattributed legacy]").commit()
    val notifications = context.getSystemService(NotificationManager::class.java)
    notifications.notify(notificationA, 0, Notification.Builder(context).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("A").build())
    notifications.notify(notificationB, 0, Notification.Builder(context).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("B").build())
  }
  @After fun cleanup() { Security.removeProvider("DeletionAndroidKeyStore"); DeletionKeyStore.entries.clear() }

  @Test fun purgeInactiveOwnerPreservesForeignContextWorkKeysAndNotifications() {
    val foreignContext = ownerContext(foreign)
    prefs("masarifi_tracking_owner_v2").edit().putString("context", foreignContext).commit()
    val work = OneTimeWorkRequestBuilder<TrackingWorker>().addTag("masarifi-tracking").build()
    WorkManager.getInstance(context).enqueue(work).result.get()
    val foreignQueue = queue(foreign).all
    val foreignPresentations = presentations(foreign).all

    TrackingOwner.purgeOwner(context, deleted)
    TrackingOwner.purgeOwner(context, deleted)

    assertTrue(queue(deleted).all.isEmpty()); assertTrue(presentations(deleted).all.isEmpty())
    assertFalse(DeletionKeyStore.entries.containsKey("masarifi.tracking." + deleted))
    assertTrue(DeletionKeyStore.entries.containsKey("masarifi.tracking." + foreign))
    assertEquals(foreignQueue, queue(foreign).all); assertEquals(foreignPresentations, presentations(foreign).all)
    assertEquals(foreignContext, prefs("masarifi_tracking_owner_v2").getString("context", null))
    assertFalse(TrackingOwner.isSuspended(context))
    assertNotEquals(WorkInfo.State.CANCELLED, WorkManager.getInstance(context).getWorkInfoById(work.id).get()!!.state)
    assertEquals(listOf(notificationB), context.getSystemService(NotificationManager::class.java).activeNotifications.map { it.tag })
    assertEquals("[unattributed legacy]", prefs("masarifi_notification_queue_v1").getString("records", null))
  }

  @Test fun purgeActiveOwnerSuspendsIntakeAndRemovesOnlyItsPayload() {
    prefs("masarifi_tracking_owner_v2").edit().putString("context", ownerContext(deleted)).commit()
    TrackingOwner.purgeOwner(context, deleted)
    assertTrue(TrackingOwner.isSuspended(context)); assertFalse(TrackingOwner.active(context))
    assertFalse(prefs("masarifi_tracking_owner_v2").contains("context"))
    assertTrue(queue(deleted).all.isEmpty()); assertTrue(presentations(deleted).all.isEmpty())
    assertFalse(DeletionKeyStore.entries.containsKey("masarifi.tracking." + deleted))
    assertTrue(queue(foreign).contains("ciphertext")); assertTrue(presentations(foreign).contains("ciphertext"))
  }
}
