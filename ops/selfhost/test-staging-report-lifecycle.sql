-- Run against a disposable local database with the staging schema and hooks installed.
\set ON_ERROR_STOP on
begin;
do $$
declare
  owner_key text := 'user_'||replace(gen_random_uuid()::text,'-','');
  other_key text := 'user_'||replace(gen_random_uuid()::text,'-','');
  first_id uuid:=gen_random_uuid(); second_id uuid:=gen_random_uuid();
  other_id uuid:=gen_random_uuid(); prod_id uuid:=gen_random_uuid();
  req uuid:=gen_random_uuid(); deletion uuid:=gen_random_uuid(); expected text; n integer;
begin
  insert into public.profiles(id,status) values(owner_key,'active'),(other_key,'active');
  insert into staging_reports.report_output_attempts
    (id,user_id,report_type,period_start,period_end,ledger_version,snapshot,expires_at)
    select id,who,'financial_summary',current_date,current_date,0,'{"format":"pdf","delivery":"email"}',now()+interval '1 day'
    from (values(first_id,owner_key),(other_id,other_key)) v(id,who);
  insert into private.report_output_attempts
    (id,user_id,report_type,period_start,period_end,ledger_version,snapshot,expires_at)
    values(prod_id,other_key,'financial_summary',current_date,current_date,0,'{"format":"pdf","delivery":"email"}',now()+interval '1 day');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_key,'role','worker')::text,true);
  if exists(select from private.list_requested_pdf_email_work('report.generate',100,now()-interval '1 day') where id=first_id)
    or not exists(select from private.list_requested_pdf_email_work('report.generate',100,now()-interval '1 day') where id=prod_id)
    or exists(select from staging_reports.list_requested_pdf_email_work('report.generate',100,now()-interval '1 day') where id=prod_id)
    or not exists(select from staging_reports.list_requested_pdf_email_work('report.generate',100,now()-interval '1 day') where id=first_id)
  then raise exception 'environment isolation failed'; end if;
  expected:='reports/'||encode(extensions.digest(owner_key,'sha256'),'hex')||'/'||first_id||'.pdf';
  -- A damaged stored reference must never enqueue a different owner's object.
  begin
    insert into staging_reports.report_output_attempts
      (user_id,report_type,period_start,period_end,ledger_version,snapshot,storage_ref,expires_at)
      values(owner_key,'financial_summary',current_date,current_date,0,'{"format":"pdf"}',
        'reports/'||encode(extensions.digest(other_key,'sha256'),'hex')||'/'||other_id||'.pdf',now()+interval '1 day');
    perform private.reset_financial_data(owner_key,req);
    raise exception 'unexpected acceptance of mismatched file';
  exception when raise_exception then
    if sqlerrm<>'STAGING_REPORT_STORAGE_IDENTITY_INVALID' then raise; end if;
  end;
  insert into public.admin_profiles(user_id,status) values(other_key,'active');
  insert into private.retention_holds(resource_type,resource_id,reason,created_by)
    select resource_type,first_id::text,'Disposable hold fixture',other_key from private.retention_policies limit 1;
  begin
    perform private.reset_financial_data(owner_key,req);
    raise exception 'reset ignored report hold';
  exception when sqlstate '55000' then
    if sqlerrm<>'FINANCIAL_RESET_ACTIVE_HOLD' then raise; end if;
  end;
  delete from private.retention_holds where resource_id=first_id::text;
  perform staging_reports.enqueue_outbox_event('report.requested','report_attempt',first_id,'{}');
  perform staging_reports.enqueue_outbox_event('report.requested','report_attempt',other_id,'{}');
  perform private.reset_financial_data(owner_key,req);
  perform private.reset_financial_data(owner_key,req);
  select count(*) into n from private.financial_reset_objects where owner_id=owner_key and request_id=req and kind='report' and storage_ref=expected;
  if n<>1 or exists(select from staging_reports.outbox_events where aggregate_id=first_id)
    or not exists(select from staging_reports.outbox_events where aggregate_id=other_id)
    or exists(select from staging_reports.report_output_attempts where id=first_id) then raise exception 'reset cleanup failed'; end if;
  perform private.complete_financial_reset_object(owner_key,req,'report',expected);
  if exists(select from private.financial_reset_objects where owner_id=owner_key) then raise exception 'ack failed'; end if;

  perform set_config('masarifi.financial_generation','1',true);
  expected:='reports/'||encode(extensions.digest(owner_key,'sha256'),'hex')||'/'||second_id||'.pdf';
  insert into staging_reports.report_output_attempts
    (id,user_id,report_type,period_start,period_end,ledger_version,snapshot,storage_ref,expires_at)
    values(second_id,owner_key,'financial_summary',current_date,current_date,0,'{"format":"pdf"}',expected,now()+interval '1 day');
  insert into private.account_deletion_requests(id,user_id,status,requested_at,verified_at,cooling_off_ends_at)
    values(deletion,owner_key,'processing',now()-interval '2 days',now()-interval '1 day',now());
  perform private.freeze_account_deletion_owner(deletion,owner_key);
  begin
    perform private.erase_account_owner_payload(deletion,owner_key);
    raise exception 'erased before object lock';
  exception when insufficient_privilege then null; end;
  insert into private.retention_holds(resource_type,resource_id,reason,created_by)
    select resource_type,second_id::text,'Disposable report hold',other_key from private.retention_policies limit 1;
  begin
    perform private.lock_account_erasure_objects(deletion,owner_key);
    raise exception 'erasure ignored report hold';
  exception when sqlstate '55000' then
    if sqlerrm<>'ERASURE_ACTIVE_HOLD' then raise; end if;
  end;
  delete from private.retention_holds where resource_id=second_id::text;
  select count(*) into n from private.lock_account_erasure_objects(deletion,owner_key) where kind='report' and storage_ref=expected;
  if n<>1 then raise exception 'missing staging object'; end if;
  perform private.erase_account_owner_payload(deletion,owner_key);
  if exists(select from staging_reports.report_output_attempts where id=second_id)
    or not exists(select from staging_reports.report_output_attempts where id=other_id)
    or not exists(select from private.report_output_attempts where id=prod_id)
    or has_function_privilege('masarifi_worker','staging_reports.erase_owner_rows(text)','EXECUTE')
    then raise exception 'erasure scope failed'; end if;
end $$;
rollback;
