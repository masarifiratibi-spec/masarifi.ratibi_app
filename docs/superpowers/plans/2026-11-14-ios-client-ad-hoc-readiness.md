# iOS Client Ad Hoc Readiness Implementation Plan

محدّثة في 15 نوفمبر 2026 لتشمل المصدر المنشور Android 153 وحالة مسودات Apple. إعداد وتجربة Ad Hoc هما المسار الحالي؛ قسم المتجر اللاحق جرد مشروط، وبناء iOS ما زال موقوفًا.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Execution is native in the current worktree; do not dispatch agents unless explicitly requested by the user.

**Goal:** تجهيز IPA مستقل من أحدث مصدر Android المشترك، واختباره فعليًا على هاتف المالك ثم إتاحته لجهاز العميل المسجّل، مع الحفاظ على Android.

**Architecture:** نفس تطبيق Expo/React Native ونفس خدمات VPS و Clerk. احتفظ بفصل المنصات الحالي و profile iOS المستقل، واختبر نقاط iOS التي لا يثبتها Android. لا App Store submission أو قاعدة جديدة.

**Tech Stack:** Expo 55، React Native 0.83، TypeScript، Jest، SQLCipher، EAS Cloud Build من Windows، Apple Ad Hoc.

**Spec:** `docs/handoffs/2026-11-15-ios-android153-status-ar.md` هو وصف المتطلبات والحالة؛ اقرأه كاملًا قبل التنفيذ.

## Global Constraints

- Worktree الوحيد لهذه المهمة `E:/Masarifi-iOS`، الفرع `iOS`، remote `ratibi`.
- Source baseline المقبول: `3fd103c702f86637758c4d137dde7199beedd9c3`؛ merge `9f0729d479ef77b2bc196717583a55f48566b13c`، ثم مستندات التسليم فقط.
- بناء EAS/IPA و resign والتثبيت متوقفة حتى طلب صريح؛ أوامرها أدناه خطة وليست أوامر منفذة الآن.
- لا تنقل WIP من D ولا تطبق stash القديم تلقائيًا، ولا تدمج iOS تلقائيًا في Android.
- Android SMS/bank notification capture خارج iOS. اليدوي والصوتي ضمن القبول.
- iOS 17.0 أو أحدث مع الهوية `com.masarifi.mobile` و scheme `masarifi`.
- VPS هو مصدر الكتابة؛ لا Supabase rollback ولا cutover/complete أو نشر كامل للـcheckout أو تغيير مخطط.
- لا App Store/TestFlight upload ضمن التجربة الحالية. السجل 6834811274 موجود؛ لا تنشئ سجلًا مكررًا. أي مسار متجر يحتاج طلبًا مستقلًا ومراجعة القسم المشروط أدناه. لا تغيير Clerk identity أو Android signing.
- لا أسرار/UDID/raw device tokens في Git. تُحفظ الأدلة الخاصة على E فقط.
- لا حذف حساب حي أو إرسال بريد/إشعار قبل إثبات الهوية والنطاق والموافقة المخصصة لذلك؛ استخدم fixtures لأعطال الحذف.

## Review Focus

1. Retry/Continue أثناء خروج native Modal: تبقى واجهة iOS قابلة للاستخدام ولا يتراكب host جديد قبل انتهاء تقديم السابق؛ تثبته مهمة 2.
2. رابط Google/cold deep link أو إعادة فتح التطبيق أثناء القفل: لا تجاوز للقفل أو bootstrap ولا فقد للجلسة؛ مهمة 3 ثم 7.
3. جهاز العميل غير المدرج أو profile منتهي: نجاح البناء ليس إثبات قابلية التثبيت؛ مهمة 4 ثم 5.
4. رفض الميكروفون/انقطاع الشبكة/إلغاء الصوت: لا رفع غير مصرح به ولا ملف مؤقت متروك أو عملية عالقة؛ مهمة 3 ثم 7.
5. فقد رد مزامنة أو ضغطة تقرير بحساب مختلف: لا معاملة مكررة ولا إرسال إلى هوية غير مثبتة؛ مهمة 7.

## File Structure and Ownership

