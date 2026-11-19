import ExpoModulesCore
import Foundation

private struct Setup: Decodable {
  let owner: String
  let session: String
  let publishableKey: String
  let generation: Int
  let revision: Int
  let title: String
  let savedNotificationBody: String?
  let notificationLocale: String?
  let accounts: [BankSmsTarget]
  let categories: [BankSmsTarget]
  let preferences: BankSmsPreferences?
  let refreshOnly: Bool?
}

public final class MasarifiBankSmsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MasarifiBankSms")
    Events("onVerificationChanged")

    AsyncFunction("takeForegroundNotice") { (owner: String, session: String, identifier: String, promise: Promise) in
      Task { @MainActor in
        promise.resolve(BankSmsService.shared.takeForegroundNotice(owner: owner, session: session, identifier: identifier))
      }
    }

    AsyncFunction("revision") { (promise: Promise) in
      Task { @MainActor in promise.resolve(BankSmsService.shared.revision) }
    }

    AsyncFunction("enable") { (json: String, promise: Promise) in
      Task { @MainActor in
        do {
          let setup = try JSONDecoder().decode(Setup.self, from: Data(json.utf8))
          try await BankSmsService.shared.configure(owner: setup.owner, session: setup.session,
            publishableKey: setup.publishableKey, generation: setup.generation, revision: setup.revision, title: setup.title,
            savedNotificationBody: setup.savedNotificationBody, notificationLocale: setup.notificationLocale,
            accounts: setup.accounts, categories: setup.categories, preferences: setup.preferences,
            refreshOnly: setup.refreshOnly == true)
          promise.resolve()
        } catch { promise.reject("BANK_SMS_SETUP", "Bank SMS setup is unavailable.") }
      }
    }

    AsyncFunction("status") { (owner: String, session: String, promise: Promise) in
      Task { @MainActor in
        do { promise.resolve(try BankSmsService.shared.status(owner: owner, session: session)) }
        catch { promise.reject("BANK_SMS_STATUS", "Bank SMS status is unavailable.") }
      }
    }

    AsyncFunction("retryVerified") { (owner: String, session: String, epoch: String, promise: Promise) in
      Task { @MainActor in
        do {
          try await BankSmsService.shared.retryVerified(owner: owner, session: session, epoch: epoch)
          promise.resolve()
        } catch { promise.reject("BANK_SMS_VERIFY", "The bank message could not be retried.") }
      }
    }

    AsyncFunction("updateNotificationLocale") { (owner: String, session: String, locale: String, promise: Promise) in
      Task { @MainActor in
        do {
          try BankSmsService.shared.updateNotificationLocale(owner: owner, session: session, locale: locale)
          promise.resolve()
        } catch { promise.reject("BANK_SMS_LOCALE", "Save notice language could not be updated.") }
      }
    }

    AsyncFunction("disable") { (owner: String, erase: Bool, promise: Promise) in
      Task { @MainActor in
        do {
          try BankSmsService.shared.disable(owner: owner, erase: erase)
          promise.resolve()
        } catch { promise.reject("BANK_SMS_DISABLE", "Bank SMS could not be disabled.") }
      }
    }

    OnCreate {
      Task { @MainActor in await BankSmsService.shared.removeOldDetailedNotifications() }
      Task { @MainActor [weak self] in
        BankSmsService.shared.verificationChanged = { [weak self] in self?.sendEvent("onVerificationChanged") }
        await BankSmsService.shared.retry()
      }
    }
    OnAppEntersForeground {
      Task { @MainActor in await BankSmsService.shared.retry() }
    }
  }
}
