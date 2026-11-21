grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- A separate read-only selector keeps the customer-requested email worker away
-- from legacy download jobs, schedules, other formats and pre-activation work.
create or replace function private.list_requested_pdf_email_work(
  p_kind text, p_limit integer, p_created_after timestamptz
) returns table(id uuid)
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(coalesce(nullif(pg_catalog.current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role','')<>'worker'
    or p_kind is null or p_kind not in ('report.generate','report.email.deliver')
    or p_limit is null or p_limit not between 1 and 100
    or p_created_after is null or not pg_catalog.isfinite(p_created_after)
    or p_created_after>pg_catalog.clock_timestamp() then
    raise exception using errcode='42501',message='REPORT_EMAIL_WORK_FORBIDDEN';
  end if;
  return query select a.id from private.report_output_attempts a
  where a.created_at>=p_created_after and a.expires_at>pg_catalog.clock_timestamp()
    and a.delivery_status in ('queued','generating','failed','ready','sending')
    and a.schedule_id is null
    and exists(select 1 from public.profiles p where p.id=a.user_id and p.status='active' and p.deleted_at is null)
    and a.snapshot->>'format'='pdf' and a.snapshot->>'delivery'='email'
    and case p_kind
      when 'report.generate' then a.delivery_status in ('queued','generating')
        or (a.delivery_status='failed' and a.error_code='REPORT_STORAGE_UNAVAILABLE' and a.attempt_count<20)
      else a.delivery_status in ('ready','sending')
    end
  order by a.created_at,a.id limit p_limit;
end $$;
alter function private.list_requested_pdf_email_work(text,integer,timestamptz) owner to masarifi_migration;
revoke all on function private.list_requested_pdf_email_work(text,integer,timestamptz)
  from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.list_requested_pdf_email_work(text,integer,timestamptz) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
