import Foundation

enum BankSmsFailure: Error, Equatable {
  case disabled, auth, generation, rejected, unavailable, receipt
}

private struct BankSmsRemoteError: Decodable {
  let code: String?
}

struct BankSmsRemoteGeneration: Decodable {
  let status: String
  let generation: Int
}

private struct BankSmsLedgerResult: Decodable {
  struct Details: Decodable {
    struct Summary: Decodable {
      let id: UUID
      let status: String
      let kind: String
      let source: String
      let amountMinor: Int64
      let currency: String
      let accountIds: [String]
      let categoryId: String?
      let occurredAt: String
      let version: Int
      let originalTransactionId: UUID?
    }
    struct Posting: Decodable {
      let accountId: String
      let amountMinor: Int64
      let clearingState: String
      let postingRole: String
    }
    let transaction: Summary
    let postings: [Posting]
  }
  let transaction: Details
}

private final class RejectLedgerRedirects: NSObject, URLSessionTaskDelegate {
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil)
  }
}

struct BankSmsLedger {
  private let origin = URL(string: "https://api.masarifiratibi.com")!
  private let http: URLSession = {
    let config = URLSessionConfiguration.ephemeral
    config.httpShouldSetCookies = false
    config.timeoutIntervalForRequest = 8
    config.timeoutIntervalForResource = 12
    return URLSession(configuration: config, delegate: RejectLedgerRedirects(), delegateQueue: nil)
  }()

  private func request(_ path: String, token: String) -> URLRequest {
    var request = URLRequest(url: origin.appendingPathComponent(path))
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    return request
  }

  private func data(_ request: URLRequest) async throws -> Data {
    let (data, response) = try await http.data(for: request)
    return try checked(data, response)
  }

  private func checked(_ data: Data, _ response: URLResponse) throws -> Data {
    guard let response = response as? HTTPURLResponse else { throw BankSmsFailure.unavailable }
    switch response.statusCode {
    case 200...299: return data
    case 401, 403: throw BankSmsFailure.auth
    case 400, 404, 422: throw BankSmsFailure.rejected
    case 409:
      let code = (try? JSONDecoder().decode(BankSmsRemoteError.self, from: data))?.code
      if let code, ["VERSION_CONFLICT", "TRANSACTION_NOT_EDITABLE", "TRANSACTION_HAS_DEPENDENTS",
                    "REVERSAL_EXISTS", "REFUND_EXCEEDS_AVAILABLE", "CURRENCY_MISMATCH",
                    "ACCOUNT_NOT_POSTABLE", "CATEGORY_INVALID"].contains(code) { throw BankSmsFailure.rejected }
      throw BankSmsFailure.unavailable
    default: throw BankSmsFailure.unavailable
    }
  }

  func generation(token: String) async throws -> Int {
    let reply = try await data(request("api/v1/me/financial-reset/state", token: token))
    let state = try JSONDecoder().decode(BankSmsRemoteGeneration.self, from: reply)
    guard state.status == "ready", state.generation >= 0 else { throw BankSmsFailure.unavailable }
    return state.generation
  }

  func currentOriginal(_ original: BankSmsOriginal, account: String, token: String) async throws -> BankSmsOriginal {
    let reply = try await data(request("api/v1/transactions/\(original.id.uuidString.lowercased())", token: token))
    let detail = try JSONDecoder().decode(BankSmsLedgerResult.Details.self, from: reply)
    let row = detail.transaction
    guard row.id == original.id, row.kind == "expense", row.status == "confirmed", row.source == "platform_assisted",
          row.accountIds == [account], row.amountMinor == original.amountMinor, row.currency == original.currency,
          detail.postings.count == 1, let posting = detail.postings.first,
          posting.accountId == account, posting.amountMinor == -original.amountMinor,
          posting.clearingState == "confirmed", posting.postingRole == "source"
    else { throw BankSmsFailure.rejected }
    return BankSmsOriginal(id: row.id, version: row.version, amountMinor: row.amountMinor, currency: row.currency)
  }

