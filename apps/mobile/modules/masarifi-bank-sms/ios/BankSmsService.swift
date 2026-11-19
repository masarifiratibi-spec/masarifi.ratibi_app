import ClerkKit
import CryptoKit
import Foundation
import JavaScriptCore
import UserNotifications

private struct ExpoClerkHeaders: ClerkRequestMiddleware {
  func prepare(_ request: inout URLRequest) async throws {
    request.addValue("expo", forHTTPHeaderField: "x-clerk-host-sdk")
    if let version = Bundle.main.object(forInfoDictionaryKey: "ClerkExpoVersion") as? String {
      request.addValue(version, forHTTPHeaderField: "x-clerk-host-sdk-version")
    }
  }
}

private struct ParsedBankSms: Decodable {
  let accountId: String
  let categoryId: String?
  let destinationAccountId: String?
  let bankReference: String?
  let originalReference: String?
  let kind: String
  let amountMinor: Int64
  let currency: String
  let occurredAt: String
  let textIdentity: String
  let referenceIdentity: String?
  let stableReferenceIdentity: String?

  static func parse(_ text: String, at date: Date, routing: [String: Any]) throws -> ParsedBankSms? {
    guard !text.isEmpty, text.utf16.count <= 2000 else { return nil }
    guard let url = Bundle.main.url(forResource: "MasarifiBankSmsParser", withExtension: "js"),
          let context = JSContext()
    else { throw BankSmsFailure.unavailable }
    context.exceptionHandler = { _, _ in } // A parser exception may include source text.
    context.evaluateScript(try String(contentsOf: url, encoding: .utf8))
    guard let value = context.objectForKeyedSubscript("masarifiClassifyBankSms")?.call(withArguments: [
      text, date.timeIntervalSince1970 * 1000, TimeZone.current.identifier, routing
    ]), !value.isUndefined else { throw BankSmsFailure.unavailable }
    if value.isNull { return nil }
    guard let object = value.toDictionary() else { throw BankSmsFailure.unavailable }
    let data = try JSONSerialization.data(withJSONObject: object)
    return try JSONDecoder().decode(Self.self, from: data)
  }
}

public struct BankSmsChoice: Sendable {
  public let id: String
  public let name: String
}

@MainActor public final class BankSmsService {
  public static let shared = BankSmsService()
  private let store = BankSmsStore()
  private let ledger = BankSmsLedger()
  private let replayWindow: TimeInterval = 24 * 60 * 60
  private var draining = false
  private(set) var revision = 0
  private var revokedOwners = Set<String>()
  private var clerk: Clerk?

  public func choices(kind: String, identifiers: [String]? = nil) async -> [BankSmsChoice] {
    guard let enrollment = try? store.load().enrollment,
          !revokedOwners.contains(enrollment.owner) else { return [] }
    let choices = kind == "account" ? enrollment.accounts : enrollment.categories
    if let identifiers {
      // Shortcuts resolves configured IDs before perform(), including when offline.
      return choices.filter { identifiers.contains($0.id) }.map {
        BankSmsChoice(id: $0.id, name: $0.name)
      }
    }
    guard (try? await token(for: enrollment)) != nil else { return [] }
    return choices.map { BankSmsChoice(id: $0.id, name: $0.name) }
  }

