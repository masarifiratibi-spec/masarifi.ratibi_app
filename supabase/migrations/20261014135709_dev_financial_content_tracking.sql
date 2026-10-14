grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Opt-in only. No owner/device receives the new authority from this migration.
alter table private.tracking_automatic_cohorts
  add column source_admission_policy text not null default 'financial_sources'
    check(source_admission_policy in ('financial_sources','financial_content_v1')),
  add column capture_started_at timestamptz;
alter table private.tracking_automatic_cohorts add constraint tracking_content_boundary_required
  check(source_admission_policy<>'financial_content_v1' or capture_started_at is not null);

create function private.tracking_content_cohort(p_user_id text,p_device_id text)
returns setof private.tracking_automatic_cohorts
language sql stable security definer set search_path='' as $$
  select cohort.* from private.tracking_automatic_cohorts cohort
    join public.tracking_rule_channels c on c.release_id=cohort.release_id
    join public.tracking_rule_releases r on r.id=c.release_id
    join public.tracking_preferences p on p.user_id=cohort.user_id
    join public.profiles owner on owner.id=cohort.user_id and owner.status='active'
    where cohort.user_id=p_user_id and cohort.device_id=p_device_id
      and cohort.source_admission_policy='financial_content_v1'
      and cohort.enabled and cohort.expires_at>clock_timestamp()
      and p.enabled and not p.review_required and r.status='published'
      and cohort.engine_version=r.engine_version
      and c.environment='default' and c.market='global' and c.channel='all';
$$;

create function private.get_tracking_device_rule_snapshot(p_user_id text,p_device_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare configuration jsonb; cohort private.tracking_automatic_cohorts;
begin
  perform private.assert_active_profile(p_user_id);
  configuration:=private.get_tracking_rule_snapshot(p_user_id);
  select * into cohort from private.tracking_content_cohort(p_user_id,p_device_id);
  if cohort.user_id is null then return configuration; end if;
  return configuration||jsonb_build_object('sourceAdmissionPolicy','financial_content_v1',
    'policyActivatedAt',floor(extract(epoch from cohort.capture_started_at)*1000)::bigint);
end $$;
revoke all on function private.get_tracking_device_rule_snapshot(text,text) from public;
grant execute on function private.get_tracking_device_rule_snapshot(text,text) to masarifi_api;

alter function private.tracking_nominal_source(uuid) rename to tracking_nominal_source_before_content;
create function private.tracking_chat_package(p_source text) returns boolean
language sql immutable set search_path='' as $$
  select lower(p_source)=any(array['com.whatsapp','com.whatsapp.w4b','org.telegram.messenger','org.telegram.messenger.web','com.facebook.orca','com.facebook.mlite','com.discord','com.snapchat.android','com.instagram.android','com.google.android.apps.messaging','com.samsung.android.messaging','org.thoughtcrime.securesms','com.viber.voip','com.slack','com.microsoft.teams','com.skype.raider','jp.naver.line.android','com.tencent.mm','com.kakao.talk','im.vector.app','io.element.android.x','com.google.android.apps.dynamite']);
$$;
create function private.tracking_nominal_source(p_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; state jsonb; cohort private.tracking_automatic_cohorts;
begin
  select * into i from public.import_items where id=p_item_id;
  state:=private.tracking_nominal_source_before_content(p_item_id);
  if i.normalized_payload#>>'{transport,channel}'='android_notification' and private.tracking_chat_package(state->>'source') then return state||jsonb_build_object('eligible',false,'blocked',true); end if;
  if i.normalized_payload#>>'{metadata,sourceAdmissionPolicy}' is distinct from 'financial_content_v1' then return state; end if;
  select * into cohort from private.tracking_content_cohort(i.user_id,i.normalized_payload#>>'{transport,deviceId}');
  return state||jsonb_build_object('eligible',cohort.user_id is not null
    and not coalesce((state->>'blocked')::boolean,true)
    and i.normalized_payload#>>'{transport,channel}' in ('android_sms','android_notification')
    and i.normalized_payload#>>'{classification,releaseId}'=(select snapshot->>'releaseId' from public.tracking_rule_releases where id=cohort.release_id)
    and i.normalized_payload#>>'{classification,engineVersion}'=cohort.engine_version
    and (i.normalized_payload->>'receivedAt')::timestamptz>=cohort.capture_started_at);
end $$;

-- Even legacy trusted-source entries on this device cannot be replayed by
-- granting a content cohort. Retained records and identities remain untouched.
alter function private.tracking_capture_auto_enabled(uuid) rename to tracking_capture_auto_enabled_before_content;
create function private.tracking_capture_auto_enabled(p_item_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.tracking_capture_auto_enabled_before_content(p_item_id)
    and not exists(select 1 from public.import_items i
      join private.tracking_automatic_cohorts cohort on cohort.user_id=i.user_id
        and cohort.device_id=i.normalized_payload#>>'{transport,deviceId}'
      where i.id=p_item_id and cohort.source_admission_policy='financial_content_v1'
        and ((i.normalized_payload->>'receivedAt')::timestamptz<cohort.capture_started_at
          or i.normalized_payload#>>'{metadata,sourceAdmissionPolicy}' is distinct from 'financial_content_v1'));
$$;

-- Preserve actual provider/reference identities. Unlinked cross-channel
-- evidence remains diagnostic; amount similarity cannot establish identity.
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('private.finalize_import_session(uuid,uuid)'::regprocedure);
  if position('and not(i.normalized_payload ? ''providerReferenceDigest'') and exists(' in definition)=0 then raise exception 'TRACKING_CONTENT_CORRELATION_PRECONDITION'; end if;
  execute replace(definition,'and not(i.normalized_payload ? ''providerReferenceDigest'') and exists(',
    'and (not(i.normalized_payload ? ''providerReferenceDigest'') or i.normalized_payload#>>''{metadata,sourceAdmissionPolicy}''=''financial_content_v1'') and exists(');
  definition:=pg_get_functiondef('private.finalize_import_session(uuid,uuid)'::regprocedure);
  execute replace(definition,'and abs(x.amount_minor)=abs(i.amount_minor)',
    'and (not(i.normalized_payload ? ''providerReferenceDigest'') or x.normalized_payload->>''providerReferenceDigest''=i.normalized_payload->>''providerReferenceDigest'') and abs(x.amount_minor)=abs(i.amount_minor)');
  definition:=pg_get_functiondef('private.finalize_import_session(uuid,uuid)'::regprocedure);
  if position('and private.tracking_nominal_source(x.id)->>''provider''=state->>''provider''' in definition)=0 then raise exception 'TRACKING_CONTENT_PROVIDER_PRECONDITION'; end if;
  execute replace(definition,'and private.tracking_nominal_source(x.id)->>''provider''=state->>''provider''',
    'and (private.tracking_nominal_source(x.id)->>''provider''=state->>''provider'' or (i.normalized_payload#>>''{metadata,sourceAdmissionPolicy}''=''financial_content_v1'' and x.normalized_payload#>>''{metadata,sourceAdmissionPolicy}''=''financial_content_v1'' and x.normalized_payload#>>''{transport,channel}''<>i.normalized_payload#>>''{transport,channel}''))');
end $migration$;

revoke all on function private.tracking_chat_package(text),private.tracking_content_cohort(text,text),private.tracking_nominal_source(uuid),private.tracking_nominal_source_before_content(uuid),private.tracking_capture_auto_enabled(uuid),private.tracking_capture_auto_enabled_before_content(uuid) from public,masarifi_api,masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
