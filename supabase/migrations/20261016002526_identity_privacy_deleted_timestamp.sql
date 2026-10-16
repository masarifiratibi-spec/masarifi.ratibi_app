-- A deleted profile must retain its immutable subject and deletion timestamp.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

grant update (deleted_at) on public.profiles to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