  func configure(owner: String, session: String, publishableKey: String,
                 generation: Int, revision: Int, title: String, savedNotificationBody: String?, notificationLocale: String?,
                 accounts: [BankSmsTarget], categories: [BankSmsTarget], preferences: BankSmsPreferences?,
                 refreshOnly: Bool) async throws {
    guard self.revision == revision, !owner.isEmpty, !session.isEmpty, publishableKey.hasPrefix("pk_live_"), generation >= 0,
          !accounts.isEmpty, !categories.isEmpty,
          accounts.allSatisfy({ UUID(uuidString: $0.id) != nil && $0.currency != nil }),
          categories.allSatisfy({ UUID(uuidString: $0.id) != nil && ["income", "expense"].contains($0.kind) })
    else { throw BankSmsFailure.rejected }
    guard Bundle.main.url(forResource: "MasarifiBankSmsParser", withExtension: "js") != nil
    else { throw BankSmsFailure.unavailable }
    let existing = try store.load().enrollment
    if refreshOnly && (existing?.owner != owner || existing?.session != session ||
                       existing?.generation != generation) { throw BankSmsFailure.disabled }
    let matching = existing.flatMap { value in
      value.owner == owner && value.session == session && value.generation == generation ? value : nil
    }
    var enrollment = BankSmsEnrollment(owner: owner, session: session, publishableKey: publishableKey,
                                       generation: generation,
                                       epoch: matching?.epoch ?? UUID(),
                                       accounts: accounts,
                                       categories: categories, preferences: preferences, title: title, savedNotificationBody: savedNotificationBody,
                                       notificationLocale: notificationLocale)
    _ = try await refreshSession(enrollment)
    guard self.revision == revision else { throw BankSmsFailure.disabled }
    var state = try store.load()
    if state.owner != owner || (state.generation ?? state.enrollment?.generation).map({ $0 != generation }) == true {
      state = BankSmsState()
    }
    state.generation = generation
    if state.enrollment?.generation != generation || state.enrollment?.session != session {
      discardPending(in: &state)
    }
    if refreshOnly, let currentLocale = state.enrollment?.notificationLocale {
      enrollment.notificationLocale = currentLocale
    }
    state.owner = owner
    state.enrollment = enrollment
    if !refreshOnly { state.outcome = "enabled" }
    try store.write(state)
    self.revision += 1
    revokedOwners.remove(owner)
  }

  func status(owner: String, session: String) throws -> [String: Any] {
    let state = try store.load()
    guard state.owner == owner, let enrollment = state.enrollment, enrollment.session == session, !revokedOwners.contains(owner) else {
      return ["enabled": false, "pending": 0]
    }
    var result: [String: Any] = ["enabled": true, "pending": state.deliveries.filter { $0.pending != nil }.count]
    if let outcome = state.outcome { result["outcome"] = outcome }
    if let date = state.lastSaved { result["lastSaved"] = date.timeIntervalSince1970 * 1000 }
    if let id = state.lastTransactionId { result["lastTransactionId"] = id.uuidString.lowercased() }
    result["accounts"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(enrollment.accounts))
    result["categories"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(enrollment.categories))
    if let preferences = enrollment.preferences {
      result["preferences"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(preferences))
    }
    return result
  }

  func updateNotificationLocale(owner: String, session: String, locale: String) throws {
    guard ["ar", "en"].contains(locale), !revokedOwners.contains(owner) else { return }
    var state = try store.load()
    guard state.owner == owner, state.enrollment?.session == session else { return }
    state.enrollment?.notificationLocale = locale
    try store.write(state)
  }

  func disable(owner: String, erase: Bool) throws {
    revision += 1
    revokedOwners.insert(owner)
    var state = try store.load()
    guard state.owner == owner else { return }
    if erase { state = BankSmsState() }
    else {
      state.enrollment = nil
      discardPending(in: &state)
      state.outcome = nil
      state.lastSaved = nil
      state.lastTransactionId = nil
    }
    try store.write(state)
  }

  private func discardPending(in state: inout BankSmsState) {
    for index in state.deliveries.indices {
      state.deliveries[index].pending = nil
      state.deliveries[index].pendingNotice = nil
    }
  }

