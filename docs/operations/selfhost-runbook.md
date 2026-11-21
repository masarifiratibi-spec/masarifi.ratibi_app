# تشغيل PostgreSQL والملفات على VPS المشروع

بيانات PostgreSQL: `/srv/masarifi/postgresql17`، والملفات الخاصة: `/srv/masarifi/files`.
كود التشغيل المثبت: `/opt/masarifi/selfhost/releases/2026-11-13`.
حالة النقل الدائمة: `/etc/masarifi/selfhost/cutover-state.json`.
اللوجز: journald داخل `/var/log/journal`، باحتفاظ 7 أيام وحد إجمالي 1 GiB حسب إعداد المضيف الموجود مسبقًا. إعداد Docker العام لم يتغير.

نفّذ الأوامر التالية من كونسول الخادم. لا تطبع Docker Env أو ملفات الأسرار أو connection strings.

## حالة API

```sh
curl -fsS https://api.masarifiratibi.com/health/ready
docker inspect -f '{{.State.Running}} {{.State.Restarting}} {{.RestartCount}} {{.HostConfig.LogConfig.Type}}' masarifi-production-core-api-20261105-97e66588
```

## آخر الأخطاء

```sh
journalctl CONTAINER_NAME=masarifi-production-core-api-20261105-97e66588 --since '15 minutes ago' --no-pager -o cat --grep '"outcome":"failure"'
```

## تتبع requestId أو resourceId

استبدل `REQUEST_ID` بالمعرّف الظاهر في استجابة API أو سجل قبول المهمة. سجل `task.accepted` يربط الطلب بمعرّف المهمة الدائم الذي يستعمله العامل.

```sh
journalctl --since '30 minutes ago' --no-pager -o cat --grep 'REQUEST_ID'
```

## أخطاء عامل المزامنة

```sh
journalctl CONTAINER_NAME=masarifi-staging-worker-1 --since '15 minutes ago' --no-pager -o cat --grep '"outcome":"failure"'
```

لمعرفة أسماء بقية العمال الفعلية:

```sh
docker ps --format '{{.Names}}\t{{.Status}}' --filter label=masarifi.scope=selfhost
```

## فحص اتصال PostgreSQL دون عرض كلمة مرور

```sh
docker exec masarifi-postgres17 psql -h /tmp -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -c 'select current_database(),version();'
docker exec masarifi-postgres17 psql -h /tmp -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -c "select count(*) as unencrypted_application_connections from pg_stat_activity a left join pg_stat_ssl s using(pid) where a.usename in ('masarifi_api_login','masarifi_worker_login') and not coalesce(s.ssl,false);"
```

العدد المتوقع للاتصالات التطبيقية غير المشفرة هو صفر. اتصال التطبيق يستعمل `verify-full` واسم `masarifi-postgres17.internal` داخل الشبكة الخاصة، ولا يوجد منفذ PostgreSQL منشور للعامة.

## حالة النقل وحد الرجوع للمصدر

```sh
python3 -c 'import json; s=json.load(open("/etc/masarifi/selfhost/cutover-state.json")); print({k:s.get(k) for k in ("phase","targetMayAcceptWrites","maintenanceEndedAt")})'
```

عندما تكون `targetMayAcceptWrites=true` تكون قاعدة VPS هي المصدر التشغيلي؛ كل إصلاح يكون إلى الأمام. حاويات `-supabase-frozen-20261113` والمستهلكون القدامى المتوقفون محفوظون بسياسة `restart=no` ولا يُشغّلون تلقائيًا. ملفات compose القديمة ليست مصدر إعدادات هذا التشغيل، ولا يجوز نشر checkout المشروع القديم لاستبداله.

الأسرار والشهادات تحت `/etc/masarifi/selfhost/` بصلاحيات مقيدة. لم تُنشأ خدمة نسخ احتياطي أو dump محفوظ أو لوحة مراقبة.
