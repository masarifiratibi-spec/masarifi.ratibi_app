package com.masarifi.smsinbox

import org.junit.Assert.*
import org.junit.Test

class SmsInboxPageTest {
  @Test fun blankRowsDoNotAbortFinancialRowsAtTheSameTimestamp() {
    val rows=listOf(SmsInboxRow("1","BANK","Purchase SAR1",100),
      SmsInboxRow("2","BANK","",100),SmsInboxRow("3","BANK","Purchase SAR2",100))
    val page=scanFinancialSmsPage(rows.iterator(),0,"0",100,200) { true }
    assertEquals(2,(page["messages"] as List<*>).size)
    assertEquals(mapOf("receivedAt" to 100L,"id" to "3"),page["lastScanned"])
    assertEquals(false,page["hasMore"])
  }
  @Test fun emptyFilteredPageStillReturnsScannedProgressAndContinuation() {
    val rows=(1..1001).map { SmsInboxRow(it.toString(),"OTHER","nonfinancial",it.toLong()) }
    val page=scanFinancialSmsPage(rows.iterator(),0,"0",100,2000) { false }
    assertEquals(emptyList<Any>(),page["messages"])
    assertEquals(mapOf("receivedAt" to 1000L,"id" to "1000"),page["lastScanned"])
    assertEquals(true,page["hasMore"])
    assertEquals(1000,page["scanned"])
  }
  @Test fun financialLimitDoesNotAdvanceBeyondTheLastExaminedRow() {
    val rows=(1..3).map { SmsInboxRow(it.toString(),"BANK","Purchase SAR1",100) }
    val page=scanFinancialSmsPage(rows.iterator(),100,"0",2,200) { true }
    assertEquals(mapOf("receivedAt" to 100L,"id" to "2"),page["lastScanned"])
    assertEquals(true,page["hasMore"])
  }
}
