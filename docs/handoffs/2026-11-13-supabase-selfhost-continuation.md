# Handoff — استكمال نقل Supabase واللوجز — 2026-11-13

> **مرجع الاستكمال الأحدث:** [التسليم النهائي لنقل Supabase إلى VPS](2026-11-13-supabase-vps-final-handoff-ar.md). النقل مكتمل، وآخر نسخة هاتف مثبتة143. محتوى هذا الملف، خصوصًا تعليمات `pending` ومحاولات ما قبل التحويل، سجل تاريخي ولا يُنفّذ كخطة جديدة.

## الحالة النهائية — تعلو على السجل التاريخي أدناه

العمل مكتمل. لا تعاود النقل أو البناء أو التثبيت أو إرسال سؤال اختبار آخر لمجرد فتح شات جديد.

- قاعدة VPS هي المصدر التشغيلي منذ 2026-11-13 16:15:51 UTC. الصيانة الناجحة 187.827 ثانية. تأكدت الحالة الدائمة `phase=complete` و`targetMayAcceptWrites=true` من كونسول الخادم بعد نجاح `masarifi-selfhost-complete-r11` عند 17:31:12 UTC. **يُمنع تشغيل المصدر القديم أو الرجوع إليه.**
- قبل السماح بالكتابة، نجحت المقارنة الفعلية لكل 199 جدولًا و5 sequences و177 migration. الملفات الأصلية السبعة، 10,457 bytes، مطابقة. القبول النهائي: 28 target consumers تعمل بلا Restarting وبـRestartCount=0؛ كل 50 source consumers متوقفة وrestart=no؛ cron المصدر معطّل، والهدف يشغّل job الأصلي. TLS وleast privilege ومواقع التشغيل الدائمة واللوجز الآمنة نجحت. لا dump محفوظ ولا backup service أُنشئت.
- إصلاح عامل tracking اكتمل في R10c. entrypoint إضافي خارج dist احتوى Supabase pin قديمًا؛ استُبدل بـproject runtime guard، مع حفظ worker/release/job/provider scopes. الملف الدائم تحت `/opt/masarifi/selfhost/releases/2026-11-13/worker-entrypoints-r10`، وreceipt `tracking-entrypoint-repaired.json`، وstate يحمل ID الحاوية الجديدة. رُصدت 16 دورة سليمة بعدها. لا تعاود helper إعادة الإنشاء.
- public HTTPS Clerk والمالية والمزامنة وعزل المالك وضياع الرد وإعادة الإرسال بلا تكرار وPDF/checksum والمساعد والصوت نجحت. sync والمساعد عالجهما العمال العاديون. تقرير التنزيل وvoice contract2 التجريبي عولجا بمحركات الهدف الفعلية تحت أقفال IDs محددة؛ لم نوسع نطاق polling أو owner/epoch/provider. لا ندّعي SMTP أو التقاط SMS حقيقي. فحص tracking للقراءة: 10 HTTP200 عبر 5 endpoints لمستخدمين.
- حُذفت نسخة PostgreSQL التجريبية ودليل بياناتها والحاوية shadow والحاوية tracking المستبدلة المتوقفة فقط. بيانات الهدف وكل مستهلكي المصدر المحجوبين محفوظة.
- اختبار الهاتف دون اتصال نجح: حفظ `Selfhost phone offline R11` في SQLite وظهوره pending مع بقاء عدد صفوف الخادم صفرًا. بعد إعادة Wi-Fi اختفت pending وأصبح صفًا واحدًا. بعد تثبيت139 وإعادة فتح التطبيق بقي صفًا واحدًا بلا تكرار. receipt الخادم `phone-offline-operational-verification.json`. عاد Wi-Fi لنفس الشبكة، وmobile data بقي مغلقًا كما كان. لم نفعّل أذونات SMS أو notification capture.
- الشرح اختُصر في التطبيق بالعربية والإنجليزية. تفاصيل الخصوصية متاحة عند الطلب. **آخر توجيه للمستخدم أزال بطاقة تفعيل/إيقاف المساعد كلها:** الصفحة الرئيسية والمحادثات تتيحان السؤال مباشرة. العميل يعالج فقط رد403 `AI_CONSENT_REQUIRED` لسؤال مقصود، بقراءة الإعداد وتهيئة السياسة الحالية ثم retry واحد بنفس owner/body/key. لا تهيئة عند فتح الشاشة، أو401، أو سياسة مجهولة. ضياع رد PUT والتعارض وتغيّر المالك مغطاة. عقود Backend وDB/RLS/auth/quotas لم تتغير.
- **Android140 مثبت ومقبول فعليًا على الهاتف.** نفس package والتوقيع وUID وfirstInstall، وبقاء data inodes للملفين0و10. APK: `E:/Masarifi-assistant-default-140-20261113/Masarifi-1.0.1-140-arm64.apk`، SHA256 `74c7e11531be552d2a044cce07b42bad67dc2c2be8e2dd06a91982850caa0ec3`، 50,854,521 bytes، versionName1.0.1. لا تعاود install140؛ نجاح التثبيت مسجل.
- بعد استئناف المستخدم، فُتح140 على جلسته القائمة، ظهرت Home ببياناته، وظهر المساعد مباشرة بلا بطاقة أو أزرار تفعيل/سحب موافقة. أُرسل سؤال قراءة واحد من اقتراح المصروفات، ورُصد جواب فعلي مكتمل. لا عملية مالية أو تغيير أذونات. لقطة الواجهة `assistant140-default.png`، وreceipt `device-acceptance140.json` في مجلد140.
- الفحوص النهائية: 33 suite و400 test، كلها نجحت مع خروج طبيعي0. TypeScript0، lint0 errors مع تحذيري require قديمين في mock test. البناء0، التوقيع لستة API levels و16KiB وactual DEX نجحت؛ مكتبات native مطابقة139؛ معرّفات بطاقة التفعيل غائبة من Hermes. يوجد RED موثق للسلوك القديم قبل الإصلاح. التهيئة القديمة المعطّلة مغطاة باختبارات API للعميل؛ الاختبار الفعلي استخدم الجلسة الحالية دون سحب إعدادها لصنع حالة اصطناعية.