  public func receive(_ text: String, accountId: String?, categoryId: String?, incomeCategoryId: String?, accountEnding: String?) async {
    do {
      var state = try store.load()
      guard let enrollment = state.enrollment, !revokedOwners.contains(enrollment.owner) else { return }
      let now = Date()
      var routing: [String: Any] = [
        "accounts": try JSONSerialization.jsonObject(with: JSONEncoder().encode(enrollment.accounts)),
        "categories": try JSONSerialization.jsonObject(with: JSONEncoder().encode(enrollment.categories))
      ]
      if let preferences = enrollment.preferences {
        routing["preferences"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(preferences))
      }
      routing["accountId"] = accountId
      routing["categoryId"] = categoryId
      routing["incomeCategoryId"] = incomeCategoryId
      routing["accountEnding"] = accountEnding
      guard let parsed = try ParsedBankSms.parse(text, at: now, routing: routing),
            let account = enrollment.accounts.first(where: { $0.id == parsed.accountId && $0.currency == parsed.currency })
      else {
        state.outcome = "skipped"
        try store.write(state)
        return
      }
      state.deliveries.removeAll { $0.expires <= now }
      let originalReferenceDigest = parsed.originalReference.map { bankReference($0, account: account.id) }
      if let originalReferenceDigest {
        let originals = state.deliveries.filter {
          $0.bankReferenceDigest == originalReferenceDigest && ($0.original != nil || $0.pending != nil)
        }
        guard originals.count == 1 else {
          state.outcome = "skipped"
          try store.write(state)
          return
        }
      }
      let textDigest = digest(parsed.textIdentity)
      let referenceDigest = parsed.referenceIdentity.map { digest("\(account.id):\($0)") }
      let stableReferenceDigest = parsed.stableReferenceIdentity.map(digest)
      let expenseReference = parsed.bankReference.map { bankReference($0, account: account.id) }
      if state.deliveries.contains(where: { delivery in
        (delivery.textDigest == textDigest && now.timeIntervalSince(delivery.created) < replayWindow) ||
          delivery.matchesReference(referenceDigest, stable: stableReferenceDigest, bank: expenseReference, currency: parsed.currency)
      }) {
        state.outcome = "duplicate"
        try store.write(state)
        await retry()
        return
      }
      guard state.deliveries.count < 4096 else {
        state.outcome = "capacity"
        try store.write(state)
        return
      }
      var command = BankSmsCommand(kind: parsed.kind, amountMinor: parsed.amountMinor, currency: parsed.currency,
                                   accountId: account.id, categoryId: parsed.categoryId,
                                   destinationAccountId: parsed.destinationAccountId, original: nil,
                                   title: enrollment.title, occurredAt: parsed.occurredAt)
      command.originalReferenceDigest = originalReferenceDigest
      command.automatic = accountId == nil
      if command.automatic == true {
        command.accountAdmission = enrollment.accounts.filter {
          $0.id == command.accountId || $0.id == command.destinationAccountId
        }.map(BankSmsAccountAdmission.init)
      }
      let retention = parsed.referenceIdentity == nil ? replayWindow : 30 * replayWindow
      state.deliveries.append(BankSmsDelivery(key: UUID(), textDigest: textDigest, referenceDigest: referenceDigest,
                                             expires: now.addingTimeInterval(retention),
                                             created: now, pending: command, stableReferenceDigest: stableReferenceDigest,
                                             bankReferenceDigest: expenseReference))
      state.outcome = "queued"
      try store.write(state)
      await retry()
    } catch {
      // A reboot before first unlock may make protected state unavailable.
    }
  }

  private func bankReference(_ value: String, account: String) -> String {
    digest("bank-reference:\(account):\(value.lowercased())")
  }

  private func digest(_ value: String) -> String {
    SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
  }