| الملفات | دورها |
|---|---|
| `apps/mobile/eas.json` و`scripts/ios-ad-hoc-config.test.mjs` داخل mobile | نسخة iOS والهوية وقيود profile مع حفظ بقية profiles |
| `apps/mobile/src/features/settings/DevAccountDeletionPanel.tsx` و`src/services/dev-account-deletion-recovery.test.tsx` | مشكلة تقديم Modal المحتملة؛ تغيير مشروط بحالة فشل واضحة |
| `apps/mobile/src/features/auth/NativeSSOCallback.test.ts` و`features/shell/NativeRootRouting.test.ts` | callback و bootstrap والروابط الباردة/الدافئة |
| `apps/mobile/src/features/voice/voice-processing-consent.test.tsx` و`services/platform/voice-recorder-service.test.ts` | موافقة AI وإذن التسجيل والإلغاء |
| `apps/mobile/src/services/platform/{tracking-permission-service,bank-notification-service,phone-notification-service}.test.ts` | حدود Android وتسجيل الإشعارات على iOS |
| `E:/Masarifi-ios-artifacts/ios-next-acceptance-<date>/` | logs و source manifest و IPA وتوقيع metadata وأدلة الجهاز؛ خارج Git |
| مستند تسليم iOS وخطة هذه الجولة | تحديث حالة القبول والقيود؛ لا تضع بيانات حساسة فيهما |

### Task 0: تثبيت مصدر Android 153 ومراجعة CI الحالي

**Files:** Read: source commit والتقرير الحالي و`docs/releases/2026-11-14-tracking-latency-and-copy-153.md`. أي إصلاح مشترك يظل منسقًا مع مالك Android.

**Interfaces:** المصدر `3fd103c702f86637758c4d137dde7199beedd9c3` -> نتيجة CI لنفس الرأس، لا قبول من رأس تاريخي.

- [x] دُمجت 14 نقطة محفوظة/منشورة و 22 ملفًا، وتطابقت Git blobs مع المصدر. لا mobile/API WIP في الجرد الحالي. ملفات Admin/performance/packets المحلية بقيت لدى مالكيها.
- [x] بقيت مدخلات iOS الستة وإعداداته ونسخته 1.0.1 كما هي، ونجحت 6 اختبارات profile الحالية. لا إعادة تثبيت تبعيات أو تغيير counter.
- [ ] اقرأ `gh run list --repo masarifiratibi-spec/masarifi.ratibi_app --commit 3fd103c702f86637758c4d137dde7199beedd9c3 --json databaseId,name,status,conclusion,url`. تابع Foundation 43691118908 إلى النتيجة قبل إعلان أهلية الإصدار؛ مالك المصدر يتابعه بالفعل، فلا تطلق تشغيلات متكررة.
- [ ] إذا نُشر إصلاح أحدث، احفظ SHA ثابتًا وراجع diff وملكية الملفات ثم ادمجه، مع الاحتفاظ بفروق iOS المقصودة. لا تنقل 89 ملفًا محليًا غير منشور لمجرد أنها بجوار المصدر.
- [ ] أصلح ما يثبته فشل حالي بالتنسيق مع مالكه، دون تخفيف assertions أو تغيير pipeline إلى مصدر قديم. إخفاقات 3081 وتصحیح 85ac تاريخية ولا تعاد تلقائيًا.
- [ ] قياس Android 153 لا يثبت تحسن السرعة: اكتمال التفعيل ما زال 7–10 ثوانٍ تقريبًا. لا تعد هذا البند مغلقًا أو تنسبه لتجربة iPhone.

### Task 1: تثبيت نقطة الاستكمال والنسخة المقصودة

**Files:** Modify عند الحاجة: `apps/mobile/eas.json`، `apps/mobile/scripts/ios-ad-hoc-config.test.mjs`. Read: handoff وملف selfhost الحالي.

**Interfaces:** يستهلك profile `ios-ad-hoc` الذي يتوارث production؛ ينتج config بنفس Bundle ID و API و Clerk ونسخة iOS المختارة دون فرق في أي profile Android.

