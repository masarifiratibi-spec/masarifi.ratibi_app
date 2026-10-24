package com.masarifi.smsinbox

import java.text.Normalizer
import java.util.Locale
import org.json.JSONArray
import org.json.JSONObject

enum class NotificationAdmission { DISCARD, TRUSTED, DISCOVERED }

// Admission only: no account choice, successful status, source trust or posting authority.
internal fun notificationAdmission(
  source: String, self: String, enabled: Boolean, trusted: Set<String>, blocked: Set<String>,
  policy: FinancialDiscoveryPolicy?, text: String, messagingStyle: Boolean = false
): NotificationAdmission {
  if (messagingStyle || source.lowercase(Locale.ROOT) in setOf("com.whatsapp","com.whatsapp.w4b","org.telegram.messenger","org.telegram.messenger.web","com.facebook.orca","com.facebook.mlite","com.discord","com.snapchat.android","com.instagram.android","com.google.android.apps.messaging","com.samsung.android.messaging","org.thoughtcrime.securesms","com.viber.voip","com.slack","com.microsoft.teams","com.skype.raider","jp.naver.line.android","com.tencent.mm","com.kakao.talk","im.vector.app","io.element.android.x","com.google.android.apps.dynamite","im.thebot.messenger","com.imo.android.imoim")) return NotificationAdmission.DISCARD
  if (!enabled || source == self || source in blocked || text.isBlank() || text.length > 8000)
    return NotificationAdmission.DISCARD
  if (policy == null) return NotificationAdmission.DISCARD
  if (policy.nominal && !policy.contentAdmission && source !in trusted && !policy.knownPackage(source)) return NotificationAdmission.DISCARD
  if (policy.nominal) return if(policy.isFinancial(text,source)) NotificationAdmission.TRUSTED else NotificationAdmission.DISCARD
  if (source in trusted) return if(policy.isFinancial(text,source)) NotificationAdmission.TRUSTED else NotificationAdmission.DISCARD
  return if (policy.isStrong(text, source)) NotificationAdmission.DISCOVERED
    else NotificationAdmission.DISCARD
}