  func retry() async {
    guard !draining else { return }
    draining = true
    defer { draining = false }
    guard let state = try? store.load(), let enrollment = state.enrollment,
          !revokedOwners.contains(enrollment.owner),
          state.deliveries.contains(where: { $0.pending != nil || $0.pendingNotice != nil }) else { return }
    do {
      var current = try admitted(enrollment)
      let cutoff = Date().addingTimeInterval(-replayWindow)
      for index in current.deliveries.indices where current.deliveries[index].pending != nil && current.deliveries[index].created <= cutoff {
        current.deliveries[index].pending = nil
        current.outcome = "expired"
      }
      for index in current.deliveries.indices where current.deliveries[index].created <= cutoff {
        current.deliveries[index].pendingNotice = nil
      }
      try store.write(current)
      guard current.deliveries.contains(where: { $0.pending != nil || $0.pendingNotice != nil }) else { return }
      let token = try await token(for: enrollment)
      let generation = try await ledger.generation(token: token)
      _ = try admitted(enrollment)
      guard generation == enrollment.generation else {
        try disable(owner: enrollment.owner, erase: false)
        return
      }
      let notices = try admitted(enrollment).deliveries.filter { $0.pendingNotice != nil }
      for delivery in notices.prefix(4) {
        await deliverNotice(delivery.key, enrollment: enrollment)
      }
      var deferred = Set<UUID>()
      for _ in 0..<16 {
        current = try admitted(enrollment)
        guard let delivery = current.deliveries.first(where: { $0.pending != nil && !deferred.contains($0.key) }),
              var command = delivery.pending else { return }
        do {
          if command.original == nil, let reference = command.originalReferenceDigest {
            let matches = current.deliveries.filter {
              $0.bankReferenceDigest == reference && ($0.original != nil || $0.pending != nil)
            }
            guard matches.count == 1, let source = matches.first else { throw BankSmsFailure.rejected }
            if source.pending != nil {
              deferred.insert(delivery.key)
              current.moveToBack(delivery.key)
              try store.write(current)
              continue
            }
            guard let original = source.original, original.currency == command.currency,
                  command.amountMinor <= original.amountMinor,
                  command.kind != "reversal" || command.amountMinor == original.amountMinor
            else { throw BankSmsFailure.rejected }
            command.original = original
          }
          let admissions = try command.checkedAccounts(in: current.enrollment?.accounts ?? [])
          for account in admissions {
            try await ledger.checkAccount(account, currency: command.currency, token: token)
          }
          if let original = command.original, command.originalVersionReady != true {
            command.original = try await ledger.currentOriginal(original, account: command.accountId, token: token)
            command.originalVersionReady = true
            // Freeze the request before sending. A retry after a lost response
            // must replay the same version and key even if the original changed.
            var latest = try admitted(enrollment)
            guard let index = latest.deliveries.firstIndex(where: { $0.key == delivery.key && $0.pending != nil })
            else { throw BankSmsFailure.disabled }
            latest.deliveries[index].pending = command
            try store.write(latest)
          }
          let receipt = try await ledger.post(command, key: delivery.key, generation: generation, token: token) {
            let latest = try admitted(enrollment)
            guard let setup = latest.enrollment,
                  latest.deliveries.contains(where: { $0.key == delivery.key && $0.pending != nil }),
                  clerk?.session?.id == enrollment.session, clerk?.session?.user?.id == enrollment.owner
            else { throw BankSmsFailure.auth }
            func accepts(_ id: String) -> Bool {
              setup.accounts.contains { target in
                target.id == id && target.currency == command.currency &&
                  (command.automatic != true || target.automaticRouting == true || target.type == "cash")
              }
            }
            guard accepts(command.accountId), command.destinationAccountId.map(accepts) ?? true,
                  admissions.allSatisfy({ admission in
                    setup.accounts.contains { BankSmsAccountAdmission($0) == admission }
                  }),
                  command.categoryId.map({ id in setup.categories.contains(where: { $0.id == id && $0.kind == command.kind }) }) ?? true
            else { throw BankSmsFailure.rejected }
          }
          let id = receipt.id
          let notice = BankSmsPendingNotice(transactionId: id, command: command)
          try settle(delivery, enrollment: enrollment, notice: notice, receipt: receipt)
          await deliverNotice(delivery.key, enrollment: enrollment)
        } catch BankSmsFailure.rejected {
          try settle(delivery, enrollment: enrollment, notice: nil)
        } catch BankSmsFailure.receipt {
          deferred.insert(delivery.key)
        } catch BankSmsFailure.recentAuth {
          deferred.insert(delivery.key)
        }
        if deferred.contains(delivery.key) {
          var latest = try admitted(enrollment)
          latest.moveToBack(delivery.key)
          try store.write(latest)
        }
      }
    } catch {
      guard var current = try? admitted(enrollment) else { return }
      current.outcome = (error as? BankSmsFailure) == .auth ? "session" : "queued"
      try? store.write(current)
    }
  }

  private func settle(_ delivery: BankSmsDelivery, enrollment: BankSmsEnrollment, notice: BankSmsPendingNotice?, receipt: BankSmsOriginal? = nil) throws {
    var state = try admitted(enrollment)
    if let index = state.deliveries.firstIndex(where: { $0.key == delivery.key }) {
      state.deliveries[index].pending = nil
      state.deliveries[index].pendingNotice = notice
      if delivery.bankReferenceDigest != nil { state.deliveries[index].original = receipt }
    }
    state.outcome = notice == nil ? "skipped" : "saved"
    if let notice {
      state.lastSaved = Date()
      state.lastTransactionId = notice.transactionId
    }
    try store.write(state)
  }

