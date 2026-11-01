# هاند أوف: استكمال حذف الحساب وتسريع العملية

**تحديث نهائي في1نوفمبر، بعد14:11السعودية: الطلب نفسه اكتمل، الهاتف نُظف وسجّل الخروج، والأونبوردنج والتسجيل بنفسGoogle وصلا لحساب جديد فارغ. لا تعِد الحذف أو تطبيق الإصلاحات. التفاصيل النهائية في آخر الملف وفي `docs/evidence/2026-11-01-account-deletion-progress.md`. الفقرات الأصلية أدناه سجل تاريخي لحالة التعطل.**

آخر تحقق:1 نوفمبر2026،13:37 بتوقيت السعودية. المستخدم طلب هذا الملف لفتح شات جديد؛ لا تنشئ شاتًا تلقائيًا.

## الأولوية الملزمة من المستخدم

**مهم جدًا: سرّع عملية حذف الحساب الفعلية، وليس شكل التحميل فقط. عالج سبب التوقف، ثم قِس الوقت من التأكيد حتى اكتمال حذف الخادم وتنظيف الهاتف والانتقال للبداية. لا تترك دائرة تحميل تخفي طلبًا متوقفًا، ولا تدّع اكتمال الحذف قبل إيصال الخادم. نفّذ الأساسي فقط دون توسع أو إعادة العمل المكتمل.**

المطلوب النهائي: إنهاء الطلب القائم، ثم تجربة الأونبوردنج والتسجيل من جديد. أثناء الحذف يعرض الهاتف دائرة و«جارٍ حذف الحساب…» فقط؛ هذا الشكل نُفذ وقُبل مرئيًا بالفعل، فلا تصممه مجددًا.

## الصلاحية والنطاق

- آخر موافقة صريحة للمستخدم: **«الحساب الحالي بكل بياناته ومسودته؛ أريد حذفه والبدء من جديد»**. تشمل13 معاملة ومسودة2026-13، وتلغي قيد الاحتفاظ بهما لهذا الحساب. لا تستعدهما ولا تنشئ بيانات تعويضية. لا تطلب موافقة حذف ثانية لنفس الطلب المعتمد.
- الحذف تأكد مرة واحدة من زر الإعدادات وحواره الأصلي. لا تضغط حذف مجددًا ولا تنشئ operation أو حسابًا بديلًا قبل اكتمال الطلب.
- كل أوامر الطرفية إنجليزية. راجع النص قبل التنفيذ، خصوصًا Web Console؛ سبق أن اعترض المستخدم على إدخال عربي في الطرفية.
- نفس الفرع والهاتف والـAPK وMetro. لا إعادة تثبيت، مسح app data، APK آخر، تغيير حساب Google أو إعادة تشغيل Metro.
- لا استدعاءات AI أو نوافذ مزود أو معاملات مالية جديدة؛ خاصية إضافة معاملات المساعد مؤجلة.

## موضع العمل وحالته

- المشروع الصحيح: `D:/Masarifi-integration-2026-10-10`، رغم أن cwd الافتراضي قد يشير لنسخة `D:/MY Work/0Part_Time/MASREFY _Final`. لا تعمل على النسخة الأخرى.
- الفرع: `codex/voice-promoted-operating-2026-10-13`؛ remote: `ratibi`؛ PR9.
- آخر commit تنفيذ: `179447911c1ef52448c7999f78aa71ff7b004c74`، بعنوان `fix: keep account deletion processing behind simple progress`.
- قبل كتابة هذا الهاند أوف كان working tree نظيفًا، وcommit التنفيذ أمام remote-tracking بواحد ولم يُدفع في هذا الشات. تحقق من الحالة الحالية؛ لا تدّع CI لهذا الرأس أو تكرر نشرًا سابقًا.
- Redmi serial: `f66a40694eca`؛ package: `com.masarifi.mobile.dev`.
- APK SHA256: `bd3d7513105cb95244476e604ff11ffc90e05b66dc9d29d3d5f0058b56c366f4`.
- Metro الحالي PID **12652** على8081، تأكد أنه قائم أثناء التسليم. PID33696 القديم انتهى سابقًا واستُبدل بإذن المستخدم؛ لا تحاول إعادته.

## الطلب القائم — لا تكرره