- [ ] اقرأ `git status --short --branch` و`git log -3 --oneline` وتأكد من source ancestry و stash المحفوظ. افتح E نفسه؛ لا تنشئ branch أو worktree جديدًا.
- [x] ثُبّت versionName الآيفون على 1.0.1 عند مزامنة Android 146، وهو أيضًا الرقم التسويقي لـAndroid 153؛ لم يتغير Android versionCode أو counter iOS في هذه الجولة.
- [x] التوقع الذي يقرأ profile الفعلي فشل على القيمة القديمة 1.0.0 ثم نجح بعد تغيير قيمة `build.ios-ad-hoc.env.MASARIFI_RELEASE_VERSION_NAME` فقط. قيم fixture المستقلة ظلت كما هي؛ الأدلة `ios-version-red.log` و`ios-version-green.log`.
- [x] الفحص التاريخي لـprofile/runtime/production entrypoints26/26، ثم 6/6 لاختبار profile الحالي يوم 15 نوفمبر. مدخلاته لم تتغير في تحديث 153، وبقية profiles و submit settings محفوظة دلاليًا بالكامل.
- [ ] في الاستكمال، أعد فحص config فقط عند تعديل مدخلاته أو اعتماد نسخة أخرى. لا ترفع الرقم التسويقي أو تبدأ build تلقائيًا بسبب فتح شات جديد.
- [ ] اقرأ إيصال النشر الحالي وتحقق من source ancestry؛ إذا ظهر source أحدث، نسّق checkpoint منشورًا قبل المزامنة.


### Task 2: حسم خطر تقديم نافذتي حذف الحساب

**Files:** Modify: `apps/mobile/src/features/settings/DevAccountDeletionPanel.tsx` إذا أثبت الاختبار الحاجة. Test: `apps/mobile/src/services/dev-account-deletion-recovery.test.tsx`.

**Interfaces:** حافظ على props `{ownerId:string; recovery?:boolean; presentation?:'default'|'link'}` وعقود خدمة الحذف الحالية؛ ينتج نفس progress/problem/retry/continue والـreceipt fences دون استبدال native host متزامن على iOS.

- [ ] اقرأ موضع Modal الحالي وملاحظات stash، دون `stash pop/apply`. سجل هل أحدث المصدر عالج المشكلة بالفعل.
- [ ] وسّع اختبار الاستعادة الموجود ب fixture iOS و Android. Assertions: من خطأ قابل لإعادة المحاولة إلى Continue/التقدم يبقى native iOS Modal host مستقرًا، وتظل الواجهة busy مع منع ضغطة مكررة، وتُحترم هوية المالك وال receipt. اختبر أيضًا رجوع التقدم إلى خطأ ثم إعادة المحاولة.
- [ ] من mobile شغّل: `node node_modules/jest/bin/jest.js --runInBand --watch=false --cacheDirectory E:/Masarifi-ios-artifacts/jest-mobile-cache --runTestsByPath src/services/dev-account-deletion-recovery.test.tsx`. احفظ RED بسبب السلوك المقصود، وليس خطأ fixture أو مقارنة ReactTestInstance كبيرة. إذا نجح المصدر الحالي أصلًا فلا تضف إصلاحًا وهميًا.
- [ ] إذا ثبت الفشل، استخدم تقديم iOS واحدًا مستقرًا مع تبديل محتواه للخطأ/التقدم، مع حفظ سلوك Android الحالي وعقود الخدمة. لا تعتمد delay ثابتًا لإخفاء السباق ولا تزيد timeout.
- [ ] شغّل كامل suite الاستعادة واختبارات الحذف المتأثرة دون forceExit أو skips. اختبر RTL/reduced motion وعودة التطبيق؛ لا تنفذ حذف حساب حقيقي.
- [ ] من mobile: `node node_modules/typescript/bin/tsc --noEmit`، ثم `node node_modules/eslint/bin/eslint.js src/features/settings/DevAccountDeletionPanel.tsx src/services/dev-account-deletion-recovery.test.tsx`، ثم commit مستقل. إثبات UIKit على جهاز فعلي يبقى مطلوبًا في مهمة 7.

