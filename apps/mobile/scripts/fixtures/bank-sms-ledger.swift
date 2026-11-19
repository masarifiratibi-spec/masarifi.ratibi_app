import Foundation

private final class LedgerProtocol: URLProtocol {
  static var respond: ((URLRequest) throws -> (Int, Data))?

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    do {
      guard let respond = Self.respond, let url = request.url else { throw URLError(.badURL) }
      let (status, data) = try respond(request)
      let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil)!
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch {
      client?.urlProtocol(self, didFailWithError: error)
    }
  }
  override func stopLoading() {}
}

@main private struct BankSmsLedgerTests {
  static let account = "33fb041e-a456-4ea3-8b60-b3076060568f"
  static let cash = "8ba384c7-d66a-43ee-8a22-a2391d441dad"
  static let category = "60c7e50e-2809-47eb-8e13-b34d0e2a5cc5"
  static let transaction = UUID(uuidString: "d209f9a7-1cfb-43f6-a3e6-edeb642a97a1")!
  static let key = UUID(uuidString: "540bd12c-4ed5-4092-a393-7445e972efb0")!
  static let date = "2026-11-19T09:30:00.000Z"

  static func json(_ object: [String: Any]) throws -> Data {
    try JSONSerialization.data(withJSONObject: object)
  }

  static func requestBody(_ request: URLRequest) throws -> [String: Any] {
    if let body = request.httpBody {
      return try JSONSerialization.jsonObject(with: body) as! [String: Any]
    }
    guard let stream = request.httpBodyStream else { throw URLError(.cannotDecodeContentData) }
    stream.open()
    defer { stream.close() }
    var body = Data()
    var buffer = [UInt8](repeating: 0, count: 1024)
    while stream.hasBytesAvailable {
      let count = stream.read(&buffer, maxLength: buffer.count)
      if count < 0 { throw URLError(.cannotDecodeContentData) }
      if count == 0 { break }
      body.append(contentsOf: buffer.prefix(count))
    }
    return try JSONSerialization.jsonObject(with: body) as! [String: Any]
  }

  static func posting(_ id: String, _ amount: Int, _ role: String) -> [String: Any] {
    ["accountId": id, "amountMinor": amount, "postingRole": role, "clearingState": "confirmed"]
  }

  static func detail(_ kind: String, ids: [String], postings: [[String: Any]],
                     categoryId: String? = nil, originalId: UUID? = nil) -> [String: Any] {
    let row: [String: Any] = [
      "id": transaction.uuidString, "status": "confirmed", "kind": kind,
      "source": originalId == nil ? "platform_assisted" : "manual",
      "amountMinor": 1234, "currency": "SAR", "accountIds": ids,
      "categoryId": categoryId.map { $0 as Any } ?? NSNull(),
      "originalTransactionId": originalId.map { $0.uuidString as Any } ?? NSNull(),
      "occurredAt": date, "version": 1
    ]
    return ["transaction": row, "postings": postings]
  }

