import Foundation

enum BankSmsFailure: Error, Equatable {
  case disabled, auth, generation, rejected, unavailable, receipt
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
    default: throw BankSmsFailure.unavailable
    }
  }

  func generation(token: String) async throws -> Int {
    let reply = try await data(request("api/v1/me/financial-reset/state", token: token))
    let state = try JSONDecoder().decode(BankSmsRemoteGeneration.self, from: reply)
    guard state.status == "ready", state.generation >= 0 else { throw BankSmsFailure.unavailable }
    return state.generation
  }

  @MainActor func post(_ command: BankSmsCommand, key: UUID, generation: Int, token: String,
                       authorize: () throws -> Void) async throws -> UUID {
    var request = request("api/v1/transactions", token: token)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(key.uuidString.lowercased(), forHTTPHeaderField: "Idempotency-Key")
    request.setValue(String(generation), forHTTPHeaderField: "X-Financial-Generation")
    request.httpBody = try JSONEncoder().encode(command)
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
    guard row.status == "confirmed", row.kind == command.kind, row.source == command.source,
          row.amountMinor == command.amountMinor, row.currency == command.currency,
          row.accountIds == [command.accountId], row.categoryId == command.categoryId,
          let commandDate, Self.date(row.occurredAt) == commandDate,
          detail.postings.count == 1, let posting = detail.postings.first,
          posting.accountId == command.accountId, posting.clearingState == "confirmed",
          posting.postingRole == (command.kind == "expense" ? "source" : "destination"),
          posting.amountMinor == (command.kind == "expense" ? -command.amountMinor : command.amountMinor)
    else { throw BankSmsFailure.receipt }
    return row.id
  }

  private static func date(_ value: String) -> Date? {
    let format = ISO8601DateFormatter()
    format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = format.date(from: value) { return date }
    format.formatOptions = [.withInternetDateTime]
    return format.date(from: value)
  }
}
