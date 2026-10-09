package com.masarifi.smsinbox

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class NotificationQueueTest {
  private val now = 1_800_000_000_000L
  @Test fun UnknownFloodCannotEvictTrustedRecordsAndHasSeparateRetention() {
    val trusted=CapturedNotification("trusted","com.bank","Bank","Purchase SAR5",now-1000)
    val unknown=(1..100).map { CapturedNotification("u-$it","com.unknown.bank","Bank","Purchase SAR5",now-it,
      discovered=true) }
    val expired=CapturedNotification("old-unknown","com.other.bank","Bank","Purchase SAR5",now-25*60*60*1000,
      discovered=true)
    val records=NotificationQueuePolicy.prune(listOf(trusted,expired)+unknown,now)
    assertEquals(11,records.size)
    assertEquals(1,records.count { !it.discovered })
    assertFalse(records.any {it.key=="old-unknown"})
  }
  @Test
  fun keepsRevisionsOfOneNativeNotificationAndAcknowledgesOnlyCommittedRevision() {
    val first=CapturedNotification("native:revision1","com.bank","Bank","Pending",now-1,"native")
    val settled=CapturedNotification("native:revision2","com.bank","Bank","Paid SAR12",now,"native")
    val records=NotificationQueuePolicy.prune(listOf(first,first,settled),now)
    assertEquals(2,records.size)
    assertEquals(listOf(settled),NotificationQueuePolicy.acknowledge(records,setOf(first.key)))
  }

  @Test
  fun capsExpiresAndAcknowledgesRecords() {
    val fresh = (1..201).map { index ->
      CapturedNotification("n-$index", "com.bank", "Bank", "Paid SAR $index", now - index)
    }
    val expired = CapturedNotification(
      "expired",
      "com.bank",
      "Bank",
      "Paid SAR 10",
      now - NotificationQueuePolicy.MAX_AGE_MS - 1
    )

    val pruned = NotificationQueuePolicy.prune(fresh + expired, now)
    assertEquals(200, pruned.size)
    assertFalse(pruned.any { it.key == "expired" })
    assertFalse(
      NotificationQueuePolicy.acknowledge(pruned, setOf("n-1"))
        .any { it.key == "n-1" }
    )
  }
}
