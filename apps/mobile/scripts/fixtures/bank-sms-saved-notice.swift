import Foundation
import CoreText

@main struct SavedNoticeTests {
  static func main() {
    let arabic = BankSmsSavedNotice.make(kind: "expense", amountMinor: 1726, currency: "SAR", scale: 2,
      locale: "ar", account: "QA Bank", category: "التسوق")!
    precondition(arabic.title == "\u{200f}دفع · \u{2066}17.26\u{00a0}SAR\u{2069}", arabic.title)
    precondition(arabic.body == "\u{200f}\u{2068}التسوق\u{2069}\n\u{200f}\u{2068}QA Bank\u{2069}", arabic.body)
    // Exercise Apple's text renderer, not just the presence of direction marks.
    // In the reported defect SAR appeared to the left of 17.26 inside the Arabic title.
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: arabic.title) as CFAttributedString)
    let title = arabic.title as NSString
    let amountX = CTLineGetOffsetForStringIndex(line, title.range(of: "17.26").location, nil)
    let currencyX = CTLineGetOffsetForStringIndex(line, title.range(of: "SAR").location, nil)
    let directionX = CTLineGetOffsetForStringIndex(line, title.range(of: "دفع").location, nil)
    precondition(amountX < currencyX && currencyX < directionX,
      "Arabic title must keep amount/currency LTR and the transaction direction on the right")
    let english = BankSmsSavedNotice.make(kind: "income", amountMinor: 550000, currency: "SAR", scale: 2,
      locale: "en", account: "QA Bank", category: "Salary")!
    precondition(english.title == "\u{200e}Deposit · \u{2066}5,500.00\u{00a0}SAR\u{2069}", english.title)
    precondition(english.body == "\u{200e}\u{2068}Salary\u{2069}\n\u{200e}\u{2068}QA Bank\u{2069}", english.body)
    let kwd = BankSmsSavedNotice.make(kind: "expense", amountMinor: 1234, currency: "KWD", scale: 3,
      locale: "en", account: "QA", category: "Shopping")!
    precondition(kwd.title == "\u{200e}Payment · \u{2066}1.234\u{00a0}KWD\u{2069}", kwd.title)
    let jpy = BankSmsSavedNotice.make(kind: "expense", amountMinor: 1234, currency: "JPY", scale: 0,
      locale: "en", account: "QA", category: "Shopping")!
    precondition(jpy.title == "\u{200e}Payment · \u{2066}1,234\u{00a0}JPY\u{2069}", jpy.title)
    let exact = BankSmsSavedNotice.make(kind: "expense", amountMinor: 9007199254740991, currency: "SAR", scale: 2,
      locale: "en", account: "QA", category: "Shopping")!
    precondition(exact.title == "\u{200e}Payment · \u{2066}90,071,992,547,409.91\u{00a0}SAR\u{2069}", exact.title)
    let bounded = BankSmsSavedNotice.make(kind: "expense", amountMinor: 1, currency: "SAR", scale: 2,
      locale: "en", account: "Bank\nSpoof\u{202e}", category: String(repeating: "X", count: 300))!
    precondition(bounded.body.count <= 240)
    precondition(bounded.body.hasSuffix("Bank Spoof\u{2069}"), bounded.body)
    precondition(!bounded.body.contains("\u{202e}"), bounded.body)
    precondition(BankSmsSavedNotice.make(kind: "transfer", amountMinor: 1, currency: "SAR", scale: 2,
      locale: "en", account: "QA", category: "Shopping") == nil)
    precondition(BankSmsSavedNotice.make(kind: "expense", amountMinor: 0, currency: "SAR", scale: 2,
      locale: "en", account: "QA", category: "Shopping") == nil)
    print("Bank SMS native notice fixtures passed: Arabic/English, CoreText visual order, directions, scales, exact amount, labels, rejected input")
  }
}
