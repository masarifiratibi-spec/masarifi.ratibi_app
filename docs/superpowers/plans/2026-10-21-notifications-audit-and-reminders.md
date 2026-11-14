# Notifications Audit and Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task after the user approves it. Steps use checkbox syntax. This document does not authorize implementation or service activation.

**Goal:** إثبات التقاط إشعارات البنوك والمحافظ كمعاملات صحيحة، ثم تقديم تذكيرات مفيدة بالعربية والإنجليزية وفق حالة المستخدم وموافقته.

**Architecture:** مساران منفصلان: التقاط إشعارات التطبيقات على Android عبر NotificationListenerService والطابور والتحليل الحالي، وتذكيرات المستخدم عبر منظومة Engagement وExpo الحالية. تذكير الزائر الذي لم ينشئ حسابًا بعد يكون محليًا؛ لا نضيف هوية مجهولة على الخادم أو منصة حملات جديدة.

**Tech Stack:** React Native / Expo، Android Kotlin / WorkManager، TypeScript API / workers، Supabase PostgreSQL، Expo Push.

**Spec:** طلب المستخدم بتاريخ 2026-10-21: مراجعة التقاط الإشعارات المالية والتذكيرات، إعداد خطة بالعربية والإنجليزية قبل التنفيذ. المتطلبات المقترحة والأدلة في هذا المستند مسودة للمراجعة، وليست تغييرات معتمدة.

## Execution status — 2026-10-21

Current explicit instruction supersedes the release discussion: do not create, configure, deploy or publish Production now. Finish and demonstrate the feature for every authenticated user on the current environment, with no account allowlist. Generic capability code is qualified using the DEV APK and isolated Staging services; existing ordinary services/binaries remain unchanged. Production setup is deferred and requires no user input in this task.

Latest product clarification: the intended result is the public Production release for all users; DEV is the qualification environment, not a permanent product restriction. Return reminders default to enabled when OS notification permission is granted, with no additional account opt-in step. Explicit opt-out must survive restart and account changes without transferring one owner's choice to another. Automatic financial capture remains subject to its separate permissions and routes by source currency without duplicate postings. Complete DEV qualification, then carry the same capability into the public release configuration; verify the actual Production target and credentials before release activation. Earlier DEV-only scope and additional-consent statements below record the previous stage and are superseded by this clarification.

The subsequent user instruction explicitly authorizes permanent DEV capture and activation of Arabic/English reminders, including Samsung delivery tests, while leaving the ordinary app and Production unchanged. DEV enrollment will use an authenticated, explicitly gated DEV route and its own local API process; ordinary snapshot GETs and the existing API/worker services remain unchanged. Enrollment binds the tracking installation to the server-owned registered notification device, keeps capture consent and currency/account safeguards, and advances the active rule release without a timed cohort expiry. DEV reminders use that installation's separate foreground activity and explicit reminder consent; background traffic cannot count as an app visit. A dedicated reminder process claims only DEV-bound events/tokens and persists provider ticket/receipt outcomes. Guest reminders remain local and use a separately validated public onboarding payload.

The user approved DEV implementation after this review plan. Financial capture now has a scoped, opt-in source-currency policy, generic source labels, listener recovery and duplicate protections. Actual Samsung wallet capture and reopen were verified; synthetic PostgreSQL cases cover both channels and currency/account lifecycle transitions. Account switching now projects shared authoritative balances and cached daily activity.

Reminder work remains separate: baseline normalization and device-registration fixes are prepared and tested; remote delivery, token rotation, receipts and the additional reminder lifecycle are not complete or activated. The original review-only statements below describe the initial audit, not current user authorization. Production and the ordinary application remain outside this rollout.

## Global Constraints