internal class FinancialDiscoveryPolicy private constructor(
  private val rules: List<JSONObject>, private val currencies: List<JSONObject>,
  private val contexts: List<String>, private val custom: List<String>,
  private val providers: List<JSONObject>, private val marketing: Regex,
  val nominal: Boolean = false, val contentAdmission: Boolean = false
) {
  fun knownPackage(source:String):Boolean = providers.any {source in strings(it.optJSONArray("packages"))}
  fun isStrong(raw:String,sender:String,channel:String="android_notification"): Boolean = inspect(raw,sender,true,channel)
  fun isFinancial(raw:String,sender:String,channel:String="android_notification"): Boolean = inspect(raw,sender,false,channel)

  private fun inspect(raw: String, sender: String, requireMoney:Boolean, channel:String): Boolean {
    if (raw.length > 8000) return false
    // Match the same completed-transfer wording used by notification parsing.
    val text = normalize(raw).replace(Regex("\\byou have received\\b"), "transfer received")
    val country = providers.firstOrNull { (strings(it.optJSONArray("packages"))+strings(it.optJSONArray("senders"))).any { source -> source.equals(sender,ignoreCase=true) } }
      ?.optString("country")
    val matched = rules.filter { rule ->
      rule.optBoolean("enabled") &&
        mapOf("countries" to country, "providers" to sender, "channels" to channel, "locales" to null)
          .all { (field, value) -> strings(rule.optJSONArray(field)).let { values ->
            values.isEmpty() || value != null && values.any { it.equals(value, ignoreCase = true) }
          } } &&
        strings(rule.getJSONArray("any")).any { phrase(text, it) } &&
        strings(rule.optJSONArray("all")).all { phrase(text, it) } &&
        strings(rule.optJSONArray("not")).none { phrase(text, it) }
    }
    if (Regex("\\b(?:use|enter|verification|security|one[ -]time)\\s+(?:the\\s+)?(?:code|password)\\b[^\\n]{0,40}[0-9]{4,8}\\b").containsMatchIn(text) || marketing.containsMatchIn(text) || matched.any {
      it.optString("family") == "exclusion" || it.getJSONObject("effects").optString("disposition") == "ignore"
    }) return false
    val actions = matched.filter { it.optString("family") == "action" }
    val evidence = actions.isNotEmpty() || custom.any { phrase(text, it) } && contexts.any { phrase(text, it) }
    return evidence && (!requireMoney || money(text, actions.maxByOrNull { it.optInt("priority") }
      ?.getJSONObject("effects")?.optString("subtype") == "fee"))
  }

  private fun money(text: String, fee: Boolean): Boolean {
    val aliases = currencies.flatMap { currency -> strings(currency.getJSONArray("aliases"))
      .map { normalize(it) to currency.getInt("scale") } }.sortedByDescending { it.first.length }
    val scales = aliases.toMap()
    val token = aliases.joinToString("|") { Regex.escape(it.first) }
    val number = "[0-9][0-9,]*(?:\\.[0-9]+)?"
    val pattern = Regex("(?<![\\p{L}])(?:($token)\\s*($number)|($number)\\s*($token))(?![\\p{L}])")
    return pattern.findAll(text).any { match ->
      val currency = match.groups[1]?.value ?: match.groups[4]!!.value
      val amount = match.groups[2]?.value ?: match.groups[3]!!.value
      val before = text.substring(maxOf(0, match.range.first - 60), match.range.first)
      val after = text.substring(match.range.last + 1, minOf(text.length, match.range.last + 33))
      val balance = Regex("(?:avl\\.?\\s*(?:cr\\.?\\s*)?(?:bal(?:ance)?|limit)|available\\s+(?:balance|credit(?:\\s+limit)?)|credit\\s+limit|balance|الرصيد|رصيد|الحد\\s+الائتماني|حد\\s+الائتمان)[^.;:،,]*[: ]*$").containsMatchIn(before)
      val feeRole = Regex("(?:fee|fees|charge|commission|رسوم|عمولة)\\s*[: ]*$").containsMatchIn(before)
      val fx = Regex("(?:equivalent|exchange rate|converted|ما يعادل)\\s*[: ]*$").containsMatchIn(before) ||
        Regex("^\\s*(?:equivalent|ما يعادل)").containsMatchIn(after)
      !balance && !fx && (!feeRole || fee) && validAmount(amount,
        if(currency in listOf("ريال","ريالا","دينار","دينارا")) 3 else scales.getValue(currency))
    }
  }

  companion object {
    private fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC)
      .replace(Regex("[\\u064b-\\u065f\\u0670\\u0640]"), "")
      .map { when (it) {
        in '٠'..'٩' -> '0' + (it - '٠')
        in '۰'..'۹' -> '0' + (it - '۰')
        '٫' -> '.'
        '٬' -> ','
        'أ','إ','آ','ٱ' -> 'ا'
        'ى' -> 'ي'
        else -> it
      } }.joinToString("").replace(Regex("[\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]"), "")
      // Android's ICU rejects the JVM-only (?U) flag.
      .replace(Regex("[\\s\\p{Z}\\u0085]+"), " ").trim().lowercase(Locale.ROOT)

    private fun phrase(text: String, raw: String): Boolean {
      val pattern=normalize(raw).split(' ').joinToString(" ") { word ->
        if(Regex("[\\u0600-\\u06ff]").containsMatchIn(word))
          "(?:[وف])?(?:بال|كال|لل|ال|ب|ك|ل)?${Regex.escape(word)}(?:ك|كم|كما|كن|نا|ها|هم|هن|ه|ا)?"
        else Regex.escape(word)
      }
      return Regex("(?<![\\p{L}])$pattern(?![\\p{L}])").containsMatchIn(text)
    }

    private fun validAmount(raw: String, scale: Int): Boolean {
      if (!Regex("^(?:\\d+|\\d{1,3}(?:,\\d{3})+)(?:\\.\\d+)?$").matches(raw)) return false
      val parts = raw.replace(",", "").split('.')
      val fraction = parts.getOrElse(1) { "" }
      if (fraction.length > scale) return false
      val value = (parts[0] + fraction.padEnd(scale, '0')).toLongOrNull() ?: return false
      return value in 1..9007199254740991L
    }

    private fun strings(array: JSONArray?): List<String> =
      if (array == null) emptyList() else (0 until array.length()).map { array.getString(it) }

    fun parse(raw: String?): FinancialDiscoveryPolicy? = runCatching {
      require(raw != null && raw.length <= 262144)
      val value = JSONObject(raw)
      require(value.getInt("version") == 1 && value.getString("engineVersion") == "2.0.0" &&
        value.getString("releaseId").length in 1..100)
      val rulesArray = value.getJSONArray("rules")
      val currencyArray = value.getJSONArray("currencies")
      require(rulesArray.length() in 1..256 && currencyArray.length() in 1..32)
      val rules = (0 until rulesArray.length()).map { rulesArray.getJSONObject(it) }
      rules.forEach { rule ->
        require(rule.getString("family") in listOf("action", "status", "exclusion"))
        rule.getBoolean("enabled")
        rule.getInt("priority")
        rule.getJSONObject("effects")
        require(strings(rule.getJSONArray("any")).size in 1..64)
        listOf("any", "all", "not", "countries", "locales", "providers", "channels").forEach { field ->
          val values = strings(rule.optJSONArray(field))
          require(values.size <= 64 && values.all { it.length in 1..160 })
        }
      }
      val currencies = (0 until currencyArray.length()).map { currencyArray.getJSONObject(it) }
      currencies.forEach {
        require(it.getInt("scale") in 0..3 && strings(it.getJSONArray("aliases")).size in 1..16 &&
          strings(it.getJSONArray("aliases")).all { alias -> alias.length in 1..160 })
      }
      val customArray = value.getJSONArray("custom")
      require(customArray.length() <= 256)
      val custom = (0 until customArray.length()).map { customArray.getJSONObject(it).getString("phrase") }
      val contexts = strings(value.getJSONArray("contexts"))
      require(contexts.size <= 64 && (custom + contexts).all { it.length in 1..160 })
      val providerArray = value.optJSONArray("providers") ?: JSONArray()
      require(providerArray.length() <= 100)
      val providers = (0 until providerArray.length()).map { providerArray.getJSONObject(it) }
      // Structural syntax is fixed; never execute a user-provided regex in the listener.
      FinancialDiscoveryPolicy(rules, currencies, contexts, custom, providers,
        Regex("\\b(?:offer|promo|discount)\\b|(?<![\\p{L}])عرض(?![\\p{L}])|خصم\\s*\\d+\\s*%"),value.optBoolean("nominal",false),
        value.optString("sourceAdmissionPolicy") == "financial_content_v1")
    }.getOrNull()
  }
}
