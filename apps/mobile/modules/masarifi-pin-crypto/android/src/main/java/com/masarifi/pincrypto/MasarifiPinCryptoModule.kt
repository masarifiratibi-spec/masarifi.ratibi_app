package com.masarifi.pincrypto

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MasarifiPinCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MasarifiPinCrypto")

    // Expo AsyncFunction runs the expensive KDF off the JS/UI threads.
    AsyncFunction("derivePinHash") { pin: String, saltHex: String, iterations: Int ->
      PinKeyDerivation.derive(pin, saltHex, iterations)
    }
  }
}
