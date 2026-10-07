-- Direct result/recovery/history queries use masarifi_api, with existing forced owner RLS.
-- No Data API/client role or write privilege is granted.
grant select on public.assistant_messages,
  public.assistant_response_snapshots,
  public.assistant_action_previews to masarifi_api;
