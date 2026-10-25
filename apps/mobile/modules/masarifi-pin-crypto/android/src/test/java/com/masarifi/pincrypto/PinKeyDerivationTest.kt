package com.masarifi.pincrypto

import android.os.Build
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [25, 26, 35], manifest = Config.NONE)
class PinKeyDerivationTest {
  private val salt = "000102030405060708090a0b0c0d0e0f"

  @Test fun matchesExistingSha256CredentialsAtTheirStoredCost() {
    // Independent Node/OpenSSL vectors, identical to the existing JS credential format.
    mapOf(
      10_000 to "a9660861d611d46a191971eccf0cc895ee7cd58091c1973ee6d60a5c4f304219",
      120_000 to "8e8969ceadd8a2436d1f93af29a693c244eb6c659390930fc4832f86caab330e",
      120_001 to "5e8c6c189ab90af2d6ba03a168d1c0a440267de25ca69e168d9a8a9b281b8a35"
    ).forEach { (cost, hash) ->
      assertEquals(if (Build.VERSION.SDK_INT < 26) null else hash,
        PinKeyDerivation.derive("123456", salt, cost))
    }
  }

  @Test fun rejectsMalformedInputAndUnboundedWorkWithoutLeakingInputs() {
    listOf(
      Triple("12345", salt, 120_000),
      Triple("１２３４５６", salt, 120_000),
      Triple("123456", "not-a-salt", 120_000),
      Triple("123456", salt, 9_999),
      Triple("123456", salt, 500_001)
    ).forEach { (pin, saltHex, cost) ->
      assertThrows(IllegalArgumentException::class.java) {
        PinKeyDerivation.derive(pin, saltHex, cost)
      }
    }
  }
}
