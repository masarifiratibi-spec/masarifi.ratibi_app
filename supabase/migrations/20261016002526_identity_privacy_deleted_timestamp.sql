-- A deleted profile must retain its immutable subject and deletion timestamp.
grant update (deleted_at) on public.profiles to masarifi_worker;