### Task 3: فحص توافق iOS على Windows دون بناء IPA

**Files:** Review/Test الملفات المبينة في خريطة الملكية؛ لا تعديل تلقائي إن كانت الفحوص ناجحة. أي إصلاح جديد يبدأ باختبار incident حقيقي.

**Interfaces:** يستهلك source/profile من مهمة 1 وإصلاح المهمة 2 عند الحاجة؛ ينتج سجلًا مثبت المصدر لفحوص JS/TS وحدود المنصات، ولا ينتج IPA.

فحوص 15 نوفمبر الحالية موثقة في التسليم: 192 حالة في 12 مجموعة، و6 اختبارات profile وTypeScript وlint. الأمر الأشمل أدناه خطوة استكمال عند إصلاح جديد أو تغير مدخلات المسار؛ لا تعد الفحوص الناجحة لمجرد فتح شات جديد.

- [x] شُغّل `node node_modules/typescript/bin/tsc --noEmit` من mobile في جولة 15 نوفمبر؛ نجح دون تعديل source أو dependencies.
- [ ] من mobile، اجعل NODE_ENV=test في عملية الفحص فقط، وشغّل الأمر الآتي مع log جديد. المتوقع كل الحالات المختارة ناجحة وخروج طبيعي؛ لا forceExit أو timeout أعلى لإخفاء مشكلة:

```powershell
& 'C:/Program Files/nodejs/node.exe' node_modules/jest/bin/jest.js --runInBand --watch=false --cacheDirectory E:/Masarifi-ios-artifacts/jest-mobile-cache --runTestsByPath src/features/auth/NativeSSOCallback.test.ts src/features/shell/NativeRootRouting.test.ts src/features/voice/voice-processing-consent.test.tsx src/services/platform/voice-recorder-service.test.ts src/services/platform/phone-notification-service.test.ts src/services/platform/tracking-permission-service.test.ts src/services/platform/bank-notification-service.test.ts src/features/app-update/AppUpdateNotice.test.tsx src/features/tracking/components/TrackingSetupGuide.test.tsx src/services/platform/tracking-alert-settings.test.ts src/services/tracking-owner-partition-runtime.test.ts src/services/tracking-source-consent-integration.test.ts
```
- [ ] ثبّت fixture iOS فعليًا في اختبارات Router/permissions عند الحاجة؛ assertions: دليل SMS/إشعارات البنك على iOS يشرح Android-only ولا ينفذ callbacks التفعيل، وإعداد التنبيهات يفتح Linking فقط دون Android intent، مع رفض تبديل المالك/الجلسة/partition وقبول دوران native generation لنفس المالك فقط. روابط SSO لا تتجاوز bootstrap/lock.
- [ ] شغّل iOS profile tests و lint للملفات المتأثرة. إذا تغيرت حزمة محلية file، طابق cache المثبت مع المصدر قبل نسب فشل للكود.
- [ ] يمكن توليد config/introspection و JS export تشخيصي على Windows إذا طلبه المستخدم؛ يجب وسمه `signedIPA=false` مع source SHA و profile حديث. لا تعِد استخدام `eas-ios-config.json` القديم المفقود منه marker production؛ لا تسمِّ JS export بناء iPhone.
- [ ] إن كان أي فحص يحتاج macOS أو خدمة فعلية، سجّله حدًا صريحًا بدل الادعاء بنجاحه.

### Task 4: الأجهزة والتوقيع — بعد الاستئناف الصريح فقط

**Files:** Read `apps/mobile/app.json`، `eas.json`. Produce أدلة metadata خاصة خارج Git.

**Interfaces:** يستهلك team و Bundle ID و project الحاليين؛ ينتج قائمة جهاز المالك والعميل المدرجة فعليًا في profile صالح.