- request ID: `f41fee63-dd1b-4e8a-b6d5-c22fbafb432f`.
- operation/idempotency ID: `1203f9a7-72ac-4e78-ba6e-a83f4f8babb1`.
- أُنشئ2026-11-01T10:02:16Z. آخر فشل معروف عند10:02:24Z. هذا وقت الفشل القديم، وليس دليلًا أن العامل أعاد المحاولة بعد الإصلاح.
- **قراءة إيصال حديثة عند13:37 السعودية:** HTTP200،`status=processing`،`completedAt=null`،`errorCode=DELETION_HANDLER_FAILED`،`version=3`.
- الواجهة: `phase=pending`،`automaticRetries=true`؛ GET الحالي يقرأ الحالة فقط ولا يشغّل العامل.
- جُرّبت إعادة نفس POST مرة واحدة بنفس العملية بعد إصلاح القاعدة؛ رُفضت403 لأن الحساب محجوز للحذف. لا تكررها، لا تفك الحجز، ولا تتجاوز المصادقة.
- قد تكون بعض معالجات حذف النطاقات نُفذت قبل الفشل. لا تدّع أن كل البيانات ما زالت سليمة أو أن الحذف اكتمل. التنظيف المحلي ينتظر إيصال completed الصحيح؛ لا تمسحه يدويًا.
- completion capability محفوظة في SecureStore بالهاتف؛ لا تطبعها أو تنسخها للشات أو Git. استخرج المالك فقط من الطلب/الإيصال الموجود عند الحاجة، دون التخمين أو تسجيل الأسرار.

## السبب المثبت والإصلاح المنفذ — لا تعِده

سجلات PostgreSQL أثبتت أن `private.erase_account_owner_payload` يحذف `public.client_mutations`، لكن `private.guard_client_mutation` عامل DELETE كمقارنة UPDATE مع NEW فارغ، فرفض بـ`SYNC_MUTATION_IMMUTABLE`/42501.

Migration `supabase/migrations/20261101101944_client_mutation_owner_erasure_guard.sql` **مطبقة بالفعل مرة واحدة** على **Masarifi Staging**، project `qcffvfbpzvpwcwxwjyro`. سجل migration يحمل النسخة نفسها. لا تُعد تطبيقها أو تُنشئ بديلًا مكررًا. تسمح DELETE فقط لدور migration داخل سياق حذف المعاملة المقفل، لنفس المالك والطلب المتحقق مع فحص الاحتفاظ. UPDATE لم يتغير؛ لم تُمنح صلاحية عامة جديدة.

Supabase connector المستخدم: `link_6ad7016d2bb4819180129c11ac49e220`. الاتصال الآخر أعاد unauthorized؛ لا تغيّر الحساب أو تعيد الربط. استخدم قراءة السجلات/الطلب أولًا. لا تستخدم SQL لفرض completed أو حذف صفوف الحساب يدويًا.

## الخطوة التالية الأسرع

1. افتح الهاند أوف و`git status`، ثم عالج وصول التنفيذ إلى **العامل الموجود** مباشرة؛ لا تضيع الوقت في إعادة فحوص المساعد/الدعم/البيانات المكتملة.
2. نافذة Hostinger الأصلية كانت `https://fra.hostingervps.com/2708/`، ضمن profile `masarifi.ratibi` ومجموعة Masarifi staging. آخر UI أظهر أن جلسة الطرفية أصبحت **Session expired**، ومحاولتا التحكم توقفتا لأن الأداة لم تستطع التحقق من URL. الكمبيوتر فُتح بإقرار المستخدم؛ لا تعتبر القفل هو العائق الحالي دون لقطة جديدة. لا تعِد استخدام window/element indices القديمة؛ اجلب inventory وحالة جديدة.
3. أعد فتح Web Console من حساب Hostinger الحالي إن أمكن ضمن تسجيل الدخول المعتاد؛ لا تغيّر مفاتيح أو firewall أو صلاحيات. SSH إلى187.77.81.97:22 انتهى بمهلة؛ لا تكرر محاولات متطابقة بلا سبب جديد. لو احتجت تدخل المستخدم، حدّد خطوة الوصول المطلوبة بدقة، وليس موافقة حذف جديدة.
4. ثبّت هوية خدمة immediate deletion الموجودة على loopback3027 وصورتها/إصدارها من الواقع. الاسم التاريخي `masarifi-dev-immediate-delete-2764f849` مرجع بحث فقط، وليس دليل الهوية الحالية. لا تنشر API/عامل المساعد أو كل الخدمات لهذا الإصلاح.
5. استأنف **نفس request** عبر مسار التطبيق `ImmediateDeletionService.runDeletionRequestForOwner(owner, requestId)`، الذي يستخدم عامل الحذف وبيانات اعتماده الموجودة. تحقّق من ارتباط المالك بالطلب والعملية أولًا. `SecurityWorkerService` يسمح بإعادة حجز processing المتوقف بعد15 دقيقة؛ لا تغيّر الطوابع الزمنية لتجاوز ذلك. المسار ينفذ المعالجات الحقيقية ثم يسجل النتيجة؛ لا تستبدله بإكمال SQL مزيف.
6. مرجع تنفيذ قديم خاص: `D:/Masarifi-preservation-2026-10-18/dev-immediate-delete-20261021/resume-approved-operation.cjs`. **لا تشغّله كما هو**؛ يحمل owner/request قديمين وتعديل deadline لا نحتاجه. اقرأه للاستفادة من إنشاء application context واستدعاء الخدمة فقط. المصدر الحالي: `apps/api/src/security/immediate-deletion.service.ts` و`security.worker.ts`.
7. بعد إعادة تشغيل المعالجة مرة واحدة، افحص نفس الطلب. إن ظهر فشل جديد، اقرأ سجل نافذته وحدد المعالج التالي؛ لا تكرر التشغيل في حلقة أو تعتبر إصلاح trigger ضمانًا لكل المعالجات.
8. عند completed، دع مسار الهاتف الأصلي يستلم الإيصال ويُجري sign-out/owner fence/local erasure. تحقق من انتهاء رسالة الانتظار، ثم جرّب البداية والتسجيل بنفس Google دون معاملات أمثلة. أمّن الفصل بين الحساب المحذوف وأي حساب جديد.