- لا تعديل للكود التشغيلي أو قاعدة البيانات أو الخدمات ولا إرسال Push أثناء مرحلة المراجعة الحالية.
- التنفيذ التجريبي لاحقًا على DEV وحساب اختبار معزول؛ لا مساس ببيانات التطبيق العادي. Staging قد يخدم عملاء آخرين، وأي تفعيل مشترك يحتاج مراجعة نطاقه وموافقة المستخدم.
- لا تُغيّر إعدادات Firewall أو SSH أو Nginx ضمن هذه الخطة.
- إذن التقاط إشعارات التطبيقات منفصل عن إذن عرض الإشعارات، وموافقة تذكيرات العودة منفصلة عنهما.
- تبقى أقسام الأمان والإشعارات المخفية في قائمة المزيد مخفية، كما طلب المستخدم سابقًا.
- لغة تحليل المعاملة مستقلة عن لغة الواجهة. نص التذكير يتبع لغة المستخدم AR/EN.
- لا نعرض مبالغ أو أرصدة أو نص رسالة البنك على شاشة القفل، ولا نسجل النصوص أو الرموز السرية في أدلة الاختبار.
- لا نعد بالتقاط كامل على كل جهاز: يلزم تفعيل الوصول ومحتوى قابل للتحليل؛ قيود Android، الإيقاف الإجباري والمحتوى المحجوب تحتاج عرض حالة واضح للمستخدم.

## Review Focus

1. إعادة إرسال إشعار محدث أو وصول SMS لنفس المعاملة: أثر مالي واحد فقط — المهمة A1.
2. انقطاع المستمع أو الشبكة وتبديل المستخدم: حفظ الطابور وعزل المالك وعدم استيراد ما قبل التفعيل — A1.
3. تغيير صيغة الوقت أو دقته: لا تكرار دورة تذكير ولا إرسال تذكير بعد عودة المستخدم — B1.
4. فشل تسجيل رمز Push أو تغيره: إعادة محاولة محدودة دون ربط الرمز بالمستخدم السابق — B2.
5. اكتمال التسجيل/إضافة معاملة بعد جدولة التذكير: إعادة تحقق قبل الإرسال وإلغاء المحلي، مع احترام اللغة والمنطقة الزمنية — B3 وB4.

## نتائج المراجعة الفعلية

المصدر: الفرع `codex/voice-promoted-operating-2026-10-13`، commit `c8a5b77412294a16120ad25f5bfcaceea11159d3`. لا توجد تغييرات منتج من هذه المراجعة.

| المسار | ما ثبت | ما لم يثبت بعد |
|---|---|---|
| التقاط إشعارات البنوك والمحافظ | مستمع DEV مفعّل، صلاحيات الالتقاط والعرض ممنوحة، وتفضيلات SMS والإشعارات مفعّلة. يوجد فلتر مالي وطابور مشفر وتحليل ومزامنة ومنع تكرار. | لم نرسل إشعار بنك خارجيًا ونتتبعه حتى المعاملة النهائية في هذه المراجعة. المسار الحالي لالتقاط تطبيقات أخرى خاص بـAndroid. |
| إرسال Push | متغير `MASARIFI_ENGAGEMENT_PROVIDER_MODE=disabled` في العمال العاملين على Staging. الحساب المفحوص لا يملك رمز Push نشطًا. | لم نثبت وصول Push إلى الجهاز؛ وجود إذن العرض وحده لا يكفي. |
| الجدولة | مهمتا dispatch/evaluate مفعّلتان في جدول العمليات. آخر تشغيل مسجل لـdispatch بتاريخ 4 أكتوبر، ولا يوجد تشغيل مسجل لتقييم التذكيرات. | لا دليل على تنفيذ التقييم دوريًا الآن. يلزم تتبع مشغّل الوظائف بدل افتراض أن علامة enabled تعني أنه يعمل. |
| أهلية التذكير | دالة المرشحين تعيد `baseline_at` بصيغة PostgreSQL النصية ذات المسافة؛ فحص الإرسال يقبل بادئة ISO بحرف `T` فقط. أثبت استعلام ثابت للقراءة أن الصيغة الناتجة تفشل هذا الشرط. | الاختبارات الحالية تستعمل غالبًا ISO جاهزًا، ولا تثبت دورة قاعدة البيانات كاملة. |
| تسجيل الجهاز | التطبيق يضع علامة تسجيل الجلسة قبل انتهاء الطلب، ويبتلع الخطأ؛ لا توجد إعادة تسجيل في معالج العودة للمقدمة أو مستمع مملوك للتطبيق لتغير الرمز. | سبب عدم وجود رمز للحساب المحدد لم يُحسم؛ هذا خلل محتمل مؤكد في التعامل مع الفشل، وليس إثباتًا لسبب حالته. |
| أنواع التذكيرات | يوجد غياب 3 أيام و7 أيام، وغياب نشاط مالي 7 أيام. | لا مسار مخصص لاستكمال التسجيل أو أول معاملة، ولا Push لزائر قبل إنشاء الحساب. |
| تتبع التسليم | قبول تذكرة Expo يُسجل delivered حاليًا. | لا يوجد استطلاع Expo receipts؛ قبول المزود لا يثبت وصول الجهاز أو فتح المستخدم. |

