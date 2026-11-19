import Foundation
import JavaScriptCore

// Exercise the actual Release bundle through the same JSContext API as the App Intent.
let context = JSContext()!
context.evaluateScript(try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8))
let classifier = context.objectForKeyedSubscript("masarifiClassifyBankSms")!
let accounts: [[String: Any]] = [
  ["id": "bank", "type": "bank", "issuer": "QAALFA", "currency": "SAR", "accountEnding": "7373", "automaticRouting": true],
  ["id": "card", "type": "credit_card", "issuer": "QABETA", "currency": "SAR", "lastFour": "8181", "automaticRouting": true]
]
let routing: [String: Any] = ["accounts": accounts, "categories": [["id": "bills", "kind": "expense"]],
                              "preferences": ["expenseId": "bills"]]
func parse(_ text: String) -> [String: Any]? {
  let result = classifier.call(withArguments: [text, 1795082400000, "Asia/Riyadh", routing])
  precondition(context.exception == nil, "Release classifier raised a JavaScript exception")
  guard let result, !result.isNull, !result.isUndefined else { return nil }
  return result.toDictionary() as? [String: Any]
}
let debit = parse("QAALFA Bill payment SAR 100 from account XX7373 to credit card XX8181 Ref: QAPAY123")!
let credit = parse("QABETA تم سداد فاتورة البطاقة بمبلغ SAR 100 من حساب XX7373 إلى بطاقة XX8181 مرجع: qapay123")!
for row in [debit, credit] {
  precondition(row["kind"] as? String == "transfer" && row["amountMinor"] as? Int == 10000)
  precondition(row["accountId"] as? String == "bank" && row["destinationAccountId"] as? String == "card")
}
let identity = debit["stableReferenceIdentity"] as? String
precondition(identity != nil && credit["stableReferenceIdentity"] as? String == identity)
precondition(parse("Credit card bill payment SAR 100 from account XX7373 Ref: QAPAY123") == nil)
precondition(parse("Electricity bill payment SAR 100 from account XX7373")?["kind"] as? String == "expense")
print("JavaScriptCore verified shared repayment identity, source, credit destination and ordinary utility bill.")
