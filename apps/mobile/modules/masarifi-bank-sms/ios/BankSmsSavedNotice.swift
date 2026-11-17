import Foundation

struct BankSmsSavedNotice {
  let title: String
  let body: String

  static func make(kind: String, amountMinor: Int64, currency: String, scale: Int,
                   locale: String, account: String, category: String) -> Self? {
    guard ["income", "expense"].contains(kind), amountMinor > 0, amountMinor <= 9_007_199_254_740_991,
          (0...4).contains(scale),
          currency.range(of: "^[A-Z]{3}$", options: .regularExpression) != nil else { return nil }
    let arabic = locale == "ar"
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: arabic ? "ar_SA@numbers=latn" : "en_US")
    formatter.numberStyle = .decimal
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = 0
    let divisor = (0..<scale).reduce(Int64(1)) { value, _ in value * 10 }
    guard let whole = formatter.string(from: NSNumber(value: amountMinor / divisor)) else { return nil }
    // Match the app's exact minor-unit formatter; avoid a Double conversion of money.
    let fraction = String(amountMinor % divisor)
    let formatted = scale == 0 ? whole : whole + (formatter.decimalSeparator ?? ".") +
      String(repeating: "0", count: max(0, scale - fraction.count)) + fraction
    let direction = kind == "income" ? (arabic ? "إيداع" : "Deposit") : (arabic ? "دفع" : "Payment")
    return Self(title: "\(direction) · \(formatted)\u{00a0}\(currency)",
                body: [label(category), label(account)].filter { !$0.isEmpty }.joined(separator: "\n"))
  }

  private static func label(_ value: String) -> String {
    let plain = value.unicodeScalars.filter {
      ![0x061c, 0x200e, 0x200f].contains($0.value) &&
        !(0x202a...0x202e).contains($0.value) && !(0x2066...0x2069).contains($0.value)
    }.map { String($0) }.joined()
    return String(plain.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).joined(separator: " ").prefix(110))
  }
}
