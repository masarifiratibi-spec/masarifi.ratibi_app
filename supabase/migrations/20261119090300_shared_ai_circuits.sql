do $role$
begin
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.ai_circuit_grant', 'existing', true);
  else
    if exists (select from pg_auth_members where roleid='masarifi_migration'::regrole
               and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'Review existing self-granted migration membership';
    end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I', current_user, current_user);
    perform set_config('masarifi.ai_circuit_grant', 'temporary', true);
  end if;
end
$role$;

set local role masarifi_migration;

-- Each workload has one active route. Serialize only state transitions, never
-- hold a lock during a provider request. The token fences stale completions.
create table private.ai_route_circuits (
  workload text primary key check (workload in ('voice_transcription', 'financial_assistant')),
  generation uuid not null default gen_random_uuid(),
  failures timestamptz[] not null default '{}' check (cardinality(failures) < 5),
  open_until timestamptz,
  probe_until timestamptz
);
insert into private.ai_route_circuits(workload) values ('voice_transcription'), ('financial_assistant');
revoke all on private.ai_route_circuits from public, anon, authenticated, masarifi_api, masarifi_worker;

create function private.acquire_ai_circuit(p_workload text, p_lease_ms integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  circuit private.ai_route_circuits;
  at_time timestamptz;
begin
  select * into strict circuit from private.ai_route_circuits where workload=p_workload for update;
  at_time := clock_timestamp();
  if circuit.open_until is null then return circuit.generation; end if;
  if circuit.open_until > at_time or circuit.probe_until > at_time then return null; end if;
  if p_lease_ms is null or p_lease_ms <= 0 then raise exception 'Invalid AI circuit lease'; end if;
  update private.ai_route_circuits
    set generation=gen_random_uuid(), probe_until=at_time + p_lease_ms * interval '1 millisecond'
    where workload=p_workload returning generation into circuit.generation;
  return circuit.generation;
end
$$;

create function private.finish_ai_circuit(p_workload text, p_token uuid, p_outcome text) returns void
language plpgsql security definer set search_path='' as $$
declare
  circuit private.ai_route_circuits;
  recent timestamptz[];
  at_time timestamptz;
begin
  select * into strict circuit from private.ai_route_circuits where workload=p_workload for update;
  if p_token is distinct from circuit.generation then return; end if;
  at_time := clock_timestamp();
  if p_outcome = 'success' then
    update private.ai_route_circuits set failures='{}', open_until=null, probe_until=null
      where workload=p_workload;
  elsif p_outcome = 'retryable' then
    select array(select t from unnest(circuit.failures) t where t >= at_time - interval '60 seconds') || at_time into recent;
    if circuit.probe_until is not null or cardinality(recent) >= 5 then
      update private.ai_route_circuits set failures='{}', open_until=at_time + interval '30 seconds',
        probe_until=null, generation=gen_random_uuid() where workload=p_workload;
    else
      update private.ai_route_circuits set failures=recent where workload=p_workload;
    end if;
  elsif p_outcome = 'neutral' then
    if circuit.probe_until is not null then
      update private.ai_route_circuits set probe_until=null, generation=gen_random_uuid() where workload=p_workload;
    end if;
  else
    raise exception 'Invalid AI circuit outcome';
  end if;
end
$$;

revoke all on function private.acquire_ai_circuit(text,integer), private.finish_ai_circuit(text,uuid,text)
  from public, anon, authenticated, masarifi_api;
grant execute on function private.acquire_ai_circuit(text,integer), private.finish_ai_circuit(text,uuid,text)
  to masarifi_worker;

reset role;

do $role$
begin
  if current_setting('masarifi.ai_circuit_grant') = 'temporary' then
    execute format('revoke masarifi_migration from %I granted by %I', current_user, current_user);
  end if;
end
$role$;