البيانات: `/srv/masarifi/postgresql17` و`/srv/masarifi/files`. الكود: `/opt/masarifi/selfhost/releases/2026-11-13`. journald:7 أيام/1GiB بإعداد المضيف السابق، دون تغيير Docker العام. راجع `docs/operations/selfhost-runbook.md` للأوامر الآمنة.

العمل المحلي فقط في `D:/Masarifi-integration-2026-10-10`؛ لا تستخدم checkout القديم. لا commit أو push لهذه المهمة. تغييرات Admin وperformance/release السابقة محفوظة دون ضمها. CUA اكتمل وأُرسل completion_summary لهذا الدور بعد رصد الجواب؛ لا تحكم نشط أو تسجيل للشاشة. نافذة scrcpy باقية ليراجع المستخدم التطبيق. لا وكلاء فرعيين.

## سجل التسليم السابق — تاريخي قبل التحويل

هذا هو آخر checkpoint، ويعلو على بنود «pending» القديمة في `docs/operations/2026-11-13-selfhost-migration.md`. المستخدم طلب تسليم العمل إلى شات جديد. أكمل التنفيذ من هذه الحالة، ولا تبدأ من الصفر ولا تعلن اكتمال النقل.

## الحالة الحاسمة الآن

- **لم يبدأ التحويل النهائي أو الصيانة. لم نوقف خدمات العملاء أو نغير اتصالاتها. Supabase ما زال المصدر التشغيلي.** لم ننفذ `cutover.py prepare/run` ولم ننشئ state الخاص بالتحويل بأنفسنا؛ تحقق من الحالة الفعلية قبل أي إجراء.
- يوجد PostgreSQL مؤهل ونسخة API خاصة وخدمة ملفات على السيرفر للتجربة. عمال التجربة والـcron العامة متوقفون. شغّلنا فقط worker مؤقتًا لمعالجة mutation تجريبية محددة ثم حذفناه.
- آخر نتيجة تشغيلية مؤكدة: **اختبار المالية والمزامنة وعزل مستخدمين نجح بالكامل**، بما فيه ضياع رد HTTP وإعادة الإرسال، ومعالجة mutation واحدة عبر worker الحقيقي دون تكرار.
- إنشاء تقرير PDF، ورسالة مساعد، ورفع صوت اصطناعي ووضعه في الطابور نجح. **معالجة التقرير/المساعد/الصوت والتحقق من نتائجها لم تُنفذ بعد.** أدوات معالجة هذه fixtures جاهزة محليًا.
- خدمة الملفات التجريبية تعطلت أثناء اختبار إعادة إنشائها بسبب image ID قديم غير قابل للاستدعاء. **استُعيدت بالفعل بنجاح** من الصورة ذات نفس كود الخدمة ونفس Node، باستخدام نفس الملفات والمفتاح، وثُبت IP. لا بيانات فُقدت. بقي إعادة فحص HTTPS/adapters بعد الاستعادة.
- حصلت مراجعة مستقلة؛ لا يوجد اعتماد نهائي قبل إغلاق نتائجها واختبارات القبول المتبقية.
- عند طلب التسليم أُغلقت تبويبات الكونسول والتحويل التي أنشأها الوكيل بسبب انتهاء/إلغاء الدور. صفحة Hostinger الأصلية باقية. لم نفتح جلسة جديدة أثناء إعداد هذا التسليم، لذلك آخر فحص خادمي هو نتيجة الاستعادة المؤكدة في الدور السابق، وليس snapshot جديدًا الآن.

## التفويض والنطاق

المستخدم فوّض نقل PostgreSQL والملفات من Supabase إلى VPS المشروع، مع بقاء Clerk وتطبيق الموبايل وSQLite/offline sync كما هي. البيانات تجريبية. لا backup system، لا dump محفوظ، لا dashboard أو إعادة تصميم للمزامنة. الصيانة ≤30 دقيقة. لا رجوع تلقائيًا لمصدر قديم بعد تفعيل كتابات الهدف. المستخدم فوّض أيضًا التحكم بالجهاز والكونسول مباشرة لحل الوصول، فلا تطلب منه فتح الكونسول من جديد إذا استطعت فتحه بنفسك.

لم نغير firewall أو credentials الخاصة بـSSH؛ منفذ SSH 22 كان ينتهي بمهلة. الوصول الناجح كان Web console في Hostinger.

## مجلد العمل — مهم جدًا

- **نفّذ كل العمل في `D:\Masarifi-integration-2026-10-10`**، وهو linked worktree موجود.
- الفرع `codex/voice-promoted-operating-2026-10-13`، HEAD `d7190e3b`. لم ننشئ commits أو push لهذه المهمة.
- المشروع المحفوظ في Codex يشير إلى `D:\MY Work\0Part_Time\MASREFY _Final`، وهو checkout آخر أقدم. **لا تعدل/تنشر ذلك checkout ولا تنشر المشروع كاملًا من checkout القديم.** انتقل صراحة إلى worktree المذكور.
- توجد تعديلات سابقة غير تابعة للمهمة في Admin، `ops/releases/2026-11-07-temporary-support-access`، وملفات performance/release/evidence كثيرة. لا تمسها أو تضمها في commit المهمة.
- تغييراتنا: ملفات API الخاصة بالتخزين/runtime scope/logging والاختبارات، كل `ops/selfhost/`، سجل `docs/operations/2026-11-13-selfhost-migration.md`، وملف التسليم هذا. راجع `git status` ثم افصل الملفات بدقة.
- لا AGENTS خاص بجذر العمل وفق الفحص السابق؛ AGENTS الخاص بـAdmin غير مطبق لأننا لا نعمل عليه.