## تسريع العملية وقبولها

- افصل قياس مدة عمل الخادم عن تأخر وصول الإيصال وتنظيف الهاتف؛ أصلح أبطأ مرحلة مثبتة فقط.
- polling الحالي يستخدم backoff2،5،10،20،30 ثانية؛ إيصالات processing الصحيحة تثبت العداد عند5، فيستمر GET كل30 ثانية في المقدمة. هذا يمنع انتهاء المتابعة، **ولا يصلح توقف العامل**. افحص إن كان انتظار polling يضيف تأخيرًا ملحوظًا بعد اكتمال الخادم، وعالجه بأقل تغيير إن ثبت، مع احترام Retry-After وحدود الخدمة.
- لا تُسرّع بإسقاط معالج بيانات أو فحص احتفاظ أو تخطي المصادقة أو مسح الهاتف قبل تأكيد الخادم. لا تختبر حذف حساب آخر لقياس السرعة.
- first-use preference محلي على مستوى التثبيت. `eraseDeletedAccountLocalData` لا يعيد ضبطه صراحةً؛ قد تعود الشاشة للدخول بدل الأونبوردنج. هذه **نقطة تحتاج تحققًا فعليًا بعد اكتمال الحذف**، لا عطل مثبت ولا عمل مكتمل. لا تصفّر التفضيل خفية لفرض لقطة؛ إن تطلب المسار إصلاحًا، اربطه بإكمال الحذف الصحيح مع اختبار.

## المكتمل والتحقق والأدلة

- الترحيب «حيّاك في مصاريفي وراتبي»، دون اسم منفصل تحت اللوجو أو محدد لغة في الدخول.
- أُزيل زر حذف الحساب المكرر من الأمان؛ زر الإعدادات وحوار التأكيد باقيان.
- شاشة الحذف دائرة والنص الواحد، بلا فقرة أو زر تحديث أو كارت مزخرف. أخطاء الاتصال/التحقق والفشل الحقيقي لها مسارات الاستعادة السابقة؛ لا تحذفها لتجميل النجاح.
-5 suites /65 mobile tests نجحت، وTypeScript وscoped lint للموبايل وAPI انتهت0.8 اختبارات guard على PostgreSQL17 حقيقي نجحت، والمراجعة المستقلة لم تجد مانعًا. هذه لا تثبت اكتمال الحذف الحي. cluster الاختبار المحلي الخاص على15491 أُوقف؛ لا تشغله مجددًا دون حاجة.
- الدليل: `docs/evidence/2026-11-01-account-deletion-progress.md`.
- الأدلة الخاصة غير المضافة لـGit: `.superpowers/sdd/2026-11-01-onboarding-preview/`؛ أحدث لقطة `account-restart-live/deletion-simple-progress-after-01.png`، والسابقة `deletion-screen-current-02.png`.
- `account-restart-ui.cjs read UNIQUE_ASCII_KEY` يأخذ لقطة/شجرة فقط مع فحص الهاتف والتطبيق. لا تشغّل modes confirm/deletion/google عشوائيًا؛ بعضها ينفذ فعلًا خارجيًا.
- `read-deletion-runtime.cjs status` يقرأ حالة الواجهة. `receipt` يطلب GET باستخدام capability داخل الجهاز ثم `read` في استدعاء تالٍ يعرض status/error/timestamp فقط. لا تستعمل `resume-current-deletion.cjs`؛ intent الخاص به مستهلك وPOST رُفض بالفعل.
- لا ZIP، لا نسخ بيانات خام أو مفاتيح إلى Git، ولا تكرار بطاقة/فئات/معاملات/دعم أو نوافذ مزود قديمة.