الاختبارات المنفذة: **140 mobile + 138 API + 44 parser = 322 ناجحًا، بلا فشل**. لا اختبار DB يكتب على Staging، ولا حقن معاملة، ولا تغيير أذونات، ولا إرسال إشعار.

الأدلة المحلية: `D:/Masarifi-preservation-2026-10-18/voice-final-readiness-repair/notifications-plan-20261021/`.

## السلوك المقترح للتذكيرات — للمراجعة

| الحالة | التوقيت المقترح | الوجهة | شرط الإلغاء |
|---|---|---|---|
| ترك التسجيل قبل إنشاء حساب | إشعار محلي واحد بعد 24 ساعة، بعد موافقة واضحة | استكمال التسجيل عبر مسار عام آمن | إنشاء الحساب أو إيقاف التذكيرات |
| حساب موجود وإعداد غير مكتمل | بعد 24 ساعة | أول خطوة إعداد مطلوبة | اكتمال الإعداد أو سحب الموافقة |
| الإعداد مكتمل ولا توجد معاملة | بعد 24 ساعة | إضافة أول معاملة | وجود أي معاملة محفوظة |
| عدم فتح التطبيق | بعد 3 أيام ثم 7 أيام | الرئيسية | عودة المستخدم أو سحب الموافقة |
| لا نشاط مالي والتتبع مفعّل | بعد 7 أيام | متابعة التتبع | نشاط مالي جديد أو تعطيل التتبع |

- سقف مقترح: تذكير عودة واحد يوميًا، واثنان خلال 7 أيام لكل مستخدم، مع تطبيق الأكثر صلة فقط: استكمال الإعداد ثم أول معاملة ثم الغياب.
- ساعات هدوء مقترحة: 22:00–08:00 حسب المنطقة الزمنية. التذكير المستحق خلالها يؤجل ويعاد التحقق من أهليته؛ لا يعاد إحياء دورة أُلغيت.
- بعد تذكيرين دون تفاعل، تتوقف دورة العودة إلى أن يعود المستخدم. إشعارات حالة الالتقاط والمعاملات لها تصنيف مستقل عن سقف تذكيرات العودة.
- المقترح الأول يرسل لجهاز المستخدم النشط الأحدث، اتساقًا مع اختيار الرمز الحالي. دعم عدة أجهزة يحتاج قرارًا صريحًا لمنع الإزعاج والتكرار.
- التحكم في هذه التذكيرات داخل «إعدادات التطبيق» دون إعادة إظهار قسم الإشعارات في «المزيد».

| الاستخدام | العربية: العنوان / النص | English: title / body |
|---|---|---|
| استكمال التسجيل | أكمل إعداد حسابك / خطوة بسيطة وتبدأ متابعة مصاريفك. | Finish setting up your account / You’re one step away from tracking your spending. |
| أول معاملة | ابدأ بأول معاملة / أضف مصروفك الأول، كتابةً أو بصوتك. | Add your first transaction / Log your first expense by typing or speaking. |
| العودة | راجع مصاريفك / افتح مصاريفي وتابع مصاريفك بسهولة. | Check in on your spending / Open Masarifi to keep track of your spending. |

## مسار A: تأهيل التقاط إشعارات البنوك والمحافظ

### A1: إثبات المسار كاملًا ومعالجة الانقطاع إن فشل الاختبار

**Files:**
- Inspect/modify only when a failure is reproduced: `apps/mobile/modules/masarifi-sms-inbox/android/src/main/java/com/masarifi/smsinbox/MasarifiNotificationListenerService.kt`, `FinancialDiscoveryPolicy.kt` in the same directory.
- Inspect: `apps/mobile/src/services/automatic-tracking-coordinator.ts`, `tracking-background-runtime.ts`, `live/automatic-tracking-service.ts`, `apps/api/src/tracking/tracking.worker.ts`.
- Tests: existing native `NotificationQueueTest.kt`, `FinancialDiscoveryPolicyTest.kt`, `TrackingSchedulerWakeTest.kt`, plus `apps/mobile/src/services/automatic-tracking-coordinator.test.ts` and `packages/transaction-parser/financial-content.test.js`.