## المصدر وخصائصه

Supabase project `qcffvfbpzvpwcwxwjyro`، الاسم `Masarifi Staging`، لكنه **مشترك بين production وStaging قديمة**. PostgreSQL 17.6. الحجم الأولي 598,846,611 bytes.

- 20 دورًا مخصصًا، بما فيها `pgbouncer`. لا تستخدم `NOT LIKE 'pg_%'` لحصر الأدوار: `_` wildcard وقد يسقط pgbouncer؛ استخدم `left(name,3)`.
- bootstrap OID 10 هو `supabase_admin`؛ الدور `postgres` مالك DB، NOSUPER وBYPASSRLS. أدوار API/worker لا superuser ولا BYPASSRLS.
- PostgreSQL DB `postgres`: ICU en-US، en_US.UTF-8، UTF8.
- 155 application tables: public80 (RLS/forced80)، private73 (RLS71/forced56)، audit2 forced.
- حصر data/sequence الأوسع: **199 table، 5 sequences** عبر public/private/audit/auth/storage/pgmq/supabase_migrations/vault/cron.
- 177 migrations، digest `376d8d5e772d73bebfdf33080795f1c5`، محفوظ ومؤهل.
- extensions: pg_cron1.6.4، pg_stat_statements1.11، pgcrypto1.3، pgmq1.5.1، plpgsql1.0، supabase_vault0.3.1، uuid-ossp1.1. Vault rows=0.
- أصحاب pg_stat_statements/pgcrypto/pgmq/uuid-ossp هم postgres؛ pg_cron/plpgsql/vault يملكها supabase_admin.
- يوجد تخصيص source-only للدالة `pgmq.drop_queue(text)` حتى مع نفس version؛ أصل الدالة 2634 bytes، md5 `40651be3b043b3943af268f4b3a42567`. لا تعتمد على pg_dump وحده للدوال التابعة للـextension؛ helper المصالحة ينقلها مباشرة.
- DB ACL الأصلية: PUBLIC CONNECT/TEMP؛ postgres CREATE/CONNECT/TEMP؛ dashboard_user CREATE/CONNECT/TEMP؛ supabase_etl_admin CREATE؛ supabase_storage_admin CREATE.
- GUC على DB: `app.settings.jwt_exp` نُقل دون طباعة قيمته.
- Source cron jobid1، `staging-automatic-salary-detection`، كل دقيقة، `private.run_salary_detection_jobs(25)`، **ما زال فعالًا على المصدر حتى آخر فحص**.
- تحقق مصدر حديث من قدرة postgres على pg_signal_backend وملكية DB: true. جلسات المصدر شملت worker_login وauthenticator وpgbouncer وpostgres و3 جلسات supabase_admin؛ لا تقتل جلسات bootstrap/owner/pool-auth عشوائيًا.
- فحص أسماء/بصمات دوال public/private/audit التي تحتوي `supabase` أعاد قائمة فارغة. الاعتماد المعروف في JS/config/storage، وليس شبكة خفية في هذه الدوال.
- buckets خاصة: `voice-temp`, `report-exports`, `support-attachments`, `tracking-imports`. عند النقل التجريبي 7 objects فقط في tracking-imports، بإجمالي 10,457 bytes؛ يجب إعادة الحصر النهائي.

بيانات وصول المصدر موجودة على السيرفر في `/etc/masarifi/migration.env` (0600) وCA `/etc/masarifi/supabase-ca.crt`. المستخدم postgres.qcff... على aws-0-eu-central-1.pooler.supabase.com:5432، verify-full. **لا تطبع السر أو URL الكامل.** استخرج SDK credentials داخليًا من Docker inspect ولا تطبعها.

## السيرفر والوصول

VPS `187.77.81.97`، `srv2006836.hstgr.cloud`، Hostinger VPS 2006836. آخر السعة: نحو69GB disk free و2.8GB MemAvailable، 2CPU/8GB RAM، لا swap. حصر البداية33 running containers، منها28 تستهلك المصدر، وحوالي50 consumers مع المتوقفة.

CUA: اقرأ مهارة computer-use وتعليماتها. Chrome browser ID `4`، profile masarifi.ratibi. الصفحة الأصلية الباقية tab `415633286`، `https://hpanel.hostinger.com/vps/2006836/overview`. أول CUA call بحسب قواعده: اختيار هذه الصفحة فقط أو inventory. تبويبات console القديمة **غير موجودة الآن**، لا تعتمد على bindings/IDs القديمة.

لفتح جلسة: اقرأ AX لصفحة Overview؛ زر Web console كان index109 (أعد اشتقاقه). اضغط، اقرأ الحالة، نفّذ عملًا محليًا قصيرًا، ثم listTabs. أحيانًا المحاولة الأولى تعود دون فتح tab؛ بعد رؤية الزر enabled ثانية حاول مرة أخرى. لا تعيد تحميل URL one-time الخاص بالكونسول. الطرفية الجديدة عادة AX4 داخل container app، وتظهر Agent button. إذا بقي AX3 فقط دون app، غالبًا انتهت الجلسة؛ تأكد من screenshot. الصق أوامر Python/heredoc كنص ثم Return؛ استخرج النتائج المرئية من screenshot، لا من xterm internals.

آلية نقل code-only جاهزة:

- HTTP محلي read-only على `http://127.0.0.1:4194`، port ما زال متاحًا عند إعداد التسليم.
- المجلد `C:\Users\DELL\AppData\Local\Temp\masarifi-selfhost-transfer-20261113`، exec session الأصلي41817، لكن لا تفترض إمكانية التحكم بنفس session من الشات الجديد. يمكن التأكد من port وإعادة إنشاء server read-only إن توقف.
- `ops/selfhost/pack-transfer.py` يبني ملف txt يحتوي Python decompress/sha256/write + command محدد. صيغته: `python ops/selfhost/pack-transfer.py NAME 'JSON_COMMAND_ARRAY' file1 file2 ...`.
- أسماء `compiled/...` تُقرأ من Temp/build/src، و`fixtures/...` من Temp/fixtures. باقي الملفات من ops/selfhost. لا تستخدمه لنقل أسرار أو بيانات المصدر؛ code/dummy fixtures فقط.
- افتح txt في تبويب Chrome agent-owned، واقرأ `document.body.innerText` (DOM ظاهر)، ثم paste إلى terminal. لا تطبع base64 في نتائج الأدوات.
- شغّل الاختبارات الطويلة عبر systemd-run --collect --property=RuntimeMaxSec=...، واقرأ journal لوحدة الاختبار فقط. أثناء عمل الأدوات تواصل بتعليق مفيد كل≤60s.
- آخر CUA completion_summary لهذا الشات أُرسل. في الشات الجديد ابدأ جلسة CUA طبيعية مستقلة.

## مواقع السيرفر وحالته

المجلد الخاص للـreceipts/code: `/var/tmp/masarifi-selfhost-20261113`، root0700. هذا **ليس موقعًا نهائيًا مناسبًا لملفات تشغيل bind-mounted**؛ يجب تجميدها إلى /opt قبل التفعيل.

### PostgreSQL الهدف المؤهل

- container `masarifi-postgres17`، data `/srv/masarifi/postgresql17`.
- Docker network `masarifi-selfhost-data` internal=true، subnet172.16.3.0/24، IP **ثابت172.16.3.4**. لا منفذ DB عام.
- image matching17.6 `sha256:5a4314708484bec672de2c09653a5c01fb1c84a998564ac231b0325e2238ed5b`.
- UID100:GID101، readonly root، data durable، /tmp tmpfs، cap-drop/no-new-privileges، journald، max_connections280، memory1536MiB، PIDs384، shared_buffers128MB، work_mem4MB.
- DNS alias `masarifi-postgres17.internal` عبر ExtraHosts. CA `/etc/masarifi/selfhost/database-ca.crt`، passwords الجديدة في `/etc/masarifi/selfhost/database-credentials.json`0400. لا تطبعها.
- TLS verify-full اجتاز بكلا login roles، plaintext/wrong-hostname رُفضا. HBA local trust للعمليات الخاصة داخل الحاوية، hostssl API/worker فقط على private subnet، reject للباقي.
- **cron.launch_active_jobs=off عبر CLI**، وليس ALTER SYSTEM. لا تظن أنه يتفعل بمجرد GUC. يجب إزالة/استبدال override.
- مصالحة catalogs كاملة passed بما فيها owners/RLS/functions/ACL/memberships/columns/constraints/views/indexes/triggers/default grants/GUC/history. normalize القيود لا يتجاهل operators/types/constants/collation؛ فقط positions وسالب/موجب تمثيل bytes وAND/OR associative nesting المكافئ.
- source stream المباشر الأول49.264s، لا dump محفوظ. يُحتفظ بالبيانات في الهدف فقط، لا ملفات dump وسيطة.
- توجد نسخة تجريبية قديمة غير مؤهلة `masarifi-postgres17-rehearsal`، data `/srv/masarifi/postgresql17-rehearsal`، IP172.16.3.2. **لا تستخدمها للتحويل النهائي.** لا تزال موجودة إلى أن تنتهي المهمة؛ احذف فقط مخرجاتنا التجريبية بعد نجاح التحويل، لا تنشئ خدمة backup.

### الملفات

- container `masarifi-private-storage`، بيانات `/srv/masarifi/files` UID65532، private IP **ثابت172.16.3.3:8080 بعد الاستعادة**، readonly root،193MB تقريبًا، journald، مفتاح `/etc/masarifi/selfhost/storage.key`0400 UID65532.
- الخدمة dependency-free، كودها baked داخل image عند `/app/selfhost/storage.mjs`، **ليس bind من var_tmp**. Source SHA256 `a603419728530b0897662fd4682570fd7ddad949ed0f4235b07e94fb8fa3d0bb`.
- القدرات HMAC مربوطة method/path/type/hash/expiry، private admin auth يتطلب bearer+apikey، ملفات immutable/atomic/fsync/rename، caps وMIME، logs metadata فقط.
- Origin `https://api.masarifiratibi.com`، Nginx snippet `/etc/nginx/masarifi-selfhost-storage.inc` داخل TLS vhost فقط: `/etc/nginx/sites-available/masarifi-production-core-20261105.conf` (enabled symlink بنفس الاسم). proxy إلى IP3.3، logs URLs معطلة لمنع capability leaks. المسار additive، API العملاء لا يزال يُرجع روابط Supabase.
- آخر استعادة **passed** باستخدام `recover-storage-candidate.py`، تحقق من code SHA ونفس Node binary الخاص بالـprimary API، نفس data/key، وstatic IP. Receipt `storage-recovered.json`.
- **تحذير فعلي:** image ID القديم لخدمة الملفات لم يكن resolvable بعد حذف الحاوية القديمة، رغم أنها كانت تعمل من layers موجودة. `storage-prepared.json.image` قد يكون stale. الصورة المستعادة مأخوذة من tag **`masarifi-private-storage:20261113`** (ليس masarifi-selfhost-storage). `storage-recovered.json` يحمل image الفعلي. لا تستخدم receipt القديم لإنشاء صورة مفقودة، ولا تغير served bytes بلا تحقق.
- `pin-storage-address.py` عُدّل ليتحقق من image قبل stop/delete، ولحفظ recreate config واستعمال rename بدل حذف المرجع أولًا، ويتجاوز recreate إذا كان IPAM ثابتًا بالفعل. **إعادة التحقق بهذا helper بعد الاستعادة لم تُشغّل بعد**؛ bundle storage-pin-verify.txt جاهز محليًا.
- نسخ الأصل: 7 ملفات/10,457 bytes/2.402s، SHA/MIME/size لكل ملف verified. manifest خاص `files-rehearsal-manifest.json` (keys/hashes، ليس أجسام الملفات).
- يوجد ملف صوت اصطناعي للاختبار في الهدف، وربما مخرجات fixtures عند تشغيل بقية الاختبارات. يجب تنظيف مخرجات التجربة المملوكة لنا قبل final-file copy؛ الكود يرفض unknown target directories. لا تمس ملفات المصدر أو أي بيانات هدف بعد تفعيل كتابات تشغيلية.

