package com.masarifi.smsinbox

import org.junit.Assert.*
import org.junit.Test

class FinancialDiscoveryPolicyTest {
  @Test fun additionalChatPackagesCannotEnterContentAdmission() {
    val content=FinancialDiscoveryPolicy.parse(org.json.JSONObject(javaClass.getResource("/financial-discovery-policy.json")!!.readText()).put("nominal",true).put("sourceAdmissionPolicy","financial_content_v1").toString())!!
    listOf("org.thoughtcrime.securesms","com.viber.voip","com.Slack","com.microsoft.teams").forEach { source ->
      assertEquals(source,NotificationAdmission.DISCARD,notificationAdmission(source,"com.masarifi.mobile.dev",true,emptySet(),emptySet(),content,"Paid SAR2"))
    }
    assertEquals(NotificationAdmission.DISCARD,notificationAdmission("example.unlisted.chat","com.masarifi.mobile.dev",true,emptySet(),emptySet(),content,"Paid SAR2",true))
  }
  @Test fun scopedContentPolicyAdmitsUnknownFinancialAppsButStillExcludesChatsAndFailures() {
    val raw=org.json.JSONObject(javaClass.getResource("/financial-discovery-policy.json")!!.readText())
      .put("nominal",true).put("sourceAdmissionPolicy","financial_content_v1").toString()
    val content=FinancialDiscoveryPolicy.parse(raw)!!
    assertEquals(NotificationAdmission.TRUSTED,notificationAdmission("example.new.wallet","com.masarifi.mobile.dev",true,emptySet(),emptySet(),content,"Purchase SAR2"))
    assertEquals(NotificationAdmission.DISCARD,notificationAdmission("com.whatsapp","com.masarifi.mobile.dev",true,emptySet(),emptySet(),content,"Purchase SAR2"))
    assertEquals(NotificationAdmission.DISCARD,notificationAdmission("example.new.wallet","com.masarifi.mobile.dev",true,emptySet(),emptySet(),content,"Purchase SAR2 failed"))
    assertEquals(NotificationAdmission.DISCARD,notificationAdmission("example.new.wallet","com.masarifi.mobile.dev",true,emptySet(),setOf("example.new.wallet"),content,"Purchase SAR2"))
  }
  @Test fun chatPackagesNeverReachRetentionEvenWhenTrusted() {
    assertEquals(NotificationAdmission.DISCARD,notificationAdmission("com.whatsapp","com.masarifi.mobile.dev",true,setOf("com.whatsapp"),emptySet(),policy(),"Purchase SAR50"))
  }
  private fun policy(): FinancialDiscoveryPolicy = FinancialDiscoveryPolicy.parse(
    javaClass.getResource("/financial-discovery-policy.json")!!.readText()
  )!!

  @Test fun ArabicEnglishMixedFinancialMoneyPassesWhileWeakContentIsDiscarded() {
    val policy=policy()
    listOf("Purchase SAR 12.50","شراء عبر نقاط بيع مبلغ ١٢٫٥٠ ريال","تم purchase بمبلغ AED۱۲٫۵۰",
      "MyBank alert transaction EGP 5","Purchase SAR 5 pending").forEach {
      assertTrue(it,policy.isStrong(it,"com.unknown.bank"))
    }
    listOf("Hello EGP 5","MyBank alert EGP 5","Purchase. Available Balance SAR 500",
      "OTP 123456 purchase EGP 5","Payment EGP 5 declined","Payment EGP 5 failed",
      "Offer Purchase AED 10 discount","Purchase SAR 0").forEach {
      assertFalse(it,policy.isStrong(it,"com.unknown.bank"))
    }
  }
  @Test fun ExplicitBlockSelfConsentAndInvalidPolicyDiscardBeforeRetention() {
    val policy=policy()
    val decide={pkg:String,enabled:Boolean -> notificationAdmission(pkg,"com.masarifi.mobile.dev",enabled,
      setOf("com.trusted.bank"),setOf("com.blocked.bank"),policy,"Purchase SAR 5")}
    assertEquals(NotificationAdmission.DISCOVERED,decide("com.unknown.bank",true))
    assertEquals(NotificationAdmission.TRUSTED,decide("com.trusted.bank",true))
    assertEquals(NotificationAdmission.DISCARD,decide("com.blocked.bank",true))
    assertEquals(NotificationAdmission.DISCARD,decide("com.masarifi.mobile.dev",true))
    assertEquals(NotificationAdmission.DISCARD,decide("com.unknown.bank",false))
    assertNull(FinancialDiscoveryPolicy.parse("{}"))
    assertEquals(NotificationAdmission.DISCARD,notificationAdmission("com.unknown.bank","com.masarifi.mobile.dev",
      true,emptySet(),emptySet(),null,"Purchase SAR 5"))
  }
  @Test fun IrrelevantUnknownTextNeverReachesPersistenceOrBackgroundWork() {
    var writes=0
    var wakes=0
    val record=CapturedNotification("irrelevant","com.unknown.bank","Chat","Hello EGP5",1)
    assertFalse(retainAdmittedNotification(record,NotificationAdmission.DISCARD,{writes++},{wakes++}))
    assertEquals(0,writes)
    assertEquals(0,wakes)
    assertTrue(retainAdmittedNotification(record.copy(text="Purchase EGP5"),NotificationAdmission.DISCOVERED,
      {assertTrue(it.discovered);writes++},{wakes++}))
    assertEquals(1,writes)
    assertEquals(1,wakes)
  }
  @Test fun TrustDoesNotOverridePrivacyExclusionsOrLifecycleAndMissingPolicyFailsClosed() {
    listOf("OTP 123456 purchase EGP5","Purchase SAR5 failed","Special offer purchase SAR5").forEach { text ->
      assertEquals(text,NotificationAdmission.DISCARD,notificationAdmission("com.trusted.bank","com.masarifi.mobile.dev",
        true,setOf("com.trusted.bank"),emptySet(),policy(),text))
    }
    assertEquals(NotificationAdmission.DISCARD,notificationAdmission("com.trusted.bank","com.masarifi.mobile.dev",
      true,setOf("com.trusted.bank"),emptySet(),null,"Purchase SAR5"))
    assertEquals(NotificationAdmission.TRUSTED,notificationAdmission("com.trusted.bank","com.masarifi.mobile.dev",
      true,setOf("com.trusted.bank"),emptySet(),policy(),"Purchase amount missing"))
  }
}
