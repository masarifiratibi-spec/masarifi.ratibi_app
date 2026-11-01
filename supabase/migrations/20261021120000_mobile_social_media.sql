grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

insert into private.system_settings(setting_key,value,sensitivity)
values ('mobile.social_links','{"instagram":"","tiktok":"","snapchat":""}'::jsonb,'public')
on conflict(setting_key) do nothing;

create function private.validate_social_media_links(p_links jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare platform text; link text; profile_pattern text;
begin
  if jsonb_typeof(p_links) is distinct from 'object'
    or not (p_links ?& array['instagram','tiktok','snapchat'])
    or p_links-array['instagram','tiktok','snapchat'] <> '{}'::jsonb then return false; end if;
  for platform,link in select key,value #>> '{}' from jsonb_each(p_links) loop
    if jsonb_typeof(p_links->platform) is distinct from 'string' then return false; end if;
    if link='' then continue; end if;
    if length(link)>500 or link ~ '[[:space:]\\]' then return false; end if;
    profile_pattern:=case platform
      when 'instagram' then 'instagram\.com/[A-Za-z0-9._]+'
      when 'tiktok' then 'tiktok\.com/@[A-Za-z0-9._]+'
      when 'snapchat' then 'snapchat\.com/(add/|@)[A-Za-z0-9._-]+' end;
    if link !~* ('^https://(www\.)?'||profile_pattern||'/?([?#][^[:space:]\\]*)?$') then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function private.validate_social_media_links(jsonb) from public;

alter table private.system_settings add constraint system_settings_social_links_check
check(setting_key<>'mobile.social_links' or private.validate_social_media_links(value));

-- Extend the existing audited, versioned command without bypassing its permissions.
do $migration$
declare definition text:=replace(pg_get_functiondef('private.execute_operations_command(text,text,jsonb,text,text,text)'::regprocedure),E'\r\n',E'\n');
  allowance text:=$needle$(setting_key='operations.ai.allowance' and p_body->'value'='5'::jsonb)$needle$;
  url_guard text:=$needle$or p_body::text ~*$needle$;
begin
  if strpos(definition,allowance)=0 or strpos(definition,url_guard)=0 or strpos(definition,'validate_social_media_links')>0 then
    raise exception 'SOCIAL_MEDIA_GOVERNANCE_BASELINE_MISMATCH';
  end if;
  definition:=replace(definition,allowance,
    '(setting_key=''mobile.social_links'' and private.validate_social_media_links(p_body->''value'')) or '||allowance);
  definition:=replace(definition,url_guard,
    'or (case when p_operation=''updateSetting'' and p_resource_key=''mobile.social_links'' and private.validate_social_media_links(p_body->''value'') then p_body-''value'' else p_body end)::text ~*');
  execute definition;
end $migration$;

create function private.read_social_media_links() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce((select value from private.system_settings where setting_key='mobile.social_links'),
    '{"instagram":"","tiktok":"","snapchat":""}'::jsonb);
$$;
revoke all on function private.read_social_media_links() from public,anon,authenticated,masarifi_worker;
grant execute on function private.read_social_media_links() to masarifi_api;

reset role;
revoke masarifi_migration from current_user granted by current_user;