### النسخة الخاصة للتطبيق وlive patches

- Source primary: `masarifi-production-core-api-20261105-97e66588`، image frozen `sha256:fce60acbee2681331afcf3d0f563fe1511c360bcb2b1214ae46f8f541d19818`.
- Shadow: `masarifi-selfhost-shadow-core`، آخر ID معروف R4 `be87cc31c14302d1dbd7555ab0bab45d9dd225b857da5ab8b223d22f48c8c69`، privateIP172.16.3.5، bridgeIP172.16.0.4، port3000 (`MASARIFI_HTTP_PORT`، ليس PORT). **لا published ports**. اقرأ shadow-created.json ولا تعتمد على ID دائم.
- تم فحص547 relevant served JS modules في البداية، 8 validator versions، ثم توسيع الالتقاط إلى ملفات worker/repository إضافية. العدد الجديد يؤخذ من runtime-originals.json، لا تفترض547 بعد التوسعة.
- `inspect-runtimes.py` يقرأ actual served bytes بما فيها bind overrides، ويثبت IDs/images/StartedAt/previous hashes قبل تحديث inventory.
- `stage-runtime-patches.py` يحول تلك الملفات الضيقة، ولا يستبدل كل build من checkout. يحافظ على جميع owner/process/epoch/provider/security fences الأصلية. Source legacy validator يُستدعى بإدخال validation-only Supabase dummy لا يصل إلى runtime؛ returned env بلا Supabase origin/key.
- `runtime-container.py` ينسخ exact Config/HostConfig/images/mounts/roles/network/ports/flags/Clerk/encryption/canary settings. يعيد كتابة **كل key ينتهي DATABASE_URL**، بما فيها PRIVACY وSYNC_COMMAND، إلى credentials الجديدة وverify-full TLS. يعيد توجيه CA mount القديم أيضًا إلى المحلية في أحدث كود.
- تدقيق كل28: خارج /app/dist و/app/node_modules يوجد فقط CA mount `/etc/ssl/certs/masarifi-database-ca.crt`؛ لا NODE_OPTIONS require/import/-r. لا code mounts أخرى ضائعة حسب آخر الحصر.
- Docker images لكل28 source consumers كانت resolvable؛ مشكلة storage image منفصلة ولا تعني أن صور التشغيل الحالية ضاعت.
- `freeze-runtime-release.py` جاهز لتجميد candidate modules/support وALL existing readonly code bind mounts إلى **`/opt/masarifi/selfhost/releases/2026-11-13`**، مع hashes قبل/بعد النسخ. **لم يُنفذ، ولا يوجد permanent-release receipt من عملنا.** لا تفعل cutover مع code binds من var_tmp.

28 source consumers حسب inventory الفعلي (راجع الملف بدل نسخ قائمة عمياء): production-core-api، staging-tracking-maintenance، immediate-storage-runtime-upgrade API/worker، dev-assistant-parts، dev-reminders، qa-assistant-persistence، requested-pdf-email، staging-worker، staging-analysis-worker، dev-voice-repair API/worker، assistant-reports-worker، production-import-worker، production-account-delete-worker، assistant-reports-api-ledger-scope، dev-sync-readiness، admin-recovery API/customer-worker، dev-immediate-delete، account-voice-api، social-media-staging-api، permanent-dev-api، dev-planning-scope، staging-p0-finance، staging-planning-review، staging-payment-history، staging-api. جميعها يجب أن تتحول معًا، بما فيها بيئات الاسم Staging.

## اللوجز

أضفنا fields الوقت/service/version/requestId/operation/outcome/durationMs/code، ALS HTTP context، تشخيص DB/HTTP آمن، وربط fetch للملفات، وربط المهام بالـIDs.

- PlatformLogger يحفظ safe structured Nest events الموجودة، يسقط bodies/financial values/free text/secrets، يحافظ على خطأ SQLSTATE/hash/cause الآمن دون SQL أو parameters.
- `runtime-job-logging.cjs` يربط 202 UUID resource IDs بالـrequest، ويغلف Jobs/complete status دون قراءة payload أو lease tokens. يستخدم WeakMap للحالة ولا يضيف sensitive state إلى ALS.
- لاحظوا أن **AiWorkClaim يملك id لا operationId**؛ تم إصلاح fallback محليًا إلى ['operationId','id'] واختبار الصيغة الحقيقية. **R4 server candidates ما زالت تحتاج restage بهذا الإصلاح.**
- SSE لا يمر بـresponse.json؛ أضيف bridge محليًا وفي runtime adapter بين `result.operationId` و`result.resource.id` بعد commit. اختباره نجح. يحتاج refresh للعملية الحالية التي تحتفظ بـrequire cache.
- Journal المضيف كان بالفعل persistent `/var/log/journal`، retention7day، SystemMaxUse1G، MaxFileSec1day. لم نغير Docker global defaults ولم نعد تشغيل خدمات أخرى. الحاويات التشغيلية الأصلية لا تزال على log config القديم، والتحويل سيضع per-container journald.
- لا تطبع Docker inspect Env أو full connection strings أو SQL errors الخام أو rows أو JWT أو SMS/audio/financial contents. ephemeral PG clients دائمًا --log-driver=none، secrets stdin فقط. أخطاء producer/consumer تُحفظ كhash/hints دون النص الخام.
- أثناء أول rehearsal clients استخدمت --rm مع default logs قبل تصحيحها؛ قد مرت stdout transient logs وحُذفت مع العميل. لا تدّع أن هذا لم يحدث. لا dump/client log محفوظ الآن، وكل النقل اللاحق explicit log-driver=none.

