package com.masarifi.smsinbox

internal data class SmsInboxRow(val id: String, val sender: String, val body: String, val receivedAt: Long)

internal fun scanFinancialSmsPage(
  rows: Iterator<SmsInboxRow>, since: Long, afterId: String, requestedLimit: Int,
  observedAt: Long, admits: (SmsInboxRow) -> Boolean
): Map<String, Any> {
  val messages=mutableListOf<Map<String,Any>>()
  var scanned=0
  var lastTime=since
  var lastId=afterId
  while(scanned<1000 && messages.size<requestedLimit.coerceIn(1,100) && rows.hasNext()) {
    val row=rows.next()
    scanned++
    lastTime=row.receivedAt
    lastId=row.id
    if(row.sender.isBlank() || row.body.isBlank() || !admits(row)) continue
    messages.add(mapOf("id" to row.id,"sender" to row.sender,"body" to row.body,
      "receivedAt" to row.receivedAt,"observedAt" to observedAt))
  }
  return mapOf("version" to 2,"messages" to messages,
    "lastScanned" to mapOf("receivedAt" to lastTime,"id" to lastId),
    "hasMore" to rows.hasNext(),"scanned" to scanned)
}
