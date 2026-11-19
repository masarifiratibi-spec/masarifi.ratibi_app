import Foundation

struct BankSmsTarget: Codable, Equatable {
  let id: String
  let name: String
  let kind: String
  let currency: String?
  let automaticRouting: Bool?
  let lastFour: String?
  let institution: String?
  let type: String?
  let accountEnding: String?
  let issuer: String?
  let cashAccountId: String?
  let minorUnitScale: Int?
  let nameAr: String?
  let nameEn: String?
}

struct BankSmsPreferences: Codable, Equatable {
  let expenseId: String?
  let incomeId: String?
  let feeId: String?
  let salaryId: String?
  let merchants: [String: String]
}

struct BankSmsEnrollment: Codable, Equatable {
  let owner: String
  let session: String
  let publishableKey: String
  let generation: Int
  let epoch: UUID
  let accounts: [BankSmsTarget]
  let categories: [BankSmsTarget]
  let preferences: BankSmsPreferences?
  let title: String
  let savedNotificationBody: String?
  var notificationLocale: String?
}

struct BankSmsAccountAdmission: Codable, Equatable {
  let id: String
  let type: String?
  let lastFour: String?
  let institution: String?
  let accountEnding: String?
  let issuer: String?
  let cashAccountId: String?

  init(_ target: BankSmsTarget) {
    id = target.id
    type = target.type
    lastFour = target.lastFour
    institution = target.institution
    accountEnding = target.accountEnding
    issuer = target.issuer
    cashAccountId = target.cashAccountId
  }
}

struct BankSmsCommand: Codable {
  let kind: String
  let amountMinor: Int64
  let currency: String
  let accountId: String
  let categoryId: String?
  let destinationAccountId: String?
  var original: BankSmsOriginal?
  var originalReferenceDigest: String? = nil
  var originalVersionReady: Bool? = nil
  var automatic: Bool? = nil
  var accountAdmission: [BankSmsAccountAdmission]? = nil
  let title: String
  let occurredAt: String
  var source: String = "platform_assisted"

  func checkedAccounts(in targets: [BankSmsTarget]) throws -> [BankSmsAccountAdmission] {
    let ids = [accountId, destinationAccountId].compactMap { $0 }
    let accounts = try ids.map { id -> BankSmsAccountAdmission in
      guard let target = targets.first(where: { $0.id == id }), target.currency == currency,
            automatic != true || target.automaticRouting == true || target.type == "cash"
      else { throw BankSmsFailure.rejected }
      return BankSmsAccountAdmission(target)
    }
    guard automatic == true else { return [] } // Older explicit-account Shortcuts omit this flag.
    if let accountAdmission, Set(accountAdmission.map(\.id)) != Set(ids) ||
        accountAdmission.count != accounts.count || !accounts.allSatisfy(accountAdmission.contains) {
      throw BankSmsFailure.rejected
    }
    return accounts
  }
}

struct BankSmsOriginal: Codable {
  let id: UUID
  let version: Int
  let amountMinor: Int64
  let currency: String
}

struct BankSmsPendingNotice: Codable {
  let transactionId: UUID
  let command: BankSmsCommand
}

struct BankSmsDelivery: Codable {
  let key: UUID
  let textDigest: String
  let referenceDigest: String?
  let expires: Date
  let created: Date
  var pending: BankSmsCommand?
  var pendingNotice: BankSmsPendingNotice? = nil
  var stableReferenceDigest: String? = nil
  var bankReferenceDigest: String? = nil
  var original: BankSmsOriginal? = nil
}

struct BankSmsState: Codable {
  var enrollment: BankSmsEnrollment?
  var owner: String?
  var generation: Int?
  var deliveries: [BankSmsDelivery] = []
  var outcome: String?
  var lastSaved: Date?
  var lastTransactionId: UUID?

  mutating func moveToBack(_ key: UUID) {
    guard let index = deliveries.firstIndex(where: { $0.key == key }), index != deliveries.count - 1 else { return }
    let delivery = deliveries.remove(at: index)
    deliveries.append(delivery)
  }
}

struct BankSmsStore {
  private func file() throws -> URL {
    let folder = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                             appropriateFor: nil, create: true)
      .appendingPathComponent("MasarifiBankSMS", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true,
                                            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    var protected = folder
    var options = URLResourceValues()
    options.isExcludedFromBackup = true
    try protected.setResourceValues(options)
    return folder.appendingPathComponent("state.json")
  }

  func load() throws -> BankSmsState {
    do { return try JSONDecoder().decode(BankSmsState.self, from: Data(contentsOf: file())) }
    catch let error as NSError where error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoSuchFileError {
      return BankSmsState()
    }
  }

  func write(_ state: BankSmsState) throws {
    try JSONEncoder().encode(state).write(to: file(), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }
}

extension BankSmsDelivery {
  func matchesReference(_ reference: String?, stable: String?, bank: String?, currency: String) -> Bool {
    if let stable, let stableReferenceDigest { return stable == stableReferenceDigest }
    if let reference, reference == referenceDigest { return true }
    // Earlier purchases stored the account-scoped, case-folded reference for refunds.
    guard let bank, bank == bankReferenceDigest else { return false }
    return (pending?.currency ?? original?.currency) == currency
  }
}
