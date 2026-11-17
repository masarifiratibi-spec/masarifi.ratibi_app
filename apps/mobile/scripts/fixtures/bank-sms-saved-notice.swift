import Foundation

@main struct SavedNoticeTests {
  static func main() {
    let arabic = BankSmsSavedNotice.make(kind: "expense", amountMinor: 1726, currency: "SAR", scale: 2,
      locale: "ar", account: "QA Bank", category: "التسوق")!
    precondition(arabic.title == "دفع · 17.26\u{00a0}SAR", arabic.title)
    precondition(arabic.body == "التسوق\nQA Bank", arabic.body)
    let english = BankSmsSavedNotice.make(kind: "income", amountMinor: 550000, currency: "SAR", scale: 2,
      locale: "en", account: "QA Bank", category: "Salary")!
    precondition(english.title == "Deposit · 5,500.00\u{00a0}SAR", english.title)
    precondition(english.body == "Salary\nQA Bank", english.body)
    let kwd = BankSmsSavedNotice.make(kind: "expense", amountMinor: 1234, currency: "KWD", scale: 3,
      locale: "en", account: "QA", category: "Shopping")!
    precondition(kwd.title == "Payment · 1.234\u{00a0}KWD", kwd.title)
    let jpy = BankSmsSavedNotice.make(kind: "expense", amountMinor: 1234, currency: "JPY", scale: 0,
      locale: "en", account: "QA", category: "Shopping")!
    precondition(jpy.title == "Payment · 1,234\u{00a0}JPY", jpy.title)
    let exact = BankSmsSavedNotice.make(kind: "expense", amountMinor: 9007199254740991, currency: "SAR", scale: 2,
      locale: "en", account: "QA", category: "Shopping")!
    precondition(exact.title == "Payment · 90,071,992,547,409.91\u{00a0}SAR", exact.title)
    let bounded = BankSmsSavedNotice.make(kind: "expense", amountMinor: 1, currency: "SAR", scale: 2,
      locale: "en", account: "Bank\nSpoof\u{202e}", category: String(repeating: "X", count: 300))!
    precondition(bounded.body.count <= 240)
    precondition(bounded.body.hasSuffix("Bank Spoof"), bounded.body)
    precondition(BankSmsSavedNotice.make(kind: "transfer", amountMinor: 1, currency: "SAR", scale: 2,
      locale: "en", account: "QA", category: "Shopping") == nil)
    precondition(BankSmsSavedNotice.make(kind: "expense", amountMinor: 0, currency: "SAR", scale: 2,
      locale: "en", account: "QA", category: "Shopping") == nil)
    print("Bank SMS native notice fixtures passed: Arabic/English, directions, scales, exact amount, labels, rejected input")
  }
}