  @MainActor func post(_ command: BankSmsCommand, key: UUID, generation: Int, token: String,
                       authorize: () throws -> Void) async throws -> BankSmsOriginal {
    let path: String
    let body: Data
    if let original = command.original {
      let refund = command.kind == "refund"
      path = "api/v1/transactions/\(original.id.uuidString.lowercased())/\(refund ? "refunds" : "reverse")"
      var fields: [String: Any] = ["expectedVersion": original.version, "occurredAt": command.occurredAt, "reason": command.title]
      if refund {
        fields["amountMinor"] = command.amountMinor
        fields["accountId"] = command.accountId
      }
      body = try JSONSerialization.data(withJSONObject: fields)
    } else if let destination = command.destinationAccountId {
      path = "api/v1/transfers"
      let fields: [String: Any] = [
        "sourceAccountId": command.accountId, "destinationAccountId": destination,
        "amountMinor": command.amountMinor, "currency": command.currency, "feeMinor": 0,
        "occurredAt": command.occurredAt, "title": command.title, "source": command.source
      ]
      body = try JSONSerialization.data(withJSONObject: fields)
    } else {
      path = "api/v1/transactions"
      let fields: [String: Any] = [
        "kind": command.kind, "accountId": command.accountId,
        "categoryId": command.categoryId.map { $0 as Any } ?? NSNull(),
        "amountMinor": command.amountMinor, "currency": command.currency,
        "occurredAt": command.occurredAt, "title": command.title, "source": command.source
      ]
      body = try JSONSerialization.data(withJSONObject: fields)
    }
    var request = request(path, token: token)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(key.uuidString.lowercased(), forHTTPHeaderField: "Idempotency-Key")
    request.setValue(String(generation), forHTTPHeaderField: "X-Financial-Generation")
    request.httpBody = body
    let reply: Data = try await withCheckedThrowingContinuation { next in
      do {
        try Task.checkCancellation()
        try authorize()
        http.dataTask(with: request) { data, response, error in
          do {
            if let error { throw error }
            guard let data, let response else { throw BankSmsFailure.unavailable }
            next.resume(returning: try self.checked(data, response))
          } catch { next.resume(throwing: error) }
        }.resume()
      } catch { next.resume(throwing: error) }
    }
    let detail = try JSONDecoder().decode(BankSmsLedgerResult.self, from: reply).transaction
    let row = detail.transaction
    let commandDate = Self.date(command.occurredAt)
    guard row.status == "confirmed", row.kind == command.kind,
          row.amountMinor == command.amountMinor, row.currency == command.currency,
          row.originalTransactionId == command.original?.id,
          let commandDate, Self.date(row.occurredAt) == commandDate
    else { throw BankSmsFailure.receipt }

    let account = command.accountId
    let amount = command.amountMinor
    func matches(_ id: String, _ role: String, _ value: Int64) -> Bool {
      detail.postings.contains { $0.accountId == id && $0.postingRole == role &&
        $0.amountMinor == value && $0.clearingState == "confirmed" }
    }
    if let destination = command.destinationAccountId {
      guard row.source == command.source, row.categoryId == nil,
            Set(row.accountIds) == Set([account, destination]), detail.postings.count == 2,
            matches(account, "source", -amount), matches(destination, "destination", amount)
      else { throw BankSmsFailure.receipt }
    } else {
      let role = command.original == nil ? (command.kind == "expense" ? "source" : "destination") : command.kind
      guard row.accountIds == [account], row.categoryId == command.categoryId,
            command.original != nil || row.source == command.source,
            detail.postings.count == 1, matches(account, role, command.kind == "expense" ? -amount : amount)
      else { throw BankSmsFailure.receipt }
    }
    return BankSmsOriginal(id: row.id, version: row.version, amountMinor: row.amountMinor, currency: row.currency)
  }

  private static func date(_ value: String) -> Date? {
    let format = ISO8601DateFormatter()
    format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = format.date(from: value) { return date }
    format.formatOptions = [.withInternetDateTime]
    return format.date(from: value)
  }
}
