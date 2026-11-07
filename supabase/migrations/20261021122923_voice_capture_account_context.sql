grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

do $migration$
declare definition text; old_fragment text; replacement text;
begin
  definition := pg_get_functiondef('private.create_voice_session_v3_unscoped(text,jsonb,uuid,integer,integer,integer,jsonb)'::regprocedure);
  old_fragment := '  select id into default_id from public.accounts where user_id=p_user and is_default and status=''active'' and deleted_at is null;';
  replacement := $context$  if p_input?'accountId' then
    if jsonb_typeof(p_input->'accountId')<>'string'
      or p_input->>'accountId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode='22023',message='VALIDATION_FAILED';
    end if;
    select a.id into default_id from public.accounts a join public.currencies c on c.code=a.currency_code
      where a.id=(p_input->>'accountId')::uuid and a.user_id=p_user and a.status='active'
        and a.deleted_at is null and c.enabled for key share of a;
    if default_id is null then raise exception using errcode='P0001',message='ACCOUNT_INVALID'; end if;
  else
    select a.id into default_id from public.accounts a join public.currencies c on c.code=a.currency_code
      where a.user_id=p_user and a.is_default and a.status='active' and a.deleted_at is null and c.enabled;
  end if;$context$;
  if position(old_fragment in definition)=0 then raise exception 'VOICE_ACCOUNT_CONTEXT_PRECONDITION'; end if;
  execute replace(definition,old_fragment,replacement);

  -- Include the selected account even when an owner has more than twenty accounts.
  definition := pg_get_functiondef('private.get_ai_work_input_v2(text,uuid,uuid)'::regprocedure);
  old_fragment := 'row_number() over(order by a.is_default desc,a.sort_order,a.id)';
  replacement := $ordering$row_number() over(order by (a.id=(select ctx.default_account_id from private.voice_batch_context ctx where ctx.session_id=s.id)) desc nulls last,a.is_default desc,a.sort_order,a.id)$ordering$;
  if position(old_fragment in definition)=0 or
    position(old_fragment in definition)>position('elsif p_kind=''assistant.respond''' in definition) then
    raise exception 'VOICE_ACCOUNT_ALIAS_PRECONDITION';
  end if;
  execute overlay(definition placing replacement from position(old_fragment in definition) for length(old_fragment));
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
