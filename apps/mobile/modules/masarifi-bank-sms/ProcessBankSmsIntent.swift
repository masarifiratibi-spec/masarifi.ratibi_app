import AppIntents
import Foundation
import MasarifiBankSms

struct BankSmsAccount: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Account")
  static var defaultQuery = BankSmsAccountQuery()
  let id: String
  let name: String
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

struct BankSmsAccountQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [BankSmsAccount] {
    await BankSmsService.shared.choices(kind: "account", identifiers: identifiers).map {
      BankSmsAccount(id: $0.id, name: $0.name)
    }
  }

  func suggestedEntities() async throws -> [BankSmsAccount] {
    await BankSmsService.shared.choices(kind: "account").map { BankSmsAccount(id: $0.id, name: $0.name) }
  }
}

struct BankSmsCategory: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Category")
  static var defaultQuery = BankSmsCategoryQuery()
  let id: String
  let name: String
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

struct BankSmsCategoryQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [BankSmsCategory] {
    await BankSmsService.shared.choices(kind: "category", identifiers: identifiers).map {
      BankSmsCategory(id: $0.id, name: $0.name)
    }
  }

  func suggestedEntities() async throws -> [BankSmsCategory] {
    await BankSmsService.shared.choices(kind: "category").map { BankSmsCategory(id: $0.id, name: $0.name) }
  }
}

struct ProcessBankSmsIntent: AppIntent {
  static var title: LocalizedStringResource = "Process Bank SMS"
  static var description = IntentDescription("Save a supported bank message to your selected Masarifi account.")
  static var openAppWhenRun = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

  @Parameter(title: "SMS Text") var smsText: String
  @Parameter(title: "Account") var account: BankSmsAccount?
  @Parameter(title: "Category") var category: BankSmsCategory?

  static var parameterSummary: some ParameterSummary {
    Summary("Process \(\.$smsText) in \(\.$account) as \(\.$category)")
  }

  func perform() async throws -> some IntentResult {
    await BankSmsService.shared.receive(smsText, accountId: account?.id, categoryId: category?.id)
    return .result()
  }
}
