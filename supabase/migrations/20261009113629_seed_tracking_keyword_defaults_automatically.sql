grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- The active, governed database release is the catalog. Do not duplicate a
-- hardcoded phrase list in this seed, or reset user edits during deployment.
create or replace function private.seed_default_keyword_rules(p_user_id text) returns integer
language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
  if not exists(select 1 from public.profiles where id=p_user_id and status='active') then
    return 0;
  end if;
  insert into public.user_keyword_rules(
    user_id,keyword,group_key,language_code,origin,match_type,priority,enabled,rule_key
  )
  select p_user_id,keyword,group_key,language_code,'default','contains',priority,true,rule_key
  from (
    select distinct on(lower(phrase.keyword)) phrase.keyword,entry.rule_key,entry.priority,
      case
        -- The legacy keyword UI groups non-postable lifecycle wording together.
        -- Classification/status/precedence always come from the release effects.
        when entry.family='status' then 'failed_transaction'
        when entry.definition#>>'{effects,subtype}'='salary' then 'income'
        when entry.definition#>>'{effects,subtype}'='generic_credit' then 'income'
        when entry.definition#>>'{effects,subtype}'='deposit' then 'deposit'
        when entry.definition#>>'{effects,subtype}' in ('transfer_sent','transfer_received') then 'transfer'
        when entry.definition#>>'{effects,subtype}'='withdrawal' then 'withdrawal'
        when entry.definition#>>'{effects,subtype}'='refund' then 'refund'
        when entry.definition#>>'{effects,subtype}'='reversal' then 'reversal'
        when entry.definition#>>'{effects,subtype}'='fee' then 'fee'
        else 'expense'
      end as group_key,
      case when phrase.keyword ~ '[ء-ي]' then 'ar' else 'en' end as language_code
    from public.tracking_rule_channels channel
    join public.tracking_rule_releases release on release.id=channel.release_id and release.status='published'
    join public.tracking_rule_entries entry on entry.release_id=release.id
    cross join lateral jsonb_array_elements_text(entry.definition->'any') phrase(keyword)
    where channel.environment='default' and channel.market='global' and channel.channel='all'
      and entry.enabled and entry.family in ('action','status')
    order by lower(phrase.keyword),entry.priority desc,entry.rule_key
  ) defaults
  on conflict(user_id,lower(keyword),match_type) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;
alter function private.seed_default_keyword_rules(text) owner to masarifi_migration;
revoke all on function private.seed_default_keyword_rules(text) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;

create or replace function private.seed_profile_tracking_keywords() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='active' then perform private.seed_default_keyword_rules(new.id); end if;
  return new;
end $$;
alter function private.seed_profile_tracking_keywords() owner to masarifi_migration;
revoke all on function private.seed_profile_tracking_keywords() from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
drop trigger if exists profiles_seed_tracking_keywords on public.profiles;
create trigger profiles_seed_tracking_keywords after insert on public.profiles
for each row execute function private.seed_profile_tracking_keywords();

create or replace function private.restore_default_keyword_rules(p_user_id text) returns integer
language plpgsql security definer set search_path='' as $$
declare inserted_count integer; request_id text:=private.tracking_request_id();
begin
  perform private.assert_active_profile(p_user_id);
  delete from public.user_keyword_rules where user_id=p_user_id and origin='default';
  inserted_count:=private.seed_default_keyword_rules(p_user_id);
  perform audit.append_event(p_user_id,'user','tracking.keyword-defaults-restored','tracking_preference',p_user_id,null,null,null,request_id,
    jsonb_build_object('count',inserted_count,'source','active_tracking_rule_release'));
  return inserted_count;
end $$;
alter function private.restore_default_keyword_rules(text) owner to masarifi_migration;
revoke all on function private.restore_default_keyword_rules(text) from public;
grant execute on function private.restore_default_keyword_rules(text) to masarifi_api;

-- Upgrade existing users as well as fresh installations. Unique phrase keys and
-- ON CONFLICT preserve custom rules, disabled defaults, IDs and optimistic versions.
select private.seed_default_keyword_rules(id) from public.profiles where status='active';

reset role;
revoke masarifi_migration from current_user granted by current_user;
