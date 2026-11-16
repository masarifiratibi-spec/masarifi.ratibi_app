import ClerkKit
import CryptoKit
import Foundation
import JavaScriptCore

private struct ExpoClerkHeaders: ClerkRequestMiddleware {
  func prepare(_ request: inout URLRequest) async throws {
    request.addValue("expo", forHTTPHeaderField: "x-clerk-host-sdk")
    if let version = Bundle.main.object(forInfoDictionaryKey: "ClerkExpoVersion") as? String {
      request.addValue(version, forHTTPHeaderField: "x-clerk-host-sdk-version")
    }
  }
}

private struct ParsedBankSms: Decodable {
  let kind: String
  let amountMinor: Int64
  let currency: String
  let occurredAt: String
  let textIdentity: String
  let referenceIdentity: String?

  static func parse(_ text: String, at date: Date) throws -> ParsedBankSms? {
    guard !text.isEmpty, text.utf16.count <= 2000 else { return nil }
    guard let url = Bundle.main.url(forResource: "MasarifiBankSmsParser", withExtension: "js"),
          let context = JSContext()
    else { throw BankSmsFailure.unavailable }
    context.exceptionHandler = { _, _ in } // A parser exception may include source text.
    context.evaluateScript(try String(contentsOf: url, encoding: .utf8))
    guard let value = context.objectForKeyedSubscript("masarifiClassifyBankSms")?.call(withArguments: [
      text, date.timeIntervalSince1970 * 1000, TimeZone.current.identifier
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
                 generation: Int, revision: Int, title: String, accounts: [BankSmsTarget], categories: [BankSmsTarget]) async throws {
    guard self.revision == revision, !owner.isEmpty, !session.isEmpty, publishableKey.hasPrefix("pk_live_"), generation >= 0,
          !accounts.isEmpty, !categories.isEmpty,
          accounts.allSatisfy({ UUID(uuidString: $0.id) != nil && $0.currency != nil }),
          categories.allSatisfy({ UUID(uuidString: $0.id) != nil && ["income", "expense"].contains($0.kind) })
    else { throw BankSmsFailure.rejected }
    guard Bundle.main.url(forResource: "MasarifiBankSmsParser", withExtension: "js") != nil
    else { throw BankSmsFailure.unavailable }
    let enrollment = BankSmsEnrollment(owner: owner, session: session, publishableKey: publishableKey,
                                       generation: generation, epoch: UUID(), accounts: accounts,
                                       categories: categories, title: title)
    _ = try await refreshSession(enrollment)
    guard self.revision == revision else { throw BankSmsFailure.disabled }
    var state = try store.load()
    if state.owner != owner { state = BankSmsState() }
    if state.enrollment?.generation != generation || state.enrollment?.session != session {
      discardPending(in: &state)
    }
    state.owner = owner
    state.enrollment = enrollment
    state.outcome = "enabled"
    try store.write(state)
    self.revision += 1
    revokedOwners.remove(owner)
  }

  func status(owner: String, session: String) throws -> [String: Any] {
    let state = try store.load()
    guard state.owner == owner, state.enrollment?.session == session, !revokedOwners.contains(owner) else {
      return ["enabled": false, "pending": 0]
    }
    var result: [String: Any] = ["enabled": true, "pending": state.deliveries.filter { $0.pending != nil }.count]
    if let outcome = state.outcome { result["outcome"] = outcome }
    if let date = state.lastSaved { result["lastSaved"] = date.timeIntervalSince1970 * 1000 }
    if let id = state.lastTransactionId { result["lastTransactionId"] = id.uuidString.lowercased() }
    return result
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
    for index in state.deliveries.indices { state.deliveries[index].pending = nil }
  }

  public func receive(_ text: String, accountId: String?, categoryId: String?) async {
    do {
      var state = try store.load()
      guard let enrollment = state.enrollment, !revokedOwners.contains(enrollment.owner) else { return }
      let now = Date()
      guard let parsed = try ParsedBankSms.parse(text, at: now),
            let account = enrollment.accounts.first(where: { $0.id == accountId && $0.currency == parsed.currency }),
            let category = enrollment.categories.first(where: { $0.id == categoryId && $0.kind == parsed.kind })
      else {
        state.outcome = "skipped"
        try store.write(state)
        return
      }
      state.deliveries.removeAll { $0.expires <= now }
      let textDigest = digest(parsed.textIdentity)
      let referenceDigest = parsed.referenceIdentity.map { digest("\(account.id):\($0)") }
      if state.deliveries.contains(where: { delivery in
        (delivery.textDigest == textDigest && now.timeIntervalSince(delivery.created) < replayWindow) ||
          (referenceDigest != nil && delivery.referenceDigest == referenceDigest)
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
      let command = BankSmsCommand(kind: parsed.kind, amountMinor: parsed.amountMinor, currency: parsed.currency,
                                   accountId: account.id, categoryId: category.id, title: enrollment.title,
                                   occurredAt: parsed.occurredAt)
      let retention = parsed.referenceIdentity == nil ? replayWindow : 30 * replayWindow
      state.deliveries.append(BankSmsDelivery(key: UUID(), textDigest: textDigest, referenceDigest: referenceDigest,
                                             expires: now.addingTimeInterval(retention),
                                             created: now, pending: command))
      state.outcome = "queued"
      try store.write(state)
      await retry()
    } catch {
      // A reboot before first unlock may make protected state unavailable.
    }
  }

  private func digest(_ value: String) -> String {
    SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
  }

  func retry() async {
    guard !draining else { return }
    draining = true
    defer { draining = false }
    guard let state = try? store.load(), let enrollment = state.enrollment,
          !revokedOwners.contains(enrollment.owner), state.deliveries.contains(where: { $0.pending != nil }) else { return }
    do {
      var current = try admitted(enrollment)
      let cutoff = Date().addingTimeInterval(-replayWindow)
      for index in current.deliveries.indices where current.deliveries[index].pending != nil && current.deliveries[index].created <= cutoff {
        current.deliveries[index].pending = nil
        current.outcome = "expired"
      }
      try store.write(current)
      guard current.deliveries.contains(where: { $0.pending != nil }) else { return }
      let token = try await token(for: enrollment)
      let generation = try await ledger.generation(token: token)
      _ = try admitted(enrollment)
      guard generation == enrollment.generation else {
        try disable(owner: enrollment.owner, erase: false)
        return
      }
      for _ in 0..<4 {
        current = try admitted(enrollment)
        guard let delivery = current.deliveries.first(where: { $0.pending != nil }), let command = delivery.pending else { return }
        do {
          let id = try await ledger.post(command, key: delivery.key, generation: generation, token: token) {
            let latest = try admitted(enrollment)
            guard latest.deliveries.contains(where: { $0.key == delivery.key && $0.pending != nil }),
                  clerk?.session?.id == enrollment.session, clerk?.session?.user?.id == enrollment.owner
            else { throw BankSmsFailure.auth }
          }
          try settle(delivery, enrollment: enrollment, transactionId: id)
        } catch BankSmsFailure.rejected {
          try settle(delivery, enrollment: enrollment, transactionId: nil)
        }
      }
    } catch {
      guard var current = try? admitted(enrollment) else { return }
      current.outcome = (error as? BankSmsFailure) == .auth ? "session" : "queued"
      try? store.write(current)
    }
  }

  private func settle(_ delivery: BankSmsDelivery, enrollment: BankSmsEnrollment, transactionId: UUID?) throws {
    var state = try admitted(enrollment)
    if let index = state.deliveries.firstIndex(where: { $0.key == delivery.key }) { state.deliveries[index].pending = nil }
    state.outcome = transactionId == nil ? "skipped" : "saved"
    if let transactionId {
      state.lastSaved = Date()
      state.lastTransactionId = transactionId
    }
    try store.write(state)
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
