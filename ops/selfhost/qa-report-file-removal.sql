-- Install only in the isolated reporting QA database.
\set ON_ERROR_STOP on
begin;
create function private.expire_owned_qa_pdf(p_id uuid)
returns table(outcome text, object_key text)
language plpgsql security definer set search_path='' as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims',true),'')::jsonb;
  owner_id text := claims->>'sub';
  attempt private.report_output_attempts%rowtype;
  expected text;
begin
  if claims->>'role' is distinct from 'authenticated' or nullif(owner_id,'') is null then
    raise insufficient_privilege;
  end if;
  if not exists(select from private.report_output_attempts where id=p_id and user_id=owner_id) then
    return query select 'missing'::text,null::text; return;
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_id::text,0))
     or not pg_try_advisory_xact_lock(hashtextextended(p_id::text,1)) then
    return query select 'busy'::text,null::text; return;
  end if;
  select * into attempt from private.report_output_attempts
    where id=p_id and user_id=owner_id for update;
  if not found or attempt.snapshot->>'format' is distinct from 'pdf'
      or attempt.snapshot->>'delivery' is distinct from 'download' then
    return query select 'missing'::text,null::text; return;
  end if;
  if attempt.delivery_status='expired' then
    return query select 'expired'::text,null::text; return;
  end if;
  if attempt.delivery_status not in ('ready','delivered') or exists (
    select from private.retention_holds where resource_id in (p_id::text,owner_id)
      and starts_at<=clock_timestamp() and (ends_at is null or ends_at>clock_timestamp())
  ) then
    return query select 'busy'::text,null::text; return;
  end if;
  expected := 'reports/'||encode(extensions.digest(owner_id,'sha256'),'hex')||'/'||p_id::text||'.pdf';
  if attempt.storage_ref is distinct from expected then raise exception 'REPORT_STORAGE_IDENTITY_INVALID'; end if;
  update private.report_output_attempts set delivery_status='expired' where id=p_id;
  return query select 'remove'::text,expected;
end $$;
alter function private.expire_owned_qa_pdf(uuid) owner to masarifi_migration;
revoke all on function private.expire_owned_qa_pdf(uuid) from public;
grant execute on function private.expire_owned_qa_pdf(uuid) to masarifi_api;
commit;