**Interfaces:** Existing native capture record → encrypted queue → durable local import → server parser → ledger → UI. Add diagnostics containing stage/trace ID and outcome only, without financial text.

- [ ] إنشاء مصفوفة عينات صناعية على حساب DEV معزول: بنك ومحفظة بالعربية والإنجليزية، مصروف وإيداع واسترداد، أرقام عربية وعملات مختلفة، OTP وإعلان ومعاملة فاشلة أو معلقة ومبلغ ملتبس.
- [ ] تشغيل إشعار من تطبيق اختبار منفصل، وتتبع كل عينة عبر مراحل المسار. المالي الواضح ينتج معاملة واحدة بالقيمة والعملة والاتجاه الصحيح؛ المحتوى الملتبس يتبع سياسة المراجعة الحالية ولا يسجل تلقائيًا.
- [ ] اختبار تحديث نفس الإشعار، ووصول SMS وإشعار لنفس الحدث، وانقطاع الشبكة ثم عودتها، وغلق التطبيق، وتبديل الحساب. إثبات عدم الفقد وعدم التكرار وعدم عبور ملكية الطابور.
- [ ] اختبار انقطاع المستمع وإعادة اتصال الخدمة. عند إثبات الفجوة، إضافة callbacks اتصال وحالة صحية وإعادة ربط محدودة. استعادة الإشعارات النشطة فقط بعد وقت موافقة الالتقاط، عبر نفس الفلتر ومنع التكرار.
- [ ] تشغيل اختبارات Kotlin المستهدفة عبر Gradle wrapper للموديول بعد تحديد مسار المشروع من `settings.gradle`، واختبارات coordinator/parser. حفظ نتيجة التجربة على جهازين مختلفين على الأقل؛ توثيق فرق الإغلاق العادي عن force-stop وحدود المصنع.
- [ ] نقطة قبول A: أمثلة بنك ومحفظة تمر من إشعار خارجي إلى UI، مع دليل سلبي لـOTP/إعلان ودليل منع تكرار/استعادة شبكة. لا تغيير قواعد التحليل لمجرد اجتياز عينة واحدة.

