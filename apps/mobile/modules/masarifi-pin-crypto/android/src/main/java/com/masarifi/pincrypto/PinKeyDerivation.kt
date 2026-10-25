package com.masarifi.pincrypto

import android.os.Build
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

internal object PinKeyDerivation {
  fun derive(pin: String, saltHex: String, iterations: Int): String? {
    require(Regex("[0-9]{6}").matches(pin)) { "Invalid PIN format" }
    require(Regex("[a-f0-9]{32}").matches(saltHex)) { "Invalid PIN salt" }
    require(iterations in 10_000..500_000) { "Invalid PIN derivation cost" }
    // Older Android keeps the existing JS algorithm, never a weaker substitute.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null

    val salt = saltHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    val password = pin.toCharArray()
    val specification = PBEKeySpec(password, salt, iterations, 256)
    try {
      val hash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        .generateSecret(specification).encoded
      return try {
        hash.joinToString("") { (it.toInt() and 0xff).toString(16).padStart(2, '0') }
      } finally {
        hash.fill(0)
      }
    } finally {
      specification.clearPassword()
      password.fill('\u0000')
    }
  }
}
