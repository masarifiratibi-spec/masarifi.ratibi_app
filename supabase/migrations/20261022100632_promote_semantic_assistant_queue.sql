grant masarifi_migration to current_user with admin false, inherit false, set true granted by current_user;
set local role masarifi_migration;

-- The worker chooses a queued owner's job; no client can select another owner.
-- The existing claim function still enforces consent, lifecycle and lease fencing.
create function private.claim_next_assistant_agent_job(p_lease_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare queued_owner text; claimed jsonb;
begin
  if p_lease_seconds not between 30 and 180 then
    raise exception 'AI_CLAIM_INVALID';
  end if;
  for queued_owner in select j.user_id
    from private.assistant_agent_jobs j
    where j.state in ('queued','processing')
      and j.next_attempt_at<=clock_timestamp()
      and (j.lease_until is null or j.lease_until<=clock_timestamp())
    order by j.next_attempt_at,j.id
    for update of j skip locked limit 32
  loop
    claimed:=private.claim_assistant_agent_job(queued_owner,p_lease_seconds);
    if claimed is not null then return claimed; end if;
  end loop;
  return null;
end $$;

alter function private.claim_next_assistant_agent_job(integer) owner to masarifi_migration;
revoke all on function private.claim_next_assistant_agent_job(integer) from public;
grant execute on function private.claim_next_assistant_agent_job(integer) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
