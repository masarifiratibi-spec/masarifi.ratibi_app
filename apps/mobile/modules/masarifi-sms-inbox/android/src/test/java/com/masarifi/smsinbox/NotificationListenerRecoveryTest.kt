package com.masarifi.smsinbox

import android.app.Notification
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.service.notification.NotificationListenerService
import androidx.work.Configuration
import androidx.work.testing.WorkManagerTestInitHelper
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowNotificationListenerService
import java.io.InputStream
import java.io.OutputStream
import java.security.Key
import java.security.KeyStoreSpi
import java.security.Provider
import java.security.Security
import java.security.cert.Certificate
import java.util.Collections
import java.util.Date
import javax.crypto.spec.SecretKeySpec

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], packageName = "com.masarifi.mobile.dev")
class NotificationListenerRecoveryTest {
  private lateinit var service: MasarifiNotificationListenerService

  @Before fun setup() {
    service=Robolectric.buildService(MasarifiNotificationListenerService::class.java).create().get()
    Security.addProvider(object: Provider("NotificationTestKeys",1.0,"Synthetic test key only") {
      init { put("KeyStore.AndroidKeyStore",NotificationTestKeyStore::class.java.name) }
    })
    WorkManagerTestInitHelper.initializeTestWorkManager(service,Configuration.Builder().build())
    val policy=JSONObject(javaClass.getResource("/financial-discovery-policy.json")!!.readText())
      .put("nominal",true).put("sourceAdmissionPolicy","financial_content_v1")
    service.getSharedPreferences("masarifi_tracking_owner_v2",Context.MODE_PRIVATE).edit()
      .putString("context",JSONObject().put("owner","a".repeat(64)).put("notification",true)
        .put("notificationActivatedAt",0).put("discoveryPolicy",policy.toString()).toString()).commit()
    NotificationCaptureState.setEnabled(service,true)
  }

  @After fun cleanup() { Security.removeProvider("NotificationTestKeys") }

  private fun installSource(label: String) {
    shadowOf(service.packageManager).installPackage(PackageInfo().apply {
      packageName="example.synthetic.wallet"
      applicationInfo=ApplicationInfo().apply {
        packageName="example.synthetic.wallet"
        nonLocalizedLabel=label
      }
    })
  }

  private fun stored(): JSONArray = JSONArray(TrackingEncryptedStore(service,"masarifi_notification_queue_v2").read())

  @Test fun reconnectPersistsFinancialActivityWithTheInstalledApplicationLabel() {
    installSource("  Synthetic Wallet\n\u0000  ")
    val listener: NotificationListenerService=service
    shadowOf(listener).addActiveNotification("example.synthetic.wallet",2,
      Notification.Builder(service).setContentTitle("Transfer received")
        .setContentText("You have received 2.00 EGP from private@example").build())
    service.onListenerConnected()
    val record=stored().getJSONObject(0)
    assertEquals("Synthetic Wallet",record.optString("sourceDisplayName"))
    assertEquals("Transfer received",record.getString("title"))
    assertEquals("You have received 2.00 EGP from private@example",record.getString("text"))
    val firstKey=record.getString("key")
    service.onListenerConnected()
    assertEquals(1,NotificationQueue(service).read(100).size)
    assertEquals(firstKey,stored().getJSONObject(0).getString("key"))
    assertEquals("Synthetic Wallet",stored().getJSONObject(0).getString("sourceDisplayName"))
    val ciphertext=service.getSharedPreferences("masarifi_notification_queue_v2_"+"a".repeat(64),Context.MODE_PRIVATE)
      .getString("ciphertext",null)!!
    assertFalse(ciphertext.contains("Synthetic Wallet"))
    assertFalse(ciphertext.contains("private@example"))
    assertTrue(service.getSharedPreferences("masarifi_notification_queue_v1",Context.MODE_PRIVATE).getString("captureIssue",null)==null)
  }

  @Test fun readingOlderQueuedActivityResolvesAndPersistsABoundedSourceLabel() {
    installSource("x".repeat(120))
    TrackingEncryptedStore(service,"masarifi_notification_queue_v2").write("""[
      {"key":"legacy","packageName":"example.synthetic.wallet","title":"Transfer received","text":"Received EGP 2","postedAt":1}
    ]""")
    assertEquals(1,NotificationQueue(service).read(10).size)
    assertEquals("x".repeat(100),stored().getJSONObject(0).optString("sourceDisplayName"))
  }

  @Test fun missingApplicationLabelDoesNotUseNotificationContentAsTheSource() {
    NotificationQueue(service).add(CapturedNotification("missing","example.missing.wallet","Private Person","Received EGP 2",1))
    assertEquals(1,NotificationQueue(service).read(10).size)
    assertFalse(stored().getJSONObject(0).has("sourceDisplayName"))
  }

  @Test fun reconnectUsesTheExistingAdmissionFilterForActiveNotifications() {
    val listener:NotificationListenerService=service
    shadowOf(listener).addActiveNotification("example.new.wallet",1,
      Notification.Builder(service).setContentTitle("Wallet").setContentText("Hello, no financial activity").build())
    service.onListenerConnected()
    assertEquals(1,service.getSharedPreferences("masarifi_tracking_admission_counters",Context.MODE_PRIVATE).getLong("discarded",0))
  }

  @Test fun disconnectedListenerRebindsOnlyWhileCaptureRemainsEnabled() {
    val before=ShadowNotificationListenerService.getRebindRequestCount()
    service.onListenerDisconnected()
    assertEquals(before+1,ShadowNotificationListenerService.getRebindRequestCount())
    NotificationCaptureState.setEnabled(service,false)
    service.onListenerDisconnected()
    assertEquals(before+1,ShadowNotificationListenerService.getRebindRequestCount())
  }
}

/** Supplies only Android's unavailable key storage boundary; the real AES/GCM store and queue run. */
class NotificationTestKeyStore: KeyStoreSpi() {
  override fun engineGetKey(alias: String?, password: CharArray?): Key = SecretKeySpec(ByteArray(32),"AES")
  override fun engineLoad(stream: InputStream?, password: CharArray?) {}
  override fun engineStore(stream: OutputStream?, password: CharArray?) {}
  override fun engineGetCertificateChain(alias: String?): Array<Certificate>? = null
  override fun engineGetCertificate(alias: String?): Certificate? = null
  override fun engineGetCreationDate(alias: String?): Date? = null
  override fun engineSetKeyEntry(alias: String?, key: Key?, password: CharArray?, chain: Array<Certificate>?) {}
  override fun engineSetKeyEntry(alias: String?, key: ByteArray?, chain: Array<Certificate>?) {}
  override fun engineSetCertificateEntry(alias: String?, cert: Certificate?) {}
  override fun engineDeleteEntry(alias: String?) {}
  override fun engineAliases() = Collections.emptyEnumeration<String>()
  override fun engineContainsAlias(alias: String?) = true
  override fun engineSize() = 1
  override fun engineIsKeyEntry(alias: String?) = true
  override fun engineIsCertificateEntry(alias: String?) = false
  override fun engineGetCertificateAlias(cert: Certificate?): String? = null
}