- [ ] تحقق من Apple Developer membership وفريق الحساب و Expo account `masarifiratibi`. التفعيل التاريخي 6 نوفمبر ليس قراءة حديثة.
- [ ] استخدم EAS المثبت المعروف على E إن ظل صالحًا، ولا تعدّل أدوات Android العامة. عند طلب Apple password/MFA يسجلهما المالك بنفسه؛ لا تجمعهما في الشات أو logs.
- [ ] من mobile، استخدم `& 'C:/Program Files/nodejs/node.exe' 'E:/Masarifi-ios-artifacts/eas-cli-24.4.2/node_modules/eas-cli/bin/run' device:list`، ثم نفس الـCLI مع `device:create` للجهاز الناقص فقط. يفتح العميل رابط التسجيل في Safari ويثبت profile التسجيل من Settings؛ لا ترسل UDID علنًا.
- [ ] فرّق بين تسجيل Expo وبين إدراج الجهاز في Apple/profile المستخدم للبناء. اختر نفس App ID والشهادة القائمة إن كانت صالحة؛ لا تلغِ شهادة أو APNs key لمجرد البدء.
- [ ] إثبات القبول: profile يضم الأجهزة المطلوبة، شهادة و profile غير منتهيين، entitlement/Bundle ID متطابقان، و APNs production مضبوط. احتفظ بتاريخ انتهاء فعلي، لا مدة مفترضة.
- [ ] إذا استغرق قبول Apple لجهاز جديد وقتًا، اقرأ الحالة الرسمية وانتظرها بدل تكرار device:create/build أو حذف credentials.

### Task 5: بناء IPA واحد من المصدر النهائي — بعد فك الإيقاف

**Files:** Read source/profile المقفل. Produce IPA و manifest خاصين على E.

**Interfaces:** source HEAD ثابت + بيانات مهمة 4 -> build ID و IPA hash و source receipt متطابق.

- [ ] تأكد من عدم وجود build جارٍ لنفس المصدر أولًا. سجل commit/tree ونسخة dependencies و version/profile والأجهزة.
- [ ] من `E:/Masarifi-iOS/apps/mobile` وبعد تصريح البناء فقط، استخدم CLI المعروف:
  `& 'C:/Program Files/nodejs/node.exe' 'E:/Masarifi-ios-artifacts/eas-cli-24.4.2/node_modules/eas-cli/bin/run' build --platform ios --profile ios-ad-hoc`.
- [ ] استخدم مسار Apple التفاعلي لتحديث قائمة أجهزة profile عند الحاجة. لا تفترض أن build غير تفاعلي يعيد إدراج الأجهزة تلقائيًا.
- [ ] تابع build نفسه حتى يكتمل؛ لا تنشئ build ثانيًا لتجاوز خطأ غير مشخص.
- [ ] نزّل IPA وسجل SHA256 والحجم و EAS build ID/source SHA. افحص Bundle ID، version/build، ARM64، minimum iOS 17، صلاحية embedded profile، الأجهزة، microphone/FaceID، APNs production وغياب arbitrary ATS.
- [ ] لا تستبدل IPA2 أو أدلته. لا تدّع full macOS codesign verification إذا اقتصر الفحص على Windows metadata/CMS.
- [ ] احتفظ برابط تثبيت خاص للمالك أولًا؛ لا App Store app record أو `eas submit`.

### Task 6: تثبيت المالك واختبار الاستقلال

**Files:** No planned code edits. Record أدلة جهاز خاصة.

**Interfaces:** IPA مهمة 5 -> تثبيت وتشغيل مستقل بلا Metro أو كمبيوتر متصل.

- [ ] يفتح المالك رابط التثبيت من Safari على الجهاز المدرج. يتبع Developer Mode الرسمي من Settings إن لزم، ثم يعيد فتح التطبيق.
- [ ] تحقق من رقم الإصدار/البناء والهوية، ثم تشغيل بارد وإغلاق وإعادة فتح مستقلين دون server JS محلي.
- [ ] الدخول بحساب اختبار معلوم، Google/cancel/back-to-app، واستمرار الجلسة بعد الإغلاق. لا تبديل أو حذف تلقائي لحساب حي.
- [ ] فشل التثبيت يُشخّص عبر profile/device/expiration/minimum iOS/source؛ نجاح EAS وحده لا يغلق المهمة.

### Task 7: قبول الميزات على iPhone

