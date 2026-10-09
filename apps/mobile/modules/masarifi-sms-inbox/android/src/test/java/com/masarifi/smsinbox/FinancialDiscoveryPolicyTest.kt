package com.masarifi.smsinbox

import org.junit.Assert.*
import org.junit.Test

class FinancialDiscoveryPolicyTest {
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
}
