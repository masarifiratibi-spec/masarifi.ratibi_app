-- Run against a disposable migrated database with no due imports. All fixtures roll back.
begin;
do $test$
declare
  owner_id text := 'direct-privacy-' || gen_random_uuid()::text;
  other_owner text := owner_id || '-other';
  reset_id uuid := gen_random_uuid();
  deletion_id uuid := gen_random_uuid();
  import_id uuid := gen_random_uuid();
  token uuid;
  fn regprocedure;
  denied_role text;
begin
  foreach fn in array array['private.direct_import_work_due()'::regprocedure,
                            'private.scoped_privacy_work_pending(text)'::regprocedure] loop
    if not has_function_privilege('masarifi_worker',fn,'execute') then
      raise exception 'Worker cannot run readiness check';
    end if;
    foreach denied_role in array array['masarifi_api','anon','authenticated','service_role'] loop
      if has_function_privilege(denied_role,fn,'execute') then
        raise exception 'Unexpected readiness grant to %',denied_role;
      end if;
    end loop;
  end loop;
  insert into public.profiles(id,status) values(owner_id,'active');
  if private.direct_import_work_due() then raise exception 'Requires an empty import queue'; end if;
  insert into public.import_sessions(id,user_id,source_type,request_hash,status,next_attempt_at)
    values(import_id,owner_id,'manual',md5(import_id::text)||md5(import_id::text),'received',now()+interval '1 hour');
  if private.direct_import_work_due() then raise exception 'Deferred import signalled'; end if;
  update public.import_sessions set next_attempt_at=now() where id=import_id;
  if not private.direct_import_work_due() then raise exception 'New due import missed'; end if;
  select claim_token into strict token from private.claim_import_session('direct-poll-test',1,60) where id=import_id;
  if private.direct_import_work_due() then raise exception 'Active lease signalled'; end if;
  update public.import_sessions set lease_until=now()-interval '1 second' where id=import_id;
  if not private.direct_import_work_due() then raise exception 'Expired lease missed'; end if;

  if private.scoped_privacy_work_pending(owner_id) then raise exception 'Empty scope reported work'; end if;

  insert into private.financial_reset_receipts(owner_id,request_id,generation,reset_at)
    values(owner_id,reset_id,1,now());
  insert into private.financial_reset_objects(owner_id,request_id,kind,storage_ref,next_attempt_at)
    values(owner_id,reset_id,'export','direct-poll-fixture',now());
  if not private.scoped_privacy_work_pending(owner_id) or private.scoped_privacy_work_pending(other_owner)
    then raise exception 'Wrong scope for reset object'; end if;
  delete from private.financial_reset_objects where request_id=reset_id;

  insert into private.account_deletion_requests(id,user_id,status,requested_at,verified_at,cooling_off_ends_at)
    values(deletion_id,owner_id,'verified',now(),now(),now());
  if not private.scoped_privacy_work_pending(owner_id) or private.scoped_privacy_work_pending(other_owner)
    then raise exception 'Wrong scope for verified deletion'; end if;
  update private.account_deletion_requests set status='processing' where id=deletion_id;
  if not private.scoped_privacy_work_pending(owner_id) then raise exception 'Processing deletion missed'; end if;
  update private.account_deletion_requests set status='completed',completed_at=now() where id=deletion_id;
  if private.scoped_privacy_work_pending(owner_id) then raise exception 'Completed deletion reported work'; end if;
  insert into private.account_upload_erasure_tombstones(request_id,user_id,storage_ref,capability_expires_at)
    values(deletion_id,owner_id,'support/'||gen_random_uuid()::text||'/'||gen_random_uuid()::text,now());
  if not private.scoped_privacy_work_pending(owner_id) or private.scoped_privacy_work_pending(other_owner)
    then raise exception 'Wrong scope for remaining upload'; end if;
end
$test$;
rollback;
