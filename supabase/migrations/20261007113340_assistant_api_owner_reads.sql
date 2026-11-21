-- Direct result/recovery/history queries use masarifi_api, with existing forced owner RLS.
-- No Data API/client role or write privilege is granted.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;
grant select on public.assistant_messages,
  public.assistant_response_snapshots,
  public.assistant_action_previews to masarifi_api;
reset role;
revoke masarifi_migration from current_user granted by current_user;