## الاختبارات المنجزة والدليل

1. Full API unit/security R4: **255 suites /2473 tests passed،8 skipped**،53.898s. Log محلي Temp/api-unit-security-r4.log. هذا قبل آخر إضافة TS الخاصة بـSSE bridge، لذلك أعد الاختبارات المناسبة بعد التغييرات الأخيرة.
2. TypeScript build مر بعد آخر تعديل TS/format. يوجد compiled build في Temp/build/src؛ لا تنشره كاملًا.
3. Node runtime adapter/job tests: **9 passed**، بما فيها SSE bridge وclaim.id وfailure swallowed والـpost-commit ordering وعدم تسريب payload/getters.
4. Storage HTTP/filesystem:6 passed، logical stream3 وconstraint tree3. Targeted lint سابق نجح؛ يلزم lint أخير للتعديلات الجديدة.
5. catalog qualification وTLS/roles/private network passed كما أعلاه.
6. GET /api/v1/me بكلا مستخدمين حقيقيين عبر **existing active Clerk sessions**:200 لكل منهما، principal/profile صحيحان، لا إنشاء sessions/users ولا رسائل. JWT في RAM فقط. Receipt clerk-auth-verification.json.
7. **5 actual mounted storage adapters** عبر HTTPS: voice/support/reports/tracking/privacyZIP، upload/download/head/hash وtampered capability403،23 records تحت parent requestId. Receipt storage-runtime-verification.json. يجب إعادة التحقق بعد storage recreate.
8. Persistence/error test passed: الملفات السبعة والـjournal marker بقيت بعد restart؛ pause للـtarget PG فقط أدى503 database/queue down مع8 correlated error records تحت requestId واحد، ثم unpause وready200. Source28 StartedAt لم يتغير. Receipt persistence-and-errors.json. آخر target PG معروف running/unpaused.
9. **finance-sync-verification.json passed** بعد worker حقيقي: login/home/accounts/income/expense/transfer/balances، ضياع response body ثم replay، sync بنفس operationId عبر نفس batchKey وbatchKey جديد، worker يعالج mutation واحدة، balance final صحيح، user2 لا يرى account/transaction user1. Source لا يتغير.
10. `final-tools-qualified.json passed`: SELECT fingerprints permissions validated،199 tables/5 sequences، source25.091s وtarget15.23s. لم نقارن قيم trial/live كقبول نهائي؛ المقارنة النهائية فقط بعد المصدر frozen.
11. `feature-api-verification.json` = **fixtures-created**، ليس passed: PDF capture202، assistant queue202، voice create/upload/process queue نجحت، synthetic Arabic TTS (Microsoft Hoda) وليس صوت مستخدم. بقي تشغيل workers الخاصة ثم فحص النتائج.

## بروتوكولات الاختبارات المهمة — لا تعدل التطبيق لتناسب probe خاطئًا

تم تصحيح عدة assumptions في probe، وليست bugs في التطبيق:

- Home يحتاج `?period=monthly`، وليس month أو بلا period.
- Device register يرجع `deviceId`.
- اقرأ generation من **GET `/api/v1/me/financial-reset/state`** وأرسل X-Financial-Generation. لا تعطل FINANCIAL_CLIENT_UPDATE_REQUIRED/RESET fences.
- نتيجة transaction الحالية هي `result.transaction.transaction.id`، وليس root transactionId/id.
- Sync POST /api/v1/sync/mutations يرجع receipts **queued/received** ويحتاج worker؛ لا تفترض أن balance يتغير فور200.
- Assistant accepted يرجع `{id,status}`؛ id هو message ID، وقد يختلف عن operationId.
- Voice contract2 يستخدم x-voice-contract:'2'، يرفع عبر PUT `/api/v1/voice/sessions/:id/audio` (API)، ثم process expectedVersion/contentHash. حافظ على عقود الموبايل.

## الأدوات الجديدة المهمة وحالة توزيعها

كل الملفات محليًا تحت ops/selfhost، والأحدث محليًا هو المصدر الصحيح. **السيرفر يحتوي نسخًا مختلطة؛ لا تشغل cutover من النسخة القديمة هناك.**

- runtime-adapter/job logging + stage/inspect/render/refresh/freeze helpers.
- verify-finance-sync.cjs وverify-clerk-auth.py: finance phase تُنشئ fixtures وتعيد queued-for-worker وprivate fixture IDs؛ finance-check يتحقق بعد worker ويعطي passed.
- verify-feature-api.cjs: إنشاء fixtures. private IDs/session/generation في functional-fixtures.json root0600، لا تطبعها.
- verify-functional-runtime.py/.cjs: worker probes مؤقتة بimage/mount/config الفعلية، command خاملة فقط ثم docker exec للمعالجة المحددة. **لا .start ولا unfiltered workers.**
- عزل claims الأخرى يتم بأقفال FOR UPDATE على target فقط، والـclaim الحقيقي SKIP LOCKED يأخذ fixture المحددة. assertion يرفض claim آخر. لا تحديث/إرسال مهام العملاء المنسوخة ولا emails/push. helpers المحلية أضيف لها cleanup إذا فشل إنشاء القفل؛ تأكد من رفع أحدثها.
- `verify-functional-runtime.py sync` نجح وحذف probe ثم finance-check passed.
- `verify-functional-runtime.py features` **لم يُشغّل بعد**. سيعالج report.generate فقط، AssistantAgentWorker.runOnce على fixture محاطة بالأقفال، ثم Voice.processVoiceClaim فقط. فحص API بعد نتائجها وكتابة functional-runtime-verification.json **لم يُكتب بعد**.
- التقرير عبر ReportsRepository.withWorkLock ثم ReportsWorker.generate فقط، لا deliver/SMTP.
- voice worker يختار config مطابقًا لـVOICE_ANALYSIS_ONLY الخاص بالـprimary؛ لا تغير owner/epoch/provider flags لتجاوز اختبار.
- qualify-api-startup.py جاهز محليًا ولم يُرفع/يُشغّل بعد: cold startup لكل API privately واحدًا واحدًا، بلا public ports، لا worker polling. يجب إثبات جميع النسخ قبل الصيانة.
- final-database.py/verify-final-data.py/migration-io.py/cutover.py مُجهزة، لكنها **لم تُؤهل كتحويل كامل ولم تُشغّل**. يوجد code review سابق؛ التعديلات الأخيرة تحتاج فحصًا/اختبارات نهائية.
- pack-transfer.py يولد bundles قديمة بأسماء متعددة. **أعد توليد bundles من الكود المحلي الأحدث بدل إعادة تشغيل القديمة عمياء.**

