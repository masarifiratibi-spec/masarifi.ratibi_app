-- Guarded partial-state forward candidate; this file is NOT part of the canonical fresh-install chain.
-- Requires external BEGIN READ WRITE; never stamps any historical migration as applied.
-- Current qualification is limited to the owned isolated current restore. Hosted use needs separate approval.
set local statement_timeout='5s';
set local lock_timeout='1s';
do $setup$
declare actual jsonb;
begin
  if current_user<>'postgres' or session_user<>'postgres' or (select rolsuper from pg_roles where rolname=current_user) then
    raise exception 'DOMAIN_PATCH_ACTUAL_EXECUTOR_REQUIRED'; end if;
  if current_setting('server_version_num')<>'170006' then raise exception 'DOMAIN_PATCH_SERVER_DRIFT'; end if;
  if not pg_try_advisory_xact_lock(5574319470126001) then raise exception 'MIGRATION_LOCK_UNAVAILABLE'; end if;
  select (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'securityDefiner',p.prosecdef,'strict',p.proisstrict,
 'volatility',p.provolatile,'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5Lf',md5(replace(p.prosrc,E'\r\n',E'\n')))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='private' AND p.proname IN
 ('list_reminder_candidates','reminder_baseline','reminder_delivery_eligible','transfer_funds')) into actual;
  if actual is distinct from $expected$[{"name":"list_reminder_candidates","arguments":"p_limit integer","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"d7cd86354a2874061f56dcd5b8d4298a"},{"name":"reminder_baseline","arguments":"p_value text","owner":"masarifi_migration","language":"plpgsql","securityDefiner":false,"strict":true,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"ab481ccf741b0b9cbad2b4c9ce281b9a"},{"name":"reminder_delivery_eligible","arguments":"p_event_id uuid, p_user_id text","owner":"masarifi_migration","language":"sql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"83199fbdaf861c948ed87ac5df3c982e"},{"name":"transfer_funds","arguments":"p_user_id text, p_command jsonb","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"47a0443a0f008c5b43814a595d39a939"}]$expected$::jsonb then
    raise exception 'DOMAIN_PATCH_PREREQUISITES_DRIFT'; end if;
  perform set_config('masarifi.domain.executor_role', current_setting('role'), true);
  perform set_config('masarifi.domain.memberships_before',(select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.oid),'')) from pg_auth_members m),true);
  perform set_config('masarifi.domain.own_membership',coalesce((select jsonb_build_object(
    'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)::text from pg_auth_members m
    where m.roleid='masarifi_migration'::regrole and m.member=current_user::regrole and m.grantor=current_user::regrole),'null'),true);
  if pg_has_role(current_user,'masarifi_migration','SET') then
    perform set_config('masarifi.domain.granted','false',true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.domain.granted','true',true);
  end if;
end $setup$;

set local role masarifi_migration;

create or replace function private.list_reminder_candidates(p_limit integer)
returns table(kind text,user_id text,locale text,time_zone text,baseline_at text,evaluated_at text,inactive_days integer)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit not between 1 and 1000 then raise exception using errcode='22023',message='REMINDER_LIMIT_INVALID'; end if;
  return query
    with evaluated as (select clock_timestamp() now_at), candidates as (
      select 'app'::text kind,p.id user_id,p.locale,p.timezone time_zone,p.last_seen_at baseline_at,e.now_at evaluated_at,
        floor(extract(epoch from (e.now_at-p.last_seen_at))/86400)::integer inactive_days,
        case when p.last_seen_at<=e.now_at-interval '7 days' then 'reminder.app_inactive.7d' else 'reminder.app_inactive.3d' end event_type
      from public.profiles p cross join evaluated e
      where p.status='active' and p.last_seen_at<=e.now_at-interval '3 days'
      union all
      select 'financial'::text,p.id,p.locale,p.timezone,financial.baseline_at,e.now_at,
        floor(extract(epoch from (e.now_at-financial.baseline_at))/86400)::integer,
        'reminder.financial_inactive.7d' event_type
      from public.profiles p cross join evaluated e
      join public.tracking_preferences tracking on tracking.user_id=p.id and tracking.enabled
      cross join lateral (select coalesce(max(t.created_at),p.created_at) baseline_at
        from public.transactions t where t.user_id=p.id and t.deleted_at is null) financial
      where p.status='active' and p.last_seen_at>=e.now_at-interval '3 days'
        and financial.baseline_at<=e.now_at-interval '7 days'
    )
    select c.kind,c.user_id,c.locale,c.time_zone,
      to_char(c.baseline_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      to_char(c.evaluated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),c.inactive_days
    from candidates c
    where exists(select 1 from public.push_tokens token where token.user_id=c.user_id and token.revoked_at is null)
      and exists(select 1 from public.notification_preferences pref
        where pref.user_id=c.user_id and pref.channel='push' and pref.event_type=c.event_type and pref.enabled)
      and not exists(select 1 from public.notification_events event
        where event.user_id=c.user_id and event.type=c.event_type
          and private.reminder_baseline(event.data->>'cycleBaseline')=c.baseline_at)
    order by c.baseline_at,c.user_id limit p_limit;
end $$;

create or replace function private.reminder_delivery_eligible(p_event_id uuid,p_user_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(bool_and(
    p.status='active' and baseline.value is not null
    and exists(select 1 from public.notification_preferences pref
      where pref.user_id=e.user_id and pref.channel='push' and pref.event_type=e.type and pref.enabled)
    and case when e.type like 'reminder.app_inactive.%' then p.last_seen_at<=baseline.value
      when e.type='reminder.financial_inactive.7d' then exists(select 1 from public.tracking_preferences tracking
        where tracking.user_id=e.user_id and tracking.enabled)
        and not exists(select 1 from public.transactions t
          where t.user_id=e.user_id and t.deleted_at is null and t.created_at>baseline.value)
      else false end
  ),false)
  from public.notification_events e join public.profiles p on p.id=e.user_id
  cross join lateral (select private.reminder_baseline(e.data->>'cycleBaseline') value) baseline
  where e.id=p_event_id and e.user_id=p_user_id and e.type like 'reminder.%'
$$;

CREATE OR REPLACE FUNCTION private.transfer_funds(p_user_id text, p_command jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  source_id uuid; destination_id uuid; fee_account_id uuid; account_ids uuid[];
  amount_value bigint; fee_value bigint;
  currency_value text:=p_command->>'currency'; occurred_value timestamptz; title_value text:=p_command->>'title';
  note_value text:=private.normalize_ledger_note(p_command->>'note'); source_value text:=coalesce(p_command->>'source','manual'); external_value text:=p_command->>'externalRef'; transaction_id uuid; ledger_version bigint; matched integer;
begin
  if p_command is null or jsonb_typeof(p_command)<>'object'
    or (p_command-array['sourceAccountId','destinationAccountId','amountMinor','currency','feeMinor','feeAccountId','occurredAt','title','note','source','externalRef']::text[])<>'{}'::jsonb then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  begin
    fee_value:=coalesce((p_command->>'feeMinor')::bigint,0);
    source_id:=(p_command->>'sourceAccountId')::uuid; destination_id:=(p_command->>'destinationAccountId')::uuid;
    amount_value:=(p_command->>'amountMinor')::bigint; occurred_value:=(p_command->>'occurredAt')::timestamptz;
    fee_account_id:=coalesce((p_command->>'feeAccountId')::uuid,source_id);
  exception when others then raise exception using errcode='22023',message='VALIDATION_FAILED'; end;
  if not private.ledger_safe_text(source_value,1,64) or (external_value is not null and not private.ledger_safe_text(external_value,1,200)) or source_id=destination_id or amount_value not between 1 and 9007199254740991
    or fee_value not between 0 and amount_value or currency_value !~ '^[A-Z]{3}$'
    or not private.ledger_safe_text(title_value,1,160)
    or (note_value is not null and not private.ledger_safe_note(note_value))
    or occurred_value<'1900-01-01T00:00:00Z'::timestamptz or occurred_value>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='TRANSFER_ACCOUNTS_INVALID';
  end if;
  perform private.ledger_begin(p_user_id);
  select array_agg(distinct id order by id) into account_ids
  from unnest(array[source_id,destination_id,fee_account_id]) as u(id);
  perform a.id from public.accounts a where a.id=any(account_ids) order by a.id for update;
  select count(*) into matched from public.accounts a where a.id=any(account_ids)
    and a.user_id=p_user_id and a.status='active' and btrim(a.currency_code::text)=currency_value;
  if matched<>cardinality(account_ids) then
    if exists(select 1 from public.accounts a where a.id=any(account_ids) and a.user_id=p_user_id and btrim(a.currency_code::text)<>currency_value)
      then raise exception using errcode='P0001',message='CURRENCY_MISMATCH'; end if;
    raise exception using errcode='P0001',message='ACCOUNT_INVALID';
  end if;
  ledger_version:=private.ledger_next_version(p_user_id);
  insert into public.transactions(user_id,kind,amount_minor,fee_minor,currency_code,title,note,occurred_at,source,external_ref)
  values(p_user_id,'transfer',amount_value,fee_value,currency_value,title_value,note_value,occurred_value,source_value,external_value)
  returning id into transaction_id;
  perform private.ledger_apply_posting(transaction_id,source_id,-amount_value,'confirmed','source',occurred_value,ledger_version);
  perform private.ledger_apply_posting(transaction_id,destination_id,amount_value,'confirmed','destination',occurred_value,ledger_version);
  if fee_value>0 then perform private.ledger_apply_posting(transaction_id,fee_account_id,-fee_value,'confirmed','fee',occurred_value,ledger_version); end if;
  perform private.ledger_record_revision(transaction_id,p_user_id,'transfer created','{}'::jsonb);
  return private.ledger_result(transaction_id,ledger_version);
end $function$;

do $restore_executor$ begin
  perform set_config('role',current_setting('masarifi.domain.executor_role'),true);
end $restore_executor$;
do $restore_membership$
declare prior jsonb:=current_setting('masarifi.domain.own_membership')::jsonb;
begin
  if current_setting('masarifi.domain.granted')='true' then
    if prior='null'::jsonb then execute 'revoke masarifi_migration from current_user granted by current_user';
    else execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
      prior->>'admin',prior->>'inherit',prior->>'set'); end if;
  end if;
  if (select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.oid),'')) from pg_auth_members m)
    is distinct from current_setting('masarifi.domain.memberships_before') then
    raise exception 'EXACT_MEMBERSHIP_RESTORATION_FAILED';
  end if;
end $restore_membership$;

do $postconditions$
declare actual jsonb;
begin
  select (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'securityDefiner',p.prosecdef,'strict',p.proisstrict,
 'volatility',p.provolatile,'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5Lf',md5(replace(p.prosrc,E'\r\n',E'\n')))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='private' AND p.proname IN
 ('list_reminder_candidates','reminder_baseline','reminder_delivery_eligible','transfer_funds')) into actual;
  if actual is distinct from $expected$[{"name":"list_reminder_candidates","arguments":"p_limit integer","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"da48ff056dae6085d5fb250fb47dd6c9"},{"name":"reminder_baseline","arguments":"p_value text","owner":"masarifi_migration","language":"plpgsql","securityDefiner":false,"strict":true,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"ab481ccf741b0b9cbad2b4c9ce281b9a"},{"name":"reminder_delivery_eligible","arguments":"p_event_id uuid, p_user_id text","owner":"masarifi_migration","language":"sql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"e5cdb95c8918c7f5a38845d04a1ff3e3"},{"name":"transfer_funds","arguments":"p_user_id text, p_command jsonb","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"81d3ca9cb47b4e9fb334698dbffa580d"}]$expected$::jsonb then
    raise exception 'DOMAIN_PATCH_POSTCONDITIONS_FAILED'; end if;
end $postconditions$;