**Files:** No change إلا لإصلاح حادثة مثبتة مع test/commit. Produce جدول قبول وحالة pass/fail/not-tested لكل صف.

**Interfaces:** الجهاز المثبت والهوية المؤكدة -> قبول مستخدم موثق لكل مسار.

| المسار | إثبات القبول |
|---|---|
| المالية | حساب، معاملة، تحويل، ميزانية وأرصدة صحيحة؛ بيانات اختبار مصرح بها |
| الأوفلاين | إنشاء أثناء الانقطاع ثم صف خادم واحد بعد الاتصال؛ إعادة فتح لا تكرر المعاملة |
| الخصوصية | النصوص الحالية بالعربية/الإنجليزية و VPS، القفل و FaceID/PIN و background/switcher |
| الصوت | موافقة AI منفصلة؛ قبول/رفض الميكروفون؛ تسجيل/إلغاء/مقاطعة؛ رفع ومعالجة وعودة سليمة |
| المساعد | سؤال فعلي ورد، تحميل/خطأ/إعادة محاولة، RTL واللغة وحالة الشبكة |
| PDF/البريد | أثبت البريد المقصود من الهوية الكاملة قبل أي إرسال؛ موافقة إرسال مخصصة؛ رسالة ومرفق مطابقان |
| الإشعارات | token صحيح ثم إشعار اختبار واحد مصرح؛ فتح بارد/دافئ والقفل وروابط الأمن الحالية |
| حذف الحساب | fixtures + Modal transitions؛ أي اختبار حي لا يتم على الحساب الحالي أو دون موافقة مخصصة |
| إعادة التشغيل | الجلسة والتخزين المشفر والبيانات تبقى سليمة بلا اعتماد Metro |
| الحدود | SMS/التقاط إشعار بنك Android غير معروض كميزة iOS؛ لا رابط Google Play على iOS |

- [ ] اربط كل نتيجة بـbuild ID ومصدر ونسخة iOS وتاريخ، دون نشر بيانات المستخدم.
- [ ] إذا فشل مسار، وثق trigger والنتيجة المتوقعة والفعلية. أصلح في commit منفصل، وأعد الفحوص المتأثرة فقط، ثم build جديد فقط عند الحاجة وبعد استمرار التفويض.
- [ ] لا تعلن customer-ready إذا بقيت ميزة مطلوبة fail أو not-tested. نجاح Android 153 أو اختبار SMTP اصطناعي لا يملأ جدول iPhone.

### Task 8: التسليم للعميل وإقفال السجل

**Files:** Update handoff وتقرير قبول جديد؛ IPA/UDID/credentials تبقى خاصة خارج Git.

**Interfaces:** كل المسارات المطلوبة مقبولة + جهاز العميل ضمن profile -> رابط تثبيت العميل وتعليماته.

- [ ] تأكد أن جهاز العميل مدرج في profile الخاص بالـIPA المقبول. لو أضيف بعد البناء، استخدم resign للكود الحالي المؤهل أو build مضبوط؛ لا تعِد توقيع IPA2 القديم وكأنه يتضمن 153.
- [ ] أعطِ العميل رابط التثبيت الخاص وتعليمات Safari و Developer Mode عند الحاجة وحد أدنى iOS 17 وتاريخ صلاحية التوزيع الفعلي.
- [ ] أثبت تثبيت العميل وتشغيله بحسابه دون Mac أو Metro، ثم سجل أي حدود وظيفية متفق عليها.
- [ ] حدّث جدول الإنجاز والروابط والبصمات ومواضع الأدلة وملف handoff، وادفع فرع iOS إلى ratibi بعد فحوصه. لا merge-back تلقائيًا إلى Android.
- [ ] عند إضافة code changes: typecheck/scoped lint/tests، `git diff --check`، وفحص الأسرار الكامل عند HEAD المنشور. لا تغيّر قواعده أو تضف استثناءً عامًا.

## مسار المتجر/TestFlight — جرد مشروط منفصل

هذا القسم لا يغير هدف Ad Hoc ولا يفك إيقاف البناء أو يعطي موافقة Apple. سجل App Store Connect موجود بالفعل: Apple ID6834811274، bundle `com.masarifi.mobile`، SKU `masarifiratibi-ios-001`، والاسم المحفوظ`Masrifi ratibi`.