الحزم المحلية الأخيرة الموجودة لكن لم تُنفذ كلها: `functional-features.txt`, `storage-pin-verify.txt`. `functional-sync.txt` نفذ ونجح، لكنه رفع runtime-container.py أقدم من آخر deadline changes أثناء العمل؛ السبب الإضافي لإعادة رفع الأحدث. `recover-storage.txt` نفذ ونجح. **R5 refresh لم يُولد/يُشغّل.**

## مراجعة مستقلة ونتائجها

تمت مراجعة قراءة مستقلة عبر agent واحد وفق مهارة executing-plans. لم يعدّل ملفات أو يتصل بالسيرفر. لم يجد عيبًا مؤكدًا آخر في HMAC/TLS/RLS/no-dump/catalog/data/sequence/source-return boundary.

النتائج والإصلاحات:

1. AiWorkClaim.id/SSE bridge: صُلحت محليًا، Node tests مرّت؛ restage/refresh وإثبات runtime باقيان.
2. code mounts خارج الجذور: تدقيق فعلي وجد CA فقط ولا Node preload. الأصول الأخرى ضمن المسارات المحفوظة.
3. static storage IP: نتيجة P2 صحيحة. حاولنا recreate، كشف image ref stale، استعدنا الخدمة بsame served SHA/Node/data/key وIP ثابت. باقي HTTPS regression/receipt staticAddress.
4. Maintenance deadline: نتيجة P2 صحيحة؛ local cutover أصبح يبدأ work deadline مطلق startedAt+1500s ويحتفظ بآخر300s لاستعادة المصدر قبل الكتابات، io.checked/Docker socket/ready/subprocess calls تراعيه؛ وتفعيل APIs بالتوازي6، مع شرط ≥15min متبقية قبل حد الكتابات وتأهيل إقلاعها مسبقًا. آخر هذه الإصلاحات لم تُرفع أو تُراجع/تُختبر نهائيًا. راجع SIGTERM/timeout/abort cleanup ولا تدّع ضمان زمن من مجرد if في النهاية.

## خطة التحويل المُجهزة — لا تنفذها قبل إغلاق البوابات

التصميم الحالي:

1. Preflight receipts الحقيقية وcurrent source hashes/images/config/roles/catalog وnative/cron consumers وstartup times والذاكرة/الديسك. لا تصنع receipts passed يدويًا لإرضاء guard.
2. freeze code في /opt permanent release؛ Runtime render النهائي يشير إليه ويحفظ كل overrides الحالية. لا checkout release قديم.
3. `cutover.py prepare` يتطلب gates ومنها functional/API startup/review/permanent release. يحفظ state root0600 في `/etc/masarifi/selfhost/cutover-state.json`، ولا يوقف المصدر. snippet file-gate يُجهز لكنه لا يُفعل إلا marker أثناء الصيانة.
4. run: ينشئ `/run/masarifi-selfhost-maintenance` ليحجب مسار الملفات الجديد، يوقف Source28 API/workers، ويجعل restart=no لكل50 source consumers بما فيها inactive، ويعطل Source cron ويُفرغ عمله الجاري. APIs القديمة المتوقفة تعطي502 خلال الصيانة؛ لا تفترض أنه أُضيف maintenance banner عام.
5. ينقل ملفات **fresh source** أولًا لأن Supabase Storage يحتاج DB connect لقراءتها، ويقارن metadata قبل/بعد النسخ. ثم source CONNECT fence: يمنح pgbouncer CONNECT صريحًا لحفظ pool auth، يسحب PUBLIC CONNECT، يؤكد أن API/worker/authenticator/anon/authenticated/service_role/storage_admin لا يمكنها CONNECT، وينهي nonsuper sessions باستثناء postgres/pgbouncer. **لا تقتل owner/SU/pool-auth**.
6. يعيد مقارنة file metadata بعد fence للتأكد أن upload قديم عبر signed URL لم يضف ملفًا بين copy/fence. اختلافها = abort قبل الكتابات، لا قبول ملفات ناقصة.
7. يسقط **DB الهدف التجريبية فقط** ويعيد إنشاء postgres مع cluster roles/passwords/TLS الباقية. ينقل final state مباشرة pg_dump stdout→psql، log-driver=none، precreates extensions، المصالحة الخاصة بالدالة/ACL/GUC، ثم catalog + exact row multiset hashes/counts + sequence states. لا dump file.
8. Source intentionally-fenced DB ACL لا تُنسخ إلى target: target يحتفظ بالأصل المقبول. Final catalog comparator يعرف ذلك. Cron active=false في كلا الطرفين أثناء المقارنة.
9. يجهز target cron launcher/background-workers **بلا active jobs** قبل بدء أي API، لتجنب DB restart بعد قبول كتابات.
10. يحفظ durable **targetMayAcceptWrites=true قبل إنشاء/بدء APIs التشغيلية**، لأنها public/host-network قد تستقبل كتابة فور البدء. بعدها **لا automatic stale-source rollback** حتى لو فشلت بوابات لاحقة. forward repair فقط.
11. يحتفظ بالـold source containers stopped/renamed بدلاً من حذف صور/patches، يُنشئ28 بدقة config/image/mount مع TLS/private URLs/journald، يبدأ APIs بتواز6 وready، ثم workers، ثم active target cron IDs الأصلية فقط. source cron يظل off.
12. release يتحقق source sessions/cron fenced، كل28 target running/private URLs/noSupabaseEnv/journald/permanent binds، يزيل file marker ويقيس الصيانة. ثم **اختبارات قبول نهائية**؛ phase ليس complete حتى تنجح.