**حالة التسليم الأصلي قبل المتابعة:** لم يكن الحذف والتنظيف والأونبوردنج والتسجيل قد اكتملوا آنذاك؛ التحديثات التالية تستبدل تلك الحالة.

## متابعة الشات الجديد — 1 نوفمبر، 14:01 السعودية

- أُصلح SSH بعد إثبات `UFW BLOCK` لعنوان خروج الجهاز الحالي؛ المستخدم وافق صراحة على قاعدة واحدة لهذا العنوان فقط إلى عنوان السيرفر والمنفذ22. المفتاح والمستخدم والتحقق الصارم من المضيف لم تتغير. SSH يعمل الآن؛ لا تعِد إضافة القاعدة.
- هوية خدمة3027 الفعلية: container `1b48baf2daabf981a6dff4e4c4e9ce7282c19ca1cf8d85e8e7a3b58a0e5af0ce`، image `sha256:abb6e9137a52c309e78e0069895a1a855e6af78c48ceb05364808816b8037576`، release `2764f849137ddf1cef468dff3fd150e942d5c26e`، بدأت2026-10-21T14:45:27.428418375Z، restart0. Node داخلها `/nodejs/bin/node`.
- استؤنف نفس الطلب مرة واحدة عبر الخدمة الموجودة في10:49:15.381UTC، وعاد10:49:18.700UTC بعد3319ms بحالةprocessing. لا يوجد طلبPOST أو operation جديد.
- السبب الجديد المثبت من سجلات قاعدة البيانات: `ERASURE_PAYLOAD_REMAINS`، detail `private.mobile_activity_buckets`؛ الجدول يحتوي89 صفًا للمالك، ولم يدخل قائمة الحذف التي سبقت إنشاءه. لا تحذف الصفوف يدويًا.
- migration `20261101105635_mobile_activity_owner_erasure.sql` مطبّقة بالفعل؛ سجلها بنفس النسخة. تضيف هذا الجدول فقط إلى قائمة الدالة الموجودة، دون تغيير owner/ACL أو فحوص القفل والاحتفاظ والتحقق النهائي. لا تعِد تطبيقها.
- اختبار PostgreSQL17 محلي أعاد الخطأ قبل الإصلاح، ثم4 حالات نجحت بعده (نجاح مع عزل المالك والتكرار الآمن؛ رفض غياب القفل؛ المالك الآخر؛ حجز الاحتفاظ). TypeScript وscoped lint نجحا. cluster15491 أوقف مجددًا.
- القفل الطبيعي للمحاولة السابقة يجعل الاستئناف التالي متاحًا بعد11:04:19UTC /14:04:19السعودية؛ لا تعدّل updated_at. السكربت الخاص `account-restart-live/resume-exact-request-20261101.cjs` يتحقق من هوية الخدمة والمالك والطلب والعملية والأهلية قبل الاستدعاء، ولا يغيّر المواعيد.
- الـAPK مطابق للبصمة الأصلية وMetro12652 نفسه. الهاتف ما زالpending؛ firstLaunchOnboardingCompleted=true، وقاعدة المالك المحلية باقية لحين إيصالcompleted. لم يحدث تنظيف يدوي أو تسجيل جديد. آخر لقطة `deletion-worker-failed-1049.png`.

## النتيجة النهائية — لا تكرر التنفيذ