| البند | المطلوب قبل اختيار مسار المتجر أو إرساله |
|---|---|
| build profile | المؤهل حاليًا `ios-ad-hoc` فقط. لا تستخدم `production` الحالي على iOS كأنه مؤهل للمتجر؛ القيم العامة/version وإضافة Clerk native/iOS 17 مرتبطة بمسار Ad Hoc. عند طلب المتجر، جهز profile iOS مستقلًا وسياسات runtime/config متوافقة معه واختبارات رفض الخلط مع Android قبل أي build |
| ملفات الكود المرتبطة | `apps/mobile/eas.json`، `app.config.js`، `scripts/check-client-runtime.mjs`، `scripts/production-entrypoints.cjs` واختباراتها. استهلك نفس Bundle ID و Clerk و EAS project؛ لا تعيد استخدام marker Ad Hoc لتمرير store build بلا اختبارات |
| الدخول | الكود الحالي يستخدم Google و`appleSignIn:false`. راجع انطباق 4.8 على مسار الدخول الفعلي والاستثناءات، أو جهّز خيارًا مكافئًا مستوفيًا للشروط إذا لزم. لا تجزم بالإعفاء أو باكتمال Sign in with Apple من نجاح Google/Clerk. أي تنفيذ دخول إضافي يحتاج نطاقًا معتمدًا واختبارات callback/cancel/session |
| التشفير | SQLCipher مفعّل. اجرد التشفير الفعلي بالـIPA النهائي و SDKs، وحدد أجوبة export compliance والمستندات وفقها. لا تضع exemption/No أو تعتمد سؤال التشفير تلقائيًا |
| App Privacy | آخر تحقق من نموذج الأنواع كان 14 نوفمبر،8 أنواع معلومة فقط، دون Save/Publish. أكمل جرد التطبيق والخادم و SDKs والأغراض والربط والتتبع والاحتفاظ، ثم مراجعة المالك؛ لا تستنتج أن الأنواع غير المحددة غير مجموعة |
| العمر | حُفظ التصنيف 4+ وفق صورة المستخدم 15 نوفمبر. هذا لا يساوي Made for Kids أو حسم الحد الأدنى لحسابات القُصّر؛ طابق الشروط وضوابط العمر عند المراجعة |
| التوطين والإتاحة | الهدف الخليج والعالم العربي. أكد مالك مسودات Apple حفظ الوصف والترويج والكلمات والعنوان الفرعي بالعربية يوم 15 نوفمبر، وإضافة Productivity ثانويًا إلى Finance. راجع النصوص مقابل الميزات المقبولة؛ بطاقات 172 منطقة للتصنيف ليست دليل اختيار الدول. Pricing/Availability لم تؤكدا في التسليم |
| معلومات الإصدار | سجل المتجر 1.0 بينما profile الآيفون 1.0.1؛ راجع المطابقة قبل ربط build. حساب المراجع ولقطات iPhone و build ما زالت بلا قبول. جهّز مسودة مراجعة بهوية مصرح بها، دون نشر credentials في Git |
| بقية الإقرارات | Content Rights و DSA بحسب الأسواق والتشفير و Accessibility و Pricing ما زالت للمراجعة. لا توقعها أو Submit/Add for Review/Publish بمجرد فتح الشات |
| دليل القبول | سجل Prepare for Submission لا يثبت رفع build أو اكتمال TestFlight أو قبول App Review. لا تستخدم IPA2 القديم كممثل للمصدر 153 |

مراجع Apple الحالية: [Login Services4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)، [Export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/)، [App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy).
هذا جرد فجوات ومهام مراجعة، وليس حكمًا بأن التطبيق معفى أو متوافق.

## مصادر سير التوزيع

[Expo internal distribution](https://docs.expo.dev/build/internal-distribution/)،
[Apple Ad Hoc provisioning](https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile/)،
[Expo Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/).
هذه روابط إرشاد؛ لا تمنح موافقة تشغيل build أو تعديل حساب Apple.
