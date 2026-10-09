# Saudi/UAE financial-message evidence and bilingual rules

The ten supplied screenshots are the primary evidence. Screenshots 7–10 repeat the same image, leaving seven distinct screenshots and nine wording families. Cropped or obscured text is not reconstructed. The SEK screenshot does not show its sender or country. Personal names, masked identifiers, references and merchant names are replaced by placeholders below.

The executable corpus uses synthetic identifiers, merchants, amounts and unambiguous dates. Its `evidence` field identifies the observed wording family; `synthetic` identifies supplemental coverage. A sanitized corpus amount or date is not a transcription of the screenshot.

| Evidence | Visible wording / النص الظاهر | Normalized interpretation / التفسير | Monetary fields |
|---|---|---|---|
| 1, Alinma | `شراء عبر نقاط بيع SAR {amount} بطاقة *{card} مدى-ApplePay من {merchant} في {date}` | POS purchase / شراء نقاط بيع; outgoing; completed | Visible purchases SAR 3.95, 4 and 2; obscured messages are excluded |
| 1, Alinma | `شراء إنترنت مبلغ SAR {amount} بطاقة *{card} مدى-ApplePay حساب {account}* من {merchant} في {date}` | Online purchase / شراء إنترنت; outgoing; completed | SAR 15.33; both card and account are instrument hints |
| 2, du | `شكراً على سدادك مبلغ {amount} درهم لحسابك {bill-account}. الرقم المرجعي للمعاملة هو {reference}. تحقق من استخدامك وقم بإدارة حسابك عبر تطبيق du أو {url}` | Bill payment receipt / إيصال سداد; outgoing expense | Arabic amount typography needs a clearer decimal reading; no exact amount is inferred. Bill-account/reference/URL numbers are excluded from money and bank-instrument extraction |
| 3, ADCB | `AED {amount} has been refunded to your Debit Card xxxx{card} ... by {merchant}. The amount will be credited to your account within 2-3 working days.` | Refund announced / استرداد معلن; incoming; **pending** | AED 12.95; no posted money effect until settlement is reviewed |
| 3, ADCB | `Your debit card XXX{card} linked to acc. XXX{account} was used for AED{amount} ... at {merchant},AE. Avl.Bal AED {balance}.` | Card purchase / شراء بالبطاقة; outgoing; completed | Transaction amounts AED 1183.84, 1163.75, 885.42; balances 13215.65, 11083.68, 10027.57 are separate |
| 4, sender unknown | `Your FlexiblePay card XXXX{card} was successfully credited with SEK {amount} on {date}` | Card credit/funding / إضافة رصيد للبطاقة; incoming; completed; accounting type unresolved | SEK 18831.03; recognized currency held for review; no conversion or income assumption |
| 5, ADCB | `Money Transfer payee addition request ... Transfers will be enabled in 5 minutes ... additional verification ...` | Payee administration / إضافة مستفيد; ignore | No amount or financial posting. Dates, delay and contact number are administrative |
| 6, ADCB | `A Dr. transaction of AED {amount} on your account number XXX{account} was successful. Available balance is {balance}.` | Account debit / خصم من الحساب; outgoing; completed | Transaction AED 1000.00; available balance 4019.83; previous cropped AED 5019.83 is not another transaction |
| 7, repeated in 8–10, ADCB | `Debit Card XX{card} linked to account XX{account} was used for AED{amount} ... at {merchant}, AE. Available Balance AED {balance}` | Card purchase / شراء بالبطاقة; outgoing; completed | AED 126.50 and 65.50; balances 8126.03 and 8060.53; repeats supply no additional transactions |

| Asset family | Arabic inventory | English inventory | Evidence and rule |
|---|---|---|---|
| Purchase | شراء، شراء عبر نقاط بيع، شراء إنترنت | purchase, POS purchase, online purchase, internet purchase, used for | Arabic purchase and English `used for` observed; additional English phrases are supplemental |
| Debit/payment | خصم، دفع، سداد، سدادك | Dr. transaction, debit transaction, debited, paid, payment, charged | `سدادك` and `Dr. transaction` observed; currency/amount/action must agree |
| Credit | إضافة، اضافة، إيداع، ايداع | credited, Cr. transaction, deposit, deposited | `credited` observed. Generic credit/deposit always needs accounting review |
| Refund/reversal | استرداد، مسترد، عكس القيد، عكس العملية | refund, refunded, reversal, reversed | Refund observed; reversal wording supplemental. Original ledger transaction required |
| Lifecycle | قيد المعالجة، معلق، سيتم إيداع؛ فشل، لم تتم، غير ناجحة؛ مرفوض، تم رفض، رفض العملية؛ ملغاة، ملغى | pending, will be credited, working days; failed, unsuccessful; declined, rejected, insufficient funds; cancelled, canceled | Promised future credit observed. Failure, decline and cancellation are supplemental protected exclusions |
| Transfer | تحويل صادر، تحويل وارد | transferred to, transfer to, outgoing transfer, transfer from, incoming transfer | Supplemental. Both owned accounts must be identified; incoming account is the destination |
| Salary | راتب | salary | Supplemental; an incoming credit alone is insufficient |
| Withdrawal | سحب، سحب نقدي | withdrawal, withdrawn, cash withdrawal | Supplemental; requires a cash destination and normal transfer postings |
| Fees | رسوم، عمولة | fee, fees, service charge, commission | Supplemental; fee and purchase amounts are distinct roles |
| Administrative/ignore | إضافة مستفيد، رمز التحقق، رمز الأمان، عرض خاص | payee addition request, transfers will be enabled, verification code, OTP, special offer, promo code | Payee administration observed; OTP/promotion supplemental; protected rules cannot be weakened by configuration |
| Currency | ريال سعودي، ريال، ر.س؛ درهم إماراتي، درهم، د.إ | SAR, AED; SEK | SAR/AED/درهم/SEK observed; other aliases supplemental. Currency scale determines exact minor units |
| Instrument/merchant boundaries | بطاقة، حساب؛ من، في | card, debit card, acc., account; at, by, Avl.Bal, Available Balance | Observed. Keep role plus 4–12 digit suffix; all explicit hints must resolve consistently |

Normalization preserves the source wording while converting Arabic/Persian digits, Unicode presentation forms, decimal separators, whitespace and directional controls for matching. It preserves minor-unit precision, instrument roles and timestamp provenance. The screenshot's short `26-09-26` dates remain ambiguous rather than being assigned a guessed order. ISO-style dates in the sanitized corpus are supplemental normalization fixtures.

The baseline assets live in `packages/transaction-parser/default-rules.json` and are seeded into immutable database releases. Actions are editable through bounded literal predicates (`any`, `all`, `not`) with priority and locale/country/provider/channel applicability. Arbitrary executable code and unrestricted regex are unavailable. The nonconfigurable safety pass preserves OTP, administration, promotion and unsafe lifecycle exclusions even when action configuration changes.

AI is disabled in the schema, parser and capture path. A future optional fallback may propose a subtype or merchant for an unknown message after explicit consent, using redacted wording and deterministic extracted fields only. It must never authorize settlement, choose an account, prove duplicates, convert money, select an original transaction, or write the ledger. Its output must pass the same typed validation and explicit review; timeout, refusal, invalid output or provider failure retains the deterministic review candidate. No AI integration or calls were added by this implementation.