  @MainActor static func main() async throws {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [LedgerProtocol.self]
    let ledger = BankSmsLedger(configuration: config)
    let target = BankSmsTarget(id: account, name: "QA", kind: "account", currency: "SAR",
      automaticRouting: true, lastFour: "4242", institution: "QA", type: "bank", accountEnding: "7373",
      issuer: "QA", cashAccountId: cash, minorUnitScale: 2, nameAr: nil, nameEn: nil)
    let admission = BankSmsAccountAdmission(target)
    for enabled in [true, false] {
      LedgerProtocol.respond = { request in
        precondition(request.httpMethod == "GET" && request.url?.path == "/api/v1/accounts/\(account)")
        return (200, try json(["id": account, "type": "bank", "currency": "SAR", "status": "active",
                               "automaticTrackingEnabled": enabled, "lastFour": "4242", "institutionName": "QA"]))
      }
      do {
        try await ledger.checkAccount(admission, currency: "SAR", token: "qa-token")
        precondition(enabled)
      } catch BankSmsFailure.rejected { precondition(!enabled) }
    }

    let originalId = UUID()
    let original = BankSmsOriginal(id: originalId, version: 2, amountMinor: 1234, currency: "SAR")
    for kind in ["expense", "income", "transfer", "refund", "reversal"] {
      let ownTransfer = kind == "transfer"
      let compensation = kind == "refund" || kind == "reversal"
      let command = BankSmsCommand(kind: kind, amountMinor: 1234, currency: "SAR", accountId: account,
        categoryId: ownTransfer || compensation ? nil : category, destinationAccountId: ownTransfer ? cash : nil,
        original: compensation ? original : nil, automatic: true, accountAdmission: [admission],
        title: "Bank SMS QA", occurredAt: date)
      let endpoint = ownTransfer ? "/api/v1/transfers" : compensation
        ? "/api/v1/transactions/\(originalId.uuidString.lowercased())/\(kind == "refund" ? "refunds" : "reverse")"
        : "/api/v1/transactions"
      LedgerProtocol.respond = { request in
        precondition(request.httpMethod == "POST" && request.url?.path == endpoint)
        precondition(request.value(forHTTPHeaderField: "Idempotency-Key") == key.uuidString.lowercased())
        precondition(request.value(forHTTPHeaderField: "X-Financial-Generation") == "3")
        precondition(request.value(forHTTPHeaderField: "Authorization") == "Bearer qa-token")
        let fields = try requestBody(request)
        precondition(fields["automatic"] == nil && fields["accountAdmission"] == nil)
        if ownTransfer {
          precondition(fields["sourceAccountId"] as? String == account && fields["destinationAccountId"] as? String == cash)
        } else if compensation {
          precondition(fields["expectedVersion"] as? Int == 2)
          precondition(fields["amountMinor"] as? Int == (kind == "refund" ? 1234 : nil))
        } else {
          precondition(fields["categoryId"] as? String == category)
        }
        let postings = ownTransfer ? [posting(account, -1234, "source"), posting(cash, 1234, "destination")]
          : [posting(account, kind == "expense" ? -1234 : 1234, compensation ? kind : kind == "expense" ? "source" : "destination")]
        return (201, try json(["transaction": detail(kind, ids: ownTransfer ? [cash, account] : [account],
          postings: postings, categoryId: command.categoryId, originalId: command.original?.id)]))
      }
      let receipt = try await ledger.post(command, key: key, generation: 3, token: "qa-token") {}
      precondition(receipt.id == transaction)
      let replay = try await ledger.post(command, key: key, generation: 3, token: "qa-token") {}
      precondition(replay.id == receipt.id)
    }

    let command = BankSmsCommand(kind: "expense", amountMinor: 1234, currency: "SAR", accountId: account,
      categoryId: category, destinationAccountId: nil, original: nil, title: "Bank SMS QA", occurredAt: date)
    LedgerProtocol.respond = { _ in (403, try json(["code": "RECENT_AUTH_REQUIRED"])) }
    do {
      _ = try await ledger.post(command, key: key, generation: 3, token: "qa-token") {}
      preconditionFailure("Expected recent authentication")
    } catch BankSmsFailure.recentAuth {}
    LedgerProtocol.respond = { _ in
      (201, try json(["transaction": detail("expense", ids: [account], postings: [posting(account, 1234, "source")], categoryId: category)]))
    }
    do {
      _ = try await ledger.post(command, key: key, generation: 3, token: "qa-token") {}
      preconditionFailure("Expected receipt rejection for wrong posting sign")
    } catch BankSmsFailure.receipt {}
    let oldDelivery = """
    {"key":"\(key.uuidString)","textDigest":"qa","expires":10,"created":0,
     "pending":{"kind":"expense","amountMinor":1234,"currency":"SAR","accountId":"\(account)",
       "categoryId":"\(category)","title":"QA","occurredAt":"\(date)","source":"platform_assisted"}}
    """
    var delivery = try JSONDecoder().decode(BankSmsDelivery.self, from: Data(oldDelivery.utf8))
    precondition(delivery.pending?.accountId == account && delivery.stableReferenceDigest == nil)
    var upgraded = delivery.pending!
    upgraded.automatic = true
    let reconstructed = try upgraded.checkedAccounts(in: [target])
    precondition(reconstructed == [admission])
    delivery.bankReferenceDigest = "account-scoped-ref"
    precondition(delivery.matchesReference(nil, stable: "new", bank: "account-scoped-ref", currency: "SAR"))
    precondition(!delivery.matchesReference(nil, stable: "new", bank: "other-account-ref", currency: "SAR"))
    precondition(!delivery.matchesReference(nil, stable: "new", bank: "account-scoped-ref", currency: "AED"))
    var queue = BankSmsState()
    let next = BankSmsDelivery(key: UUID(), textDigest: "other", referenceDigest: nil,
                               expires: Date(), created: Date(), pending: nil)
    queue.deliveries = [delivery, next]
    queue.moveToBack(delivery.key)
    precondition(queue.deliveries.first?.key == next.key)
    delivery.pending = nil
    delivery.pendingNotice = BankSmsPendingNotice(transactionId: transaction, command: command)
    let saved = try JSONEncoder().encode(delivery)
    let recovered = try JSONDecoder().decode(BankSmsDelivery.self, from: saved)
    precondition(recovered.pending == nil && recovered.pendingNotice?.transactionId == transaction)
    print("Bank SMS native ledger fixtures passed: account opt-out, request bodies, receipt signs and replay keys")
  }
}