  private func deliverNotice(_ key: UUID, enrollment: BankSmsEnrollment) async {
    do {
      guard let notice = try admitted(enrollment).deliveries.first(where: { $0.key == key })?.pendingNotice else { return }
      try await notifySaved(notice.transactionId, command: notice.command, enrollment: enrollment)
      var current = try admitted(enrollment)
      guard let index = current.deliveries.firstIndex(where: { $0.key == key }) else { return }
      current.deliveries[index].pendingNotice = nil
      try store.write(current)
    } catch {
      // Keep a confirmed receipt queued if iOS cannot accept the notification.
      if var state = try? admitted(enrollment) {
        state.moveToBack(key)
        try? store.write(state)
      }
    }
  }

  private func notifySaved(_ transactionId: UUID, command: BankSmsCommand, enrollment: BankSmsEnrollment) async throws {
    let center = UNUserNotificationCenter.current()
    let settings = await center.notificationSettings()
    guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else { return }
    let identifier = "bank-sms-saved-\(transactionId.uuidString.lowercased())"
    let pending = await center.pendingNotificationRequests()
    let delivered = await center.deliveredNotifications()
    guard !pending.contains(where: { $0.identifier == identifier }),
          !delivered.contains(where: { $0.request.identifier == identifier }) else { return }
    guard let presentation = try admitted(enrollment).enrollment,
          clerk?.session?.id == enrollment.session, clerk?.session?.user?.id == enrollment.owner
    else { throw BankSmsFailure.auth }

    let content = UNMutableNotificationContent()
    let language = Locale.preferredLanguages.first?.split(separator: "-").first
    content.body = enrollment.savedNotificationBody ?? (language == "ar"
      ? "تم تسجيل عملية من الاختصارات."
      : "A transaction from Shortcuts was saved.")
    if let account = presentation.accounts.first(where: { $0.id == command.accountId }),
       let scale = account.minorUnitScale {
      let locale = presentation.notificationLocale ?? String(language ?? "en")
      let category = presentation.categories.first(where: { $0.id == command.categoryId })
      let destination = presentation.accounts.first(where: { $0.id == command.destinationAccountId })
      let categoryName = (locale == "ar" ? category?.nameAr : category?.nameEn) ?? category?.name ?? destination?.name ?? ""
      if let notice = BankSmsSavedNotice.make(kind: command.kind, amountMinor: command.amountMinor,
        currency: command.currency, scale: scale, locale: locale, account: account.name, category: categoryName) {
        content.title = notice.title
        content.body = notice.body
      }
    }
    content.sound = .default
    let request = UNNotificationRequest(
      identifier: identifier,
      content: content,
      trigger: nil
    )
    // A delivery error cannot change an already committed transaction.
    try await center.add(request)
  }

  private func admitted(_ enrollment: BankSmsEnrollment) throws -> BankSmsState {
    let state = try store.load()
    guard !revokedOwners.contains(enrollment.owner), state.enrollment?.epoch == enrollment.epoch
    else { throw BankSmsFailure.disabled }
    return state
  }

  private func token(for enrollment: BankSmsEnrollment) async throws -> String {
    let token = try await refreshSession(enrollment)
    _ = try admitted(enrollment)
    return token
  }

  private func refreshSession(_ enrollment: BankSmsEnrollment) async throws -> String {
    let keychain = (Bundle.main.object(forInfoDictionaryKey: "ClerkKeychainService") as? String)
      ?? Bundle.main.bundleIdentifier ?? "com.masarifi.mobile"
    let sdk = clerk ?? Clerk.configure(publishableKey: enrollment.publishableKey, options: .init(
      keychainConfig: .init(service: keychain), middleware: .init(request: [ExpoClerkHeaders()])
    ))
    clerk = sdk
    _ = try await sdk.refreshClient()
    guard let session = sdk.session, session.id == enrollment.session, session.user?.id == enrollment.owner,
          let token = try await session.getToken(.init(skipCache: true)), !token.isEmpty
    else { throw BankSmsFailure.auth }
    guard sdk.session?.id == session.id, sdk.session?.user?.id == enrollment.owner else { throw BankSmsFailure.auth }
    return token
  }
}