مرجع دورة المستمع: [Android NotificationListenerService](https://developer.android.com/reference/android/service/notification/NotificationListenerService).

## مسار B: إصلاح الإرسال ثم إضافة التذكيرات

### B1: إصلاح أهلية التذكير بدورة قاعدة بيانات حقيقية

**Files:**
- Create migration using `supabase migration new normalize_reminder_cycle_baseline`؛ لا تعديل migration مطبقة.
- Existing behavior: `supabase/migrations/20260914110249_user_reminders.sql`, `apps/api/src/engagement/engagement.repository.ts`, `engagement.reminders.ts`.
- Tests: `apps/api/test/integration/engagement/reminder-eligibility.integration.spec.ts`, `reminder-delivery-revalidation.integration.spec.ts`, `apps/api/test/unit/engagement/engagement-reminders.spec.ts`.

**Interfaces:** `list_reminder_candidates` → baseline text → stable source identity → stored `cycleBaseline` → `reminder_delivery_eligible`. Every stage must use one canonical UTC ISO representation preserving PostgreSQL microseconds.

- [ ] إضافة اختبار على DB محلية قابلة للإتلاف: مرشح حقيقي → إنشاء الحدث → فحص أهليته؛ إثبات الفشل الحالي الناتج من المسافة مقابل `T`.
- [ ] تعريف UTC ISO ثابت بدقة ست خانات؛ تحديث الدوال اللازمة ودعم الأحداث المحفوظة بالصيغة السابقة بمقارنة الزمن الحقيقي. لا تحويل JavaScript يقتطع الدقة أو يولد دورة ثانية لنفس الزمن.
- [ ] اختبار أن التقييم المتكرر لا ينشئ نسخة ثانية، وأن عودة المستخدم أو إيقاف التذكير أو حذف الحساب قبل الإرسال تسقط الأهلية، مع عينة ذات microseconds وصيغة قديمة وأخرى غير صالحة.
- [ ] تشغيل اختبارات DB مع `MASARIFI_LIVE_DATABASE_TESTS=1` و`DATABASE_URL` لقاعدة محلية مخصصة فقط. مراجعة SQL وحقوق التنفيذ وchecksum قبل عرض migration للتفعيل.

### B2: تسجيل الجهاز وإثبات تسليم Push

**Files:**
- `apps/mobile/src/state/AppShellProvider.tsx`, `apps/mobile/src/services/platform/phone-notification-service.ts`, `apps/mobile/src/services/live/engagement-service.ts`.
- `apps/api/src/engagement/notification.providers.ts`, `engagement.worker.ts`, `engagement.repository.ts`, `apps/api/src/operations/job-registry.ts`.
- Tests: existing `phone-notification-service`, `services/live/engagement-service` and engagement worker/provider suites; add focused registration retry tests beside the session registration owner.

**Interfaces:** device registration is successful only after the authenticated server write; owner/session identifies retries. Separate provider acceptance, receipt outcome and user open without redefining existing statuses inconsistently.

- [ ] إضافة اختبار فشل أول تسجيل ثم نجاح المحاولة التالية، وتغيير الرمز، ورفض الإذن، وتبديل المالك أثناء الطلب. الطلب القديم لا يسجل رمزًا للحساب الجديد.
- [ ] وضع علامة التسجيل بعد النجاح فقط؛ إعادة محاولة محدودة عند العودة للمقدمة/عودة الشبكة/تغير الرمز أو الإذن. منع طلبات متزامنة متكررة وإضافة سبب فشل منقح دون الرمز.
- [ ] تتبع ticket وreceipt في Expo، ومعالجة الرموز الملغاة، مع فحص schema الحالي قبل اختيار migration لتخزين النتيجة. القبول ليس تأكيد عرض أو فتح.
- [ ] تشخيص مشغل الجدولة الذي لم يسجل تقييمًا؛ تجهيز تفعيل محدد لـevaluate/dispatch والمزود فقط، دون تشغيل بقية الوظائف أو تبديل موديلات أو رفع حدود تكلفة.
- [ ] بعد موافقة التفعيل المحدد: Push تجريبي واحد إلى حساب DEV، ثم إثبات وصوله وفتح وجهته في المقدمة والخلفية وبعد الإغلاق، مع اختبار الرمز الملغى. حفظ زمن القبول/receipt/الوصول منفصلة.

مرجع التسليم: [Expo tickets and receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

### B3: قواعد التذكير واللغة والتحكم

**Files:**
- `apps/api/src/engagement/engagement.reminders.ts`, `engagement.repository.ts`, `notification.policy.ts`, `notification.renderer.ts`.
- `apps/mobile/src/domain/notifications.ts`, `apps/mobile/src/features/settings/ApplicationSettingsScreen.tsx`، ملفات ترجمة AR/EN الحالية.
- New migration عبر CLI للقوالب/الأهلية والتفضيلات التي تحتاجها الأنواع الجديدة.
- Tests: reminder eligibility/policy/renderer suites، واختبار إعدادات اللغة والموافقة.

**Interfaces:** authenticated candidates consume `onboarding_progress`, transaction existence, foreground activity, explicit preferences and timezone. New events: `reminder.onboarding_incomplete.1d` and `reminder.first_transaction.1d`; reuse existing inactivity types.

- [ ] تثبيت اختبارات حالات الجدول أعلاه، والأولوية والسقف وساعات الهدوء، مع عبور منتصف الليل والمنطقة الزمنية وتغير اللغة بين التقييم والإرسال.
- [ ] فصل نشاط فتح التطبيق عن استدعاءات `/me` في الخلفية بعد تتبع callers؛ لا يعتمد قياس الغياب على طلب قد يحدث دون فتح التطبيق.
- [ ] إضافة المرشحين والقوالب المنشورة AR/EN والاختيار حسب لغة الحساب، مع إعادة تقييم الحالة قبل الإرسال. لا إرسال نص قالب بلغة أخرى داخل حملة عامة.
- [ ] إضافة تحكم بسيط في تذكيرات العودة داخل إعدادات التطبيق، مع إبقاء الأقسام المخفية كما هي. الاختبارات تثبت أن رفض هذه التذكيرات لا يعطل التقاط البنوك.
- [ ] اختبار إتمام الإعداد/إضافة أول معاملة/عودة المستخدم بين التقييم والإرسال، وسحب الموافقة وحذف الحساب، والتنافس بين عاملين. النتيجة: لا إرسال متأخر أو مكرر.

### B4: تذكير محلي قبل الحساب ومسارات فتح آمنة

**Files:**
- `apps/mobile/src/services/platform/phone-notification-service.ts`, `apps/mobile/src/features/onboarding/FirstLaunchOnboardingScreen.tsx`.
- `apps/mobile/app/(public)/welcome.tsx`, `auth-pending.tsx`, ومسار التعامل العام مع استجابات الإشعارات خارج ProtectedRouteGate.
- `apps/mobile/src/features/onboarding/ProfileSetupScreen.tsx`, `apps/mobile/src/features/notifications/notification-response-controller.ts`.
- Tests: phone notification service/response controller، واختبار دورة إلغاء التذكير المحلي.

**Interfaces:** local reminder data uses a validated `kind: onboarding_resume` marker; it must not invent a financial server `notificationId`. Authenticated pushes resolve authoritative server events and permitted destinations.

- [ ] اختبار جدولة واحدة بعد 24 ساعة بموافقة صريحة، ثم الإلغاء عند إنشاء الحساب/الرفض؛ لا تكرار عند كل فتح، ولا وضع معلومات حساب سابق في payload.
- [ ] إضافة واجهة جدولة وإلغاء محلية مخصصة، تستخدم لغة التطبيق للزائر، وتنسجم مع حد تذكير واحد عند الانتقال إلى حالة حساب مسجل.
- [ ] اختبار tap أثناء تسجيل الدخول والخروج وبعد قتل العملية، وتوجيهه إلى استكمال الحالة الحالية بدل فتح صفحة محمية بلا جلسة. payload غير معروف لا يفتح وجهة اعتباطية.

## التحقق والتفعيل بعد اعتماد الخطة

- [ ] اختبارات mobile المستهدفة: `node node_modules/jest/bin/jest.js --runInBand --forceExit --testPathPattern='bank-notification-service|phone-notification-service|automatic-tracking-coordinator|tracking-background-runtime|notification-response-controller|notification-policy|services/live/engagement-service'` داخل `apps/mobile`.
- [ ] اختبارات API: `node node_modules/jest/bin/jest.js --selectProjects unit --runInBand --testPathPatterns='engagement|tracking'` داخل `apps/api`؛ واختبارات DB المحلية الإضافية منفصلة.
- [ ] اختبارات parser: `node --test *.test.js` داخل `packages/transaction-parser`.
- [ ] تجربة AR/EN كاملة على DEV: بنك ومحفظة، زائر/تسجيل ناقص/بلا معاملات/غياب، وصول وفتح، عودة بعد الإغلاق، إلغاء وتغيير حساب. قياس زمن الالتقاط والتحليل دون بيانات حساسة.
- [ ] عرض diff وmigration وصور DEV ونتائج القياس وخطة الرجوع أولًا. أي تفعيل Staging مشترك يحدد الخدمة والإعدادات والمستخدمين المتأثرين ويؤخذ عليه اعتماد قبل التنفيذ. لا تفعيل Production في هذه الخطة.
- [ ] بعد القبول: حفظ التغييرات على نفس الفرع ورفعها عند تفويض المستخدم بذلك، والتحقق من GitHub CI ومن تطابق النسخة المفعلة مع الكود.

## معيار الإغلاق

المسار A يُغلق بدليل إشعار مالي خارجي ينتهي بمعاملة صحيحة مرة واحدة، مع اجتياز الحالات السلبية والاستعادة. المسار B يُغلق بدليل وصول تذكير مناسب للحالة واللغة وفتح وجهته، وعدم وصوله بعد زوال أهليته، مع جدولة مثبتة وتسجيل جهاز قابل لإعادة المحاولة. نجاح اختبارات الوحدات وحده لا يغلق أيًا منهما.
