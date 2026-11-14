grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;
create index customer_session_retry_idx on private.customer_session_commands(retry_at,requested_at,id)
where status in ('pending','failed');
create index customer_session_status_idx on private.customer_session_commands(user_id,status)
where operation<>'reactivate';
reset role;
revoke masarifi_migration from current_user granted by current_user;