- نفس الطلب والعملية اكتملتا: `completed_at=2026-11-01T11:04:40.265762Z`، version7، error=null. آخر استئناف حقيقي بدأ11:04:36.429UTC وانتهى بعد3912ms. لا تحديث SQL للحالة ولا طلب حذف جديد.
- الحساب القديم tombstone محذوف وبياناته الشخصية مطموسة. المعاملات والحسابات ونشاط الهاتف صفر، وفحص جميع جداولuser_id ضمن فحص البقايا أعاد صفر جداول تحتوي بياناته.
- زمن الطلب من إنشائه إلى اكتمال الخادم62دقيقة24.240ثانية، ويشمل التعطل السابق والإصلاح. الهاتف كانpending حتى قراءة11:04:57.493UTC، وأُثبت اكتماله وتنظيفه وخروجه في11:05:15.521UTC. لا تصف3.9ثوانٍ كقياس كامل من التأكيد حتى تنظيف الهاتف.
- قُصر انتظار إيصالprocessing الصحيح إلى5ثوانٍ مع احترامRetry-After حتى على الرد الناجح. بقي backoff أخطاء النقل والحجز15دقيقة وحدود الخادم كما كانت. هذه سرعة متابعة مثبتة بالاختبار، ولم تُختبر بحذف حساب حي آخر.
- أُصلح first-use داخل مسار إكمال الحذف الناجح فقط، دون تغيير اللغة أو الثيم أو مساس بمالك آخر نشط. لأن هذا الطلب سبق تحميل الإصلاح، استُعيدت بدايته مرة واحدة بعد التحقق منcompleted على الخادم وfence مكتمل ولاjournal ولامالك نشط؛ لا تعِد هذا السكربت الآن.
- الأونبوردنج ظهر فعليًا وزر«ابدأ الحين» فتح الدخول. Google أعاد إنشاء مالك جديد مختلف؛ مقارنةhash البريد أكدت أنه نفسGoogle دون كشف البريد. إعداد الملف ظهر ثم اكتمل قبل الملاحظة التالية؛ لم تُلتقط ضغطة إكماله بدقة. الصفحة النهائية الرئيسية فارغة:0معاملات، حساب نقدي أولي واحد برصيد0، ولاطلب حذف جديد.
- قاعدة المالك القديم `masarifi-cf8bf8b051f58c923f0b4634.db` زالت عبر التنظيف الأصلي، وقاعدة المالك الجديد مختلفة. اللقطة النهائية `account-restart-live/new-owner-home-final-01.png`، والأونبوردنج `recovered-onboarding-after-completed-01.png`.
-69اختبار موبايل/3suites، و4اختباراتPostgreSQL17، وTypeScript وscoped lint نجحت. قاعدة الاختبار المحلية أوقفت. نفس الفرع والهاتف والـAPK وMetro12652. التعديلات المحلية لم تُدفع؛ migration الجديدة مطبقة بالفعل. لاAI ولا معاملات أمثلة ولااختبار حذف آخر.

## Subsequent approved login redesign

The user's final choice is the sandstone-and-emerald architectural sign-in reference with the app logo removed. Implemented in `GoogleAuthScreen.tsx` with a standalone background at `apps/mobile/assets/auth/saudi-courtyard.png`. Google sign-in, legal links and lifecycle behavior remain intact. Do not restore the earlier minimalist white concept or regenerate design variants.

The account remains authenticated: visual QA used isolated rendering of the actual component, not a logout on the phone. Same branch, APK and Metro12652 preserved. Two auth suites /12 tests, mobile TypeScript and scoped ESLint passed. Evidence and the known unrelated foundation-check finding: `docs/evidence/2026-11-01-login-architecture.md`. No commit or push; preserve the earlier deletion work in the current worktree.

Follow-up: the user requested native screenshots and Arabic/English alignment. The phone was already on sign-in at the start of that follow-up; no auth action was used to reach it. Fixed Android RTL double mirroring using automatic text alignment plus the existing platform-aware direction helper. Native Arabic and English captures are `native-login-ar-aligned.png` and `native-login-en-aligned.png` in the private preview directory. Arabic is right-aligned, English left-aligned; language restored to Arabic. One app reload from the same Metro, no reinstall/data clear/sign-in/sign-out. Fresh 12 auth tests, TypeScript, scoped ESLint and layout detector passed. Same branch/device/APK/Metro12652 preserved; do not repeat deletion or registration.

Publication is now explicitly authorized by the user on the same branch and `ratibi` remote. The earlier statements that changes were uncommitted/unpushed describe the original validation stage; consult Git history for the publication state. Fresh publication checks: 4 mobile suites /65 tests, mobile/API TypeScript and scoped ESLint passed. The checksum manifest now includes both existing 1 November repair migrations and verification passes. Do not reapply either migration or rerun live account deletion/registration as part of publication.
