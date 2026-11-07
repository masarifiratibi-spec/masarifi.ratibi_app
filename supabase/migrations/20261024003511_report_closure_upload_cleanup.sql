-- Continue deleting late-upload objects until every pre-erasure upload capability expires.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;
create function private.list_due_account_upload_erasure_owners(p_limit integer)
returns table(user_id text)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_limit not between 1 and 16 then
    raise exception using errcode='42501',message='ERASURE_PURGE_FORBIDDEN';
  end if;
  return query select t.user_id
    from private.account_upload_erasure_tombstones t
    join private.account_deletion_requests d on d.id=t.request_id and d.user_id=t.user_id
    join public.profiles p on p.id=t.user_id
    where d.status in ('processing','completed','failed') and p.status in ('deletion_pending','deleted')
      and t.next_attempt_at<=clock_timestamp() and (t.lease_until is null or t.lease_until<=clock_timestamp())
    group by t.user_id order by min(t.next_attempt_at),t.user_id limit p_limit;
end $$;
alter function private.list_due_account_upload_erasure_owners(integer) owner to masarifi_migration;
revoke all on function private.list_due_account_upload_erasure_owners(integer) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
grant execute on function private.list_due_account_upload_erasure_owners(integer) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
