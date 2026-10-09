grant masarifi_migration to current_user with set true, inherit false;
set role masarifi_migration;

alter table public.user_keyword_rules drop constraint user_keyword_rules_group_key_check;
alter table public.user_keyword_rules add constraint user_keyword_rules_group_key_check
  check(group_key in ('financial','expense','income','transfer','withdrawal','deposit','refund','subscription','installment','fee','failed_transaction','reversal'));

create or replace function private.upsert_keyword_rule(p_user_id text,p_id uuid,p_keyword text,p_group_key text,p_language_code text,
  p_match_type text,p_category_id uuid,p_priority integer,p_enabled boolean,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.user_keyword_rules; prior public.user_keyword_rules; request_id text:=private.tracking_request_id();
begin
  perform private.assert_active_profile(p_user_id);
  if p_keyword is null or p_group_key not in ('financial','expense','income','transfer','withdrawal','deposit','refund','subscription','installment','fee','failed_transaction','reversal')
    or p_language_code not in ('ar','en') or p_match_type not in ('exact','contains','safe_pattern') then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  if p_id is not null then
    select * into prior from public.user_keyword_rules where id=p_id and user_id=p_user_id for update;
    if prior.id is null or prior.version is distinct from p_expected_version then
      raise exception using errcode='40001',message='TRACKING_RULE_CONFLICT';
    end if;
    if prior.origin='default' then
      if prior.keyword is distinct from btrim(p_keyword) or prior.group_key is distinct from p_group_key
        or prior.language_code is distinct from p_language_code or prior.match_type is distinct from p_match_type
        or prior.category_id is distinct from p_category_id then
        raise exception using errcode='22023',message='TRACKING_DEFAULT_IMMUTABLE';
      end if;
      if p_enabled=false and exists(select 1 from public.tracking_rule_entries e
        where e.rule_key=prior.rule_key and e.family in ('status','exclusion')) then
        raise exception using errcode='22023',message='TRACKING_RULE_PROTECTED';
      end if;
      -- Legacy clients omit the priority on a toggle. Preserve the release value.
      p_priority:=prior.priority;
    end if;
  end if;
  if p_category_id is not null and not exists(select 1 from public.categories c where c.id=p_category_id and c.active and c.deleted_at is null and (c.user_id is null or c.user_id=p_user_id)) then
    raise exception using errcode='23503',message='TRACKING_CATEGORY_INVALID';
  end if;
  if p_id is null then
    insert into public.user_keyword_rules(user_id,keyword,group_key,language_code,match_type,category_id,priority,enabled)
    values(p_user_id,btrim(p_keyword),p_group_key,p_language_code,p_match_type,p_category_id,p_priority,p_enabled) returning * into r;
  else
    update public.user_keyword_rules set keyword=btrim(p_keyword),group_key=p_group_key,language_code=p_language_code,
      match_type=p_match_type,category_id=p_category_id,priority=p_priority,enabled=p_enabled
    where id=p_id and user_id=p_user_id and version=p_expected_version returning * into r;
    if r.id is null then raise exception using errcode='40001',message='TRACKING_RULE_CONFLICT'; end if;
  end if;
  perform private.enqueue_outbox_event('tracking.rule.changed.v1','tracking-rule',r.id,
    jsonb_build_object('ruleKind','keyword','ruleId',r.id,'action',case when p_id is null then 'created' else 'updated' end,'version',r.version,'occurredAt',clock_timestamp()));
  perform audit.append_event(p_user_id,'user','tracking.keyword-rule-changed','tracking_rule',r.id::text,null,null,null,request_id,
    jsonb_build_object('version',r.version,'action',case when p_id is null then 'created' else 'updated' end));
  return to_jsonb(r)-'user_id';
exception when unique_violation or check_violation then raise exception using errcode='22023',message='TRACKING_RULE_INVALID';
end $$;

create or replace function private.delete_keyword_rule(p_user_id text,p_id uuid,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare r public.user_keyword_rules; request_id text:=private.tracking_request_id();
begin
  perform private.assert_active_profile(p_user_id);
  select * into r from public.user_keyword_rules where id=p_id and user_id=p_user_id for update;
  if r.id is null or r.version is distinct from p_expected_version then
    raise exception using errcode='40001',message='TRACKING_RULE_CONFLICT';
  end if;
  if r.origin='default' then raise exception using errcode='22023',message='TRACKING_DEFAULT_IMMUTABLE'; end if;
  delete from public.user_keyword_rules where id=p_id and user_id=p_user_id and version=p_expected_version;
  perform private.enqueue_outbox_event('tracking.rule.changed.v1','tracking-rule',r.id,
    jsonb_build_object('ruleKind','keyword','ruleId',r.id,'action','deleted','version',r.version,'occurredAt',clock_timestamp()));
  perform audit.append_event(p_user_id,'user','tracking.keyword-rule-deleted','tracking_rule',r.id::text,null,null,null,request_id,
    jsonb_build_object('version',r.version,'action','deleted'));
end $$;

-- Repair misleading inactive status rows; classification already keeps these
-- safety rules active regardless of action keyword overrides.
update public.user_keyword_rules k set enabled=true where k.origin='default' and not k.enabled
  and exists(select 1 from public.tracking_rule_entries e where e.rule_key=k.rule_key and e.family in ('status','exclusion'));

reset role;
revoke masarifi_migration from current_user granted by current_user;