مسار abort-before-writes يستعيد source CONNECT/pgbouncer grant الأصلي/cron/restart policies ويبدأ source consumers الأصلية. أحدث الكود يوقف target PG غير التشغيلي أولًا لإيقاف restore orphaned محتمل. لا يُسمح بهذا إن targetMayAcceptWrites=true. راجع التنفيذ واختبر invariants قبل الاعتماد.

## ما يجب تنفيذه بعد استلام هذا التسليم، بالترتيب

1. اقرأ هذا الملف والسجل والكود، انتقل إلى worktree الصحيح. افحص الحالة الحالية read-only عبر console جديد: old28 running، target DB unpaused/cron off، target storage recovered/static/ready، no cutover state/marker أو استأنف حسب state إن وجد. لا تفترض أن الأوامر القديمة قيد التشغيل.
2. ارفع **آخر ملفات الأدوات** من local؛ لا تشغل نسخة cutover القديمة على السيرفر. تحقق static store، HTTPS وكل5 adapters والملفات السبعة بعد الاستعادة. احفظ receipts الحقيقية.
3. restage/refresh R5 للـactual28 مع آخر job-id/SSE/CA/validator-prototype changes. qualifiers تعمل في ephemeral containers --network=none --log-driver=none بدل تحميلها داخل cgroups الخدمات الحية.
4. شغل qualify-api-startup على جميع APIs؛ عند فشل نسخة لا تغير feature/owner restrictions للمرور، أصلح التحويل الضيق أو افتح القيد الحقيقي.
5. شغل functional feature workers فقط. Fixtures قد تكون expired وقت الاستلام؛ إذا انتهت، أنشئ fixtures جديدة وتابع مخرجات التجربة السابقة لتنظيف ملفاتها. لا تبدأ عامّة copied queues ذات emails/push/jobs حقيقية.
6. أضف/نفذ API result validation: report ready/downloadUrl على origin المشروع وHTTPS PDF magic/checksum؛ assistant `/assistant/conversations/:cid/messages/:mid/result` status completed/response.content موجود دون طباعته؛ voice session status proposed/confirmed ونتيجة extraction/review موجودة دون طباعة النص أو القيم. نظّف ملفات fixtures المملوكة لنا بالـadapters/metadata الآمنة. لا تزور أي signed URL في log أو تقرير.
7. تأكد من native canary ingress والمهام غير Docker: audit المحلي أضيف له mjs/cjs وinline source/DB booleans؛ أعده لأن server receipt قديمة. لا تطبع unit Env/ExecStart الخام إن احتوى أسرارًا.
8. أغلق reviewer findings بالأدلة، افحص absolute deadline/timeout/one-way boundary واستعادة ما قبل الكتابات، وتحقق من جميع subprocess paths. Node9 وstorage6 وPython6 وTS/lint والاختبارات المناسبة/الكاملة بعد آخر تغييرات. لا يكفي syntax وحده للـcutover.
9. جهز permanent release/manifest وتعليمات التشغيل المستقبلية، ثم measured preflight/cutover ضمن30m. لا تطلب إذنًا جديدًا لمجرد أن المهمة مستمرة؛ التفويض موجود. لو حدث blocker حقيقي فلا تعلن اكتمالًا.
10. بعد التشغيل: اختبارات العملاء/finance/offline sync/no duplicates/voice/assistant/report/support/tracking/two-user isolation/restarts/journal/requestId؛ تحقق أن كل operational service لا يحتاج Supabase. Installed physical mobile UI لم يُختبر بعد؛ استكشف الأجهزة/المحاكيات المتاحة دون تغيير النسخة أو تعطيل gates، وميّز API contract checks عن اختبار جهاز فعلي.
11. أزل فقط التجارب التابعة لنا بعد النجاح: PG rehearsal القديم والـshadow/worker probes/test files، وانتهِ من HTTP local transfer server. لا تحذف Supabase project أو أي خدمة أخرى بلا طلب. لا تضف backup/monitoring.
12. سلّم تقريرًا عربيًا مختصرًا: ما تغير/ما اختبر/مسارات البيانات واللوجز/الأوامر الجاهزة/أي blocker. يجب أن تكون أوامر آخر الأخطاء، تتبع requestId، worker، واتصال DB قابلة للاستعمال وتخفي الأسرار.

## المراجع والمهارات

- مهارات استُخدمت: supabase، computer-use، executing-plans، using-git-worktrees، TDD/verification. لا تفرض flows موافقة من مهارة على تفويض المستخدم الموجود. لا تفوض implementations جديدة إلا إذا نصت تعليمات AGENTS/skill على ذلك؛ المراجعة المستقلة الوحيدة كانت مطلوبة صراحة بexecuting-plans.
- [PostgreSQL17 logical transfer](https://www.postgresql.org/docs/17/backup-dump.html)
- [Docker per-container journald](https://docs.docker.com/engine/logging/drivers/journald/)

لا تحتوي هذه الوثيقة على كلمات مرور أو tokens أو بيانات مالية. ملفات private receipts/fixtures على السيرفر قد تحتوي identifiers؛ لا تطبعها wholesale عند القراءة.
