grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- One durable notice per movement; no provider delivery is scheduled.
-- Only the qualified DEV client presents it through its existing native API.
create function private.tracking_saved_local_notice(p_item uuid) returns void
language plpgsql security definer set search_path='' as $$
declare i public.import_items; t public.transactions; event_id uuid; language text; heading text; detail text;
begin
  select x.* into i from public.import_items x join public.import_sessions s on s.id=x.session_id
    where x.id=p_item and s.schema_version=3 and x.status='accepted'
      and x.normalized_payload->>'accountingPolicy'='default_account_nominal_v1'
      and x.normalized_payload#>>'{metadata,sourceAdmissionPolicy}'='financial_content_v1';
  if i.id is null or not exists(select 1 from private.tracking_content_cohort(i.user_id,i.normalized_payload#>>'{transport,deviceId}')) then return; end if;
  select * into t from public.transactions where id=i.transaction_id and user_id=i.user_id
    and source='tracking-import' and status='confirmed' and deleted_at is null;
  if t.id is null then return; end if;
  select id into event_id from private.outbox_events where aggregate_id=t.id
    and event_type='transaction.created' order by created_at,id limit 1;
  if event_id is null then return; end if;
  select locale into language from public.profiles where id=i.user_id and status='active';
  heading:=case when language='en' then case when t.kind='income' then 'Income recorded' else 'Expense recorded' end
    else case when t.kind='income' then 'تم تسجيل إيراد' else 'تم تسجيل مصروف' end end;
  detail:=left(btrim(regexp_replace(t.title,'[[:cntrl:]]',' ','g')),240);
  insert into public.notification_events(source_event_id,user_id,type,title,body_safe,data)
    values(event_id,i.user_id,'transaction.created',heading,coalesce(nullif(detail,''),heading),
      jsonb_build_object('schemaVersion',1,'automaticCapture',true,'trackingDeviceId',i.normalized_payload#>>'{transport,deviceId}',
        'targetKind','transaction','targetId',t.id,'actions',jsonb_build_array(jsonb_build_object('key','view','expiresAt',null))))
    on conflict(source_event_id) do nothing;
end $$;

alter function private.accept_import_item(uuid,uuid,uuid,uuid) rename to accept_import_item_before_local_notice;
revoke all on function private.accept_import_item_before_local_notice(uuid,uuid,uuid,uuid) from public,masarifi_api,masarifi_worker;
create function private.accept_import_item(p_item uuid,p_fence uuid,p_operation uuid,p_transaction uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=private.accept_import_item_before_local_notice(p_item,p_fence,p_operation,p_transaction);
  perform private.tracking_saved_local_notice(p_item);
  return result;
end $$;
revoke all on function private.tracking_saved_local_notice(uuid),private.accept_import_item(uuid,uuid,uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.accept_import_item(uuid,uuid,uuid,uuid) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
